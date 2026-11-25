/* ============================================
   模块开发沙箱外壳
   --------------------------------------------
   用 import.meta.glob 自动发现 src/modules/<Name>/index.jsx，
   新建模块会被自动收录，不需要改任何注册文件 —— 这是并行协作零冲突的关键。

   约定：每个模块目录必须有 index.jsx，且 export default 一个 React 组件。
   ============================================ */

import { useState, useEffect, useMemo, Suspense, lazy, Component } from 'react';
import { useData } from '../context/DataContext';

// Vite 编译期静态展开：键为相对路径，值为动态 import 函数
const moduleFiles = import.meta.glob('./*/index.jsx');

/** 把 './Research/index.jsx' 解析成 { id: 'Research' } */
const discovered = Object.keys(moduleFiles)
  .map((p) => {
    const m = p.match(/^\.\/([^/]+)\/index\.jsx$/);
    return m ? { id: m[1], path: p } : null;
  })
  .filter(Boolean)
  .sort((a, b) => a.id.localeCompare(b.id));

class ModuleErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[沙箱] 模块 ${this.props.name} 崩溃：`, error, info);
  }

  componentDidUpdate(prevProps) {
    // 切换模块时清掉上一个模块的错误态
    if (prevProps.name !== this.props.name && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={s.errorBox}>
          <div style={s.errorTitle}>模块运行出错</div>
          <pre style={s.errorPre}>{String(this.state.error?.stack || this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ModuleDevShell() {
  const data = useData();
  const [activeId, setActiveId] = useState(null);

  // 从 URL 读取初始模块；支持 ?module=Research
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('nocache') === '1') {
      try { localStorage.removeItem('csd_data_cache'); } catch { /* 忽略 */ }
    }
    const want = params.get('module');
    setActiveId(want && discovered.some((d) => d.id === want) ? want : discovered[0]?.id || null);
  }, []);

  // URL 与选中态双向同步，方便直接把链接甩给同伴复现问题
  useEffect(() => {
    if (!activeId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('module') !== activeId) {
      url.searchParams.set('module', activeId);
      window.history.replaceState({}, '', url);
    }
  }, [activeId]);

  const ActiveComponent = useMemo(() => {
    if (!activeId) return null;
    const found = discovered.find((d) => d.id === activeId);
    return found ? lazy(moduleFiles[found.path]) : null;
  }, [activeId]);

  return (
    <div style={s.page}>
      <aside style={s.sidebar}>
        <div style={s.brand}>
          <span style={s.brandTitle}>模块沙箱</span>
          <span style={s.brandSub}>沙箱页面不参与生产构建</span>
        </div>

        <nav style={s.nav}>
          {discovered.length === 0 ? (
            <p style={s.hint}>
              还没有任何模块。执行 <code style={s.code}>node scripts/create-module.mjs &lt;名称&gt;</code> 创建。
            </p>
          ) : (
            discovered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveId(m.id)}
                style={{ ...s.navBtn, ...(m.id === activeId ? s.navBtnActive : {}) }}
              >
                {m.id}
              </button>
            ))
          )}
        </nav>

        <div style={s.metaBox}>
          <div style={s.metaRow}>
            <span>数据更新</span>
            <strong>{data?.lastUpdated || '—'}</strong>
          </div>
          <a href="./" style={s.metaLink}>← 返回主站</a>
          <a
            href="?nocache=1"
            style={s.metaLink}
            onClick={() => { try { localStorage.removeItem('csd_data_cache'); } catch { /* 忽略 */ } }}
          >
            清空缓存重载
          </a>
        </div>
      </aside>

      <main style={s.main}>
        {ActiveComponent ? (
          <ModuleErrorBoundary name={activeId}>
            <Suspense fallback={<div style={s.loading}>模块加载中…</div>}>
              <ActiveComponent />
            </Suspense>
          </ModuleErrorBoundary>
        ) : (
          <div style={s.loading}>请在左侧选择一个模块</div>
        )}
      </main>
    </div>
  );
}

const s = {
  page: { display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' },
  sidebar: {
    width: 220, flexShrink: 0, background: 'var(--bg-card)',
    borderRight: '1px solid var(--border-color)',
    display: 'flex', flexDirection: 'column', padding: '16px 12px', gap: 16,
  },
  brand: { display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px' },
  brandTitle: { fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' },
  brandSub: { fontSize: '0.7rem', color: 'var(--text-muted)' },
  nav: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
  navBtn: {
    textAlign: 'left', padding: '8px 10px', fontSize: '0.85rem',
    background: 'transparent', border: '1px solid transparent', borderRadius: 'var(--border-radius-sm)',
    color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
  },
  navBtnActive: { background: 'var(--accent-blue-dim)', borderColor: 'var(--border-color-active)', color: 'var(--accent-blue)', fontWeight: 500 },
  hint: { fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 },
  code: { background: 'var(--bg-input)', padding: '1px 4px', borderRadius: 4, fontSize: '0.72rem', fontFamily: 'var(--font-mono)' },
  metaBox: { borderTop: '1px solid var(--border-color)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 },
  metaRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)' },
  metaLink: { fontSize: '0.75rem', color: 'var(--accent-blue)', textDecoration: 'none' },
  main: { flex: 1, overflowX: 'hidden', padding: '20px 24px' },
  loading: { padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' },
  errorBox: { padding: 24, background: 'var(--bg-card)', border: '1px solid var(--accent-orange)', borderRadius: 'var(--border-radius-md)' },
  errorTitle: { fontSize: '0.9rem', fontWeight: 600, color: 'var(--accent-orange)', marginBottom: 12 },
  errorPre: {
    margin: 0, padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--border-radius-sm)',
    fontSize: '0.72rem', lineHeight: 1.7, overflowX: 'auto',
    fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap',
  },
};
