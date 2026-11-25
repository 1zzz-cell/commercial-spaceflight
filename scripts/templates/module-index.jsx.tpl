import { useData } from '../../context/DataContext';
import {
  Card, SectionTitle, StatCard, Grid, EmptyState, SourceTag, ExportBar,
  selectDataset, selectDatasetMeta, formatNumber,
} from '@portal';
import './styles.css';

/* ============================================
   {{MODULE_TITLE}}
   --------------------------------------------
   负责人：{{OWNER}}
   创建时间：{{DATE}}
   ============================================ */

export default function {{MODULE_ID}}() {
  const data = useData();

  // 统一走 @portal 的 selector 取数，不要直接深层访问 data.xxx.yyy
  const industry = selectDataset(data, 'industry');
  const events = industry.financingEvents || [];
  const meta = selectDatasetMeta(data, 'industry');

  return (
    <div className="portal-page {{MODULE_CLASS}}">
      <header className="{{MODULE_CLASS}}-hero">
        <h1 className="{{MODULE_CLASS}}-hero-title">{{MODULE_TITLE}}</h1>
        <p className="{{MODULE_CLASS}}-hero-sub">
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
              filename="{{MODULE_ID}}-明细"
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
            <ul className="{{MODULE_CLASS}}-list">
              {events.slice(0, 8).map((e, i) => (
                <li key={`${e.company}-${i}`} className="{{MODULE_CLASS}}-list-item">
                  <span className="{{MODULE_CLASS}}-company">{e.company}</span>
                  <span className="{{MODULE_CLASS}}-badge">{e.round}</span>
                  <span className="{{MODULE_CLASS}}-amount">{e.amount}</span>
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
