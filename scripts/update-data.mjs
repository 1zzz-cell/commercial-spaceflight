import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sanitizeUpdated, MAX_ENTRY_CHANGES } from './data-rules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'public', 'data');

const AI_API_KEY = process.env.AI_API_KEY;
const AI_API_BASE = process.env.AI_API_BASE || 'https://api.deepseek.com/v1';
const AI_MODEL = process.env.AI_MODEL || 'deepseek-chat';

if (!AI_API_KEY) {
  console.error('错误：未设置 AI_API_KEY 环境变量');
  process.exit(1);
}

// rockets.json 必须最先处理：chain.json 的统计重算依赖其可复用火箭计数
const DATA_FILES = [
  'rockets.json',
  'constellations.json',
  'industry.json',
  'chain.json',
  'policy.json',
  'dashboard.json',
];

const today = new Date().toISOString().split('T')[0];
const reviewOnly = process.argv.includes('--review');
const applyChanges = !reviewOnly;
const candidateDir = path.join(root, 'data-update-candidates', today);
const changeReport = [];

function collectSourceUrls(value, output = new Set()) {
  if (Array.isArray(value)) value.forEach((item) => collectSourceUrls(item, output));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'sourceUrl' && typeof item === 'string' && item) output.add(item);
      else collectSourceUrls(item, output);
    }
  }
  return [...output];
}

async function verifySourceUrls(data) {
  const errors = [];
  for (const url of collectSourceUrls(data)) {
    if (!/^https:\/\//i.test(url)) {
      errors.push(`来源链接不是 HTTPS：${url}`);
      continue;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      let response = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
      if (!response.ok) {
        response = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'follow', signal: controller.signal });
      }
      if (!response.ok) errors.push(`来源链接不可访问（${response.status}）：${url}`);
    } catch (error) {
      errors.push(`来源链接检查失败（${error.name === 'AbortError' ? '超时' : error.message}）：${url}`);
    } finally {
      clearTimeout(timer);
    }
  }
  return errors;
}

// 本次运行中已净化的数据缓存（供跨文件规则使用，如 chain 依赖 rockets）
const sanitizedCache = {};

async function callAI(prompt) {
  const res = await fetch(`${AI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: '你是一个商业航天产业数据分析师。你的任务是在严格核查规则下更新数据文件：所有新增或修改的内容必须可溯源，禁止写入任何无公开来源佐证的信息。你必须严格返回JSON格式。如果某个文件不需要更新，返回该文件的原始内容。',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 8000,
    }),
  });

  if (!res.ok) {
    throw new Error(`AI API 调用失败: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

function extractJSON(text) {
  const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart !== -1 && jsonEnd !== -1) return text.slice(jsonStart, jsonEnd + 1);
  return text.trim();
}

function buildPrompt(filename, current) {
  return `你是一个商业航天产业数据平台的维护助手。请审查并更新以下数据文件。

## 当前数据文件：${filename}
最后更新：${current.lastUpdated}

## 当前数据内容（JSON）：
${JSON.stringify(current, null, 2).slice(0, 6000)}

## 硬性核查规则（违反任何一条，整份文件将被系统拒绝入库）：
1. 新增的任何条目（火箭/星座/政策/融资事件）必须包含 source 字段，注明公开来源（如"国家航天局""新华社""公司官方公告"）；能提供原文链接时同时包含 sourceUrl 字段。无 source 的新条目会被系统直接丢弃。
2. 修改既有条目时同样必须提供 source；未提供来源的修改会被系统自动回退。
3. 以下受保护字段为人工核实的官方口径，禁止修改：
   - CZ-5 leo=25、gto=14；TL-2 leo=2；CZ-8A reusable=false；CZ-6 propellant="液氧+煤油"
   - StarLink planned=41930；OneWeb actual=648；Amazon Leo firstLaunch="2023"
4. 单个文件本次最多新增或修改 ${MAX_ENTRY_CHANGES} 个条目，超出上限整份文件被拒绝。
5. 禁止写入无公开来源佐证的机构名、文件名、事件或精确数字（例如无法核实的司局设立、标准文件、累计发射次数）。不确定的数据宁可不更新。
6. 统计类字段（typeStats、statusStats、orbitStats、deployProgress、frequencyStats、policyTrend、policyTypeStats）无需更新——系统会根据明细自动重算，你只需保证明细准确。
7. 保持原有 JSON 结构和字段名完全不变；更新 lastUpdated 字段为 "${today}"。
8. 如果没有需要更新的内容，完整保留原数据与时间字段，不要为了刷新日期制造变更。
9. 保留 meta.asOfDate（数据截至日）、meta.lastVerifiedAt（最近核验日）和 meta.publishedAt（网站发布时间）字段。若本次修改了内容，更新 lastVerifiedAt 和 publishedAt；asOfDate 只在来源明确给出数据截至日时更新。

## 重要约束：
- 只返回更新后的完整 JSON，不要包含任何解释文字
- 确保返回的是合法 JSON
- 新增记录必须与现有记录的字段格式完全一致

请直接返回更新后的完整 JSON：`;
}

async function updateFile(filename) {
  const filePath = path.join(dataDir, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const current = JSON.parse(raw);

  console.log(`正在更新 ${filename}...`);

  try {
    const response = await callAI(buildPrompt(filename, current));
    const jsonStr = extractJSON(response);
    const updated = JSON.parse(jsonStr); // JSON 合法性校验

    // 跨文件上下文：chain.json 的统计重算依赖（已净化的）rockets 数据
    const ctx = { rockets: sanitizedCache['rockets.json']?.rockets || current.rockets };

    // 净化管线：结构校验 → 黑名单 → 来源规则 → 受保护字段 → 变更上限 → 统计重算
    const result = sanitizeUpdated(filename, updated, current, today, ctx);

    for (const line of result.log) console.log(`  ${line}`);

    if (!result.ok) {
      console.warn(`  → ${filename} 保留原数据（AI 输出未通过核查）`);
      return false;
    }
    if (applyChanges && result.log.some((line) => line.includes('无 sourceUrl'))) {
      console.warn(`  → ${filename} 含有变更但缺少原文链接，自动发布拦截`);
      changeReport.push({ filename, changed: false, applied: false, blocked: 'changed_entry_without_source_url', log: result.log });
      return false;
    }

    // 只有内容发生变化才推进发布时间，避免“日期变新但数据没变”。
    const comparable = (value) => {
      const copy = JSON.parse(JSON.stringify(value));
      copy.lastUpdated = '';
      if (copy.meta) {
        copy.meta.lastVerifiedAt = '';
        copy.meta.publishedAt = '';
      }
      return JSON.stringify(copy);
    };
    const changed = comparable(current) !== comparable(result.data);
    if (applyChanges && changed) {
      const sourceErrors = await verifySourceUrls(result.data);
      if (sourceErrors.length) {
        sourceErrors.forEach((line) => console.warn(`  ⚠ ${line}`));
        changeReport.push({ filename, changed: false, applied: false, blocked: 'source_url_unreachable', errors: sourceErrors });
        return false;
      }
    }
    const output = changed
      ? {
        ...result.data,
        lastUpdated: today,
        meta: { ...(current.meta || {}), ...(result.data.meta || {}), lastVerifiedAt: today, publishedAt: today },
      }
      : current;

    sanitizedCache[filename] = output;
    changeReport.push({ filename, changed, applied: applyChanges, log: result.log });
    if (changed && applyChanges) fs.writeFileSync(filePath, JSON.stringify(output, null, 2) + '\n');
    if (changed && !applyChanges) {
      fs.mkdirSync(candidateDir, { recursive: true });
      fs.writeFileSync(path.join(candidateDir, filename), JSON.stringify(output, null, 2) + '\n');
    }

    console.log(changed
      ? `  ✓ ${filename}: 已通过核查，${applyChanges ? '写入工作区' : '写入候选目录，等待人工审核'}`
      : `  ✓ ${filename}: 内容无变化，保留原更新时间`);
    return true;
  } catch (err) {
    console.error(`  ✗ ${filename} 更新失败: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('========================================');
  console.log(`商业航天数据每日更新（含核查规则）- ${today}`);
  console.log(`AI API: ${AI_API_BASE}`);
  console.log(`AI Model: ${AI_MODEL}`);
  console.log('========================================\n');

  let successCount = 0;
  let failCount = 0;

  for (const file of DATA_FILES) {
    const ok = await updateFile(file);
    if (ok) successCount++;
    else failCount++;
  }

  if (changeReport.some((item) => item.changed)) {
    fs.mkdirSync(candidateDir, { recursive: true });
    fs.writeFileSync(path.join(candidateDir, 'manifest.json'), JSON.stringify({
      generatedAt: new Date().toISOString(),
      mode: applyChanges ? 'apply' : 'review',
      files: changeReport,
    }, null, 2) + '\n');
  }

  console.log('\n----------------------------------------');
  console.log(`更新完成：成功 ${successCount} 个，失败（含被核查拦截） ${failCount} 个`);
  console.log('----------------------------------------\n');

  // 输出变更摘要供 GitHub Actions 使用
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    fs.appendFileSync(ghOutput, `updated_files=${successCount}\nchanged_files=${changeReport.filter((x) => x.changed).length}\n`);
  } else {
    console.log('::set-output name=updated_files::' + successCount);
  }
  if (failCount > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('脚本执行失败:', err);
  process.exit(1);
});
