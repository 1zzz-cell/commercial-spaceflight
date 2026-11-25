# 数据自动更新配置指南

## 工作原理

```
GitHub Actions (每天8:00触发)
    ↓
调用 AI API (Deepseek/OpenAI/Qwen等)
    ↓
AI 审查现有JSON数据，基于知识库更新过时信息
    ↓
通过自动门禁后直接提交并发布
    ↓
部署平台 (Vercel) 在数据提交后自动重新部署，前端获取最新数据
```

## 你需要完成的 4 步配置

### 第1步：安装 Git 并创建 GitHub 仓库

1. 下载安装 Git：https://git-scm.com/download/win
2. 在 GitHub 创建一个新仓库（如 `commercial-spaceflight`）
3. 在项目根目录执行：
   ```bash
   git init
   git add .
   git commit -m "初始提交"
   git branch -M main
   git remote add origin https://github.com/你的用户名/commercial-spaceflight.git
   git push -u origin main
   ```

### 第2步：获取 AI API Key

推荐使用 Deepseek（便宜、国内可用）：

1. 访问 https://platform.deepseek.com/
2. 注册并充值（10元足够用很久）
3. 创建 API Key
4. 记录以下信息：
   - API Key: `sk-xxxxxxxxxxxx`
   - API Base: `https://api.deepseek.com/v1`
   - Model: `deepseek-chat`

> 也支持其他 OpenAI 兼容的 API：
> - OpenAI: base=`https://api.openai.com/v1`, model=`gpt-4o-mini`
> - 通义千问: base=`https://dashscope.aliyuncs.com/compatible-mode/v1`, model=`qwen-plus`
> - 智谱AI: base=`https://open.bigmodel.cn/api/paas/v4`, model=`glm-4-flash`

### 第3步：配置 GitHub Secrets

在 GitHub 仓库页面：
1. 进入 `Settings` → `Secrets and variables` → `Actions`
2. 点击 `New repository secret`，添加以下 3 个：

| Name | Value |
|------|-------|
| `AI_API_KEY` | `sk-你的API密钥` |
| `AI_API_BASE` | `https://api.deepseek.com/v1` |
| `AI_MODEL` | `deepseek-chat` |

### 第4步：部署到 Vercel（免费）

1. 访问 https://vercel.com ，用 GitHub 账号登录
2. 点击 `New Project`，选择你的仓库
3. Framework 选 `Vite`，直接点 `Deploy`
4. 部署完成后，每次自动数据提交都会触发 Vercel 重新部署

---

## 验证配置

配置完成后，可以手动触发一次测试：

1. 进入 GitHub 仓库 → `Actions` 标签页
2. 选择 `每日数据更新` workflow
3. 点击 `Run workflow` 按钮手动触发
4. 查看运行日志，确认数据更新成功

## 日常维护

- **自动运行**：每天北京时间 8:00 自动更新并提交通过门禁的数据
- **手动触发**：在 Actions 页面随时手动运行
- **查看更新记录**：查看自动提交和 `data-update-candidates/<日期>/manifest.json`
- **时间字段**：`meta.asOfDate` 是数据截至日，`meta.lastVerifiedAt` 是最近核验日，`meta.publishedAt` 是网站发布时间
- 本地只想生成候选文件时运行 `node scripts/update-data.mjs --review`。默认运行和 GitHub Actions 都是自动发布模式。
- 自动发布会检查新增或修改记录中的 HTTPS 来源链接是否可访问。链接不可访问时整份文件不发布，旧数据继续保留。
- **暂停更新**：在 Actions 页面禁用 workflow 即可

## 市场数据集（market.json）专项管线

`public/data/market.json` 是「市场与成本洞察」页（`/market`）的数据源，采用与每日 AI 更新**相互独立**的专项采集管线，适合人工/半自动增量补充行业指标：

```bash
# 1. 按 scripts/templates/市场指标采集模板.csv 整理候选数据（或用 JSON）
# 2. 干跑校验（不写盘）：查看哪些条目会被合并、哪些会被清洗规则拒绝
node scripts/collect-market.mjs --input candidates.json --dry-run
# 3. 确认无误后正式入库
node scripts/collect-market.mjs --input candidates.json
# 4. 数据门禁（CI 必过）
npm run validate:data
```

清洗规则（与主管线共用 `scripts/data-rules.mjs`）：无 `source` 的条目直接丢弃；无 `sourceUrl` 自动标记 `verified=false`（前端显示「待核实」）；单次变更超过 10 条拒绝入库（防大面积幻觉改写）。

**market.json 四类内容**：`indicators`（点估计明细：指标/类别/年份/数值/单位/来源/口径）、`series`（多年同口径序列，图表直接消费，`id` 与页面 `pickSeries` 对应）、`insights`（核心洞察）、`bottlenecks`（政策与成本瓶颈分级：结构性/周期性/制度性 × 高/中/低）。

**已固化的口径纪律**（交叉验证结论，改动数据时须遵守）：
- 全球太空经济三口径不可混用：Space Foundation 6,860亿（最宽）/ Novaspace 6,264亿 / SIA 4,290亿美元（2025）
- 中国市场规模：广义产值 2.83万亿元 vs 核心产业 1.01万亿元（赛迪，2025）
- 全球发射三口径：McDowell 329次（含星舰亚轨道）/ SpaceNews 324 / BryceTech 325（2025）
- 全球投资三口径：Space Capital 553亿（宽）/ BryceTech 109亿（初创）/ Space Foundation 120亿+（窄）
- 朱雀三号复用降本：报价口径与造价口径的节省幅度**禁止混用**；造价口径为复用5次省64–72%、复用20次省约78%（检修成本假设区间3,000–6,000万元/次，回收箭体尚未复飞）
- 星座在轨数以「批次台账+官方通报」为源，冻结基准：GW 222颗@2026-10-10、千帆256颗@2026-09-16；单批星数勿以设计值填充

## 文件说明

| 文件 | 作用 |
|------|------|
| `.github/workflows/update-data.yml` | GitHub Actions 配置 |
| `scripts/update-data.mjs` | AI 数据更新脚本（ rockets/constellations/industry/chain/policy/dashboard ） |
| `scripts/collect-market.mjs` | market.json 专项采集管线（人工/半自动增量） |
| `scripts/validate-data.mjs` | 数据仓库校验门禁（含 market.json，CI 必过） |
| `public/data/*.json` | 数据文件（会被自动更新） |
