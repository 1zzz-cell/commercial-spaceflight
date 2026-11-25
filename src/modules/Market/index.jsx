import { useData } from '../../context/DataContext';
import { useExportGuard } from '../../components/ComplianceKit';
import FreshnessBadge from '../../components/FreshnessBadge';
import {
  Card, SectionTitle, StatCard, Grid, EmptyState, SourceTag, ExportBar, DataTable,
  useChart, selectDataset, selectDatasetMeta,
  formatNumber, trendOf,
  color, palette, chartBase,
} from '@portal';
import './styles.css';

/* ============================================
   市场与成本洞察
   --------------------------------------------
   负责人：星枢专家团
   创建时间：2026-10-21

   数据全部来自 market 数据集（public/data/market.json）：
     indicators —— 点估计明细（指标、年份、数值、来源、口径）
     series     —— 多年同口径序列，图表直接消费
     insights   —— 核心洞察
     bottlenecks —— 政策与成本瓶颈分级
   本页面只读数据、不写数据；持续更新走 scripts/collect-market.mjs。

   核心卡按指标全名取值，对有多个口径的指标同时限定口径或来源。

     数字口径另有纪律（多个来源数值不同，禁止混用），
     改任何数字前先读 DATA_UPDATE_SETUP.md 的「口径纪律」一节。
   ============================================ */

/* ---------- 取序列 / 取指标的小工具 ---------- */
const pickSeries = (list, id) => (list || []).find((s) => s.id === id) || null;

/** 找某指标最近一年的条目（年份降序） */
function indicatorHistory(indicators, name, match = () => true) {
  return indicators
    .filter((item) => item.indicator === name && item.value != null && match(item))
    .sort((a, b) => Number(b.year) - Number(a.year));
}

const hasSourceLink = (item) => Boolean(item.source && /^https?:\/\//i.test(item.sourceUrl || ''));
const sourceStatus = (item) => hasSourceLink(item) ? '附来源链接' : item.source ? '仅列来源' : '待补来源';

/* ---------- ECharts option 构建 ---------- */
function baseGrid() {
  return {
    textStyle: { fontFamily: chartBase.textStyle.fontFamily, color: chartBase.textStyle.color },
    tooltip: { ...chartBase.tooltip, trigger: 'axis' },
  };
}

/** 单序列折线 + 预测虚线（年份拼接：实际 → 预测） */
function buildSeriesOption(series) {
  const base = baseGrid();
  if (!series || !Array.isArray(series.years) || !series.years.length) {
    return base;
  }
  const years = series.years.map(String);
  const fYears = (series.forecastYears || []).map(String);
  const cats = [...years, ...fYears];
  const lastActual = series.values[series.values.length - 1];

  const actualData = [...series.values, ...new Array(fYears.length).fill(null)];
  // 预测段从最后一个实际点起笔，折线才连得上
  const forecastData = [
    ...new Array(Math.max(years.length - 1, 0)).fill(null),
    ...(years.length ? [lastActual] : []),
    ...(series.forecastValues || []),
  ];

  const seriesList = [{
    name: `${series.indicator}（${series.unit}）`,
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    data: actualData,
    lineStyle: { width: 2.5, color: palette[0] },
    itemStyle: { color: palette[0] },
    areaStyle: {
      color: {
        type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: 'rgba(13,138,240,0.22)' },
          { offset: 1, color: 'rgba(13,138,240,0.02)' },
        ],
      },
    },
  }];

  const hasForecast = fYears.length && (series.forecastValues || []).length;
  if (hasForecast) {
    seriesList.push({
      name: '预测',
      type: 'line',
      smooth: true,
      symbol: 'emptyCircle',
      symbolSize: 6,
      data: forecastData,
      lineStyle: { width: 2, type: 'dashed', color: color.amber },
      itemStyle: { color: color.amber },
    });
  }

  return {
    ...base,
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, textStyle: { fontSize: 11, color: color.textSecondary } },
    xAxis: {
      type: 'category',
      data: cats,
      boundaryGap: false,
      axisLine: { lineStyle: { color: color.border } },
      axisLabel: { color: color.textMuted, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      name: series.unit || '',
      nameTextStyle: { color: color.textMuted, fontSize: 11 },
      axisLabel: { color: color.textMuted, fontSize: 11 },
      splitLine: { lineStyle: { color: chartBase.gridLine } },
    },
    series: seriesList,
  };
}

/** 发射次数：柱（中国）+ 折线（全球） */
function buildLaunchOption(china, global) {
  const base = baseGrid();
  if (!china || !global) return base;
  const years = china.years.map(String);
  return {
    ...base,
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, textStyle: { fontSize: 11, color: color.textSecondary } },
    tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category', data: years,
      axisLine: { lineStyle: { color: color.border } },
      axisLabel: { color: color.textMuted, fontSize: 11 },
    },
    yAxis: {
      type: 'value', name: '次',
      nameTextStyle: { color: color.textMuted, fontSize: 11 },
      axisLabel: { color: color.textMuted, fontSize: 11 },
      splitLine: { lineStyle: { color: chartBase.gridLine } },
    },
    series: [
      {
        name: `${china.indicator}（次）`, type: 'bar', data: china.values,
        barMaxWidth: 28, itemStyle: { color: palette[0], borderRadius: [4, 4, 0, 0] },
      },
      {
        name: `${global.indicator}（次）`, type: 'line', data: global.values,
        smooth: true, symbol: 'circle', symbolSize: 6,
        lineStyle: { width: 2.5, color: palette[1] }, itemStyle: { color: palette[1] },
      },
    ],
  };
}

/** 中国低轨星座组网：GW + 千帆累计在轨（实线）+ 阶段目标/ITU里程碑（虚线）
 *  两条序列的年份/预测年份可能不同，先求并集类目轴，再各自对齐填充，
 *  预测段从最后一个实际点起笔，折线才连得上。 */
function buildConstellationOption(gw, qf) {
  const base = baseGrid();
  if (!gw || !qf) return base;
  const catSet = new Set([
    ...gw.years, ...qf.years,
    ...(gw.forecastYears || []), ...(qf.forecastYears || []),
  ]);
  const cats = [...catSet].sort((a, b) => a - b).map(String);
  const pos = (y) => cats.indexOf(String(y));

  const toLines = (s) => {
    const actual = new Array(cats.length).fill(null);
    s.years.forEach((y, i) => { actual[pos(y)] = s.values[i]; });
    const forecast = new Array(cats.length).fill(null);
    const fY = s.forecastYears || [];
    const fV = s.forecastValues || [];
    if (fY.length && s.years.length) {
      forecast[pos(s.years[s.years.length - 1])] = s.values[s.values.length - 1];
      fY.forEach((y, i) => { forecast[pos(y)] = fV[i]; });
    }
    return { actual, forecast };
  };

  const g = toLines(gw);
  const q = toLines(qf);
  const line = (name, data, c, dashed) => ({
    name, type: 'line', smooth: true,
    symbol: dashed ? 'emptyCircle' : 'circle', symbolSize: 6,
    data,
    lineStyle: { width: dashed ? 2 : 2.5, type: dashed ? 'dashed' : 'solid', color: c },
    itemStyle: { color: c },
  });

  const seriesList = [
    line(`${gw.indicator}`, g.actual, palette[0], false),
    line(`${qf.indicator}`, q.actual, palette[2], false),
  ];
  if ((gw.forecastYears || []).length) {
    seriesList.push(line(`${gw.indicator}（ITU里程碑）`, g.forecast, palette[0], true));
  }
  if ((qf.forecastYears || []).length) {
    seriesList.push(line(`${qf.indicator}（阶段目标）`, q.forecast, palette[2], true));
  }

  return {
    ...base,
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, textStyle: { fontSize: 11, color: color.textSecondary } },
    tooltip: { ...base.tooltip, trigger: 'axis' },
    xAxis: {
      type: 'category', data: cats, boundaryGap: false,
      axisLine: { lineStyle: { color: color.border } },
      axisLabel: { color: color.textMuted, fontSize: 11 },
    },
    yAxis: {
      type: 'value', name: '颗',
      nameTextStyle: { color: color.textMuted, fontSize: 11 },
      axisLabel: { color: color.textMuted, fontSize: 11 },
      splitLine: { lineStyle: { color: chartBase.gridLine } },
    },
    series: seriesList,
  };
}

/** 融资：事件数（柱）+ 金额（折线，右轴） */
function buildFinanceOption(evt, amt) {
  const base = baseGrid();
  if (!evt || !amt) return base;
  const years = evt.years.map(String);
  return {
    ...base,
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, textStyle: { fontSize: 11, color: color.textSecondary } },
    tooltip: { ...base.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category', data: years,
      axisLine: { lineStyle: { color: color.border } },
      axisLabel: { color: color.textMuted, fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value', name: '起',
        nameTextStyle: { color: color.textMuted, fontSize: 11 },
        axisLabel: { color: color.textMuted, fontSize: 11 },
        splitLine: { lineStyle: { color: chartBase.gridLine } },
      },
      {
        type: 'value', name: amt.unit || '', position: 'right',
        nameTextStyle: { color: color.textMuted, fontSize: 11 },
        axisLabel: { color: color.textMuted, fontSize: 11 },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: `${evt.indicator}（起）`, type: 'bar', data: evt.values,
        barMaxWidth: 26, itemStyle: { color: palette[0], borderRadius: [4, 4, 0, 0] },
      },
      {
        name: `${amt.indicator}（${amt.unit}）`, yAxisIndex: 1, type: 'line', data: amt.values,
        smooth: true, symbol: 'circle', symbolSize: 6,
        lineStyle: { width: 2.5, color: palette[3] }, itemStyle: { color: palette[3] },
      },
    ],
  };
}

/* ---------- 图表容器：hook 必须先调用，再判空 ---------- */
function SeriesChart({ series, builder = buildSeriesOption, height = 300 }) {
  const { ref } = useChart(
    () => builder(series),
    [series && series.id, series && series.source],
    { a11yLabel: series?.name || series?.indicator || '图表数据' },
  );
  if (!series || !Array.isArray(series.years) || !series.years.length) {
    return <EmptyState text="该序列暂无数据" hint="待市场数据集补充同口径多年序列" />;
  }
  return (
    <div className="market-chart-wrap">
      <div ref={ref} style={{ height }} />
      <div className="market-chart-foot">
        <SourceTag item={series} compact />
        {series.note && <span className="market-chart-note">{series.note}</span>}
      </div>
    </div>
  );
}

/* ---------- 指标展示值 ---------- */
function displayValue(e) {
  if (e == null) return '—';
  if (e.valueText) return e.valueText;
  return formatNumber(e.value, { digits: Number.isInteger(e.value) ? 0 : 2 });
}

/* ---------- 瓶颈等级徽章 ---------- */
const SEVERITY_COLOR = { 高: color.orange, 中: color.amber, 低: color.green };
const TYPE_COLOR = { 结构性: color.purple, 周期性: color.cyan, 制度性: color.blue };

export default function Market() {
  const { requireConfirm } = useExportGuard();
  const data = useData();
  const market = selectDataset(data, 'market');
  const industry = selectDataset(data, 'industry');
  const meta = selectDatasetMeta(data, 'market');
  const indicators = market.indicators || [];
  const series = market.series || [];
  const insights = market.insights || [];
  const bottlenecks = market.bottlenecks || [];

  const hasData = indicators.length > 0 || series.length > 0;

  /* 序列 */
  const globalEconomy = pickSeries(series, 'global-space-economy');
  const chinaScale = pickSeries(series, 'china-commercial-space');
  const chinaLaunch = pickSeries(series, 'china-launch-count');
  const globalLaunch = pickSeries(series, 'global-launch-count');
  const gwOrbit = pickSeries(series, 'gw-in-orbit');
  const qfOrbit = pickSeries(series, 'qianfan-in-orbit');
  const starlinkOrbit = pickSeries(series, 'starlink-in-orbit');
  const globalVc = pickSeries(series, 'global-space-vc');

  /* 投融资序列复用 industry 数据集（与 /analysis 页同源，避免双口径打架） */
  const finData = industry.financingData;
  const finEvents = finData?.years?.length
    ? { id: 'china-financing-events', indicator: '中国商业航天融资事件数', years: finData.years, values: finData.events, unit: '起', source: finData.source, verified: true }
    : null;
  const finAmount = finData?.years?.length
    ? { id: 'china-financing-amount', indicator: '中国商业航天融资金额', years: finData.years, values: finData.amounts, unit: '亿元', source: finData.source, verified: true }
    : null;

  /* 分类指标 */
  const byCategory = (cat) => indicators.filter((e) => e.category === cat);
  const costRows = byCategory('成本');
  const constellationRows = byCategory('星座部署');
  const financingRows = byCategory('投融资');
  const policyRows = byCategory('政策制度');

  /* 头部要点 */
  const [latestGlobal] = indicatorHistory(indicators, '全球太空经济规模（Space Foundation口径）');
  const [latestChina] = indicatorHistory(indicators, '中国商业航天市场规模',
    (item) => item.note?.includes('广义全产业链'));
  const [latestLaunch] = indicatorHistory(indicators, '中国年度发射次数');
  const [latestStarlink] = indicatorHistory(indicators, 'Starlink在轨卫星数');
  const financingHistory = indicatorHistory(indicators, '中国商业航天年度融资金额',
    (item) => item.source?.startsWith('睿兽分析'));
  const [latestFinancing] = financingHistory;
  const priorFinancing = latestFinancing && financingHistory.find((item) =>
    Number(item.year) === Number(latestFinancing.year) - 1 && item.source === latestFinancing.source);
  const finYoy = priorFinancing?.value ? (latestFinancing.value / priorFinancing.value - 1) * 100 : null;
  const linkedCount = indicators.filter(hasSourceLink).length;
  const sourceSet = new Set(indicators.map((e) => e.source).filter(Boolean));

  if (!hasData) {
    return (
      <div className="portal-page market ds-page">
        <header className="market-hero">
          <h1 className="market-hero-title">市场空间</h1>
          <p className="market-hero-sub">市场规模 · 发射成本 · 星座部署 · 政策瓶颈的结构化分析</p>
        </header>
        <EmptyState
          text="暂无市场指标"
          hint="可先查看产业指标或研究报告。"
        />
      </div>
    );
  }

  return (
    <div className="portal-page market">
      <header className="market-hero">
        <h1 className="market-hero-title">市场空间</h1>
        <p className="market-hero-sub">
          市场规模、发射成本、星座部署与融资。收录 {indicators.length} 条指标，其中 {linkedCount} 条附来源链接，共有 {sourceSet.size} 种来源标注。
        </p>
        <FreshnessBadge fileKey="market" />
      </header>

      {/* ===== 一、核心指标 ===== */}
      <section>
        <SectionTitle title="核心指标" subtitle="指标按各自口径展示。来源链接及其覆盖状态可在指标明细中查看。" />
        <Grid columns="auto">
          {latestGlobal && (
            <StatCard
              label={latestGlobal.indicator}
              value={displayValue(latestGlobal)} unit={latestGlobal.unit} icon="globe"
              sub={`${latestGlobal.region} · ${latestGlobal.year}`}
            />
          )}
          {latestChina && (
            <StatCard
              label={latestChina.indicator}
              value={displayValue(latestChina)} unit={latestChina.unit} icon="chart" fallbackIcon
              sub={`${latestChina.year} · 广义全产业链口径`}
            />
          )}
          {latestLaunch && (
            <StatCard
              label={latestLaunch.indicator}
              value={displayValue(latestLaunch)} unit={latestLaunch.unit} icon="rocket"
              sub={`${latestLaunch.region} · ${latestLaunch.year}`}
            />
          )}
          {latestStarlink && (
            <StatCard
              label={latestStarlink.indicator}
              value={displayValue(latestStarlink)} unit={latestStarlink.unit} icon="satellite"
              sub={`${latestStarlink.region} · ${latestStarlink.year}`}
            />
          )}
          {latestFinancing && (
            <StatCard
              label="中国商业航天年度融资金额"
              value={displayValue(latestFinancing)}
              unit={latestFinancing.unit}
              icon="coins"
              delta={finYoy}
              sub="睿兽分析口径 · 与其他页面大会口径不可直接对比"
            />
          )}
        </Grid>
      </section>

      {/* ===== 二、市场规模与预测 ===== */}
      {(globalEconomy || chinaScale) && (
        <section>
          <SectionTitle
            title="市场规模与预测"
            subtitle="虚线为机构预测段；不同机构口径差异在数据来源处注明，勿直接横向相加"
          />
          <Grid columns="auto" gap={16}>
            {globalEconomy && (
              <Card>
                <h3 className="market-card-title">全球：{globalEconomy.indicator}</h3>
                <SeriesChart series={globalEconomy} />
              </Card>
            )}
            {chinaScale && (
              <Card>
                <h3 className="market-card-title">中国：{chinaScale.indicator}</h3>
                <SeriesChart series={chinaScale} />
              </Card>
            )}
          </Grid>
        </section>
      )}

      {/* ===== 三、发射活动与成本 ===== */}
      {(chinaLaunch || globalLaunch || costRows.length > 0) && (
        <section>
          <SectionTitle title="发射活动与成本" subtitle="发射次数看运力放量，成本看单位入轨价格的下降斜率" />
          {(chinaLaunch || globalLaunch) && (
            <Card>
              <h3 className="market-card-title">年度发射次数</h3>
              <SeriesChart series={chinaLaunch || globalLaunch} builder={() => buildLaunchOption(chinaLaunch, globalLaunch)} />
            </Card>
          )}
          {costRows.length > 0 && (
            <Card>
              <SectionTitle
                title="成本指标"
                subtitle="单位入轨成本与单发报价；不同箭型、不同口径的数值不直接可比，看趋势"
                level={3}
                actions={
                  <ExportBar
                    guard={requireConfirm}
                    filename="Market-成本指标"
                    csv={{
                      headers: ['指标', '地域', '年份', '数值', '单位', '来源', '口径说明'],
                      rows: costRows.map((e) => [e.indicator, e.region, e.year, displayValue(e), e.unit, e.source, e.note || '']),
                      source: meta.source || '中国商业航天产业分析平台',
                      caliber: '成本类指标点估计，逐条含来源',
                    }}
                  />
                }
              />
              <DataTable
                exportGuard={requireConfirm}
                data={costRows}
                filename="Market-成本指标"
                defaultSort={{ key: 'year', dir: 'desc' }}
                columns={[
                  { key: 'indicator', label: '指标' },
                  { key: 'region', label: '地域' },
                  { key: 'year', label: '年份' },
                  {
                    key: 'value', label: '数值',
                    render: (e) => `${displayValue(e)} ${e.unit || ''}`.trim(),
                  },
                  {
                    key: 'source', label: '来源',
                    render: (e) => <SourceTag item={e} compact />,
                  },
                ]}
              />
            </Card>
          )}
        </section>
      )}

      {/* ===== 四、星座与卫星部署 ===== */}
      {(starlinkOrbit || constellationRows.length > 0) && (
        <section>
          <SectionTitle title="星座与卫星部署" subtitle="巨型星座是当前需求侧最大的增量，部署节奏决定运力与制造订单" />
          {(gwOrbit && qfOrbit) && (
            <Card>
              <h3 className="market-card-title">中国低轨星座组网进度（累计在轨）</h3>
              <SeriesChart series={gwOrbit} builder={() => buildConstellationOption(gwOrbit, qfOrbit)} height={320} />
              <p className="market-chart-note">
                实线为累计在轨（冻结基准：GW 222颗@2026-10-10、千帆256颗@2026-09-16，合计478颗约为两网规划的1.7%）；虚线为阶段目标与ITU里程碑——当前部署与里程碑的数量级差距即是「星多箭少」。GW年计划完成度仅约27%，2027年起需年均净增500–600颗。
              </p>
            </Card>
          )}
          {starlinkOrbit && (
            <Card>
              <h3 className="market-card-title">{starlinkOrbit.indicator}</h3>
              <SeriesChart series={starlinkOrbit} />
            </Card>
          )}
          {constellationRows.length > 0 && (
            <Card>
              <SectionTitle
                title="星座与卫星应用指标"
                subtitle="规划规模、部署进度与频轨竞争窗口"
                level={3}
                actions={
                  <ExportBar
                    guard={requireConfirm}
                    filename="Market-星座指标"
                    csv={{
                      headers: ['指标', '地域', '年份', '数值', '单位', '来源', '口径说明'],
                      rows: constellationRows.map((e) => [e.indicator, e.region, e.year, displayValue(e), e.unit, e.source, e.note || '']),
                      source: meta.source || '中国商业航天产业分析平台',
                      caliber: '星座类指标点估计，逐条含来源',
                    }}
                  />
                }
              />
              <DataTable
                exportGuard={requireConfirm}
                data={constellationRows}
                filename="Market-星座指标"
                defaultSort={{ key: 'year', dir: 'desc' }}
                columns={[
                  { key: 'indicator', label: '指标' },
                  { key: 'region', label: '地域' },
                  { key: 'year', label: '年份' },
                  { key: 'value', label: '数值', render: (e) => `${displayValue(e)} ${e.unit || ''}`.trim() },
                  { key: 'source', label: '来源', render: (e) => <SourceTag item={e} compact /> },
                ]}
              />
            </Card>
          )}
        </section>
      )}

      {/* ===== 五、投融资 ===== */}
      {finEvents && finAmount && (
        <section>
          <SectionTitle title="投融资" subtitle="事件数看资本参与广度，金额看单笔下注深度；两条曲线背离常预示轮次后移" />
          <Card>
            <SeriesChart series={finEvents} builder={() => buildFinanceOption(finEvents, finAmount)} height={320} />
          </Card>
        </section>
      )}

      {/* ===== 六、政策与瓶颈 ===== */}
      {bottlenecks.length > 0 && (
        <section>
          <SectionTitle title="政策与成本瓶颈" subtitle="按结构性 / 周期性 / 制度性分级，应对策略不同" />
          <div className="market-bottleneck-grid">
            {bottlenecks.map((b) => (
              <Card key={b.id || b.title} className="market-bottleneck">
                <div className="market-bottleneck-head">
                  <span className="market-bottleneck-type" style={{ color: TYPE_COLOR[b.type] || color.textMuted }}>
                    {b.type || '其他'}
                  </span>
                  <span className="market-bottleneck-severity" style={{ color: SEVERITY_COLOR[b.severity] || color.textMuted }}>
                    {b.severity || '—'}冲击
                  </span>
                </div>
                <h4 className="market-bottleneck-title">{b.title}</h4>
                <p className="market-bottleneck-desc">{b.desc}</p>
                {b.impact && <p className="market-bottleneck-impact">影响：{b.impact}</p>}
                <SourceTag item={b} compact />
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ===== 七、核心洞察 ===== */}
      {insights.length > 0 && (
        <section>
          <SectionTitle title="核心洞察" subtitle="由专家团分域取证后交叉校验得出" />
          <div className="market-insight-grid">
            {insights.map((it, i) => (
              <Card key={it.id || i} className="market-insight">
                <div className="market-insight-index">{String(i + 1).padStart(2, '0')}</div>
                <div>
                  <h4 className="market-insight-title">{it.title}</h4>
                  <p className="market-insight-text">{it.text}</p>
                  {it.evidence && <p className="market-insight-evidence">依据：{it.evidence}</p>}
                  {it.source && <SourceTag item={it} compact />}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ===== 八、指标明细 ===== */}
      <section>
        <SectionTitle
          title="指标明细"
          subtitle="全量结构化指标：指标、年份、数值、单位、来源、口径；支持排序 / 筛选 / 导出"
          actions={
            <ExportBar
              guard={requireConfirm}
              filename="Market-指标明细"
              csv={{
                headers: ['指标', '类别', '地域', '年份', '数值', '文本数值', '单位', '来源', '来源链接', '来源状态', '口径说明'],
                rows: indicators.map((e) => [
                  e.indicator, e.category, e.region, e.year,
                  e.value == null ? '' : e.value, e.valueText || '', e.unit,
                  e.source, e.sourceUrl || '', sourceStatus(e), e.note || '',
                ]),
                source: meta.source || '中国商业航天产业分析平台',
                caliber: 'market 数据集 indicators 全量导出，逐条含来源与口径说明',
              }}
              jsonData={{ indicators, series }}
              bib={{ title: '中国商业航天市场指标体系', note: `数据更新于 ${data?.fileUpdatedAt?.market || meta.lastUpdated || '未知'}，来源见各条目 source 字段` }}
            />
          }
        />
        <Card>
          <DataTable
            exportGuard={requireConfirm}
            data={indicators}
            filename="Market-指标明细"
            pageSize={12}
            defaultSort={{ key: 'year', dir: 'desc' }}
            filters={[
              { key: 'category', label: '类别' },
              { key: 'region', label: '地域' },
            ]}
            columns={[
              { key: 'indicator', label: '指标' },
              { key: 'category', label: '类别' },
              { key: 'region', label: '地域' },
              { key: 'year', label: '年份' },
              { key: 'value', label: '数值', render: (e) => `${displayValue(e)} ${e.unit || ''}`.trim() },
              {
                key: 'verified', label: '来源状态', render: sourceStatus,
              },
              { key: 'source', label: '来源', render: (e) => hasSourceLink(e)
                ? <a href={e.sourceUrl} target="_blank" rel="noreferrer">{e.source}</a>
                : e.source || '—' },
              { key: 'note', label: '口径说明' },
            ]}
          />
        </Card>
      </section>

      {/* ===== 九、政策量化时点 ===== */}
      {policyRows.length > 0 && (
        <section>
          <SectionTitle title="政策量化时点" subtitle="关键政策从「表态」到「量化」的时点，是节奏判断的锚" />
          <Card>
            <DataTable
              exportGuard={requireConfirm}
              data={policyRows}
              filename="Market-政策时点"
              defaultSort={{ key: 'year', dir: 'desc' }}
              columns={[
                { key: 'indicator', label: '政策要点' },
                { key: 'region', label: '地域' },
                { key: 'year', label: '年份' },
                { key: 'value', label: '数值', render: (e) => `${displayValue(e)} ${e.unit || ''}`.trim() },
                { key: 'source', label: '来源', render: (e) => <SourceTag item={e} compact /> },
              ]}
            />
          </Card>
        </section>
      )}
    </div>
  );
}
