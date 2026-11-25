import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { parseTicker } from '../utils/ticker';
import { navGroups } from '../components/siteNavigation';
import FreshnessBadge from '../components/FreshnessBadge';
import '../styles/home-v2.css';

function Section({ id, title, action, children }) {
  return (
    <section className="hv2-section hv2-container" aria-labelledby={id}>
      <div className="hv2-section-head">
        <h2 id={id} className="hv2-section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function HomeV2() {
  const { dashboard, chain } = useData();
  const metrics = dashboard.dashboardMetrics || [];
  const headlines = (dashboard.newsTicker || []).slice(0, 3).map(parseTicker);
  const reports = [
    { title: '年度实绩', text: '按统计口径查看发射、载荷、企业与融资数据。', to: '/reports#report-01' },
    { title: '行业趋势', text: '了解商业发射、市场主体和资本流向的变化。', to: '/reports#report-02' },
    { title: '典型案例', text: '查看商业发射场、星座组网和运力供给案例。', to: '/reports#report-03' },
  ];

  return (
    <div className="home-v2">
      <section className="hv2-hero" aria-labelledby="hv2-title">
        <div className="hv2-hero-grid" aria-hidden="true" />
        <div className="hv2-container hv2-hero-inner">
          <h1 id="hv2-title" className="hv2-hero-title">中国商业航天产业数据平台</h1>
          <p className="hv2-hero-sub">查企业和产业链、跟踪火箭与星座进展、比较市场与融资数据。</p>
          <div className="hv2-hero-actions">
            <a href="#hv2-directory" className="hv2-btn hv2-btn-primary">浏览产业数据</a>
            <Link to="/reports" className="hv2-btn hv2-btn-ghost">阅读年度观察</Link>
          </div>
        </div>
      </section>

      <Section id="hv2-snapshot" title={chain.keyFacts2025?.year ? `${chain.keyFacts2025.year} 年度概览` : '年度概览'}
        action={<Link className="hv2-text-link" to="/index">查看指标与趋势</Link>}>
        {metrics.length > 0 ? (
          <dl className="hv2-metrics">
            {metrics.map((metric) => (
              <div key={metric.label} className="hv2-metric">
                <dt>{metric.label}</dt>
                <dd><strong>{metric.value}</strong> {metric.unit}</dd>
                <dd>{metric.sub?.replace(/^\/\s*/, '')}</dd>
              </div>
            ))}
          </dl>
        ) : <p>暂无年度指标。</p>}
        <p className="hv2-note"><FreshnessBadge fileKey="dashboard" /> <Link to="/reports#report-01">查看统计口径</Link></p>
      </Section>

      <Section id="hv2-directory" title="产业数据入口"
        action={<Link className="hv2-text-link" to="/investors">进入投资分析工具</Link>}>
        <div className="hv2-directory">
          {navGroups.map((group) => (
            <div className="hv2-panel" key={group.title}>
              <h3>{group.title}</h3>
              <ul className="hv2-list">
                {group.items.map((item) => (
                  <li key={item.path}><Link to={item.path}>{item.label}<small>{item.desc}</small></Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section id="hv2-reading" title="年度观察与行业资讯">
        <div className="hv2-reading">
          <div className="hv2-panel">
            <h3>{chain.keyFacts2025?.year ? `${chain.keyFacts2025.year} 年度观察` : '年度观察'}</h3>
            <ul className="hv2-list">
              {reports.map((report) => <li key={report.to}><Link to={report.to}>{report.title}<small>{report.text}</small></Link></li>)}
            </ul>
          </div>
          <div className="hv2-panel">
            <h3>行业资料摘录</h3>
            {headlines.length > 0 ? (
              <ul className="hv2-list hv2-headlines">
                {headlines.map(({ source, text }, index) => (
                  <li key={index}>{source && <small>{source}</small>}{text}</li>
                ))}
              </ul>
            ) : <p>暂无资料摘录。</p>}
            <Link className="hv2-text-link" to="/news">查看全部行业资讯</Link>
          </div>
        </div>
      </Section>

      <Section id="hv2-sources" title="数据来源与口径"
        action={<Link className="hv2-text-link" to="/research#tab-provenance">查看来源核查</Link>}>
        <p className="hv2-note">各数据集分别记录更新时间。部分条目只有汇编来源，引用前请核对原文链接、统计范围与时间。</p>
      </Section>
    </div>
  );
}
