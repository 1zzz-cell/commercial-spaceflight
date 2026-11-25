/* ============================================================
   全局搜索 —— 页头按「/」呼出
   ------------------------------------------------------------
   它不是自动索引，而是「各页面主动注册」的模型：
   每个页面在挂载时调用 registerSearchData() 把自己的条目塞进 searchIndex，
   卸载/路由切换时因同 category 会先清旧再写入，所以不会越积越多。

   想让新页面可被搜到，在页面里加：
     useEffect(() => {
       registerSearchData('分类名', items.map((x) => ({
         id: x.id, title: x.name, keywords: '空格分隔的检索词', path: '/your-page',
       })));
     }, [items]);
   path 支持带 hash 的深链（如 '/investors#tab-companies'），点击会直接跳到对应页签。

   当前已注册：政策(Policy) / 火箭(RocketParams) / 星座(SatelliteConstellation) /
               企业与融资事件(Investors)。科研门户、指数页尚未注册。

   Phase 3A 补充：上述「页面挂载时主动注册」模型会导致冷启动直接按「/」
   打开搜索时索引为空（还没访问过任何注册页）。因此在模块顶层另存一份
   14 个路由的静态兜底索引，doSearch 时与动态索引合并后再截取前 8 条。
   ============================================================ */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';

/* 全局搜索索引 — 每个模块注册自己的可搜索数据（仅动态条目） */
const searchIndex = [];

/* 冷启动兜底索引：14 个路由的标题 + 别名关键词。
   刻意独立于 searchIndex —— registerSearchData / clearSearchIndex
   的同 category 清理逻辑永远不会碰它，保证任何时刻都有结果可搜。 */
const STATIC_ROUTE_INDEX = [
  { id: 'home', title: '首页', keywords: '首页 门户 产业全貌 商业航天 总览', path: '/' },
  { id: 'home-v1', title: '旧版首页 v1', keywords: '首页 旧版 v1 回滚 门户', path: '/home-v1' },
  { id: 'chain', title: '企业与产业链', keywords: '企业库 产业链 企业矩阵 生产基地 企业', path: '/chain' },
  { id: 'rockets', title: '运载火箭', keywords: '火箭型谱 火箭 运载火箭 发射记录 型谱', path: '/rockets' },
  { id: 'constellation', title: '卫星星座', keywords: '星座计划 卫星 星座 组网 部署', path: '/constellation' },
  { id: 'analysis', title: '投融资', keywords: '投融资 资金链 融资事件 轮次 赛道 资本', path: '/analysis' },
  { id: 'policy', title: '政策法规', keywords: '政策法规 政策 法规 国家 部委 地方', path: '/policy' },
  { id: 'market', title: '市场空间', keywords: '市场空间 市场规模 成本 预测 瓶颈 市场', path: '/market' },
  { id: 'index', title: '产业指标', keywords: '指数 商业航天指数 行情 指标', path: '/index' },
  { id: 'news', title: '行业资讯', keywords: '资讯 行业资讯 新闻 动态', path: '/news' },
  { id: 'reports', title: '研究报告', keywords: '研究报告 报告 研报 深度', path: '/reports' },
  { id: 'investors', title: '投资分析工具', keywords: '投资分析工具 投资人 决策辅助 赛道热度 企业画像', path: '/investors' },
  { id: 'research', title: '数据与溯源', keywords: '科研门户 数据与溯源 科研 数据字典 原始数据 溯源', path: '/research' },
  { id: 'compliance', title: '风险提示与数据口径', keywords: '合规 风险提示 数据来源 数据口径 口径 免责声明 平台说明', path: '/compliance' },
].map((item) => ({ ...item, category: '页面' }));

/**
 * 注册当前页面的可搜索条目
 * @param {string} category 分类名，会作为徽标显示；同名重复注册会覆盖旧数据
 * @param {Array<{id:string, title:string, keywords?:string, path:string}>} items
 */
export function registerSearchData(category, items) {
  // items: [{ id, title, keywords, path }]
  // 注册前先移除同 category 的旧条目，避免路由切换时重复注册
  for (let i = searchIndex.length - 1; i >= 0; i--) {
    if (searchIndex[i].category === category) {
      searchIndex.splice(i, 1);
    }
  }
  items.forEach((item) => {
    searchIndex.push({ ...item, category });
  });
}

/** 清空索引（页面卸载或需要全量重建时用） */
export function clearSearchIndex() {
  searchIndex.length = 0;
}

/**
 * 搜索组件本体：输入防抖 150ms，↑↓ 选择、Enter 跳转、Esc 关闭。
 * 结果最多展示 8 条，命中字段为 title + keywords 的子串匹配（未做分词）。
 */
function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  const doSearch = useCallback((q) => {
    if (!q.trim()) { setResults([]); return; }
    const lower = q.toLowerCase();
    // 静态兜底条目在前，动态注册条目在后，合并后再截 8 条（上限不变）
    const pool = STATIC_ROUTE_INDEX.concat(searchIndex);
    const matched = pool.filter((item) => {
      const text = `${item.title} ${item.keywords || ''}`.toLowerCase();
      return text.includes(lower);
    }).slice(0, 8);
    setResults(matched);
    setHighlightIndex(-1);
  }, []);

  useEffect(() => {
    if (query.length >= 1) {
      const timer = setTimeout(() => doSearch(query), 150);
      return () => clearTimeout(timer);
    } else {
      setResults([]);
    }
  }, [query, doSearch]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      const item = results[highlightIndex];
      navigate(item.path);
      setOpen(false);
      setQuery('');
      setResults([]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setResults([]);
    }
  };

  const goTo = (item) => {
    navigate(item.path);
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  return (
    <div className="global-search" ref={wrapperRef}>
      <div className="global-search-input-wrap">
        <Icon name="search" size="sm" className="global-search-icon" />
        <input
          className="global-search-input"
          type="text"
          placeholder="搜索企业、政策、星座..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query) setOpen(true); }}
          onKeyDown={handleKeyDown}
        />
        <kbd className="global-search-kbd">/</kbd>
      </div>
      {open && results.length > 0 && (
        <div className="global-search-dropdown">
          {results.map((item, i) => (
            <div
              key={`${item.category}-${item.id || i}`}
              className={`global-search-item ${i === highlightIndex ? 'highlighted' : ''}`}
              onClick={() => goTo(item)}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              <span className="search-item-category">{item.category}</span>
              <span className="search-item-title">{item.title}</span>
              {item.keywords && (
                <span className="search-item-keywords">{item.keywords}</span>
              )}
            </div>
          ))}
          <div className="global-search-footer">
            <span><kbd className="global-search-kbd-mini">↑</kbd><kbd className="global-search-kbd-mini">↓</kbd> 导航</span>
            <span><kbd className="global-search-kbd-mini">Enter</kbd> 跳转</span>
            <span><kbd className="global-search-kbd-mini">Esc</kbd> 关闭</span>
          </div>
        </div>
      )}
      {open && query.length >= 1 && results.length === 0 && (
        <div className="global-search-dropdown">
          <div className="global-search-empty">未找到相关结果</div>
        </div>
      )}
    </div>
  );
}

/**
 * 全局快捷键：按「/」聚焦搜索框。
 * 输入框/文本域/下拉框获得焦点时不拦截，避免打不出斜杠。
 * 已在 Header.jsx 中调用，新页面无需重复引入。
 */
function useGlobalSearchShortcut() {
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        const input = document.querySelector('.global-search-input');
        if (input) input.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);
}

export { GlobalSearch, useGlobalSearchShortcut };
