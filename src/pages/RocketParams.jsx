import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { registerSearchData } from '../components/GlobalSearch';
import { DataTable } from '../components/DataTable';
import { useData } from '../context/DataContext';
import { useExportGuard } from '../components/ComplianceKit';
import { classifyPropellant } from '../utils/dataLoader';
import FreshnessBadge from '../components/FreshnessBadge';
import { buildToolbox } from '../utils/chartTools';

const COLORS = {
  blue: '#0d8af0', purple: '#8b5cf6', orange: '#f06235',
  green: '#10b981', cyan: '#06b6d4', amber: '#f59e0b',
  gridLine: 'rgba(0,0,0,0.05)', axisLabel: '#5a6380',
  tooltipBg: 'rgba(255,255,255,0.96)',
};

const propellantColors = {
  '固体': COLORS.amber,
  '液氧/甲烷': COLORS.cyan,
  '有毒推进剂': COLORS.orange,
  '液氧/煤油': COLORS.blue,
  '液氧/液氢': COLORS.purple,
  '其他': '#8890a8',
};

const reusableColors = ['#10b981', '#d1d5db'];

/* 表格数据（在组件内构建，因为依赖运行时数据） */

const columns = [
  { key: 'name', label: '火箭型号', render: (row) => <strong>{row.name}</strong> },
  { key: 'abbr', label: '代号', render: (row) => <code style={{ fontSize: '0.8rem', color: COLORS.blue, background: 'rgba(13,138,240,0.06)', padding: '1px 6px', borderRadius: 4 }}>{row.abbr}</code> },
  { key: 'org', label: '研发机构' },
  {
    key: 'propellantType', label: '推进剂类型',
    render: (row) => (
      <span style={{
        display: 'inline-block', padding: '2px 8px', borderRadius: 100,
        fontSize: '0.75rem', fontWeight: 600,
        background: (propellantColors[row.propellantType] || COLORS.blue) + '14',
        color: propellantColors[row.propellantType] || COLORS.blue,
      }}>{row.propellantType}</span>
    ),
  },
  { key: 'diameter', label: '直径(m)', align: 'right', render: (row) => row.diameter ? row.diameter.toFixed(2) : '-' },
  { key: 'leo', label: 'LEO(吨)', align: 'right', render: (row) => row.leo ?? '-' },
  {
    key: 'reusable', label: '可回收',
    render: (row) => (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: '0.78rem', fontWeight: 500,
        color: row.reusable ? COLORS.green : 'var(--text-muted)',
      }}>
        <span style={{
          display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
          background: row.reusable ? COLORS.green : '#d1d5db',
        }} />
        {row.reusable ? '可回收' : '不可回收'}
      </span>
    ),
  },
  { key: 'launches', label: '累计发射', align: 'right', render: (row) => row.launches ?? '-' },
];

/* 推进剂分布饼图 */
function PropellantPieChart({ propellantStats }) {
  const ref = useRef(null);
  const inst = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    inst.current = echarts.init(ref.current);
    const option = {
      tooltip: { trigger: 'item', backgroundColor: COLORS.tooltipBg, textStyle: { color: '#1a1f36' }, formatter: '{b}<br/>数量：{c} 型 ({d}%)' },
      legend: { orient: 'horizontal', bottom: 4, itemWidth: 10, itemHeight: 10, itemGap: 12, textStyle: { color: COLORS.axisLabel, fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['40%', '68%'], center: ['50%', '42%'],
        itemStyle: { borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        data: propellantStats.map((d) => ({
          name: d.type, value: d.count,
          itemStyle: { color: propellantColors[d.type] || COLORS.blue },
        })),
      }],
      toolbox: buildToolbox(inst.current, () => option, {
        filename: '火箭推进剂类型分布',
        zoom: false,
        csv: {
          headers: ['推进剂类型', '型号数(型)', '其中可回收(型)'],
          rows: propellantStats.map((d) => [d.type, d.count, d.reusableCount]),
          source: '公开信息综合整理（按芯级主推进剂归类）',
        },
      }),
    };
    inst.current.setOption(option);
    const h = () => inst.current?.resize();
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); inst.current?.dispose(); };
  }, []);
  return <div ref={ref} style={{ width: '100%', height: '280px' }} />;
}

/* 机构发射量柱状图 */
function OrgLaunchChart({ orgStats }) {
  const ref = useRef(null);
  const inst = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    inst.current = echarts.init(ref.current);
    const data = [...orgStats].sort((a, b) => b.count - a.count);
    const option = {
      tooltip: { trigger: 'axis', backgroundColor: COLORS.tooltipBg, textStyle: { color: '#1a1f36' }, axisPointer: { type: 'shadow' } },
      legend: { data: ['型号数', '累计发射'], textStyle: { color: COLORS.axisLabel, fontSize: 11 }, top: 4, itemWidth: 12, itemHeight: 8 },
      grid: { left: 110, right: 24, top: 36, bottom: 16 },
      xAxis: { type: 'value', axisLabel: { color: COLORS.axisLabel, fontSize: 10 }, axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.gridLine } } },
      yAxis: { type: 'category', data: data.map((d) => d.name), axisLabel: { color: COLORS.axisLabel, fontSize: 11 }, axisLine: { lineStyle: { color: 'rgba(0,0,0,0.08)' } }, axisTick: { show: false } },
      series: [
        { name: '型号数', type: 'bar', barWidth: 8, itemStyle: { color: COLORS.blue, borderRadius: [0, 3, 3, 0] }, data: data.map((d) => d.count) },
        { name: '累计发射', type: 'bar', barWidth: 8, itemStyle: { color: COLORS.green, borderRadius: [0, 3, 3, 0] }, data: data.map((d) => d.totalLaunches) },
      ],
      toolbox: buildToolbox(inst.current, () => option, {
        filename: '研发机构型号与发射量',
        zoom: false,
        csv: {
          headers: ['研发机构', '型号数(型)', '累计发射(次)', '可回收型号(型)'],
          rows: data.map((d) => [d.name, d.count, d.totalLaunches, d.reusableCount]),
          source: '公开信息综合整理',
        },
      }),
    };
    inst.current.setOption(option);
    const h = () => inst.current?.resize();
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); inst.current?.dispose(); };
  }, []);
  return <div ref={ref} style={{ width: '100%', height: '380px' }} />;
}

/* 发射次数趋势 */
function LaunchTrendChart({ launchData }) {
  const ref = useRef(null);
  const inst = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    inst.current = echarts.init(ref.current);
    // 预测年份（存在时才标注预测区间）
    const predicted = launchData.predictedYears || [];
    const option = {
      tooltip: {
        trigger: 'axis', backgroundColor: COLORS.tooltipBg, textStyle: { color: '#1a1f36' }, axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const lines = params.map((p) => `${p.marker}${p.seriesName}：${p.value}${predicted.includes(p.name) ? '（预测）' : ''}`);
          return `<b>${params[0].name}年</b><br/>${lines.join('<br/>')}`;
        },
      },
      legend: { data: ['总发射', '商业发射', '民营火箭'], textStyle: { color: COLORS.axisLabel, fontSize: 11 }, top: 4, itemWidth: 12, itemHeight: 8 },
      grid: { left: 50, right: 20, top: 40, bottom: 24 },
      xAxis: { type: 'category', data: launchData.years, axisLabel: { color: COLORS.axisLabel, fontSize: 11 }, axisLine: { lineStyle: { color: 'rgba(0,0,0,0.08)' } }, axisTick: { show: false } },
      yAxis: { type: 'value', name: '次', nameTextStyle: { color: COLORS.axisLabel, fontSize: 10 }, axisLabel: { color: COLORS.axisLabel, fontSize: 10 }, axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.gridLine } } },
      series: [
        {
          name: '总发射', type: 'bar', barWidth: 10, itemStyle: { color: COLORS.blue, borderRadius: [3, 3, 0, 0] }, data: launchData.total,
          // 预测区间高亮
          markArea: predicted.length ? {
            silent: true,
            itemStyle: { color: 'rgba(245,158,11,0.08)' },
            label: { show: true, position: 'insideTop', color: '#b45309', fontSize: 11, formatter: '预测区间' },
            data: [[{ xAxis: predicted[0] }, { xAxis: predicted[predicted.length - 1] }]],
          } : undefined,
        },
        { name: '商业发射', type: 'bar', barWidth: 10, itemStyle: { color: COLORS.orange, borderRadius: [3, 3, 0, 0] }, data: launchData.commercial },
        { name: '民营火箭', type: 'bar', barWidth: 10, itemStyle: { color: COLORS.green, borderRadius: [3, 3, 0, 0] }, data: launchData.private },
      ],
      toolbox: buildToolbox(inst.current, () => option, {
        filename: '发射次数趋势-火箭链',
        csv: {
          headers: ['年份', '总发射(次)', '商业发射(次)', '民营火箭(次)', '数据性质'],
          rows: launchData.years.map((y, i) => [y, launchData.total[i], launchData.commercial[i], launchData.private[i], predicted.includes(String(y)) ? '预测' : '实绩']),
          source: launchData.source,
          caliber: '商业发射数据引国家航天局2026-01-20发布；预测年份已单列标注',
        },
      }),
    };
    inst.current.setOption(option);
    const h = () => inst.current?.resize();
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); inst.current?.dispose(); };
  }, []);
  return <div ref={ref} style={{ width: '100%', height: '280px' }} />;
}

/* 2025 年长征系列分型号发射次数（权威文献口径） */
function LongMarchFamilyChart({ data }) {
  const ref = useRef(null);
  const inst = useRef(null);
  useEffect(() => {
    if (!ref.current || !data?.families) return;
    inst.current = echarts.init(ref.current);
    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: COLORS.tooltipBg,
        borderColor: 'rgba(13,138,240,0.25)',
        textStyle: { color: '#1a1f36' },
        axisPointer: { type: 'shadow' },
        formatter: (params) => {
          const p = params[0];
          return `<b>${p.name}</b><br/>2025年发射：<b>${p.value}</b> 次`;
        },
      },
      grid: { left: 48, right: 24, top: 32, bottom: 56 },
      xAxis: {
        type: 'category',
        data: data.families.map((d) => d.name),
        axisLabel: { color: COLORS.axisLabel, fontSize: 11, interval: 0, rotate: 20 },
        axisLine: { lineStyle: { color: 'rgba(0,0,0,0.08)' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '次',
        nameTextStyle: { color: COLORS.axisLabel, fontSize: 11 },
        axisLabel: { color: COLORS.axisLabel, fontSize: 11 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: COLORS.gridLine } },
      },
      series: [{
        type: 'bar',
        barWidth: '52%',
        itemStyle: {
          borderRadius: [5, 5, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#3b82f6' },
            { offset: 1, color: '#1d4ed8' },
          ]),
        },
        label: { show: true, position: 'top', fontSize: 12, fontWeight: 600, color: '#1e3a8a', formatter: '{c}' },
        data: data.families.map((d) => d.launches),
      }],
      toolbox: buildToolbox(inst.current, () => option, {
        filename: '2025长征系列分型号发射次数',
        csv: {
          headers: ['系列', '2025年发射(次)'],
          rows: data.families.map((d) => [d.name, d.launches]),
          source: `${data.source} ${data.sourceUrl}`,
          caliber: `按火箭系列归并统计（同一系列下各子型号合并计数）；2025年长征系列共${data.total}次，占全国${data.nationalTotal}次入轨发射约${data.share}%；${data.note}`,
        },
      }),
    };
    inst.current.setOption(option);
    const h = () => inst.current?.resize();
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); inst.current?.dispose(); };
  }, [data]);
  return (
    <div className="screen-panel" style={{ marginBottom: '28px' }}>
      <div className="screen-panel-header" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 className="screen-panel-title">2025年长征系列分型号发射次数</h3>
        <span className="chart-inline-note">
          全年 {data.total} 次，占全国 {data.nationalTotal} 次入轨发射的约 {data.share}%
        </span>
      </div>
      <div ref={ref} style={{ width: '100%', height: '340px' }} />
      <div className="chart-source">
        数据来源：{data.source} ·{' '}
        <a className="ds-wrap-url" href={data.sourceUrl} target="_blank" rel="noreferrer">
          {data.sourceUrl}
        </a>
        <br />{data.note}
      </div>
    </div>
  );
}

/* 可回收运力TOP */
function ReusableLeoChart({ reusableByLeo }) {
  const ref = useRef(null);
  const inst = useRef(null);
  useEffect(() => {
    if (!ref.current || reusableByLeo.length === 0) return;
    inst.current = echarts.init(ref.current);
    const data = [...reusableByLeo].reverse();
    const option = {
      tooltip: { trigger: 'axis', backgroundColor: COLORS.tooltipBg, textStyle: { color: '#1a1f36' }, axisPointer: { type: 'shadow' } },
      grid: { left: 120, right: 56, top: 12, bottom: 16 },
      xAxis: { type: 'value', name: '吨', nameTextStyle: { color: COLORS.axisLabel, fontSize: 10 }, axisLabel: { color: COLORS.axisLabel, fontSize: 10 }, axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.gridLine } } },
      yAxis: { type: 'category', data: data.map((d) => d.name), axisLabel: { color: COLORS.axisLabel, fontSize: 11 }, axisLine: { lineStyle: { color: 'rgba(0,0,0,0.08)' } }, axisTick: { show: false } },
      series: [{
        type: 'bar', barWidth: 14,
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: COLORS.green },
            { offset: 1, color: COLORS.cyan },
          ]),
        },
        label: { show: true, position: 'right', fontSize: 11, fontWeight: 600, color: COLORS.axisLabel, formatter: '{c} 吨' },
        data: data.map((d) => d.leo),
      }],
      toolbox: buildToolbox(inst.current, () => option, {
        filename: '可回收火箭LEO运力排名',
        zoom: false,
        csv: {
          headers: ['型号', '研发机构', 'LEO运力(吨)', '推进剂(原文)', '状态'],
          rows: data.map((d) => [d.name, d.org, d.leo, d.propellant, d.status]),
          source: '公开信息综合整理（含在研型号，运力为设计值）',
          caliber: '取 LEO 运力前 8 的可回收型号，在研型号未经飞行验证',
        },
      }),
    };
    inst.current.setOption(option);
    const h = () => inst.current?.resize();
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); inst.current?.dispose(); };
  }, []);
  return <div ref={ref} style={{ width: '100%', height: '300px' }} />;
}

function RocketParams() {
  const { requireConfirm } = useExportGuard();
  const { rockets, industry, geo } = useData();
  const { list: rocketData, orgStats, propellantStats, reusableByLeo } = rockets;
  const { launchData } = industry;

  const totalLaunches = rocketData.reduce((s, r) => s + (r.launches || 0), 0);
  const reusableCount = rocketData.filter((r) => r.reusable).length;
  const inServiceCount = rocketData.filter((r) => r.launches && r.launches > 0).length;

  const tableData = rocketData.map((r, i) => ({
    id: i,
    name: r.name,
    abbr: r.abbr,
    org: r.org,
    propellantType: classifyPropellant(r.propellant),
    propellant: r.propellant,
    diameter: r.diameter,
    leo: r.leo,
    reusable: r.reusable,
    site: r.site,
    launches: r.launches,
  }));

  useEffect(() => {
    registerSearchData('火箭', rocketData.map((r) => ({
      id: r.name,
      title: `${r.name} (${r.abbr})`,
      keywords: `${r.org} ${r.propellant} 火箭`,
      path: '/rockets',
    })));
  }, []);

  return (
    <div className="page-container ds-page">
      <div className="page-header">
        <h1 className="page-title">运载火箭</h1>
        <p className="page-desc">
          我国在役及在研运载火箭核心参数对比，覆盖国有与商业火箭全型号谱系（{rocketData.length}型）
        </p>
        <FreshnessBadge fileKey="rockets" source={rockets.sourceLevel || '数据来源：公开信息综合整理'} />
      </div>

      <div className="screen-metrics-secondary" style={{ marginBottom: '28px' }}>
        <div className="screen-metric">
          <div className="screen-metric-body">
            <div className="screen-metric-value" style={{ color: COLORS.blue }}>{rocketData.length}</div>
            <div className="screen-metric-label">火箭型号总数</div>
          </div>
        </div>
        <div className="screen-metric">
          <div className="screen-metric-body">
            <div className="screen-metric-value" style={{ color: COLORS.purple }}>{inServiceCount}</div>
            <div className="screen-metric-label">已发射型号</div>
          </div>
        </div>
        <div className="screen-metric">
          <div className="screen-metric-body">
            <div className="screen-metric-value" style={{ color: COLORS.green }}>{reusableCount}</div>
            <div className="screen-metric-label">可回收型号(含在研)</div>
          </div>
        </div>
        <div className="screen-metric">
          <div className="screen-metric-body">
            <div className="screen-metric-value" style={{ color: COLORS.orange }}>{totalLaunches}</div>
            <div className="screen-metric-label">累计发射次数</div>
          </div>
        </div>
      </div>

      <div className="charts-grid" style={{ marginBottom: '28px' }}>
        <div className="screen-panel">
          <div className="screen-panel-header">
            <h3 className="screen-panel-title">推进剂类型分布</h3>
          </div>
          <PropellantPieChart propellantStats={propellantStats} />
        </div>
        <div className="screen-panel">
          <div className="screen-panel-header">
            <h3 className="screen-panel-title">发射次数趋势</h3>
          </div>
          <LaunchTrendChart launchData={launchData} />
        </div>
        <div className="screen-panel" style={{ gridColumn: 'span 2' }}>
          <div className="screen-panel-header">
            <h3 className="screen-panel-title">研发机构型号与发射量</h3>
          </div>
          <OrgLaunchChart orgStats={orgStats} />
        </div>
      </div>

      {geo?.longMarchFamily2025 && (
        <LongMarchFamilyChart data={geo.longMarchFamily2025} />
      )}

      <div className="screen-panel" style={{ marginBottom: '28px' }}>
        <div className="screen-panel-header">
          <h3 className="screen-panel-title">可回收火箭 LEO 运力排名</h3>
        </div>
        <ReusableLeoChart reusableByLeo={reusableByLeo} />
      </div>

      <div className="screen-panel">
        <div className="screen-panel-header">
          <h3 className="screen-panel-title">火箭参数详情</h3>
        </div>
        <DataTable
          data={tableData}
          columns={columns}
          filename="火箭型号参数"
          filters={[
            { key: 'org', label: '研发机构' },
            { key: 'propellantType', label: '推进剂类型' },
            { key: 'reusable', label: '可回收性' },
          ]}
          defaultSort={{ key: 'leo', dir: 'desc' }}
          exportGuard={requireConfirm}
        />
      </div>
    </div>
  );
}

export default RocketParams;
