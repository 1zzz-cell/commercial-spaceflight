/* ============================================
   设计令牌 —— 模块开发的「视觉接口」
   --------------------------------------------
   这里的值与 src/styles/global.css 的 :root 保持一一对应。
   模块里写样式请直接用 CSS 变量（var(--xxx)），不要用硬编码色值；
   但 ECharts 的 option 是 JS 对象，读不到 CSS 变量，
   所以图表场景从这里 import 常量。
   --------------------------------------------
   约定：新增颜色必须先在 global.css 定义变量，再同步到这里，
          由主仓负责人（非模块开发者）维护本文件。
   ============================================ */

export const color = {
  bgPrimary: '#eaeff6',
  bgSecondary: '#dfe5f0',
  bgCard: '#ffffff',
  bgCardHover: '#f8f9fc',
  bgInput: '#f0f2f5',

  textPrimary: '#1a1f36',
  textSecondary: '#4a5068',
  textMuted: '#8890a8',
  textAccent: '#0d8af0',

  blue: '#0d8af0',
  orange: '#f06235',
  purple: '#8b5cf6',
  green: '#10b981',
  cyan: '#06b6d4',
  amber: '#f59e0b',

  border: 'rgba(0, 0, 0, 0.08)',
  borderHover: 'rgba(0, 0, 0, 0.14)',
  borderActive: 'rgba(13, 138, 240, 0.40)',
};

/**
 * 涨跌配色：中国市场习惯 —— 上涨红色、下跌绿色
 * --------------------------------------------
 * DESIGN_SYSTEM §10.3 例外 #1：ECharts 的 JS option 读不到 CSS 变量，
 * 这里必须留字面量；改用白底 WCAG AA 达标可读色，与 format.js / .ds-tone-* 对齐。
 * up #c81e28 (5.72:1) / down #0a7442 (5.85:1) / flat #4a5068 (7.96:1)
 */
export const trendColor = {
  up: '#c81e28',
  down: '#0a7442',
  flat: '#4a5068',
};

/** 图表默认调色板，保证各模块图形语义一致 */
export const palette = [
  color.blue,
  color.orange,
  color.purple,
  color.green,
  color.cyan,
  color.amber,
];

export const font = {
  family:
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Helvetica, Arial, sans-serif",
  mono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
};

export const radius = { sm: 6, md: 10, lg: 16, xl: 24 };

/** ECharts 通用基线，减少各模块重复配置 */
export const chartBase = {
  textStyle: { fontFamily: font.family, color: color.textSecondary },
  title: {
    textStyle: { color: color.textPrimary, fontSize: 15, fontWeight: 500 },
    /* §10.3 例外 #1：subtext 原用 color.textMuted(#8890a8, 3.18:1) 不达标，
       改为 --text-secondary 同值 #4a5068 (7.96:1)；图表 JS option 读不到 CSS 变量 */
    subtextStyle: { color: '#4a5068', fontSize: 12 },
  },
  gridLine: 'rgba(0, 0, 0, 0.06)',
  tooltip: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderColor: color.border,
    borderWidth: 1,
    textStyle: { color: color.textPrimary, fontSize: 12 },
    extraCssText: 'box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-radius: 8px;',
  },
};
