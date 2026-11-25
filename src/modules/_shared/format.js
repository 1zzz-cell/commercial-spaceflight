/* ============================================
   格式化工具 —— 保证各模块数字呈现口径一致
   --------------------------------------------
   为什么需要统一：融资金额、百分比、日期在投资人视角和科研视角
   必须显示成同一个样子，否则同一个数两个页面两种写法，
   用户会怀疑数据本身不一致。
   ============================================ */

/**
 * 金额格式化（人民币口径）
 * 自动降级：>=1亿显示 X.X亿元，>=1万显示 X.X万元，否则原值
 * @param {number} value 单位：元
 */
export function formatAmount(value, { digits = 2, unit = true } = {}) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e8) return `${(n / 1e8).toFixed(digits)}${unit ? '亿元' : ''}`;
  if (abs >= 1e4) return `${(n / 1e4).toFixed(digits)}${unit ? '万元' : ''}`;
  return `${n}${unit ? '元' : ''}`;
}

/**
 * 融资金额：源数据常见「数亿元」「5000万」「1.5亿美元」这类区间/量级文本，
 * 统一转成「X.X亿元」便于排序与横向比较；无法解析的原样返回
 */
const CN_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
export function parseFunding(text) {
  if (!text) return null;
  const s = String(text).trim();
  // 「数亿元」「近亿元」这类模糊量级：给出保守下限
  if (/^数(亿|千万|百万)/.test(s)) {
    const mul = s.includes('亿') ? 1e8 : s.includes('千万') ? 1e7 : 1e6;
    return 2 * mul;
  }
  const m = s.match(/([\d.]+)\s*(亿|万)?/);
  if (!m) {
    const cn = Object.keys(CN_NUM).find((k) => s.startsWith(k));
    if (!cn) return null;
    const mul = s.includes('亿') ? 1e8 : s.includes('万') ? 1e4 : 1;
    return CN_NUM[cn] * mul;
  }
  const num = parseFloat(m[1]);
  if (!Number.isFinite(num)) return null;
  if (m[2] === '亿') return num * 1e8;
  if (m[2] === '万') return num * 1e4;
  // 无单位：若出现在「融资」「元」语境且数值较大，按元处理；此处保守返回 null 由调用方决定
  return /元|人民币/.test(s) ? num : null;
}

/** 百分比：入参为小数 0.1234 → 12.34% */
export function formatPercent(value, { digits = 1 } = {}) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

/** 千分位数字 */
export function formatNumber(value, { digits = 0 } = {}) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 日期：2026-10-17 */
export function formatDate(input) {
  if (!input) return '—';
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 同比/环比变化量 → 带符号文本 */
export function formatDelta(value, { digits = 1, suffix = '%' } = {}) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}${suffix}`;
}

/**
 * 涨跌语义 → 语义 tone + 达标可读色（中国市场：涨红跌绿）
 * --------------------------------------------
 * 兼容契约 E-4：原有 dir / color 字段一个不删，函数签名不变。
 *  - tone 直接复用 dir 枚举（up|down|flat），不新增第三套枚举；
 *  - color 保留给「直接消费 .color 写 inline style」的旧调用点
 *    （如 Research.jsx 的 .rs-tagcell），但换成白底 WCAG AA 达标值。
 * --------------------------------------------
 * 达标可读色：flat #4a5068 (7.96:1)、up #c81e28 (5.72:1)、down #0a7442 (5.85:1)
 * @returns {{dir: 'up'|'down'|'flat', tone: 'up'|'down'|'flat', color: string}}
 */
export function trendOf(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return { dir: 'flat', tone: 'flat', color: '#4a5068' };
  return n > 0
    ? { dir: 'up', tone: 'up', color: '#c81e28' }
    : { dir: 'down', tone: 'down', color: '#0a7442' };
}

/**
 * 数据可信度 → 统一文案与配色（科研门户「待核实」标记用）
 * --------------------------------------------
 * 兼容契约 E-4：level 枚举（verified|partial|unverified）、label、desc 一字不改，
 * color 键保留但由 var(--accent-amber) / var(--accent-green)（3.18–4.23:1 不达标）
 * 换成达标可读色；tone 直接复用 level 枚举供 .ds-tone-* 类消费。
 */
export function credibilityOf(item = {}) {
  if (item.verified === false || !item.source) {
    return { level: 'unverified', tone: 'unverified', label: '待核实', color: '#7a4d00', desc: '缺少来源或未经权威渠道核实' };
  }
  if (item.source && !item.sourceUrl) {
    return { level: 'partial', tone: 'partial', label: '来源未附链接', color: '#7a4d00', desc: '有来源标注但未提供原文链接' };
  }
  return { level: 'verified', tone: 'verified', label: '已核实', color: '#0a7442', desc: '含来源与原文链接' };
}
