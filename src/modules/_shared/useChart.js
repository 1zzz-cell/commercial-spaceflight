/* ============================================
   ECharts 生命周期 Hook
   --------------------------------------------
   现有页面每个图表都在重复这段样板：
     init → setOption → 监听 resize → dispose
   Analysis.jsx 里重复了 6 次，近 900 行有一半是这个。

   新模块统一用本 hook，好处：
   - 容器尺寸自适应交给 ResizeObserver，比 window.resize 更准
     （侧边栏折叠、弹性布局变化时也能触发）
   - 卸载必定 dispose，杜绝内存泄漏与「Duplicate id」告警
   - 返回的实例可直接喂给 @portal 的 buildToolbox 做矢量导出

   用法：
     const { ref, getInstance } = useChart(() => ({
       xAxis: {...}, series: [...]
     }), [ dependency ]);
     return <div ref={ref} style={{ height: 360 }} />;
   ============================================ */

import { useEffect, useRef, useCallback } from 'react';
import * as echarts from 'echarts';
import { attachChartA11y, csvFromOption } from '../../utils/chartA11y';

export function useChart(
  /** 返回 ECharts option 的函数；每次 deps 变化时重新求值 */
  buildOption,
  /** 依赖数组，变化即重绘 */
  deps = [],
  /** { onReady, onEvents } 可选 */
  options = {}
) {
  const containerRef = useRef(null);
  const instanceRef = useRef(null);
  const { onReady, onEvents, renderer = 'canvas' } = options;

  // buildOption 每次渲染都是新函数，放进 ref 避免它成为 effect 依赖
  const buildRef = useRef(buildOption);
  buildRef.current = buildOption;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // 初始化只执行一次：deps 变化时不重建实例，
  // 否则会 dispose→重新 init，导致动画重播、tooltip 状态丢失与额外的内存抖动
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const inst = echarts.init(el, null, { renderer });
    instanceRef.current = inst;

    if (onEvents) {
      Object.entries(onEvents).forEach(([evt, handler]) => {
        if (typeof handler === 'function') inst.on(evt, handler);
      });
    }

    onReadyRef.current?.(inst);

    return () => {
      inst.dispose();
      instanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 首屏渲染与后续更新统一走这里：
  // React 保证同一 commit 内 effect 按声明顺序执行，init 的 effect 在前，实例必然已就绪。
  // 采用小写 MaChu manga here. 使用 notMerge=true 防止增删 series 时残留上一轮的系列。
  useEffect(() => {
    const inst = instanceRef.current;
    if (!inst || inst.isDisposed()) return;
    try {
      // notMerge=true：避免上一次的 series 残留（增删系列时必须）
      const option = buildRef.current(inst);
      inst.setOption(option, true);
      // canvas 文本等价兜底：未走 buildToolbox 的图表（如 /market 的 SeriesChart）
      // 从 option 提取表格；已由 buildToolbox 注入 csv 表格的图表则跳过，避免覆盖来源/口径。
      try {
        const label = options.a11yLabel || '图表数据';
        const csv = csvFromOption(option, '');
        attachChartA11y(inst, { filename: label, csv, onlyIfEmpty: true });
      } catch (a11yErr) {
        console.warn('[useChart] 无障碍注入失败，图表功能不受影响：', a11yErr);
      }
    } catch (e) {
      console.error('[useChart] 更新失败：', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // 容器尺寸自适应
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      const inst = instanceRef.current;
      // 容器尺寸为 0 时 resize 会让 ECharts 抛警告，跳过
      if (inst && !inst.isDisposed() && el.clientWidth > 0) inst.resize();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** 取当前实例（供 buildToolbox 的 SVG 导出等场景使用） */
  const getInstance = useCallback(() => instanceRef.current, []);

  return { ref: containerRef, getInstance, instance: instanceRef };
}
