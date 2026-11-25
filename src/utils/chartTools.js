/* ============================================
   科研图表工具（全站 ECharts 通用）
   - buildToolbox：统一工具箱（框选缩放 / 还原 / PNG 高清图 / SVG 矢量图 / CSV 原始数据）
   - exportCSV：导出原始数据（UTF-8 BOM，Excel 直接打开；含来源与口径说明行）
   - exportChartSVG：SSR 渲染矢量 SVG（论文配图无损放大）
   设计原则：导出的 CSV 一律为原始数值，不导出图表用的归一化/衍生显示值
   ============================================ */
import * as echarts from 'echarts';
import { exportCSV as portalExportCSV, EXPORT_DISCLAIMER } from '../modules/_shared/exporters';
import { getExportGuard } from './exportGuard';
import { attachChartA11y } from './chartA11y';
import '../styles/chart-a11y.css';

const ICON_CSV = 'M4 4h16v16H4V4zm0 5h16M4 14h16M9.5 4v16M14.5 4v16';
const ICON_SVG = 'M4 5h16v14H4V5zm0 9l4.5-4 3 3 4-5L20 14v4H4v-4zM8 9.5a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z';

/* ------------------------------------------------------------
   全站导出免责守卫注册表
   ------------------------------------------------------------
   ECharts toolbox 的 onclick 在图表组件内部构造；若逐层 prop 传 guard，
   要改 27 个调用点。改由 Layout 挂载一次守卫，buildToolbox 在「点击时」
   读取注册表中的函数（不是 option 构造时），避开 React 子组件 effect
   先于父组件 effect 执行的注册时序问题。未注册时行为完全不变。
   ------------------------------------------------------------ */
/* 兼容旧调用点：守卫单例已下沉到 ./exportGuard（无 echarts 依赖），
   本模块继续 re-export 以不破坏任何 import 路径。 */
export { setExportGuard } from './exportGuard';

function triggerDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function safeName(name) {
  return (name || 'chart').replace(/[\\/:*?"<>|]/g, '_');
}

/* 导出原始数据 CSV
   收敛规则：下载逻辑全站只有 @portal/exporters 一份，这里只做参数转发。
   - exportedAt 默认 false：保留旧工具箱导出的逐字节输出，未接 guard 的调用点行为不变
   - 新增 extraMeta：供免责说明 meta 行（唯一真源 EXPORT_DISCLAIMER）写入
   meta 行以 "#" 前缀输出（pandas read_csv(comment='#') 可直接识别） */
export function exportCSV(filename, { headers = [], rows = [], source = '', caliber = '', extraMeta = [], exportedAt = false } = {}) {
  portalExportCSV(filename, { headers, rows, source, caliber, extraMeta, exportedAt });
}

/* 工具箱 CSV 载荷登记表
   ------------------------------------------------------------
   R3 硬约束：echarts toolbox 图标是 canvas 绘制的，Tab 不可聚焦，
   每张含 CSV 的图表卡必须额外提供一个原生 <button>（ChartExportButton）。
   登记表让按钮复用与 toolbox 完全同一份 csv 载荷（以 filename 为键），
   避免把 headers/rows/source/caliber 在 JSX 里再抄一遍造成口径漂移。
   这里只存数据、不写任何下载逻辑；buildToolbox 初始化时写入。 */
const chartCsvRegistry = new Map();
export function getChartCsv(filename) {
  return chartCsvRegistry.get(filename);
}

/* 矢量 SVG 导出：SSR 离屏渲染，与屏幕上的 option 完全一致 */
export function exportChartSVG(inst, getOption, filename) {
  const option = typeof getOption === 'function' ? getOption() : getOption;
  const dom = inst?.getDom?.();
  const width = dom?.clientWidth || 1200;
  const height = dom?.clientHeight || 720;
  const ssr = echarts.init(null, null, { renderer: 'svg', ssr: true, width, height });
  ssr.setOption({ backgroundColor: '#ffffff', animation: false, ...option });
  const svg = ssr.renderToSVGString();
  ssr.dispose();
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(`${safeName(filename)}.svg`, blob);
}

/* 标准科研工具箱配置
   @param inst    echarts 实例（SVG 导出取容器尺寸用）
   @param getOption 返回当前完整 option 的函数（点击导出时才执行，规避自引用）
   @param filename 导出文件名（不含扩展名）
   @param csv     { headers, rows, source, caliber }；不传则不显示 CSV 按钮
   @param zoom    是否启用框选缩放（饼图/桑基图等设为 false）
   @param svg     是否启用 SVG 导出（默认 true）
   @param guard   可选动作守卫 (run, meta) => void，如导出前免责确认；不传时行为完全不变
*/
export function buildToolbox(inst, getOption, { filename, csv, zoom = true, svg = true, guard } = {}) {
  const hasCsv = Boolean(csv && csv.rows && csv.rows.length);
  if (hasCsv && filename) chartCsvRegistry.set(filename, csv);

  // canvas 文本等价：给容器加 aria-label，并在下方挂可展开的原始数据表格。
  // 复用同一份 csv，幂等注入；无 csv 的图表也至少获得一句话 aria 摘要。
  try { attachChartA11y(inst, { filename, csv }); }
  catch (e) { console.warn('[chartA11y] 注入失败，图表功能不受影响：', e); }

  // 点击时解析守卫：显式 guard 优先，否则用 Layout 注册的全局守卫。
  // 不能在构造期解析 —— 图表子组件的 effect 早于 Layout 的 effect 执行。
  const resolveGuard = () => (typeof guard === 'function' ? guard : getExportGuard());
  const withGuard = (run) => {
    const g = resolveGuard();
    if (typeof g !== 'function') { run(); return; }
    g(run, {
      title: '导出前请确认',
      notice: `即将导出「${filename}」。导出内容仅作研究参考，请确认已核对来源与口径。`,
      confirmLabel: '确认并导出',
    });
  };

  const feature = {};
  if (zoom) {
    feature.dataZoom = { title: { zoom: '框选缩放', back: '退回缩放' } };
  }
  feature.restore = { title: '还原视图' };
  feature.saveAsImage = {
    title: '导出 PNG 高清图',
    name: safeName(filename),
    pixelRatio: 2,
    backgroundColor: '#ffffff',
  };
  if (svg) {
    feature.mySVG = {
      show: true,
      title: '导出 SVG 矢量图',
      icon: ICON_SVG,
      // PNG 由 echarts 内置 saveAsImage 处理（非 onclick），不挂 guard；
      // SVG/CSV 是自定义 onclick，统一走守卫。
      onclick: () => withGuard(() => {
        try { exportChartSVG(inst, getOption, filename); }
        catch (e) { console.error('SVG 导出失败', e); }
      }),
    };
  }
  if (hasCsv) {
    feature.myCSV = {
      show: true,
      title: '导出原始数据 CSV',
      icon: ICON_CSV,
      onclick: () => withGuard(() => exportCSV(filename, typeof resolveGuard() === 'function'
        ? { ...csv, extraMeta: [...(csv.extraMeta || []), EXPORT_DISCLAIMER] }
        : csv)),
    };
  }
  return {
    right: 10,
    top: 8,
    itemSize: 15,
    itemGap: 10,
    showTitle: true,
    textStyle: { color: '#64748b', fontSize: 11 },
    iconStyle: { borderColor: '#94a3b8' },
    emphasis: { iconStyle: { borderColor: '#2563eb', color: '#2563eb' } },
    feature,
  };
}
