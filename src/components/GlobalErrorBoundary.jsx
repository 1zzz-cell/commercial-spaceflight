import { Component } from 'react';
import { Link } from 'react-router-dom';

/* ============================================================
   全局路由级错误边界
   - 只包裹 <Routes> 区域；DataProvider 的数据加载错误由
     DataContext 的 ErrorScreen 处理，两者不重叠。
   - 由调用方用 key={pathname} 复位，切页即重新挂载，
     避免上一页的异常状态被带到下一页。
   - 样式全部内联并使用既有 CSS 变量，保持浅色企业基底，
     不新增 CSS 文件、不引入新色值。
   ============================================================ */
export default class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[GlobalErrorBoundary] 页面渲染异常：', error, info?.componentStack || '');
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main
        role="alert"
        aria-live="assertive"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          textAlign: 'center',
          fontFamily: 'var(--font-family)',
        }}
      >
        <div aria-hidden="true" style={{ fontSize: '2rem', lineHeight: 1 }}>!</div>
        <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 600 }}>页面暂时无法显示</h1>
        <p style={{ margin: 0, maxWidth: 420, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.8 }}>
          可能是数据或网络出现临时异常，请重试。若持续无法访问，可返回首页重新进入。
          本页错误不会清除已加载的数据。
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              minHeight: 44,
              padding: '10px 24px',
              borderRadius: 8,
              border: '1px solid var(--hv2-focus, #0a63b8)',
              background: 'var(--hv2-focus, #0a63b8)',
              color: '#fff',
              fontSize: '0.9rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            重试
          </button>
          <Link
            to="/"
            style={{
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 24px',
              borderRadius: 8,
              border: '1px solid var(--border-color, #d6deeb)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            返回首页
          </Link>
        </div>
      </main>
    );
  }
}
