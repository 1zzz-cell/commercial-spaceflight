#!/usr/bin/env node
/* ============================================================
   数据新鲜度体检 —— npm run data:status
   ------------------------------------------------------------
   为什么需要它：前端显示的 data.lastUpdated 是 8 个 JSON 文件
   取「最大值」，这会掩盖「某个文件其实很久没更新」。
   实际就出现过：market.json 停在 10-21，而其余文件停在 10-04，
   页面徽标却只显示 10-21，看起来全部很新。

   本脚本逐个文件报出更新时间、条目数与陈旧天数，按「最旧在前」排序，
   超过阈值（默认 30 天）的文件给出告警。

   用法：
     npm run data:status                  默认阈值 30 天
     npm run data:status -- --warn 7      自定义阈值
     node scripts/data-status.mjs --json  输出 JSON，便于 CI 消费

   只读，不修改任何数据文件。
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'public', 'data');

/* 每个文件的「条目数」怎么数：不同文件的主数组字段不同 */
const FILES = [
  { key: 'rockets', file: 'rockets.json', label: '火箭型号', count: (d) => d.rockets?.length ?? null },
  { key: 'constellations', file: 'constellations.json', label: '卫星星座', count: (d) => d.constellations?.length ?? null },
  { key: 'industry', file: 'industry.json', label: '融资事件', count: (d) => d.financingEvents?.length ?? null },
  {
    key: 'chain',
    file: 'chain.json',
    label: '产业链企业',
    count: (d) => (d.enterpriseMatrix?.data || []).reduce((s, n) => s + (n.companies?.length || 0), 0) || null,
  },
  {
    key: 'policy',
    file: 'policy.json',
    label: '政策法规',
    count: (d) => Object.values(d.policyData || {}).flat().length || null,
  },
  { key: 'dashboard', file: 'dashboard.json', label: '首页总览', count: (d) => d.dashboardMetrics?.length ?? null },
  { key: 'geoData', file: 'geoData.json', label: '区域分布', count: () => null },
  { key: 'market', file: 'market.json', label: '市场指标', count: (d) => d.indicators?.length ?? null },
];

/* ---------- 参数 ---------- */
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const warnIdx = argv.indexOf('--warn');
const WARN_DAYS = warnIdx >= 0 ? Number(argv[warnIdx + 1]) || 30 : 30;

/* ---------- 采集 ---------- */
const rows = [];
const missing = [];

FILES.forEach(({ key, file, label, count }) => {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) {
    missing.push(file);
    return;
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    missing.push(`${file}（解析失败：${e.message}）`);
    return;
  }

  const ts = raw.lastUpdated || null;
  let days = null;
  if (ts) {
    const t = new Date(ts);
    if (!Number.isNaN(t.getTime())) {
      days = Math.floor((Date.now() - t.getTime()) / 86400000);
    }
  }
  rows.push({
    key, file, label,
    lastUpdated: ts || '（无 lastUpdated 字段）',
    asOfDate: raw.meta?.asOfDate || null,
    lastVerifiedAt: raw.meta?.lastVerifiedAt || null,
    publishedAt: raw.meta?.publishedAt || ts || null,
    days,
    count: count(raw),
  });
});

/* 最旧在前；无时间戳的排最前（最值得怀疑） */
rows.sort((a, b) => (b.days ?? Infinity) - (a.days ?? Infinity));

/* ---------- 输出 ---------- */
if (asJson) {
  console.log(JSON.stringify({ warnDays: WARN_DAYS, rows, missing }, null, 2));
  process.exit(0);
}

const pad = (s, n) => String(s).padEnd(n, ' ');
const padStart = (s, n) => String(s).padStart(n, ' ');

console.log('');
console.log('数据新鲜度体检');
console.log('='.repeat(64));
console.log(`${pad('文件', 22)}${pad('内容', 12)}${padStart('条目', 6)}${pad('  发布日期', 14)}${pad('截至日', 14)}${padStart('陈旧', 8)}`);
console.log('-'.repeat(64));

rows.forEach((r) => {
  const stale = r.days == null ? '未知' : `${r.days} 天`;
  const flag = r.days != null && r.days > WARN_DAYS ? '  ⚠' : '';
  console.log(
    `${pad(r.file, 22)}${pad(r.label, 12)}${padStart(r.count ?? '—', 6)}    ${pad(r.publishedAt || r.lastUpdated, 12)}${pad(r.asOfDate || '未记录', 12)}${padStart(stale, 6)}${flag}`,
  );
});

console.log('-'.repeat(64));
const newest = rows
  .filter((r) => r.days != null)
  .reduce((m, r) => (m == null || r.days < m.days ? r : m), null);
console.log(`前端徽标显示的是聚合值（最大值）：${newest ? newest.lastUpdated : '—'}`);
console.log(`陈旧阈值：${WARN_DAYS} 天`);

const staleList = rows.filter((r) => r.days != null && r.days > WARN_DAYS);
if (staleList.length) {
  console.log('');
  console.log(`⚠ ${staleList.length} 个文件超过阈值：${staleList.map((r) => r.file).join('、')}`);
  console.log('  页面徽标取的是最大值，这些文件的陈旧会被掩盖。');
}

if (missing.length) {
  console.log('');
  console.log(`✗ 缺失或无法解析：${missing.join('、')}`);
}

console.log('');
process.exit(0);
