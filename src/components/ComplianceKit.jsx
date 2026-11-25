/* ============================================================
   合规设计原语（Compliance Kit）
   ------------------------------------------------------------
   来源：《商业航天投资活动网站设计方案-20261116.html》§7.2 / §8 / §10
   三条基础原语（风险条 / 来源条 / 状态徽标）+ 触发式免责模态，
   被投资人门户与合规页复用，避免口径漂移。

   适配说明（与设计方案的差异，见 DESIGN_SYSTEM.md §10）：
   - 本站是「产业分析平台」而非股票投教站，风险条落在投资相关页面首屏，
     全站可达性由顶栏合规工具条 + 页脚免责全文承担；
   - 本站为 Vite + React SPA，没有服务端，故免责确认为前端交互约束，
     不虚构 confirmToken 二次校验；
   - 设计态的 `--.--` 占位只约束行情数值，本站展示的是产业统计快照，
     因此数字保留，改为强制携带「来源｜数据时间｜口径 + 状态」。
   ============================================================ */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import '../styles/compliance.css';

/* ============================================================
   合规文案单一真源：合规页、风险条、导出模态、页脚共用
   ============================================================ */
export const COMPLIANCE = {
  summary: '本站内容仅供研究参考与投资者教育，不构成投资建议。',
  notice: '不提供交易下单，不做荐股、评级、目标价或收益承诺；数据为公开信息整理快照，非实时行情。',
  tabs: [
    { key: 'risk', label: '风险提示' },
    { key: 'sources', label: '数据来源与口径' },
    { key: 'statement', label: '免责声明全文' },
    { key: 'platform', label: '平台与资料来源' },
  ],
  full: [
    '本平台所载内容基于公开资料整理与量化归集，仅供研究参考、产业分析与投资者教育之用，不构成任何证券买卖要约、投资建议、评级、目标价或收益承诺。',
    '平台不提供交易下单、持仓同步、实时行情或代客理财服务；不提供个股推荐名单。页面中的「融资事件」「赛道分布」「头部集中度」等均为对已披露公开信息的统计描述，不代表对任何企业或证券的评价。',
    '平台数据存在披露延迟、口径差异与来源分级。引用前请核对来源标注条中的「来源｜数据时间｜口径」及状态徽标；二手来源请核实原文，跨来源数值冲突时应优先采信高层级来源并标注分歧。',
    '市场有风险，投资需谨慎。任何投资决策应结合个人风险承受能力、资金状况与投资目标独立判断，必要时咨询持牌专业机构。过往表现不预示未来收益。',
  ],
  sourceTiers: [
    { tier: '一手', desc: '政府与监管机构公开文件、交易所公告、公司年报 / 季报、官方发布', rule: '可直接采信，标注机构名与发布日期' },
    { tier: '二手', desc: '财经媒体、研究机构报告、第三方数据平台的二次引用', rule: '标注「需核实原文」，不得与一手来源同等处理' },
    { tier: '派生', desc: '平台由上述来源实时归集的统计值（赛道 / 轮次 / 集中度等）', rule: '标注归集规则与分母，不写入原始数据集' },
  ],
  calibers: [
    { term: '数据时间', desc: '数据集文件的 lastUpdated，取分文件值；页面聚合值只代表全站最新，会掩盖个别文件的陈旧' },
    { term: '统计口径', desc: '数值的边界、颗粒度与归一规则，例如「超5亿」按 5 亿元保守归一、「未披露」不计入金额统计' },
    { term: '状态徽标', desc: '一手 / 二手·需核实原文 / 派生 / 非实时；颜色不是唯一载体，均带文字与形状' },
    { term: '快照', desc: '指定时点整理的静态数据，不自动轮询、不作为实时决策依据' },
  ],
  statuses: [
    { state: '可展示', desc: '来源、数据时间、口径齐备，正常渲染数值' },
    { state: '需核实原文', desc: '仅二手来源，数值保留但标注核实提示与原文线索' },
    { state: '来源待核', desc: '来源缺失时隐藏相关数值，仅保留来源标注条，绝不显示估算值' },
    { state: '非实时', desc: '保留已标注时间的快照，不自动更新、不暗示盘中行情' },
  ],
  platform: [
    '本平台由北京航空航天大学经济管理学院 · 商业航天研究中心建设，面向投资人、科研人员与产业从业者，以资金链、产业链、火箭链、政策链、卫星链五个维度组织公开数据。',
    '本平台不是证券经营机构，不开展投资咨询、活动报名、会员付费或社区发帖业务，因此设计方案中的主办方资质披露、个人信息授权清单、报名状态机与 UGC 审核流在本站没有对应对象，不予实现。',
    '平台为纯前端静态数据门户，数据集位于 public/data/*.json，由每日更新管线写入。导出文件由前端生成并附带来源、口径、导出时间与免责说明；如需具备法律效力的存档件，请以一手来源原文为准。',
  ],
};

/* ============================================================
   风险条 —— 常驻、不可关闭；<768 承载两个带文字的合规入口
   ============================================================ */
export function RiskBanner({ className = '' }) {
  return (
    <div className={`cp-riskbar ${className}`} role="note" aria-label="常驻风险提示">
      <span className="cp-riskbar-icon" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1.6 13 12.1H1L7 1.6Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M7 5.4v3.1M7 10.3v.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </span>
      <p className="cp-riskbar-text">
        <b>{COMPLIANCE.summary}</b>
        <span className="cp-riskbar-sub">{COMPLIANCE.notice}</span>
      </p>
      <div className="cp-riskbar-tools">
        <Link to="/compliance#tab-risk">风险说明</Link>
        <Link to="/compliance#tab-sources">数据口径</Link>
      </div>
    </div>
  );
}

/* ============================================================
   状态徽标 —— 色点 + 文字双通道，颜色不是唯一信息载体
   ============================================================ */
export function StatusBadge({ tone = 'info', children, className = '' }) {
  return (
    <span className={`cp-badge cp-badge-${tone} ${className}`}>
      <span className="cp-badge-dot" aria-hidden="true" />
      {children}
    </span>
  );
}

/* ============================================================
   来源标注条 —— 恒占 32px（<768 记录卡 28px 下限）
   三段式「来源｜数据时间｜口径」+ 状态徽标；不可折叠 / 省略 / tooltip 替代
   字段缺失一律渲染「来源待核｜时间 --｜口径 --」而非隐藏
   ============================================================ */
export function SourceBar({
  source,
  asOf,
  caliber,
  status = '非实时',
  tone = 'info',
  variant = 'card',
  className = '',
}) {
  return (
    <div className={`cp-sourcebar cp-sourcebar-${variant} ${className}`} aria-label="数据来源与口径">
      <span className="cp-sourcebar-item"><b>来源</b><span>{source || '来源待核'}</span></span>
      <span className="cp-sourcebar-item"><b>数据时间</b><span>{asOf || '--'}</span></span>
      <span className="cp-sourcebar-item"><b>口径</b><span>{caliber || '--'}</span></span>
      <StatusBadge tone={tone} className="cp-sourcebar-badge">{status}</StatusBadge>
    </div>
  );
}

/* ============================================================
   免责确认模态 —— 不可点遮罩关闭、不可 Esc 关闭、强制勾选
   焦点锁在模态内，关闭后归还焦点；绕不过的是交互，不是服务端令牌
   ============================================================ */
export function DisclaimerModal({
  open,
  title = '导出前请确认',
  notice,
  confirmLabel = '确认并继续',
  onConfirm,
  onCancel,
}) {
  const [checked, setChecked] = useState(false);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setChecked(false);
    const prevFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = () => Array.from(
      dialogRef.current?.querySelectorAll('button:not([disabled]), input, a[href]') || [],
    );
    focusables()[0]?.focus();

    /* 只处理 Tab 循环；刻意不监听 Escape，避免绕过确认 */
    const onKeyDown = (e) => {
      if (e.key !== 'Tab') return;
      const nodes = focusables();
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="cp-modal-overlay">
      <div
        className="cp-modal"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cp-modal-title"
        aria-describedby="cp-modal-desc"
      >
        <h2 className="cp-modal-title" id="cp-modal-title">{title}</h2>
        <div className="cp-modal-body" id="cp-modal-desc">
          <p className="cp-modal-lead">{COMPLIANCE.summary}</p>
          {notice && <p className="cp-modal-notice">{notice}</p>}
          <ul className="cp-modal-list">
            <li>导出内容仅作研究参考，不构成投资建议，不得对外用于荐股。</li>
            <li>文件自带来源、数据时间、统计口径与导出时间，引用时请一并保留。</li>
            <li>二手来源需核实原文；来源缺失的字段不显示估算值。</li>
          </ul>
        </div>
        <label className="cp-modal-check">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>我已阅读并知悉上述声明</span>
        </label>
        <div className="cp-modal-actions">
          <button type="button" className="cp-btn" onClick={onCancel}>取消</button>
          <button
            type="button"
            className="cp-btn cp-btn-primary"
            disabled={!checked}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * 动作守卫：把「导出」这类动作包成「先确认、再执行」。
 * 用法：const { requireConfirm, modal } = useDisclaimerGuard();
 *      requireConfirm(() => exportCSV(...), { notice: '...' });
 *      return <>{...}{modal}</>;
 * 注意：run 放进对象里再 setState，避免被 React 当成 updater 立即执行。
 */
export function useDisclaimerGuard() {
  const [pending, setPending] = useState(null);

  const requireConfirm = useCallback((run, meta = {}) => {
    setPending({ run, ...meta });
  }, []);

  const modal = (
    <DisclaimerModal
      open={Boolean(pending)}
      title={pending?.title || '导出前请确认'}
      notice={pending?.notice}
      confirmLabel={pending?.confirmLabel || '确认并导出'}
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const run = pending?.run;
        setPending(null);
        if (typeof run === 'function') run();
      }}
    />
  );

  return { requireConfirm, modal };
}

/* ============================================================
   全站共享导出守卫
   ------------------------------------------------------------
   ExportBar / DataTable 通过 guard / exportGuard prop 接动作守卫，
   但不少调用点藏在页面子标签组件里（如 Research 的 DictionaryTab /
   BrowserTab / ExportTab），逐层 prop drilling 要改十几个签名。
   Layout 挂一次 Provider，子组件用 useExportGuard() 直接取同一个
   requireConfirm，确认模态全站只渲染一份。
   脱离 Provider 时自动退回本地守卫，保证模块沙箱等场景仍可用。
   ============================================================ */
const ExportGuardContext = createContext(null);

export function ExportGuardProvider({ guard, children }) {
  return <ExportGuardContext.Provider value={guard}>{children}</ExportGuardContext.Provider>;
}

export function useExportGuard() {
  const shared = useContext(ExportGuardContext);
  // Hooks 必须无条件调用，故本地守卫始终创建；用共享守卫时它只是空壳。
  const local = useDisclaimerGuard();
  if (shared && typeof shared.requireConfirm === 'function') {
    return { requireConfirm: shared.requireConfirm, modal: null };
  }
  return local;
}

/* ============================================================
   顶栏合规工具条 —— ≥768 两个带文字入口常驻；
   <768 顶栏保留 1 条带文字合规链接「风险提示」，不进移动端抽屉、
   不依赖风险条承接；第二个入口由 .cp-toolbar-link-secondary 隐藏。
   风险条右端链接与本工具条并存、不去重（Phase 3A 主理人裁决）。
   ============================================================ */
export function ComplianceToolbar() {
  return (
    <div className="cp-toolbar">
      <Link to="/compliance#tab-risk" className="cp-toolbar-link cp-toolbar-link-primary">
        <span className="cp-toolbar-mark" aria-hidden="true">!</span>
        风险提示
      </Link>
      <Link to="/compliance#tab-sources" className="cp-toolbar-link cp-toolbar-link-secondary">数据来源与口径</Link>
    </div>
  );
}

