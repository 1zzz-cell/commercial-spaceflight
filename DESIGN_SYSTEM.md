# 中国商业航天产业数据平台 · 界面设计方案 v2

> 任务导向的门户首页改版 ｜ Design System & Interaction Specification

| 项目 | 内容 |
| --- | --- |
| 版本 / 日期 | v2.0 / 2026-11-16 |
| 适用范围 | `/` 为默认首页（HomeV2）、`/home-v2` 为 `<Navigate to="/" replace/>` 重定向、`/home-v1` 保留回滚路由；设计令牌可向后迁移至全站 |
| 设计调性 | 浅色企业基底 + 科技蓝主色 + Hero 局部深空质感 |
| 合规基线 | WCAG 2.1 AA（正文 4.5:1、大字/图形 3:1） |
| 交付物 | 本文、`src/pages/HomeV2.jsx`、`src/styles/home-v2.css`、`visual-convergence.css`、`App.jsx` 路由与全局挂载；Phase 3 增量文件见 §10.4 / §11 |
| 不改动 | 早期约束：不改 `global.css` / `home-b2b.css` / `framework.css` / `public/data/*` / 模块目录；**Phase 3 已按裁决局部修订**（顶栏、贴顶、死别名、响应式与共享令牌例外），见 §11 |

---

## 1. 设计目标：把「美观 + 易用」拆成可验收的原则

用户习惯不是审美偏好，而是可观测的行为规律。本方案以 5 条原则约束所有设计决策：

| 编号 | 原则 | 行为依据 | 落地动作 |
| --- | --- | --- | --- |
| P1 | **首屏任务分拣** | F 型扫读，首访用户 3 秒内判断「这里有没有我要的东西」 | 把「按意图进入」从原第 5 区块提到第 2 屏 |
| P2 | **每屏单一视觉焦点** | 等权信息会互相抵消，导致视线无处停留 | 6 个主屏各设 1 个主动作，主次权重 1 : 3 |
| P3 | **渐进披露** | 概览 → 明细 → 溯源，避免一次性倾倒 | 首页只给概览与入口，明细留在各数据页 |
| P4 | **数字必带口径与来源** | 本领域用户以数据可信度为第一判据 | 指标条带年度口径，页尾给来源与更新时间 |
| P5 | **状态可感知** | 无反馈的界面会被判定为「坏了」 | hover / focus / loading / empty 均有明确反馈 |

### 现状诊断（逐条比对代码，非主观评价）

| # | 问题 | 证据 | 影响 | 改版动作 |
| --- | --- | --- | --- | --- |
| 1 | 13 个区块等权线性堆叠 | `Home.jsx:404–537` | 无视觉层级，滚动疲劳 | 合并为 6 屏，压缩次级内容 |
| 2 | 角色入口排在第 5 区块 | `Home.jsx:464` | 首访用户找不到最该点的入口 | 提到第 2 屏，成为首屏后的第一决策点 |
| 3 | Hero 无任何数据，与数据区脱节 | `Home.jsx:407–430` | 首屏说服力弱，需下滚才见规模 | Hero 底部内嵌指标条，首屏即见实绩 |
| 4 | 6 个指标完全平铺 | `framework.css:128` | 没有「最重要的一条」 | 1 个主指标 + 5 个次指标 |
| 5 | 主色/弱化文字对比度不足 | 实测见 §3.1 | 小字不达 WCAG AA | 新增可读语义色，限制原色用途 |
| 6 | 组件内硬编码色值 | `Home.jsx:35` `THEME`、`:175` `color` | 与「样式一律用变量」约定冲突 | 收敛到 `.home-v2` 作用域语义令牌 |
| 7 | 首页类名散落三个样式表 | `home-b2b.css` / `framework.css` / `sdk.css` | 跨文件视觉漂移 | 新页样式单文件自洽，`hv2-` 前缀隔离 |

---

## 2. 调性决策：为什么是「浅色基底 + 科技蓝 + Hero 深空」

**冲突说明**：需求选择「延续深空科技蓝」，但 `global.css:3` 明确定义全站为浅色企业主题，且 `:122` 注明「浅色主题不需要星空装饰」。若把整站改成深色，会与全站 14 个页面视图（含两个角色门户）产生严重割裂，也违背一次改版的可控范围。

**决策**：
- **不改全站基底**，`--bg-primary` / `--bg-card` / `--text-*` 原样复用；
- **保留科技蓝色系**（`--accent-blue #0d8af0`、`--accent-cyan #06b6d4`）作为图形、边框、图标与填充色；
- **仅 Hero 使用深空深色**（`--hv2-hero-ink`），局部承载「深空」意象，与下方浅色数据区形成明确的章节分隔；
- 所有新增色值**集中定义在 `.home-v2` 顶部的语义令牌区**，禁止散落在组件规则里。这是「新增语义层」，不是硬编码回潮；后续由主仓负责人评估后回填 `global.css` 与 `_shared/tokens.js`。

---

## 3. 设计基础（Design Foundations）

### 3.1 色彩系统：两层结构

**表层（直接复用，不重复定义）**：`--bg-primary` `#eaeff6` / `--bg-card` `#ffffff` / `--bg-card-hover` / `--text-primary` `#1a1f36` / `--text-secondary` `#4a5068` / `--text-muted` `#8890a8` / `--border-color` / `--shadow-*` / `--border-radius-*` / `--transition-*`。

**语义层（本页新增，作用域 `.home-v2`）**：

| 令牌 | 值 | 用途 | 依据 |
| --- | --- | --- | --- |
| `--hv2-hero-ink` | `#0a1832` | Hero 底色 | 深空蓝，白字对比 17.65:1 |
| `--hv2-hero-ink-2` | `#123063` | Hero 渐变终点 / 光晕 | 与底色同色相，避免脏灰 |
| `--hv2-link` | `#0a63b8` | 可点击文本、正文内链接 | 白底 6.02:1，通过 AA |
| `--hv2-up-text` | `#c81e28` | 涨（文本） | 白底 5.72:1 |
| `--hv2-down-text` | `#0a7442` | 跌（文本） | 白底 5.85:1 |
| `--hv2-focus` | `#0a63b8` | 焦点环 | 与链接色一致，2px / offset 2px |

#### 对比度实测（WCAG 2.1 相对亮度公式，`node` 脚本计算）

| 前景 / 背景 | 比值 | 正文 AA (4.5:1) | 结论与约束 |
| --- | --- | --- | --- |
| `#1a1f36` / `#ffffff` | 16.24 | ✅ | 主文本， unrestricted |
| `#4a5068` / `#ffffff` | 7.96 | ✅ | 次要文本、正文说明 |
| `#8890a8` / `#ffffff` | **3.18** | ❌ | 仅允许 ≥18.66px 大字 / 装饰 / 占位符；**禁止承载小字信息** |
| `#0d8af0` / `#ffffff` | **3.55** | ❌ | 仅用于图形、图标、边框、填充；**禁止用于小字链接** |
| `#0a63b8` / `#ffffff` | 6.02 | ✅ | 新增可读蓝，取代上者作文本色 |
| `#ffffff` / `#0a1832` | 17.65 | ✅ | Hero 文本 |
| `#1a1f36` / `#eaeff6` | 14.06 | ✅ | 页面底上的卡片标题 |
| `#4a5068` / `#eaeff6` | 6.89 | ✅ | 页面底上的说明文字 |
| `#8890a8` / `#eaeff6` | **2.75** | ❌ | 灰底上更差，本页不使用 |
| `#e0202a` / `#ffffff` | 4.76 | ✅ | 涨（勉强达标，仍用 5.72 的安全版） |
| `#12a05c` / `#ffffff` | **3.38** | ❌ | 原 `trendColor.down` 作文本不达标 |

> **涨跌配色纪律**：中国市场习惯「涨红跌绿」不变。文本语义色改用安全版（色相不变、明度下调）；ECharts 图形与非文本标记仍沿用 `_shared/tokens.js` 的 `trendColor`（图形适用 3:1 门槛）。涨跌**不得只靠颜色传达**，必须同时带 `+ / −` 符号或箭头与文字。

### 3.2 字体阶梯

沿用 `--font-family`（含 `PingFang SC` / `Microsoft YaHei` 中文回退链），数字与代码用 `--font-mono`。

| 层级 | px | 行高 | 字重 | 用途 |
| --- | --- | --- | --- | --- |
| Display | 42 / 移动端 30 | 1.2 | 600 | Hero `h1`（全页唯一） |
| H2 | 26 | 1.3 | 600 | 屏级标题 |
| H3 | 18 | 1.4 | 600 | 卡片标题 |
| Body | 16 | 1.75 | 400 | 正文 |
| Small | 14 | 1.6 | 400 | 说明、标签 |
| Caption | 12 | 1.5 | 500 | 口径、来源、序号 |

**字重纪律**：正文 / 标签 400 / 500；标题与数字强调最多 600；**全站禁用 700+**。`home-v2.css` 已把 `.hv2-hero-title` / `.hv2-section-title` / `.hv2-cta-title` 三个标题收敛到 600（深空底上 500 偏轻，属实质收敛、不返工），`visual-convergence.css` F 节亦把 700 / 800 统一降到 600。

所有数值型展示统一 `font-variant-numeric: tabular-nums`，保证指标条各位对齐；中文标题 `letter-spacing: 0.01em`，大写英文序号 `0.12em`。

### 3.3 间距：4pt 基准 / 8pt 节奏

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96`（px）。卡片内边距 24px，卡片间距 16px（桌面）/ 12px（移动）。屏级纵向节奏：桌面 96px、平板 64px、移动 48px。所有间距取自该刻度，不出现 13px、27px 一类任意值。

### 3.4 圆角、阴影、层级与动效

- 圆角：`--border-radius-sm 6` 用于标签/徽标、`md 10` 按钮、`lg 16` 卡片、`xl 24` Hero 内嵌容器。
- 阴影：静态 `var(--shadow-sm)`，hover `var(--shadow-md)`，浮层 `var(--shadow-lg)`；**不新增阴影字面量**。
- z-index 刻度：`0` 背景装饰 / `1` 内容 / `10` 粘性元素 / `20` 浮层 / `30` 焦点与气泡 / `100` 跳转链接。
- 动效：`150ms` 微交互、`300ms` 卡片过渡；**仅动画 `transform` 与 `opacity`**，禁止动画 `width/height/top/left` 触发重排；hover 位移 `translateY(-2px)`；`@media (prefers-reduced-motion: reduce)` 下全部降级为 0（继承 `global.css:86` 的全局规则并本页再兜底一次）。

---

## 4. 组件库

### 4.1 复用共用组件，不重造轮子

组件来自 `src/modules/_shared/components.jsx`（与 `@portal` 同一出口）。本页实际复用 `Card`、`StatCard`、`EmptyState`、`Icon`；页面须 `import '../modules/_shared/sdk.css'`，否则 `portal-*` 类名无样式。

| 不复用 | 理由 |
| --- | --- |
| `Grid` | `columns={n}` 把 `gridTemplateColumns` 写成内联样式，媒体查询无法覆盖；多列一律用本页自定义栅格 |
| `SectionTitle` | 不含屏级序号，改用 `SectionShell` 统一 h2 层级与纵向节奏 |
| `SourceTag` | 用内联 `style` 着色，CSS 无法覆盖为 AA 安全色；改用「色点 + 文字」双通道的 `SourceNote` |
| `Delta` | 本页无环比数据；涨跌安全色令牌仍保留供后续页面使用 |

> **入口选择**：页面位于 `src/pages/`，按既有页面惯例直接引用 `_shared/components.jsx`，避免 `@portal/index.js` 连带加载 `useChart` / `DataTable` 及其 echarts 依赖，保持首屏零图表开销。取数仍走 `useData()`；导出仍只允许 `@portal` 的 `exportCSV / exportJSON / exportBibTeX`。

> **局部可访问性修补**：`sdk.css` 的 `.portal-stat-label` / `.portal-section-subtitle` 使用 `--text-muted`（白底 3.18:1，不达 AA）。本页用 `.home-v2 .portal-*` 更高优先级选择器覆盖为 `--text-secondary`（7.96:1），不改共享文件、不影响其余页面。

> **已知坑（必须遵守）**：`Grid columns={n}` 会把 `gridTemplateColumns` 写成内联样式，媒体查询无法覆盖，1100px 以下必挤。本页所有多列栅格一律用 `className="hv2-xxx-grid"` 自定义，且列宽写 `minmax(min(Npx, 100%), 1fr)`——纯 `minmax(340px,1fr)` 在 375px 屏会横向溢出；同时注意 `min(Npx, 100%)` 只在容器窄于 N 时才收缩，因此在 900–1023px 区间必须把 N 降到 260px，否则三列仍会溢出。

### 4.2 本页新增组件（作用域内，非全站组件）

| 组件（代码实名） | 结构 | 关键规格 |
| --- | --- | --- |
| `Hero` | eyebrow → h1 → 副标题 → 双 CTA → 指标条 | 深空底 + 纯 CSS 轨道/网格装饰（`aria-hidden`），无图片请求 |
| `Hero` 内嵌 `hv2-metrics` 渲染块 | 1 主 + 5 次指标 | 数值 `tabular-nums`，每条带年度口径；宽度不足时改 3 列 / 2 列，不横向溢出 |
| `IntentCards`（3 张单卡） | 图标 + 角色标签 + 标题 + 描述 + 3 条要点 + CTA | 投资人 / 科研人员 / 产业从业者三类意图；**整卡单一 `<Link>`**，无嵌套链接；≥44px 点击区 |
| `DatasetCard` | 图标 + 名称 + 主指标 + 描述 + 箭头 | 数据来自 `chain.chainList`（5 条）+ 市场空间（1 条）= 六库，点击进对应路由 |
| `PulseSection` | 快讯列表 + 指数分项 + 更新与里程碑 | 复用 `StatCard` / `EmptyState`；明示分文件更新区间与聚合值局限 |
| `TrustSection` + `SourceNote` | 4 条治理原则 + 来源说明 | 复用 `Card`；状态用「色点 + 文字」双通道，不靠颜色单独传达 |
| `SectionShell` | 序号 + kicker + 标题 + 副标题 + 可选操作 | 统一屏级节奏，保证 h2 层级连续 |
| `CtaSection` | 标题 + 描述 + 双 CTA | 深空底呼应 Hero，首尾闭环 |

### 4.3 组件状态矩阵

| 状态 | 规格 |
| --- | --- |
| Default | 白卡 + `var(--border-color)` 1px + `var(--shadow-sm)` |
| Hover | 边框转 `--border-color-hover`、阴影升 `--shadow-md`、`translateY(-2px)`、箭头右移 4px |
| **Focus-visible** | `outline: 2px solid var(--hv2-focus); outline-offset: 2px`，**所有可交互元素无例外** |
| Active / Pressed | `translateY(0)`，阴影回落 |
| Disabled | `opacity: .55; pointer-events: none; aria-disabled="true"` |
| Loading | 骨架块（纯 CSS 渐变），不显示 `0` 或 `—` 冒充真实值 |
| Empty | 复用 `EmptyState`，给出「去哪里补齐」的指引文本，而非单纯「暂无数据」 |

### 4.4 交互规格

- 所有可点击元素最小 **44×44px**（移动端导航、卡片 CTA、图标按钮）。
- 卡片整卡可点，内部只保留 **一个** 语义链接，杜绝嵌套 `<a>` 造成的键盘焦点重复。
- 跳转到主要内容由 `Layout.jsx:24` 单个全局 `.ds-skip` + `<main id="main-content" tabIndex={-1}>` 提供，覆盖全部 14 个页面视图；键盘首个焦点可见，无需按页补齐，也不要再给页面加页内 skip link（会产生重复 Tab 停点）。
- 装饰层一律 `aria-hidden="true"`，不进入读屏树。

---

## 5. 布局与响应式

容器 `max-width: 1280px`，左右 gutter 桌面 32px / 平板 24px / 移动 16px。概念上 12 栏，实际用 CSS Grid `auto-fit` 实现，避免引入栅格框架。

| 断点 | 宽度 | Hero 指标条 | 意图卡 | 数据卡 | 脉搏区 | 屏间距 |
| --- | --- | --- | --- | --- | --- | --- |
| 移动 | 320–639 | 2 列 | 1 列 | 1 列 | 1 列 | 48px |
| 平板 | 640–899 | 3 列 | 1 列 | 2 列 | 1 列 | 64px |
| 小桌面 | 900–1023 | 3 列 | 3 列（紧凑） | 2 列 | 2 列 | 64px |
| 桌面 | 1024–1279 | 6 列（1 主 + 5 次） | 3 列 | 3 列 | 2 列 | 96px |
| 大桌面 | ≥1280 | 6 列 | 3 列 | 3 列 | 2 列（8:4） | 96px |

移动端 900px 以下，全站 Header 导航已切换为手风琴（`framework.css:88`），本页不重复实现导航，直接复用 `Layout` 外壳。

### Phase 3 落地补充：章节硬接缝与 Hero 顶部间距

- **硬接缝**：深空 Hero → 浅色内容区由**背景色突变形成硬接缝**，不复用旧首页 120px 淡出（旧渐变到 `#f8fafc`，与 `--bg-primary #eaeff6` 之间会多出一条灰阶）。可选 1px 收口线，深空侧 `rgba(255,255,255,.14)` 或浅色侧 `var(--ds-line)` **二选一，不得叠加**；实现值即 1px / 14%，**不要求返工**（`home-v2.css:857–860`）。
- **Hero 顶部间距**：`.hv2-hero` 用 `padding-top: calc(var(--header-height) + 24px)`（= 96px，与统一后的 72px 顶栏联动，改顶栏只需动一处），它覆盖 1023 / 639 断点原有的 64 / 48px，是修「Hero 被 72px 顶栏压住」的必然代价；`.home-v2 #hv2-main > .hv2-section:first-child` 再补 `padding-top: 48px`，与 96px 叠加成首屏节奏（`home-v2.css:865`、`:868`）。

---

## 6. 可访问性（WCAG AA）

| 类别 | 措施 |
| --- | --- |
| 对比度 | 正文 ≥4.5:1；所有小字链接使用 `--hv2-link`；禁用 `--text-muted` 承载信息；图形/边框 ≥3:1 |
| 键盘 | 逻辑 tab 顺序、全局单一 `.ds-skip`（见 §4.4 / §9）、`:focus-visible` 焦点环、无键盘陷阱、Esc 可关闭浮层 |
| 读屏 | 每页唯一 `h1`；`h2 → h3` 不跳级；`<main>` / `<section aria-labelledby>` / `<nav>` 语义地标；图标按钮带 `aria-label` |
| 不依赖颜色 | 涨跌附符号；状态附文字（已核实 / 待核实）；链接有下划线或箭头区分 |
| 触控 | ≥44px 目标，相邻目标间距 ≥8px |
| 动效 | `prefers-reduced-motion` 全量降级 |
| 缩放 | 200% 缩放下不横向溢出、不裁切内容；字号用 `rem` 而非固定 `px` 限制缩放 |

---

## 7. 性能

纯 CSS 绘制 Hero 装饰（径向渐变 + 网格线），**不新增任何图片、字体或 npm 依赖**；动画只走合成层；数据全部来自 `useData()`，无额外 fetch；页面随路由懒加载；不引入 ECharts，首屏零图表初始化开销。

---

## 8. 开发者交接规格

### 文件所有权（遵守项目并行协作架构）

- `src/pages/HomeV2.jsx`、`src/styles/home-v2.css`、`DESIGN_SYSTEM.md` — 本次新增，独立所有权；
- `src/App.jsx` — **仍是唯一合并点**；现有 15 条 Route 定义 / 14 个实际页面视图，并全局挂载 `visual-convergence.css`（`App.jsx:11`）；
- 早期约束：其余共享文件零改动；Phase 3 已按裁决局部修订（`global.css` / `home-b2b.css` / `framework.css` 的顶栏、贴顶、死别名与响应式修复），见 §11；`public/data/*.json` 一律不改。

### 数据契约（`useData()`）

| 字段 | 用途 |
| --- | --- |
| `dashboard.dashboardMetrics[]` | Hero 指标条主数据（`label / value / unit / sub`） |
| `dashboard.newsTicker[]` | 行业动态列表（前 5 条） |
| `dashboard.milestones[]` | 里程碑（倒序取 2 条） |
| `dashboard.source` | 来源标记 |
| `chain.chainList[]` | 数据栏目卡（`key / name / icon / desc / metrics[0]`） |
| `chain.keyFacts2025.facts[]` | 指数摘要（前 3 条） |
| `rockets.list.length` / `constellations.list.length` | 指标条补充两格 |
| `lastUpdated` / `fileUpdatedAt` | 更新徽标与陈旧度提示 |

> 口径提醒：聚合 `lastUpdated` 取各文件最大值，会掩盖个别文件的陈旧（如 `market.json` 与其余文件日期不一致）。`SourceNote` 必须明示这一点，并提示运行 `npm run data:status` 核对。

### 禁止事项

1. 禁止深层访问 `data.xxx.yyy` 之外的非契约字段；取数一律走 `useData()`。
2. 禁止另行实现下载逻辑；导出只能用 `@portal` 的 `exportCSV / exportJSON / exportBibTeX`。
3. 禁止在组件规则里写死色值；新增颜色必须先加语义令牌。
4. 禁止用 `Grid columns={n}` 做多列栅格，禁止纯 `minmax(340px, 1fr)`。
5. 禁止改 `global.css` 或 `tokens.js`（由主仓负责人维护）。

### QA 检查清单

- [ ] `npm run build` 通过，无新增告警
- [ ] 375 / 640 / 900 / 1280 四个宽度下无横向溢出
- [ ] 仅用键盘可走完所有交互，焦点始终可见
- [ ] 开 `prefers-reduced-motion: reduce` 后无位移动画
- [ ] 浏览器 200% 缩放不裁切
- [ ] 所有小字链接为 `--hv2-link`，无 `--text-muted` 承载信息
- [ ] 卡片内无嵌套 `<a>`，装饰元素均 `aria-hidden`
- [ ] 数据与 `public/data/*.json` 一致，来源与更新时间可见

### 窄屏顶栏（Phase 3A 实测口径）

≤767 顶栏横向溢出修复落在 `home-b2b.css:1074–1130`，验收按以下实测值核对，勿按旧口径回退：

- `.global-search-dropdown { min-width: 320px }`（`global.css:4146`）是窄屏溢出元凶，聚焦 / 展开时须由 `position: fixed; left/right: 12px` 贴边全宽承接。
- `.global-search-input { min-width: 0 }` 是 120px 方案成立的关键 —— 不写会让 flex 项的 auto 最小尺寸顶破 120px 外框（`home-b2b.css:1090–1092`）。
- 常态搜索框收窄到 120px；**≤360 已落盘 96px 规则**（`home-b2b.css:1127–1130`），给字体渲染 / 滚动条差异留余量。
- `:focus-within` 把搜索 wrap 改为 `position: fixed; left: 12px; right: 12px; top: 80px`（72px 顶栏 + 8px 间隙）**全宽浮出、脱离顶栏**（`home-b2b.css:1093–1101`）；原「≤767 锁 `:focus-within` 到 120px」的写法作废，见 §11.1。

### CSS 注入顺序与跨 chunk 覆盖（Phase 3 事实）

- `compliance.css` **不是**懒加载页面 CSS：由 `Header.jsx` → `ComplianceKit.jsx:20` 在**入口 chunk eager import**；`sdk.css` / `investor.css` / `research.css` / `home-v2.css` 才是页面级 lazy import（`HomeV2.jsx:24–25`、`Investors.jsx:40–41`、`Research.jsx:28–29`）。
- `visual-convergence.css` 由 `App.jsx:11` 全局挂载，排在 `global.css` 之后即可，**不必排在 `sdk.css` 之后**。
- `vite.config.js` 未设 `cssCodeSplit: false`，各页 CSS 分属不同 chunk，**「靠后置覆盖同权重规则」不成立**；跨 chunk 覆盖只能靠选择器特异性。收敛层 A 节并列 `:where()` 与 `:is()` 两个版本、L 节用 `button.portal-export-btn` 抬高权重，都是为此，**不是冗余代码，不要删**。
- `DataContext.jsx:45` 的加载动画是 `spin 0.8s linear infinite`（不是 1s）；由 `visual-convergence.css` J 节的 `!important` 规则压住内联 style，加载屏 spinner 需挂 `.ds-boot-spinner` 类名。

### 图表导出：键盘可达入口与全站免责守卫

- 新增 `src/components/ChartExportButton.jsx`：ECharts toolbox 图标由 canvas / SVG 绘制、**不是 DOM `<button>`，键盘不可达**，故为带 CSV 工具箱的图表配一个原生 ≥44px 等价按钮；走 `useDisclaimerGuard()` + `@portal` 的 `exportCSV`，并把 `EXPORT_DISCLAIMER` 写进 `extraMeta`。
- `src/utils/chartTools.js` 新增 `setExportGuard(fn)` 全站守卫注册表，由 `Layout.jsx:13–16` 的 `useEffect` 挂载一次（注册 / 卸载）；`buildToolbox(..., { guard } = {})` 支持可选守卫，**不传行为不变**，`myCSV` / `mySVG` 的 `onclick` 走免责确认，`saveAsImage` 不挂。
- **关键**：守卫在**点击时解析**（`resolveGuard()`，非 option 构造时），以规避 React 子组件 effect 先于父组件 effect 的注册时序问题；这样 20+ 个图表子组件无需 prop drilling。

---

## 9. 验收标准

| 指标 | 目标 |
| --- | --- |
| 正文对比度 | 100% ≥ 4.5:1（实测表见 §3.1） |
| 可交互元素焦点环覆盖率 | 100% |
| 最小触控目标 | 100% ≥ 44px |
| 首访用户到达任务入口的滚动深度 | 从原第 5 区块降至第 2 屏（≤1 屏） |
| 视觉一致性 | 新增组件 100% 复用既有 CSS 变量与 `@portal` 组件 |
| 首屏新增资源请求 | 0（图片 / 字体 / 依赖 / 图表） |
| 响应式溢出 | 320 / 375 / 767 / 768 / 1280 五档回归，溢出 0；含 320px 搜索框聚焦态与 375px 首屏可见指标数字 |

### 验收口径（Phase 3 回灌）

- **路由与视图数**：`App.jsx` 共 15 条 Route 定义，`/home-v2` 是 `<Navigate to="/" replace/>`，实际页面视图 **14 个**（含 `/home-v1`）。验收覆盖 14 个视图 + `/home-v2 → /` 重定向断言。
- **`/home-v1` 回归**：必须纳入 **320 / 375 / 767 / 768 / 1280** 五个宽度的横向溢出与纵向遮挡回归；它是回滚快照，**不挂 `ds-page`、不做对比度收敛、不改 `Home.jsx`**。
- **skip link**：由 `Layout.jsx:24` 单个全局 `.ds-skip` + `<main id="main-content" tabIndex={-1}>` 覆盖全部 14 个页面视图，无需按页补齐，也不要再给页面加页内 skip link（会产生重复 Tab 停点）。验收按全局单一方案断言即可，无需按页统计覆盖缺口，也不单列 `/home-v1` 为例外 —— 它已被全局方案自动覆盖，写例外会诱导条件逻辑。
- **实测验收（新增两条）**：① 320px 且搜索框聚焦态下顶栏无裁切；② 375px 首屏仍能看到至少一个指标数字（Hero 96px + `first-child` 48px 叠加节奏）。

---

---

## 10. 投资板块合规设计适配（2026-11-16）

> 依据：项目根目录《商业航天投资活动网站设计方案-20261116.html》（13 节，视觉 / 体验 / 前端三阶段汇编）。
> 本章是**增量规范**，与 §1–§9 并行生效；冲突处按「适配裁决表」执行。

### 10.1 定位差异与适配原则

该方案描述的是「商业航天**股票投教 + 板块研究 + 活动运营**站」；本平台是「**产业分析数据门户**」，两者同行业、不同产品。因此适配原则是：

**纳其合规内核（每个数字都能查证），不换其骨架（门户 IA / 技术栈 / 真实产业数据）。**

| 维度 | 方案 | 本平台 | 裁决 |
| --- | --- | --- | --- |
| 产品定位 | 投教 + 活动报名 + 社区 + 会员 | 产业数据整理与可视化 | 不做活动 / 社区 / 会员 / UGC |
| 信息架构 | 6 项导航 `/overview /chain /companies /tools /insights /engage` | 首页 + 数据栏目 + 指数 / 资讯 / 研报 + 角色服务 | **保留现有 IA**，仅补一个全局合规入口 |
| 技术栈 | Next.js RSC + SSG/ISR + 服务端 HMAC 令牌 | Vite + React SPA，无后端 | 不迁移；免责确认为前端交互约束，不虚构服务端校验 |
| 数值形态 | 设计态行情一律 `--.--` 占位 | 真实产业统计快照（融资 / 火箭 / 星座 / 政策） | **不改占位**：方案 §8.1 已澄清该约束只针对行情数值与设计态；改为强制携带「来源｜数据时间｜口径 + 状态」 |
| 主色 | 墨蓝 `#1F3A5F` | 科技蓝 `--accent-blue #0d8af0` | **不换主色**，仅新增合规语义色并集中管理，否则投资人页会与全站其余页面视图（共 14 个）割裂 |

### 10.2 逐条适配裁决表

| 方案要求 | 落地方式 | 位置 |
| --- | --- | --- |
| 常驻风险条 ≥36px、sticky、不可关闭 | 采纳；落在投资相关页面首屏，配两个带文字合规链接 | `RiskBanner` / `/investors` / `/compliance` |
| 全局合规工具条（顶栏右侧、不进溢出菜单） | 采纳；≥768 顶栏常驻，<768 由风险条右端承接（E1） | `ComplianceToolbar` / `Header.jsx` |
| 32px 三段式来源条「来源｜数据时间｜口径」+ 状态徽标 | 采纳；数据卡 32px 下限、图表 / 记录卡 28px 下限，等高网格 | `SourceBar` / `MetricCard` / `ChartSourceBar` |
| 字段缺失降级「来源待核｜时间 --｜口径 --」 | 采纳 | `SourceBar` |
| 合规四 tab 独立页 | 采纳；第四 tab 转译为「平台与资料来源说明」，不虚构主办方资质与 PII 授权 | `/compliance` |
| 免责声明全文不折叠 + 页脚同文案 | 采纳 | `/compliance#tab-statement` / `Footer.jsx` |
| 6 类动作强制免责模态（禁遮罩关 / Esc 关） | 采纳导出一类；焦点锁定 + 强制勾选，导出件自动附免责 meta | `DisclaimerModal` / `ExportBar` / `DataTable` |
| 三元状态 /「概念相关 ≠ 业绩受益」 | 转译为披露口径三态：可归一 / 未披露 / 大会快照，提示「融资热度 ≠ 经营质量」 | `ConceptNote` |
| 空态「不提供推荐名单」 | 采纳 | `NoRecommendationEmpty` |
| 字重：正文 / 标签 400 / 500、标题与数字强调最多 600、全站禁用 700+；圆角 ≤8px、无阴影、焦点环 2px | 局部收敛，仅在 `.iv-page` / `.cp-*` 作用域覆盖，不改 `global.css` / `sdk.css` | `investor.css` 末段 |
| 涨跌 / 状态多重编码 | 采纳「色点 + 文字」双通道，颜色不作唯一载体 | `StatusBadge` |
| URL 即状态、禁 rank/recommend/top | 既有 hash 页签已符合；Top5 集中度作为统计描述保留并标「非推荐名单」 | `/investors` |
| 768 唯一形态断点 | 合规组件严格遵守（767 隐藏 / 768 显示）；全站栅格断点 1100/640 保持不变 | `compliance.css` |
| 服务端首帧直渲、confirmToken、审计日志 | **不实现**（SPA 无后端），在合规页如实说明降级 | `/compliance#tab-risk` |
| 活动报名状态机、PII 授权、UGC 审核、会员权限 | **不实现**（无对应业务），合规页说明原因 | `/compliance#tab-platform` |

### 10.3 风格连贯性纪律（新增代码必须遵守）

1. 基底、卡片、边框一律复用 `global.css` 变量；新增色值只允许出现在 `compliance.css` 顶部 `--cp-*` 语义令牌区。
2. 私有前缀 `cp-`（合规层）/ `iv-`（投资人页），禁止新增全局选择器覆盖既有样式。
3. `public/data/*.json` 零改动；取数仍走 `@portal` selector；导出仍走 `@portal` exporters。
4. **数据时间取分文件 `fileUpdatedAt`**，不用聚合 `lastUpdated`——聚合值会掩盖个别数据集陈旧（合规页「分文件数据时间」表逐项列出）。
5. 来源条文字用短标签；完整来源与口径说明收敛到导出 meta 与 `/compliance`，避免把 32px 来源条撑成多行。

#### 例外 #1 · ECharts JS 色值字面量（`tokens.js`）

ECharts 的 `option` 是 JS 对象，**读不到 CSS 变量**，CSS 作用域也够不到，因此 `src/modules/_shared/tokens.js` 是**唯一必要的共享改动点**，也是「样式一律用 CSS 变量 / 新增色值集中管理」纪律的**唯一例外**，不是放宽纪律。Phase 3B 仅改两处：

| 字段 | 现值 | 原值 | 依据 |
| --- | --- | --- | --- |
| `trendColor` | `{ up:'#c81e28', down:'#0a7442', flat:'#4a5068' }` | `#e0202a / #12a05c / #8890a8` | 原 `flat` `#8890a8` 仅 3.18:1 不达 AA；新值 5.72 / 5.85 / 7.96:1 |
| `chartBase.title.subtextStyle.color` | `'#4a5068'` | `color.textMuted`（#8890a8，3.18:1） | 7.96:1，达 AA |

其余 `color` 调色板、`palette` 序列色、`textStyle`、`tooltip`、`gridLine`、`border*` **一字未改**。新色值与 `_shared/format.js` 的 `trendOf` / `credibilityOf` 返回色及 `visual-convergence.css` 的 `--ds-up` / `--ds-down` / `--ds-ink-2` 完全一致，不新增色相。

> 配套事实：`_shared/format.js` 保持 E-4 兼容契约 —— `trendOf` 仍返回 `{ dir, tone, color }`、`credibilityOf` 仍返回 `{ level, tone, label, color, desc }`，`color` 是保留别名（供 `src/pages/Research.jsx` 的 `.rs-tagcell` inline style 消费），`tone` 复用 `dir` / `level` 枚举，未新增第三套枚举。`--ds-*` 令牌只挂在 `.ds-page`（**10 个数据页**：14 视图 − 3 个 A 档对照页 − 1 个回滚快照 `/home-v1`）与 6 个 `.ds-tone-*` 宿主上，不进 `:root`，零共享污染；`visual-convergence.css` 可删 `App.jsx:11` 一行 import 独立回滚。

### 10.4 新增 / 改动文件

| 文件 | 类型 | 内容 |
| --- | --- | --- |
| `src/components/ComplianceKit.jsx` | 新增 | 合规文案单一真源 + 风险条 / 来源条 / 状态徽标 / 免责模态 / 动作守卫 / 顶栏工具条 |
| `src/styles/compliance.css` | 新增 | `--cp-*` 令牌 + 全部 `cp-*` 规则 + 合规页与页脚免责样式 |
| `src/pages/Compliance.jsx` | 新增 | 四 tab 页，含分文件数据时间表 |
| `src/pages/Investors.jsx` | 修改 | 首屏重构、9 条来源条、三元口径提示、导出守卫、空态文案 |
| `src/styles/investor.css` | 修改 | 末段局部视觉收敛 + 卡片来源条紧凑网格 |
| `src/components/Header.jsx` / `Footer.jsx` | 修改 | 顶栏合规工具条 / 页脚免责全文与链接组 |
| `src/App.jsx` | 修改 | 注册 `/compliance` 路由 |
| `src/modules/_shared/components.jsx` / `exporters.js` / `src/components/DataTable.jsx` | 修改 | 可选 `guard` / `exportMeta` / `EXPORT_DISCLAIMER`，**不传时行为不变**，向后兼容 |

### 10.5 实测验收（2026-11-16）

| 项目 | 结果 |
| --- | --- |
| 生产构建 | 通过；`Compliance` 独立 12.72 kB JS，`Investors` 39.39 kB JS / 17.04 kB CSS |
| 新增语义色对比度 | 可读蓝 6.02:1（白）/ 4.76:1（页脚底）、琥珀 6.75:1、风险红 7.34:1、涨红 5.72:1、跌绿 5.85:1 —— 全部 ≥ WCAG AA 4.5:1 |
| 三视口 × 三路由（375 / 768 / 1280 × `/investors` `/compliance` `/`） | 0 横向溢出、0 控制台错误 |
| 768 形态分界 | 375 / 767 顶栏工具条隐藏且风险条保留文字链接；768 / 1024 / 1280 顶栏工具条可见 |
| 指标卡来源条 | 4 张等高 58px、三段式不省略、圆角 4px、无阴影 |
| 免责确认 | 弹窗打开；点遮罩与按 Esc 后仍存在；勾选前确认按钮禁用；确认后下载 CSV 含「免责 / 数据来源 / 统计口径」meta 行 |
| 合规页 | 4 tab 可达且 hash 可分享；免责全文 4 条不折叠；口径页 2 表 + 3 来源条 |

---

## 11. Phase 3 裁决回灌（2026-11-16）

> 本章记录 Phase 3 已确认裁决的撤回、口径与不实现项，与 §1–§10 并行生效；冲突处以本章为准。凡标「撤回 / 作废 / 不实现」者，均不得再作为改代码依据。以下逐条比对代码后写入（核对清单见交付报告）。

### 11.1 撤回 3 处

1. **「Home.jsx 不再可达、可删 `.home-b2b` 贴顶规则」错误** —— `App.jsx:67` 保留 `/home-v1` 回滚路由，贴顶规则必须保留：`home-b2b.css:17` 的 `.home-b2b` 贴顶规则供回滚页使用，`:1141` 的全局兜底与 `home-v2.css:851` 的页面级规则供 `/` 首帧贴顶，重复声明无害。
2. **「`visual-convergence.css` import 必须排在 `sdk.css` 之后」错误** —— `sdk.css` 是页面级 import（`HomeV2.jsx:24` / `Investors.jsx:40` / `Research.jsx:28`），`App.jsx` 全局只需排在 `global.css` 之后（`App.jsx:6–11`），无需追加约束。
3. **「§8 ≤767 锁 `:focus-within` 到 120px」作废** —— 改为 `position: fixed; left/right: 12px; top: 80px` 全宽浮出、脱离顶栏（`home-b2b.css:1093–1101`）；正确口径见 §8「窄屏顶栏」。

### 11.2 口径裁决

- **不给 `/compliance#tab-*` / `/investors#tab-*` 补元素 id**：hash 刻意不用 id 前缀（`Compliance.jsx:11`，页签 id 为 `cp-tab-*` / `iv-tab-*`），补了会让页内切 tab 触发锚点滚动。
- **不加 `scroll-margin-top: calc(var(--header-height) + 16px)`**：现有 `window.scrollTo` 手算 88px 偏移（`UIEnhancements.jsx:82`，72px 顶栏 + 16px 呼吸），CSS 对 JS 手算不生效，将来若改用 `scrollIntoView` 会叠成 176px；**88px 维持 JS 方案**。

### 11.3 不返工 / 不实现

- **1px / `rgba(255,255,255,.14)` 收口线不返工**：实现值即 1px / 14%，见 §5。
- **`.ds-sourceline` 已撤回、不实现**：全站无此类名，勿再补。
- **服务端 `confirmToken` / 审计日志不实现**（SPA 无后端）。
- **活动报名 / PII 授权 / UGC 审核 / 会员权限不实现**（本站无此业务），合规页只如实说明降级原因。上述不实现项**一律不得写成「已实现」**。

### 11.4 风格底线

- 全站基底是浅色 `--bg-primary #eaeff6`（`global.css:3`），**不得出现「深色深空科技风」这类描述整站的表述**；「深空」意象只在局部 Hero（`--hv2-hero-ink #0a1832`），其余页面沿用浅色企业主题。

---

## 12. 分阶段迭代回灌（2026-11-16，三阶段）

> 本章记录「评估 → 分阶段改进」这一轮的实测结论，逐条比对代码写入。与 §1–§11 并行生效。

### 12.1 首屏性能：echarts 有两条入口链，缺一不可

- **现象**：`dist/index.html` 的 modulepreload 曾含 `echarts-*.js`（1,027KB）。页面全部 lazy，但 echarts 仍进首屏关键路径。
- **根因是两条链**，只断一条无效：
  1. `App.jsx` 启动时 `preloadChinaMap()` → `useChinaMap.js` 静态 `import * as echarts`。**已删** App 的调用；`preloadChinaMap` 导出保留兼容但无调用点。
  2. 更隐蔽的一条：`Layout.jsx` 为挂载导出守卫 `import { setExportGuard } from '../utils/chartTools'`，而 `chartTools.js:8` 静态 import echarts。**已把守卫单例下沉到 `src/utils/exportGuard.js`（零第三方依赖）**，`chartTools.js` 改为 `re-export { setExportGuard }`（27 个调用点零改动）、内部读 `getExportGuard()`；`Layout.jsx` 改从 `exportGuard.js` 直接 import。
- **结果**：modulepreload 从 4 项降到 2 项（仅 rolldown-runtime + react），首屏 JS 约 1.27MB → 约 272KB（gzip 88KB）。echarts 只在进入图表页时按需加载。
- **纪律**：`exportGuard.js` 必须保持零第三方依赖；任何人不得把 echarts / exporters 的 import 加回入口 chunk（App / Layout / Header / DataContext / UIEnhancements）。加守卫挂载点一律 import `exportGuard.js`。

### 12.2 数据新鲜度：Hero 用区间，不用聚合最大值

- `dataLoader.js:151` 的 `lastUpdated` 取各文件最大值，会掩盖多数文件陈旧。`HomeV2.jsx` 的 `freshnessOf()` 改为显示 `数据区间 oldest — newest`，并按 `Date.now() - 30 天` 实时算 `N 个数据集待更新`，**禁止写死日期**。
- 合规页与各数据页继续用分文件 `fileUpdatedAt`，口径不变（§10）。

### 12.3 全局错误边界

- 新增 `src/components/GlobalErrorBoundary.jsx`，class 边界 + `role="alert"`，提供重试与返回首页；内联样式用既有 CSS 变量，不新建 CSS 文件、不引入新色值。
- 在 `App.jsx` 的 `GuardedRoutes()` 内以 `key={location.pathname}` 挂载，切页复位；只包 `<Routes>`，**不包 DataProvider**（数据加载错误由 DataContext 的 ErrorScreen 处理，两者不重叠）。

### 12.4 内容布局与用户流程

- 首页 03 屏追加「年度观察」三卡（实绩 / 趋势 / 案例，`home-v2.css` 末尾 `hv2-digest-*` 样式，auto-fit 栅格），深链 `/reports#report-01~03`；补回旧首页压缩掉的可独立消费内容。
- `Reports.jsx` 把原 05 号「商业航天指数」CTA 从报告序列中移出，改为明确标注「入口」的 `rpt-doc-entry` 区块（4 篇真报告 + 1 入口）；不再把 CTA 冒充报告。
- `News.jsx` 快讯加按来源筛选（`news-filter.css`，`news-` 独立前缀、按钮 ≥44px、aria-pressed），空结果有明确反馈。**不伪造日期字段**——数据集只有「来源：正文」结构。

### 12.5 基础 SEO（SPA 口径）

- `UIEnhancements.jsx` 顶部 `ROUTE_META` 是路由 title / description 的**单一真源**，由 `syncRouteMeta()` 在切页时同步 `document.title` 与 `<meta name="description">` / `og:description`。新增路由只改这一处。
- `public/` 新增 `robots.txt` / `sitemap.xml` / `manifest.webmanifest`，`index.html` 关联 manifest / canonical / sitemap。
- **部署前必做**：把 `index.html`、`robots.txt`、`sitemap.xml` 里的 `https://example.com` 占位域名换成实际地址（文件内已有注释）。
- **Vite 8 坑**：`<link rel="canonical" href="/">` 会让构建报 `EISDIR`（Vite 把 `href="/"` 当本地资源读取）。canonical / sitemap 必须用绝对 URL。

### 12.6 本轮验证

`npm run build` 与 `npm run validate:data`（0 错 0 警）通过；Playwright 实测：三视口 320/375/1280 首页 0 溢出 0 报错；13 路由 title 全唯一；快讯筛选交互正常；报告页结构正确；3 个静态 SEO 文件 HTTP 200；深链可达。

### 12.7 图表 canvas 文本等价（第三步迭代收口）

- **统一注入点**：29 处手写 `echarts.init` + 2 处 `useChart`，逐个改不现实。最终在 `buildToolbox`（~30 图调用）里调 `attachChartA11y(inst, { filename, csv })`；`useChart` 里再加 option 兜底（`csvFromOption` + `onlyIfEmpty: true`），覆盖不走 buildToolbox 的 `/market` 6 图，且不覆盖已有 csv 表格的来源/口径。
- **产物**：容器 `role="img"` + 一句话 aria-label（标题/行列数/来源，来源与标题相同则不重复）；容器后 `<details class="chart-a11y">` 原生表格，键盘可达、可展开核对；样式 `chart-a11y.css` 由 `chartTools.js` import，随图表页 lazy chunk，不进首屏。
- **串写坑**：`details` 查找不能用 `parentElement.querySelector`（一个 chart-card 多图时命中第一张表，实测 /analysis 5 容器 7 表），必须只认 `dom.nextElementSibling`。
- **验证时序坑**：冷启动 8 文件全量加载需 2s+，Playwright 用固定 450ms 等待会把首访误判为 0 表格。必须 `waitForSelector('details[data-chartA11y]')` 等真实出现。
- **构建坑**：预览服务占用 dist 时，`npm run build` 清空 assets 会 trash 失败（报 EISDIR / safe-delete 错），**构建前先停预览**。判断构建结果必须取命令自身退出码（`npm run build > log; echo $?`），不能用 `| tail` 的退出码。
- **实测**：/analysis 7 表全 attached、/market 6 表全 attached；反复进出 3 次稳定 7 表不累积；summary 可聚焦、展开有数据行；375 零溢出、0 报错。

---

### 12.8 内容事实核查与口径纠错（五方面完善·第一轮）

三路独立只读核查（内容事实 / IA 路径 / 功能体验）结论：平台口径纪律的**意图**是对的，但**存量数据**存在可被原文证伪的硬错误。已修：

1. `dashboard.json` 千帆 A 轮「2025年4月」→「2024年2月」。证伪依据：`industry.json:235` 为 `2024-02`、`chain.json:513` 为 2024 年 2 月，且实访上海证券报原文（m.cnstock.com/commonDetail/612445）明确「2024年2月…67亿元A轮」。**此为跨数据集一致性错误，不是口径差异。**
2. `chain.json` 「311 颗占全年入轨航天器 84%（共377个）」→「占全年入轨卫星约84%（国家航天局口径）」。原写法分母错配：311/377=82.5%，且 CNSA 原文的 84% 分母是「入轨卫星」而非「入轨航天器」。
3. `dashboard.json` 市场规模 2.8 万亿 sub「2025年实绩」→「2025年机构测算」；融资 186 亿 sub →「2025年大会口径」。依据：光明网原文 2.8 万亿是「预计达」；同文 250–280 亿、睿兽 139.4 亿、大会 186 亿为三套不同口径，**禁止混用**。`Market/index.jsx` 顶部睿兽口径卡补注「与其他页面大会口径不可直接对比」。
4. `modules/_shared/components.jsx` 的 BibTeX 导出按钮补 `run()` 守卫——此前 CSV/JSON 走免责守卫、唯 BibTeX 绕过，属合规不一致。
5. `Investors.jsx` 事件流水新增「原文核实」列：有 sourceUrl 显示可点「已核实」，无则显示琥珀「待核实」（色点+文字双通道），页头说明明确「待核实条目不视为已逐条查证」。

**未修且必须诚实标注的缺口**：
- `industry.json` 20 条融资事件中 19 条无 source/sourceUrl（仅千帆 1 条有）。**不编造 URL 填充**——补不到真实原文就保持「待核实」，宁可暴露缺口也不制造假溯源。需人工逐条核对公开原文后补录。
- `chain.json` 186 亿那条 fact 与一条 insight 的 sourceUrl 为空；`market.json` insights 11 条全无 sourceUrl。
- 8 文件中 7 个 lastUpdated 停在 10-04/10-06（超 30 天阈值）。CI workflow 配置存在（`update-data.yml` 每日 cron），但**是否真运行需线上验证 Actions 历史**，本地静态检查无法证实，不得断言「管线坏了」。

**核查纪律**：可访问性/触控 44px 等跨 A 档冻结页的改动需单独视觉回归，不与数据纠错混轮，避免回归不可控。

---

### 12.9 信息架构（IA）修复：命名统一 + 两级深链（五方面完善·第二轮）

**命名统一（路由正式名 = 门户别名，五链降格为页内叙述概念）**：审计发现 Header / Footer / 全局搜索 / SEO / 互链均已用门户别名（企业库 / 火箭型谱 / 星座计划 / 投融资 / 政策法规 / 科研数据门户），只有落地页 h1 和 2 处 SEO title 仍用旧五链名，导致「点了企业库却看到产业链」的心智断裂。已改 7 个 h1：`/chain` 产业链→企业库、`/analysis` 资金链→投融资、`/rockets` 火箭链→火箭型谱、`/constellation` 卫星链→星座计划、`/policy` 政策链→政策法规、`/market` 市场与成本洞察→市场空间（两个条件渲染分支都要改，否则空态/正常态显示两名）、`/research` 科研门户→科研数据门户；同步 `UIEnhancements.jsx` 的 `/chain`、`/analysis`、`/compliance` 三处 title，以及 Reports/Investors 里指向已改名页面的叙述文案。**保留不改**：HomeV2 角色卡「产业链数据库」（描述内容性质而非路由名）、Footer/ComplianceKit 的「五链」总述句（概念性，不指向单页）、`modules/Research/` 脚手架样例（非路由页）、`/index` `/news` 导航缩写（空间约束 + Footer 同用）。sitemap.xml 只有 `<loc>` 无显示名，命名改动零成本。

**两级深链（页签级 → 卡片级）**：
- `/research` 五个页签补 hash 深链（`#tab-<key>`），照 `Investors.jsx` / `Compliance.jsx` 模式：activeTab 从 `location.hash` 派生、`goTab` 用 `navigate(...,{replace:true})`、tabpanel 语义、← → Home End 键盘导航。
- 全局搜索企业条目从页签级 `/investors#tab-companies` 升级到卡片级 `/investors#cmp-<encodeURIComponent(企业名)>`：企业卡加 `id={companyAnchorId(name)}` + `tabIndex=-1`；`activeTab` 识别 `#cmp-` 前缀落到「企业画像」页签；新增 3 秒轮询兜底 effect（`offsetTop-88` 滚动 + `focus`），覆盖冷启动懒加载慢于 RouteScrollHandler 12×60ms 重试窗口的情况。两处处理器定位同一元素、目标一致不打架。

**切 tab 滚动扰动修正**：`goTab` 里的 `tabRefs.current[key]?.focus()` 会把 tab 按钮滚入视口，实测 /research 中段点击后 scrollY 557→65，违背 RouteScrollHandler「同 pathname 切 tab 保持阅读位置」的设计意图。改为 `focus({ preventScroll: true })`——焦点跟随保留（可访问性），滚动扰动消除。Research.jsx 与 Investors.jsx 两处同步修。

**验证（Playwright + Chromium headless，6/6 PASS）**：`#tab-provenance` 深链直达且面板语义正确；企业搜索 path 编码正确、卡片 id 与 hash 一致且在视口内；冷启动直开 `#cmp-蓝箭航天` 定位成功；375px 两页零横向溢出；`validate:data` 0 错误 0 警告；build 退出码 0。

---

### 12.10 W1 P0：U1 图表表格溢出与「伪修复」教训（2026-11-18）

**修复**：仅改两个 CSS。`chart-a11y.css` 给 `.chart-a11y` 与 `.chart-a11y-scroll` 加 `min-width:0`（后者加 `max-width:100%`）；`global.css` 给 `.screen-panel` 加 `min-width:0`、两处 `.charts-grid` 的 `repeat(2,1fr)` 改 `repeat(2,minmax(0,1fr))`。375px 实测：`/rockets` 展开态 893→375（screen-panel 被撑破的那部分修复）、a11y 宽表改为容器内滚动（保留 `white-space:nowrap`，靠容器消化）。

**关键纠错：91px 的真凶不是 a11y 表格，是 header 文案**。台账 U1 把 `/constellation` 375px 的 91px 溢出归因于「a11y 表格撑破」，DOM 诊断证伪：表格本来就在 `.chart-a11y-scroll` 内滚动。真凶是 `span.chart-inline-note`（「共 N 个已开建星座 · 按完成率降序 · …」）在 `.screen-panel-header` 里的 `white-space:nowrap`，clientWidth 301 / scrollWidth 429，37+429=466。修复：在 `global.css` 的 `.chart-inline-note` 定义块之后新增独立的 `@media (max-width:600px)` 覆盖 `white-space:normal; overflow-wrap:anywhere`。实测关闭态 466→375、展开态 524→375；`getComputedStyle().whiteSpace` 在 600 为 normal、601 为 nowrap，证明媒体查询真命中、桌面胶囊未受影响。

**伪修复教训（易重犯）**：`visual-convergence.css:427-434` 早已给 `.ds-page .chart-inline-note` 加了 `overflow-wrap:anywhere; word-break:break-word; max-width:100%`，注释还写着「实测 /constellation .chart-inline-note 441px」。但在 `white-space:nowrap` 未解除时，`overflow-wrap` **完全不生效**——这就是台账以为修好、实测仍溢出 91px 的原因。纪律：长 URL / 长文案的换行修复，`white-space` 与 `overflow-wrap` 必须成对检查，只加后者等于没加；且不能信注释里的「已修」，要实测 `getComputedStyle`。

**验证基线方法学**：Playwright 用 `isMobile:true` 时 `window.innerWidth` 会随内容放大（测出 466/524/893），判定失真；必须用非 mobile 的固定 375×812 视口重采才能复现台账数字。验收覆盖 375/480/600/601/768/1280 六档 × 5 页共 10 组，`scrollWidth <= innerWidth+1` 全 PASS、pageerror 0、构建 EXIT=0。

---

**设计交付**：UI Designer ｜ **实现状态**：规范 → 落地 → 构建验证 ｜ **QA 流程**：按 §8 清单逐项核对，未通过项不进入合并
