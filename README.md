# 中国商业航天产业分析平台

> 面向投资人、科研人员与产业从业者的商业航天数据门户。
> 以「资金链、产业链、火箭链、政策链、卫星链」五大维度组织数据，并在其上叠加门户层与角色视角。

本文档面向**接手本项目的同学**，目标是让你在不追问任何人的前提下把项目跑起来、看懂结构、改得动代码。
读完大约需要 20 分钟。

## 目录

- [1. 五分钟跑起来](#1-五分钟跑起来)
- [2. 技术栈与环境要求](#2-技术栈与环境要求)
- [3. 目录结构：每一层是干什么的](#3-目录结构每一层是干什么的)
- [4. 路由与页面一览](#4-路由与页面一览)
- [5. 数据：8 个 JSON 文件](#5-数据8-个-json-文件)
- [6. 架构三条纪律与 @portal 接口层](#6-架构三条纪律与-portal-接口层)
- [7. 我想新增/修改一个页面，怎么走](#7-我想新增修改一个页面怎么走)
- [8. 全局搜索怎么接入](#8-全局搜索怎么接入)
- [9. 关键配置与参数](#9-关键配置与参数)
- [10. npm scripts 全表](#10-npm-scripts-全表)
- [11. 数据治理：更新管线与校验门禁](#11-数据治理更新管线与校验门禁)
- [12. 后端服务（可选）](#12-后端服务可选)
- [13. 部署](#13-部署)
- [14. 常见坑与排查](#14-常见坑与排查)
- [15. 信息来源核查记录](#15-信息来源核查记录)

---

## 1. 五分钟跑起来

```bash
# 1. 安装依赖（Node 18+）
npm install

# 2. 启动开发服务器，默认 http://localhost:5173
npm run dev

# 3. 另开一个终端，校验数据是否完整（应当输出全部通过）
npm run validate:data

# 4. 看看各数据文件的新旧程度（新增命令，见 §11.3）
npm run data:status
```

前端**不依赖后端**即可完整运行——所有数据都是 `public/data/*.json`，
运行时由浏览器 `fetch` 加载。后端只在你需要给外部系统提供 HTTP 接口时才启动。

想快速确认环境没问题，打开首页后依次点一遍：
`/`（首页）→ `/investors`（投资人门户）→ `/research`（科研数据门户）。
这三页覆盖了图表、表格、导出、路由深链四条主要链路。

---

## 2. 技术栈与环境要求

| 项 | 版本 / 说明 |
| --- | --- |
| Node.js | **18 或更高**（构建用的是 Vite 8，低于 18 会报语法错误） |
| React | 19 |
| Vite | 8（构建工具，`vite.config.js` 已配好别名与分包） |
| ECharts | 5（数据可视化，已单独分包，见 §9） |
| React Router | 7（`BrowserRouter`，注意部署时的路由回退要求，见 §13） |
| Flask | 可选后端，仅用于提供 `/api/*` 接口与静态托管 |

没有全局安装要求，`npm install` 之后一切都在 `node_modules` 里。

---

## 3. 目录结构：每一层是干什么的

```
Commercial Spaceflight/
├── public/data/*.json      ← 唯一数据源。谁都不手改，见 §11
├── src/
│   ├── main.jsx            入口：挂载 React，引入全局样式
│   ├── App.jsx             路由表：所有页面在这里注册（懒加载）
│   ├── context/
│   │   └── DataContext.jsx 全局数据：加载完成前渲染全屏加载/错误屏
│   ├── utils/
│   │   ├── dataLoader.js   fetch 8 个 JSON + localStorage 缓存 + 派生统计
│   │   ├── chartTools.js   老页面的 ECharts 工具箱（矢量导出 / 数据缩放）
│   │   └── ticker.js       首页快讯「来源：正文」解析
│   ├── hooks/
│   │   └── useChinaMap.js  中国地图 geojson 预取与缓存
│   ├── components/         全站共用组件（Header / Footer / DataTable / Icon …）
│   ├── pages/              ★ 正式页面：五链数据页 + 门户页 + 角色门户
│   ├── modules/
│   │   ├── _shared/        ★ @portal 接口层（见 §6），全站共用 SDK
│   │   ├── Market/         正式模块：/market 市场与成本洞察
│   │   ├── Research/       ⚠ 脚手架占位示例，不是正式页！见下方说明
│   │   ├── dev-*.jsx       独立开发沙箱（单人开发时一般用不到）
│   │   └── CONTRACT.md     接口层与所有权约定
│   └── styles/
│       ├── global.css      5000+ 行全局样式与 CSS 变量（谨慎修改）
│       ├── home-b2b.css    首页专用
│       ├── framework.css   门户框架（导航下拉、指数/资讯/报告页、角色入口卡）
│       ├── investor.css    投资人门户专用（iv- 前缀）
│       └── research.css    科研门户专用（rs- 前缀）
├── scripts/                数据管线与工具脚本，见 §10
├── backend/app.py          可选 Flask 后端
└── dist/                   构建产物（npm run build 生成）
```

### ⚠ `pages/` 与 `modules/` 的关系（最容易搞混的地方）

历史上这个项目曾按"两人并行开发"设计过一套模块机制，后来改为单人开发，
于是留下了**两套并存的页面组织方式**：

| 目录 | 性质 | 说明 |
| --- | --- | --- |
| `src/pages/*.jsx` | **正式页面** | 现在所有正式页面都在这里，走 `App.jsx` 路由注册 |
| `src/modules/Market/` | **正式模块** | `/market` 页，用 `@portal` 写成，被 App.jsx 懒加载引用 |
| `src/modules/Research/` | **脚手架占位** | 79 行，文件头写着"负责人：待指定"。**它不是正式页**，正式科研门户是 `src/pages/Research.jsx`（800+ 行）。保留它是因为它是 `create-module.mjs` 的产出样例 |

**结论：改页面去 `src/pages/`，不要动 `src/modules/Research/`。**

---

## 4. 路由与页面一览

实际共 **12 条路由**，全部在 `src/App.jsx` 中以 `lazy()` 懒加载注册。

| 路由 | 页面文件 | 一句话职责 |
| --- | --- | --- |
| `/` | `pages/Home.jsx` | 门户首页：核心指标、实时动态、五链矩阵、市场规模、里程碑 |
| `/index` | `pages/SpaceIndex.jsx` | 商业航天指数：分项并列 + 口径说明（刻意不做加权综合指数） |
| `/news` | `pages/News.jsx` | 行业资讯：平台快讯 + 发展里程碑 |
| `/reports` | `pages/Reports.jsx` | 研究报告聚合（5 份），支持 `#report-01` 锚点直达 |
| `/chain` | `pages/IndustryChain.jsx` | **产业链**：上中下游价值链、企业矩阵、生产基地 |
| `/rockets` | `pages/RocketParams.jsx` | **火箭链**：型号参数对比、推进剂分布、机构发射量 |
| `/constellation` | `pages/SatelliteConstellation.jsx` | **卫星链**：全球星座部署计划与进展（注意单数） |
| `/analysis` | `pages/Analysis.jsx` | **资金链**：市场规模、发射次数、融资时序、区域分布 |
| `/policy` | `pages/Policy.jsx` | **政策链**：国家级 / 部委级 / 地方级三级政策 |
| `/market` | `modules/Market/index.jsx` | 市场与成本洞察：规模、成本、预测、瓶颈 |
| `/investors` | `pages/Investors.jsx` | **投资人门户**：赛道热度 / 企业画像 / 催化剂日历 / 事件流水 |
| `/research` | `pages/Research.jsx` | **科研数据门户**：数据字典 / 原始浏览 / 导出 / 溯源 / 更新日志 |

**页签深链**（目前仅投资人门户实现）：`/investors#tab-heat` / `#tab-companies` /
`#tab-catalysts` / `#tab-stream`，页签状态写在 URL hash 上，可分享、可前进后退。
科研门户的五个页签（`dict` / `browser` / `export` / `provenance` / `changelog`）目前仍是组件内 `useState`，
如需同样可分享，照 `Investors.jsx` 的 `useLocation` + `navigate(hash, { replace: true })` 改一遍即可。

---

## 5. 数据：8 个 JSON 文件

前端运行时由 `src/utils/dataLoader.js` 一次性并发加载下列 8 个文件。
**它们的加载顺序即 `loadAllData()` 里的解构顺序，改动时不要调换。**

| 文件 | 主要条目数 | 关键内容 | 注意事项 |
| --- | --- | --- | --- |
| `rockets.json` | 47 型 | 火箭运力、推进剂、首发、可复用、成功率 | `successRate` 仅 38/47 有值；`costPerKg` 几乎全空 |
| `constellations.json` | 39 个 | 星座规划/在轨规模、轨道、频段、运营方 | `planned` 规划总数，`actual` 已部署数 |
| `industry.json` | 20 起 | 融资事件明细；另有市场规模/发射/融资时序 | `amount` 是「超5亿」类文本；`investors` 是顿号分隔字符串 |
| `chain.json` | 26 家 | 产业链企业矩阵、生产基地、案例 | **三层嵌套**：`enterpriseMatrix.data → stage → category → companies[]` |
| `policy.json` | 25 条 | 三级政策 | **三层对象**：`policyData.{national, ministerial, local}` |
| `dashboard.json` | — | 首页指标、里程碑、快讯、区域地图数据 | — |
| `geoData.json` | — | 发射工位、企业省份分布 | — |
| `market.json` | 175 项 | 市场规模与成本指标、时序、洞察、瓶颈 | 独立管线维护，见 §11.4 |

**两个必须记住的结构陷阱**（直接遍历会白屏）：

```js
// ✗ 错误：policy 不是数组
pol.policyData.map(...)

// ✓ 正确：走 @portal 的 flattenDataset
import { flattenDataset } from '@portal';
const policies = flattenDataset(data, 'policy');       // 摊平后每行带 _level 字段
const companies = flattenDataset(data, 'chain');        // 摊平后每行带 stage / category
```

---

## 6. 架构三条纪律与 @portal 接口层

### 6.1 为什么要有 @portal

`vite.config.js` 里配了别名：

```js
'@portal': './src/modules/_shared'
```

`_shared` 是全站唯一的"接口层"——共用组件、格式化、导出、图表 hook、数据契约都从这里出。
**页面代码里不要直接 import 主仓内部实现**（例如 `../../../utils/chartTools`），
因为主仓重命名/移动文件时会一次性打断所有页面，而走 `@portal` 只需改一处映射。

### 6.2 三条纪律（写任何页面都请遵守）

| 纪律 | 要求 | 为什么 |
| --- | --- | --- |
| **取数走 selector** | 用 `selectDataset(data, 'rockets')` / `flattenDataset(data, 'policy')`，不要写 `data.rockets.list` | 屏蔽 `dataLoader` 返回结构的变化 |
| **图表走 useChart** | 用 `useChart(buildOption, deps)`，不要自己 `echarts.init` | 统一处理 ResizeObserver 与 dispose，杜绝内存泄漏 |
| **导出走 exporters** | 用 `exportCSV` / `exportJSON` / `exportBibTeX`，不要自己拼 Blob 下载 | 全站导出的口径（含来源与口径 meta 行）必须一致 |

### 6.3 @portal 能给我什么

```js
import {
  // —— 数据契约 ——
  DATASETS,                    // 8 个数据集的元信息（字段、条数、注意事项）
  selectDataset,               // (data, key) => 数据集对象；永远不抛错
  selectDatasetMeta,           // (data, key) => { lastUpdated, source, schema }
  flattenDataset,              // (data, key) => 摊平后的明细数组（一行一条）
  allFlatRecords,              // (data) => 五链全量明细（科研门户「一次导出全部」用）
  aggregateFundingByCompany,   // (data) => 融资事件按企业聚合的画像数组

  // —— 格式化 ——
  formatAmount, parseFunding,  // parseFunding 把「超5亿」转成 5e8；无单位返回 null
  formatPercent, formatNumber, formatDate, formatDelta, trendOf, credibilityOf,

  // —— 导出 ——
  exportCSV, exportJSON, exportBibTeX, exportText,
  buildToolbox, exportChartSVG,   // 图表的矢量导出工具箱

  // —— 图表 ——
  useChart,

  // —— UI 组件 ——
  Card, SectionTitle, StatCard, Delta, SourceTag, ExportBar, EmptyState, Grid, Icon,
  DataTable,                   // 带排序/筛选/分页/导出的表格
} from '@portal';
```

`Delta` 封装的是**涨红跌绿**（中国市场习惯），不要在别处写反。

### 6.4 数据契约一览（`_shared/datasets.js`）

`DATASETS` 是每个数据集的权威定义：有哪些字段、多少条、有什么坑。
加字段、改口径请同步更新这里——科研门户的「数据字典」页直接读它。

---

## 7. 我想新增/修改一个页面，怎么走

**改现有页面**（最常见）：直接改 `src/pages/<Page>.jsx`，
样式写进对应的私有 CSS（如 `investor.css`），**不要往 `global.css` 里堆**。

**新增页面**：

1. 在 `src/pages/` 新建 `MyPage.jsx`，参照 `Investors.jsx` 的写法（文件头注释 + 派生函数 + 子组件 + 主组件）
2. 新建 `src/styles/my-page.css`，类名加前缀（如 `mp-`），颜色一律用 CSS 变量
3. 在 `src/App.jsx` 顶部加 `const MyPage = lazy(() => import('./pages/MyPage'));`，再加一条 `<Route>`
4. 若需出现在导航：改 `src/components/Header.jsx` 的 `dataColumns` / `personaPortals` / `flatLinks`
5. 若需出现在页脚：改 `src/components/Footer.jsx`

**页面骨架约定**（照抄现有页面即可）：

```jsx
<div className="page-container">
  <section className="page-header">
    <h1 className="page-title">…</h1>
    <p className="page-desc">…</p>
    <span className="data-source-badge">数据更新于 {data.lastUpdated}</span>
  </section>
  {/* 主体 */}
</div>
```

---

## 8. 全局搜索怎么接入

页头按 `/` 呼出全局搜索。它不是一个自动索引，而是**各页面主动注册**：

```js
import { registerSearchData } from '../components/GlobalSearch';

// items: [{ id, title, keywords, path }]，path 支持带 hash 的深链
useEffect(() => {
  registerSearchData('企业', companies.map((c) => ({
    id: c.name,
    title: c.name,
    keywords: `${c.segments.join(' ')} ${c.investors.join(' ')}`,
    path: '/investors#tab-companies',
  })));
}, [companies]);
```

- 同一 `category` 重复注册会先清旧的再写入，所以路由切换不会越积越多
- 目前注册了：政策（`Policy.jsx`）、火箭（`RocketParams.jsx`）、星座（`SatelliteConstellation.jsx`）、
  企业与融资事件（`Investors.jsx`）
- 想让新页面可被搜到，照上面写一遍即可。科研门户、指数页等尚未注册，需要时同样照抄

---

## 9. 关键配置与参数

### 9.1 `src/utils/dataLoader.js`

| 参数 | 值 | 说明 |
| --- | --- | --- |
| `CACHE_VERSION` | `'v4'` | **⚠ 最重要的一项**。改了任何 JSON 的字段结构就必须 +1，否则用户浏览器里存着旧缓存，会看到"新代码读旧数据"的诡异结果 |
| `CACHE_TTL` | 24 小时 | 缓存过期时间；开发时想强制拉新数据，在 URL 后加 `?nocache=1` |
| 缓存 key | `csd_data_cache` | localStorage |

### 9.2 `vite.config.js`

| 配置 | 值 | 说明 |
| --- | --- | --- |
| `base` | `'./'` | 用相对路径，方便直接双击 `dist/index.html` 或放任意子目录 |
| `resolve.alias['@portal']` | `src/modules/_shared` | 见 §6.1 |
| `chunkSizeWarningLimit` | `1100` | ECharts 单块 gzip 约 336KB，属已知情况 |
| `manualChunks` | 函数形式 | 把 `echarts` / `zrender` 与 `react` 运行时分别独立成块，利于长期缓存 |

### 9.3 `src/modules/_shared/tokens.js`

ECharts 的 option 是 JS 对象，**读不到 CSS 变量**，所以图表配色从这里取 `color` / `chartBase` / `palette`。
新增颜色必须先在 `global.css` 的 `:root` 定义变量，再同步到这里。

### 9.4 数据治理门禁参数（`scripts/data-rules.mjs`）

| 规则 | 阈值 | 行为 |
| --- | --- | --- |
| 变更上限 | 单文件单次最多 **10** 条 | 超出整份拒绝（防大面积幻觉改写） |
| 来源强制 | 新增条目必须含 `source` | 否则丢弃该条目 |
| 来源链接 | 有 `source` 无 `sourceUrl` | 自动标记 `verified: false` |
| 受保护字段 | 见文件内白名单 | 不符即强制回退 |

---

## 10. npm scripts 全表

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器（默认 5173） |
| `npm run dev:module` | 模块独立沙箱，只挂载 `src/modules/` 下的模块，用于模块开发 |
| `npm run build` | 生产构建 → `dist/` |
| `npm run preview` | 本地预览构建产物 |
| `npm run validate:data` | 数据校验门禁（只读，不通过退出码 1） |
| `npm run data:status` | **新增**：列出 8 个数据文件的更新时间、条目数与陈旧告警 |

其他脚本（不常跑，直接 `node scripts/xxx.mjs`）：

| 脚本 | 作用 |
| --- | --- |
| `scripts/data-status.mjs` | 数据新鲜度体检（§11.3） |
| `scripts/update-data.mjs` | 每日 AI 更新管线（需 `AI_API_KEY`，GitHub Actions 调用） |
| `scripts/collect-market.mjs` | market.json 专项采集管线，支持 `--dry-run`（§11.4） |
| `scripts/validate-data.mjs` | 校验门禁，`--fix` 可自动修复受保护字段/统计块/黑名单 |
| `scripts/create-module.mjs` | 生成 `src/modules/<名称>/` 骨架 |
| `scripts/templates/*.csv` | 数据采集模板，双击用 Excel 填写（带 BOM 不乱码） |

---

## 11. 数据治理：更新管线与校验门禁

### 11.1 每日 AI 更新

`scripts/update-data.mjs` 由 GitHub Actions 每日触发，输出不直接入库，
必须先通过 `data-rules.mjs` 固化的核查规则（2026-09-26 人工审核后固化），未通过则整份文件保留原数据：

1. **来源强制**：新增条目（火箭/星座/政策/融资事件）必须含 `source`，否则直接丢弃；
   有 `source` 无 `sourceUrl` 的自动标记 `verified: false`，前端显示「待核实」；
   修改既有条目未提供来源的一律回退。
2. **受保护字段**：经权威渠道核实的关键数值禁止 AI 改动
   （CZ-5 LEO 25t/GTO 14t、TL-2 LEO 2t、CZ-8A 一次性构型、CZ-6 液氧+煤油、
   StarLink 规划 41930 颗、OneWeb 648 颗、Amazon Leo 首发 2023 等），不符即强制回退。
3. **内容黑名单**：历史错误表述（如海南"42次发射"、"第666次飞行"）一旦出现即拒绝整份文件。
4. **变更上限**：单文件单次最多 10 个条目变更，超出即拒绝。
5. **统计块重算**：`typeStats` / `statusStats` / `orbitStats` / `deployProgress` /
   `policyTrend` / `policyTypeStats` 一律由明细自动派生，杜绝图表与列表不一致。

```bash
npm run validate:data                    # 只读校验（CI 门禁）
node scripts/validate-data.mjs --fix     # 自动修复
```

### 11.2 手动补充数据

用 `scripts/templates/` 下的 CSV 模板（融资事件 / 在研型号首飞时间）填写。规则：

- **来源链接必填**——没有 `source` 的条目会被门禁直接丢弃，填了也白填
- **搜不到就写「未查到」**，不要编造数字。本项目已有「待核实」标记机制，诚实留白比编数字有价值
- 金额按原文照抄（「超5亿」「数千万」），单位换算是 `parseFunding()` 的事

### 11.3 数据新鲜度体检（`npm run data:status`）

首页和各页徽标显示的 `data.lastUpdated` 是 **8 个文件取最大值**——
这会掩盖"某个文件其实很久没更新"。所以新增了体检命令：

```bash
npm run data:status                 # 列出每个文件的更新时间、条目数、陈旧天数
npm run data:status -- --warn 30    # 自定义陈旧阈值（默认 30 天）
```

输出会按时间从旧到新排序，并对超过阈值的文件给出告警。
科研门户的「更新日志」页同样展示了分文件的更新时间，不再只有一个聚合值。

### 11.4 market.json 专项管线

`public/data/market.json` 采用与每日 AI 更新**相互独立**的采集管线，适合人工/半自动增量：

```bash
node scripts/collect-market.mjs --dry-run    # 干跑预览，不写文件
```

四类内容：`indicators`（点估计明细）、`series`（多年同口径序列，`id` 与页面 `pickSeries` 对应）、
`insights`（核心洞察）、`bottlenecks`（瓶颈分级）。
口径纪律详见 `DATA_UPDATE_SETUP.md`——**改这个文件的数字前务必先读**。

---

## 12. 后端服务（可选）

`backend/app.py` 提供静态托管与数据接口，前端不依赖它即可运行：

```bash
pip install flask flask-cors
cd backend
python app.py        # 默认 http://localhost:5000
```

CORS 已全开，跨域可直接调用。接口一览（数据缺失时返回 404 + `error` 字段）：

| 接口 | 返回 |
| --- | --- |
| `GET /api/health` | `{ status, message }` 健康检查 |
| `GET /api/rockets` | `rockets.json` 全文（47 型） |
| `GET /api/constellations` | `constellations.json` 全文（39 个） |
| `GET /api/policies` | `policy.json` 全文（注意复数形式，文件是 `policy.json`） |
| `GET /api/industry` | `industry.json` 全文 |
| `GET /api/chain` | `chain.json` 全文 |
| `GET /api/dashboard` | `dashboard.json` 全文 |
| `GET /api/all` | **一次性返回全部 6 个数据集** + 聚合 `lastUpdated`，省掉并发请求 |
| `GET /api/schema` | **数据集字典**：每个数据集的字段清单、条数、注意事项。外部对接方据此即可对接，无需读本仓源码 |

```bash
# 外部对接的典型用法：先看字典，再拉全量
curl http://localhost:5000/api/schema
curl http://localhost:5000/api/all
```

启动后同时托管 `dist/` 并支持前端路由回退（见 §13）。

---

## 13. 部署

运行 npm run build，上传 dist 中的全部文件到域名根目录。构建会为已有栏目生成目录入口和 404 页面。域名配置、Nginx 示例和上线核对见 [部署说明](DEPLOY.md)。

---

## 14. 常见坑与排查

| 现象 | 原因与处理 |
| --- | --- |
| 改了 JSON 字段，页面还是旧数据 | `CACHE_VERSION` 没 +1，浏览器缓存没失效。改 `dataLoader.js` 的 `CACHE_VERSION`，或访问时加 `?nocache=1` |
| 遍历 `policy` / `chain` 白屏或空数组 | 它们是嵌套结构，必须 `flattenDataset(data, key)`，见 §5 |
| 火箭成功率统计里混进了在研型号 | 必须先过滤 `successRate != null` 再分档——`null < 80` 在 JS 里是 `true` |
| 融资金额排序乱序 | `amount` 是「超5亿」这类文本，要用 `parseFunding()` 转数值再排序 |
| 子路径刷新 404 | SPA 回退没配，见 §13 |
| 改了 `global.css` 影响一大片 | 它有 5000+ 行且全站引用。新样式请写进页面私有 CSS |
| CSV 导出多了几行 `#` 开头 | 这是设计：导出带来源与口径的 meta 行。Excel 直接可见，pandas 用 `comment='#'` 跳过 |
| 构建时清空 `dist/` 报 safe-delete 超时 | 已知的沙箱环境问题，重跑一次即可，不是代码问题 |
| ECharts 报 "Duplicate id" 或内存泄漏 | 图表没走 `useChart`，自己 init 但没 dispose |

---

## 15. 信息来源核查记录

（2026-09-26 人工审核）

| 数据项 | 口径 | 来源 |
| --- | --- | --- |
| 长征五号 LEO 25t / GTO 14t | 型谱参数 | [国家航天局官网](https://www.cnsa.gov.cn/n6758824/n6759008/n6759011/c6794064/content.html) |
| 天龙二号 LEO 2t | 基础型参数 | [国家航天局转引中国日报](https://www.cnsa.gov.cn/n6758823/n6758838/c10006032/content.html) |
| 力箭一号遥六失利（2024-12-27） | 发射记录 | [新华社/央视网](https://news.cctv.cn/2024/12/27/ARTI7Aag7AsdPlcXXQ5VRZsy241227.shtml)、[中科宇航说明](http://m.toutiao.com/group/7452949073692295716/) |
| 国家航天局设立商业航天司（2025-11） | 机构事件 | [中国政府网/新华社](https://www.gov.cn/lianbo/bumen/202511/content_7049879.htm) |
| 《推进商业航天高质量安全发展行动计划（2025—2027年）》 | 政策文件 | [央广网/人民网](http://www.cnr.cn/tech/gstj/20251130/t20251130_527446149.shtml) |
| 2025 年商业航天发射 50 次、入轨商业卫星 311 颗；海南商发 2025 年 9 次（累计 10 次） | 年度统计 | [国家航天局](https://www.cnsa.gov.cn/n6758823/n6758838/c10726402/content.html) |
| Amazon Leo（柯伊伯）首发 2023-10 | 星座事件 | [Amazon 官方](https://www.aboutamazon.com/news/innovation-at-amazon/amazon-project-kuiper-latest-updates)、[央视网](https://news.cctv.com/2023/10/07/ARTId7ZAz2SiI2F4TFNCdZ8r231007.shtml) |
| StarLink 规划 41930 颗 / OneWeb 648 颗 | 星座规模 | SpaceX FCC 申报口径 / OneWeb 官方建成口径 |

无法通过公开权威渠道核实、但仍有展示价值的条目（如个别 2026 年政策），
在数据中标记 `verified: false`，前端以「待核实」标签明示，待取得官方原文后移除标记。

