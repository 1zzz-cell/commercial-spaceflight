/* ============================================================
   合规与数据来源 /compliance —— 四 tab 常驻页
   ------------------------------------------------------------
   来源：《商业航天投资活动网站设计方案-20261116.html》§3 模块七 / §5 P12 / §8
   四个 tab 与文档一致：风险提示、数据来源与口径、免责声明全文、
   主办方资质与授权 —— 第四项在本站转译为「平台与资料来源说明」：
   本站是高校研究中心的产业数据门户，没有活动主办、报名与会员业务，
   不虚构资质、授权清单与协议文本。

   与投资人页共用同一套合规文案（COMPLIANCE）与组件，避免口径漂移。
   页签状态写 URL hash（#tab-<key>，刻意不用元素 id 前缀，
   以免 RouteScrollHandler 把页内切换当成锚点滚动）。
   ============================================================ */

import { useCallback, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import {
  COMPLIANCE, RiskBanner, SourceBar, StatusBadge,
} from '../components/ComplianceKit';
import '../styles/compliance.css';

const DEFAULT_TAB = COMPLIANCE.tabs[0].key;
const tabHash = (key) => `tab-${key}`;

/* 数据集 key → 页面可读名称，与 dataLoader 的 fileUpdatedAt 对齐 */
const FILE_LABELS = [
  ['dashboard', '首页总览'],
  ['rockets', '火箭型谱'],
  ['constellations', '星座计划'],
  ['chain', '产业链 / 企业库'],
  ['industry', '投融资事件'],
  ['policy', '政策法规'],
  ['market', '市场空间'],
  ['geo', '地理分布'],
];

function RiskPanel() {
  return (
    <div className="cp-panel">
      <section className="cp-card">
        <h2 className="cp-card-title">产品边界</h2>
        <p className="cp-card-sub">先说清不做什么，比事后加免责声明更重要。</p>
        <p>
          本平台提供产业数据的整理、归集与可视化；不提供交易下单、持仓同步、tick 级行情，
          不提供荐股、评级、目标价、收益承诺、跟单或代客理财。页面出现的「热度」「集中度」
          均为对已披露公开信息的统计描述，不代表对任何企业或证券的评价。
        </p>
        <div className="cp-callout">
          <b>最容易误读的一点：</b>融资事件数量多、披露金额高，只说明该赛道当年的一级市场披露活跃，
          不等于上市公司的业绩受益，也不构成对任何标的的推荐。概念相关 ≠ 业绩受益。
        </div>
      </section>

      <section className="cp-card">
        <h2 className="cp-card-title">八个触点的提示形态</h2>
        <p className="cp-card-sub">常驻条与来源条是渲染约束，不是文案规范。</p>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <caption>表 1　提示触点、形态与是否可关闭</caption>
            <thead>
              <tr><th>触点</th><th>形态</th><th>可关闭</th></tr>
            </thead>
            <tbody>
              <tr><td>投资相关页面首屏</td><td>常驻风险条（sticky、带文字链接）</td><td>不可关</td></tr>
              <tr><td>每张含数字的卡片 / 图表</td><td>32px 来源条：来源｜数据时间｜口径 + 状态徽标</td><td>不可折叠 / 省略</td></tr>
              <tr><td>导出 CSV / JSON</td><td>强制勾选免责模态 + 文件内 meta 行</td><td>仅可取消动作</td></tr>
              <tr><td>页脚</td><td>免责声明全文（不折叠）</td><td>不可关</td></tr>
              <tr><td>空数据</td><td>保留来源条，不显示估算值、不生成推荐名单</td><td>—</td></tr>
              <tr><td>来源不可用</td><td>隐藏相关数值，渲染「来源待核｜时间 --｜口径 --」</td><td>—</td></tr>
              <tr><td>非实时快照</td><td>保留已标注时间的快照，不自动轮询</td><td>—</td></tr>
              <tr><td>顶栏 / 全局</td><td>合规工具条一次点击直达本页四个 tab</td><td>不可收进溢出菜单</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="cp-card">
        <h2 className="cp-card-title">本站的实现降级（如实说明）</h2>
        <p className="cp-card-sub">方案面向 Next.js 服务端渲染，本站是纯前端静态门户。</p>
        <p>
          文档的「顶层 layout 服务端首帧直渲 + 服务端 HMAC 令牌二次校验」在本站不具备对应基础设施。
          本站采用：顶栏合规入口全站可达、投资相关页面风险条常驻、导出动作前端强制确认、
          导出文件自带来源与免责 meta 行。风险条未覆盖全站每个路由，是为了不改动既有首页与其余
          数据页的视觉节奏；这一取舍记录在 <code>DESIGN_SYSTEM.md</code> §10。
        </p>
      </section>
    </div>
  );
}

function SourcesPanel({ fileUpdatedAt, lastUpdated }) {
  const rows = FILE_LABELS.filter(([key]) => fileUpdatedAt?.[key]);

  return (
    <div className="cp-panel">
      <section className="cp-card">
        <h2 className="cp-card-title">来源分级</h2>
        <p className="cp-card-sub">一手可直接采信；二手必须核实原文；派生值必须写明归集规则。</p>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <caption>表 2　来源等级与处理规则</caption>
            <thead>
              <tr><th>等级</th><th>包含</th><th>处理规则</th></tr>
            </thead>
            <tbody>
              {COMPLIANCE.sourceTiers.map((s) => (
                <tr key={s.tier}>
                  <td><StatusBadge tone={s.tier === '一手' ? 'info' : s.tier === '二手' ? 'amber' : 'neutral'}>{s.tier}</StatusBadge></td>
                  <td>{s.desc}</td>
                  <td>{s.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cp-card">
        <h2 className="cp-card-title">口径字典</h2>
        <p className="cp-card-sub">每个展示数值都应能回答：来自哪里、什么时候、怎么算的。</p>
        <ul className="cp-status-list">
          {COMPLIANCE.calibers.map((c) => (
            <li key={c.term}><b>{c.term}</b><span>{c.desc}</span></li>
          ))}
        </ul>
        <div style={{ marginTop: 16 }}>
          <SourceBar
            source="投融资事件（公开信息整理）"
            asOf={fileUpdatedAt?.industry || '--'}
            caliber="披露金额保守归一，未披露不计入"
            status="非实时快照"
            tone="info"
          />
        </div>
        <p style={{ marginTop: 10 }}>
          来源条是活样例：三段式不可折叠、不可用 tooltip 替代，字段缺失时显示
          「来源待核｜时间 --｜口径 --」而不是隐藏。
        </p>
      </section>

      <section className="cp-card">
        <h2 className="cp-card-title">四类数据状态</h2>
        <ul className="cp-status-list">
          {COMPLIANCE.statuses.map((s) => (
            <li key={s.state}>
              <b>{s.state}</b>
              <span>{s.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="cp-card">
        <h2 className="cp-card-title">分文件数据时间</h2>
        <p className="cp-card-sub">
          聚合徽标取各文件最大值，会掩盖个别数据集的陈旧；跨数据集对比前请以此表为准，
          或运行 <code>npm run data:status</code>。
        </p>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <caption>表 3　各数据集文件自身的 lastUpdated</caption>
            <thead>
              <tr><th>数据集</th><th className="numeric">数据时间</th><th>说明</th></tr>
            </thead>
            <tbody>
              {rows.map(([key, label]) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td className="numeric">{fileUpdatedAt[key] || '--'}</td>
                  <td>取自 public/data 对应 JSON</td>
                </tr>
              ))}
              <tr>
                <td>全站聚合值（页面徽标）</td>
                <td className="numeric">{lastUpdated || '--'}</td>
                <td>取最大值，仅代表全站最新，不代表每个文件都更新到该日</td>
              </tr>
            </tbody>
          </table>
        </div>
        <SourceBar
          source="public/data/*.json"
          asOf={lastUpdated || '--'}
          caliber="分文件 lastUpdated，聚合值 filter(Boolean).sort().pop()"
          status="静态快照"
          variant="chart"
          tone="neutral"
        />
      </section>
    </div>
  );
}

function StatementPanel() {
  return (
    <div className="cp-panel">
      <section className="cp-card">
        <h2 className="cp-card-title">免责声明全文</h2>
        <p className="cp-card-sub">全文展开、不可折叠；页脚同时保留同一份文本。</p>
        <div className="cp-disclaimer">
          {COMPLIANCE.full.map((text, i) => (
            <p className="cp-clause" key={i}>{text}</p>
          ))}
        </div>
        <div className="cp-callout">
          <b>版本说明：</b>本页文案随站点发布批次更新，不固化日期串；引用时请以当前页面为准并保留访问日期。
        </div>
      </section>
      <section className="cp-card">
        <h2 className="cp-card-title">引用与导出</h2>
        <p>
          导出文件（CSV / JSON）由 <code>@portal</code> exporters 统一生成，附带来源、统计口径、
          导出时间与免责说明 meta 行。导出前会触发强制勾选确认。导出的研究底稿仅供存档引证，
          不替代一手来源原文，也不构成对外荐股材料。
        </p>
      </section>
    </div>
  );
}

function PlatformPanel() {
  return (
    <div className="cp-panel">
      <section className="cp-card">
        <h2 className="cp-card-title">平台与资料来源</h2>
        <p className="cp-card-sub">对应设计方案中的「主办方资质与个人信息授权」章节。</p>
        {COMPLIANCE.platform.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
        <div className="cp-callout">
          <b>为什么没有资质与授权清单：</b>本站不举办投资活动、不收集报名信息、不设会员付费与社区发帖，
          因此设计方案里的主办方资质披露、PII 授权逐项勾选、报名状态机与 UGC 审核流没有对应对象，
          不予实现，也不生成占位文本。若未来上线这些业务，须由具备资质的合规人员另行审定条款。
        </div>
      </section>
      <section className="cp-card">
        <h2 className="cp-card-title">继续核对</h2>
        <p>
          <Link to="/research">数据与溯源</Link> 提供字段口径、原始数据集浏览、溯源核查与更新日志；
          <Link to="/investors"> 投资分析工具</Link> 的每个统计卡与图表下方均带来源条。
          两处与本页面共用同一份合规文案。
        </p>
      </section>
    </div>
  );
}

function Compliance() {
  const data = useData();
  const location = useLocation();
  const navigate = useNavigate();

  const fileUpdatedAt = data?.fileUpdatedAt || {};
  const lastUpdated = data?.lastUpdated || null;

  const activeTab = useMemo(() => {
    const key = (location.hash || '').replace('#tab-', '');
    return COMPLIANCE.tabs.some((t) => t.key === key) ? key : DEFAULT_TAB;
  }, [location.hash]);

  const goTab = useCallback((key) => {
    navigate(`${location.pathname}#${tabHash(key)}`, { replace: true });
  }, [location.pathname, navigate]);

  const panels = {
    risk: <RiskPanel />,
    sources: <SourcesPanel fileUpdatedAt={fileUpdatedAt} lastUpdated={lastUpdated} />,
    statement: <StatementPanel />,
    platform: <PlatformPanel />,
  };

  return (
    <div className="page-container cp-page">
      <RiskBanner />

      <header className="page-header" style={{ marginTop: 4 }}>
        <p className="cp-kicker">合规 · 数据来源与口径</p>
        <h1 className="page-title">风险提示与数据口径</h1>
        <p className="cp-lead">每个数字都能查证，才算得上研究底稿。</p>
        <p className="cp-desc">
          本站把来源、数据时间、统计口径与数据状态当作渲染约束：含数字的卡片必带来源条，
          导出前必读免责声明。以下四个页签可从顶栏合规工具条一次点击直达，URL 可分享、可后退。
        </p>
      </header>

      <div
        className="cp-tabs"
        role="tablist"
        aria-label="合规与口径页签"
        onKeyDown={(e) => {
          const idx = COMPLIANCE.tabs.findIndex((t) => t.key === activeTab);
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + COMPLIANCE.tabs.length) % COMPLIANCE.tabs.length;
            goTab(COMPLIANCE.tabs[next].key);
          } else if (e.key === 'Home') {
            e.preventDefault(); goTab(COMPLIANCE.tabs[0].key);
          } else if (e.key === 'End') {
            e.preventDefault(); goTab(COMPLIANCE.tabs[COMPLIANCE.tabs.length - 1].key);
          }
        }}
      >
        {COMPLIANCE.tabs.map((t) => (
          <button
            key={t.key}
            id={`cp-tab-${t.key}`}
            type="button"
            role="tab"
            className="cp-tab"
            aria-selected={activeTab === t.key}
            aria-controls={`cp-panel-${t.key}`}
            tabIndex={activeTab === t.key ? 0 : -1}
            onClick={() => goTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        id="cp-main"
        role="tabpanel"
        aria-labelledby={`cp-tab-${activeTab}`}
        tabIndex={-1}
      >
        {panels[activeTab]}
      </div>

      <SourceBar
        source="本站合规文案与设计方案（2026-11-16）"
        asOf={lastUpdated || '--'}
        caliber="口径字典 · 来源分级 · 四类状态"
        status="平台说明"
        tone="neutral"
      />
    </div>
  );
}

export default Compliance;
