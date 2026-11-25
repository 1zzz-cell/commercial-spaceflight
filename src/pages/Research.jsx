/* ============================================================
   科研门户 /research —— 数据基础设施视角
   ------------------------------------------------------------
   定位：让每一个数字可复现、可引用、可导出。
   与投资分析工具的分工：本页讲「口径与溯源」，不讲「判断与前瞻」；
   同一份底层数据，两种任务层切片（见 .workbuddy/memory 信息架构决策）。

   五个页签：
     数据字典  —— 每个字段的中文名、单位口径、必填性、缺失率、示例值
     数据浏览  —— 六个数据集明细统一表格（嵌套结构由 flattenDataset 摊平）
     导出中心  —— CSV / JSON / BibTeX 一次给全，附引用规范
     溯源核查  —— 行级 verified / source / sourceUrl 覆盖率 + 待核实清单
     更新日志  —— 分文件更新时间（聚合值会掩盖陈旧）+ 各数据集记录粒度与来源

   纪律：取数一律走 @portal 的 selector，导出一律走 @portal 的 exporters，
        不在本文件再实现任何下载逻辑。
   ============================================================ */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useExportGuard } from '../components/ComplianceKit';
import {
  Card, SectionTitle, StatCard, SourceTag, ExportBar, EmptyState, Grid, Icon, DataTable,
  DATASETS, selectDataset, flattenDataset,
  formatNumber, credibilityOf, exportCSV,
} from '@portal';
import '../modules/_shared/sdk.css';
import '../styles/research.css';

/* ---------- 页签 ---------- */
const TABS = [
  { key: 'dict', label: '数据字典', icon: 'file' },
  { key: 'browser', label: '数据浏览', icon: 'layers' },
  { key: 'export', label: '导出中心', icon: 'download' },
  { key: 'provenance', label: '溯源核查', icon: 'target' },
  { key: 'changelog', label: '更新日志', icon: 'refresh' },
];

const DEFAULT_TAB = TABS[0].key;
const tabHash = (key) => `tab-${key}`;

/* ---------- 纳入科研门户的数据集（顺序即页内呈现顺序） ---------- */
const DS_KEYS = ['rockets', 'constellations', 'industry', 'chain', 'policy', 'market'];

/* ============================================================
   字段字典 —— 每个字段的中文名、单位口径、必填性
   缺失率与示例值由页面按真实数据实时计算，不写死
   ============================================================ */
const FIELD_DEFS = {
  rockets: [
    { key: 'name', label: '型号名称', required: true },
    { key: 'abbr', label: '代号', note: '可空' },
    { key: 'org', label: '研制单位', required: true },
    { key: 'propellant', label: '推进剂', note: '已归一化为「液氧/煤油」等类别' },
    { key: 'diameter', label: '箭体直径', unit: '米' },
    { key: 'leo', label: 'LEO 运力', unit: '吨' },
    { key: 'gto', label: 'GTO 运力', unit: '吨', note: '无 GTO 能力时为空' },
    { key: 'reusable', label: '可重复使用', note: '布尔' },
    { key: 'site', label: '发射工位', note: '可空' },
    { key: 'launches', label: '累计发射次数', unit: '次' },
    { key: 'firstFlight', label: '首飞时间', note: 'YYYY 或 YYYY-MM' },
    { key: 'status', label: '当前状态', note: '在役 / 在研等' },
    { key: 'successRate', label: '发射成功率', unit: '百分比数值', note: '在研型号未首飞，无成功率为正确缺失而非缺漏' },
    { key: 'costPerKg', label: '单位质量入轨成本', unit: '元/千克', note: '绝大多数为空' },
    { key: 'verified', label: '已核实', note: '布尔；行级未附来源链接，来源见数据集级说明' },
  ],
  constellations: [
    { key: 'name', label: '星座名称', required: true },
    { key: 'company', label: '运营方', required: true },
    { key: 'type', label: '星座类型', note: '通信 / 导航 / 遥感等' },
    { key: 'planned', label: '规划卫星总数', unit: '颗' },
    { key: 'actual', label: '已部署数量', unit: '颗', note: '随时间增长，非固定值' },
    { key: 'orbit', label: '目标轨道' },
    { key: 'frequency', label: '通信频段' },
    { key: 'satWeight', label: '单星质量', unit: '千克', note: '可空' },
    { key: 'firstLaunch', label: '首次发射时间' },
    { key: 'status', label: '部署状态' },
    { key: 'verified', label: '已核实', note: '布尔；行级未附来源链接' },
  ],
  industry: [
    { key: 'date', label: '披露时间', note: 'YYYY-MM', required: true },
    { key: 'company', label: '融资主体', required: true },
    { key: 'round', label: '融资轮次' },
    { key: 'amount', label: '披露金额', note: '原文文本（如「超5亿」），需经 parseFunding 归一为数值' },
    { key: 'segment', label: '所属赛道' },
    { key: 'investors', label: '投资方', note: '顿号分隔文本，非数组' },
    { key: 'region', label: '所在地区' },
  ],
  chain: [
    { key: 'stage', label: '产业环节', note: '上游 / 中游 / 下游', required: true },
    { key: 'category', label: '细分品类' },
    { key: 'name', label: '企业名称', required: true },
    { key: 'focus', label: '主营业务' },
    { key: 'region', label: '所在地区' },
  ],
  policy: [
    { key: '_level', label: '政策层级', note: '国家级 / 部委级 / 地方级，由 national / ministerial / local 派生' },
    { key: 'id', label: '政策编号' },
    { key: 'title', label: '政策标题', required: true },
    { key: 'date', label: '发布时间' },
    { key: 'org', label: '发布机构' },
    { key: 'type', label: '政策类型' },
    { key: 'summary', label: '内容摘要' },
    { key: 'source', label: '来源', note: '行级标注；多数未附原文链接' },
  ],
  market: [
    { key: 'indicator', label: '指标名称', required: true },
    { key: 'category', label: '指标类别', note: '市场规模 / 发射成本 / 星座部署 / 投融资等' },
    { key: 'region', label: '区域口径', note: '全球 / 中国' },
    { key: 'year', label: '年份' },
    { key: 'value', label: '归一化数值', note: '单位见 unit 字段' },
    { key: 'valueText', label: '原始文本', note: '保留报道原文，便于回溯' },
    { key: 'unit', label: '单位' },
    { key: 'source', label: '来源', note: '行级标注' },
    { key: 'sourceUrl', label: '原文链接', note: '行级' },
    { key: 'verified', label: '已核实', note: '布尔；无 sourceUrl 自动标记待核实' },
    { key: 'note', label: '口径备注', note: '可空' },
  ],
};

/* ---------- 数据浏览：各数据集表格列 ---------- */
const COLS = {
  rockets: [
    { key: 'name', label: '型号', render: (r) => (r.abbr ? `${r.name}（${r.abbr}）` : r.name) },
    { key: 'org', label: '研制单位' },
    { key: 'leo', label: 'LEO 运力(吨)', render: (r) => (r.leo ?? '—') },
    { key: 'status', label: '状态' },
    { key: 'launches', label: '累计发射(次)' },
    { key: 'successRate', label: '成功率(%)', render: (r) => (r.successRate ?? '—') },
    { key: 'reusable', label: '可复用', render: (r) => (r.reusable ? '是' : '否') },
  ],
  constellations: [
    { key: 'name', label: '星座' },
    { key: 'company', label: '运营方' },
    { key: 'planned', label: '规划(颗)' },
    { key: 'actual', label: '已部署(颗)' },
    { key: 'orbit', label: '轨道' },
    { key: 'status', label: '状态' },
  ],
  industry: [
    { key: 'date', label: '时间' },
    { key: 'company', label: '企业' },
    { key: 'round', label: '轮次' },
    { key: 'amount', label: '金额' },
    { key: 'segment', label: '赛道' },
    { key: 'region', label: '地区' },
  ],
  chain: [
    { key: 'name', label: '企业' },
    { key: 'stage', label: '环节' },
    { key: 'category', label: '品类' },
    { key: 'focus', label: '主营业务' },
    { key: 'region', label: '地区' },
  ],
  policy: [
    { key: 'title', label: '标题' },
    { key: '_level', label: '层级' },
    { key: 'org', label: '发布机构' },
    { key: 'date', label: '时间' },
    { key: 'type', label: '类型' },
  ],
  market: [
    { key: 'indicator', label: '指标' },
    { key: 'year', label: '年份' },
    { key: 'valueText', label: '数值(原文)', render: (r) => r.valueText ?? r.value ?? '—' },
    { key: 'unit', label: '单位' },
    { key: 'region', label: '区域' },
    {
      key: 'verified', label: '可信度', render: (r) => {
        const c = credibilityOf(r);
        return <span className="rs-tagcell" style={{ color: c.color }}>{c.label}</span>;
      },
    },
  ],
};

/* ---------- 数据浏览：筛选器 ---------- */
const FILTERS = {
  rockets: [{ key: 'status', label: '状态' }],
  constellations: [{ key: 'type', label: '类型' }],
  industry: [{ key: 'segment', label: '赛道' }, { key: 'region', label: '地区' }],
  chain: [{ key: 'stage', label: '环节' }],
  policy: [{ key: '_level', label: '层级' }, { key: 'type', label: '类型' }],
  market: [{ key: 'category', label: '类别' }],
};

/* ---------- 更新日志：各数据集的时间字段 ---------- */
const DATE_FIELD = {
  rockets: 'firstFlight',
  constellations: 'firstLaunch',
  industry: 'date',
  policy: 'date',
  market: 'year',
};

/* ============================================================
   通用计算助手
   ============================================================ */

/** 字段缺失率（0~1）；空串与 null/undefined 均计为缺失 */
function missingRate(rows, key) {
  if (!rows.length) return 0;
  const miss = rows.filter((r) => r[key] === null || r[key] === undefined || r[key] === '').length;
  return miss / rows.length;
}

/** 数据集级来源：loader 对 chain/market 做了改名，此处抹平 */
function datasetSourceOf(data, key) {
  const ds = selectDataset(data, key);
  if (ds.source) return ds.source;
  if (key === 'market') return data?.market?.marketSource || null;
  if (key === 'chain') return data?.chain?.chainSource || null;
  return null;
}

/** 行级可信度：行无来源时回退到数据集级来源，再回退到 verified 标记 */
function rowTrace(row, dsSource) {
  if (row.source) return credibilityOf(row);
  if (row.verified === true) {
    return { level: 'verified', label: '已核实', color: 'var(--accent-green)', desc: '行级 verified 为真；未附行级来源链接，来源见数据集级说明' };
  }
  return credibilityOf(dsSource ? { source: dsSource } : {});
}

/** 清单行的展示名 */
function rowLabel(key, row) {
  if (key === 'industry') return `${row.company || '未知企业'}${row.round ? ` · ${row.round}` : ''}`;
  if (key === 'market') return `${row.indicator || '未知指标'}（${row.year ?? '—'}）`;
  return row.title || row.name || '未命名条目';
}

/** 数据内最新记录（时间字段的字符串最大值，仅反映记录粒度） */
function latestRecord(rows, key) {
  const field = DATE_FIELD[key];
  if (!field || !rows.length) return '—';
  const vals = rows.map((r) => r[field]).filter((v) => v !== null && v !== undefined && v !== '');
  if (!vals.length) return '—';
  return vals.map(String).sort().pop();
}

/** 溯源统计 */
function buildProvenance(data, key) {
  const rows = flattenDataset(data, key);
  return {
    key,
    rows,
    total: rows.length,
    verified: rows.filter((r) => r.verified === true).length,
    withSource: rows.filter((r) => r.source).length,
    withUrl: rows.filter((r) => r.sourceUrl).length,
    dsSource: datasetSourceOf(data, key),
    pending: rows.filter((r) => !r.source && r.verified !== true),
  };
}

const pct = (n, d) => (d > 0 ? `${((n / d) * 100).toFixed(0)}%` : '—');

/* ============================================================
   页签一：数据字典
   ============================================================ */
function DictionaryTab({ data }) {
  const { requireConfirm } = useExportGuard();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {DS_KEYS.map((key) => {
        const rows = flattenDataset(data, key);
        const defs = FIELD_DEFS[key];
        const dictRows = defs.map((f) => {
          const rate = missingRate(rows, f.key);
          const sample = rows.map((r) => r[f.key]).find((v) => v !== null && v !== undefined && v !== '');
          return { ...f, rate, sample };
        });
        return (
          <Card key={key}>
            <SectionTitle
              title={`${DATASETS[key].label}（${rows.length} 条）`}
              subtitle={DATASETS[key].desc}
              actions={(
                <ExportBar
                  guard={requireConfirm}
                  filename={`数据字典-${DATASETS[key].label}`}
                  csv={{
                    headers: ['字段', '中文名', '单位/口径', '必填', '缺失率', '示例值'],
                    rows: dictRows.map((f) => [
                      f.key, f.label,
                      [f.unit, f.note].filter(Boolean).join('；') || '—',
                      f.required ? '是' : '可空',
                      `${(f.rate * 100).toFixed(0)}%`,
                      f.sample === undefined ? '—' : String(f.sample).slice(0, 40),
                    ]),
                    source: datasetSourceOf(data, key) || '见数据集级说明',
                    caliber: `缺失率按 ${rows.length} 条明细实时计算`,
                  }}
                />
              )}
            />
            <div className="constellation-table-wrap">
              <table className="constellation-table">
                <thead>
                  <tr>
                    <th>字段</th>
                    <th>中文名</th>
                    <th>单位 / 口径</th>
                    <th>必填</th>
                    <th>缺失率</th>
                    <th>示例值</th>
                  </tr>
                </thead>
                <tbody>
                  {dictRows.map((f) => (
                    <tr key={f.key}>
                      <td className="rs-mono">{f.key}</td>
                      <td>{f.label}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        {[f.unit, f.note].filter(Boolean).join('；') || '—'}
                      </td>
                      <td>{f.required ? '是' : '可空'}</td>
                      <td>
                        <span className="rs-bar">
                          <span className="rs-bar-track">
                            <span
                              className={`rs-bar-fill ${f.rate > 0.5 ? 'rs-bar-fill-high' : ''}`}
                              style={{ width: `${Math.max(f.rate * 100, 2)}%` }}
                            />
                          </span>
                          <span className="rs-bar-text">{(f.rate * 100).toFixed(0)}%</span>
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.sample === undefined ? '—' : String(f.sample).slice(0, 40)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ============================================================
   页签二：原始数据浏览
   ============================================================ */
function BrowserTab({ data }) {
  const { requireConfirm } = useExportGuard();
  const [active, setActive] = useState('rockets');
  const rows = flattenDataset(data, active);
  const meta = DATASETS[active];

  return (
    <div>
      <div className="rs-chips" role="tablist" aria-label="数据集切换">
        {DS_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active === key}
            className={`rs-chip ${active === key ? 'rs-chip-active' : ''}`}
            onClick={() => setActive(key)}
          >
            {DATASETS[key].label}
            <span className="rs-chip-count">{flattenDataset(data, key).length}</span>
          </button>
        ))}
      </div>

      <Card>
        <SectionTitle
          title={`${meta.label}明细`}
          subtitle={`${meta.desc}${meta.notes ? `。注意：${meta.notes}` : ''}`}
          actions={<span className="rs-note">支持排序 / 筛选 / 分页；导出走统一口径</span>}
        />
        {rows.length > 0 ? (
          <DataTable
            key={active}
            exportGuard={requireConfirm}
            data={rows}
            columns={COLS[active]}
            filename={`商业航天${meta.label}`}
            pageSize={12}
            filters={FILTERS[active]}
          />
        ) : (
          <EmptyState text="该数据集暂无明细" hint="请检查数据文件是否正常加载" />
        )}
      </Card>

      <Card style={{ marginTop: 20 }}>
        <p className="rs-note">
          <strong>关于嵌套结构：</strong>政策法规在源数据中按国家级 / 部委级 / 地方级分三组存放，
          产业链企业矩阵为「环节 → 品类 → 企业」三层嵌套。本页与全部导出均已通过
          <code> flattenDataset </code>
          摊平为「一行一条」，摊平时为政策补充 <code>_level</code> 字段保留层级信息，不会丢失原始结构。
        </p>
      </Card>
    </div>
  );
}

/* ============================================================
   页签三：导出中心
   ============================================================ */
function ExportTab({ data }) {
  const { requireConfirm } = useExportGuard();
  const [selected, setSelected] = useState('all');

  const allRows = useMemo(
    () => DS_KEYS.flatMap((key) => flattenDataset(data, key).map((row) => ({
      _dataset: key,
      _datasetLabel: DATASETS[key].label,
      ...row,
    }))),
    [data],
  );

  const allHeaders = useMemo(() => {
    const seen = [];
    allRows.forEach((r) => Object.keys(r).forEach((h) => { if (!seen.includes(h)) seen.push(h); }));
    return seen;
  }, [allRows]);

  const rows = selected === 'all' ? allRows : flattenDataset(data, selected);
  const headers = selected === 'all'
    ? allHeaders
    : FIELD_DEFS[selected].map((f) => f.key);
  const label = selected === 'all' ? '五链明细全集' : DATASETS[selected].label;
  const caliber = selected === 'all'
    ? '六个数据集明细合并导出，_dataset / _datasetLabel 标注来源数据集；导出的永远是可读原文与原始数值，不做显示层归一'
    : `${DATASETS[selected].desc}。${DATASETS[selected].notes || ''}`;
  const source = selected === 'all'
    ? '中国商业航天产业分析平台（/research）'
    : `中国商业航天产业分析平台 ${DATASETS[selected].route}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <SectionTitle title="选择导出范围" subtitle="单个数据集或五链加市场的明细全集" />
        <div className="rs-chips">
          <button
            type="button"
            className={`rs-chip ${selected === 'all' ? 'rs-chip-active' : ''}`}
            onClick={() => setSelected('all')}
          >
            全部明细
            <span className="rs-chip-count">{allRows.length}</span>
          </button>
          {DS_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              className={`rs-chip ${selected === key ? 'rs-chip-active' : ''}`}
              onClick={() => setSelected(key)}
            >
              {DATASETS[key].label}
              <span className="rs-chip-count">{flattenDataset(data, key).length}</span>
            </button>
          ))}
        </div>

        <div className="rs-kv">
          <div className="rs-kv-item">
            <span className="rs-kv-label">将导出条数</span>
            <span className="rs-kv-value">{formatNumber(rows.length)} 条</span>
          </div>
          <div className="rs-kv-item">
            <span className="rs-kv-label">字段数</span>
            <span className="rs-kv-value">{headers.length} 个</span>
          </div>
          <div className="rs-kv-item">
            <span className="rs-kv-label">数据更新时间</span>
            <span className="rs-kv-value">{data.lastUpdated || '—'}</span>
          </div>
        </div>

        <p className="rs-note" style={{ marginBottom: 14 }}>
          <strong>统计口径：</strong>{caliber}
        </p>

        <ExportBar
          guard={requireConfirm}
          filename={`商业航天${label}`}
          csv={{
            headers,
            rows: rows.map((r) => headers.map((h) => r[h])),
            source,
            caliber,
          }}
          jsonData={rows}
          bib={{
            title: `中国商业航天${label}数据集`,
            note: `共 ${rows.length} 条明细；${caliber}`,
          }}
        />
      </Card>

      <Grid columns="auto">
        <Card>
          <h3 className="rs-spec-title">
            <span className="rs-spec-icon"><Icon name="file" size={16} /></span>
            CSV 规范
          </h3>
          <p className="rs-note">
            表头下方附带 <code>#</code> 前缀的 meta 行（来源、口径、导出时间），
            pandas 可用 <code>read_csv(comment=&#39;#&#39;)</code> 直接读取；
            文件带 BOM，Excel 双击打开中文不乱码。
          </p>
        </Card>
        <Card>
          <h3 className="rs-spec-title">
            <span className="rs-spec-icon"><Icon name="layers" size={16} /></span>
            JSON 规范
          </h3>
          <p className="rs-note">
            以 <code>_meta</code> 字段包裹来源、口径与导出时间，
            <code>data</code> 为原始明细数组，保留全部字段与原始数值，便于程序复用。
          </p>
        </Card>
        <Card>
          <h3 className="rs-spec-title">
            <span className="rs-spec-icon"><Icon name="external" size={16} /></span>
            BibTeX 引用
          </h3>
          <p className="rs-note">
            生成 <code>@misc</code> 条目，含作者、年份、访问地址与访问日期，论文引用可直接粘贴：
          </p>
          <pre className="rs-code">{`@misc{commercialspace:dataset,
  title  = {中国商业航天${label}数据集},
  author = {中国商业航天产业分析平台},
  year   = ${new Date().getFullYear()},
}`}</pre>
        </Card>
      </Grid>
    </div>
  );
}

/* ============================================================
   页签四：溯源核查
   ============================================================ */
function ProvenanceTab({ data }) {
  const stats = DS_KEYS.map((key) => buildProvenance(data, key));
  const pendingItems = stats.flatMap((s) =>
    s.pending.map((row) => ({ key: s.key, row, dsSource: s.dsSource })),
  );
  const shown = pendingItems.slice(0, 40);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <SectionTitle
          title="来源覆盖率"
          subtitle="按数据集统计行级来源标注与核实标记的覆盖情况"
          actions={<span className="rs-note">实时按当前数据计算</span>}
        />
        <div className="constellation-table-wrap">
          <table className="constellation-table">
            <thead>
              <tr>
                <th>数据集</th>
                <th>总条数</th>
                <th>已核实(verified)</th>
                <th>行级来源</th>
                <th>行级原文链接</th>
                <th>数据集级来源</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.key}>
                  <td>
                    <Link className="rs-ds-link" to={DATASETS[s.key].route}>{DATASETS[s.key].label}</Link>
                  </td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{s.total}</td>
                  <td>
                    <span className="rs-bar">
                      <span className="rs-bar-track">
                        <span className="rs-bar-fill" style={{ width: `${s.total ? (s.verified / s.total) * 100 : 0}%` }} />
                      </span>
                      <span className="rs-bar-text">{pct(s.verified, s.total)}</span>
                    </span>
                  </td>
                  <td>
                    <span className="rs-bar">
                      <span className="rs-bar-track">
                        <span
                          className={`rs-bar-fill ${s.total && s.withSource / s.total < 0.5 ? 'rs-bar-fill-high' : ''}`}
                          style={{ width: `${s.total ? (s.withSource / s.total) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="rs-bar-text">{pct(s.withSource, s.total)}</span>
                    </span>
                  </td>
                  <td>
                    <span className="rs-bar">
                      <span className="rs-bar-track">
                        <span
                          className={`rs-bar-fill ${s.total && s.withUrl / s.total < 0.5 ? 'rs-bar-fill-high' : ''}`}
                          style={{ width: `${s.total ? (s.withUrl / s.total) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="rs-bar-text">{pct(s.withUrl, s.total)}</span>
                    </span>
                  </td>
                  <td className="rs-tagcell">
                    {s.dsSource
                      ? <SourceTag item={{ source: s.dsSource }} compact />
                      : <span style={{ color: 'var(--text-muted)' }}>未标注</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rs-note" style={{ marginTop: 14 }}>
          <strong>怎么读这张表：</strong>「已核实」统计行级 <code>verified</code> 标记为真的比例；
          「行级来源 / 行级原文链接」统计每条明细自带 <code>source</code> / <code>sourceUrl</code> 的比例。
          火箭与星座的行级未附来源链接，其可信度依据数据集级来源说明；
          产业链企业矩阵源数据即无行级来源字段，引用时请同时标注数据集级来源。
        </p>
      </Card>

      <Card>
        <SectionTitle
          title="待核实清单"
          subtitle={`既无行级来源、verified 也未标记为真的条目，共 ${pendingItems.length} 条`}
        />
        {shown.length > 0 ? (
          <div className="rs-pending">
            {shown.map(({ key, row, dsSource }, i) => {
              const trace = rowTrace(row, dsSource);
              return (
                <div className="rs-pending-item" key={`${key}-${i}`}>
                  <span className="rs-pending-name">
                    <span className="rs-pending-ds">{DATASETS[key].label}</span>
                    {rowLabel(key, row)}
                  </span>
                  <SourceTag item={{ source: row.source || dsSource, sourceUrl: row.sourceUrl }} />
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState text="全部条目均带来源或已核实" hint="数据治理门禁运行正常" />
        )}
        {pendingItems.length > shown.length && (
          <p className="rs-note" style={{ marginTop: 12 }}>
            仅展示前 {shown.length} 条，其余 {pendingItems.length - shown.length} 条可在「数据浏览」页签按数据集逐条查看。
          </p>
        )}
      </Card>
    </div>
  );
}

/* ============================================================
   页签五：更新日志
   ============================================================ */

/* 数据文件 → 中文名（geo 的文件叫 geoData.json，此处 key 沿用 dataLoader 的命名） */
const FILE_LABELS = {
  rockets: '火箭型号',
  constellations: '卫星星座',
  industry: '产业与融资',
  chain: '产业链企业',
  policy: '政策法规',
  dashboard: '首页总览',
  geo: '区域分布',
  market: '市场指标',
};

/* 超过这个天数视为陈旧，与 scripts/data-status.mjs 的默认阈值一致 */
const STALE_DAYS = 30;

/**
 * 各数据文件的更新时间表
 * 为什么单列：return 出去的 data.lastUpdated 是取最大值的聚合值，
 * 会掩盖「某个文件其实很久没更新」，这里把每个文件摊开、最旧排在前。
 */
function FileUpdatedTable({ fileUpdatedAt, fileMeta }) {
  const entries = Object.entries(fileUpdatedAt || {});
  if (entries.length === 0) return null;

  const rows = entries
    .map(([key, ts]) => {
      let days = null;
      if (ts) {
        const t = new Date(ts);
        if (!Number.isNaN(t.getTime())) days = Math.floor((Date.now() - t.getTime()) / 86400000);
      }
      return { key, ts, days };
    })
    .sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity));

  return (
    <div className="constellation-table-wrap" style={{ marginTop: 14 }}>
      <table className="constellation-table">
        <thead>
          <tr>
            <th>数据集</th>
            <th>内容</th>
            <th>发布时间 / 数据截至日</th>
            <th>距今天数</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, ts, days }) => (
            <tr key={key}>
              <td className="rs-mono">{key}</td>
              <td>{FILE_LABELS[key] || key}</td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                发布 {fileMeta?.[key]?.publishedAt || ts || '未标注'}<br />
                截至 {fileMeta?.[key]?.asOfDate || '未记录'} · 核验 {fileMeta?.[key]?.lastVerifiedAt || '未记录'}
              </td>
              <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                {days == null ? '—' : (
                  <span style={{ color: days > STALE_DAYS ? 'var(--accent-amber)' : undefined }}>
                    {days} 天{days > STALE_DAYS ? ' ⚠' : ''}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangelogTab({ data }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Card>
        <SectionTitle title="全站数据更新时间" subtitle="自动化管线每日更新，入库前经过数据治理门禁" />
        <div className="rs-kv">
          <div className="rs-kv-item">
            <span className="rs-kv-label">当前数据版本</span>
            <span className="rs-kv-value">{data.lastUpdated || '—'}</span>
          </div>
          <div className="rs-kv-item">
            <span className="rs-kv-label">纳入数据集</span>
            <span className="rs-kv-value">{DS_KEYS.length} 个</span>
          </div>
          <div className="rs-kv-item">
            <span className="rs-kv-label">明细记录总数</span>
            <span className="rs-kv-value">
              {formatNumber(DS_KEYS.reduce((sum, k) => sum + flattenDataset(data, k).length, 0))} 条
            </span>
          </div>
        </div>
        <FileUpdatedTable fileUpdatedAt={data.fileUpdatedAt} fileMeta={data.fileMeta} />
        <p className="rs-note">
          <strong>口径说明：</strong>上方同时列出网站发布时间、数据截至日和最近核验日；
          本页顶部「当前数据版本」取的是这些值中的<strong>最大值</strong>，
          因此聚合值看起来很新时，个别文件可能已经陈旧——这就是为什么下面要分开列。
          「数据内最新记录」（见下方表）是数据集明细里时间字段的最大值，
          仅反映记录粒度，不代表文件更新时间。
          命令行体检：<code>npm run data:status</code>。
        </p>
      </Card>

      <Card>
        <SectionTitle title="各数据集记录快照" subtitle="条目数、数据内最新记录与来源" />
        <div className="constellation-table-wrap">
          <table className="constellation-table">
            <thead>
              <tr>
                <th>数据集</th>
                <th>条目数</th>
                <th>时间字段</th>
                <th>数据内最新记录</th>
                <th>数据集级来源</th>
              </tr>
            </thead>
            <tbody>
              {DS_KEYS.map((key) => {
                const rows = flattenDataset(data, key);
                const dsSource = datasetSourceOf(data, key);
                return (
                  <tr key={key}>
                    <td>
                      <Link className="rs-ds-link" to={DATASETS[key].route}>{DATASETS[key].label}</Link>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{rows.length}</td>
                    <td className="rs-mono">{DATE_FIELD[key] || '—'}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{latestRecord(rows, key)}</td>
                    <td className="rs-tagcell">
                      {dsSource
                        ? <SourceTag item={{ source: dsSource }} compact />
                        : <span style={{ color: 'var(--text-muted)' }}>未标注</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <SectionTitle title="更新与收录规则" />
        <ul className="rs-note rs-note-list">
          <li>新增条目必须携带 <code>source</code>；无来源的条目在数据治理门禁（<code>npm run validate:data</code>）中被丢弃。</li>
          <li>无 <code>sourceUrl</code> 的条目自动标记为「待核实」，前端以可视化分级呈现，不做掩饰。</li>
          <li>受保护字段禁止自动化改动，人工修订需走数据更新流程并留痕。</li>
          <li>本页所有数字均由当前数据实时计算，不存在写死的统计值。</li>
        </ul>
      </Card>
    </div>
  );
}

/* ============================================================
   主组件
   ============================================================ */
function Research() {
  const data = useData();
  const location = useLocation();
  const navigate = useNavigate();
  const tabRefs = useRef({});

  /* 页签状态放在 URL hash 上：可深链、可分享、浏览器前进后退可回退 */
  const activeTab = useMemo(() => {
    const key = (location.hash || '').replace('#tab-', '');
    return TABS.some((t) => t.key === key) ? key : DEFAULT_TAB;
  }, [location.hash]);

  const goTab = useCallback((key) => {
    navigate(`${location.pathname}#${tabHash(key)}`, { replace: true });
    tabRefs.current[key]?.focus({ preventScroll: true });
  }, [location.pathname, navigate]);

  /* 页签键盘导航：← → 切换，Home / End 跳首尾 */
  const onTabKeyDown = (e) => {
    const idx = TABS.findIndex((t) => t.key === activeTab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
      goTab(TABS[next].key);
    } else if (e.key === 'Home') {
      e.preventDefault();
      goTab(TABS[0].key);
    } else if (e.key === 'End') {
      e.preventDefault();
      goTab(TABS[TABS.length - 1].key);
    }
  };

  const allRows = useMemo(
    () => DS_KEYS.flatMap((key) => flattenDataset(data, key)),
    [data],
  );
  const verifiedRows = allRows.filter((r) => 'verified' in r);
  const verifiedRate = verifiedRows.length
    ? verifiedRows.filter((r) => r.verified === true).length / verifiedRows.length
    : 0;

  return (
    <div className="page-container ds-page">
      <section className="page-header">
        <h1 className="page-title">数据与溯源</h1>
        <p className="page-desc">
          查看字段定义、数据明细、来源覆盖和各数据集的更新时间。导出前可核对引用所需的来源与口径。
        </p>
        <span className="data-source-badge">全部明细支持 CSV / JSON / BibTeX 导出</span>
        <p className="rs-head-extra">
          需要决策视角？<Link to="/investors">前往投资分析工具 →</Link>
        </p>
      </section>

      <Grid columns="auto" gap={16}>
        <StatCard label="收录数据集" value={DS_KEYS.length} unit="个" sub="火箭·星座·融资·产业链·政策·市场" icon="layers" />
        <StatCard label="明细记录" value={formatNumber(allRows.length)} unit="条" sub="跨数据集可逐条导出" icon="file" />
        <StatCard
          label="已核实标记覆盖"
          value={`${(verifiedRate * 100).toFixed(0)}%`}
          sub={`${verifiedRows.filter((r) => r.verified === true).length} / ${verifiedRows.length} 条带 verified 字段`}
          icon="check"
        />
        <StatCard label="数据更新时间" value={data.lastUpdated || '—'} sub="全站聚合值" icon="refresh" />
      </Grid>

      <div style={{ marginTop: 28 }}>
        <div className="tab-bar" role="tablist" aria-label="数据与溯源页签" onKeyDown={onTabKeyDown}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`rs-tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`rs-panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              ref={(el) => { tabRefs.current[tab.key] = el; }}
              className={`tab-btn ${activeTab === tab.key ? 'tab-active' : ''}`}
              onClick={() => goTab(tab.key)}
            >
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        <div
          id={`rs-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`rs-tab-${activeTab}`}
          tabIndex={0}
        >
          {activeTab === 'dict' && <DictionaryTab data={data} />}
          {activeTab === 'browser' && <BrowserTab data={data} />}
          {activeTab === 'export' && <ExportTab data={data} />}
          {activeTab === 'provenance' && <ProvenanceTab data={data} />}
          {activeTab === 'changelog' && <ChangelogTab data={data} />}
        </div>
      </div>
    </div>
  );
}

export default Research;

