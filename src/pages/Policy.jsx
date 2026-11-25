import { useState, useMemo, useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { useData } from '../context/DataContext';
import { registerSearchData } from '../components/GlobalSearch';
import Icon from '../components/Icon';
import { buildToolbox } from '../utils/chartTools';
import { exportCSV, EXPORT_DISCLAIMER } from '@portal';
import { useDisclaimerGuard } from '../components/ComplianceKit';
import ChartExportButton from '../components/ChartExportButton';
import FreshnessBadge from '../components/FreshnessBadge';

const COLORS = {
  blue: '#0d8af0', purple: '#8b5cf6', orange: '#f06235',
  green: '#10b981', cyan: '#06b6d4', amber: '#f59e0b',
  gridLine: 'rgba(0,0,0,0.05)', axisLabel: '#5a6380',
  tooltipBg: 'rgba(255,255,255,0.96)',
};

const typeColorPalette = [COLORS.blue, COLORS.orange, COLORS.purple, COLORS.green, COLORS.cyan, COLORS.amber, '#8890a8', '#ec4899'];

const tabs = [
  { key: 'national', label: '国家级' },
  { key: 'ministerial', label: '部委级' },
  { key: 'local', label: '地方级' },
];

/* 高亮关键词 */
function HighlightText({ text, keyword }) {
  if (!keyword || !keyword.trim()) return text;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <mark key={i} className="search-highlight">{part}</mark>
    ) : (
      part
    )
  );
}

/* 导出统一走 @portal exporters（全站唯一 CSV 实现，含来源/口径/免责 meta 行） */
const POLICY_CSV_HEADERS = ['政策标题', '发布日期', '发布机构', '类型', '内容摘要', '来源'];

/* 政策趋势图 */
function PolicyTrendChart({ policyTrend }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  // 工具箱图标与原生按钮共用同一份载荷，避免口径漂移。
  const csv = {
    headers: ['年份', '政策数量(项)'],
    rows: policyTrend.years.map((y, i) => [y, policyTrend.counts[i]]),
    source: policyTrend.source,
    caliber: '按库内政策发布日期年份统计（代表性政策样本，非全量普查）',
  };
  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);
    const option = {
      tooltip: { trigger: 'axis', backgroundColor: COLORS.tooltipBg, textStyle: { color: '#1a1f36' } },
      grid: { left: 48, right: 20, top: 36, bottom: 28 },
      xAxis: { type: 'category', data: policyTrend.years, axisLabel: { color: COLORS.axisLabel, fontSize: 11 }, axisLine: { lineStyle: { color: 'rgba(0,0,0,0.08)' } }, axisTick: { show: false } },
      yAxis: { type: 'value', name: '项', nameTextStyle: { color: COLORS.axisLabel, fontSize: 10 }, axisLabel: { color: COLORS.axisLabel, fontSize: 10 }, axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.gridLine } } },
      series: [{
        type: 'line', smooth: true, symbol: 'circle', symbolSize: 6,
        lineStyle: { color: COLORS.blue, width: 2 }, itemStyle: { color: COLORS.blue },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: COLORS.blue + '30' }, { offset: 1, color: COLORS.blue + '05' }]) },
        data: policyTrend.counts,
      }],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '政策发布趋势',
        csv,
      }),
    };
    instanceRef.current.setOption(option);
    const h = () => instanceRef.current?.resize();
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); instanceRef.current?.dispose(); };
  }, []);
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-title">政策发布趋势</h3>
        <p className="chart-desc">2014-2025 年商业航天相关政策发布数量变化</p>
        <ChartExportButton filename="政策发布趋势" csv={csv} />
      </div>
      <div ref={chartRef} className="chart-container" style={{ height: '280px' }} />
    </div>
  );
}

/* 政策类型分布 */
function PolicyTypePieChart({ policyTypeStats }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);
    const option = {
      tooltip: { trigger: 'item', backgroundColor: COLORS.tooltipBg, textStyle: { color: '#1a1f36' }, formatter: '{b}<br/>数量：{c} 项 ({d}%)' },
      legend: { orient: 'horizontal', bottom: 4, itemWidth: 10, itemHeight: 10, itemGap: 12, textStyle: { color: COLORS.axisLabel, fontSize: 11 } },
      series: [{
        type: 'pie', radius: ['40%', '68%'], center: ['50%', '44%'],
        itemStyle: { borderColor: '#fff', borderWidth: 2 }, label: { show: false },
        data: policyTypeStats.map((d, i) => ({ name: d.type, value: d.count, itemStyle: { color: typeColorPalette[i % typeColorPalette.length] } })),
      }],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '政策类型分布',
        zoom: false,
        csv: {
          headers: ['政策类型', '数量(项)'],
          rows: policyTypeStats.map((d) => [d.type, d.count]),
          source: '中国政府网、国家发改委、工信部等公开文件（库内25项）',
        },
      }),
    };
    instanceRef.current.setOption(option);
    const h = () => instanceRef.current?.resize();
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); instanceRef.current?.dispose(); };
  }, []);
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-title">政策类型分布</h3>
        <p className="chart-desc">按政策属性分类的占比情况</p>
      </div>
      <div ref={chartRef} className="chart-container" style={{ height: '280px' }} />
    </div>
  );
}

/* 关键词词频图 */
function PolicyWordFreqChart({ policyWordFreq }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);
    const data = [...policyWordFreq.data].sort((a, b) => a.value - b.value);
    const option = {
      tooltip: { trigger: 'axis', backgroundColor: COLORS.tooltipBg, textStyle: { color: '#1a1f36' }, axisPointer: { type: 'shadow' } },
      grid: { left: 90, right: 60, top: 12, bottom: 16 },
      xAxis: { type: 'value', axisLabel: { color: COLORS.axisLabel, fontSize: 10 }, axisLine: { show: false }, splitLine: { lineStyle: { color: COLORS.gridLine } } },
      yAxis: { type: 'category', data: data.map((d) => d.name), axisLabel: { color: COLORS.axisLabel, fontSize: 11 }, axisLine: { lineStyle: { color: 'rgba(0,0,0,0.08)' } }, axisTick: { show: false } },
      series: [{
        type: 'bar', barWidth: 12,
        itemStyle: { borderRadius: [0, 4, 4, 0], color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: COLORS.purple }, { offset: 1, color: COLORS.blue }]) },
        label: { show: true, position: 'right', fontSize: 11, color: COLORS.axisLabel, formatter: '{c}' },
        data: data.map((d) => d.value),
      }],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '政策高频关键词词频',
        zoom: false,
        csv: {
          headers: ['关键词', '出现次数(次)'],
          rows: data.map((d) => [d.name, d.value]),
          source: '本平台收录政策标题与摘要语料',
          caliber: `按${policyWordFreq.dictionarySize || '预定义'}个领域术语词典匹配计数（非分词估算），语料库${policyWordFreq.corpusEntries || 25}条`,
        },
      }),
    };
    instanceRef.current.setOption(option);
    const h = () => instanceRef.current?.resize();
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); instanceRef.current?.dispose(); };
  }, []);
  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-title">政策高频关键词</h3>
        <p className="chart-desc">
          基于本平台收录的 {policyWordFreq.corpusEntries || 25} 条政策标题与摘要，按 {policyWordFreq.dictionarySize || ''} 个预定义领域术语做词典匹配统计（非分词估算，结果可重现）
        </p>
      </div>
      <div ref={chartRef} className="chart-container" style={{ height: '420px' }} />
      <p className="ds-inline-note">
        方法：{policyWordFreq.method}
      </p>
    </div>
  );
}

/* 政策层级 × 政策工具 热力矩阵
   20 个原始类型按透明字典归并为 7 大工具类（归并关系在图注与 CSV 中公开，非官方分类） */
const TOOL_CATEGORIES = [
  { tool: '规划与顶层设计', raw: ['发展规划', '五年规划', '行业规划', '白皮书', '政府工作报告'] },
  { tool: '准入与市场开放', raw: ['准入开放', '业务准入优化', '外商投资', '民间投资促进'] },
  { tool: '财税与产业扶持', raw: ['税收优惠', '产业扶持', '地方产业政策'] },
  { tool: '行动计划落地', raw: ['行动计划', '地方行动方案', '地方综合政策'] },
  { tool: '规范与标准', raw: ['行业规范', '标准体系'] },
  { tool: '基础设施与军民融合', raw: ['新基建', '军民融合'] },
  { tool: '国际合作', raw: ['国际合作'] },
];
const RAW_TO_TOOL = new Map(TOOL_CATEGORIES.flatMap((c) => c.raw.map((r) => [r, c.tool])));
const LEVELS = [
  { key: 'national', label: '国家级' },
  { key: 'ministerial', label: '部委级' },
  { key: 'local', label: '地方级' },
];

function PolicyToolMatrix({ policyData }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  // 展平全部政策并附层级/工具类
  const flat = LEVELS.flatMap((lv) =>
    (policyData[lv.key] || []).map((p) => ({
      level: lv.label, type: p.type,
      tool: RAW_TO_TOOL.get(p.type) || '其他',
      ...p,
    }))
  );
  const toolNames = TOOL_CATEGORIES.map((c) => c.tool);
  const levelLabels = LEVELS.map((l) => l.label);
  const maxCount = Math.max(1, ...toolNames.map((t) => levelLabels.length && levelLabels.reduce((s, lv) =>
    s + flat.filter((p) => p.level === lv && p.tool === t).length, 0)));

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);

    const cells = levelLabels.flatMap((lv, yi) =>
      toolNames.map((t, xi) => {
        const items = flat.filter((p) => p.level === lv && p.tool === t);
        return { value: [xi, yi, items.length], items };
      })
    );

    const option = {
      tooltip: {
        backgroundColor: COLORS.tooltipBg,
        borderColor: 'rgba(13,138,240,0.25)',
        textStyle: { color: '#1a1f36', fontSize: 12 },
        formatter: (p) => {
          const items = p.data.items;
          if (!items.length) return `<b>${levelLabels[p.data.value[1]]} · ${toolNames[p.data.value[0]]}</b><br/>暂无政策`;
          const list = items.map((x) => `· ${x.date} 《${x.title}》（${x.org}）`).join('<br/>');
          return `<b>${levelLabels[p.data.value[1]]} · ${toolNames[p.data.value[0]]}</b><br/>共 <b>${items.length}</b> 项<br/>${list}`;
        },
      },
      grid: { left: 72, right: 24, top: 30, bottom: 88 },
      xAxis: {
        type: 'category', data: toolNames, splitArea: { show: true },
        axisLabel: { color: COLORS.axisLabel, fontSize: 11, interval: 0, rotate: 22 },
        axisLine: { lineStyle: { color: 'rgba(0,0,0,0.1)' } },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'category', data: levelLabels, splitArea: { show: true },
        axisLabel: { color: COLORS.axisLabel, fontSize: 12, fontWeight: 600 },
        axisLine: { lineStyle: { color: 'rgba(0,0,0,0.1)' } },
        axisTick: { show: false },
      },
      visualMap: {
        min: 0, max: maxCount, calculable: true, orient: 'horizontal',
        left: 'center', bottom: 8, itemWidth: 14, itemHeight: 120,
        text: ['多', '少'], textStyle: { color: COLORS.axisLabel, fontSize: 11 },
        inRange: { color: ['#eef3fb', '#bfdbfe', '#60a5fa', '#1d4ed8'] },
      },
      series: [{
        type: 'heatmap',
        data: cells,
        label: {
          show: true,
          formatter: (p) => (p.data.value[2] > 0 ? p.data.value[2] : '—'),
          color: '#0f172a', fontSize: 13, fontWeight: 600,
        },
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(29,78,216,0.4)' } },
      }],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '政策工具热力矩阵',
        zoom: false,
        csv: {
          headers: ['层级', '工具大类(归并)', '原始类型', '发布日期', '发布机构', '政策标题', '来源'],
          rows: flat.map((p) => [p.level, p.tool, p.type, p.date, p.org, p.title, p.source]),
          source: '中国政府网、国家发改委、工信部、国防科工局及地方政府公开文件（库内25项）',
          caliber: '工具大类为依据原始类型字段的研究性归并（非官方分类）；格内数字为政策项数；样本为库内25项代表性政策，非全量政策普查',
        },
      }),
    };
    instanceRef.current.setOption(option);
    const h = () => instanceRef.current?.resize();
    window.addEventListener('resize', h);
    return () => { window.removeEventListener('resize', h); instanceRef.current?.dispose(); };
  }, []);

  return (
    <div className="chart-card" style={{ gridColumn: '1 / -1' }}>
      <div className="chart-card-header">
        <h3 className="chart-title">政策层级 × 政策工具热力矩阵</h3>
        <p className="chart-desc">
          库内 {flat.length} 项代表性政策在三级政府、七类政策工具上的分布；悬停单元格查看该组合下的完整文件清单
        </p>
      </div>
      <div ref={chartRef} style={{ width: '100%', height: '320px' }} />
      <div className="chart-source">
        工具大类为研究性归并（非官方分类），映射关系：规划与顶层设计＝发展规划/五年规划/行业规划/白皮书/政府工作报告；
        准入与市场开放＝准入开放/业务准入优化/外商投资/民间投资促进；财税与产业扶持＝税收优惠/产业扶持/地方产业政策；
        行动计划落地＝行动计划/地方行动方案/地方综合政策；规范与标准＝行业规范/标准体系；基础设施与军民融合＝新基建/军民融合；国际合作＝国际合作。
        样本为库内 {flat.length} 项代表性政策，非全量政策普查。
      </div>
    </div>
  );
}

/* 政策对比表 */
function PolicyCompareTable({ policyCompare }) {
  return (
    <div className="section">
      <h2 className="section-title">政策层级对比</h2>
      <p className="section-subtitle">国家级、部委级与地方级政策的定位与分工</p>
      <div className="policy-compare-table-wrap">
        <table className="policy-compare-table">
          <thead>
            <tr>
              <th>对比维度</th>
              <th>国家级</th>
              <th>部委级</th>
              <th>地方级</th>
            </tr>
          </thead>
          <tbody>
            {policyCompare.map((row) => (
              <tr key={row.dimension}>
                <td className="pc-dimension">{row.dimension}</td>
                <td>{row.national}</td>
                <td>{row.ministerial}</td>
                <td>{row.local}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Policy() {
  const { requireConfirm, modal } = useDisclaimerGuard();
  const { policy: policyCtx } = useData();
  const { policyData, policyTrend, policyTypeStats, policyWordFreq, policyCompare } = policyCtx;
  const [activeTab, setActiveTab] = useState('national');
  const [expandedId, setExpandedId] = useState(null);
  const [typeFilter, setTypeFilter] = useState('全部');
  const [searchQuery, setSearchQuery] = useState('');

  const currentList = policyData[activeTab] || [];

  const allTypes = useMemo(() => {
    const types = new Set();
    Object.values(policyData).forEach((list) => {
      list.forEach((item) => types.add(item.type));
    });
    return ['全部', ...Array.from(types)];
  }, []);

  const filteredList = useMemo(() => {
    let list = currentList;
    if (typeFilter !== '全部') {
      list = list.filter((item) => item.type === typeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.org.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q)
      );
    }
    return list;
  }, [currentList, typeFilter, searchQuery]);

  const handleToggle = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleExport = () => {
    requireConfirm(
      () => exportCSV('商业航天政策法规', {
        headers: POLICY_CSV_HEADERS,
        rows: filteredList.map((d) => [d.title, d.date, d.org, d.type, d.summary, d.source]),
        source: policyCtx?.source || '中国政府网、国家发改委、工信部',
        caliber: '按政策层级与类型筛选后的当前列表',
        extraMeta: [EXPORT_DISCLAIMER],
      }),
      {
        title: '导出前请确认',
        notice: `即将导出 ${filteredList.length} 条政策记录。导出内容仅作研究参考，请确认已核对来源与口径。`,
        confirmLabel: '确认并导出',
      },
    );
  };

  // 将政策条目注册进全局搜索（关键词含发布机构与类型）
  useEffect(() => {
    const items = Object.values(policyData)
      .flat()
      .map((p) => ({
        id: p.id,
        title: p.title,
        keywords: `${p.org} ${p.type} 政策`,
        path: '/policy',
      }));
    registerSearchData('政策', items);
  }, [policyData]);

  return (
    <div className="page-container ds-page">
      {/* 顶部标题 */}
      <section className="page-header">
        <h1 className="page-title">政策法规</h1>
        <p className="page-desc">
          系统梳理中国商业航天领域相关政策法规，涵盖国家级、部委级和地方级三个层级，
          并整合政策趋势、类型分布、关键词词频与层级对比分析。
        </p>
        <FreshnessBadge fileKey="policy" source="数据来源：中国政府网、国家发改委、工信部" />
      </section>

      {/* 可视化概览 */}
      <section className="section">
        <div className="charts-grid">
          <PolicyTrendChart policyTrend={policyTrend} />
          <PolicyTypePieChart policyTypeStats={policyTypeStats} />
          <div style={{ gridColumn: 'span 2' }}>
            <PolicyWordFreqChart policyWordFreq={policyWordFreq} />
          </div>
          <PolicyToolMatrix policyData={policyData} />
        </div>
      </section>

      {/* 政策对比（有可溯源对比数据时才展示） */}
      {policyCompare.data?.length > 0 && (
        <PolicyCompareTable policyCompare={policyCompare.data} />
      )}

      {/* Tab 切换 */}
      <div className="tab-bar">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`tab-btn ${activeTab === tab.key ? 'tab-active' : ''}`}
            onClick={() => {
              setActiveTab(tab.key);
              setExpandedId(null);
            }}
          >
            {tab.label}
            <span className="tab-count">{(policyData[tab.key] || []).length}</span>
          </button>
        ))}
      </div>

      {/* 搜索与筛选 */}
      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          placeholder="搜索政策标题、发布机构、关键词..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button className="policy-export-btn" onClick={handleExport}>
          导出 {filteredList.length} 条
        </button>
      </div>

      {/* 类型筛选 */}
      <div className="filter-bar">
        <span className="filter-label">政策类型：</span>
        <div className="filter-tags">
          {allTypes.map((type) => (
            <button
              key={type}
              className={`filter-tag ${typeFilter === type ? 'filter-tag-active' : ''}`}
              onClick={() => setTypeFilter(type)}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* 搜索结果提示 */}
      {searchQuery.trim() && (
        <div className="search-result-hint">
          找到 <strong>{filteredList.length}</strong> 条与"<span className="search-highlight">{searchQuery}</span>"相关的政策
        </div>
      )}

      {/* 政策卡片列表 */}
      <div className="policy-list">
        {filteredList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Icon name="file" size={40} strokeWidth={1.5} /></div>
            <div className="empty-state-text">暂无匹配的政策法规</div>
            <div className="empty-state-hint">尝试更换政策层级或清空搜索关键词</div>
          </div>
        ) : (
          filteredList.map((item) => (
            <div
              className={`policy-card ${expandedId === item.id ? 'policy-card-expanded' : ''}`}
              key={item.id}
              onClick={() => handleToggle(item.id)}
            >
              <div className="policy-card-header">
                <span className="policy-type-tag">{item.type}</span>
                <span className="policy-date">{item.date}</span>
              </div>
              <h3 className="policy-card-title">
                <HighlightText text={item.title} keyword={searchQuery} />
              </h3>
              <div className="policy-card-meta">
                <span className="policy-org">
                  <HighlightText text={item.org} keyword={searchQuery} />
                </span>
              </div>
              <div className={`policy-card-summary ${expandedId === item.id ? 'summary-expanded' : ''}`}>
                <p><HighlightText text={item.summary} keyword={searchQuery} /></p>
              </div>
              <div className="policy-card-footer">
                <span className="policy-source">来源：{item.source}
                  {item.sourceUrl && <> · <a href={item.sourceUrl} target="_blank" rel="noreferrer">打开原文 ↗</a></>}
                </span>
                {item.verified === false && (
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                    background: '#fef3c7', color: '#b45309', fontSize: 11,
                  }}>待核实</span>
                )}
                <span className="policy-expand-hint">
                  {expandedId === item.id ? '收起' : '展开详情'}
                  <Icon
                    name={expandedId === item.id ? 'chevron-up' : 'chevron-down'}
                    size="sm"
                    className="policy-expand-chevron"
                  />
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 底部说明 */}
      <div className="data-source-note">
        <p>
          数据来源：中国政府网、国家发改委、工信部、国防科工局、各地方政府官方网站等公开渠道。
          本平台仅做政策梳理与展示，不构成任何法律或投资建议。
        </p>
      </div>
      {modal}
    </div>
  );
}

export default Policy;
