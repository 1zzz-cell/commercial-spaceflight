// ============================================================
// market.json 采集与清洗管线（可复用）
// --------------------------------------------
// 用法：
//   node scripts/collect-market.mjs --input candidates.json           # 合并入库
//   node scripts/collect-market.mjs --input candidates.json --dry-run # 只校验不写盘
//   node scripts/collect-market.mjs --input indicators.csv            # 兼容 CSV 采集模板
//
// 采集源可以是：AI 产出的 JSON、手工维护的 CSV、或第三方机构公开数据转储。
// 清洗规则与主更新管线共用 data-rules.mjs 的净化函数：
//   1. 结构校验（lastUpdated / indicators / series 必备键）
//   2. 内容黑名单扫描
//   3. 来源规则：无 source 的指标直接丢弃；无 sourceUrl 标记 verified=false（前端显示「待核实」）
//   4. 单次变更条目上限 MAX_ENTRY_CHANGES，防止大面积幻觉改写
//   5. series 额外要求：每个序列必须带 source 与成对的 years/values
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  sanitizeUpdated, MAX_ENTRY_CHANGES,
} from './data-rules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'public', 'data');
const targetPath = path.join(dataDir, 'market.json');

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1];
};
const inputPath = flag('input');
const dryRun = argv.includes('--dry-run');

if (!inputPath) {
  console.error('用法：node scripts/collect-market.mjs --input <candidates.json|.csv> [--dry-run]');
  process.exit(1);
}

/* ---------- 极简 CSV 解析（RFC4180：支持引号内逗号与换行） ---------- */
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((c) => c !== '')) rows.push(row); }
  return rows;
}

/* CSV 表头 → 指标条目字段映射（与 scripts/templates/市场指标采集模板.csv 对齐） */
function csvRowsToIndicators(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return { indicators: [], series: [] };
  const header = rows[0].map((h) => h.trim());
  const col = (name) => header.indexOf(name);
  const idx = {
    indicator: col('指标'), category: col('类别'), region: col('地域'),
    year: col('年份'), value: col('数值'), valueText: col('文本数值'),
    unit: col('单位'), source: col('来源'), sourceUrl: col('来源链接'),
    note: col('口径说明'),
  };
  const indicators = rows.slice(1).map((r) => ({
    indicator: (r[idx.indicator] || '').trim(),
    category: (r[idx.category] || '市场规模').trim(),
    region: (r[idx.region] || '中国').trim(),
    year: idx.year >= 0 ? Number(r[idx.year]) : null,
    value: idx.value >= 0 && r[idx.value] !== '' ? Number(r[idx.value]) : null,
    valueText: (idx.valueText >= 0 ? r[idx.valueText] : '') || null,
    unit: (r[idx.unit] || '').trim(),
    source: (r[idx.source] || '').trim(),
    sourceUrl: (idx.sourceUrl >= 0 ? r[idx.sourceUrl] : '').trim() || null,
    verified: (r[idx.sourceUrl] || '').trim() ? true : false,
    note: (idx.note >= 0 ? r[idx.note] : '') || null,
  })).filter((e) => e.indicator && e.year);
  return { indicators, series: [] };
}

/* ---------- series 清洗：source 必备；years/values 等长 ---------- */
function cleanSeries(series) {
  const clean = [];
  const dropped = [];
  for (const s of series || []) {
    if (!s.id || !s.indicator) { dropped.push(`序列缺 id/indicator，已丢弃`); continue; }
    if (!s.source) { dropped.push(`序列「${s.id}」缺少 source，已丢弃`); continue; }
    if (!Array.isArray(s.years) || !Array.isArray(s.values) || s.years.length !== s.values.length) {
      dropped.push(`序列「${s.id}」years/values 不匹配，已丢弃`); continue;
    }
    clean.push({
      id: s.id,
      indicator: s.indicator,
      region: s.region || '全球',
      unit: s.unit || '',
      years: s.years.map(Number),
      values: s.values.map(Number),
      forecastYears: (s.forecastYears || []).map(Number),
      forecastValues: (s.forecastValues || []).map(Number),
      source: s.source,
      sourceUrl: s.sourceUrl || null,
      note: s.note || null,
      verified: s.sourceUrl ? true : false,
    });
  }
  return { clean, dropped };
}

/* ---------- 合并策略 ----------
   indicators：按 (year|indicator) 身份键，新条目必须带 source（由 sanitizeUpdated 强制），
               已存在条目被修改时必须带 source，否则回退为原值；
   series：    按 id 覆盖，但整段替换要求 source 存在（cleanSeries 已保证）；
   insights / bottlenecks：整体随本次采集更新，用于持续沉淀行业洞察。 */
function mergeMarket(current, candidates, log) {
  const updated = JSON.parse(JSON.stringify(current));

  if (Array.isArray(candidates.indicators) && candidates.indicators.length) {
    const prev = new Map((updated.indicators || []).map((e) => [`${e.year}|${e.indicator}`, e]));
    for (const ind of candidates.indicators) {
      const key = `${ind.year}|${ind.indicator}`;
      const entry = { ...ind };
      if (!entry.sourceUrl) entry.verified = false; // 无原文链接 → 待核实（安全默认）
      prev.set(key, entry);
    }
    updated.indicators = [...prev.values()];
  }

  if (Array.isArray(candidates.series) && candidates.series.length) {
    const { clean, dropped } = cleanSeries(candidates.series);
    dropped.forEach((m) => log.push(`⚠ ${m}`));
    const prev = new Map((updated.series || []).map((s) => [s.id, s]));
    for (const s of clean) prev.set(s.id, s);
    updated.series = [...prev.values()];
  }

  if (Array.isArray(candidates.insights) && candidates.insights.length) {
    updated.insights = candidates.insights;
    log.push(`✓ insights 已更新（${candidates.insights.length} 条）`);
  }

  if (Array.isArray(candidates.bottlenecks) && candidates.bottlenecks.length) {
    updated.bottlenecks = candidates.bottlenecks;
    log.push(`✓ bottlenecks 已更新（${candidates.bottlenecks.length} 条）`);
  }

  return updated;
}

/* ---------- 主流程 ---------- */
function main() {
  if (!fs.existsSync(targetPath)) {
    console.error(`✗ 目标文件不存在：${targetPath}（请先创建基础 market.json）`);
    process.exit(1);
  }
  const current = JSON.parse(fs.readFileSync(targetPath, 'utf-8'));

  let candidates;
  try {
    const raw = fs.readFileSync(inputPath, 'utf-8');
    candidates = inputPath.toLowerCase().endsWith('.csv') ? csvRowsToIndicators(raw) : JSON.parse(raw);
  } catch (err) {
    console.error(`✗ 读取采集文件失败：${err.message}`);
    process.exit(1);
  }

  const log = [];
  const merged = mergeMarket(current, candidates, log);

  const today = new Date().toISOString().split('T')[0];
  const result = sanitizeUpdated('market.json', merged, current, today);
  result.log.forEach((m) => log.push(m));

  if (!result.ok) {
    console.error('✗ 清洗未通过，本次不入库：');
    result.log.forEach((m) => console.error(`  ${m}`));
    process.exit(1);
  }

  const nInd = (result.data.indicators || []).length;
  const nSer = (result.data.series || []).length;
  const nVerified = (result.data.indicators || []).filter((e) => e.verified !== false).length;

  if (dryRun) {
    console.log('—— 干跑模式（未写盘）——');
    log.forEach((m) => console.log(`  ${m}`));
    console.log(`样本：指标 ${nInd} 条（已验证 ${nVerified}）· 序列 ${nSer} 个 · 单次变更上限 ${MAX_ENTRY_CHANGES}`);
    process.exit(0);
  }

  fs.writeFileSync(targetPath, JSON.stringify(result.data, null, 2) + '\n', 'utf8');
  log.forEach((m) => console.log(`  ${m}`));
  console.log(`✓ market.json 已更新：指标 ${nInd} 条（已验证 ${nVerified}）· 序列 ${nSer} 个 · lastUpdated=${today}`);
}

main();
