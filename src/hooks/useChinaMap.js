/* ============================================
   中国地图 GeoJSON 单例加载
   - 全局只 fetch /geo/china.json 一次
   - 注册为 echarts 'china' 地图
   - 组件通过 useChinaMap() 获取 ready 状态
   ============================================ */
import { useState, useEffect } from 'react';
import * as echarts from 'echarts';

const GEO_URL = '/geo/china.json';
const MAP_NAME = 'china';

let mapPromise = null;

function loadChinaMap() {
  if (!mapPromise) {
    mapPromise = fetch(GEO_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`地图底图加载失败: ${res.status}`);
        return res.json();
      })
      .then((geoJson) => {
        if (!echarts.getMap(MAP_NAME)) {
          echarts.registerMap(MAP_NAME, geoJson);
        }
        return true;
      })
      .catch((err) => {
        // 允许其他组件重试
        mapPromise = null;
        throw err;
      });
  }
  return mapPromise;
}

/* 空闲预加载：在首页等不含地图的页面浏览器空闲时提前拉取底图，
   切换到地图页时可零等待渲染（单例 promise 保证只请求一次） */
export function preloadChinaMap() {
  if (typeof window === 'undefined') return;
  const start = () => loadChinaMap().catch(() => {
    /* 静默失败，组件挂载时 useChinaMap 会再次尝试 */
  });
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(start, { timeout: 3000 });
  } else {
    setTimeout(start, 1200);
  }
}

export function useChinaMap() {
  const [ready, setReady] = useState(() => Boolean(echarts.getMap(MAP_NAME)));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (ready) return undefined;
    let alive = true;
    loadChinaMap()
      .then(() => { if (alive) setReady(true); })
      .catch((err) => { if (alive) setError(err.message); });
    return () => { alive = false; };
  }, [ready]);

  return { ready, error, mapName: MAP_NAME };
}
