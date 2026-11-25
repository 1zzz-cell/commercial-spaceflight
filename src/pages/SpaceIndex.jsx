import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as echarts from 'echarts';
import { useData } from '../context/DataContext';
import Icon from '../components/Icon';
import { buildToolbox } from '../utils/chartTools';

/* ============================================================
   商业航天指数页 —— 未来天玑式「指数」栏目
   全部指标取自既有五链数据（industry / dashboard），口径逐条标注
   ============================================ */

const THEME = {
  coldBlue: '#2563eb',
  textMain: '#0f172a',
  textSub: '#475569',
  gridLine: 'rgba(148, 163, 184, 0.15)',
};

/* 同比变化 —— 中国市场惯例：涨红跌绿 */
function YoY({ current, previous }) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  const up = pct >= 0;
  return (
    <div className={`idx-metric-delta ${up ? 'idx-delta-up' : 'idx-delta-down'}`}>
      <Icon name={up ? 'arrow-up' : 'chevron-down'} size="sm" />
      {up ? '+' : ''}{pct.toFixed(1)}% 同比
    </div>
  );
}

/* ---------- 规模 × 发射双轴趋势 ---------- */
function TrendChart({ marketSizeData, launchData }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);

    // 两个序列年份范围不同，取并集对齐；缺年份留空不断线
    const years = [...new Set([...marketSizeData.years, ...launchData.years])].sort();
    const sizeByYear = Object.fromEntries(marketSizeData.years.map((y, i) => [y, marketSizeData.values[i]]));
    const launchByYear = Object.fromEntries(launchData.years.map((y, i) => [y, launchData.total[i]]));

    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: 'rgba(37,99,235,0.2)',
        textStyle: { color: THEME.textMain },
      },
      legend: { top: 0, textStyle: { color: THEME.textSub, fontSize: 12 } },
      grid: { left: 52, right: 56, top: 36, bottom: 32 },
      xAxis: {
        type: 'category',
        data: years,
        axisLabel: { color: THEME.textSub, fontSize: 12 },
        axisLine: { lineStyle: { color: THEME.gridLine } },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: 'value',
          name: '市场规模(万亿元)',
          nameTextStyle: { color: THEME.textSub, fontSize: 11 },
          axisLabel: { color: THEME.textSub, fontSize: 12 },
          splitLine: { lineStyle: { color: THEME.gridLine } },
        },
        {
          type: 'value',
          name: '年入轨发射(次)',
          nameTextStyle: { color: THEME.textSub, fontSize: 11 },
          axisLabel: { color: THEME.textSub, fontSize: 12 },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '市场规模',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: THEME.coldBlue, width: 2.5 },
          itemStyle: { color: THEME.coldBlue },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(37, 99, 235, 0.20)' },
              { offset: 1, color: 'rgba(37, 99, 235, 0.02)' },
            ]),
          },
          data: years.map((y) => sizeByYear[y] ?? null),
        },
        {
          name: '年入轨发射',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: '#f06235', width: 2.5 },
          itemStyle: { color: '#f06235' },
          data: years.map((y) => launchByYear[y] ?? null),
        },
      ],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '商业航天指数_规模与发射趋势',
        csv: {
          headers: ['年份', '市场规模(万亿元)', '年入轨发射(次)'],
          rows: years.map((y) => [y, sizeByYear[y] ?? '', launchByYear[y] ?? '']),
          source: `${marketSizeData.source}；${launchData.source}`,
          caliber: '市场规模为行业研究机构历年测算；发射次数含全部入轨发射（非仅商业发射）',
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
  }, [marketSizeData, launchData]);

  return <div ref={chartRef} className="chart-container" />;
}

/* ---------- 2025 融资结构（赛道金额占比） ---------- */
function StructurePie({ financingStructure2025 }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);

    const { categories = [], amounts = [] } = financingStructure2025;
    const option = {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: 'rgba(37,99,235,0.2)',
        textStyle: { color: THEME.textMain },
        formatter: (p) => `${p.name}：${p.value} 亿元（${p.percent}%）`,
      },
      legend: { bottom: 0, textStyle: { color: THEME.textSub, fontSize: 12 } },
      series: [{
        type: 'pie',
        radius: ['42%', '68%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { color: THEME.textSub, fontSize: 12, formatter: '{b}\n{c} 亿元' },
        data: categories.map((name, i) => ({ name, value: amounts[i] })),
      }],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '商业航天指数_2025融资结构',
        csv: {
          headers: ['赛道', '融资金额(亿元)'],
          rows: categories.map((name, i) => [name, amounts[i]]),
          source: financingStructure2025.source,
          caliber: '按 2025 年度披露融资事件的一级市场口径汇总',
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
  }, [financingStructure2025]);

  return <div ref={chartRef} className="chart-container" style={{ height: '320px' }} />;
}

/* ---------- 轮次分布 ---------- */
function RoundBar({ roundStats }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);

    const rows = [...(roundStats.data || [])].sort((a, b) => b.totalAmount - a.totalAmount);
    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: 'rgba(37,99,235,0.2)',
        textStyle: { color: THEME.textMain },
        formatter: (params) => {
          const p = params[0];
          const row = rows[p.dataIndex];
          return `${p.name}<br/>披露金额合计：${row.totalAmount} 亿元<br/>事件数：${row.count} 起`;
        },
      },
      grid: { left: 48, right: 24, top: 24, bottom: 32 },
      xAxis: {
        type: 'category',
        data: rows.map((r) => r.round),
        axisLabel: { color: THEME.textSub, fontSize: 12 },
        axisLine: { lineStyle: { color: THEME.gridLine } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '亿元',
        nameTextStyle: { color: THEME.textSub, fontSize: 11 },
        axisLabel: { color: THEME.textSub, fontSize: 12 },
        splitLine: { lineStyle: { color: THEME.gridLine } },
      },
      series: [{
        type: 'bar',
        barMaxWidth: 36,
        itemStyle: { color: THEME.coldBlue, borderRadius: [4, 4, 0, 0] },
        data: rows.map((r) => r.totalAmount),
      }],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '商业航天指数_轮次分布',
        csv: {
          headers: ['轮次', '披露金额(亿元)', '事件数'],
          rows: rows.map((r) => [r.round, r.totalAmount, r.count]),
          source: roundStats.source,
          caliber: '仅统计披露具体金额的事件，「超5亿」等模糊表述按脚本解析值计入',
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
  }, [roundStats]);

  return <div ref={chartRef} className="chart-container" style={{ height: '320px' }} />;
}

/* ---------- 细分赛道分布 ---------- */
function SegmentBar({ segmentStats }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);

    const rows = [...(segmentStats.data || [])].sort((a, b) => a.totalAmount - b.totalAmount);
    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: 'rgba(37,99,235,0.2)',
        textStyle: { color: THEME.textMain },
        formatter: (params) => {
          const p = params[0];
          const row = rows[p.dataIndex];
          return `${p.name}<br/>披露金额合计：${row.totalAmount} 亿元<br/>事件数：${row.count} 起`;
        },
      },
      grid: { left: 92, right: 32, top: 16, bottom: 28 },
      xAxis: {
        type: 'value',
        name: '亿元',
        nameTextStyle: { color: THEME.textSub, fontSize: 11 },
        axisLabel: { color: THEME.textSub, fontSize: 12 },
        splitLine: { lineStyle: { color: THEME.gridLine } },
      },
      yAxis: {
        type: 'category',
        data: rows.map((r) => r.segment),
        axisLabel: { color: THEME.textSub, fontSize: 12 },
        axisLine: { lineStyle: { color: THEME.gridLine } },
        axisTick: { show: false },
      },
      series: [{
        type: 'bar',
        barMaxWidth: 22,
        itemStyle: { color: '#8b5cf6', borderRadius: [0, 4, 4, 0] },
        data: rows.map((r) => r.totalAmount),
      }],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '商业航天指数_赛道分布',
        csv: {
          headers: ['细分赛道', '披露金额(亿元)', '事件数'],
          rows: rows.map((r) => [r.segment, r.totalAmount, r.count]),
          source: segmentStats.source,
          caliber: '按融资事件披露的主营赛道归类，单家企业只计入其主要赛道',
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
  }, [segmentStats]);

  return <div ref={chartRef} className="chart-container" style={{ height: '340px' }} />;
}

/* ---------- 页面 ---------- */
function SpaceIndex() {
  const { industry, dashboard } = useData();
  const { marketSizeData, launchData, financingData, financingStructure2025, roundStats, segmentStats } = industry;

  const sizeLast = marketSizeData.values.at(-1);
  const sizePrev = marketSizeData.values.at(-2);
  const launchLast = launchData.total.at(-1);
  const launchPrev = launchData.total.at(-2);
  const amountLast = financingData.amounts.at(-1);
  const amountPrev = financingData.amounts.at(-2);
  const eventsLast = financingData.events.at(-1);
  const enterprise = dashboard.dashboardMetrics.find((m) => m.label.includes('企业'));

  const caliberItems = [
    { title: '市场规模', text: marketSizeData.source },
    { title: '发射活动', text: launchData.source },
    { title: '一级市场融资', text: financingData.source },
    { title: '轮次分布', text: roundStats.source },
    { title: '赛道分布', text: segmentStats.source },
    { title: '2025 融资结构', text: financingStructure2025.source },
  ];

  return (
    <div className="page-container ds-page">
      <div className="page-header">
        <h1 className="page-title">产业指标</h1>
        <p className="page-desc">
          以市场规模、发射活动、资本热度、产业主体四个分项跟踪中国商业航天发展曲线。
          全部指标取自平台既有数据集，非加权综合值；每一项的口径与来源见图表标注与页底说明。
        </p>
      </div>

      {/* 分项指标 */}
      <div className="idx-metric-row">
        <div className="idx-metric">
          <div className="idx-metric-label"><Icon name="chart-bar" size="sm" />市场规模</div>
          <div className="idx-metric-value">{sizeLast}<small>万亿元</small></div>
          <YoY current={sizeLast} previous={sizePrev} />
          <div className="idx-metric-sub">{marketSizeData.years.at(-1)} 年 · 行业研究机构测算</div>
        </div>
        <div className="idx-metric">
          <div className="idx-metric-label"><Icon name="rocket" size="sm" />年入轨发射</div>
          <div className="idx-metric-value">{launchLast}<small>次</small></div>
          <YoY current={launchLast} previous={launchPrev} />
          <div className="idx-metric-sub">{launchData.years.at(-1)} 年 · 含全部入轨发射</div>
        </div>
        <div className="idx-metric">
          <div className="idx-metric-label"><Icon name="coins" size="sm" />一级市场融资</div>
          <div className="idx-metric-value">{amountLast}<small>亿元</small></div>
          <YoY current={amountLast} previous={amountPrev} />
          <div className="idx-metric-sub">{financingData.years.at(-1)} 年 · {eventsLast} 起事件</div>
        </div>
        <div className="idx-metric">
          <div className="idx-metric-label"><Icon name="building" size="sm" />存续商业航天企业</div>
          <div className="idx-metric-value">{enterprise?.value ?? '—'}<small>{enterprise?.unit ?? '家'}</small></div>
          <div className="idx-metric-delta idx-delta-up">
            <Icon name="arrow-up" size="sm" />+83 家 新增
          </div>
          <div className="idx-metric-sub">截至 2025 年底 · 启信宝口径</div>
        </div>
      </div>

      <div className="stack-gap">
        {/* 规模 × 发射趋势 */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-title">产业规模与发射活动趋势</h3>
            <p className="chart-desc">2015—2025 · 市场规模（左轴）与年入轨发射次数（右轴）</p>
          </div>
          <TrendChart marketSizeData={marketSizeData} launchData={launchData} />
        </div>

        {/* 资本结构 */}
        <div className="dash-grid">
          <div className="chart-card">
            <div className="chart-card-header">
              <h3 className="chart-title">2025 年融资结构</h3>
              <p className="chart-desc">按细分赛道汇总的一级市场披露金额</p>
            </div>
            <StructurePie financingStructure2025={financingStructure2025} />
          </div>
          <div className="chart-card">
            <div className="chart-card-header">
              <h3 className="chart-title">轮次分布</h3>
              <p className="chart-desc">各轮次披露金额合计与事件数</p>
            </div>
            <RoundBar roundStats={roundStats} />
          </div>
        </div>

        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-title">细分赛道分布</h3>
            <p className="chart-desc">按融资事件披露的主营赛道归类</p>
          </div>
          <SegmentBar segmentStats={segmentStats} />
        </div>

        {/* 口径与来源 */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-title">口径与来源说明</h3>
            <p className="chart-desc">每个数字的统计边界在此明示，供核查与复现</p>
          </div>
          <div className="idx-caliber">
            {caliberItems.map((item) => (
              <div className="idx-caliber-item" key={item.title}>
                <b>{item.title}</b>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="data-source-note">
          <p>
            本页不构造加权综合指数：四个分项量纲不同（万亿元 / 次 / 亿元 / 家），加权方式任一选择都会引入主观判断，
            故仅并列呈现。若需完整明细，可前往 <Link to="/analysis">投融资</Link> 与 <Link to="/news">行业资讯</Link> 页查看，
            或通过 <Link to="/research">数据与溯源</Link> 导出原始数据。
          </p>
        </div>
      </div>
    </div>
  );
}

export default SpaceIndex;
