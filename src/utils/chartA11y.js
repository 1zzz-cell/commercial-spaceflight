/* ============================================
   图表无障碍文本等价（canvas → 可读 DOM）
   ------------------------------------------------------------
   ECharts 默认用 canvas 绘制，读屏软件拿不到任何数值信息；
   toolbox 图标也不是 DOM button。本工具在图表容器旁注入：
     1. 容器 role="img" + aria-label（一句话摘要，读屏即时播报）
     2. <details> 包裹的原生 <table>（键盘可达、可展开核对原始数值）
   表格数据直接复用 buildToolbox 已传入的 csv.headers / csv.rows，
   不复制数据源、不与导出逻辑分叉。

   调用点只有 buildToolbox 一处，因此全站 ~30 张图零改动接入。
   幂等：用 dataset 标记，重复 setOption 不会重复插入；
   csv 变化时只更新表格内容，不重建 details（保留用户展开状态）。
   ============================================ */

const MARK = 'chartA11y';

/** 生成一句话摘要：图表标题 + 样本量 + 来源，供 aria-label 使用 */
export function summarize({ filename, csv }) {
  const rows = csv?.rows?.length || 0;
  const cols = csv?.headers?.length || 0;
  const parts = [filename || '数据图表'];
  if (rows) parts.push(`${rows} 行 ${cols} 列数据`);
  // 来源与标题相同（useChart 兜底路径传的占位）时不重复播报「来源：X，X」
  if (csv?.source && csv.source !== filename) parts.push(`来源：${csv.source}`);
  return parts.join('，');
}

/** 从 ECharts option 提取「类别 + 各系列」的二维表，供未传 csv 的 useChart 图表兜底 */
export function csvFromOption(option, label = '图表数据') {
  if (!option) return null;
  const catAxis = [].concat(option.xAxis || [])[0];
  const categories = catAxis?.data;
  const series = [].concat(option.series || []).filter((s) => Array.isArray(s?.data));
  if (!series.length) return null;
  const headers = [catAxis?.name || '类别', ...series.map((s, i) => s.name || `系列${i + 1}`)];
  const len = Math.max(
    Array.isArray(categories) ? categories.length : 0,
    ...series.map((s) => s.data.length),
  );
  const rows = Array.from({ length: len }, (_, i) => [
    Array.isArray(categories) ? (categories[i] ?? '') : i + 1,
    ...series.map((s) => {
      const v = s.data[i];
      return v && typeof v === 'object' ? (v.value ?? '') : (v ?? '');
    }),
  ]);
  return { headers, rows, source: label, caliber: '' };
}

/**
 * 在 inst 的图表容器旁挂载无障碍表格。
 * @param inst  echarts 实例（用于取 getDom）
 * @param meta  { filename, csv, caliber }
 */
export function attachChartA11y(inst, { filename, csv, onlyIfEmpty = false } = {}) {
  if (!inst || typeof inst.getDom !== 'function') return;
  const dom = inst.getDom();
  if (!dom || !dom.isConnected) return;

  const sibling = dom.nextElementSibling;
  const hasTable = sibling?.tagName === 'DETAILS' && sibling.hasAttribute(`data-${MARK}`);
  // useChart 的兜底路径：若 buildToolbox 已注入带来源/口径的 csv 表格，不覆盖
  if (onlyIfEmpty && hasTable) return;

  // 1) 容器语义：让读屏把它当一张有说明的图，而不是无名 div
  if (!dom.hasAttribute('role')) dom.setAttribute('role', 'img');
  dom.setAttribute('aria-label', summarize({ filename, csv }));

  const rows = csv?.rows || [];
  const headers = csv?.headers || [];
  if (!rows.length || !headers.length) return;

  // 2) details/table 幂等挂载：只认「紧邻本容器之后」的表格。
  // 不能从 parentElement 里 querySelector——一个 chart-card 有多张图时会
  // 命中第一张图的表格，导致其余图表更新错表（实测 /analysis 出现过串写）。
  let details = dom.nextElementSibling;
  if (!details || details.tagName !== 'DETAILS' || !details.hasAttribute(`data-${MARK}`)) {
    details = document.createElement('details');
    details.setAttribute(`data-${MARK}`, '');
    details.className = 'chart-a11y';
    const summary = document.createElement('summary');
    summary.className = 'chart-a11y-summary';
    summary.textContent = '查看图表数据表格';
    const wrap = document.createElement('div');
    wrap.className = 'chart-a11y-scroll';
    const table = document.createElement('table');
    table.className = 'chart-a11y-table';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);
    details.appendChild(summary);
    details.appendChild(wrap);
    dom.after(details);
  }

  // 3) 更新表头/表体（csv 变化时），保留 details 展开状态
  const table = details.querySelector('table');
  const thead = table.tHead;
  const tbody = table.tBodies[0];

  const headRow = document.createElement('tr');
  headers.forEach((h) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = h == null ? '' : String(h);
    headRow.appendChild(th);
  });
  thead.replaceChildren(headRow);

  const bodyRows = rows.slice(0, 500).map((row) => {
    const tr = document.createElement('tr');
    (Array.isArray(row) ? row : [row]).forEach((cell) => {
      const td = document.createElement('td');
      td.textContent = cell == null ? '' : String(cell);
      tr.appendChild(td);
    });
    return tr;
  });
  tbody.replaceChildren(...bodyRows);

  // 4) 口径说明作为 caption 的补充（若提供）
  const caliber = csv?.caliber;
  let note = details.querySelector('.chart-a11y-note');
  if (caliber) {
    if (!note) {
      note = document.createElement('p');
      note.className = 'chart-a11y-note';
      details.appendChild(note);
    }
    note.textContent = `口径：${caliber}`;
  } else if (note) {
    note.remove();
  }
}
