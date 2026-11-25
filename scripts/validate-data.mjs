// ============================================================
// 数据仓库校验门禁（独立于 AI 更新，可单独运行）
// 用法：
//   node scripts/validate-data.mjs          # 只读校验，发现问题退出码 1
//   node scripts/validate-data.mjs --fix    # 自动修复可修复项（受保护字段/统计块/黑名单条目）后写回
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkRepoFile, REQUIRED_KEYS } from './data-rules.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dataDir = path.join(root, 'public', 'data');

const fix = process.argv.includes('--fix');

const DATA_FILES = Object.keys(REQUIRED_KEYS);

let totalErrors = 0;
let totalWarnings = 0;
const parsed = {};

for (const file of DATA_FILES) {
  const filePath = path.join(dataDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`✗ ${file}: 文件不存在`);
    totalErrors++;
    continue;
  }
  try {
    parsed[file] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`✗ ${file}: JSON 解析失败 - ${err.message}`);
    totalErrors++;
    continue;
  }
}

// 跨文件上下文：chain.json 的可复用火箭计数依赖 rockets.json
const ctx = { rockets: parsed['rockets.json']?.rockets };

for (const file of DATA_FILES) {
  if (!parsed[file]) continue;
  const { errors, warnings } = checkRepoFile(file, parsed[file], ctx, fix);
  totalErrors += errors.length;
  totalWarnings += warnings.length;

  if (errors.length) {
    errors.forEach((e) => console.error(`✗ ${file}: ${e}`));
  }
  if (warnings.length) {
    warnings.forEach((w) => console.warn(`⚠ ${file}: ${w}`));
  }
  if (!errors.length && !warnings.length) {
    console.log(`✓ ${file}: 通过核查`);
  } else if (!errors.length) {
    console.log(`✓ ${file}: 已修复（${warnings.length} 项）`);
  }

  if (fix && warnings.length) {
    fs.writeFileSync(path.join(dataDir, file), JSON.stringify(parsed[file], null, 2) + '\n');
  }
}

console.log('\n----------------------------------------');
console.log(`校验完成：${totalErrors} 个错误，${totalWarnings} 个${fix ? '自动修复' : '警告'}`);
console.log('----------------------------------------');

process.exit(totalErrors > 0 ? 1 : 0);
