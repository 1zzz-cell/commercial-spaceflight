// ============================================================
// 数据核查规则（2026-09-26 人工审核后固化）
// 依据：经国家航天局官网、新华社、央视网、Amazon 官方等权威渠道
//       核实的事实口径。AI 更新若违反以下规则，对应变更将被
//       拒绝、回退或强制纠正（详见 README「数据治理」一节）。
// ============================================================

// ---------- 受保护字段：AI 输出与此不符时，强制回退为受保护值 ----------
// match 用于在列表中定位条目；field 为受保护字段；value 为唯一允许值
export const PROTECTED_VALUES = [
  // 火箭参数（国家航天局官网口径）
  { file: 'rockets.json', list: 'rockets', match: { abbr: 'CZ-5' }, field: 'leo', value: 25, source: '国家航天局官网：近地轨道25吨级' },
  { file: 'rockets.json', list: 'rockets', match: { abbr: 'CZ-5' }, field: 'gto', value: 14, source: '国家航天局官网：同步转移轨道14吨级' },
  { file: 'rockets.json', list: 'rockets', match: { abbr: 'TL-2' }, field: 'leo', value: 2, source: '国家航天局转引中国日报 2023-04-02' },
  { file: 'rockets.json', list: 'rockets', match: { abbr: 'CZ-8A' }, field: 'reusable', value: false, source: '央视网 2025-12-27：一次性构型' },
  { file: 'rockets.json', list: 'rockets', match: { abbr: 'CZ-6' }, field: 'propellant', value: '液氧+煤油', source: '国家航天局官网 CZ-6 型谱' },
  // 星座（官方/申报口径）
  { file: 'constellations.json', list: 'constellations', match: { name: 'StarLink' }, field: 'planned', value: 41930, source: 'SpaceX FCC 申报口径' },
  { file: 'constellations.json', list: 'constellations', match: { name: 'OneWeb' }, field: 'actual', value: 648, source: 'OneWeb 官方建成口径' },
  { file: 'constellations.json', list: 'constellations', match: { name: 'Amazon Leo' }, field: 'firstLaunch', value: '2023', source: 'Amazon 官方：2023-10-06 原型星' },
  { file: 'constellations.json', list: 'topDeployers', match: { name: '浙江时空道宇' }, field: 'planned', value: 5676, source: '时空道宇官方规划（吉利未来出行星座）' },
  // 政策（2026-09 审核更正项，防止回退）
  { file: 'policy.json', path: ['policyData', 'national'], match: { id: 6 }, field: 'source', value: '国防科工局', source: '通知由国防科工局、军委装备发展部联合印发' },
  { file: 'policy.json', path: ['policyData', 'ministerial'], match: { id: 105 }, field: 'title', value: '国家航天局推进商业航天高质量安全发展行动计划（2025—2027年）', source: '人民网 2025-11-30' },
];

// ---------- 内容黑名单：最终 JSON 中出现即拒绝整个文件 ----------
export const FORBIDDEN_PATTERNS = [
  { pattern: /(?<!\d)42\s*次发射/, reason: '海南商发2025年发射次数错误，官方口径为9次（累计10次）' },
  { pattern: /第\s*666\s*次飞行/, reason: '无法核实的长征累计发射数（历史幻觉数据）' },
  { pattern: /与成都并列/, reason: '与区域融资金值矛盾的旧表述' },
  { pattern: /投中嘉川/, reason: '数据来源名称错误，应为「投中信息CVSource」' },
];
// 注：无法核实但已标记 verified:false 的条目（如 id13）不在黑名单之列，
// 以「待核实」标签形式保留展示，符合审核决策。

// 不允许再入库的星座条目名（重复计数/编造）
export const FORBIDDEN_CONSTELLATION_NAMES = ['三星', '时空道宇星座'];

// ---------- 每个文件必须存在的顶层键 ----------
export const REQUIRED_KEYS = {
  'rockets.json': ['lastUpdated', 'rockets'],
  'constellations.json': ['lastUpdated', 'constellations', 'typeStats', 'statusStats', 'orbitStats', 'deployProgress', 'topDeployers'],
  'policy.json': ['lastUpdated', 'policyData', 'policyTrend', 'policyTypeStats'],
  'industry.json': ['lastUpdated', 'marketSizeData', 'launchData', 'financingData', 'regionData', 'financingEvents'],
  'chain.json': ['lastUpdated', 'chainList', 'keyFacts2025'],
  'geoData.json': ['lastUpdated', 'launchSites2025', 'enterpriseByProvince'],
  'dashboard.json': ['lastUpdated'],
  'market.json': ['lastUpdated', 'indicators', 'series'],
};

// ---------- 明细列表定义：身份键 + 来源要求 ----------
export const LIST_SPECS = {
  'rockets.json': { list: 'rockets', idKey: (e) => e.abbr, label: '火箭' },
  'constellations.json': { list: 'constellations', idKey: (e) => e.name, label: '星座' },
  'industry.json': { list: 'financingEvents', idKey: (e) => `${e.date}|${e.company}|${e.round}`, label: '融资事件' },
  'market.json': { list: 'indicators', idKey: (e) => `${e.year}|${e.indicator}`, label: '市场指标' },
};
// 政策按三个分组处理
export const POLICY_GROUPS = ['national', 'ministerial', 'local'];

// 单文件单次更新允许的最大变更条目数（防止大面积幻觉改写）
export const MAX_ENTRY_CHANGES = 10;

// ---------- 工具函数 ----------

// 按 spec（{list} 或 {path}）定位数组；不存在返回 null
export function resolveList(data, spec) {
  if (spec.list) return Array.isArray(data[spec.list]) ? data[spec.list] : null;
  if (spec.path) {
    let cur = data;
    for (const k of spec.path) {
      if (cur == null || typeof cur !== 'object') return null;
      cur = cur[k];
    }
    return Array.isArray(cur) ? cur : null;
  }
  return null;
}

// ---------- 1. 结构校验：返回错误字符串数组（空数组 = 通过） ----------
export function structuralCheck(file, data) {
  const errors = [];
  for (const key of REQUIRED_KEYS[file] || []) {
    if (!(key in data)) errors.push(`缺少顶层键 "${key}"`);
  }
  if (file === 'rockets.json' && Array.isArray(data.rockets)) {
    data.rockets.forEach((r, i) => {
      const tag = r.abbr || r.name || `#${i}`;
      if (r.leo != null && (typeof r.leo !== 'number' || r.leo <= 0)) errors.push(`火箭 ${tag} leo 非法: ${r.leo}`);
      if (r.successRate != null && (typeof r.successRate !== 'number' || r.successRate < 0 || r.successRate > 100)) errors.push(`火箭 ${tag} successRate 越界: ${r.successRate}`);
      if (r.launches != null && (typeof r.launches !== 'number' || r.launches < 0)) errors.push(`火箭 ${tag} launches 非法: ${r.launches}`);
    });
  }
  if (file === 'constellations.json' && Array.isArray(data.constellations)) {
    data.constellations.forEach((c, i) => {
      const tag = c.name || `#${i}`;
      if (c.planned != null && (typeof c.planned !== 'number' || c.planned < 0)) errors.push(`星座 ${tag} planned 非法: ${c.planned}`);
      if (c.actual != null && (typeof c.actual !== 'number' || c.actual < 0)) errors.push(`星座 ${tag} actual 非法: ${c.actual}`);
    });
  }
  if (file === 'policy.json' && data.policyData) {
    for (const g of POLICY_GROUPS) {
      if (!Array.isArray(data.policyData[g])) errors.push(`policyData.${g} 不是数组`);
    }
  }
  return errors;
}

// ---------- 2. 黑名单扫描：返回命中的原因数组 ----------
export function scanForbiddenPatterns(file, data) {
  const hits = [];
  const serialized = JSON.stringify(data);
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(serialized)) hits.push(reason);
  }
  return hits;
}

// ---------- 3. 移除黑名单条目（星座重复/编造条目），就地修改 ----------
export function removeForbiddenEntries(data) {
  const removed = [];
  if (Array.isArray(data.constellations)) {
    const before = data.constellations.length;
    data.constellations = data.constellations.filter((c) => !FORBIDDEN_CONSTELLATION_NAMES.includes(c.name));
    if (data.constellations.length < before) {
      removed.push(...FORBIDDEN_CONSTELLATION_NAMES.filter((n) => !data.constellations.some((c) => c.name === n)));
    }
  }
  return removed;
}

// ---------- 4. 来源规则：新增/修改条目必须可溯源，否则丢弃或回退 ----------
// 返回 { dropped: [], reverted: [], flagged: [] }
export function enforceSourceRules(file, updated, current) {
  const result = { dropped: [], reverted: [], flagged: [] };
  const hasSource = (e) => e.source != null && String(e.source).trim() !== '';

  const processList = (spec) => {
    const updatedList = resolveList(updated, spec);
    const currentList = resolveList(current, spec);
    if (!updatedList) return;
    const currentMap = new Map((currentList || []).map((e) => [spec.idKey(e), e]));

    const kept = [];
    for (const entry of updatedList) {
      const id = spec.idKey(entry);
      const orig = currentMap.get(id);
      if (orig === undefined) {
        // 新条目：必须有来源，否则直接丢弃（禁止无来源条目入库）
        if (!hasSource(entry)) {
          result.dropped.push(`${spec.label}「${id}」缺少 source 字段，已拒绝入库`);
          continue;
        }
        if (!entry.sourceUrl) {
          entry.verified = false; // 有来源但无原文链接 → 前端显示「待核实」
          result.flagged.push(`${spec.label}「${id}」无 sourceUrl，已标记待核实`);
        }
        kept.push(entry);
      } else if (JSON.stringify(entry) !== JSON.stringify(orig)) {
        // 修改的既有条目：无来源则回退为原条目
        if (!hasSource(entry)) {
          result.reverted.push(`${spec.label}「${id}」被修改但未提供来源，已回退`);
          kept.push(orig);
          continue;
        }
        if (!entry.sourceUrl) {
          entry.verified = false;
          result.flagged.push(`${spec.label}「${id}」已修改但无 sourceUrl，已标记待核实`);
        }
        kept.push(entry);
      } else {
        kept.push(entry);
      }
    }
    if (spec.list) updated[spec.list] = kept;
    else if (spec.path) {
      let cur = updated;
      for (const k of spec.path.slice(0, -1)) cur = cur[k];
      cur[spec.path[spec.path.length - 1]] = kept;
    }
  };

  for (const spec of Object.values(LIST_SPECS)) {
    if (spec.list && spec.list in updated) processList(spec);
  }
  if (file === 'policy.json' && updated.policyData) {
    for (const g of POLICY_GROUPS) {
      if (Array.isArray(updated.policyData[g])) {
        processList({ path: ['policyData', g], idKey: (e) => e.id, label: `政策(${g})` });
      }
    }
  }
  return result;
}

// ---------- 5. 受保护字段强制回退，就地修改 ----------
export function applyProtectedValues(file, data) {
  const forced = [];
  for (const rule of PROTECTED_VALUES) {
    if (rule.file !== file) continue;
    const list = resolveList(data, rule);
    if (!list) continue;
    const entry = list.find((e) => Object.entries(rule.match).every(([k, v]) => e[k] === v));
    if (entry && entry[rule.field] !== rule.value) {
      forced.push(`${rule.field}: ${JSON.stringify(entry[rule.field])} → ${JSON.stringify(rule.value)}（依据：${rule.source}）`);
      entry[rule.field] = rule.value;
    }
  }
  return forced;
}

// ---------- 6. 变更条目计数（防止大面积改写） ----------
export function countEntryChanges(file, updated, current) {
  let added = 0;
  let changed = 0;
  const walk = (spec) => {
    const updatedList = resolveList(updated, spec) || [];
    const currentList = resolveList(current, spec) || [];
    const currentMap = new Map(currentList.map((e) => [spec.idKey(e), e]));
    for (const entry of updatedList) {
      const orig = currentMap.get(spec.idKey(entry));
      if (orig === undefined) added++;
      else if (JSON.stringify(entry) !== JSON.stringify(orig)) changed++;
    }
  };
  for (const spec of Object.values(LIST_SPECS)) {
    if (spec.list && spec.list in updated) walk(spec);
  }
  if (file === 'policy.json' && updated.policyData) {
    for (const g of POLICY_GROUPS) {
      if (Array.isArray(updated.policyData[g])) walk({ path: ['policyData', g], idKey: (e) => e.id });
    }
  }
  return { added, changed, total: added + changed };
}

// ---------- 7. 统计块重算（统计永远由明细派生，杜绝图表与列表不一致） ----------
// ctx: { rockets } 可选，chain.json 的可复用火箭计数依赖 rockets.json
export function recomputeDerivedStats(file, data, ctx = {}) {
  const recomputed = [];

  if (file === 'constellations.json' && Array.isArray(data.constellations)) {
    const list = data.constellations;
    // typeStats（按 type 精确计数，数量降序、同数按名称升序，保证确定性）
    const typeMap = new Map();
    for (const e of list) {
      const t = e.type || '未分类';
      typeMap.set(t, (typeMap.get(t) || 0) + 1);
    }
    data.typeStats = [...typeMap.entries()]
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'zh'))
      .map(([type, count]) => ({ type, count }));
    recomputed.push(`typeStats(${data.typeStats.length}类)`);

    // statusStats（固定顺序）
    const statusOrder = ['组网中', '已建成', '验证阶段', '规划中'];
    const statusMap = new Map();
    for (const e of list) {
      const s = e.status || '未知';
      statusMap.set(s, (statusMap.get(s) || 0) + 1);
    }
    data.statusStats = [...statusMap.entries()]
      .sort((a, b) => (statusOrder.indexOf(a[0]) === -1 ? 99 : statusOrder.indexOf(a[0])) - (statusOrder.indexOf(b[0]) === -1 ? 99 : statusOrder.indexOf(b[0])))
      .map(([status, count]) => ({ status, count }));
    recomputed.push(`statusStats(${data.statusStats.length}类)`);

    // orbitStats（前缀归类，固定三类；复合轨道如 LEO/SO 归「其他」）
    const classifyOrbit = (o) => {
      const s = String(o || '');
      if (s.startsWith('LEO') && !s.includes('/')) return 'LEO 低地球轨道';
      if (s.startsWith('SSO') && !s.includes('/')) return 'SSO 太阳同步轨道';
      return '其他轨道（GEO/高轨/混合）';
    };
    const orbitOrder = ['LEO 低地球轨道', 'SSO 太阳同步轨道', '其他轨道（GEO/高轨/混合）'];
    const orbitMap = new Map();
    for (const e of list) {
      const o = classifyOrbit(e.orbit);
      orbitMap.set(o, (orbitMap.get(o) || 0) + 1);
    }
    data.orbitStats = orbitOrder.filter((k) => orbitMap.has(k)).map((type) => ({ type, count: orbitMap.get(type) }));
    recomputed.push(`orbitStats(${data.orbitStats.length}类)`);

    // deployProgress（部署进度）
    const done = list.filter((e) => e.status === '已建成').length;
    const ongoing = list.filter((e) => e.status === '组网中' || e.status === '验证阶段').length;
    const plannedCnt = list.filter((e) => e.status === '规划中').length;
    data.deployProgress = [
      { stage: '已完成', count: done },
      { stage: '进行中', count: ongoing },
      { stage: '规划中', count: plannedCnt },
    ];
    recomputed.push(`deployProgress(共${list.length}条)`);

    // 注：frequencyStats 含人工复合频段归并（如 Ka/Ku、Q/V、光学/红外），
    // 无法由明细机械重算，不做自动重算，仅依赖来源规则约束。
  }

  if (file === 'policy.json' && data.policyData && data.policyTrend) {
    const all = POLICY_GROUPS.flatMap((g) => data.policyData[g] || []);
    const years = data.policyTrend.years || [];
    data.policyTrend.counts = years.map((y) => all.filter((e) => String(e.date || '').startsWith(String(y))).length);
    recomputed.push(`policyTrend(合计${data.policyTrend.counts.reduce((a, b) => a + b, 0)}/${all.length})`);

    const typeMap = new Map();
    for (const e of all) {
      const t = e.type || '未分类';
      typeMap.set(t, (typeMap.get(t) || 0) + 1);
    }
    data.policyTypeStats = [...typeMap.entries()].map(([type, count]) => ({ type, count }));
    recomputed.push(`policyTypeStats(${data.policyTypeStats.length}类)`);
  }

  if (file === 'chain.json' && Array.isArray(ctx.rockets) && Array.isArray(data.chainList)) {
    const reusableCount = ctx.rockets.filter((r) => r.reusable === true).length;
    const rocketChain = data.chainList.find((c) => c.key === 'rocket');
    const metric = rocketChain?.metrics?.find((m) => String(m.label || '').startsWith('可复用火箭'));
    if (metric) {
      metric.label = '可复用火箭(含在研)';
      metric.value = String(reusableCount);
      recomputed.push(`可复用火箭=${reusableCount}型(与rockets.json对齐)`);
    }
  }

  return recomputed;
}

// ---------- 8. AI 输出净化管线：全部通过才允许写盘 ----------
// 返回 { ok: true, data, log } 或 { ok: false, log }
export function sanitizeUpdated(file, updated, current, today, ctx = {}) {
  const log = [];

  const structErrors = structuralCheck(file, updated);
  if (structErrors.length) {
    log.push(`✗ ${file} 结构校验失败，拒绝入库：${structErrors.join('；')}`);
    return { ok: false, log };
  }

  const forbiddenHits = scanForbiddenPatterns(file, updated);
  if (forbiddenHits.length) {
    log.push(`✗ ${file} 命中内容黑名单，拒绝入库：${forbiddenHits.join('；')}`);
    return { ok: false, log };
  }

  const removed = removeForbiddenEntries(updated);
  removed.forEach((n) => log.push(`⚠ 已移除黑名单条目「${n}」`));

  const src = enforceSourceRules(file, updated, current);
  src.dropped.forEach((m) => log.push(`✗ ${m}`));
  src.reverted.forEach((m) => log.push(`⚠ ${m}`));
  src.flagged.forEach((m) => log.push(`⚠ ${m}`));

  applyProtectedValues(file, updated).forEach((m) => log.push(`⚠ 受保护字段已强制回退：${m}`));

  const changes = countEntryChanges(file, updated, current);
  if (changes.total > MAX_ENTRY_CHANGES) {
    log.push(`✗ ${file} 变更条目 ${changes.total} 个（新增${changes.added}/修改${changes.changed}），超过上限 ${MAX_ENTRY_CHANGES}，拒绝入库`);
    return { ok: false, log };
  }

  recomputeDerivedStats(file, updated, ctx).forEach((m) => log.push(`✓ 统计块已按明细重算：${m}`));

  updated.lastUpdated = today;

  return { ok: true, data: updated, log };
}

// ---------- 9. 仓库现状校验（CI 门禁 / 本地检查用） ----------
// 返回 { errors, warnings, fixed }；fix=true 时自动修复可修复项
export function checkRepoFile(file, data, ctx = {}, fix = false) {
  const errors = [];
  const warnings = [];

  const structErrors = structuralCheck(file, data);
  errors.push(...structErrors);

  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(JSON.stringify(data))) errors.push(`命中内容黑名单：${reason}`);
  }

  const removed = removeForbiddenEntries(data);
  removed.forEach((n) => (fix ? warnings.push(`已移除黑名单条目「${n}」`) : errors.push(`存在黑名单条目「${n}」`)));

  const forced = applyProtectedValues(file, data);
  forced.forEach((m) => (fix ? warnings.push(`受保护字段已修正：${m}`) : errors.push(`受保护字段被篡改：${m}`)));

  if (fix) {
    recomputeDerivedStats(file, data, ctx).forEach((m) => warnings.push(`统计块已重算：${m}`));
  } else {
    // 只读模式：比对统计块是否与明细一致
    const copy = JSON.parse(JSON.stringify(data));
    recomputeDerivedStats(file, copy, ctx);
    // 可自动重算的统计块（frequencyStats 含人工归并不参与）
    const blocks = {
      'constellations.json': ['typeStats', 'statusStats', 'orbitStats', 'deployProgress'],
      'policy.json': ['policyTrend', 'policyTypeStats'],
      'chain.json': [],
    }[file] || [];
    // 无固定顺序的块按 key 排序后比较，避免排列差异误报
    const sortKey = { typeStats: 'type', policyTypeStats: 'type' };
    const canon = (block, key) => {
      if (!Array.isArray(block) || !sortKey[key]) return JSON.stringify(block);
      return JSON.stringify([...block].sort((a, b) => String(a[sortKey[key]]).localeCompare(String(b[sortKey[key]]))));
    };
    for (const b of blocks) {
      if (canon(copy[b], b) !== canon(data[b], b)) {
        errors.push(`统计块 ${b} 与明细不一致（应重算）`);
      }
    }
  }

  return { errors, warnings };
}
