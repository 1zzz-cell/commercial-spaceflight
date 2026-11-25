import { useData } from '../../context/DataContext';
import {
  Card, SectionTitle, StatCard, Grid, EmptyState, SourceTag, ExportBar,
  selectDataset, selectDatasetMeta, formatNumber,
} from '@portal';
import './styles.css';

/* ============================================
   ⚠ 这是脚手架占位示例，不是正式页面
   --------------------------------------------
   由 `node scripts/create-module.mjs Research` 生成，仅用于演示
   @portal 的标准用法（取数 → Card/Grid → 导出），无真实业务内容。

   正式科研门户在 src/pages/Research.jsx（800+ 行，五个页签：
   数据字典 / 数据浏览 / 导出中心 / 溯源核查 / 更新日志）。

   要改科研门户请去那里；本文件保留作为模块骨架样例，请勿误改。
   创建时间：2026-10-17
   ============================================ */

export default function Research() {
  const data = useData();

  // 统一走 @portal 的 selector 取数，不要直接深层访问 data.xxx.yyy
  const industry = selectDataset(data, 'industry');
  const events = industry.financingEvents || [];
  const meta = selectDatasetMeta(data, 'industry');

  return (
    <div className="portal-page research">
      <header className="research-hero">
        <h1 className="research-hero-title">科研门户</h1>
        <p className="research-hero-sub">
          一句话说清这个页面解决谁的什么问题。数据更新于 {meta.lastUpdated || '—'}
        </p>
      </header>

      <section>
        <SectionTitle
          title="起步：换掉这个示例分区"
          subtitle="下面演示了取数、指标卡、表格、导出的标准写法，照着改即可"
        />
        <Grid columns="auto">
          <StatCard label="融资事件" value={formatNumber(events.length)} unit="条" icon="coins" />
          <StatCard label="覆盖赛道" value={formatNumber(new Set(events.map((e) => e.segment)).size)} unit="个" icon="layers" />
          <StatCard label="涉及区域" value={formatNumber(new Set(events.map((e) => e.region)).size)} unit="个" icon="globe" />
        </Grid>
      </section>

      <section>
        <SectionTitle
          title="明细数据"
          subtitle="直接用 @portal 的 DataTable，它已经带好排序 / 筛选 / 分页 / 导出"
          actions={
            <ExportBar
              filename="Research-明细"
              csv={{
                headers: ['企业', '轮次', '金额', '赛道', '日期'],
                rows: events.map((e) => [e.company, e.round, e.amount, e.segment, e.date]),
                source: meta.source || '中国商业航天产业分析平台',
                caliber: '融资事件原始明细，未经二次加工',
              }}
            />
          }
        />
        <Card>
          {events.length === 0 ? (
            <EmptyState text="没有加载到数据" hint="确认 public/data/industry.json 存在且含 financingEvents 字段" />
          ) : (
            <ul className="research-list">
              {events.slice(0, 8).map((e, i) => (
                <li key={`${e.company}-${i}`} className="research-list-item">
                  <span className="research-company">{e.company}</span>
                  <span className="research-badge">{e.round}</span>
                  <span className="research-amount">{e.amount}</span>
                  <SourceTag item={e} compact />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
