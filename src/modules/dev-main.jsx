/* ============================================
   模块开发沙箱入口
   --------------------------------------------
   为什么需要它：主站启动要过 DataProvider 的全屏加载动画、
   挂载 Header/Footer、监听滚动，改一行要点好几下才能看到效果。
   而且两人同时开发时，谁先起了主站另一个人就得等。

   这个壳只做三件事：加载数据 → 挂载你选的模块 → 报错就显示出来。

   用法（npm run dev 之后）：
     http://localhost:5173/module-dev.html?module=Research
   参数：
     module=<目录名>   指定要挂载的模块，留空则显示模块列表
     nocache=1         强制清空数据缓存，读取最新 public/data/*.json

   ★ 本文件不参与生产构建（未在 vite.config 的 rollupOptions.input 中声明），
     模块交付时由主仓负责人用 App.jsx 的一条 Route 挂载。
   ============================================ */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DataProvider } from '../context/DataContext';
import ModuleDevShell from './dev-shell';
import '../styles/global.css';
import './_shared/sdk.css';

const root = createRoot(document.getElementById('root'));

root.render(
  <StrictMode>
    <DataProvider>
      <ModuleDevShell />
    </DataProvider>
  </StrictMode>
);
