import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Link } from 'react-router-dom';
import { DataTable } from '../components/DataTable';
import { RiskBanner, useDisclaimerGuard } from '../components/ComplianceKit';
import { useData } from '../context/DataContext';
import { useChinaMap } from '../hooks/useChinaMap';
import { buildToolbox } from '../utils/chartTools';

/* ============================================================
   资金链 /analysis —— 投融资数据全景页
   ------------------------------------------------------------
   职责：给「产业全貌」视角，回答市场规模、发射次数、融资时序、
        区域分布、赛道结构这五个问题。
   与 /investors 的分工：本页是数据页（看全貌），
        投资分析工具是决策页（看赛道热度、企业画像、催化剂）。
        两页页头互链，不要做成重复内容。

   图表组件（8 个，各自独立 init/dispose，均接了 buildToolbox 导出）：
     MarketSizeChart / LaunchChart / FinancingChart /
     FinancingStructureChart / RegionChart（依赖中国地图 geojson）/
     SegmentFinancingChart / FinancingSankeyChart / FinancingNotes

   ⚠ 口径提醒：本页的 SegmentFinancingChart 用的是数据文件里的
     `segmentStats`（2025 年快照），而 /investors 用的是
     financingEvents 实时归集——两者不可直接对比。
     页面底部另有「重点融资事件明细」表，走 DataTable。
   ============================================================ */

/* ---------- 公共配色（浅色 B2B 冷蓝主题） ---------- */
const COLORS = {
  primary: '#2563eb',
  secondary: '#3b82f6',
  accent: '#06b6d4',
  purple: '#8b5cf6',
  deepBlue: '#1d4ed8',
  green: '#10b981',
  orange: '#f06235',
  areaGradientTop: 'rgba(37, 99, 235, 0.22)',
  areaGradientBottom: 'rgba(37, 99, 235, 0.02)',
  gridLine: 'rgba(148, 163, 184, 0.15)',
  axisLabel: '#475569',
};

const baseTextStyle = { color: '#475569', fontSize: 12 };
const baseAxisLine = { lineStyle: { color: 'rgba(203, 213, 225, 0.5)' } };
const baseSplitLine = { lineStyle: { color: COLORS.gridLine } };

const segmentColors = {
  '火箭制造': COLORS.orange,
  '卫星制造': COLORS.purple,
  '卫星互联网': COLORS.primary,
  '遥感应用': COLORS.green,
  '遥感卫星': COLORS.accent,
  '卫星物联网': COLORS.deepBlue,
};

/* ---------- 图表1：市场规模趋势 ---------- */
function MarketSizeChart({ marketSizeData }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);
    // 预测年份（存在时才标注预测区间）
    const predicted = marketSizeData.predictedYears || [];

    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: 'rgba(76,201,240,0.3)',
        textStyle: { color: '#1a1f36' },
        formatter: (params) => {
          const p = params[0];
          const suffix = predicted.includes(p.name) ? '（预测）' : '';
          return `<b>${p.name}年</b><br/>市场规模：${p.value} 万亿元${suffix}`;
        },
      },
      grid: { left: 60, right: 30, top: 40, bottom: 40 },
      xAxis: {
        type: 'category',
        data: marketSizeData.years,
        axisLabel: { ...baseTextStyle, formatter: '{value}' },
        axisLine: baseAxisLine,
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '万亿元',
        nameTextStyle: { ...baseTextStyle },
        axisLabel: baseTextStyle,
        axisLine: { show: false },
        splitLine: baseSplitLine,
      },
      series: [
        {
          name: '市场规模',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: COLORS.primary, width: 3 },
          itemStyle: { color: COLORS.primary, borderColor: '#fff', borderWidth: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: COLORS.areaGradientTop },
              { offset: 1, color: COLORS.areaGradientBottom },
            ]),
          },
          data: marketSizeData.values,
          // 预测区间高亮
          markArea: predicted.length ? {
            silent: true,
            itemStyle: { color: 'rgba(245,158,11,0.08)' },
            label: { show: true, position: 'insideTop', color: '#b45309', fontSize: 11, formatter: '预测区间' },
            data: [[{ xAxis: predicted[0] }, { xAxis: predicted[predicted.length - 1] }]],
          } : undefined,
        },
      ],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '市场规模趋势-资金链',
        csv: {
          headers: ['年份', '市场规模(万亿元)', '数据性质'],
          rows: marketSizeData.years.map((y, i) => [y, marketSizeData.values[i], predicted.includes(String(y)) ? '预测' : '实绩']),
          source: marketSizeData.source,
          caliber: '行业研究机构历年测算，预测年份已单列标注',
        },
      }),
    };

    instanceRef.current.setOption(option);

    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      instanceRef.current?.dispose();
    };
  }, []);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-title">市场规模趋势</h3>
        <p className="chart-desc">2015-2025年中国商业航天市场规模变化（单位：万亿元）</p>
      </div>
      <div ref={chartRef} className="chart-container" />
      <div className="chart-source">数据来源：{marketSizeData.source}</div>
    </div>
  );
}

/* ---------- 图表2：发射次数统计 ---------- */
function LaunchChart({ launchData }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);
    // 预测年份（存在时才标注预测区间）
    const predicted = launchData.predictedYears || [];

    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: 'rgba(76,201,240,0.3)',
        textStyle: { color: '#1a1f36' },
        formatter: (params) => {
          const lines = params.map((p) => `${p.marker}${p.seriesName}：${p.value}${predicted.includes(p.name) ? '（预测）' : ''}`);
          return `<b>${params[0].name}年</b><br/>${lines.join('<br/>')}`;
        },
      },
      legend: {
        data: ['总发射', '商业发射', '民营火箭'],
        textStyle: { color: COLORS.axisLabel, fontSize: 12 },
        top: 0,
      },
      grid: { left: 60, right: 30, top: 50, bottom: 40 },
      xAxis: {
        type: 'category',
        data: launchData.years,
        axisLabel: baseTextStyle,
        axisLine: baseAxisLine,
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '次',
        nameTextStyle: { ...baseTextStyle },
        axisLabel: baseTextStyle,
        axisLine: { show: false },
        splitLine: baseSplitLine,
      },
      series: [
        {
          name: '总发射',
          type: 'bar',
          barGap: '10%',
          itemStyle: { color: COLORS.secondary, borderRadius: [4, 4, 0, 0] },
          data: launchData.total,
          // 预测区间高亮
          markArea: predicted.length ? {
            silent: true,
            itemStyle: { color: 'rgba(245,158,11,0.08)' },
            label: { show: true, position: 'insideTop', color: '#b45309', fontSize: 11, formatter: '预测区间' },
            data: [[{ xAxis: predicted[0] }, { xAxis: predicted[predicted.length - 1] }]],
          } : undefined,
        },
        {
          name: '商业发射',
          type: 'bar',
          itemStyle: { color: COLORS.primary, borderRadius: [4, 4, 0, 0] },
          data: launchData.commercial,
        },
        {
          name: '民营火箭',
          type: 'bar',
          itemStyle: { color: COLORS.accent, borderRadius: [4, 4, 0, 0] },
          data: launchData.private,
        },
      ],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '中国航天发射次数统计',
        csv: {
          headers: ['年份', '总发射(次)', '商业发射(次)', '民营火箭(次)', '数据性质'],
          rows: launchData.years.map((y, i) => [y, launchData.total[i], launchData.commercial[i], launchData.private[i], predicted.includes(String(y)) ? '预测' : '实绩']),
          source: launchData.source,
          caliber: '商业发射数据引国家航天局2026-01-20发布；预测年份已单列标注',
        },
      }),
    };

    instanceRef.current.setOption(option);

    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      instanceRef.current?.dispose();
    };
  }, []);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-title">发射次数统计</h3>
        <p className="chart-desc">2020-2025年中国航天发射次数对比（单位：次）</p>
      </div>
      <div ref={chartRef} className="chart-container" />
      <div className="chart-source">数据来源：{launchData.source}</div>
    </div>
  );
}

/* ---------- 图表3：融资情况（含异常标注） ---------- */
function FinancingChart({ financingData }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);

    const markPoints = [];
    financingData.years.forEach((year, i) => {
      if (year === '2024') {
        markPoints.push({
          coord: [i, financingData.events[i]],
          symbol: 'pin', symbolSize: 40,
          itemStyle: { color: COLORS.orange },
          label: { show: true, formatter: '异常', fontSize: 10, color: '#fff' },
        });
      }
    });
    // 预测年份（存在时才标注预测区间）
    const predicted = financingData.predictedYears || [];

    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: 'rgba(76,201,240,0.3)',
        textStyle: { color: '#1a1f36' },
        formatter: (params) => {
          const lines = params.map((p) => `${p.marker}${p.seriesName}：${p.value}${predicted.includes(p.name) ? '（预测）' : ''}`);
          return `<b>${params[0].name}年</b><br/>${lines.join('<br/>')}`;
        },
      },
      legend: {
        data: ['融资事件数', '融资金额'],
        textStyle: { color: COLORS.axisLabel, fontSize: 12 },
        top: 0,
      },
      grid: { left: 60, right: 60, top: 50, bottom: 40 },
      xAxis: {
        type: 'category',
        data: financingData.years,
        axisLabel: baseTextStyle,
        axisLine: baseAxisLine,
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          name: '事件数',
          nameTextStyle: { ...baseTextStyle },
          axisLabel: baseTextStyle,
          axisLine: { show: false },
          splitLine: baseSplitLine,
        },
        {
          type: 'value',
          name: '亿元',
          nameTextStyle: { ...baseTextStyle },
          axisLabel: baseTextStyle,
          axisLine: { show: false },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '融资事件数',
          type: 'bar',
          yAxisIndex: 0,
          barWidth: '40%',
          itemStyle: { color: COLORS.purple, borderRadius: [4, 4, 0, 0] },
          data: financingData.events,
          markPoint: { data: markPoints },
          // 预测区间高亮
          markArea: predicted.length ? {
            silent: true,
            itemStyle: { color: 'rgba(245,158,11,0.08)' },
            label: { show: true, position: 'insideTop', color: '#b45309', fontSize: 11, formatter: '预测区间' },
            data: [[{ xAxis: predicted[0] }, { xAxis: predicted[predicted.length - 1] }]],
          } : undefined,
        },
        {
          name: '融资金额',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { color: COLORS.accent, width: 2 },
          itemStyle: { color: COLORS.accent, borderColor: '#fff', borderWidth: 2 },
          data: financingData.amounts,
        },
      ],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '融资事件数与金额',
        csv: {
          headers: ['年份', '融资事件数(起)', '融资金额(亿元)', '数据性质'],
          rows: financingData.years.map((y, i) => [y, financingData.events[i], financingData.amounts[i], predicted.includes(String(y)) ? '预测' : '实绩']),
          source: financingData.source,
          caliber: '金额为公开披露融资额汇总（未披露金额事件不计入金额）；预测年份已单列标注',
        },
      }),
    };

    instanceRef.current.setOption(option);

    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      instanceRef.current?.dispose();
    };
  }, []);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-title">融资情况分析</h3>
        <p className="chart-desc">2017-2025年中国商业航天融资事件数与金额（双轴图）</p>
      </div>
      <div ref={chartRef} className="chart-container" />
      <div className="chart-source">数据来源：{financingData.source}</div>
    </div>
  );
}

/* ---------- 图表4：2025年融资结构 ---------- */
function FinancingStructureChart({ financingStructure2025 }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);

    const option = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: 'rgba(76,201,240,0.3)',
        textStyle: { color: '#1a1f36' },
        formatter: '{b}<br/>融资金额：{c} 亿元 ({d}%)',
      },
      legend: {
        orient: 'horizontal',
        bottom: 4,
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 14,
        textStyle: { color: COLORS.axisLabel, fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '70%'],
          center: ['50%', '44%'],
          itemStyle: { borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          data: financingStructure2025.categories.map((c, i) => ({
            name: c,
            value: financingStructure2025.amounts[i],
            itemStyle: {
              color: [COLORS.primary, COLORS.accent, COLORS.purple][i],
            },
          })),
        },
      ],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '2025年融资结构',
        zoom: false,
        csv: {
          headers: ['类别', '融资金额(亿元)'],
          rows: financingStructure2025.categories.map((c, i) => [c, financingStructure2025.amounts[i]]),
          source: financingStructure2025.source,
          caliber: '2025年公开披露融资金额按环节汇总',
        },
      }),
    };

    instanceRef.current.setOption(option);

    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      instanceRef.current?.dispose();
    };
  }, []);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-title">2025年融资结构</h3>
        <p className="chart-desc">卫星应用、火箭制造、卫星制造三大领域融资金额分布；三大领域合计184.1亿元，其余为其他细分领域</p>
      </div>
      <div ref={chartRef} className="chart-container" />
      <div className="chart-source">数据来源：{financingStructure2025.source}</div>
    </div>
  );
}

/* ---------- 图表5：企业区域分布地图 ---------- */
function RegionChart({ regionData, geoSource }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  const { ready, error, mapName } = useChinaMap();

  // 省份全称须与 GeoJSON properties.name 完全一致
  const mapData = regionData.regions.map((name, i) => ({
    name,
    value: regionData.enterpriseCount[i],
    feature: regionData.features[i],
  }));
  const ranked = [...mapData].sort((a, b) => b.value - a.value);
  const maxVal = Math.max(...regionData.enterpriseCount);

  useEffect(() => {
    if (!ready || !chartRef.current) return undefined;
    instanceRef.current = echarts.init(chartRef.current);

    const option = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: 'rgba(76,201,240,0.3)',
        textStyle: { color: '#1a1f36' },
        formatter: (p) => {
          if (p.value == null || Number.isNaN(p.value)) {
            return `<b>${p.name}</b><br/>暂无该省统计数据`;
          }
          const d = mapData.find((x) => x.name === p.name);
          return `<b>${p.name}</b><br/>存续相关企业：<b>${p.value}</b> 家<br/><span style="color:#64748b;font-size:11px">${d?.feature || ''}</span>`;
        },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        left: 16,
        bottom: 16,
        text: ['多', '少'],
        calculable: true,
        textStyle: { color: '#475569', fontSize: 12 },
        inRange: { color: ['#eef3fb', '#93c5fd', '#3b82f6', '#1d4ed8'] },
      },
      series: [
        {
          name: '存续相关企业数',
          type: 'map',
          map: mapName,
          roam: true,
          zoom: 1.15,
          center: [108, 35],
          // 限制缩放范围，保证交互流畅且不会丢失地图上下文
          scaleLimit: { min: 0.9, max: 8 },
          label: { show: false },
          itemStyle: { borderColor: '#b7c8e6', borderWidth: 0.8 },
          emphasis: {
            label: { show: true, color: '#0f172a', fontSize: 11 },
            itemStyle: { areaColor: '#f59e0b' },
          },
          data: mapData,
        },
      ],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '商业航天企业区域分布',
        zoom: false,
        // 地图依赖 registerMap，SSR 离屏实例未注册地图，SVG 导出不可用
        svg: false,
        csv: {
          headers: ['省级行政区', '存续相关企业(家)', '区域特征'],
          rows: regionData.regions.map((name, i) => [name, regionData.enterpriseCount[i], regionData.features[i] || '']),
          source: `${regionData.source}${regionData.sourceUrl ? ' ' + regionData.sourceUrl : ''}`,
          caliber: regionData.caliberNote,
        },
      }),
    };

    // 默认 merge，禁止 notMerge:true（会移除地图组件）
    instanceRef.current.setOption(option);
    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [ready, mapName]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
      <div className="chart-card-header">
        <h3 className="chart-title">商业航天企业区域分布（截至2025年底）</h3>
        <p className="chart-desc">
          全国存续相关企业共 {regionData.nationalTotal} 家；颜色越深企业越密集，右侧为报告披露的重点省份排名
        </p>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 520px', minWidth: 'min(320px, 100%)', height: 500 }}>
          <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
          {!ready && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.8)', color: '#94a3b8', zIndex: 5,
            }}>
              {error ? <span style={{ color: '#ef4444' }}>{error}</span> : '地图底图加载中…'}
            </div>
          )}
        </div>
        <div style={{ flex: '0 0 260px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', padding: '8px 4px' }}>
            重点省份排名（家）
          </div>
          {ranked.map((r, i) => (
            <div key={r.name} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 10px', borderRadius: 8, marginBottom: 6,
              background: i < 3 ? 'rgba(37,99,235,0.06)' : '#f8fafc',
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flex: '0 0 20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                color: i < 3 ? '#fff' : '#64748b',
                background: i < 3 ? '#2563eb' : '#e2e8f0',
              }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: 13, color: '#334155' }}>{r.name}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1d4ed8' }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="chart-source">
        企业数据：{regionData.source}
        {regionData.sourceUrl && (
          <> · <a className="ds-wrap-url" href={regionData.sourceUrl} target="_blank" rel="noreferrer">{regionData.sourceUrl}</a></>
        )}
      </div>
      <p className="ds-inline-note">
        口径说明：{regionData.caliberNote}
        <br />底图：{geoSource?.name}，地图仅作空间分布示意。
      </p>
    </div>
  );
}

/* ---------- 图表6：细分赛道融资金额 ---------- */
function SegmentFinancingChart({ segmentStats }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);

    const statsData = segmentStats.data || segmentStats;
    const data = [...statsData].sort((a, b) => a.totalAmount - b.totalAmount);

    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderColor: 'rgba(76,201,240,0.3)',
        textStyle: { color: '#1a1f36' },
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const d = statsData.find((s) => s.segment === params[0].name);
          return `<b>${params[0].name}</b><br/>融资金额：${params[0].value} 亿元<br/>事件数：${d?.count || 0} 起`;
        },
      },
      grid: { left: 100, right: 30, top: 20, bottom: 20 },
      xAxis: {
        type: 'value',
        name: '亿元',
        nameTextStyle: { ...baseTextStyle },
        axisLabel: baseTextStyle,
        axisLine: { show: false },
        splitLine: baseSplitLine,
      },
      yAxis: {
        type: 'category',
        data: data.map((d) => d.segment),
        axisLabel: { ...baseTextStyle, fontSize: 13 },
        axisLine: baseAxisLine,
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          barWidth: 16,
          data: data.map((d) => ({
            value: d.totalAmount,
            itemStyle: {
              borderRadius: [0, 4, 4, 0],
              color: segmentColors[d.segment] || COLORS.primary,
            },
          })),
          label: {
            show: true,
            position: 'right',
            color: COLORS.axisLabel,
            fontSize: 12,
            formatter: '{c} 亿',
          },
        },
      ],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '细分赛道融资金额',
        csv: {
          headers: ['细分赛道', '融资金额(亿元)', '事件数(起)'],
          rows: data.map((d) => [d.segment, d.totalAmount, d.count]),
          source: segmentStats.source,
          caliber: '由库内重点融资事件按赛道自动统计，金额取公开披露口径折算',
        },
      }),
    };

    instanceRef.current.setOption(option);

    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      instanceRef.current?.dispose();
    };
  }, []);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-title">细分赛道融资金额</h3>
        <p className="chart-desc">2024-2025年重点融资事件按细分赛道统计（单位：亿元）</p>
      </div>
      <div ref={chartRef} className="chart-container" />
      <div className="chart-source">数据来源：IT桔子、创业邦睿兽分析</div>
    </div>
  );
}

/* ---------- 投融资轮次 → 细分赛道 流向桑基图（按事件起数计量） ---------- */
function normalizeRound(r) {
  if (/^A/.test(r)) return 'A轮系列';
  if (/^B/.test(r)) return 'B轮系列';
  if (/^C/.test(r)) return 'C轮系列';
  if (/^D/.test(r)) return 'D轮及以后';
  if (r === 'Pre-IPO' || r === '定增') return 'Pre-IPO/定增';
  return '轮次未明确';
}
const ROUND_ORDER = ['A轮系列', 'B轮系列', 'C轮系列', 'D轮及以后', 'Pre-IPO/定增', '轮次未明确'];
const ROUND_COLORS = ['#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#94a3b8'];

function FinancingSankeyChart({ events }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current || !events?.length) return undefined;
    instanceRef.current = echarts.init(chartRef.current);

    // 轮次归并 → 赛道：以事件起数聚合，保留每条流向上的事件明细供 tooltip/溯源
    const linkMap = new Map();
    events.forEach((e) => {
      const g = normalizeRound(e.round);
      const key = `${g}||${e.segment}`;
      if (!linkMap.has(key)) linkMap.set(key, { source: g, target: e.segment, events: [] });
      linkMap.get(key).events.push(e);
    });
    const links = [...linkMap.values()]
      .map((l) => ({ ...l, value: l.events.length }))
      .filter((l) => l.value > 0);

    const roundSet = new Set(links.map((l) => l.source));
    const segSet = new Set(links.map((l) => l.target));
    const nodes = [
      ...ROUND_ORDER.filter((r) => roundSet.has(r)).map((r) => ({
        name: r,
        itemStyle: { color: ROUND_COLORS[ROUND_ORDER.indexOf(r)] },
      })),
      ...[...segSet].map((s) => ({
        name: s,
        itemStyle: { color: segmentColors[s] || COLORS.accent },
      })),
    ];
    const countByNode = (name) => links
      .filter((l) => l.source === name || l.target === name)
      .reduce((s, l) => s + l.value, 0);

    const option = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: 'rgba(37,99,235,0.2)',
        textStyle: { color: '#1a1f36', fontSize: 12 },
        formatter: (p) => {
          if (p.dataType === 'edge') {
            const list = p.data.events
              .map((e) => `· ${e.date} ${e.company}（${e.round}，${e.amount}）`)
              .join('<br/>');
            return `<b>${p.data.source} → ${p.data.target}</b><br/>事件：<b>${p.data.value}</b> 起<br/>${list}`;
          }
          return `<b>${p.name}</b><br/>关联事件：<b>${countByNode(p.name)}</b> 起`;
        },
      },
      series: [{
        type: 'sankey',
        left: 90, right: 150, top: 16, bottom: 16,
        nodeWidth: 14, nodeGap: 12,
        layoutIterations: 64,
        emphasis: { focus: 'adjacency' },
        lineStyle: { color: 'source', opacity: 0.28, curveness: 0.5 },
        label: { color: '#334155', fontSize: 11.5 },
        data: nodes,
        links,
      }],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '投融资轮次-赛道流向',
        zoom: false,
        csv: {
          headers: ['企业', '时间', '原轮次', '轮次归并', '细分赛道', '金额(原文)', '地域', '投资方'],
          rows: events.map((e) => [e.company, e.date, e.round, normalizeRound(e.round), e.segment, e.amount, e.region, e.investors]),
          source: '库内重点融资事件明细（IT桔子、创业邦睿兽分析及公开报道综合）',
          caliber: `样本为 ${events.length} 起重点披露事件（2024-02—2026-09），非全市场普查；流向宽度=事件起数；金额为区间文本未折算，结构占比外推需谨慎`,
        },
      }),
    };
    instanceRef.current.setOption(option);

    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [events]);

  return (
    <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
      <div className="chart-card-header">
        <h3 className="chart-title">投融资轮次 → 细分赛道流向</h3>
        <p className="chart-desc">
          库内 {events?.length || 0} 起重点披露事件的资本流向结构（流量宽度 = 事件起数）；悬停流向可查看企业明细，临近轮次已归并
        </p>
      </div>
      <div ref={chartRef} style={{ width: '100%', height: '460px' }} />
      <div className="chart-source">
        口径：样本为库内 {events?.length || 0} 起重点披露事件（2024-02—2026-09），非全市场普查；金额多为"超5亿""数千万元"等区间文本，
        未逐条折算，故以事件起数而非金额计量流向；结构占比不可直接外推为全市场结论。
      </div>
    </div>
  );
}

/* ---------- 融资事件表格列定义 ---------- */
const eventColumns = [
  { key: 'date', label: '时间', render: (row) => <strong>{row.date}</strong> },
  { key: 'company', label: '融资企业', render: (row) => <strong>{row.company}</strong> },
  { key: 'round', label: '轮次', render: (row) => (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 100,
      fontSize: '0.75rem', fontWeight: 600,
      background: COLORS.primary + '14', color: COLORS.primary,
    }}>{row.round}</span>
  )},
  { key: 'amount', label: '金额', align: 'right', render: (row) => <strong style={{ color: COLORS.deepBlue }}>{row.amount}</strong> },
  { key: 'segment', label: '细分赛道', render: (row) => (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 100,
      fontSize: '0.75rem', fontWeight: 600,
      background: (segmentColors[row.segment] || COLORS.primary) + '14',
      color: segmentColors[row.segment] || COLORS.primary,
    }}>{row.segment}</span>
  )},
  { key: 'investors', label: '主要投资方' },
  { key: 'region', label: '地区' },
];

/* ---------- 融资异常说明 ---------- */
function FinancingNotes({ financingNotes }) {
  // 色点 + 文案双通道，语义不只靠颜色；文字色交给 .ds-badge 的 AA 达标色
  const impactToneColor = { '高': '#c81e28', '中': '#7a4d00', '低': '#0a7442' };
  return (
    <div className="chart-card" style={{ gridColumn: 'span 2' }}>
      <div className="chart-card-header">
        <h3 className="chart-title">融资数据异常说明</h3>
        <p className="chart-desc">2024-2025年融资数据异常波动分析</p>
      </div>
      <div className="data-notes-list">
        {financingNotes.map((note, i) => (
          <div className="data-note-item" key={i}>
            <span
              className="data-note-badge ds-badge"
              data-tone="flat"
              style={{ '--tone-color': impactToneColor[note.impact] || '#4a5068' }}
            >{note.impact}影响</span>
            <span className="data-note-year">{note.year}年</span>
            <span className="data-note-event">{note.event}</span>
            <span className="data-note-text">{note.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 页面主组件 ---------- */
function Analysis() {
  const { industry, geo, fileUpdatedAt } = useData();
  const { requireConfirm, modal } = useDisclaimerGuard();
  const {
    marketSizeData, launchData, financingData, regionData,
    financingStructure2025, financingEvents, segmentStats, financingNotes,
  } = industry;

  const eventTableData = financingEvents.map((e, i) => ({ id: i, ...e }));

  return (
    <div className="page-container ds-page">
      <section className="page-header">
        <h1 className="page-title">投融资</h1>
        <p className="page-desc">
          追踪中国商业航天产业资本流向，涵盖市场规模、融资事件、投融资金额与企业区域分布；历年数据取自IT桔子、创业邦睿兽分析等第三方数据库，2025年度数据采用权威大会与官方发布口径。
        </p>
        {/* 用分文件时间戳而非聚合 lastUpdated：聚合取各文件最大值会掩盖行业数据集本身的陈旧 */}
        <span className="data-source-badge">更新于{fileUpdatedAt?.industry || '--'}</span>
        {/* 投资板块互链：本页给「数据全貌」，投资分析工具给「决策视角」 */}
        <p className="page-desc" style={{ marginTop: 10 }}>
          需要按赛道热度、企业画像与催化剂做决策辅助？<Link to="/investors">前往投资分析工具 →</Link>
        </p>
      </section>

      {/* 含数字/图表的页面常驻风险提示；/analysis 非合规页，风险条由收敛层设为 static */}
      <RiskBanner />

      <div className="charts-grid">
        <MarketSizeChart marketSizeData={marketSizeData} />
        <FinancingChart financingData={financingData} />
        <FinancingStructureChart financingStructure2025={financingStructure2025} />
        <LaunchChart launchData={launchData} />
        <RegionChart regionData={regionData} geoSource={geo.geoSource} />
        <SegmentFinancingChart segmentStats={segmentStats} />
        <FinancingSankeyChart events={financingEvents} />
        <FinancingNotes financingNotes={financingNotes} />
      </div>

      <div className="screen-panel">
        <div className="screen-panel-header">
          <h3 className="screen-panel-title">重点融资事件明细（2024—2026年）</h3>
        </div>
        <DataTable
          data={eventTableData}
          columns={eventColumns}
          filename="商业航天融资事件"
          filters={[{ key: 'segment', label: '赛道' }, { key: 'round', label: '轮次' }]}
          defaultSort={{ key: 'date', dir: 'desc' }}
          exportGuard={requireConfirm}
        />
      </div>
      {modal}
    </div>
  );
}

export default Analysis;

