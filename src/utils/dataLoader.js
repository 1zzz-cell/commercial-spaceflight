/* ============================================
   数据加载器
   - 运行时 fetch public/data/*.json
   - localStorage 缓存（24小时过期）
   - 计算派生统计（orgStats, propellantStats 等）
   - 加载失败时回退到缓存
   - 同时返回 lastUpdated（聚合值）与 fileUpdatedAt（分文件值）

   ⚠ 改动任意 JSON 的字段结构后，必须把下面的 CACHE_VERSION +1，
     否则用户浏览器里的旧缓存不会失效，会出现「新代码读旧数据」。
   ============================================ */

const CACHE_KEY = 'csd_data_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时
// 缓存版本号：数据结构（JSON 字段）发生增删时升级此值，
// 旧版本缓存会因版本不匹配被自动丢弃并重新加载，避免新增字段无法显示
const CACHE_VERSION = 'v5';

const DATA_FILES = {
  rockets: '/data/rockets.json',
  constellations: '/data/constellations.json',
  industry: '/data/industry.json',
  chain: '/data/chain.json',
  policy: '/data/policy.json',
  dashboard: '/data/dashboard.json',
  geo: '/data/geoData.json',
  market: '/data/market.json',
};

/* ---------- 带缓存的 fetch ---------- */
async function fetchWithCache(key, url) {
  // 尝试从 localStorage 读取缓存
  const cache = readCache();
  const cached = cache?.[key];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  // fetch 最新数据
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  const data = await res.json();

  // 写入缓存
  writeCache(key, data);
  return data;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // 版本不匹配（旧缓存无 _version 字段或版本号不同）则丢弃全部缓存
    if (parsed._version !== CACHE_VERSION) return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeCache(key, data) {
  try {
    const cache = readCache();
    cache._version = CACHE_VERSION;
    cache[key] = { ts: Date.now(), data };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage 满了或不可用，忽略
  }
}

/* ---------- 推进剂分类（纯函数，按芯级主推进剂归类） ---------- */
function classifyPropellant(propellant) {
  const p = propellant || '';
  if (p.includes('煤油')) return '液氧/煤油';
  if (p.includes('甲烷')) return '液氧/甲烷';
  if (p.includes('偏二甲肼')) return '有毒推进剂';
  if (p.includes('固体') || p.includes('丁羟')) return '固体';
  if (p.includes('液氢')) return '液氧/液氢';
  return '其他';
}

/* ---------- 火箭派生统计 ---------- */
function computeRocketStats(rockets) {
  const orgMap = {};
  rockets.forEach((r) => {
    if (!orgMap[r.org]) orgMap[r.org] = { name: r.org, count: 0, totalLaunches: 0, reusableCount: 0 };
    orgMap[r.org].count++;
    if (r.launches) orgMap[r.org].totalLaunches += r.launches;
    if (r.reusable) orgMap[r.org].reusableCount++;
  });

  const propMap = {};
  rockets.forEach((r) => {
    const cat = classifyPropellant(r.propellant);
    if (!propMap[cat]) propMap[cat] = { type: cat, count: 0, reusableCount: 0 };
    propMap[cat].count++;
    if (r.reusable) propMap[cat].reusableCount++;
  });

  const statusMap = {};
  rockets.forEach((r) => {
    const s = r.status || '未知';
    if (!statusMap[s]) statusMap[s] = { status: s, count: 0 };
    statusMap[s].count++;
  });

  const reusable = rockets.filter((r) => r.reusable).length;

  return {
    orgStats: Object.values(orgMap).sort((a, b) => b.totalLaunches - a.totalLaunches),
    propellantStats: Object.values(propMap).sort((a, b) => b.count - a.count),
    statusStats: Object.values(statusMap),
    reusableStats: [
      { name: '可回收', value: reusable },
      { name: '不可回收', value: rockets.length - reusable },
    ],
    reusableByLeo: rockets
      .filter((r) => r.reusable && r.leo)
      .sort((a, b) => b.leo - a.leo)
      .slice(0, 8),
  };
}

/* ---------- 加载所有数据 ---------- */
export async function loadAllData() {
  const [rocketsRaw, conRaw, indRaw, chainRaw, polRaw, dashRaw, geoRaw, marketRaw] = await Promise.all(
    Object.entries(DATA_FILES).map(([key, url]) => fetchWithCache(key, url))
  );

  const rocketStats = computeRocketStats(rocketsRaw.rockets);

  /* 各文件各自的更新时间。
     为什么保留它：return 出去的 lastUpdated 是「取最大值」的聚合值，
     会掩盖某个文件其实很久没更新（例如 market.json 停在 10-21 而其余停在 10-04）。
     科研门户「更新日志」页与 `npm run data:status` 都依赖这个 map。 */
  const fileUpdatedAt = {
    rockets: rocketsRaw.lastUpdated || null,
    constellations: conRaw.lastUpdated || null,
    industry: indRaw.lastUpdated || null,
    chain: chainRaw.lastUpdated || null,
    policy: polRaw.lastUpdated || null,
    dashboard: dashRaw.lastUpdated || null,
    geo: geoRaw.lastUpdated || null,
    market: marketRaw.lastUpdated || null,
  };
  const fileMeta = Object.fromEntries(
    Object.entries({ rockets: rocketsRaw, constellations: conRaw, industry: indRaw, chain: chainRaw,
      policy: polRaw, dashboard: dashRaw, geo: geoRaw, market: marketRaw })
      .map(([key, value]) => [key, value.meta || {}]),
  );

  return {
    // 聚合值（全站徽标用）：取各文件的最大值，缺字段的跳过而不是污染排序
    lastUpdated: Object.values(fileUpdatedAt).filter(Boolean).sort().pop() || null,
    // 分文件的更新时间（前端做新鲜度体检用）
    fileUpdatedAt,
    fileMeta,

    rockets: {
      list: rocketsRaw.rockets,
      source: rocketsRaw.source,
      sourceLevel: rocketsRaw.sourceLevel,
      ...rocketStats,
    },

    constellations: {
      list: conRaw.constellations,
      typeStats: conRaw.typeStats,
      deployProgress: conRaw.deployProgress,
      topDeployers: conRaw.topDeployers,
      statusStats: conRaw.statusStats,
      orbitStats: conRaw.orbitStats,
      frequencyStats: conRaw.frequencyStats,
      source: conRaw.source,
      sourceLevel: conRaw.sourceLevel,
    },

    industry: {
      marketSizeData: indRaw.marketSizeData,
      launchData: indRaw.launchData,
      financingData: indRaw.financingData,
      regionData: indRaw.regionData,
      financingStructure2025: indRaw.financingStructure2025,
      financingEvents: indRaw.financingEvents,
      roundStats: indRaw.roundStats,
      segmentStats: indRaw.segmentStats,
      financingNotes: indRaw.financingNotes,
    },

    chain: {
      industryStages: chainRaw.industryStages,
      chainList: chainRaw.chainList,
      enterpriseMatrix: chainRaw.enterpriseMatrix,
      facilityList: chainRaw.facilityList,
      chainSource: chainRaw.source,
      keyFacts2025: chainRaw.keyFacts2025,
      trendInsights2025: chainRaw.trendInsights2025,
      caseStudies: chainRaw.caseStudies,
    },

    policy: {
      policyData: polRaw.policyData,
      policyTrend: polRaw.policyTrend,
      policyTypeStats: polRaw.policyTypeStats,
      policyWordFreq: polRaw.policyWordFreq,
      policyCompare: polRaw.policyCompare,
    },

    dashboard: {
      dashboardMetrics: dashRaw.dashboardMetrics,
      regionMapData: dashRaw.regionMapData,
      regionMapSource: dashRaw.regionMapSource,
      milestones: dashRaw.milestones,
      newsTicker: dashRaw.newsTicker,
    },

    geo: {
      geoSource: geoRaw.geoSource,
      launchSites2025: geoRaw.launchSites2025,
      enterpriseByProvince: geoRaw.enterpriseByProvince,
      longMarchFamily2025: geoRaw.longMarchFamily2025,
    },

    market: {
      indicators: marketRaw.indicators || [],
      series: marketRaw.series || [],
      insights: marketRaw.insights || [],
      bottlenecks: marketRaw.bottlenecks || [],
      marketSource: marketRaw.source,
    },
  };
}

export { classifyPropellant };
