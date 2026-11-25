# 模块开发契约

> 并行开发的唯一约定。照它做，两个人可以同时写代码而互不干扰。

---

## ⚠ 先看这里：本文档的现状（2026-10-24）

本文档最初是为「两人并行开发」设计的，现在项目改为**单人开发**，
因此下面关于「文件所有权 / 避免冲突」的部分**不再是硬性约束**，
真正仍然有效的只有「接口层怎么用」那部分（§四起的取数、图表、导出纪律）。

**当前实际的页面组织方式（与本文档描述的不完全一致）**：

| 路径 | 性质 |
| --- | --- |
| `src/pages/*.jsx` | **正式页面**，现在所有正式页面都在这里，由 `App.jsx` 懒加载注册 |
| `src/modules/Market/` | **正式模块**，是 `/market` 页，用 `@portal` 写成 |
| `src/modules/Research/` | **⚠ 脚手架占位示例**，不是正式页。正式科研门户是 `src/pages/Research.jsx`（800+ 行）。保留它仅作为 `create-module.mjs` 的产出样例，**改科研门户请去 `src/pages/Research.jsx`** |

单人开发时，`npm run dev:module` 沙箱、模块骨架生成这套流程一般用不到，
直接改 `src/pages/` 下的页面即可。以下正文保留，供将来需要并行开发时参考。

---

## 一、文件所有权

| 路径 | 谁能改 | 说明 |
| --- | --- | --- |
| `src/modules/<你的模块>/**` | **只有你** | 你的全部工作都在这个目录里 |
| `public/data/*.json` | **谁都不改** | 由每日 AI 更新 + `validate:data` 把关，手写的会被拒绝入库 |
| `src/modules/_shared/**` | 主仓负责人 | 共用 SDK，改动需 review（被所有模块依赖） |
| `src/utils/chartTools.js` | 主仓负责人 | 老页面图表工具箱 |
| `src/App.jsx`、`src/components/Header.jsx` | 主仓负责人 | **唯一的合并点** |
| `src/styles/global.css` | 主仓负责人 | 5000+ 行，两人同时改必冲突 |

**一句话**：你的改动 99% 落在 `src/modules/<你的模块>/` 里。

## 二、起手三步

```bash
# 1. 生成模块骨架
node scripts/create-module.mjs Research --title "科研门户" --owner "你的名字"

# 2. 启动沙箱（不加载主站的 Header/Footer/首屏动画，改完秒级热更新）
npm run dev:module

# 3. 浏览器打开 http://localhost:5173/module-dev.html?module=Research
#    左侧列表自动出现新模块，无需手动注册
```

沙箱参数：`?module=Research` 切换模块，`?nocache=1` 清空 24 小时数据缓存。

## 三、数据契约

**取数一律走 `@portal` 的 selector，禁止直接深层访问 `data.xxx.yyy`。**
好处：主仓调整 `dataLoader` 返回结构时只改 `_shared/datasets.js` 一处，你的代码零感知。

```jsx
import { useData } from '../../context/DataContext';
import { selectDataset, selectDatasetMeta, flattenDataset } from '@portal';

const data = useData();
const industry = selectDataset(data, 'industry');      // 数据集
const meta = selectDatasetMeta(data, 'industry');      // 来源与 schema
const rows = flattenDataset(data, 'policy');           // 摊平成「一行一条」
```

### 数据集清单（字段已核对真实数据）

| key | 内容 | 条数 | 主要字段 |
| --- | --- | --- | --- |
| `rockets` | 火箭型号参数 | 47 | `name` `abbr` `org` `propellant` `diameter` `leo` `gto` `reusable` `site` `launches` `firstFlight` `status` `successRate` `costPerKg` `verified` |
| `constellations` | 卫星星座 | 39 | `name` `company` `type` `planned` `actual` `orbit` `frequency` `satWeight` `firstLaunch` `status` `verified` |
| `industry` | 融资事件 | 20 | `date` `company` `round` `amount` `segment` `investors` `region` |
| `chain` | 产业链企业 | — | 摊平后 `stage` `category` `name` `focus` `region` |
| `policy` | 政策法规 | 25 | `id` `title` `date` `org` `summary` `type` `source`；摊平后多 `_level` |
| `dashboard` | 首页指标 | — | `dashboardMetrics` `milestones` `newsTicker` `regionMapData` |
| `geo` | 区域分布 | — | `launchSites2025` `enterpriseByProvince` `longMarchFamily2025` |

### 五个坑（都已核对源码，照做就行）

1. **`policy` 在源数据里是 `{ national, ministerial, local }` 三层对象**，不是数组。必须走 `flattenDataset`。
2. **`chain.enterpriseMatrix.data` 是三层嵌套**（stage → category → companies[]），也必须走 `flattenDataset`。
3. **`financingEvents.investors` 是顿号分隔的字符串**，不是数组。用 `aggregateFundingByCompany()` 已自动拆好。
4. **`financingEvents.amount` 是文本**（`"超5亿"` `"5000万"`），不能直接排序。用 `parseFunding()` 转成数值。
5. **`rockets.successRate` 只有 38/47 条有值、`costPerKg` 只有 1 条有值**。渲染前必须判空，否则图表会出现断裂的空系列。

## 四、`@portal` API

```jsx
import {
  // 组件
  Card, SectionTitle, StatCard, Delta, SourceTag, ExportBar, EmptyState, Grid, Icon, DataTable,
  // 图表
  useChart, buildToolbox, exportChartSVG,
  // 取数
  selectDataset, selectDatasetMeta, flattenDataset, allFlatRecords,
  aggregateFundingByCompany, DATASETS,
  // 导出（全站唯一实现，不要再写第二份）
  exportCSV, exportJSON, exportBibTeX, exportText,
  // 格式化
  formatAmount, parseFunding, formatPercent, formatNumber, formatDate, formatDelta, trendOf, credibilityOf,
  // 设计令牌（图表 option 用；写样式请直接用 CSS 变量）
  color, palette, trendColor, chartBase, font, radius,
} from '@portal';
```

要点：

- **图表**用 `useChart(() => option, [deps])`，返回 `{ ref, getInstance }`。它已处理 init / 依赖更新 / 容器自适应 / 卸载销毁，不要再手写 `echarts.init` 和 `window.addEventListener('resize')`。
- **导出**不用自己实现 `download` 逻辑，`ExportBar` 组件一次给全 CSV / JSON / BibTeX，CSV 自动带来源与统计口径的 `#` 注释行（`pandas.read_csv(comment='#')` 可直接识别）。
- **颜色**写样式一律用 `var(--xxx)` CSS 变量；只有 ECharts 的 option 是 JS 对象读不到变量，才从 `@portal` 取 `color`。
- **涨跌配色**是涨红跌绿（中国市场），已封装在 `Delta` 和 `trendOf` 里，别自己写反。

## 五、交付流程（合并只有一处）

你的模块完成后：

```
src/modules/Research/          ← 你自己交付的全部内容
```

**主站挂路由**由主仓负责人做，你只需提一句：

```jsx
// src/App.jsx —— 唯一的合并点
const ResearchPortal = lazy(() => import('./modules/Research'));
<Route path="research" element={<ResearchPortal />} />
```

同时在 `src/components/Header.jsx` 的 `navItems` 加一项。

> 这就是为什么现在是零冲突的：**你全程不碰这两个文件**。

## 六、自检清单（提交前过一遍）

- [ ] 没有修改 `src/modules/<你的模块>/` 之外的任何文件
- [ ] 取数走 `selectDataset`，没有写死 `data.industry.financingEvents` 这类深层路径
- [ ] 导出只用了 `@portal` 的 `exportCSV` 等，没有自己写下载逻辑
- [ ] 图表没有手写 `echarts.init`，用的是 `useChart`
- [ ] 样式类名带了自己的模块前缀，没有写死色值
- [ ] 涉及金额的涨跌是红涨绿跌
- [ ] `npm run validate:data` 通过（如果动过数据）
- [ ] `npm run build` 通过
