# 数据补全方案

> 2026-09-30 制定。基于伪数据清理后的完整性评估结果，明确各类缺失的补全方法、优先级与实施步骤。

## 一、缺失模式总结

| 缺失类型 | 涉及范围 | 缺失量 | 严重度 |
|---|---|---|---|
| **结构性缺失**：条目级 source/sourceUrl 缺失 | rockets 47/47、constellations 41/41、policy 25/25 无 sourceUrl | 113 条 | 高 |
| **合理缺失**：可空字段为 null | rockets gto=null 41条、costPerKg=null 13条、constellations satWeight=null 8条 | 62 条 | 低 |
| **标记缺失**：verified=false 待核实 | rockets 47、constellations 41、policy 6 | 94 条 | 中 |
| **分词质量**：policyWordFreq 滑动窗口分词效果差 | policy 20词 | 20 条 | 中 |

## 二、补全方法选择标准

| 缺失类型 | 推荐方法 | 适用条件 | 实施难度 |
|---|---|---|---|
| source/sourceUrl 缺失 | **外部权威数据源补充** | 有明确官方出处的条目（如国家航天局、公司官网） | 中 |
| verified=false 条目 | **人工核实 + 外部补充** | 可通过公开渠道核实的条目 | 高 |
| gto/costPerKg null | **基于统计的插补** 或保持 null | 既有同型号火箭参数可参考插补；在研型号保持 null | 低 |
| satWeight null | **外部数据源补充** | 可从公司官方公告/卫星数据库补充 | 中 |
| policyWordFreq 分词 | **专业分词工具重算** | 使用 jieba-node 替代滑动窗口 | 低 |

## 三、分项补全方案

### 3.1 source/sourceUrl 补全（优先级 P0，影响 113 条）

**方法**：外部权威数据源逐条补充

**数据源优先级**：
1. **国家航天局官网**（cnsa.gov.cn）：火箭型谱参数、政策原文
2. **公司官方页面**：天兵科技(spacepioneer.cc)、蓝箭航天、星河动力等官网
3. **FCC 申报文件**：StarLink、OneWeb 等国际星座
4. **新华社/央视网**：发射记录、行业事件
5. **行业数据库**：Gunter's Space Page、Spaceflight Now

**实施步骤**：
1. 按条目类型分批处理：先政策（25条，政府网可查）→ 火箭（47条，航天局+公司官网）→ 星座（41条，FCC+公司）
2. 每条添加 `source`（机构名）和 `sourceUrl`（具体 URL）
3. 补全后移除 `verified: false` 标记
4. 运行 `node scripts/validate-data.mjs` 校验

**预期效果**：113 条 source 缺失全部补全，verified:false 标记全部移除

### 3.2 verified=false 条目核实（优先级 P1，影响 94 条）

**方法**：人工核实 + 外部补充

**核实标准**：
- ✓ 能在权威渠道找到对应信息 → 补 source/sourceUrl，移除 verified:false
- ✓ 信息存在但无原文链接 → 保留 verified:false，前端显示"待核实"
- ✗ 无法在任何公开渠道找到 → 保留 verified:false，标注为"待核实"

**实施步骤**：
1. 对已在前轮核查中确认的条目（如 CZ-5 LEO 25t 已查国家航天局），直接补 sourceUrl 并移除 verified:false
2. 对在研型号（如天龙三号H、力箭三号等），核查公司官网产品页
3. 对无法核实的条目，保留 verified:false 状态

### 3.3 policyWordFreq 分词改进（优先级 P1，影响 20 条）

**当前问题**：2字滑动窗口产生大量无意义词（如"业航""天商"）

**方法**：引入 jieba-node 专业中文分词

**实施步骤**：
1. 安装 jieba-node：`npm install -D nodejieba`
2. 修改 scripts/ 下补全脚本，用 nodejieba 替代滑动窗口
3. 停用词表扩展：增加"推进""实施""建设""发展""推进"等高频无意义词
4. 重新生成 policyWordFreq.data

**预期效果**：词频结果从"航天/商业/业航"变为"商业航天/卫星互联网/军民融合"等有意义词组

### 3.4 可空字段保持策略（优先级 P2，影响 62 条）

**方法**：保持 null，不做插补

**理由**：
- gto=null（41条）：多数小型/固体火箭无 GTO 运力，null 是语义正确的"不适用"
- costPerKg=null（13条）：在研型号无公开成本数据，插补会引入伪数据
- satWeight=null（8条）：部分星座未公开卫星重量，插补无依据

**例外**：如能从公司官方公告查到确切数值，则补充

## 四、补全进度跟踪

| 阶段 | 目标 | 状态 | 完成度 |
|---|---|---|---|
| 阶段1：伪数据清理 | 14条规则全部清理 | ✅ 完成 | 100% |
| 阶段2：政策 sourceUrl 补全 | 25条政策补原文链接 | 待执行 | 0% |
| 阶段3：火箭 source 补全 | 47条火箭补来源 | 待执行 | 0% |
| 阶段4：星座 source 补全 | 41条星座补来源 | 待执行 | 0% |
| 阶段5：词频分词改进 | 20词频用jieba重算 | 待执行 | 0% |
| 阶段6：verified标记清理 | 94条核实后移除标记 | 待执行 | 0% |

## 五、补全后的质量标准

补全完成后需满足以下全部条件：
1. `npm run validate:data` 零错误
2. 所有条目有 `source` 字段（机构名）
3. 能查到原文的条目有 `sourceUrl` 字段（具体 URL）
4. `verified: false` 条目数 ≤ 10（仅保留真正无法核实的）
5. policyWordFreq 词频均为有意义的中文词组（非单字组合）
6. 前端"待核实"标签数量 ≤ 10 处
