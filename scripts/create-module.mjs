/* ============================================
   模块脚手架生成器
   --------------------------------------------
   用法：
     node scripts/create-module.mjs Research --title "科研门户" --owner "张三"
     node scripts/create-module.mjs Investors --title "投资人门户" --owner "李四"

   产出：
     src/modules/<Name>/index.jsx
     src/modules/<Name>/styles.css

   设计要点：本脚本刻意【不修改 App.jsx / Header.jsx / global.css】，
   因为这些是被多人共享的文件。模块建好后：
   - 开发调试：自动出现在 http://localhost:5173/module-dev.html 左侧列表（免注册）
   - 正式上线：由主仓负责人在 App.jsx 加一条 Route（唯一的合并点）
   ============================================ */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MODULES_DIR = path.join(ROOT, 'src', 'modules');
const TPL_DIR = path.join(__dirname, 'templates');

/** 帕斯卡 → 短横线式：ResearchPortal → research-portal */
function toKebab(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function readTpl(name) {
  const p = path.join(TPL_DIR, name);
  if (!fs.existsSync(p)) throw new Error(`模板缺失：${p}`);
  return fs.readFileSync(p, 'utf8');
}

/** 先替换 {{VAR}}，避免后续 replace 误伤模板里的 $ 序列 */
function render(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in vars ? vars[k] : `{{${k}}}`));
}

function main() {
  const argv = process.argv.slice(2);
  const rawName = argv.find((a) => !a.startsWith('--'));
  const getFlag = (f) => {
    const i = argv.indexOf(`--${f}`);
    return i === -1 ? null : argv[i + 1];
  };

  if (!rawName) {
    console.error('✗ 缺少模块名。用法：node scripts/create-module.mjs <名称> --title "页面标题"');
    process.exit(1);
  }

  // 名称必须是合法标识符：既是目录名，也会被用作组件名
  const MODULE_ID = rawName.replace(/-(\w)/g, (_, c) => c.toUpperCase()).replace(/^[a-z]/, (c) => c.toUpperCase());
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(MODULE_ID)) {
    console.error(`✗ 模块名只能用字母和数字："${rawName}"`);
    process.exit(1);
  }

  const MODULE_TITLE = getFlag('title') || `${MODULE_ID} 模块`;
  const OWNER = getFlag('owner') || '未指定';
  const MODULE_CLASS = toKebab(MODULE_ID);
  const DATE = new Date().toISOString().slice(0, 10);

  const targetDir = path.join(MODULES_DIR, MODULE_ID);
  if (fs.existsSync(targetDir)) {
    console.error(`✗ 模块已存在：${targetDir}\n  如需重置，请先手动删除该目录。`);
    process.exit(1);
  }

  const vars = { MODULE_ID, MODULE_TITLE, MODULE_CLASS, OWNER, DATE };
  fs.mkdirSync(targetDir, { recursive: true });
  fs.writeFileSync(path.join(targetDir, 'index.jsx'), render(readTpl('module-index.jsx.tpl'), vars), 'utf8');
  fs.writeFileSync(path.join(targetDir, 'styles.css'), render(readTpl('module-styles.css.tpl'), vars), 'utf8');

  console.log(`\n✓ 模块已创建：src/modules/${MODULE_ID}/`);
  console.log(`  组件名      ${MODULE_ID}`);
  console.log(`  页面标题    ${MODULE_TITLE}`);
  console.log(`  样式前缀    .${MODULE_CLASS}-`);
  console.log(`  负责人      ${OWNER}\n`);
  console.log('下一步：');
  console.log('  1. npm run dev:module        打开模块沙箱，左侧列表会自动出现该模块');
  console.log('  2. 只改 src/modules/' + MODULE_ID + '/ 下的文件');
  console.log('  3. 完成后通知主仓负责人挂路由（唯一需要合并的地方）\n');
}

try {
  main();
} catch (e) {
  console.error('✗ 创建失败：', e.message);
  process.exit(1);
}
