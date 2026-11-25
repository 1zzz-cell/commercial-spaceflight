import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import Icon from '../components/Icon';
import FreshnessBadge from '../components/FreshnessBadge';
import { KeyFactsGrid, InsightsGrid, CasesGrid } from '../components/ReportBlocks';

/* ============================================================
   研究报告页 —— 未来天玑式「研究报告」栏目
   聚合平台既有分析成果：年度实绩 / 趋势解读 / 典型案例 / 投融资笔记
   ============================================ */

function ReportDoc({ no, title, desc, children }) {
  return (
    <section className="rpt-doc" id={`report-${no}`}>
      <div className="rpt-doc-head">
        <h2 className="rpt-doc-title">{title}</h2>
        <span className="rpt-doc-no">报告 {no}</span>
      </div>
      {desc && <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 20 }}>{desc}</p>}
      {children}
    </section>
  );
}

function Reports() {
  const { chain, industry } = useData();
  const { keyFacts2025, trendInsights2025, caseStudies } = chain;
  const { financingNotes } = industry;

  return (
    <div className="page-container ds-page">
      <div className="page-header">
        <h1 className="page-title">研究报告</h1>
        <p className="page-desc">
          查看年度实绩、行业趋势、典型案例与投融资结构笔记。引用前请核对各节的统计口径与来源。
        </p>
        <div>年度研究 <FreshnessBadge fileKey="chain" /></div>
        <div>投融资笔记 <FreshnessBadge fileKey="industry" /></div>
      </div>

      <div className="stack-gap">
        <ReportDoc
          no="01"
          title={`${keyFacts2025?.year || 2025} 年度核心实绩`}
          desc={keyFacts2025?.sourceNote}
        >
          <KeyFactsGrid keyFacts={keyFacts2025} />
        </ReportDoc>

        <ReportDoc no="02" title={trendInsights2025?.title || '行业趋势解读'} desc="基于年度实绩的四维解读：发射结构、载荷主体、市场主体与资本流向。">
          <InsightsGrid data={trendInsights2025} />
        </ReportDoc>

        <ReportDoc no="03" title={caseStudies?.title || '年度典型案例'} desc="覆盖发射基建、星座组网与运力供给三个维度的关键落地节点。">
          <CasesGrid data={caseStudies} />
        </ReportDoc>

        <ReportDoc no="04" title="投融资结构笔记" desc="历年融资数据的口径说明与异常年份解读，阅读投融资图表前建议先看本节。">
          <div className="rpt-notes">
            {(financingNotes || []).map((n, idx) => (
              <div className="rpt-note" key={idx}>
                <span className="rpt-note-year">{n.year}</span>
                <div>
                  <div className="rpt-note-event">{n.event}</div>
                  <div className="rpt-note-text">{n.note}</div>
                </div>
              </div>
            ))}
          </div>
        </ReportDoc>

        {/* 导航入口：明确标注为数据入口而非研究报告，避免把 CTA 冒充成第 5 篇报告 */}
        <section className="rpt-doc rpt-doc-entry" aria-labelledby="rpt-entry-title">
          <div className="rpt-doc-head">
            <h2 id="rpt-entry-title" className="rpt-doc-title">相关数据来源</h2>
            <span className="rpt-doc-no">入口</span>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 16 }}>
            以下为平台配套的交互式数据栏目，不是研究报告；需要逐条核对指标口径与原始数值时前往。
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/index" className="dash-btn dash-btn-primary">
              商业航天指数 <Icon name="arrow-up" size="sm" />
            </Link>
            <Link to="/market" className="dash-btn">
              市场空间数据 <Icon name="arrow-up" size="sm" />
            </Link>
            <Link to="/research" className="dash-btn">
              数据与溯源 <Icon name="arrow-up" size="sm" />
            </Link>
          </div>
        </section>

        <div className="data-source-note">
          <p>
            报告内容由平台维护团队基于公开数据整理，可点击各条目来源链接核查原文。
            如需引用本平台数据，请使用 <Link to="/research">数据与溯源</Link> 提供的 BibTeX 引用格式。
          </p>
        </div>
      </div>
    </div>
  );
}

export default Reports;
