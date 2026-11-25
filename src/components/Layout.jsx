import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { ScrollProgress, ScrollToTopButton, RouteScrollHandler } from './UIEnhancements';
import { useDisclaimerGuard, ExportGuardProvider } from './ComplianceKit';
/* 从无 echarts 依赖的注册表 import：避免入口 chunk 因守卫挂载而预加载 1MB echarts */
import { setExportGuard } from '../utils/exportGuard';

function Layout() {
  // 全站 ECharts toolbox 导出共用一个免责确认模态，避免逐层传递守卫。
  // requireConfirm 由 useCallback([]) 保证稳定，注册一次即可。
  const { requireConfirm, modal } = useDisclaimerGuard();
  useEffect(() => {
    setExportGuard(requireConfirm);
    return () => setExportGuard(null);
  }, [requireConfirm]);

  return (
    <>
      {/* 全局 skip link：放在 Layout 最前（即 <main> 之前、Header 之前），
          保证任意路由按 Tab 第一下就能命中。
          样式（fixed / 默认移出视口 / :focus 显现 / top:80px / z-index:1200）
          由 Phase 3B 的 visual-convergence.css 统一定义，不在各页面重复添加。 */}
      <a className="ds-skip" href="#main-content">跳转到主要内容</a>
      <ScrollProgress />
      <Header />
      <main className="layout-main" id="main-content" tabIndex={-1}>
        <ExportGuardProvider guard={{ requireConfirm, modal }}>
          <RouteScrollHandler>
            <Outlet />
          </RouteScrollHandler>
        </ExportGuardProvider>
      </main>
      <Footer />
      <ScrollToTopButton />
      {modal}
    </>
  );
}

export default Layout;
