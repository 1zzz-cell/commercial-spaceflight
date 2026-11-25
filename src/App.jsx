import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import Layout from './components/Layout';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import './styles/global.css';
import './styles/home-b2b.css';
import './styles/framework.css';
/* Phase 3B 视觉收敛层：组件级 ds-tone-* 规则必须全站可用，故在 App 全局挂载一次；
   .ds-page 前缀规则只作用于 Phase 3C 挂载的页面，两者不冲突。 */
import './styles/visual-convergence.css';

/* 页面级代码分割：各页面（含 echarts 图表）按需加载，缩减首屏包体 */
const Home = lazy(() => import('./pages/Home'));
/* 门户首页改版 v2：Phase 3A 起升为默认首页（index） */
const HomeV2 = lazy(() => import('./pages/HomeV2'));
const Policy = lazy(() => import('./pages/Policy'));
const Analysis = lazy(() => import('./pages/Analysis'));
const IndustryChain = lazy(() => import('./pages/IndustryChain'));
const SatelliteConstellation = lazy(() => import('./pages/SatelliteConstellation'));
const RocketParams = lazy(() => import('./pages/RocketParams'));
/* 门户框架新增页面 */
const SpaceIndex = lazy(() => import('./pages/SpaceIndex'));
const News = lazy(() => import('./pages/News'));
const Reports = lazy(() => import('./pages/Reports'));
/* 角色服务：投资人 / 科研（均为数据基础设施 + 决策辅助双视角） */
const Research = lazy(() => import('./pages/Research'));
const Investors = lazy(() => import('./pages/Investors'));
/* 合规与数据来源：四 tab（风险提示 / 口径字典 / 免责全文 / 平台说明） */
const Compliance = lazy(() => import('./pages/Compliance'));
/* 市场与成本洞察（数据栏目） */
const Market = lazy(() => import('./modules/Market'));

/* 路由级懒加载兜底：与全局数据加载屏风格保持一致 */
function PageLoading() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      color: 'var(--text-secondary)',
      fontSize: '0.9rem',
      letterSpacing: '0.05em',
    }}>
      页面加载中…
    </div>
  );
}

/* 路由级错误边界需读取 pathname 作复位 key，故在 Router 内取 location。
   切页重新挂载，避免上一页异常状态残留到下一页。 */
function GuardedRoutes() {
  const location = useLocation();
  return (
    <GlobalErrorBoundary key={location.pathname}>
      <Suspense fallback={<PageLoading />}>
        <Routes>
            <Route path="/" element={<Layout />}>
              {/* Phase 3A：v2 升为默认首页 */}
              <Route index element={<HomeV2 />} />
              {/* 旧 /home-v2 深链重定向到 /，避免双首页；/home-v1 保留作为回滚路由 */}
              <Route path="home-v2" element={<Navigate to="/" replace />} />
              <Route path="home-v1" element={<Home />} />
              {/* 门户框架：指数 / 资讯 / 研究报告 */}
              <Route path="index" element={<SpaceIndex />} />
              <Route path="news" element={<News />} />
              <Route path="reports" element={<Reports />} />
              {/* 数据栏目：既有五链页面 + 市场空间 */}
              <Route path="analysis" element={<Analysis />} />
              <Route path="chain" element={<IndustryChain />} />
              <Route path="rockets" element={<RocketParams />} />
              <Route path="policy" element={<Policy />} />
              <Route path="constellation" element={<SatelliteConstellation />} />
              <Route path="market" element={<Market />} />
              {/* 角色服务：投资人（决策辅助）/ 科研（数据基础设施） */}
              <Route path="investors" element={<Investors />} />
              <Route path="research" element={<Research />} />
              {/* 全局合规入口：顶栏工具条、风险条与页脚均可一次点击直达 */}
              <Route path="compliance" element={<Compliance />} />
              <Route path="*" element={
                <section className="page-container ds-page">
                  <div className="page-header">
                    <h1 className="page-title">页面未找到</h1>
                    <p className="page-desc">请检查网址，或返回产业总览继续浏览。</p>
                    <Link to="/">返回产业总览</Link>
                  </div>
                </section>
              } />
            </Route>
        </Routes>
      </Suspense>
    </GlobalErrorBoundary>
  );
}

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <GuardedRoutes />
      </BrowserRouter>
    </DataProvider>
  );
}

export default App;
