import Icon from './Icon';

/* ============================================================
   研究报告渲染块 —— 首页与「研究报告」页共用，避免两处各写一份而漂移
   ============================================ */

/* 2025年度核心实绩 */
export function KeyFactsGrid({ keyFacts }) {
  if (!keyFacts?.facts) return null;
  return (
    <div className="dash-facts-grid">
      {keyFacts.facts.map((f) => (
        <div className="dash-fact-card" key={f.label}>
          <div className="dash-fact-value">
            {f.value}<span className="dash-fact-unit">{f.unit}</span>
          </div>
          <div className="dash-fact-label">{f.label}</div>
          <div className="dash-fact-sub">{f.sub}</div>
          <div className="dash-fact-source">
            {f.sourceUrl ? (
              <a href={f.sourceUrl} target="_blank" rel="noreferrer">{f.source}</a>
            ) : (
              <span>{f.source}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* 行业趋势解读 */
export function InsightsGrid({ data }) {
  if (!data?.insights) return null;
  return (
    <div className="insight-grid">
      {data.insights.map((it) => (
        <article className="insight-card" key={it.title}>
          <div className="insight-card-head">
            <span className="insight-icon" aria-hidden="true">
              <Icon name={it.icon} size="lg" />
            </span>
            <span className="insight-metric">{it.metric}</span>
          </div>
          <h4 className="insight-title">{it.title}</h4>
          <p className="insight-text">{it.text}</p>
          <div className="insight-source">
            {it.sourceUrl ? (
              <a href={it.sourceUrl} target="_blank" rel="noreferrer">
                <Icon name="external" size="sm" /> {it.source}
              </a>
            ) : (
              <span><Icon name="info" size="sm" /> {it.source}</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

/* 年度典型案例 */
export function CasesGrid({ data }) {
  if (!data?.cases) return null;
  return (
    <div className="case-grid">
      {data.cases.map((c) => (
        <article className="case-card" key={c.id}>
          <div className="case-card-top">
            <span className="case-tag">{c.tag}</span>
            <span className="case-icon" aria-hidden="true">
              <Icon name={c.icon} size="lg" />
            </span>
          </div>
          <div className="case-metric">
            {c.metric}
            <span className="case-metric-label">{c.metricLabel}</span>
          </div>
          <h4 className="case-title">{c.title}</h4>
          <p className="case-text">{c.text}</p>
          <div className="case-source">
            {c.sourceUrl ? (
              <a href={c.sourceUrl} target="_blank" rel="noreferrer">
                <Icon name="external" size="sm" /> {c.source}
              </a>
            ) : (
              <span><Icon name="info" size="sm" /> {c.source}</span>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
