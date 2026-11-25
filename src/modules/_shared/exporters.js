/* ============================================
   统一导出工具 —— 全站唯一实现
   --------------------------------------------
   历史问题：项目里曾存在两套各自实现的 CSV 导出
   （utils/chartTools.js 的 exportCSV 与 components/DataTable.jsx 内部的 exportCSV），
   语义不一致（前者带来源/口径 meta 行，后者没有），导致科研口径无法对齐。

   收敛规则：
   - 所有导出一律走本模块，禁止在模块内再写一份 download 逻辑
   - CSV 默认携带 meta 注释行（# 前缀），pandas read_csv(comment='#') 可直接识别
   - 导出的永远是可读原文 + 原始数值，不导出图表用的归一化显示值

   用法：
     import { exportCSV, exportJSON, exportBibTeX } from '@portal';
   ============================================ */

/* 导出件统一附带的免责说明：ExportBar / DataTable 共用唯一真源 */
export const EXPORT_DISCLAIMER = '仅供研究参考与投资者教育，不构成投资建议；引用请保留来源、数据时间与口径';

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 立即 revoke 在部分浏览器会中断下载，延后释放
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** 文件名消毒：Windows 非法字符替换，避免下载失败 */
function safeName(name) {
  return (name || 'export').replace(/[\\/:*?"<>|]/g, '_');
}

/** CSV 单元格转义（RFC 4180） */
function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 统一时间戳，格式固定便于比对 */
function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function buildMetaLines({ source = '', caliber = '', exportedAt = true, extraMeta = [] } = {}) {
  const lines = [];
  if (source) lines.push(`# 数据来源：${source}`);
  if (caliber) lines.push(`# 统计口径：${caliber}`);
  extraMeta.forEach((m) => lines.push(`# ${m}`));
  if (exportedAt) lines.push(`# 导出时间：${stamp()}`);
  if (lines.length) lines.push('#');
  return lines;
}

/**
 * 导出 CSV
 * @param {string} filename   不含扩展名
 * @param {Object} payload
 * @param {string[]} payload.headers      表头
 * @param {Array[]} payload.rows          数据行
 * @param {string} [payload.source]       数据来源描述，写入 meta 行
 * @param {string} [payload.caliber]      统计口径说明，写入 meta 行
 * @param {string[]} [payload.extraMeta]  额外 meta 行
 * @param {boolean} [payload.exportedAt=true] 是否写入导出时间
 */
export function exportCSV(filename, { headers = [], rows = [], source = '', caliber = '', extraMeta = [], exportedAt = true } = {}) {
  const lines = [
    ...buildMetaLines({ source, caliber, exportedAt, extraMeta }),
    headers.map(csvCell).join(','),
    ...rows.map((r) => (Array.isArray(r) ? r : []).map(csvCell).join(',')),
  ];
  // BOM：保证 Excel 打开中文不乱码
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(`${safeName(filename)}.csv`, blob);
}

/**
 * 导出 JSON（保留原始结构，便于程序复用）
 * @param {string} filename
 * @param {*} data
 * @param {{source?:string, caliber?:string}} [meta] 以 _meta 字段一并写入
 */
export function exportJSON(filename, data, meta = {}) {
  const payload = Object.keys(meta).length ? { _meta: { ...meta, exportedAt: stamp() }, data } : data;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  downloadBlob(`${safeName(filename)}.json`, blob);
}

/**
 * 导出 BibTeX 引用条目 —— 科研场景复用本站数据时的规范引用
 * @param {string} filename
 * @param {Object} cite
 * @param {string} cite.title      数据集标题
 * @param {string} cite.author     维护方，默认「中国商业航天产业分析平台」
 * @param {string} [cite.year]     发布年份，默认当前年
 * @param {string} [cite.url]      访问地址，默认当前页 URL
 * @param {string} [cite.note]     额外说明
 */
export function exportBibTeX(filename, { title, author = '中国商业航天产业分析平台', year, url, note = '' }) {
  if (!title) throw new Error('exportBibTeX: title 必填');
  const y = year || String(new Date().getFullYear());
  const u = url || (typeof window !== 'undefined' ? window.location.href : '');
  const lines = [
    '@misc{commercialspace:' + safeName(title) + ',',
    `  title  = {${title}},`,
    `  author = {${author}},`,
    `  year   = {${y}},`,
    ...(note ? [`  note   = {${note}},`] : []),
    ...(u ? [`  url    = {${u}},`] : []),
    `  urldate= {${y}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}}`,
    '}',
    '',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'application/x-bibtex;charset=utf-8' });
  downloadBlob(`${safeName(filename)}.bib`, blob);
}

/** 导出纯文本（用于数据字典、方法说明等长文） */
export function exportText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  downloadBlob(`${safeName(filename)}.txt`, blob);
}
