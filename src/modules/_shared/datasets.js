/* ============================================
   数据契约层 —— 「数据接口」的落地
   --------------------------------------------
   问题：模块若直接写 useData().industry.financingEvents，
   一旦主仓调整 dataLoader 的返回结构（比如给 rockets 加 `asOf` 字段、
   把 financingEvents 改名为 fundingEvents），所有模块会同时炸。

   解法：所有取值走本文件的 selector。
   主仓结构变化时，只需改这里的一处映射，各模块零感知。

   ★ 本文件同样属于「接口层」，改动需 review。
   ============================================ */

import { parseFunding } from './format';

/**
 * 数据集清单 —— 每个数据集的语义、形态、来源字段
 * 这是模块开发者理解数据边界的唯一依据
 */
export const DATASETS = {
  rockets: {
    label: '火箭型号',
    route: '/rockets',
    count: 47,
    desc: '各型运载火箭的运力、推进剂、发射工位、成功率与可复用能力',
    fields: ['name', 'abbr', 'org', 'propellant', 'diameter', 'leo', 'gto', 'reusable',
      'site', 'launches', 'firstFlight', 'status', 'successRate', 'costPerKg', 'verified'],
    notes: 'leo/gto 单位吨；successRate 为百分比数值（38/47 条有值）；costPerKg 绝大多数为空',
  },
  constellations: {
    label: '卫星星座',
    route: '/constellation',
    count: 39,
    desc: '全球卫星星座的规划/在轨规模、轨道、频段与运营方',
    fields: ['name', 'company', 'type', 'planned', 'actual', 'orbit', 'frequency',
      'satWeight', 'firstLaunch', 'status', 'verified'],
    notes: 'planned 为规划总数，actual 为已部署数',
  },
  industry: {
    label: '产业与融资',
    route: '/analysis',
    count: 20,
    desc: '融资事件明细 + 市场规模/发射次数时序 + 轮次与赛道分布',
    fields: ['date', 'company', 'round', 'amount', 'segment', 'investors', 'region'],
    notes: 'financingEvents 共 20 条；amount 与 investors 均为文本描述，amount 需经 parseFunding 归一化为可排序数值',
  },
  chain: {
    label: '产业链企业',
    route: '/chain',
    desc: '上游/中游/下游企业矩阵，含环节、细分品类与所在地',
    fields: ['stage', 'category', 'name', 'focus', 'region'],
    notes: '源数据为三层嵌套（stage → category → companies[]），使用 flattenDataset 摊平后再渲染',
  },
  policy: {
    label: '政策法规',
    route: '/policy',
    count: 25,
    desc: '国家级 / 部委级 / 地方级政策要点与时间分布',
    fields: ['id', 'title', 'date', 'org', 'summary', 'type', 'source'],
    notes: '源数据分 national(13) / ministerial(5) / local(7) 三组，flattenDataset 会补 _level 字段',
  },
  dashboard: {
    label: '总览指标',
    route: '/',
    desc: '首页核心指标、里程碑与行业快讯',
    fields: ['dashboardMetrics', 'milestones', 'newsTicker', 'regionMapData'],
  },
  geo: {
    label: '区域分布',
    route: '/',
    desc: '发射工位与企业省份分布',
    fields: ['launchSites2025', 'enterpriseByProvince', 'longMarchFamily2025'],
  },
  market: {
    label: '市场与成本指标',
    route: '/market',
    desc: '市场规模、发射成本、星座部署、投融资的结构化指标（含指标、年份、数值、来源）',
    fields: ['indicator', 'category', 'region', 'year', 'value', 'valueText', 'unit', 'source', 'sourceUrl', 'verified', 'note'],
    notes: 'indicators 为点估计明细；series 为多年同口径序列，图表直接消费；新条目必须带 source，无 sourceUrl 自动标记待核实',
  },
};

/**
 * 取指定数据集（带容错）
 * @param {Object} data  useData() 的返回值
 * @param {keyof DATASETS} key
 * @returns {Object} 数据集对象；不存在时返回空对象而不是抛错
 */
export function selectDataset(data, key) {
  if (!data) return {};
  // chain 的 source 字段在 dataLoader 里被刻意改名为 chainSource，此处抹平差异
  if (key === 'chain') return { ...(data.chain || {}), source: data.chain?.chainSource };
  return data[key] || {};
}

/**
 * 取数据集元信息：更新时间与来源
 * 注意：lastUpdated 是全站聚合值（取各文件最大值），不代表单文件更新时间
 */
export function selectDatasetMeta(data, key) {
  return {
    lastUpdated: data?.lastUpdated || null,
    source: selectDataset(data, key).source || null,
    schema: DATASETS[key] || null,
  };
}

/**
 * 把任意数据集摊平成「一行一条」的明细数组，供 DataTable / CSV 导出使用
 * 科研门户的「原始数据浏览」直接依赖它
 * @returns {Array<Object>}
 */
export function flattenDataset(data, key) {
  switch (key) {
    case 'rockets':
      return selectDataset(data, 'rockets').list || [];
    case 'constellations':
      return selectDataset(data, 'constellations').list || [];
    case 'policy': {
      // 源数据是 { national, ministerial, local } 三组，合并时补 _level 保留层级信息
      const pd = selectDataset(data, 'policy').policyData || {};
      const LEVEL = { national: '国家级', ministerial: '部委级', local: '地方级' };
      return Object.entries(pd).flatMap(([lvl, list]) =>
        (Array.isArray(list) ? list : []).map((row) => ({ ...row, _level: LEVEL[lvl] || lvl }))
      );
    }
    case 'chain': {
      // 三层嵌套 stage → category → companies[]，摊平成「一家企业一行」
      const tree = selectDataset(data, 'chain').enterpriseMatrix?.data || [];
      return tree.flatMap((node) =>
        (node.companies || []).map((c) => ({
          stage: node.stage,
          category: node.category,
          name: c.name,
          focus: c.focus,
          region: c.region,
        }))
      );
    }
    case 'industry':
      return selectDataset(data, 'industry').financingEvents || [];
    case 'market':
      return selectDataset(data, 'market').indicators || [];
    default:
      return [];
  }
}

/**
 * 全站明细数据总表 —— 科研门户「一次导出全部明细」用
 * @returns {Array<{_dataset:string, _datasetLabel:string, ...}>}
 */
export function allFlatRecords(data) {
  if (!data) return [];
  const groups = ['rockets', 'constellations', 'industry', 'chain', 'policy'];
  return groups.flatMap((key) =>
    flattenDataset(data, key).map((row) => ({
      _dataset: key,
      _datasetLabel: DATASETS[key].label,
      ...row,
    }))
  );
}

/** 投资方字符串拆成数组：兼容中英文顿号、逗号、分号、「等」「及」尾缀 */
function splitInvestors(text) {
  if (!text) return [];
  return String(text)
    .split(/[、,，;；]/)
    .map((s) => s.replace(/(等|及其|以及).*$/, '').trim())
    .filter(Boolean);
}

/**
 * 按企业聚合融资事件 —— 投资人门户「企业画像」的核心派生
 * 注意：这是运行时纯函数派生，不写回数据源、不落任何 json，
 *       因此永远与每日 AI 更新保持同步。
 * @returns {Array<{name:string, rounds:number, lastRound:string, lastDate:string, lastAmount:string, amountValue:number|null, segments:string[], investors:string[], events:Array}>}
 */
export function aggregateFundingByCompany(data) {
  const events = selectDataset(data, 'industry').financingEvents || [];
  const map = new Map();

  events.forEach((e) => {
    const name = (e.company || '').trim();
    if (!name) return;
    if (!map.has(name)) {
      map.set(name, { name, rounds: 0, events: [], investors: new Set(), segments: new Set() });
    }
    const rec = map.get(name);
    rec.rounds += 1;
    rec.events.push(e);
    splitInvestors(e.investors).forEach((i) => rec.investors.add(i));
    if (e.segment) rec.segments.add(e.segment);
  });

  return [...map.values()]
    .map((rec) => {
      // 融资日期形如「2026-09」，字符串倒序即可正确排序
      const sorted = [...rec.events].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      const latest = sorted[0] || {};
      return {
        name: rec.name,
        rounds: rec.rounds,
        lastRound: latest.round || '—',
        lastDate: latest.date || '—',
        lastAmount: latest.amount || '—',
        amountValue: parseFunding(latest.amount),
        segments: [...rec.segments],
        investors: [...rec.investors],
        events: sorted,
      };
    })
    // 先按融资轮次降序，再按最近一轮金额降序
    .sort((a, b) => b.rounds - a.rounds
      || (b.amountValue || 0) - (a.amountValue || 0)
      || String(a.name).localeCompare(String(b.name), 'zh'));
}
