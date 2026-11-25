import { useState, useMemo, useCallback } from 'react';
import Icon from './Icon';
import { useDisclaimerGuard } from './ComplianceKit';
import { exportCSV, EXPORT_DISCLAIMER } from '../modules/_shared/exporters';

/* 企业级数据表格：排序、筛选、分页、导出 */
function DataTable({
  data,
  columns,
  filename = 'export',
  pageSize = 15,
  filters,
  defaultSort,
  /* 可选：导出前动作守卫 + 来源口径 meta。
     Phase 3C：调用方没显式传 exportGuard 时，组件内部自行 useDisclaimerGuard()，
     所有导出一律先确认再执行并附 EXPORT_DISCLAIMER，做到全站零漏网；
     /investors 等已显式传 guard 的页面仍走调用方的守卫与 modal，行为不变。 */
  exportGuard,
  exportMeta,
}) {
  const [sortKey, setSortKey] = useState(defaultSort?.key || null);
  const [sortDir, setSortDir] = useState(defaultSort?.dir || 'asc');
  const [page, setPage] = useState(0);
  const [activeFilters, setActiveFilters] = useState({});
  const { requireConfirm, modal } = useDisclaimerGuard();
  const guard = typeof exportGuard === 'function' ? exportGuard : requireConfirm;

  // 应用筛选
  const filtered = useMemo(() => {
    let result = data;
    Object.entries(activeFilters).forEach(([key, value]) => {
      if (!value || value === '全部') return;
      result = result.filter((row) => String(row[key] ?? '') === value);
    });
    return result;
  }, [data, activeFilters]);

  // 应用排序
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      let cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'zh');
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // 分页
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = useCallback((key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(0);
  }, [sortKey]);

  // 获取筛选器选项
  const filterOptions = useMemo(() => {
    if (!filters) return {};
    const opts = {};
    filters.forEach((f) => {
      const unique = [...new Set(data.map((d) => String(d[f.key] ?? '')))].filter(Boolean).sort();
      opts[f.key] = unique;
    });
    return opts;
  }, [data, filters]);

  const doExport = () => {
    const headers = columns.map((c) => c.label);
    const rows = sorted.map((row) => columns.map((c) => row[c.key]));
    // 免责说明是唯一真源；来源/口径由 exportMeta 或图表自带 meta 行提供
    const payload = {
      headers,
      rows,
      ...(exportMeta || {}),
      extraMeta: [...(exportMeta?.extraMeta || []), EXPORT_DISCLAIMER],
    };
    guard(() => exportCSV(filename, payload), {
      title: '导出前请确认',
      notice: `即将导出「${filename}」。导出内容仅作研究参考，请确认已核对来源与口径。`,
      confirmLabel: '确认并导出',
    });
  };

  return (
    <div className="data-table-container">
      {/* 工具栏：筛选 + 导出 */}
      {(filters || true) && (
        <div className="data-table-toolbar">
          <div className="data-table-filters">
            {filters?.map((f, fi) => (
              <select
                key={`filter-${f.key}-${fi}`}
                className="data-table-filter-select"
                value={activeFilters[f.key] || '全部'}
                onChange={(e) => {
                  setActiveFilters((prev) => ({ ...prev, [f.key]: e.target.value }));
                  setPage(0);
                }}
              >
                <option value="全部">{f.label}: 全部</option>
                {filterOptions[f.key]?.map((opt, oi) => (
                  <option key={`${f.key}-${opt}-${oi}`} value={opt}>{opt}</option>
                ))}
              </select>
            ))}
          </div>
          <div className="data-table-actions">
            <span className="data-table-count">共 {sorted.length} 条</span>
            <button className="data-table-export-btn" onClick={doExport}>
              <Icon name="download" size={14} />
              导出 CSV
            </button>
          </div>
        </div>
      )}

      {/* 表格 */}
      <div className="constellation-table-wrap">
        <table className="constellation-table">
          <thead>
            <tr>
              {columns.map((col, ci) => (
                <th
                  key={`th-${col.key}-${ci}`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={col.sortable !== false ? { cursor: 'pointer', userSelect: 'none' } : { cursor: 'default' }}
                  title={col.sortable !== false ? '点击排序' : undefined}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span className="sort-indicator" style={{ marginLeft: 4, display: 'inline-flex', verticalAlign: 'middle' }}>
                      <Icon name={sortDir === 'asc' ? 'chevron-up' : 'chevron-down'} size={14} />
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              // 用稳定唯一值：id 优先，index 兜底且恒参与 key。
              // 旧写法 row.id || i 在 id=0 时会退化成当前页索引，
              // 排序后与另一行的真实 id 撞车（/constellation 的 key=14 警告根因）。
              <tr key={`${row.id ?? 'idx'}-${i}`}>
                {columns.map((col, ci) => (
                  <td
                    key={`td-${col.key}-${ci}`}
                    style={{ textAlign: col.align || (typeof row[col.key] === 'number' ? 'right' : 'left') }}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  无匹配数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="data-table-pagination">
          <button className="page-btn" disabled={page === 0} onClick={() => setPage(0)}>首页</button>
          <button className="page-btn" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>上一页</button>
          <span className="page-info">
            第 {page + 1} / {totalPages} 页
          </span>
          <button className="page-btn" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>下一页</button>
          <button className="page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>末页</button>
        </div>
      )}

      {/* 调用方未传 guard 时，由本组件自己承载免责确认模态。
          显式传 guard 的页面由调用方渲染 modal，此处恒为 open=false（渲染 null）。 */}
      {modal}
    </div>
  );
}

export { DataTable, exportCSV };
