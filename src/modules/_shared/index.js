/* ============================================
   @portal —— 模块开发统一入口
   --------------------------------------------
   模块里只允许这样取共用能力：
     import { useChart, exportCSV, Card, color } from '@portal';

   禁止跨层相对引用主仓内部实现，例如：
     import { exportCSV } from '../../../utils/chartTools'   ✗
   原因：主仓重命名/移动文件时会一次性打断所有模块，而 @portal 只需改本文件。

   本文件是不可变的「接口层」：修改它需要走 review，
   因为它同时被多个并行模块依赖。
   ============================================ */

/* ---- 设计令牌 ---- */
export { color, palette, trendColor, chartBase, font, radius } from './tokens';

/* ---- 格式化 ---- */
export {
  formatAmount, parseFunding, formatPercent, formatNumber,
  formatDate, formatDelta, trendOf, credibilityOf,
} from './format';

/* ---- 导出（全站唯一实现，勿另行实现） ---- */
export { exportCSV, exportJSON, exportBibTeX, exportText, EXPORT_DISCLAIMER } from './exporters';

/* ---- 图表 ---- */
export { useChart } from './useChart';
// 既有的科研工具箱（矢量导出 / 数据缩放）保留原实现，统一由此处出口
export { buildToolbox, exportChartSVG } from '../../utils/chartTools';

/* ---- UI 组件 ---- */
export {
  Card, SectionTitle, StatCard, Delta, SourceTag,
  ExportBar, EmptyState, Grid, Icon,
} from './components';

/* ---- 复用主仓已成熟组件，避免重写 ---- */
export { DataTable } from '../../components/DataTable';

/* ---- 数据契约 accessor：语义化取值，屏蔽底层字段变化 ---- */
export {
  DATASETS, selectDataset, selectDatasetMeta,
  flattenDataset, allFlatRecords, aggregateFundingByCompany,
} from './datasets';
