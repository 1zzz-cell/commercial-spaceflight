/* ============================================================
   图表卡原生导出按钮（R3 键盘可达性硬约束）
   ------------------------------------------------------------
   echarts toolbox 的图标是 canvas 绘制的，不是 DOM <button>，Tab 键
   不可聚焦，键盘用户无法触发导出。因此每张含 CSV 导出的图表卡都必须
   额外提供一个原生 <button> 作为等价入口。

   本按钮是独立 DOM 元素，不在 echarts canvas 内；样式复用既有
   .portal-export-btn（hover / focus 由 visual-convergence.css 补齐），
   不靠给 toolbox 容器加 tabIndex 假装可聚焦。

   csv 由调用方显式传入；未传时回退到 buildToolbox 登记的同一份载荷
   （以 filename 为键），保证按钮与工具箱图标导出内容完全一致，
   也避免把 headers/rows/source/caliber 在 JSX 里再抄一遍。
   导出一律走 @portal 的 exportCSV，不在本组件另写下载逻辑。
   ============================================================ */
import { useDisclaimerGuard } from './ComplianceKit';
import { exportCSV, EXPORT_DISCLAIMER } from '../modules/_shared/exporters';
import { getChartCsv } from '../utils/chartTools';

export default function ChartExportButton({ filename, csv, className = '' }) {
  const { requireConfirm, modal } = useDisclaimerGuard();

  const onClick = () => {
    const payload = csv || getChartCsv(filename) || {};
    const run = () => exportCSV(filename, {
      ...payload,
      extraMeta: [...(payload.extraMeta || []), EXPORT_DISCLAIMER],
    });
    requireConfirm(run, {
      title: '导出前请确认',
      notice: `即将导出「${filename}」。导出内容仅作研究参考，请确认已核对来源与口径。`,
      confirmLabel: '确认并导出',
    });
  };

  return (
    <>
      <button
        type="button"
        className={`portal-export-btn ${className}`.trim()}
        style={{ minHeight: 44 }}
        onClick={onClick}
      >
        导出数据 CSV
      </button>
      {modal}
    </>
  );
}
