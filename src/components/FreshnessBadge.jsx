/* ============================================================
   FreshnessBadge —— 数据新鲜度徽标（页头用）
   ------------------------------------------------------------
   背景：全站徽标 data.lastUpdated 取 8 个 JSON 的最大值，会掩盖
   个别数据集的陈旧（例如聚合显示 10-21，实际 policy/chain 停在 10-04）。
   本组件按 fileKey 读取 fileUpdatedAt 的分文件值，并实时计算陈旧天数，
   超过 30 天明示「已 N 天未更新」，让陈旧不再被聚合值掩盖。

   用法：
     <FreshnessBadge fileKey="policy" source="数据来源：中国政府网、国家发改委、工信部" />
     <FreshnessBadge fileKey="rockets" source="数据来源：公开信息综合整理" />

   口径：
   - 同时显示数据截至日、最近核验日和网站发布时间
   - 陈旧天数以 Date.now() 实时计算，禁止写死日期或天数
   - 不动 global.css；样式全在 freshness-badge.css，fb- 前缀隔离
   ============================================================ */
import { useData } from '../context/DataContext';
import '../styles/freshness-badge.css';

const STALE_DAYS = 30;

function ageInDays(dateStr) {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (!Number.isFinite(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

export default function FreshnessBadge({ fileKey, source }) {
  const { fileUpdatedAt, fileMeta } = useData();
  const asOf = fileUpdatedAt?.[fileKey] || null;
  const meta = fileMeta?.[fileKey] || {};
  const days = ageInDays(asOf);
  const stale = days != null && days > STALE_DAYS;

  return (
    <span className={`fb-badge${stale ? ' fb-badge--stale' : ''}`}>
      {source && <span className="fb-badge__source">{source} · </span>}
      <span className="fb-badge__time">
        数据截至 {meta.asOfDate || '未记录'} · 核验于 {meta.lastVerifiedAt || '未记录'} · 发布于 {meta.publishedAt || asOf || '未记录'}
      </span>
      {stale && <span className="fb-badge__warn">已 {days} 天未更新</span>}
    </span>
  );
}
