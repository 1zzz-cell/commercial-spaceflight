import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { registerSearchData } from '../components/GlobalSearch';
import { DataTable } from '../components/DataTable';
import { useData } from '../context/DataContext';
import { useExportGuard } from '../components/ComplianceKit';
import { buildToolbox } from '../utils/chartTools';
import FreshnessBadge from '../components/FreshnessBadge';

const COLORS = {
  blue: '#2563eb', purple: '#8b5cf6', orange: '#f06235',
  green: '#10b981', cyan: '#06b6d4', amber: '#f59e0b',
  gridLine: 'rgba(148, 163, 184, 0.15)', axisLabel: '#475569',
  tooltipBg: 'rgba(255,255,255,0.96)',
};

const typeColors = {
  通信: COLORS.blue, 遥感: COLORS.purple, '通信+遥感': COLORS.orange,
  导航: COLORS.green, 算力: COLORS.cyan, '通信+导航': COLORS.amber,
};

const statusColors = {
  '已建成': COLORS.green,
  '组网中': COLORS.blue,
  '验证阶段': COLORS.amber,
  '规划中': '#94a3b8',
  '未知': '#cbd5e1',
};

// 注册搜索索引（在组件内构建）

const columns = [
  { key: 'name', label: '星座名称', render: (row) => <strong>{row.name}</strong> },
  { key: 'company', label: '公司名称' },
  { key: 'type', label: '类型', render: (row) => (
    <span className="constellation-tag" style={{
      background: (typeColors[row.type] || COLORS.blue) + '14',
      color: typeColors[row.type] || COLORS.blue,
    }}>{row.type}</span>
  )},
  { key: 'orbit', label: '轨道', render: (row) => row.orbit ?? '-' },
  { key: 'frequency', label: '频段', render: (row) => row.frequency ?? '-' },
  { key: 'satWeight', label: '单星重量(kg)', align: 'right', render: (row) => row.satWeight?.toLocaleString() ?? '-' },
  { key: 'firstLaunch', label: '首颗发射', align: 'right', render: (row) => row.firstLaunch ?? '-' },
  { key: 'planned', label: '计划部署', align: 'right', render: (row) => row.planned?.toLocaleString() ?? '-' },
  { key: 'actual', label: '实际部署', align: 'right', render: (row) => row.actual?.toLocaleString() ?? '-' },
  { key: 'progress', label: '完成率', align: 'right', render: (row) => row.progress !== null ? `${row.progress}%` : '-' },
  { key: 'status', label: '状态', render: (row) => (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 100,
      fontSize: '0.75rem', fontWeight: 600,
      background: (statusColors[row.status] || COLORS.blue) + '14',
      color: statusColors[row.status] || COLORS.blue,
    }}>{row.status ?? '-'}</span>
  )},
];

/* 类型饼图 */
function TypePieChart({ typeStats }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);
    const option = {
      tooltip: { trigger: 'item', backgroundColor: COLORS.tooltipBg, textStyle: { color: '#1a1f36' }, formatter: '{b}<br/>数量：{c} 个 ({d}%)' },
      legend: { orient: 'horizontal', bottom: 4, itemWidth: 10, itemHeight: 10, itemGap: 14, textStyle: { color: COLORS.axisLabel, fontSize: 11 } },
      series: [{ type: 'pie', radius: ['40%', '68%'], center: ['50%', '44%'], itemStyle: { borderColor: '#fff', borderWidth: 2 }, label: { show: false },
        data: typeStats.map((d) => ({ name: d.type, value: d.count, itemStyle: { color: typeColors[d.type] || COLORS.blue } })),
      }],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '星座类型分布',
        zoom: false,
        csv: { headers: ['类型', '星座数(个)'], rows: typeStats.map((d) => [d.type, d.count]), source: '公开信息综合整理' },
      }),
    };
    instanceRef.current.setOption(option);
    const h = () => instanceRef.current?.resize(); window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); instanceRef.current?.dispose(); };
  }, []);
  return <div ref={chartRef} style={{ width: '100%', height: '260px' }} />;
}

/* 状态分布饼图 */
function StatusPieChart({ statusStats }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);
    const palette = [COLORS.green, COLORS.blue, COLORS.amber, '#94a3b8', '#cbd5e1'];
    const option = {
      tooltip: { trigger: 'item', backgroundColor: COLORS.tooltipBg, textStyle: { color: '#1a1f36' }, formatter: '{b}<br/>数量：{c} 个 ({d}%)' },
      legend: { orient: 'horizontal', bottom: 4, itemWidth: 10, itemHeight: 10, itemGap: 14, textStyle: { color: COLORS.axisLabel, fontSize: 11 } },
      series: [{ type: 'pie', radius: ['40%', '68%'], center: ['50%', '44%'], itemStyle: { borderColor: '#fff', borderWidth: 2 }, label: { show: false },
        data: statusStats.map((d, i) => ({ name: d.status, value: d.count, itemStyle: { color: palette[i % palette.length] } })),
      }],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '星座建设状态分布',
        zoom: false,
        csv: { headers: ['建设状态', '星座数(个)'], rows: statusStats.map((d) => [d.status, d.count]), source: '公开信息综合整理' },
      }),
    };
    instanceRef.current.setOption(option);
    const h = () => instanceRef.current?.resize(); window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); instanceRef.current?.dispose(); };
  }, []);
  return <div ref={chartRef} style={{ width: '100%', height: '260px' }} />;
}

/* 轨道分布柱状图 */
function OrbitDistChart({ orbitStats }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);
    const data = [...orbitStats].sort((a, b) => b.count - a.count);
    const option = {
      tooltip: { trigger: 'axis', backgroundColor: COLORS.tooltipBg, textStyle: { color: '#1a1f36' }, axisPointer: { type: 'shadow' } },
      grid: { left: 120, right: 48, top: 12, bottom: 16 },
      xAxis: { type: 'value', axisLabel: { color: COLORS.axisLabel, fontSize: 11 }, axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.gridLine } } },
      yAxis: { type: 'category', data: data.map((d) => d.type), axisLabel: { color: COLORS.axisLabel, fontSize: 11 }, axisLine: { lineStyle: { color: 'rgba(203,213,225,0.5)' } }, axisTick: { show: false } },
      series: [{
        type: 'bar', barWidth: 14,
        itemStyle: { borderRadius: [0, 4, 4, 0], color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: COLORS.cyan }, { offset: 1, color: COLORS.blue }]) },
        label: { show: true, position: 'right', fontSize: 11, fontWeight: 600, color: COLORS.axisLabel, formatter: '{c} 个' },
        data: data.map((d) => d.count),
      }],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '星座轨道类型分布',
        zoom: false,
        csv: { headers: ['轨道类型', '星座数(个)'], rows: data.map((d) => [d.type, d.count]), source: '公开信息综合整理' },
      }),
    };
    instanceRef.current.setOption(option);
    const h = () => instanceRef.current?.resize(); window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); instanceRef.current?.dispose(); };
  }, []);
  return <div ref={chartRef} style={{ width: '100%', height: '240px' }} />;
}

/* 头部企业柱状图 */
function TopDeployerChart({ topDeployers }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);
    const data = [...topDeployers].reverse();
    const option = {
      tooltip: { trigger: 'axis', backgroundColor: COLORS.tooltipBg, textStyle: { color: '#1a1f36' }, axisPointer: { type: 'shadow' } },
      legend: { data: ['计划部署', '实际部署'], textStyle: { color: COLORS.axisLabel, fontSize: 11 }, top: 4, itemWidth: 12, itemHeight: 8 },
      grid: { left: 100, right: 56, top: 32, bottom: 16 },
      xAxis: { type: 'value', axisLabel: { color: COLORS.axisLabel, fontSize: 10 }, axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.gridLine } } },
      yAxis: { type: 'category', data: data.map((d) => d.name), axisLabel: { color: COLORS.axisLabel, fontSize: 11 }, axisLine: { lineStyle: { color: 'rgba(203,213,225,0.5)' } }, axisTick: { show: false } },
      series: [
        { name: '计划部署', type: 'bar', barWidth: 10, itemStyle: { color: COLORS.blue, borderRadius: [0, 3, 3, 0] }, data: data.map((d) => d.planned) },
        { name: '实际部署', type: 'bar', barWidth: 10, itemStyle: { color: COLORS.green, borderRadius: [0, 3, 3, 0] }, data: data.map((d) => d.actual) },
      ],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '头部企业星座部署对比',
        zoom: false,
        csv: {
          headers: ['运营方', '实际部署(颗)', '计划部署(颗)'],
          rows: data.map((d) => [d.name, d.actual, d.planned]),
          source: '公开信息综合整理',
          caliber: '取实际部署数前 10 运营方；规划数随公司公告动态调整',
        },
      }),
    };
    instanceRef.current.setOption(option);
    const h = () => instanceRef.current?.resize(); window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); instanceRef.current?.dispose(); };
  }, []);
  return <div ref={chartRef} style={{ width: '100%', height: '360px' }} />;
}

/* 轨道族粗分类（基于 orbit 文本字段，仅用于图表分色） */
function orbitFamily(orbit) {
  const s = String(orbit || '');
  if (s.startsWith('SSO')) return 'SSO';
  if (s.startsWith('GEO')) return 'GEO';
  if (s.startsWith('LEO')) return 'LEO';
  return 'MEO/混合高轨';
}
const orbitFamilyColors = {
  LEO: COLORS.blue, SSO: COLORS.cyan, GEO: COLORS.purple, 'MEO/混合高轨': COLORS.green,
};

/* 星座部署完成率（横向条形 + 纵向 dataZoom，支持 30 个星座滚动比对） */
function DeploymentProgressChart({ list }) {
  const ref = useRef(null);
  const inst = useRef(null);

  // 实际部署 > 0 且有规划数的星座；完成率按真实值计算，条长截断仅为视觉处理
  const rows = list
    .filter((c) => c.actual > 0 && c.planned > 0)
    .map((c) => ({
      ...c,
      rate: Math.round((c.actual / c.planned) * 1000) / 10,
      family: orbitFamily(c.orbit),
    }))
    .sort((a, b) => b.rate - a.rate);

  useEffect(() => {
    if (!ref.current || rows.length === 0) return;
    inst.current = echarts.init(ref.current);
    // ECharts 类目轴自下而上排列，反转使最高完成率在顶部
    const data = [...rows].reverse();
    const families = Object.keys(orbitFamilyColors);

    const series = families.map((fam) => ({
      name: fam,
      type: 'bar',
      stack: 'total',
      barWidth: 11,
      data: data.map((c) => ({
        value: fam === c.family ? Math.min(c.rate, 100) : 0,
        raw: c,
        itemStyle: {
          color: orbitFamilyColors[fam],
          borderRadius: c.rate >= 100 ? [3, 3, 3, 3] : [0, 3, 3, 0],
        },
      })),
    }));

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: COLORS.tooltipBg,
        borderColor: 'rgba(37,99,235,0.2)',
        textStyle: { color: '#1a1f36', fontSize: 12 },
        formatter: (params) => {
          const p = params.find((x) => x.data?.value > 0) || params[0];
          const c = p?.data?.raw;
          if (!c) return '';
          return `<b>${c.name}</b>（${c.company}）<br/>`
            + `类型：${c.type} · 轨道：${c.orbit}<br/>`
            + `实际 / 计划：<b>${c.actual.toLocaleString()} / ${c.planned.toLocaleString()}</b> 颗<br/>`
            + `完成率：<b>${c.rate}%</b>${c.rate > 100 ? '（实际超原规划）' : ''}<br/>`
            + `首颗发射：${c.firstLaunch ?? '-'} · 状态：${c.status}`;
        },
      },
      legend: {
        top: 2, itemWidth: 12, itemHeight: 8, itemGap: 14,
        selectedMode: 'multiple',
        textStyle: { color: COLORS.axisLabel, fontSize: 11 },
        data: families,
      },
      grid: { left: 130, right: 56, top: 34, bottom: 28 },
      xAxis: {
        type: 'value', max: 100,
        name: '完成率(%)', nameTextStyle: { color: COLORS.axisLabel, fontSize: 11 },
        axisLabel: { color: COLORS.axisLabel, fontSize: 11 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: COLORS.gridLine } },
      },
      yAxis: {
        type: 'category',
        data: data.map((c) => c.name),
        axisLabel: { color: COLORS.axisLabel, fontSize: 11 },
        axisLine: { lineStyle: { color: 'rgba(203,213,225,0.5)' } },
        axisTick: { show: false },
      },
      // 30 个条目：滑块 + 滚轮/触控板纵向滚动
      dataZoom: [
        { type: 'slider', yAxisIndex: 0, right: 6, width: 9, startValue: data.length - 15, endValue: data.length - 1,
          borderColor: 'transparent', fillerColor: 'rgba(37,99,235,0.12)', handleStyle: { color: '#93c5fd' } },
        { type: 'inside', yAxisIndex: 0, zoomOnMouseWheel: false, moveOnMouseWheel: true },
      ],
      series,
      toolbox: buildToolbox(inst.current, () => option, {
        filename: '星座部署完成率',
        zoom: false,
        csv: {
          headers: ['星座', '运营方', '类型', '轨道族', '轨道(原文)', '实际部署(颗)', '计划部署(颗)', '完成率(%)', '首颗发射', '状态'],
          rows: rows.map((c) => [c.name, c.company, c.type, c.family, c.orbit, c.actual, c.planned, c.rate, c.firstLaunch ?? '', c.status]),
          source: '公开信息综合整理（2026-10 已逐条核实，verified=true）',
          caliber: `仅统计实际部署 > 0 的 ${rows.length} 个星座；完成率=实际部署/计划部署×100；规划中及无实际部署星座未纳入；规划数为各公司公开规划，存在调整可能`,
        },
      }),
    };
    inst.current.setOption(option);
    const h = () => inst.current?.resize();
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); inst.current?.dispose(); };
  }, []);

  return (
    <div className="screen-panel" style={{ marginBottom: '24px' }}>
      <div className="screen-panel-header" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 className="screen-panel-title">主要星座部署完成率（实际 / 规划）</h3>
        <span className="chart-inline-note">
          共 {rows.length} 个已开建星座 · 按完成率降序 · 滚轮/滑块滚动 · 点击图例按轨道族筛选
        </span>
      </div>
      <div ref={ref} style={{ width: '100%', height: '560px' }} />
      <div className="chart-source">
        完成率=实际部署数/公开规划数×100；条长超过 100% 视觉截断，真实值见悬停与 CSV；
        规划数随公司公告动态调整，11 个尚处规划阶段（未发射）的星座不参与排序。
      </div>
    </div>
  );
}

function SatelliteConstellation() {
  const { requireConfirm } = useExportGuard();
  const { constellations: conData } = useData();
  const { list: constellationData, typeStats, topDeployers, statusStats, orbitStats } = conData;

  const totalPlanned = constellationData.reduce((s, c) => s + (c.planned || 0), 0);
  const totalActual = constellationData.reduce((s, c) => s + (c.actual || 0), 0);
  const domesticCount = constellationData.filter((c) => !['SpaceX', 'Amazon', 'OneWeb', 'Telesat', 'KLEOConnect', 'Astrome', 'Yaliny', '三星'].includes(c.company)).length;
  const operationalCount = constellationData.filter((c) => c.status === '已建成' || c.status === '组网中').length;

  // 用星座名作稳定唯一 key（数据内 39 个名称无重复），不用数组下标，避免筛选/排序后行错位
  const tableData = constellationData.map((c) => ({
    id: c.name, name: c.name, company: c.company, type: c.type,
    planned: c.planned, actual: c.actual,
    progress: c.planned && c.actual ? Math.round((c.actual / c.planned) * 100) : null,
    orbit: c.orbit, frequency: c.frequency, satWeight: c.satWeight,
    firstLaunch: c.firstLaunch, status: c.status,
  }));

  useEffect(() => {
    registerSearchData('星座', constellationData.map((c) => ({
      id: c.name, title: c.name, keywords: `${c.company} ${c.type} ${c.orbit || ''} ${c.frequency || ''} 星座`, path: '/constellation',
    })));
  }, [constellationData]);

  return (
    <div className="page-container ds-page">
      <div className="page-header">
        <h1 className="page-title">卫星星座</h1>
        <p className="page-desc">全球主要卫星星座部署计划一览，覆盖中国商业星座与国际对标（{constellationData.length}个星座）</p>
        <FreshnessBadge fileKey="constellations" source={conData.sourceLevel || '数据来源：公开信息综合整理'} />
      </div>

      <div className="screen-metrics-secondary">
        <div className="screen-metric">
          <div className="screen-metric-body">
            <div className="screen-metric-value" style={{ color: COLORS.blue }}>{constellationData.length}</div>
            <div className="screen-metric-label">星座总数</div>
          </div>
        </div>
        <div className="screen-metric">
          <div className="screen-metric-body">
            <div className="screen-metric-value" style={{ color: COLORS.purple }}>{totalPlanned.toLocaleString()}</div>
            <div className="screen-metric-label">计划部署卫星（颗）</div>
          </div>
        </div>
        <div className="screen-metric">
          <div className="screen-metric-body">
            <div className="screen-metric-value" style={{ color: COLORS.green }}>{totalActual.toLocaleString()}</div>
            <div className="screen-metric-label">实际部署卫星（颗）</div>
          </div>
        </div>
        <div className="screen-metric">
          <div className="screen-metric-body">
            <div className="screen-metric-value" style={{ color: COLORS.cyan }}>{domesticCount}</div>
            <div className="screen-metric-label">中国星座数</div>
          </div>
        </div>
        <div className="screen-metric">
          <div className="screen-metric-body">
            <div className="screen-metric-value" style={{ color: COLORS.orange }}>{operationalCount}</div>
            <div className="screen-metric-label">在建/运营星座</div>
          </div>
        </div>
      </div>

      <div className="charts-grid" style={{ marginBottom: '24px' }}>
        <div className="screen-panel"><div className="screen-panel-header"><h3 className="screen-panel-title">星座类型分布</h3></div><TypePieChart typeStats={typeStats} /></div>
        <div className="screen-panel"><div className="screen-panel-header"><h3 className="screen-panel-title">星座建设状态</h3></div><StatusPieChart statusStats={statusStats} /></div>
        <div className="screen-panel" style={{ gridColumn: 'span 2' }}><div className="screen-panel-header"><h3 className="screen-panel-title">轨道类型分布</h3></div><OrbitDistChart orbitStats={orbitStats} /></div>
      </div>

      <div className="screen-panel" style={{ marginBottom: '24px' }}>
        <div className="screen-panel-header"><h3 className="screen-panel-title">头部企业部署对比（颗）</h3></div>
        <TopDeployerChart topDeployers={topDeployers} />
      </div>

      <DeploymentProgressChart list={constellationData} />

      <div className="screen-panel">
        <div className="screen-panel-header"><h3 className="screen-panel-title">星座详情列表</h3></div>
        <DataTable
          data={tableData}
          columns={columns}
          filename="卫星星座计划"
          filters={[{ key: 'type', label: '类型' }, { key: 'status', label: '状态' }]}
          defaultSort={{ key: 'planned', dir: 'desc' }}
          exportGuard={requireConfirm}
        />
      </div>
    </div>
  );
}

export default SatelliteConstellation;
