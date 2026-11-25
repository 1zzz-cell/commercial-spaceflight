/* ============================================
   共用 UI 组件 —— 模块开发的「版式接口」
   --------------------------------------------
   这些组件统一了卡片、分区标题、来源标记、导出栏的样式。
   模块开发者直接用，不要自己另写一套 card/section 样式，
   否则两个门户的视觉会各自漂移。

   全部只用 global.css 已定义的 CSS 变量，不引入新色值。
   ============================================ */

import Icon from '../../components/Icon';
import { exportCSV, exportJSON, exportBibTeX, EXPORT_DISCLAIMER } from './exporters';
import { credibilityOf, formatDelta, trendOf } from './format';

/** 标准卡片容器 */
export function Card({ children, className = '', style, onClick, as: Tag = 'section', ...rest }) {
  return (
    <Tag
      className={`portal-card ${onClick ? 'portal-card-clickable' : ''} ${className}`}
      style={style}
      onClick={onClick}
      {...(onClick ? { role: 'button', tabIndex: 0, onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } } : {})}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** 分区标题：主标题 + 可选副标题 + 可选右侧操作区 */
export function SectionTitle({ title, subtitle, actions, level = 2 }) {
  const Tag = `h${Math.min(Math.max(level, 1), 6)}`;
  return (
    <div className="portal-section-head">
      <div>
        <Tag className="portal-section-title">{title}</Tag>
        {subtitle && <p className="portal-section-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="portal-section-actions">{actions}</div>}
    </div>
  );
}

/** 指标卡：value 主数值，delta 环比变化（自动涨红跌绿） */
export function StatCard({ label, value, unit, sub, delta, icon, onClick }) {
  return (
    <Card className="portal-stat" onClick={onClick}>
      <div className="portal-stat-head">
        <span className="portal-stat-label">{label}</span>
        {icon && (
          <span className="portal-stat-icon" aria-hidden="true">
            <Icon name={icon} size="lg" />
          </span>
        )}
      </div>
      <div className="portal-stat-value">
        {value}
        {unit && <span className="portal-stat-unit">{unit}</span>}
      </div>
      {(sub || delta !== undefined) && (
        <div className="portal-stat-foot">
          {sub && <span className="portal-stat-sub">{sub}</span>}
          {delta !== undefined && delta !== null && (
            <Delta value={delta} />
          )}
        </div>
      )}
    </Card>
  );
}

/** 涨跌值渲染 —— 中国市场习惯：涨红跌绿；颜色由 .ds-tone-* 语义类承载 */
export function Delta({ value, suffix = '%', digits = 1 }) {
  const { tone } = trendOf(value);
  return (
    <span className={`portal-delta ds-tone-${tone}`}>
      {formatDelta(value, { digits, suffix })}
    </span>
  );
}

/** 数据来源 / 可信度标记 —— 科研可信度的关键视觉；颜色由 .ds-tone-* 语义类承载 */
export function SourceTag({ item, compact = false }) {
  const { label, tone, desc } = credibilityOf(item);
  return (
    <span className={`portal-source-tag ds-tone-${tone}`} title={desc}>
      {label}
      {!compact && item.source && (
        <>
          <span className="portal-source-sep">·</span>
          {item.sourceUrl ? (
            <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="portal-source-link">
              {item.source}
            </a>
          ) : (
            <span>{item.source}</span>
          )}
        </>
      )}
    </span>
  );
}

/**
 * 导出工具条 —— 一次给全 CSV / JSON / BibTeX，科研门户的核心诉求
 * @param {Object} p
 * @param {string} p.filename   文件名（不含扩展名）
 * @param {Object} p.csv        { headers, rows, source, caliber }
 * @param {*} [p.jsonData]      提供则显示 JSON 导出
 * @param {Object} [p.bib]      { title, note } 提供则显示 BibTeX 导出
 * @param {(run:Function, meta?:Object)=>void} [p.guard]
 *        可选动作守卫（如导出前免责确认）。不传时行为完全不变；
 *        传入时导出文件自动附带免责 meta，确保引用链不丢失。
 */
export function ExportBar({ filename = 'export', csv, jsonData, bib, extra, guard }) {
  const hasAny = Boolean(csv || jsonData || bib);
  if (!hasAny && !extra) return null;

  const guarded = typeof guard === 'function';
  const run = (fn) => {
    if (!guarded) return fn();
    return guard(fn, {
      title: '导出前请确认',
      notice: `即将导出「${filename}」。导出内容仅作研究参考，请确认已核对来源与口径。`,
      confirmLabel: '确认并导出',
    });
  };
  const csvPayload = guarded && csv
    ? { ...csv, extraMeta: [...(csv.extraMeta || []), EXPORT_DISCLAIMER] }
    : csv;
  const jsonMeta = { source: csv?.source, caliber: csv?.caliber };
  if (guarded) jsonMeta.disclaimer = EXPORT_DISCLAIMER;

  return (
    <div className="portal-export-bar">
      <span className="portal-export-label">导出</span>
      {csv && (
        <button type="button" className="portal-export-btn" onClick={() => run(() => exportCSV(filename, csvPayload))}>
          <Icon name="download" size={14} /> CSV
        </button>
      )}
      {jsonData && (
        <button type="button" className="portal-export-btn" onClick={() => run(() => exportJSON(filename, jsonData, jsonMeta))}>
          <Icon name="file" size={14} /> JSON
        </button>
      )}
      {bib && (
        <button type="button" className="portal-export-btn" onClick={() => run(() => exportBibTeX(filename, bib))}>
          <Icon name="external" size={14} /> BibTeX 引用
        </button>
      )}
      {extra}
    </div>
  );
}

/** 空态 / 数据缺失占位 */
export function EmptyState({ text = '暂无数据', hint }) {
  return (
    <div className="portal-empty">
      <Icon name="info" size={28} />
      <p className="portal-empty-text">{text}</p>
      {hint && <p className="portal-empty-hint">{hint}</p>}
    </div>
  );
}

/**
 * 响应式栅格：默认自适应，columns 可指定列数
 * --------------------------------------------
 * 列数不再写成 inline gridTemplateColumns（会盖掉收敛层的中间断点），
 * 改为注入 --grid-cols 自定义属性，由 visual-convergence.css 统一决定列数；
 * props 签名与全部 5 个调用点零改动，≤640px 仍由 sdk.css 的 1fr!important 兜底。
 */
export function Grid({ children, columns = 'auto', gap = 16, className = '' }) {
  return (
    <div
      className={`portal-grid ${className}`}
      style={{
        gap,
        '--grid-cols': columns === 'auto' ? 'auto-fit' : columns,
      }}
    >
      {children}
    </div>
  );
}

export { Icon };
