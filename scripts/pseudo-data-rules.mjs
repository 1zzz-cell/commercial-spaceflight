// ============================================================
// 伪数据识别规则（2026-09-30 制定）
// 用于系统性识别、标记、清理项目中所有无法定量分析的伪数据
// ============================================================

// ---------- 伪数据分类 ----------
// PSEUDO_TYPE 定义伪数据的五种类型
export const PSEUDO_TYPES = {
  // 类型1：定性数据伪量化（如 0-100 精确分值但无公式）
  QUANTIFIED_QUALITATIVE: 'quantified_qualitative',
  // 类型2：无来源的精确数值（精确到个位但无 source 字段）
  UNSOURCED_PRECISION: 'unsourced_precision',
  // 类型3：无公式支撑的复合指标（"加权""综合"但无权重/函数）
  BLACKBOX_COMPOSITE: 'blackbox_composite',
  // 类型4：跨文件/跨字段数据矛盾
  CROSS_INCONSISTENCY: 'cross_inconsistency',
  // 类型5：分类口径混乱（如频段 Ka波段/Ka 重复）
  CATEGORY_CHAOS: 'category_chaos',
};

// ---------- 伪数据识别规则 ----------
// 每条规则定义：检测位置、伪数据类型、判定条件、处理策略
export const PSEUDO_RULES = [
  {
    id: 'P001',
    file: 'chain.json',
    path: 'chainRadar',
    type: PSEUDO_TYPES.QUANTIFIED_QUALITATIVE,
    description: '五链综合发展力雷达图 25 个分值：定性评估以 0-100 精确分值呈现，无公式、无权重、无原始指标、无独立来源',
    detection: (block) => {
      if (!block || !block.data) return false;
      // 25 个分值全部为 50-95 区间的整数 → 典型定性打分
      const allValues = block.data.flatMap((d) => d.values);
      return allValues.length === 25 && allValues.every((v) => Number.isInteger(v) && v >= 50 && v <= 100);
    },
    strategy: 'downgrade', // 降级为相对评级（高/中/低）
    downgradeFn: (value) => {
      if (value >= 85) return '高';
      if (value >= 70) return '中';
      return '低';
    },
  },
  {
    id: 'P002',
    file: 'chain.json',
    path: 'chainStageMatrix',
    type: PSEUDO_TYPES.UNSOURCED_PRECISION,
    description: '上中下游产值占比（如 35/40/25）：精确到个位但无独立来源、无计算口径',
    detection: (block) => {
      if (!Array.isArray(block)) return false;
      return block.every((row) => ['上游', '中游', '下游'].every((k) => Number.isInteger(row[k]) && row[k] >= 0 && row[k] <= 100));
    },
    strategy: 'downgrade', // 降级为相对等级
    downgradeFn: (value) => {
      if (value >= 40) return '高';
      if (value >= 25) return '中';
      return '低';
    },
  },
  {
    id: 'P003',
    file: 'chain.json',
    path: 'supplyLinks',
    type: PSEUDO_TYPES.UNSOURCED_PRECISION,
    description: '供应链关联强度值（1-50）：无单位、无计算方法、无来源',
    detection: (block) => {
      if (!Array.isArray(block)) return false;
      return block.every((link) => Number.isInteger(link.value) && link.value > 0 && link.value <= 100);
    },
    strategy: 'downgrade',
    downgradeFn: (value) => {
      if (value >= 35) return '强';
      if (value >= 20) return '中';
      return '弱';
    },
  },
  {
    id: 'P004',
    file: 'chain.json',
    path: 'chainComparison[policy].metrics[政策力度]',
    type: PSEUDO_TYPES.BLACKBOX_COMPOSITE,
    description: '政策力度系数 9.0/10：力度系数定义完全缺失，无计算公式',
    detection: (block) => {
      if (!Array.isArray(block)) return false;
      const policy = block.find((c) => c.key === 'policy');
      if (!policy) return false;
      const m = policy.metrics.find((x) => x.label && x.label.includes('政策力度'));
      return m && m.value === '9.0';
    },
    strategy: 'remove', // 删除该指标
  },
  {
    id: 'P005',
    file: 'policy.json',
    path: 'policyWordFreq',
    type: PSEUDO_TYPES.UNSOURCED_PRECISION,
    description: '政策词频统计 20 个词频值：未声明语料范围、分词工具、停用词表',
    detection: (block) => {
      if (!Array.isArray(block)) return false;
      return block.length > 0 && block.every((item) => Number.isInteger(item.value) && item.value > 0) && !block.source;
    },
    strategy: 'recompute', // 从政策文本重新计算
  },
  {
    id: 'P006',
    file: 'policy.json',
    path: 'policyCompare',
    type: PSEUDO_TYPES.UNSOURCED_PRECISION,
    description: '政策对比表：定性对比文字但无来源标注',
    detection: (block) => Array.isArray(block) && block.length > 0,
    strategy: 'mark_unverified', // 标记为待核实
  },
  {
    id: 'P007',
    file: 'industry.json',
    path: 'financingStructure2025',
    type: PSEUDO_TYPES.CROSS_INCONSISTENCY,
    description: '融资结构三类合计 184.1 亿 ≠ 2025 年融资总额 186 亿（差 1.9 亿无说明）',
    detection: (block, ctx) => {
      if (!block || !block.amounts) return false;
      const sum = block.amounts.reduce((a, b) => a + b, 0);
      return ctx.financing2025Total != null && Math.abs(sum - ctx.financing2025Total) > 0.5 && Math.abs(sum - ctx.financing2025Total) < 10;
    },
    strategy: 'fix', // 补"其他"条目
  },
  {
    id: 'P008',
    file: 'constellations.json',
    path: 'frequencyStats',
    type: PSEUDO_TYPES.CATEGORY_CHAOS,
    description: '频段统计口径混乱：Ka波段(11)与Ka(4)、Ku波段(4)与Ku(3) 重复分类',
    detection: (block) => {
      if (!Array.isArray(block)) return false;
      const names = block.map((b) => b.band);
      const hasKaBand = names.includes('Ka波段');
      const hasKa = names.includes('Ka');
      const hasKuBand = names.includes('Ku波段');
      const hasKu = names.includes('Ku');
      return (hasKaBand && hasKa) || (hasKuBand && hasKu);
    },
    strategy: 'recompute', // 重新归类合并
  },
  {
    id: 'P009',
    file: 'rockets.json',
    path: 'rockets',
    type: PSEUDO_TYPES.UNSOURCED_PRECISION,
    description: '火箭条目无独立 source 字段（source=公开信息综合整理 无法追溯）',
    detection: (block) => {
      if (!Array.isArray(block)) return false;
      return block.some((r) => !r.source);
    },
    strategy: 'mark_unverified', // 批量标记 verified:false
  },
  {
    id: 'P010',
    file: 'constellations.json',
    path: 'constellations',
    type: PSEUDO_TYPES.UNSOURCED_PRECISION,
    description: '星座条目无独立 source 字段',
    detection: (block) => {
      if (!Array.isArray(block)) return false;
      return block.some((c) => !c.source);
    },
    strategy: 'mark_unverified',
  },
  {
    id: 'P011',
    file: 'dashboard.json',
    path: 'milestones',
    type: PSEUDO_TYPES.UNSOURCED_PRECISION,
    description: '里程碑条目无 source 字段',
    detection: (block) => {
      if (!Array.isArray(block)) return false;
      return block.some((m) => !m.source);
    },
    strategy: 'mark_unverified',
  },
  {
    id: 'P012',
    file: 'industry.json',
    path: 'roundStats',
    type: PSEUDO_TYPES.UNSOURCED_PRECISION,
    description: '轮次统计无独立 source 字段',
    detection: (block, ctx) => {
      if (!Array.isArray(block)) return false;
      return !block.source; // 派生统计无独立来源
    },
    strategy: 'mark_derived', // 标记为"由 financingEvents 派生"
  },
  {
    id: 'P013',
    file: 'industry.json',
    path: 'segmentStats',
    type: PSEUDO_TYPES.UNSOURCED_PRECISION,
    description: '细分赛道统计无独立 source 字段',
    detection: (block) => Array.isArray(block) && !block.source,
    strategy: 'mark_derived',
  },
  {
    id: 'P014',
    file: 'chain.json',
    path: 'enterpriseMatrix',
    type: PSEUDO_TYPES.UNSOURCED_PRECISION,
    description: '企业矩阵数据无独立来源标注',
    detection: (block) => Array.isArray(block),
    strategy: 'mark_unverified',
  },
];

// ---------- 降级映射函数 ----------
// 将伪量化数值降级为相对评级，避免伪精确
export function downgradeValue(value, thresholds = { high: 85, mid: 70 }) {
  if (typeof value !== 'number') return value;
  if (value >= thresholds.high) return '高';
  if (value >= thresholds.mid) return '中';
  return '低';
}

// ---------- 数据完整性评估 ----------
// 评估清理后各文件的数据缺失情况
export const COMPLETENESS_CHECKS = {
  'rockets.json': {
    requiredFields: ['name', 'abbr', 'org', 'propellant', 'diameter', 'leo', 'reusable', 'site', 'launches', 'firstFlight', 'status', 'successRate'],
    optionalFields: ['gto', 'costPerKg', 'source', 'sourceUrl'],
    nullableFields: ['gto', 'costPerKg'], // 允许为 null
  },
  'constellations.json': {
    requiredFields: ['name', 'company', 'type', 'planned', 'actual', 'orbit', 'frequency', 'firstLaunch', 'status'],
    optionalFields: ['satWeight', 'source', 'sourceUrl'],
    nullableFields: ['satWeight'],
  },
  'policy.json': {
    requiredFields: ['id', 'title', 'date', 'org', 'summary', 'type', 'source'],
    optionalFields: ['sourceUrl', 'verified'],
  },
  'industry.json': {
    requiredFields: ['date', 'company', 'round', 'amount', 'segment', 'investors', 'region'],
    listPath: 'financingEvents',
  },
};

// ---------- 扫描伪数据 ----------
// 返回 { ruleId, file, path, type, description, entryCount }[]
export function scanPseudoData(allData) {
  const findings = [];
  for (const rule of PSEUDO_RULES) {
    // 统一处理文件名（去掉 .json 后缀以匹配 allData 的 key）
    const fileKey = rule.file.replace('.json', '');
    const data = allData[fileKey];
    if (!data) continue;
    // 获取检测目标
    let target;
    if (rule.path.includes('[')) {
      // 复杂路径如 chainComparison[policy].metrics[政策力度]
      if (rule.path.startsWith('chainComparison')) {
        target = data.chainComparison;
      } else {
        target = data;
      }
    } else {
      target = data[rule.path];
    }
    // 上下文（如 financing2025Total）
    const ctx = {};
    if (rule.file === 'industry.json' && allData.industry?.financingData?.amounts) {
      ctx.financing2025Total = allData.industry.financingData.amounts[allData.industry.financingData.amounts.length - 2]; // 2025年
    }
    try {
      if (rule.detection(target, ctx)) {
        let entryCount = 0;
        if (Array.isArray(target)) entryCount = target.length;
        else if (target?.data) entryCount = target.data.length;
        else if (target?.amounts) entryCount = target.amounts.length;
        findings.push({
          ruleId: rule.id,
          file: rule.file,
          path: rule.path,
          type: rule.type,
          description: rule.description,
          strategy: rule.strategy,
          entryCount,
        });
      }
    } catch (e) {
      // 检测出错跳过
    }
  }
  return findings;
}
