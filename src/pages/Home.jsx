import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import * as echarts from 'echarts';
import { useData } from '../context/DataContext';
import Icon from '../components/Icon';
import FreshnessBadge from '../components/FreshnessBadge';
import { KeyFactsGrid, InsightsGrid, CasesGrid } from '../components/ReportBlocks';
import { buildToolbox } from '../utils/chartTools';
import { parseTicker } from '../utils/ticker';

/* ============================================================
   首页 —— 未来天玑式门户版式
   ------------------------------------------------------------
   板块顺序：Hero → 数据总览 → 实时动态 → 商业航天指数 → 角色入口 →
   数据栏目矩阵 → 年度实绩 → 趋势解读 → 市场规模 → 典型案例 →
   里程碑 → 研究报告 → 关于我们

   数据来源（全部走 useData()，不单独 fetch）：
     dashboard.dashboardMetrics  数据总览指标（直接映射，改 JSON 的 label 即生效）
     dashboard.newsTicker        实时动态快讯（parseTicker 拆「来源：正文」）
     dashboard.milestones        发展里程碑
     chain.keyFacts2025          年度实绩
     chain.trendInsights2025     趋势解读
     chain.caseStudies           典型案例
     industry.marketSizeData     市场规模趋势图

   组件清单（顺序即渲染顺序）：
     PortalStats / NewsPanel / IndexTeaser / ChainCards / RoleEntry /
     MarketSizeChart（echarts）/ Timeline / ReportsStrip / AboutSection

   注意：KeyFactsGrid / InsightsGrid / CasesGrid 三个共享渲染块在
   components/ReportBlocks.jsx，首页与研究报告页共用，
   改它们的样式会同时影响两页。
   ============================================================ */

const THEME = {
  coldBlue: '#2563eb',
  textMain: '#0f172a',
  textSub: '#475569',
  gridLine: 'rgba(148, 163, 184, 0.15)',
};

const chainLinkMap = {
  capital: '/analysis',
  industry: '/chain',
  rocket: '/rockets',
  policy: '/policy',
  satellite: '/constellation',
};

/* ---------- 数据总览统计条（未来天玑式计数板） ---------- */
function PortalStats({ dashboardMetrics, rocketCount, constellationCount }) {
  const stats = [
    ...dashboardMetrics.map((m) => ({ label: m.label, value: m.value, unit: m.unit, sub: m.sub })),
    { label: '在册火箭型号', value: rocketCount, unit: '型', sub: '含在研与已首飞型号' },
    { label: '卫星星座', value: constellationCount, unit: '个', sub: '全球主要星座计划' },
  ];

  return (
    <div className="portal-stats">
      {stats.map((s) => (
        <div className="portal-stat" key={s.label}>
          <div className="portal-stat-value">
            {s.value}<span className="portal-stat-unit">{s.unit}</span>
          </div>
          <div className="portal-stat-label">{s.label}</div>
          <div className="portal-stat-sub">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

/* ---------- 实时动态 ---------- */
function NewsPanel({ newsTicker, milestones }) {
  const items = (newsTicker || []).map(parseTicker);
  const recentMilestones = [...(milestones || [])].reverse().slice(0, 4);

  return (
    <div className="portal-news-grid">
      <div className="portal-news-list">
        {items.map((item, idx) => (
          <div className="portal-news-item" key={`${item.source}-${idx}`}>
            {item.source && <span className="portal-news-source">{item.source}</span>}
            <p className="portal-news-text">{item.text}</p>
          </div>
        ))}
      </div>
      <aside className="portal-news-side">
        <div className="portal-news-side-title">
          <Icon name="refresh" size="sm" />数据更新
        </div>
        <FreshnessBadge fileKey="dashboard" />
        <div className="portal-news-side-title">
          <Icon name="flag" size="sm" />发展里程碑
        </div>
        <ul className="portal-news-milestones">
          {recentMilestones.map((m) => (
            <li key={m.year}><b>{m.year}</b><span>{m.text}</span></li>
          ))}
        </ul>
        <Link to="/news" className="portal-news-side-link">查看全部资讯 →</Link>
      </aside>
    </div>
  );
}

/* ---------- 商业航天指数 teaser ---------- */
function IndexTeaser({ keyFacts }) {
  const facts = (keyFacts?.facts || []).slice(0, 4);

  return (
    <div className="idx-teaser">
      <div>
        <span className="idx-teaser-tag">
          <Icon name="trend-up" size="sm" />商业航天指数
        </span>
        <h3 className="idx-teaser-title">四维分项，跟踪行业曲线</h3>
        <p className="idx-teaser-desc">
          市场规模、发射活动、资本热度、产业主体——全部指标取自平台既有数据集，
          口径逐条标注，不做加权合成。完整指数页包含双轴趋势、融资结构、轮次与赛道分布。
        </p>
        <Link to="/index" className="dash-btn dash-btn-primary">查看完整指数</Link>
      </div>
      <div className="idx-teaser-facts">
        {facts.map((f) => (
          <div className="idx-teaser-fact" key={f.label}>
            <div className="idx-teaser-fact-value">{f.value}<small>{f.unit}</small></div>
            <div className="idx-teaser-fact-label">{f.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 五链数据卡片 ---------- */
function ChainCards({ chainList }) {
  return (
    <div className="dash-chain-row">
      {chainList.map((chain) => (
        <Link
          key={chain.key}
          to={chainLinkMap[chain.key] || '#'}
          className="dash-chain-card"
          style={{ '--chain-color': chain.color }}
        >
          <div className="dash-chain-card-top">
            <span className="dash-chain-name">{chain.name}</span>
            <span className="dash-chain-icon"><Icon name={chain.icon} size="lg" /></span>
          </div>
          <div className="dash-chain-metric">
            {chain.metrics[0].value}
            <span className="dash-chain-unit">{chain.metrics[0].unit}</span>
          </div>
          <div className="dash-chain-metric-label">{chain.metrics[0].label}</div>
          <p className="dash-chain-desc">{chain.desc}</p>
        </Link>
      ))}
    </div>
  );
}

/* ---------- 角色入口分拣卡（首访用户按意图进入） ---------- */
function RoleEntry() {
  const roles = [
    {
      to: '/investors',
      tag: '我是投资人',
      title: '投资人门户',
      desc: '赛道热度、企业融资画像与催化剂日历，一页完成从「听到风声」到「形成初步判断」。',
      points: ['赛道 × 轮次热力矩阵（可下钻）', '企业融资画像与自选关注', '政策 / 在研火箭 / 星座缺口催化剂'],
      icon: 'building',
      color: '#f06235',
    },
    {
      to: '/research',
      tag: '我是科研人员',
      title: '科研数据门户',
      desc: '字段口径、原始明细、溯源核查与规范导出，每一个数字可复现、可引用。',
      points: ['字段数据字典与实时缺失率', '五链原始数据统一浏览', 'CSV / JSON / BibTeX 规范导出'],
      icon: 'target',
      color: '#0d8af0',
    },
  ];

  return (
    <div className="portal-role-row">
      {roles.map((r) => (
        <Link key={r.to} to={r.to} className="portal-role-card" style={{ '--role-color': r.color }}>
          <div className="portal-role-top">
            <span className="portal-role-icon"><Icon name={r.icon} size="lg" /></span>
            <span className="portal-role-tag">{r.tag}</span>
          </div>
          <h3 className="portal-role-title">{r.title}</h3>
          <p className="portal-role-desc">{r.desc}</p>
          <ul className="portal-role-points">
            {r.points.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <span className="portal-role-cta">进入{r.title} →</span>
        </Link>
      ))}
    </div>
  );
}

/* ---------- 市场规模趋势 ---------- */
function MarketSizeChart({ marketSizeData }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);
    const predicted = marketSizeData.predictedYears || [];

    const option = {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderColor: 'rgba(37,99,235,0.2)',
        textStyle: { color: THEME.textMain },
        formatter: (params) => {
          const p = params[0];
          const suffix = predicted.includes(p.name) ? '（预测）' : '';
          return `<b>${p.name}年</b><br/>市场规模：${p.value} 万亿元${suffix}`;
        },
      },
      grid: { left: 56, right: 24, top: 32, bottom: 32 },
      xAxis: {
        type: 'category',
        data: marketSizeData.years,
        axisLabel: { color: THEME.textSub, fontSize: 12 },
        axisLine: { lineStyle: { color: THEME.gridLine } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '万亿元',
        nameTextStyle: { color: THEME.textSub, fontSize: 12 },
        axisLabel: { color: THEME.textSub, fontSize: 12 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: THEME.gridLine } },
      },
      series: [{
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: THEME.coldBlue, width: 2.5 },
        itemStyle: { color: THEME.coldBlue, borderColor: '#fff', borderWidth: 2 },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(37, 99, 235, 0.22)' },
            { offset: 1, color: 'rgba(37, 99, 235, 0.02)' },
          ]),
        },
        data: marketSizeData.values,
        markArea: predicted.length ? {
          silent: true,
          itemStyle: { color: 'rgba(245,158,11,0.08)' },
          label: { show: true, position: 'insideTop', color: '#b45309', fontSize: 11, formatter: '预测区间' },
          data: [[{ xAxis: predicted[0] }, { xAxis: predicted[predicted.length - 1] }]],
        } : undefined,
      }],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '商业航天市场规模趋势',
        csv: {
          headers: ['年份', '市场规模(万亿元)', '数据性质'],
          rows: marketSizeData.years.map((y, i) => [y, marketSizeData.values[i], predicted.includes(String(y)) ? '预测' : '实绩']),
          source: marketSizeData.source,
          caliber: '行业研究机构历年测算，2025年取弗若斯特沙利文口径，预测年份已单列标注',
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
    <div className="dash-chart-card">
      <div className="dash-chart-header">
        <h3 className="dash-chart-title">市场规模趋势</h3>
        <span className="dash-chart-source">来源：{marketSizeData.source}</span>
      </div>
      <div ref={chartRef} style={{ width: '100%', height: '420px' }} />
    </div>
  );
}

/* ---------- 关键里程碑 ---------- */
function Timeline({ milestones }) {
  return (
    <div className="dash-timeline-section">
      <div className="dash-section-header">
        <h2 className="dash-section-title">关键里程碑</h2>
        <p className="dash-section-subtitle">2014 — 2025 中国商业航天发展节点</p>
      </div>
      <div className="dash-timeline">
        {milestones.map((item, idx) => (
          <div className="dash-timeline-item" key={idx}>
            <div className="dash-timeline-dot" />
            <div className="dash-timeline-year">{item.year}</div>
            <div className="dash-timeline-text">{item.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 研究报告 strip ---------- */
const REPORT_CARDS = [
  {
    tag: '报告 01',
    title: '2025年度核心实绩',
    desc: '入轨发射、商业发射、入轨商业卫星、存续企业、产业规模与一级市场融资六项年度实绩，逐条标注来源。',
    meta: '国家航天局 · 《中国航天》期刊 · 启信宝等',
    href: '/reports#report-01',
  },
  {
    tag: '报告 02',
    title: '行业趋势解读',
    desc: '发射结构、载荷主体、市场主体与资本流向四维解读，结论均由年度实绩直接推导。',
    meta: '基于上述实绩的专业推导',
    href: '/reports#report-02',
  },
  {
    tag: '报告 03',
    title: '年度典型案例',
    desc: '发射基建、星座组网与运力供给三个维度的关键落地节点。',
    meta: '覆盖 2025 年度代表性事件',
    href: '/reports#report-03',
  },
];

function ReportsStrip() {
  return (
    <div className="rpt-strip">
      {REPORT_CARDS.map((r) => (
        <Link key={r.tag} to={r.href} className="rpt-mini">
          <span className="rpt-mini-tag">{r.tag}</span>
          <span className="rpt-mini-title">{r.title}</span>
          <span className="rpt-mini-desc">{r.desc}</span>
          <span className="rpt-mini-meta">{r.meta}</span>
          <span className="rpt-mini-cta">阅读全文 <Icon name="chevron-down" size="sm" /></span>
        </Link>
      ))}
    </div>
  );
}

/* ---------- 关于我们 ---------- */
function AboutSection() {
  return (
    <div className="portal-about">
      <div className="portal-about-text">
        <p>
          中国商业航天产业数据平台由北京航空航天大学经济管理学院商业航天研究中心建设维护，
          参照未来天玑等专业数据门户的信息架构组织内容，以资金链、产业链、火箭链、政策链、卫星链
          五大维度全景覆盖产业发展。
        </p>
        <p>
          平台面向投资人、科研人员与产业从业者提供差异化入口：投资人可在门户中追踪赛道热度与企业画像，
          科研人员可获取数据字典、原始数据与溯源导出。所有数据每日自动更新，来源缺失的条目一律不入库。
        </p>
      </div>
      <ul className="portal-about-points">
        <li>
          <Icon name="check" size="sm" />
          <div><b>来源强制</b><span>无来源链接的条目会被数据规则脚本丢弃</span></div>
        </li>
        <li>
          <Icon name="check" size="sm" />
          <div><b>口径明示</b><span>每项指标标注统计边界与测算口径</span></div>
        </li>
        <li>
          <Icon name="check" size="sm" />
          <div><b>可导出复现</b><span>CSV / JSON / BibTeX，导出件自带来源与口径</span></div>
        </li>
        <li>
          <Icon name="check" size="sm" />
          <div><b>待核实可见</b><span>未核实条目单独标记，不混入实绩</span></div>
        </li>
      </ul>
    </div>
  );
}

/* ---------- 页面主组件 ---------- */
function Home() {
  const { chain, industry, dashboard, rockets, constellations } = useData();

  const rocketCount = rockets?.list?.length;
  const constellationCount = constellations?.list?.length;

  return (
    <div className="home-b2b">
      {/* Hero */}
      <section className="dash-hero">
        <div className="buaa-credit">
          <img src="/buaa-logo.png" alt="北京航空航天大学" className="buaa-credit-logo" />
          <span className="buaa-credit-text">北京航空航天大学</span>
          <span className="buaa-credit-divider" />
          <span className="buaa-credit-sub">经济管理学院 · 商业航天研究中心</span>
        </div>
        <div className="dash-hero-inner">
          <span className="dash-hero-tag">商业航天产业数据门户</span>
          <h1 className="dash-hero-title">中国商业航天产业数据平台</h1>
          <p className="dash-hero-subtitle">
            聚焦企业、火箭、星座、资本与政策五大维度，以可溯源数据洞察产业发展先机
          </p>
          <div className="dash-hero-actions">
            <Link to="/chain" className="dash-btn dash-btn-primary">进入数据栏目</Link>
            <Link to="/index" className="dash-btn dash-btn-outline">查看商业航天指数</Link>
          </div>
          <FreshnessBadge fileKey="dashboard" />
        </div>
      </section>

      {/* 数据总览 */}
      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">数据总览</h2>
          <p className="dash-section-subtitle">平台收录规模与 2025 年度关键实绩</p>
        </div>
        <PortalStats
          dashboardMetrics={dashboard.dashboardMetrics}
          rocketCount={rocketCount}
          constellationCount={constellationCount}
        />
      </section>

      {/* 实时动态 */}
      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">实时动态</h2>
          <p className="dash-section-subtitle">权威口径快讯与最新发展节点</p>
        </div>
        <NewsPanel newsTicker={dashboard.newsTicker} milestones={dashboard.milestones} />
      </section>

      {/* 商业航天指数 */}
      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">商业航天指数</h2>
          <p className="dash-section-subtitle">市场规模 · 发射活动 · 资本热度 · 产业主体</p>
        </div>
        <IndexTeaser keyFacts={chain.keyFacts2025} />
      </section>

      {/* 角色入口分拣 */}
      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">按需进入</h2>
          <p className="dash-section-subtitle">同一套底层数据，两种任务视角：投资决策辅助与科研可信复现</p>
        </div>
        <RoleEntry />
      </section>

      {/* 数据栏目矩阵 */}
      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">五链数据矩阵</h2>
          <p className="dash-section-subtitle">对应导航「数据栏目」：企业库 / 火箭型谱 / 星座计划 / 投融资 / 政策法规，点击卡片进入</p>
        </div>
        <ChainCards chainList={chain.chainList} />
      </section>

      {/* 2025年度核心实绩 */}
      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">2025年度核心实绩</h2>
          <p className="dash-section-subtitle">核心指标均取自国家航天局、《中国航天》期刊、启信宝、弗若斯特沙利文等权威公开来源，每条数据可点击溯源；预测值一律不纳入</p>
        </div>
        <KeyFactsGrid keyFacts={chain.keyFacts2025} />
      </section>

      {/* 行业趋势解读 */}
      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">行业趋势解读</h2>
          <p className="dash-section-subtitle">基于上述年度实绩的专业解读：发射结构、载荷主体、市场主体与资本流向四个维度</p>
        </div>
        <InsightsGrid data={chain.trendInsights2025} />
      </section>

      {/* 市场趋势 */}
      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">市场规模趋势（2015—2025）</h2>
          <p className="dash-section-subtitle">行业研究机构历年测算，2025年值取弗若斯特沙利文口径</p>
        </div>
        <MarketSizeChart marketSizeData={industry.marketSizeData} />
      </section>

      {/* 年度典型案例 */}
      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">年度典型案例</h2>
          <p className="dash-section-subtitle">从发射基建、星座组网到国家队运力，透视2025年商业航天的关键落地节点</p>
        </div>
        <CasesGrid data={chain.caseStudies} />
      </section>

      {/* 关键里程碑 */}
      <Timeline milestones={dashboard.milestones} />

      {/* 研究报告 */}
      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">研究报告</h2>
          <p className="dash-section-subtitle">系统性分析产业发展现状与趋势，结论可溯源</p>
        </div>
        <ReportsStrip />
      </section>

      {/* 关于我们 */}
      <section className="dash-section">
        <div className="dash-section-header">
          <h2 className="dash-section-title">关于我们</h2>
          <p className="dash-section-subtitle">数据治理原则与平台定位</p>
        </div>
        <AboutSection />
      </section>
    </div>
  );
}

export default Home;
