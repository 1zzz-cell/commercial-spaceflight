import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import Icon from '../components/Icon';
import FreshnessBadge from '../components/FreshnessBadge';
import { parseTicker } from '../utils/ticker';
import '../styles/news-filter.css';

/* ============================================================
   行业资讯页 —— 平台快讯 + 发展里程碑
   ============================================ */

function News() {
  const { dashboard } = useData();
  const items = (dashboard.newsTicker || []).map(parseTicker);
  const milestones = dashboard.milestones || [];

  /* 按来源筛选：数据集仅有「来源：正文」结构，无日期字段，
     因此不提供时间筛选，也不伪造日期。来源从实际数据中派生。 */
  const [sourceFilter, setSourceFilter] = useState('全部');
  const sources = useMemo(
    () => [...new Set(items.map((i) => i.source).filter(Boolean))].sort(),
    [items],
  );
  const visible = useMemo(
    () => (sourceFilter === '全部' ? items : items.filter((i) => i.source === sourceFilter)),
    [items, sourceFilter],
  );

  return (
    <div className="page-container ds-page">
      <div className="page-header">
        <h1 className="page-title">行业资讯</h1>
        <p className="page-desc">
          平台收录的行业资料摘录与产业发展里程碑。摘录的发布日期和原文链接尚未逐条记录。
        </p>
        <FreshnessBadge fileKey="dashboard" />
      </div>

      <div className="stack-gap">
        {/* 行业快讯 */}
        <div className="chart-card">
          <div className="chart-card-header">
            <h3 className="chart-title">行业资料摘录</h3>
            <p className="chart-desc">
              共 {items.length} 条
              {sourceFilter !== '全部' ? ` · 当前筛选 ${visible.length} 条` : ''}
            </p>
          </div>
          {sources.length > 1 && (
            <div className="news-filter" role="group" aria-label="按来源筛选快讯">
              {['全部', ...sources].map((src) => (
                <button
                  type="button"
                  key={src}
                  className={`news-filter-btn ${sourceFilter === src ? 'active' : ''}`}
                  aria-pressed={sourceFilter === src}
                  onClick={() => setSourceFilter(src)}
                >
                  {src}
                </button>
              ))}
            </div>
          )}
          {visible.length > 0 ? (
            <div className="news-page-list">
              {visible.map((item, idx) => (
                <div className="news-page-item" key={`${item.source}-${idx}`}>
                  <span className="news-page-index">{String(idx + 1).padStart(2, '0')}</span>
                  <div className="news-page-body">
                    {item.source && (item.sourceUrl ? (
                      <a className="news-page-source" href={item.sourceUrl} target="_blank" rel="noreferrer">{item.source} ↗</a>
                    ) : <span className="news-page-source">{item.source}</span>)}
                    <p className="news-page-text">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
              <Icon name="info" size="lg" />
              <p style={{ marginTop: 8 }}>
                {items.length === 0 ? '暂无快讯数据' : `「${sourceFilter}」来源下暂无条目`}
              </p>
            </div>
          )}
        </div>

        {/* 发展里程碑 */}
        <div className="dash-timeline-section">
          <div className="dash-section-header">
            <h2 className="dash-section-title">发展里程碑</h2>
            <p className="dash-section-subtitle">2014 — 2025 中国商业航天关键节点</p>
          </div>
          <div className="dash-timeline">
            {milestones.map((item, idx) => (
              <div className="dash-timeline-item" key={idx}>
                <div className="dash-timeline-dot" />
                <div className="dash-timeline-year">{item.year}</div>
                <div className="dash-timeline-text">
                  {item.text}
                  {item.sourceUrl && <a className="ds-wrap-url" href={item.sourceUrl} target="_blank" rel="noreferrer">查看来源 ↗</a>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="data-source-note">
          <p>
            数据来源：国家航天局、中国政府网、《中国航天》期刊等公开发布。
            本页仅作信息汇编，不构成任何投资或法律建议。完整数据字典与导出请前往
            <Link to="/research"> 数据与溯源</Link>。
          </p>
        </div>
      </div>
    </div>
  );
}

export default News;
