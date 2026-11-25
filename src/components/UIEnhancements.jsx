import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Icon from './Icon';

/* ============================================
   路由元信息单一真源（基础 SEO）
   ------------------------------------------------------------
   SPA 只有一份 index.html，静态 meta 无法区分路由。这里按 pathname
   映射 title / description，由 RouteScrollHandler 在切页时同步到
   document.title 与 <meta name="description">。新增路由只需在此登记，
   避免散落到各页面的 useEffect 里各自为政。
   ============================================ */
import { BASE_TITLE, ROUTE_META } from './routeMeta';

function syncRouteMeta(pathname) {
  const path = pathname.replace(/\/$/, '') || '/';
  const meta = ROUTE_META[path] || { title: `页面未找到 · ${BASE_TITLE}`, description: ROUTE_META['/'].description };
  document.title = meta.title;
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.content = meta.title;
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = new URL(path, canonical.href).href;
  if (typeof meta.description === 'string') {
    const tag = document.querySelector('meta[name="description"]');
    if (tag) tag.setAttribute('content', meta.description);
    const og = document.querySelector('meta[property="og:description"]');
    if (og) og.setAttribute('content', meta.description);
  }
}

/* ============================================
   滚动进度条 - 顶部进度指示
   ============================================ */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const percent = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      setProgress(percent);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="scroll-progress-bar" style={{ width: `${progress}%` }} />
  );
}

/* ============================================
   回到顶部按钮
   ============================================ */
export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      className={`scroll-to-top ${visible ? 'visible' : ''}`}
      onClick={scrollToTop}
      aria-label="回到顶部"
    >
      <Icon name="arrow-up" size="md" strokeWidth={2.2} />
    </button>
  );
}

/* ============================================
   路由切换时自动回到顶部 + hash 锚点定位 + 页面淡入动画
   ------------------------------------------------------------
   hash 是元素 id 时按 88px 偏移平滑定位；
   hash 只是页签深链前缀（刻意不是元素 id）时：
     - 跨 pathname 进入 → 回到新页顶部，避免停在上个页面的滚动位置；
     - 同 pathname 内切 tab → 保持当前阅读位置。
   ============================================ */
export function RouteScrollHandler({ children }) {
  const location = useLocation();
  const prevPathnameRef = useRef(location.pathname);
  const prevHashRef = useRef(location.hash);

  useEffect(() => {
    // 路由元信息（title / description）在切页时同步，SPA 各路由共享一份 index.html
    syncRouteMeta(location.pathname);

    const pathnameChanged = prevPathnameRef.current !== location.pathname;
    const hadHash = Boolean(prevHashRef.current);
    prevPathnameRef.current = location.pathname;
    prevHashRef.current = location.hash;

    // 带 hash 的站内链接（如 /reports#report-01）：滚动到对应板块；
    // 懒加载页面分块就绪有延迟，用短重试等元素出现，避免定位失败
    if (location.hash) {
      const id = location.hash.slice(1);
      let tries = 0;
      let timer = null;
      let cancelled = false;
      // 用 offsetTop 累加而非 getBoundingClientRect：后者会把 .page-fade-in
      // 的 translateY(8px) 首帧动画位移读进去，导致 88px 定位稳定偏 8px（停在 80px）。
      // offsetTop 是布局坐标，不受 transform 影响，也不必等动画稳态。
      const absoluteTop = (el) => {
        let top = 0;
        let node = el;
        while (node) { top += node.offsetTop; node = node.offsetParent; }
        return top;
      };
      const tryScroll = () => {
        if (cancelled) return;
        const el = document.getElementById(id);
        if (el) {
          // 固定顶栏 72px + 16px 呼吸 = 88px 偏移；scrollIntoView 无偏移会被顶栏遮挡。
          const top = absoluteTop(el) - 88;
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
          return;
        }
        tries += 1;
        if (tries < 12) { timer = setTimeout(tryScroll, 60); return; }
        // 12 次重试仍找不到元素（如 /compliance#tab-*、/investors#tab-* 这类
        // 刻意不用元素 id 的页签深链）：跨页进入则回顶，同 pathname 内切 tab
        // 则保持当前阅读位置，不报错、不跳顶。
        if (pathnameChanged) window.scrollTo({ top: 0, behavior: 'instant' });
      };
      tryScroll();
      // 快速连续切页 / 切 tab 时清理上一轮重试链，避免旧链误定位或误回顶。
      return () => { cancelled = true; if (timer) clearTimeout(timer); };
    }
    // 同 pathname 内清除 hash（页内切 tab）应保持阅读位置；
    // 跨页导航或冷启动无 hash 才回顶。
    if (pathnameChanged || !hadHash) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname, location.hash]);

  return (
    <div key={location.pathname} className="page-fade-in">
      {children}
    </div>
  );
}

