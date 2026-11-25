/* ============================================================
   投资分析工具 /investors —— 决策辅助视角
   ------------------------------------------------------------
   定位：把「听说某家融资了」到「形成初步判断」的路径压缩到一页。
   与数据与溯源的分工：本页讲「判断与前瞻」，不讲「口径与溯源」；
   同一份底层数据，两种任务层切片（见 .workbuddy/memory 信息架构决策）。

   四个页签（支持 /investors#tab-<key> 深链直达，浏览器前进后退可回退页签）：
     tab-heat       热度总览  —— 赛道 × 轮次热力矩阵（可点击下钻）+ 分布 + 融资时序
     tab-companies  企业画像  —— 企业融资画像 + 搜索 / 排序 / 筛选 + 自选关注
     tab-catalysts  催化剂日历 —— 政策动向 × 在研火箭 × 星座缺口 × 发射可靠性
     tab-stream     事件流水  —— 融资事件明细表（筛选 / 排序 / 导出）

   状态约定：
    加载 —— 全局数据由 DataProvider 兜底；图表首帧由 Chart 容器出骨架占位
    空态 —— 每个区块独立判空，用 EmptyState 说明「为什么没有」而不是留白
    错误 —— 页签内容包在 InvestorErrorBoundary 内，异常可就地重试

   纪律：取数一律走 @portal 的 selector，图表一律走 useChart，
        导出一律走 @portal 的 exporters，不自行实现下载逻辑。
        金额归一统一用 parseFunding（保守口径：「超5亿」记 5 亿）。
        金额文案统一走 amountText / lastAmountText，避免同一数字多种写法。
   ============================================================ */

import { useMemo, useState, useEffect, useRef, useCallback, Component } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { registerSearchData } from '../components/GlobalSearch';
import {
  Card, SectionTitle, StatCard, SourceTag, ExportBar, EmptyState, Icon, DataTable,
  selectDataset, flattenDataset, aggregateFundingByCompany,
  formatNumber, parseFunding,
  useChart, color, chartBase,
} from '@portal';
/* 合规原语：风险条 / 32px 来源条 / 状态徽标 / 导出前免责确认
   与设计文档同一套文案，避免投资人页与合规页口径漂移 */
import {
  COMPLIANCE, RiskBanner, SourceBar, StatusBadge, useDisclaimerGuard,
} from '../components/ComplianceKit';
import '../modules/_shared/sdk.css';
import '../styles/investor.css';

/* 投融资数据的统一口径描述：导出 meta 用完整版，卡片来源条用短标签。
   来源条恒占 32px，长文本会把它撑成多行，故完整表述收敛到口径页与导出件 */
const FINANCING_CALIBER = '披露金额保守归一（「超5亿」记 5 亿元），未披露不计入金额统计';
const FINANCING_CALIBER_SHORT = '披露金额保守归一';
const SOURCE_SHORT = 'IT桔子等公开信息整理';

/* ---------- 页签：key 同时用作 hash 后缀，保证可深链、可回退 ---------- */
const TABS = [
  { key: 'heat', label: '热度总览', icon: 'chart-bar' },
  { key: 'companies', label: '企业画像', icon: 'building' },
  { key: 'catalysts', label: '催化剂日历', icon: 'flag' },
  { key: 'stream', label: '事件流水', icon: 'scroll' },
];
const DEFAULT_TAB = TABS[0].key;
const tabHash = (key) => `tab-${key}`;

/* 企业卡片稳定锚点 id。中文名经 encodeURIComponent 后仍是合法 DOM id，
   且与 react-router 保留在 location.hash 中的百分号编码一致，
   全局搜索可据此直接定位到具体企业卡片（见下方 activeTab 与深链 effect）。 */
const companyAnchorId = (name) => `cmp-${encodeURIComponent(name)}`;

/* ---------- 轮次阶段顺序（用于热力矩阵列与分布图排序） ---------- */
const ROUND_ORDER = [
  '天使轮', 'Pre-A轮', 'A轮', 'A+轮', 'A2轮', 'A++轮',
  'B轮', 'B+轮', 'C轮', 'C+轮', 'D轮', 'D+轮', 'D++轮',
  'Pre-IPO', '定增', '战略融资', '新一轮',
];

const WATCH_KEY = 'cs-investor-watchlist';

/* ---------- 企业画像排序方式 ---------- */
const SORT_OPTIONS = [
  { key: 'rounds', label: '融资轮次 多 → 少' },
  { key: 'cum', label: '累计金额 高 → 低' },
  { key: 'recent', label: '最近披露 新 → 旧' },
  { key: 'name', label: '企业名称 A → Z' },
];

/* ---------- 投资板块互链：避免本页成为孤岛 ---------- */
const RELATED_LINKS = [
  { path: '/analysis', label: '投融资数据', desc: '市场规模 · 融资时序 · 区域分布' },
  { path: '/chain', label: '企业库', desc: '产业链环节与企业矩阵' },
  { path: '/market', label: '市场空间', desc: '规模 · 成本 · 瓶颈' },
  { path: '/rockets', label: '火箭型谱', desc: '运力与发射可靠性' },
  { path: '/constellation', label: '星座计划', desc: '部署进度与缺口' },
  { path: '/research', label: '数据与溯源', desc: '口径 · 溯源 · 导出' },
];

/* ---------- 来源兜底文案（industry 数据集未提供独立 source 字段时使用） ---------- */
const SOURCE_FALLBACK = 'IT桔子、创业邦睿兽分析、投中信息 CVSource 等公开信息整理';

/* ============================================================
   文案工具 —— 全页金额口径统一出口
   ============================================================ */

/** 事件金额：可归一显示「X.XX 亿元」，否则回退原文或「未披露」 */
function amountText(row) {
  if (row && row._amountYi != null) return `${row._amountYi.toFixed(2)} 亿元`;
  return (row && row.amount) || '未披露';
}

/** 企业最近一轮金额：同 amountText，入参为聚合后的企业画像对象 */
function lastAmountText(c) {
  if (c.lastAmountYi != null) return `${c.lastAmountYi.toFixed(2)} 亿元`;
  return c.lastAmount && c.lastAmount !== '—' ? c.lastAmount : '未披露';
}

/* ============================================================
   派生计算（纯函数，全部实时归集，不落任何中间 json）
   ============================================================ */

/** 事件预处理：金额归一为亿元、派生年份 */
function prepareEvents(data) {
  const events = selectDataset(data, 'industry').financingEvents || [];
  return events.map((e) => {
    const v = parseFunding(e.amount);
    return {
      ...e,
      _amountYi: v == null ? null : v / 1e8,
      _year: (e.date || '').slice(0, 4),
    };
  });
}

/** 赛道 × 轮次矩阵 + 赛道/轮次分项（不用数据文件里的 2025 快照） */
function buildHeat(evRows) {
  const segMap = new Map(); // segment -> Map(round -> {amount, count, companies})
  evRows.forEach((e) => {
    const seg = e.segment || '未标注';
    if (!segMap.has(seg)) segMap.set(seg, new Map());
    const inner = segMap.get(seg);
    const amt = e._amountYi == null ? 0 : e._amountYi;
    const cur = inner.get(e.round) || { amount: 0, count: 0, companies: [] };
    cur.amount += amt;
    cur.count += 1;
    if (e.company && !cur.companies.includes(e.company)) cur.companies.push(e.company);
    inner.set(e.round, cur);
  });

  // 赛道按披露金额降序
  const segments = [...segMap.entries()]
    .map(([name, m]) => {
      let amount = 0;
      let count = 0;
      m.forEach((v) => { amount += v.amount; count += v.count; });
      return { name, amount, count, cells: m };
    })
    .sort((a, b) => b.amount - a.amount);

  // 轮次按阶段顺序，未知轮次排在后面
  const rounds = [...new Set(evRows.map((e) => e.round).filter(Boolean))]
    .sort((a, b) => {
      const ia = ROUND_ORDER.indexOf(a);
      const ib = ROUND_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, 'zh');
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    })
    .map((name) => {
      const rows = evRows.filter((e) => e.round === name);
      return {
        name,
        count: rows.length,
        amount: rows.reduce((s, e) => s + (e._amountYi || 0), 0),
      };
    });

  return { segments, rounds };
}

/** 产业链定位匹配：融资企业名 ↔ 企业矩阵 */
function buildChainMap(data) {
  const map = new Map();
  flattenDataset(data, 'chain').forEach((c) => {
    if (c.name && !map.has(c.name)) map.set(c.name, c);
  });
  return map;
}

/** 企业画像：在 aggregateFundingByCompany 基础上补累计金额、地区与产业链定位 */
function buildCompanies(data, chainMap) {
  return aggregateFundingByCompany(data).map((c) => {
    const cum = c.events.reduce((s, e) => {
      const v = parseFunding(e.amount);
      return v == null ? s : s + v;
    }, 0);
    const latestYi = parseFunding(c.lastAmount);
    return {
      ...c,
      cumYi: cum / 1e8,
      lastAmountYi: latestYi == null ? null : latestYi / 1e8,
      amtCount: c.events.filter((e) => parseFunding(e.amount) != null).length,
      region: c.events.find((e) => e.region)?.region || '',
      chain: chainMap.get(c.name) || null,
    };
  });
}

/** 催化剂：政策（2024 年以来）/ 在研火箭 / 已飞型号 / 可靠性分档 / 星座部署缺口 */
function buildCatalysts(data) {
  const all = selectDataset(data, 'rockets').list || [];
  // 注意：successRate 为空代表尚未首飞，必须先判 null 再分档，
  // 否则 null < 80 在 JS 里为 true，会把在研型号误算进低成功率档
  const flown = all.filter((r) => r.successRate != null);
  const devRockets = all.filter((r) => r.successRate == null);

  const policies = flattenDataset(data, 'policy')
    .filter((p) => String(p.date || '') >= '2024')
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  const gaps = (selectDataset(data, 'constellations').list || [])
    .filter((c) => c.status === '组网中' && c.planned && c.actual != null)
    .map((c) => ({
      name: c.name,
      company: c.company,
      actual: c.actual,
      planned: c.planned,
      gap: c.planned - c.actual,
    }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 8);

  const bands = {
    high: flown.filter((r) => r.successRate >= 95).length,
    mid: flown.filter((r) => r.successRate >= 80 && r.successRate < 95).length,
    low: flown.filter((r) => r.successRate < 80).length,
  };

  return { flown, devRockets, policies, gaps, bands };
}

/** 页首指标 */
function buildStats(evRows, companies) {
  const parseable = evRows.filter((e) => e._amountYi != null);
  const totalYi = parseable.reduce((s, e) => s + e._amountYi, 0);
  const byCompany = companies.map((c) => c.cumYi).sort((a, b) => b - a);
  const top5 = byCompany.slice(0, 5).reduce((s, v) => s + v, 0);
  const latest = evRows.map((e) => e.date).filter(Boolean).sort().pop() || '—';
  return {
    events: evRows.length,
    companyCount: companies.length,
    totalYi,
    parseableCount: parseable.length,
    top5Share: totalYi > 0 ? top5 / totalYi : 0,
    latest,
  };
}

/* ============================================================
   通用容器：图表骨架 / 空态 / 错误边界
   ============================================================ */

/**
 * 图表容器 —— 统一骨架占位与尺寸
 * 为什么不用裸 useChart：ECharts init 后到首帧绘制之间会有一次空白，
 * 页签切换时尤其明显；这里用 onReady 收敛为一次性骨架。
 */
function Chart({ build, deps = [], onEvents, height = 'mid', label, boxClassName = '' }) {
  const [ready, setReady] = useState(false);
  const { ref } = useChart(build, deps, { onReady: () => setReady(true), onEvents });

  return (
    <div className={`iv-chart-box iv-chart-box-${height} ${boxClassName}`}>
      <div ref={ref} className="iv-chart" role="img" aria-label={label} />
      {!ready && (
        <div className="iv-chart-skeleton" aria-hidden="true">
          图表渲染中…
        </div>
      )}
    </div>
  );
}

/**
 * 页级错误边界 —— 任一页签的派生/渲染异常不应带崩整页
 * 提供「重试」就地恢复，并给出数据与溯源作为核对出路
 */
class InvestorErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Investors] 渲染异常：', error, info?.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <Card>
        <div className="iv-error">
          <span className="iv-error-icon" aria-hidden="true">
            <Icon name="alert" size={26} />
          </span>
          <h3 className="iv-error-title">该板块渲染异常</h3>
          <p className="iv-error-desc">
            {error.message || '未知错误'}。可能是数据格式临时异常，可重试或前往数据与溯源核对原始数据。
          </p>
          <div className="iv-error-actions">
            <button
              type="button"
              className="iv-btn iv-btn-primary"
              onClick={() => this.setState({ error: null })}
            >
              重试
            </button>
            <Link className="iv-btn" to="/research">前往数据与溯源</Link>
          </div>
        </div>
      </Card>
    );
  }
}

/** 页尾投资板块互链 */
function RelatedLinks() {
  return (
    <section className="iv-related" aria-label="投资板块相关页面">
      <h2 className="iv-related-title">投资板块相关页面</h2>
      <div className="portal-grid iv-related-grid">
        {RELATED_LINKS.map((item) => (
          <Link className="iv-related-card" key={item.path} to={item.path}>
            <span className="iv-related-label">{item.label}</span>
            <span className="iv-related-desc">{item.desc}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   合规增强（设计方案 §7.2 来源条 / §8 风险提示 / §3 三元状态）
   ------------------------------------------------------------
   本站的「三元状态」不是方案里的「已量化业务占比 / 仅概念映射 / 未盈利」，
   而是产业融资数据的三种口径状态：可归一 / 未披露 / 快照。
   状态一律「色点 + 文字」双通道，不靠颜色单独传达。
   ============================================================ */

/** 含数字的指标卡：StatCard + 恒占 32px 的来源条，拼成一张完整卡片 */
function MetricCard({ label, value, unit, sub, icon, source, asOf, caliber, status = '非实时快照', tone = 'info' }) {
  return (
    <div className="iv-metric">
      <StatCard label={label} value={value} unit={unit} sub={sub} icon={icon} />
      <SourceBar source={source} asOf={asOf} caliber={caliber} status={status} tone={tone} />
    </div>
  );
}

/** 图表 / 表格下方来源条：28px 下限，与卡片同宽、置于容器末尾 */
function ChartSourceBar({ source, asOf, caliber, status = '派生·非实时', tone = 'info', className = '' }) {
  return (
    <SourceBar
      source={source}
      asOf={asOf}
      caliber={caliber}
      status={status}
      tone={tone}
      variant="chart"
      className={className}
    />
  );
}

/** 口径提示条：融资热度不等于经营质量，三类口径状态不可混用 */
function ConceptNote() {
  return (
    <section className="iv-concept" aria-label="口径提示：融资热度不等于经营质量">
      <p className="iv-concept-lead">
        <b>融资热度 ≠ 经营质量，概念相关 ≠ 业绩受益。</b>
        本页是对已披露一级市场信息的统计描述，不构成对任何企业或证券的推荐、评级或收益判断。
      </p>
      <div className="iv-concept-states">
        <StatusBadge tone="info">已披露·可归一</StatusBadge>
        <span className="iv-concept-state-desc">有明确金额，计入总额与集中度</span>
        <StatusBadge tone="amber">未披露·不计入</StatusBadge>
        <span className="iv-concept-state-desc">保留事件本身，不参与金额统计</span>
        <StatusBadge tone="neutral">大会口径·不可相加</StatusBadge>
        <span className="iv-concept-state-desc">2025 快照单独呈现，颗粒度不同</span>
      </div>
      <p className="iv-concept-foot">
        三个状态与分文件数据时间、来源分级均可在
        <Link to="/compliance#tab-sources">数据来源与口径</Link>逐条核对；
        风险边界见<Link to="/compliance#tab-risk">风险提示</Link>。
      </p>
    </section>
  );
}

/** 筛选空态：明确「不提供推荐名单」，避免用户把空结果读成筛选建议 */
function NoRecommendationEmpty({ hint }) {
  return (
    <EmptyState
      text="当前条件下没有可展示的主体。本平台不提供推荐名单，请调整筛选条件。"
      hint={hint}
    />
  );
}

/* ============================================================
   图表：赛道 × 轮次热力矩阵
   ============================================================ */
function HeatMatrix({ heat, onCellClick }) {
  const { segments, rounds } = heat;
  const build = () => {
    const data = [];
    let max = 0;
    segments.forEach((seg, yi) => {
      rounds.forEach((rd, xi) => {
        const cell = seg.cells.get(rd.name);
        const amount = cell ? Number(cell.amount.toFixed(2)) : 0;
        if (amount > max) max = amount;
        data.push({
          value: [xi, yi, amount],
          segment: seg.name,
          round: rd.name,
          count: cell ? cell.count : 0,
          amount,
          companies: cell ? cell.companies : [],
        });
      });
    });

    return {
      ...chartBase,
      tooltip: {
        ...chartBase.tooltip,
        formatter: (p) => {
          const d = p.data;
          if (!d || !d.count) return `<b>${d.segment} · ${d.round}</b><br/>暂无披露事件`;
          return `<b>${d.segment} · ${d.round}</b><br/>披露金额 ${d.amount.toFixed(2)} 亿元<br/>${d.count} 起 · ${d.companies.join('、')}`;
        },
      },
      grid: { left: 8, right: 12, top: 10, bottom: 96, containLabel: true },
      xAxis: {
        type: 'category',
        data: rounds.map((r) => r.name),
        splitArea: { show: true },
        axisLabel: { interval: 0, rotate: 38, fontSize: 11, color: color.textSecondary },
        axisLine: { lineStyle: { color: color.border } },
      },
      yAxis: {
        type: 'category',
        data: segments.map((s) => s.name),
        splitArea: { show: true },
        axisLabel: { fontSize: 11, color: color.textSecondary },
        axisLine: { lineStyle: { color: color.border } },
      },
      visualMap: {
        min: 0,
        max: Math.ceil(max) || 1,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 4,
        itemWidth: 12,
        itemHeight: 80,
        text: ['金额高', '金额低'],
        textStyle: { fontSize: 11, color: color.textMuted },
        inRange: { color: ['#f2f6fb', '#c3dbf6', '#7fb6ee', '#3b8de0', '#0d5fb8'] },
      },
      series: [{
        type: 'heatmap',
        data,
        label: {
          show: true,
          fontSize: 11,
          color: color.textPrimary,
          formatter: (p) => (p.data && p.data.count > 0 ? p.data.count : ''),
        },
        itemStyle: { borderColor: 'rgba(255,255,255,0.6)', borderWidth: 2 },
        emphasis: { itemStyle: { borderColor: color.textPrimary, borderWidth: 2 } },
      }],
    };
  };

  // 移动端轮次列较多：外层容器横向滚动，内层给足最小宽度
  return (
    <div className="iv-heat-scroll">
      <Chart
        build={build}
        deps={[heat]}
        height="tall"
        boxClassName="iv-heat-inner"
        label="赛道与轮次融资热力矩阵"
        onEvents={{
          click: (params) => {
            const d = params.data;
            if (d && d.count > 0) onCellClick({ segment: d.segment, round: d.round });
          },
        }}
      />
    </div>
  );
}

/* ============================================================
   图表：赛道分布（事件数 × 披露金额）
   ============================================================ */
function SegmentChart({ segments }) {
  return (
    <Chart
      label="各赛道融资事件数与披露金额"
      deps={[segments]}
      build={() => ({
        ...chartBase,
        tooltip: { ...chartBase.tooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { top: 0, right: 0, itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 11, color: color.textSecondary } },
        grid: { left: 8, right: 14, top: 34, bottom: 8, containLabel: true },
        xAxis: {
          type: 'category',
          data: segments.map((s) => s.name),
          axisLabel: { interval: 0, rotate: 34, fontSize: 11, color: color.textSecondary },
          axisLine: { lineStyle: { color: color.border } },
        },
        yAxis: [
          { type: 'value', name: '起', nameTextStyle: { fontSize: 11, color: color.textMuted }, splitLine: { lineStyle: { color: chartBase.gridLine } }, axisLabel: { fontSize: 11, color: color.textSecondary } },
          { type: 'value', name: '亿元', nameTextStyle: { fontSize: 11, color: color.textMuted }, splitLine: { show: false }, axisLabel: { fontSize: 11, color: color.textSecondary } },
        ],
        series: [
          {
            name: '事件数', type: 'bar', barMaxWidth: 26,
            data: segments.map((s) => s.count),
            itemStyle: { color: color.blue, borderRadius: [4, 4, 0, 0] },
          },
          {
            name: '披露金额', type: 'bar', barMaxWidth: 26, yAxisIndex: 1,
            data: segments.map((s) => Number(s.amount.toFixed(2))),
            itemStyle: { color: color.orange, borderRadius: [4, 4, 0, 0] },
          },
        ],
      })}
    />
  );
}

/* ============================================================
   图表：轮次分布（横向条形，按阶段排序）
   ============================================================ */
function RoundChart({ rounds }) {
  return (
    <Chart
      label="各轮次披露金额分布"
      deps={[rounds]}
      build={() => ({
        ...chartBase,
        tooltip: {
          ...chartBase.tooltip,
          formatter: (ps) => {
            const r = rounds[ps[0].dataIndex];
            return `<b>${r.name}</b><br/>披露金额 ${r.amount.toFixed(2)} 亿元<br/>${r.count} 起`;
          },
        },
        grid: { left: 8, right: 40, top: 10, bottom: 8, containLabel: true },
        xAxis: {
          type: 'value',
          splitLine: { lineStyle: { color: chartBase.gridLine } },
          axisLabel: { fontSize: 11, color: color.textSecondary },
        },
        yAxis: {
          type: 'category',
          inverse: true,
          data: rounds.map((r) => r.name),
          axisLabel: { fontSize: 11, color: color.textSecondary },
          axisLine: { lineStyle: { color: color.border } },
        },
        series: [{
          type: 'bar',
          data: rounds.map((r) => Number(r.amount.toFixed(2))),
          barMaxWidth: 16,
          itemStyle: { color: color.purple, borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', fontSize: 11, color: color.textSecondary, formatter: (p) => `${p.value} 亿` },
        }],
      })}
    />
  );
}

/* ============================================================
   图表：行业融资时序（事件数 × 金额，双轴）
   ============================================================ */
function FinancingTrend({ financing }) {
  return (
    <Chart
      label="行业融资事件数与披露金额时序"
      deps={[financing]}
      build={() => ({
        ...chartBase,
        tooltip: { ...chartBase.tooltip, trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { top: 0, right: 0, itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 11, color: color.textSecondary } },
        grid: { left: 8, right: 14, top: 34, bottom: 8, containLabel: true },
        xAxis: {
          type: 'category',
          data: financing.years,
          axisLabel: { fontSize: 11, color: color.textSecondary },
          axisLine: { lineStyle: { color: color.border } },
        },
        yAxis: [
          { type: 'value', name: '起', nameTextStyle: { fontSize: 11, color: color.textMuted }, splitLine: { lineStyle: { color: chartBase.gridLine } }, axisLabel: { fontSize: 11, color: color.textSecondary } },
          { type: 'value', name: '亿元', nameTextStyle: { fontSize: 11, color: color.textMuted }, splitLine: { show: false }, axisLabel: { fontSize: 11, color: color.textSecondary } },
        ],
        series: [
          {
            name: '融资事件数', type: 'bar', barMaxWidth: 30,
            data: financing.events,
            itemStyle: { color: color.blue, borderRadius: [4, 4, 0, 0] },
          },
          {
            name: '披露金额', type: 'line', yAxisIndex: 1,
            data: financing.amounts,
            smooth: true,
            symbolSize: 7,
            lineStyle: { width: 2.5, color: color.orange },
            itemStyle: { color: color.orange },
            areaStyle: { color: 'rgba(240, 98, 53, 0.08)' },
          },
        ],
      })}
    />
  );
}

/* ============================================================
   图表：星座部署缺口（已部署 vs 待部署）
   ============================================================ */
function ConstellationGap({ items }) {
  return (
    <Chart
      label="组网中星座的部署缺口"
      height="tall"
      deps={[items]}
      build={() => ({
        ...chartBase,
        tooltip: {
          ...chartBase.tooltip,
          formatter: (ps) => {
            const i = items[ps[0].dataIndex];
            const pct = i.planned > 0 ? ((i.actual / i.planned) * 100).toFixed(1) : '—';
            return `<b>${i.name}</b>（${i.company}）<br/>已部署 ${i.actual.toLocaleString()} 颗 · 规划 ${i.planned.toLocaleString()} 颗<br/>缺口 ${i.gap.toLocaleString()} 颗 · 完成度 ${pct}%`;
          },
        },
        legend: { top: 0, right: 0, itemWidth: 12, itemHeight: 8, textStyle: { fontSize: 11, color: color.textSecondary } },
        grid: { left: 8, right: 30, top: 34, bottom: 8, containLabel: true },
        xAxis: {
          type: 'value',
          axisLabel: { fontSize: 11, color: color.textSecondary, formatter: (v) => (v >= 10000 ? `${v / 10000}万` : v) },
          splitLine: { lineStyle: { color: chartBase.gridLine } },
        },
        yAxis: {
          type: 'category',
          inverse: true,
          data: items.map((i) => i.name),
          axisLabel: { fontSize: 11, color: color.textSecondary },
          axisLine: { lineStyle: { color: color.border } },
        },
        series: [
          {
            name: '已部署', type: 'bar', stack: 'gap', barMaxWidth: 16,
            data: items.map((i) => i.actual),
            itemStyle: { color: color.green, borderRadius: [0, 0, 0, 0] },
          },
          {
            name: '待部署缺口', type: 'bar', stack: 'gap', barMaxWidth: 16,
            data: items.map((i) => i.gap),
            itemStyle: { color: 'rgba(13, 138, 240, 0.18)', borderRadius: [0, 4, 4, 0] },
          },
        ],
      })}
    />
  );
}

/* ============================================================
   页签一：热度总览
   ============================================================ */
function HeatTab({ data, evRows, heat, meta }) {
  const [cell, setCell] = useState(null);
  const financing = selectDataset(data, 'industry').financingData || { years: [], events: [], amounts: [] };
  const structure = selectDataset(data, 'industry').financingStructure2025;

  const drillEvents = useMemo(() => {
    if (!cell) return [];
    return evRows
      .filter((e) => e.segment === cell.segment && e.round === cell.round)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [cell, evRows]);

  if (evRows.length === 0) {
    return (
      <Card>
        <EmptyState
          text="暂无融资事件"
          hint="底层 financingEvents 为空，热度矩阵与分布无法归集。可前往数据与溯源核对数据完整性。"
        />
      </Card>
    );
  }

  return (
    <div>
      <p className="iv-tab-note">
        本页所有分项统计均由当前融资事件<b>实时归集</b>（含 2026 年披露），
        与数据文件中的 2025 年口径快照分别呈现、不可混用。金额为披露口径：
        「超5亿」按 5 亿元保守归一，「未披露」不计入统计。
        点击热力矩阵任意单元格，可下钻至该「赛道 × 轮次」的事件明细。
      </p>

      <Card>
        <SectionTitle
          title="赛道 × 轮次热力矩阵"
          subtitle="单元格数字为该组合的事件起数，颜色深度为披露金额；点击下钻明细"
          actions={<span className="iv-note">共 {evRows.length} 起事件 · {heat.segments.length} 个赛道</span>}
        />
        <HeatMatrix heat={heat} onCellClick={setCell} />
        <div className="iv-drill">
          <div className="iv-drill-head">
            <h3 className="iv-drill-title">
              {cell ? `下钻明细：${cell.segment} · ${cell.round}` : '下钻明细'}
            </h3>
            {cell && (
              <button type="button" className="iv-drill-clear" onClick={() => setCell(null)}>
                清除筛选
              </button>
            )}
          </div>
          {!cell && <div className="iv-drill-empty">点击上方矩阵单元格，查看该赛道与轮次组合的融资事件</div>}
          {cell && drillEvents.length === 0 && <div className="iv-drill-empty">该组合暂无事件</div>}
          {cell && drillEvents.length > 0 && (
            <div className="iv-drill-list">
              {drillEvents.map((e, i) => (
                <div className="iv-drill-item" key={`${e.company}-${e.date}-${i}`}>
                  <span className="iv-drill-date">{e.date || '—'}</span>
                  <span className="iv-drill-main">
                    <b>{e.company}</b>
                    <span className="iv-drill-sub">
                      {[e.round, e.region, e.investors].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="iv-drill-amount">{amountText(e)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <ChartSourceBar
          source={meta.sourceShort}
          asOf={meta.asOf}
          caliber="赛道 × 轮次逐条归集"
          status="派生·非实时"
        />
      </Card>

      <div className="portal-grid iv-split-2 iv-mt">
        <Card>
          <SectionTitle title="赛道分布" subtitle="按当前事件实时归集：事件数与披露金额" />
          {heat.segments.length > 0
            ? <SegmentChart segments={heat.segments} />
            : <EmptyState text="暂无赛道数据" hint="融资事件缺少 segment 字段时无法归集赛道" />}
          <ChartSourceBar
            source={meta.sourceShort}
            asOf={meta.asOf}
            caliber="按事件 segment 实时归集"
          />
        </Card>
        <Card>
          <SectionTitle title="轮次分布" subtitle="按融资阶段排序的披露金额" />
          {heat.rounds.length > 0
            ? <RoundChart rounds={heat.rounds} />
            : <EmptyState text="暂无轮次数据" hint="融资事件缺少 round 字段时无法归集轮次" />}
          <ChartSourceBar
            source={meta.sourceShort}
            asOf={meta.asOf}
            caliber="按融资阶段归集"
          />
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <SectionTitle
          title="行业融资时序"
          subtitle={`全国商业航天融资事件数与披露金额（${financing.years?.[0] || '—'}–${financing.years?.[financing.years.length - 1] || '—'}）`}
          actions={<span className="iv-note">口径：{financing.source || SOURCE_FALLBACK}</span>}
        />
        {financing.years?.length
          ? <FinancingTrend financing={financing} />
          : <EmptyState text="暂无融资时序数据" />}
        {Array.isArray(selectDataset(data, 'industry').financingNotes) && (
          <ul className="iv-note iv-note-list" style={{ marginTop: 14 }}>
            {selectDataset(data, 'industry').financingNotes.map((n, i) => (
              <li key={i}>
                <b>{n.year} 年 · {n.event}</b>（影响：{n.impact}）：{n.note}
              </li>
            ))}
          </ul>
        )}
        <ChartSourceBar
          source="发展大会年度时序 · 二手"
          asOf={meta.asOf}
          caliber="年度时序，非逐条归集口径"
          status="二手·需核实原文"
          tone="amber"
        />
      </Card>

      {structure && (
        <Card style={{ marginTop: 16 }}>
          <SectionTitle
            title="2025 发展大会口径（参考）"
            subtitle={structure.source || '第三届商业航天发展大会报告'}
            actions={<span className="iv-note">与本页实时口径分别呈现，不可相加或直接对比</span>}
          />
          <div className="iv-cali-grid">
            {(structure.categories || []).map((c, i) => (
              <div className="iv-cali-item" key={c}>
                <div className="iv-cali-label">{c}</div>
                <div className="iv-cali-value">
                  {(structure.amounts?.[i] ?? 0).toFixed(1)}<small>亿元</small>
                </div>
              </div>
            ))}
          </div>
          <p className="iv-note" style={{ marginTop: 12 }}>
            <strong>为什么两张表不能相加：</strong>上方矩阵按「单条事件 → 赛道」逐条归集，
            含 2026 年披露；本卡为 2025 年发展大会按「大类赛道」的汇总口径，
            统计边界与颗粒度均不同。需要引用时请二选一并标注口径。
          </p>
          <ChartSourceBar
            source="发展大会报告 · 二手"
            asOf="2025 年大会报告（指定时点快照）"
            caliber="大会大类汇总，不可相加"
            status="二手·需核实原文"
            tone="amber"
          />
        </Card>
      )}
    </div>
  );
}

/* ============================================================
   页签二：企业画像
   ============================================================ */
function CompaniesTab({ companies, segments, watch, onToggleWatch, meta, requireConfirm }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState('rounds');
  const [segment, setSegment] = useState('全部');
  const [onlyWatched, setOnlyWatched] = useState(false);

  const watched = useMemo(
    () => companies.filter((c) => watch.includes(c.name)),
    [companies, watch],
  );

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    const hit = (c) => {
      if (onlyWatched && !watch.includes(c.name)) return false;
      if (segment !== '全部' && !c.segments.includes(segment)) return false;
      if (!kw) return true;
      return c.name.toLowerCase().includes(kw)
        || c.investors.some((i) => String(i).toLowerCase().includes(kw));
    };
    const sorters = {
      rounds: (a, b) => b.rounds - a.rounds || b.cumYi - a.cumYi,
      cum: (a, b) => b.cumYi - a.cumYi || b.rounds - a.rounds,
      recent: (a, b) => String(b.lastDate || '').localeCompare(String(a.lastDate || '')) || b.rounds - a.rounds,
      name: (a, b) => String(a.name).localeCompare(String(b.name), 'zh'),
    };
    return companies.filter(hit).sort(sorters[sortBy] || sorters.rounds);
  }, [companies, keyword, sortBy, segment, onlyWatched, watch]);

  const toggleExpand = useCallback((name) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const resetFilters = () => {
    setKeyword('');
    setSortBy('rounds');
    setSegment('全部');
    setOnlyWatched(false);
  };

  /* 导出：当前筛选后的全部企业（不只自选关注） */
  const companyRows = filtered.map((c) => [
    c.name,
    c.rounds,
    c.lastRound,
    c.lastDate,
    lastAmountText(c),
    c.cumYi.toFixed(2),
    c.segments.join('、'),
    c.region || '—',
    c.chain ? `${c.chain.stage} · ${c.chain.category}` : '—',
    c.investors.join('、'),
  ]);

  if (companies.length === 0) {
    return (
      <Card>
        <EmptyState
          text="暂无企业画像"
          hint="画像由 financingEvents 按企业聚合生成，底层无融资事件时此处为空。"
        />
      </Card>
    );
  }

  return (
    <div>
      <p className="iv-tab-note">
        画像由融资事件按主体聚合：累计披露金额为各轮可归一金额之和（保守口径）；
        投资方为原文顿号分隔拆分。「产业链定位」来自<Link to="/chain">产业链企业矩阵</Link>的精确匹配，
        未匹配到不代表企业不在矩阵中。点击 ☆ 加入自选关注，保存在本地浏览器，无需登录。
      </p>

      {watched.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <SectionTitle
            title={`自选关注（${watched.length}）`}
            subtitle="关注列表仅保存在本机浏览器；可导出为 CSV 跟进"
            actions={(
              <ExportBar
                guard={requireConfirm}
                filename="自选关注企业"
                csv={{
                  headers: ['企业', '融资轮次', '最近轮次', '最近披露', '最近金额', '累计披露(亿元)', '赛道', '地区'],
                  rows: watched.map((c) => [
                    c.name, c.rounds, c.lastRound, c.lastDate,
                    lastAmountText(c), c.cumYi.toFixed(2), c.segments.join('、'), c.region || '—',
                  ]),
                  source: '中国商业航天产业分析平台 /investors',
                  caliber: '自选关注列表，累计金额为各轮可归一披露金额之和（保守口径）',
                }}
              />
            )}
          />
          <div className="iv-watch">
            {watched.map((c) => (
              <span className="iv-watch-chip" key={c.name}>
                <b>{c.name}</b>
                <span className="iv-watch-meta">
                  {c.lastRound} · {c.lastDate}
                  {c.lastAmountYi != null ? ` · ${c.lastAmountYi.toFixed(1)}亿` : ''}
                </span>
                <button
                  type="button"
                  className="iv-watch-remove"
                  title="取消关注"
                  aria-label={`取消关注 ${c.name}`}
                  onClick={() => onToggleWatch(c.name)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: 16 }}>
        <div className="iv-toolbar">
          <div className="iv-search">
            <Icon name="search" size={15} />
            <input
              type="search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索企业或投资方"
              aria-label="搜索企业或投资方"
            />
            {keyword && (
              <button type="button" className="iv-search-clear" onClick={() => setKeyword('')} aria-label="清空搜索">
                ×
              </button>
            )}
          </div>

          <label className="iv-field">
            <span className="iv-field-label">排序</span>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="企业排序方式">
              {SORT_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="iv-field">
            <span className="iv-field-label">赛道</span>
            <select value={segment} onChange={(e) => setSegment(e.target.value)} aria-label="按赛道筛选">
              <option value="全部">全部赛道</option>
              {segments.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          <label className="iv-check">
            <input
              type="checkbox"
              checked={onlyWatched}
              onChange={(e) => setOnlyWatched(e.target.checked)}
            />
            仅看已关注
          </label>

          <div className="iv-toolbar-tail">
            <span className="iv-note">命中 {filtered.length} / {companies.length} 家</span>
            {(keyword || segment !== '全部' || onlyWatched || sortBy !== 'rounds') && (
              <button type="button" className="iv-drill-clear" onClick={resetFilters}>重置</button>
            )}
            <ExportBar
              guard={requireConfirm}
              filename="商业航天企业融资画像"
              csv={{
                headers: ['企业', '融资轮次', '最近轮次', '最近披露', '最近金额', '累计披露(亿元)', '赛道', '地区', '产业链定位', '投资方'],
                rows: companyRows,
                source: '中国商业航天产业分析平台 /investors',
                caliber: '企业画像由融资事件实时聚合；累计金额为各轮可归一披露金额之和（保守口径）',
              }}
              jsonData={filtered.map((c) => ({
                企业: c.name,
                融资轮次: c.rounds,
                最近轮次: c.lastRound,
                最近披露: c.lastDate,
                最近金额: lastAmountText(c),
                累计披露亿元: Number(c.cumYi.toFixed(2)),
                赛道: c.segments,
                地区: c.region || null,
                产业链定位: c.chain ? `${c.chain.stage} · ${c.chain.category}` : null,
                投资方: c.investors,
              }))}
            />
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <NoRecommendationEmpty hint="试试清空搜索关键词，或把赛道切回「全部赛道」。" />
        </Card>
      ) : (
        <div className="iv-cmp-grid">
          {filtered.map((c) => {
            const isOpen = expanded.has(c.name);
            const isWatched = watch.includes(c.name);
            return (
              <div
                className={`iv-cmp ${isWatched ? 'iv-cmp-watched' : ''}`}
                id={companyAnchorId(c.name)}
                tabIndex={-1}
                key={c.name}
              >
                <div className="iv-cmp-head">
                  <div>
                    <h3 className="iv-cmp-name">{c.name}</h3>
                    <div className="iv-cmp-badges">
                      <span className="iv-cmp-badge iv-cmp-badge-rounds">{c.rounds} 轮</span>
                      {c.segments.map((s) => (
                        <span className="iv-cmp-badge" key={s}>{s}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`iv-cmp-star ${isWatched ? 'iv-cmp-star-on' : ''}`}
                    aria-pressed={isWatched}
                    onClick={() => onToggleWatch(c.name)}
                  >
                    {isWatched ? '★ 已关注' : '☆ 关注'}
                  </button>
                </div>

                <div className="iv-cmp-kv">
                  <div>
                    <span className="iv-cmp-kv-label">最近轮次</span>
                    <span className="iv-cmp-kv-value">{c.lastRound}</span>
                  </div>
                  <div>
                    <span className="iv-cmp-kv-label">披露时间</span>
                    <span className="iv-cmp-kv-value">{c.lastDate}</span>
                  </div>
                  <div>
                    <span className="iv-cmp-kv-label">最近金额</span>
                    <span className="iv-cmp-kv-value" title={lastAmountText(c)}>{lastAmountText(c)}</span>
                  </div>
                </div>

                <p className="iv-note" style={{ marginTop: 10 }}>
                  累计披露 <b style={{ color: 'var(--text-primary)' }}>{c.cumYi.toFixed(2)} 亿元</b>
                  （{c.amtCount}/{c.rounds} 轮金额可归一）
                </p>

                {c.chain && (
                  <p className="iv-cmp-chain">
                    产业链定位：{c.chain.stage} · {c.chain.category}
                    {c.chain.region ? ` · ${c.chain.region}` : ''}
                  </p>
                )}

                {c.investors.length > 0 && (
                  <div className="iv-cmp-inv">
                    {c.investors.slice(0, 5).map((inv) => (
                      <span className="iv-inv-tag" key={inv}>{inv}</span>
                    ))}
                    {c.investors.length > 5 && (
                      <span className="iv-inv-more">等 {c.investors.length} 家</span>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="iv-cmp-toggle"
                  aria-expanded={isOpen}
                  onClick={() => toggleExpand(c.name)}
                >
                  <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={14} />
                  {isOpen ? '收起融资历史' : `展开融资历史（${c.rounds} 轮）`}
                </button>

                {isOpen && (
                  <div className="iv-cmp-events">
                    {c.events.map((e, i) => (
                      <div className="iv-cmp-event" key={`${e.date}-${i}`}>
                        <span className="iv-cmp-event-date">{e.date || '—'}</span>
                        <span>
                          {e.round}
                          {e.investors ? ` · ${e.investors}` : ''}
                        </span>
                        <span className="iv-cmp-event-amount">{e.amount || '未披露'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {/* 即使筛选结果为空也保留来源条：来源不可用只隐藏数值，不隐藏口径 */}
      <ChartSourceBar
        className="iv-cmp-source"
        source={meta.sourceShort}
        asOf={meta.asOf}
        caliber="画像实时聚合，累计为可归一金额之和"
      />
    </div>
  );
}

/* ============================================================
   页签三：催化剂日历
   ============================================================ */
function CatalystsTab({ catalysts, meta }) {
  const { policies, devRockets, flown, gaps, bands } = catalysts;

  const levelClass = (lv) => (lv === '国家级' ? 'iv-tl-level-national'
    : lv === '部委级' ? 'iv-tl-level-ministerial' : 'iv-tl-level-local');

  return (
    <div>
      <p className="iv-tab-note">
        催化剂日历把三类信号放在同一页：<b>政策动向</b>（近两年）、<b>在研火箭型号</b>（尚未首飞）
        与<b>星座部署缺口</b>。政策与星座为已发生事实的排列；在研火箭的首飞时间以官方披露为准，
        平台数据未收录预计首飞时间，本页不做预测。
      </p>

      <div className="portal-grid iv-split-2">
        <Card>
          <SectionTitle
            title="政策动向"
            subtitle="2024 年以来发布的国家级 / 部委级 / 地方级政策"
            actions={<Link to="/policy">完整政策清单 →</Link>}
          />
          {policies.length === 0 ? (
            <EmptyState text="暂无 2024 年以来的政策" hint="可前往政策法规页查看完整清单" />
          ) : (
            <div className="iv-timeline">
              {policies.map((p) => (
                <div className={`iv-tl-item ${String(p.date || '') >= '2025' ? 'iv-tl-item-recent' : ''}`} key={p.id || p.title}>
                  <span className="iv-tl-date">{p.date || '—'}</span>
                  <h4 className="iv-tl-title">{p.title}</h4>
                  {p.summary && <p className="iv-tl-summary">{p.summary}</p>}
                  <div className="iv-tl-meta">
                    <span className={`iv-tl-level ${levelClass(p._level)}`}>{p._level}</span>
                    <span>{p.org}</span>
                    {p.type && <span>· {p.type}</span>}
                    {p.source && <SourceTag item={{ source: p.source }} compact />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="iv-stack">
          <Card>
            <SectionTitle
              title="在研火箭型号"
              subtitle={`${devRockets.length} 个型号尚未首飞，无发射成功率记录`}
              actions={<Link to="/rockets">火箭型谱 →</Link>}
            />
            {devRockets.length === 0 ? (
              <EmptyState text="暂无在研型号记录" hint="所有收录型号均已有发射记录" />
            ) : (
              <div className="iv-rocket-grid">
                {devRockets.map((r) => (
                  <div className="iv-rocket" key={r.name}>
                    <div className="iv-rocket-name">{r.name}</div>
                    <div className="iv-rocket-org">{r.org || '—'}</div>
                    <div className="iv-rocket-leo">
                      LEO 运力 <b>{r.leo != null ? `${r.leo} 吨` : '未披露'}</b>
                    </div>
                    <div className="iv-rocket-status">状态：{r.status || '在研'} · 首飞时间待官方披露</div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle
              title="发射可靠性"
              subtitle={`${flown.length} 个有发射记录型号的成功率分布`}
              actions={<Link to="/rockets">查看明细 →</Link>}
            />
            {flown.length === 0 ? (
              <EmptyState text="暂无发射成功率数据" hint="successRate 字段为空时无法分档" />
            ) : (
              <>
                <div className="iv-dist">
                  {[
                    { label: '≥ 95%', value: bands.high, cls: 'iv-dist-fill-high' },
                    { label: '80–95%', value: bands.mid, cls: 'iv-dist-fill-mid' },
                    { label: '< 80%', value: bands.low, cls: 'iv-dist-fill-low' },
                  ].map((b) => (
                    <div className="iv-dist-row" key={b.label}>
                      <span className="iv-dist-label">{b.label}</span>
                      <span className="iv-dist-track">
                        <span
                          className={`iv-dist-fill ${b.cls}`}
                          style={{ width: `${(b.value / flown.length) * 100}%` }}
                        />
                      </span>
                      <span className="iv-dist-val">{b.value}</span>
                    </div>
                  ))}
                </div>
                <p className="iv-note" style={{ marginTop: 12 }}>
                  另有 {devRockets.length} 个在研型号未首飞，不计入成功率统计。
                  成功率按型号累计发射结果计算，个体型号差异较大，投资尽调建议下钻至单型号。
                </p>
              </>
            )}
          </Card>
        </div>
      </div>

      <Card style={{ marginTop: 16 }}>
        <SectionTitle
          title="星座部署缺口"
          subtitle="组网中星座的已部署 / 规划规模（按缺口降序，前 8）"
          actions={<Link to="/constellation">星座计划 →</Link>}
        />
        {gaps.length === 0 ? (
          <EmptyState text="暂无组网中星座的部署缺口" hint="需要 status 为「组网中」且规划/在轨数量齐全" />
        ) : (
          <>
            <ConstellationGap items={gaps} />
            <p className="iv-note" style={{ marginTop: 12 }}>
              缺口越大，后续发射与终端需求的空间越大，但同时取决于星座主体的融资与发射节奏。
              StarLink 与国内星座规划量级差近两个数量级，横向比较时请注意分母差异。
            </p>
          </>
        )}
      </Card>

      {/* 催化剂区块跨三个数据集，来源条逐项列出分文件数据时间，
          不用会被最大值掩盖的聚合 lastUpdated */}
      <ChartSourceBar
        className="iv-catalyst-source"
        source="政策法规 / 火箭型谱 / 星座计划（公开信息整理）"
        asOf={`政策 ${meta.fileUpdatedAt.policy || '--'} · 火箭 ${meta.fileUpdatedAt.rockets || '--'} · 星座 ${meta.fileUpdatedAt.constellations || '--'}`}
        caliber="政策 >=2024；在研型号 = successRate 为空；缺口 = 规划 − 在轨"
        status="多数据集·静态快照"
        tone="neutral"
      />
    </div>
  );
}

/* ============================================================
   页签四：事件流水
   ============================================================ */
function StreamTab({ evRows, sourceText, meta, requireConfirm }) {
  const columns = [
    { key: 'date', label: '披露时间' },
    { key: 'company', label: '企业' },
    { key: 'round', label: '轮次' },
    {
      key: '_amountYi',
      label: '金额(亿元)',
      render: (r) => (r._amountYi == null ? (r.amount || '未披露') : r._amountYi.toFixed(2)),
    },
    { key: 'segment', label: '赛道' },
    { key: 'region', label: '地区' },
    { key: 'investors', label: '投资方' },
    {
      key: '_verify',
      label: '原文核实',
      render: (r) => (r.sourceUrl
        ? <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer"><StatusBadge tone="info">已核实</StatusBadge></a>
        : <StatusBadge tone="amber">待核实</StatusBadge>),
    },
  ];

  return (
    <div>
      <p className="iv-tab-note">
        融资事件单条明细，支持按赛道 / 轮次 / 年份筛选与全列排序。
        金额列为归一化数值（亿元，保守口径），筛选后导出的 CSV 与数据与溯源同一规范
        （带来源与口径 meta 行）。「原文核实」列标 <b>待核实</b> 的条目尚未收录公开原文链接，
        该状态会随导出 meta 一并带出，请勿将此类条目视为已逐条查证。
      </p>
      <Card>
        <SectionTitle
          title="融资事件流水"
          subtitle={`共 ${evRows.length} 起，按披露时间倒序`}
          actions={<span className="iv-note">数据来源：{sourceText}</span>}
        />
        {evRows.length === 0 ? (
          <EmptyState text="暂无融资事件明细" hint="底层 financingEvents 为空" />
        ) : (
          <DataTable
            key={evRows.length}
            data={evRows}
            columns={columns}
            filename="商业航天融资事件"
            pageSize={12}
            filters={[
              { key: 'segment', label: '赛道' },
              { key: 'round', label: '轮次' },
              { key: '_year', label: '年份' },
            ]}
            defaultSort={{ key: 'date', dir: 'desc' }}
            exportGuard={requireConfirm}
            exportMeta={{ source: sourceText, caliber: FINANCING_CALIBER }}
          />
        )}
        <ChartSourceBar
          source={meta.sourceShort}
          asOf={meta.asOf}
          caliber="单条明细，金额保守归一"
          status="非实时快照"
        />
      </Card>
    </div>
  );
}

/* ============================================================
   主组件
   ============================================================ */
function Investors() {
  const data = useData();
  /* 导出动作守卫：所有 CSV / JSON 导出前强制勾选免责声明 */
  const { requireConfirm, modal } = useDisclaimerGuard();
  const location = useLocation();
  const navigate = useNavigate();
  const tabRefs = useRef({});

  /* 页签状态放在 URL hash 上：可深链、可分享、浏览器前进后退可回退 */
  const activeTab = useMemo(() => {
    const hash = location.hash || '';
    /* #cmp-<编码企业名> 是企业卡片深链，落在「企业画像」页签；
       滚动定位由下方 effect 完成，hash 本身刻意不做元素 id 交由 tab 体系处理 */
    if (hash.startsWith('#cmp-')) return 'companies';
    const key = hash.replace('#tab-', '');
    return TABS.some((t) => t.key === key) ? key : DEFAULT_TAB;
  }, [location.hash]);

  const goTab = useCallback((key) => {
    navigate(`${location.pathname}#${tabHash(key)}`, { replace: true });
    tabRefs.current[key]?.focus({ preventScroll: true });
  }, [location.pathname, navigate]);

  /* 页签键盘导航：← → 切换，Home / End 跳首尾 */
  const onTabKeyDown = (e) => {
    const idx = TABS.findIndex((t) => t.key === activeTab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
      goTab(TABS[next].key);
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTab(TABS[0].key);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTab(TABS[TABS.length - 1].key);
    }
  };

  const [watch, setWatch] = useState(() => {
    try {
      const raw = localStorage.getItem(WATCH_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(WATCH_KEY, JSON.stringify(watch));
    } catch {
      /* 隐私模式等场景下写入失败可忽略，不影响页面功能 */
    }
  }, [watch]);

  const evRows = useMemo(() => prepareEvents(data), [data]);
  const heat = useMemo(() => buildHeat(evRows), [evRows]);
  const chainMap = useMemo(() => buildChainMap(data), [data]);
  const companies = useMemo(() => buildCompanies(data, chainMap), [data, chainMap]);

  /* 企业卡片深链兜底：RouteScrollHandler 的重试窗口为 12×60ms=720ms，
     冷启动首次加载懒加载分块 + 数据时可能更久。这里延长等待，找到卡片后
     滚动并聚焦。两处处理器都按 offsetTop-88 定位到同一元素，目标一致不打架。 */
  useEffect(() => {
    const hash = location.hash || '';
    if (!hash.startsWith('#cmp-')) return undefined;
    let tries = 0;
    let timer = null;
    let cancelled = false;
    const absoluteTop = (el) => {
      let top = 0;
      let node = el;
      while (node) { top += node.offsetTop; node = node.offsetParent; }
      return top;
    };
    const focusCard = () => {
      if (cancelled) return;
      const el = document.getElementById(hash.slice(1));
      if (el) {
        window.scrollTo({ top: Math.max(0, absoluteTop(el) - 88), behavior: 'smooth' });
        el.focus({ preventScroll: true });
        return;
      }
      tries += 1;
      if (tries < 30) timer = setTimeout(focusCard, 100);
    };
    focusCard();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [location.hash, companies]);

  const catalysts = useMemo(() => buildCatalysts(data), [data]);
  const stats = useMemo(() => buildStats(evRows, companies), [evRows, companies]);

  /* 企业画像的赛道筛选项：来自聚合结果，保证与卡片一致 */
  const segments = useMemo(
    () => [...new Set(companies.flatMap((c) => c.segments))].sort((a, b) => a.localeCompare(b, 'zh')),
    [companies],
  );

  const financing = selectDataset(data, 'industry').financingData || { years: [], events: [], amounts: [] };
  const lastYearIdx = financing.years.length - 1;
  const trendYear = financing.years[lastYearIdx] || null;
  const industrySource = financing.source || SOURCE_FALLBACK;

  /* 合规元数据单一真源：数据时间取分文件值，不用会被最大值掩盖的聚合 lastUpdated */
  const meta = useMemo(() => ({
    source: industrySource,
    sourceShort: SOURCE_SHORT,
    asOf: data.fileUpdatedAt?.industry || data.lastUpdated || '--',
    siteAsOf: data.lastUpdated || '--',
    caliber: FINANCING_CALIBER,
    caliberShort: FINANCING_CALIBER_SHORT,
    fileUpdatedAt: data.fileUpdatedAt || {},
  }), [industrySource, data]);

  const toggleWatch = useCallback((name) => setWatch((w) => (
    w.includes(name) ? w.filter((x) => x !== name) : [...w, name]
  )), []);

  /* ---- 注册全局搜索：让「/」能搜到企业与融资事件 ----
     同一 category 重复注册会先清旧再写入，路由切换不会越积越多；
     企业命中后直达具体卡片（#cmp-<编码企业名>，自动切到「企业画像」页签并滚动聚焦），
     融资事件命中后直达事件流水页签（#tab-stream）。 */
  useEffect(() => {
    registerSearchData('企业', companies.map((c) => ({
      id: `cmp-${c.name}`,
      title: c.name,
      keywords: `${c.segments.join(' ')} ${c.region || ''} ${c.investors.join(' ')}`,
      path: `/investors#${companyAnchorId(c.name)}`,
    })));
    registerSearchData('融资事件', evRows.map((e, i) => ({
      id: `evt-${e.company}-${e.date}-${i}`,
      title: `${e.company} ${e.round || ''}`,
      keywords: `${e.company} ${e.segment || ''} ${e.investors || ''} ${e.date || ''}`,
      path: '/investors#tab-stream',
    })));
  }, [companies, evRows]);

  /* 页签右上角计数：让导航入口自带信息量 */
  const tabCounts = {
    heat: `${stats.events} 起`,
    companies: `${companies.length} 家`,
    catalysts: `${catalysts.policies.length} 条`,
    stream: `${stats.events} 起`,
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'companies':
        return (
          <CompaniesTab
            companies={companies}
            segments={segments}
            watch={watch}
            onToggleWatch={toggleWatch}
            meta={meta}
            requireConfirm={requireConfirm}
          />
        );
      case 'catalysts':
        return <CatalystsTab catalysts={catalysts} meta={meta} />;
      case 'stream':
        return (
          <StreamTab
            evRows={evRows}
            sourceText={industrySource}
            meta={meta}
            requireConfirm={requireConfirm}
          />
        );
      default:
        return <HeatTab data={data} evRows={evRows} heat={heat} meta={meta} />;
    }
  };

  return (
    <div className="page-container iv-page">
      <RiskBanner />

      {/* 首屏（设计文档 §7.4）：风险条 → 定位标题 → 状态条 → 带来源条的指标卡 → 入口组 */}
      <section className="page-header">
        <p className="cp-kicker">研究参考 · 投资者教育 · 数据驱动</p>
        <h1 className="page-title">投资分析工具</h1>
        <p className="page-desc">
          先查证、再判断。本页把赛道热度、企业融资画像、催化剂日历与事件流水组织成可核对的研究底稿；
          查看统计卡片的时间与口径，在数据与溯源页核对已记录的来源和明细。
        </p>
        <div className="iv-statusbar">
          <StatusBadge tone="neutral">非实时快照</StatusBadge>
          <span>投融资数据更新于 <b>{meta.asOf}</b></span>
          <span className="iv-statusbar-note">
            全站聚合徽标 {meta.siteAsOf} 取各文件最大值，会掩盖个别数据集陈旧
          </span>
          <Link to="/compliance#tab-sources">口径说明 →</Link>
        </div>
        <p className="iv-head-extra">
          需要核实字段或导出原始数据？<Link to="/research">前往数据与溯源 →</Link>
          <span className="iv-head-sep">·</span>
          {COMPLIANCE.notice}
          <span className="iv-head-sep">·</span>
          <Link to="/analysis">投融资数据页 →</Link>
        </p>
      </section>

      {/* 指标卡：每张卡自带 32px 来源条。
          Grid 组件会把列数写成内联样式，媒体查询覆盖不了，
          因此这里直接用 portal-grid 类 + 本页的 iv-stat-grid 断点 */}
      <div className="portal-grid iv-stat-grid">
        <MetricCard
          label="收录融资事件"
          value={formatNumber(stats.events)}
          unit="起"
          sub={`覆盖 ${stats.companyCount} 家企业 · 最新披露 ${stats.latest}`}
          icon="coins"
          source={meta.sourceShort}
          asOf={meta.asOf}
          caliber="融资事件逐条计数"
        />
        <MetricCard
          label="可归一披露金额"
          value={stats.totalYi.toFixed(1)}
          unit="亿元"
          sub={`${stats.parseableCount} / ${stats.events} 条金额可解析`}
          icon="trend-up"
          source={meta.sourceShort}
          asOf={meta.asOf}
          caliber={FINANCING_CALIBER_SHORT}
        />
        <MetricCard
          label="头部集中度"
          value={stats.totalYi > 0 ? `${(stats.top5Share * 100).toFixed(0)}%` : '—'}
          sub="前 5 家企业金额占比 · 统计描述，非推荐名单"
          icon="target"
          source={meta.sourceShort}
          asOf={meta.asOf}
          caliber="Top5 占比，非推荐名单"
        />
        <MetricCard
          label={trendYear ? `${trendYear} 年行业口径` : '行业口径'}
          value={financing.years.length ? `${formatNumber(financing.events[lastYearIdx])} 起` : '—'}
          unit={financing.years.length ? `/ ${financing.amounts[lastYearIdx]} 亿元` : ''}
          sub={financing.source ? '第三届商业航天发展大会口径' : '—'}
          icon="flag"
          source="大会报告 · 二手"
          asOf={meta.asOf}
          caliber="大会口径，不可相加"
          status="需核实原文"
          tone="amber"
        />
      </div>

      <ConceptNote />

      <div style={{ marginTop: 28 }} id="iv-main">
        <div className="tab-bar iv-tabs" role="tablist" aria-label="投资分析工具页签" onKeyDown={onTabKeyDown}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`iv-tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`iv-panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              ref={(el) => { tabRefs.current[tab.key] = el; }}
              className={`tab-btn ${activeTab === tab.key ? 'tab-active' : ''}`}
              onClick={() => goTab(tab.key)}
            >
              <Icon name={tab.icon} size={16} />
              <span className="iv-tab-label">{tab.label}</span>
              <span className="iv-tab-count">{tabCounts[tab.key]}</span>
            </button>
          ))}
        </div>

        <div
          id={`iv-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`iv-tab-${activeTab}`}
          tabIndex={-1}
        >
          <InvestorErrorBoundary key={activeTab}>
            {renderTab()}
          </InvestorErrorBoundary>
        </div>
      </div>

      <RelatedLinks />
      {modal}
    </div>
  );
}

export default Investors;

