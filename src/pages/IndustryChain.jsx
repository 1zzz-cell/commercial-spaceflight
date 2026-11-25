import { useState, useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { useData } from '../context/DataContext';
import { useChinaMap } from '../hooks/useChinaMap';
import Icon from '../components/Icon';
import FreshnessBadge from '../components/FreshnessBadge';
import { buildToolbox } from '../utils/chartTools';

const COLORS = {
  blue: '#2563eb',
  purple: '#8b5cf6',
  orange: '#f06235',
  green: '#10b981',
  cyan: '#06b6d4',
  amber: '#f59e0b',
  gridLine: 'rgba(148, 163, 184, 0.15)',
  axisLabel: '#475569',
  tooltipBg: 'rgba(255,255,255,0.96)',
};

const stageColorMap = {
  上游: COLORS.blue,
  中游: COLORS.purple,
  下游: COLORS.orange,
};

const facilityTypeColor = {
  发射场: COLORS.orange,
  '发射场/园区': COLORS.purple,
  产业园: COLORS.blue,
  制造基地: COLORS.green,
  研发中心: COLORS.cyan,
};

const siteTypeColor = {
  国家发射场: COLORS.blue,
  商业发射场: COLORS.orange,
  海上发射母港: COLORS.cyan,
};

/* ---------- 2025年各发射场发射次数（横向条形图） ---------- */
function LaunchSiteBarChart({ launchSites }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);

    // 横向条形图自下而上渲染，按次数降序展示需先反转
    const sites = [...launchSites.sites].sort((a, b) => a.launches - b.launches);

    const option = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: COLORS.tooltipBg,
        borderColor: 'rgba(13,138,240,0.25)',
        textStyle: { color: '#1a1f36' },
        formatter: (params) => {
          const s = sites[params[0].dataIndex];
          return `<b>${s.name}</b>（${s.type}）<br/>2025年发射：<b>${s.launches}</b> 次<br/><span style="color:#64748b;font-size:11px">${s.note}</span>`;
        },
      },
      grid: { left: 150, right: 60, top: 24, bottom: 36 },
      xAxis: {
        type: 'value',
        name: '发射次数',
        nameTextStyle: { color: COLORS.axisLabel, fontSize: 12 },
        axisLabel: { color: COLORS.axisLabel },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: COLORS.gridLine } },
      },
      yAxis: {
        type: 'category',
        data: sites.map((s) => s.name),
        axisLabel: { color: COLORS.axisLabel, fontSize: 12 },
        axisLine: { lineStyle: { color: 'rgba(203, 213, 225, 0.5)' } },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: sites.map((s) => ({
            value: s.launches,
            itemStyle: { color: siteTypeColor[s.type] || COLORS.blue, borderRadius: [0, 4, 4, 0] },
          })),
          barWidth: '55%',
          label: {
            show: true,
            position: 'right',
            color: '#475569',
            fontSize: 12,
            formatter: '{c} 次',
          },
        },
      ],
      toolbox: buildToolbox(instanceRef.current, () => option, {
        filename: '2025各发射场发射次数',
        zoom: false,
        csv: {
          headers: ['发射场', '类型', '2025年发射(次)', '经度', '纬度', '备注'],
          rows: [...sites].reverse().map((s) => [s.name, s.type, s.launches, s.coord[0], s.coord[1], s.note || '']),
          source: launchSites.source,
          caliber: `2025年境内入轨发射统计口径，六场合计${launchSites.sites.reduce((n, s) => n + s.launches, 0)}次；海阳为海上发射母港口径`,
        },
      }),
    };

    // 注意：更新时使用默认 merge，禁止 notMerge:true
    instanceRef.current.setOption(option);
    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      instanceRef.current?.dispose();
    };
  }, [launchSites]);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-title">2025年各发射场发射次数</h3>
        <p className="chart-desc">
          全年境内入轨发射共 {launchSites.totalLaunches} 次，六处发射场合计 {launchSites.sites.reduce((n, s) => n + s.launches, 0)} 次；其中商业航天发射 {launchSites.commercialLaunches} 次
        </p>
      </div>
      <div ref={chartRef} className="chart-container" style={{ height: '360px' }} />
      <div className="chart-source">
        数据来源：{launchSites.source}
      </div>
    </div>
  );
}

/* ---------- 2025年发射场分布地图 ---------- */
function LaunchSiteMap({ launchSites, geoSource }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);
  const { ready, error, mapName } = useChinaMap();

  useEffect(() => {
    if (!ready || !chartRef.current) return undefined;
    instanceRef.current = echarts.init(chartRef.current);

    const types = Object.keys(siteTypeColor);

    // 海南两场相距仅约 4km，全国尺度下两点屏幕位置几乎重合、标签互相叠印。
    // 通过 labelLayout 回调强制两标签垂直分离（北场上移、南场下移）；
    // 放大地图后两点本身也会自然分开。
    const labelDyByName = {
      中国文昌航天发射场: -17,
      海南商业航天发射场: 17,
    };

    const series = types.map((type) => {
      const items = launchSites.sites.filter((s) => s.type === type);
      return {
      name: type,
      type: 'effectScatter',
      coordinateSystem: 'geo',
      data: items.map((s) => ({
        name: s.name,
        value: [...s.coord, s.launches],
        note: s.note,
      })),
      symbolSize: (val) => Math.max(10, val[2] * 0.9),
      rippleEffect: { brushType: 'stroke', scale: 3.2 },
      itemStyle: {
        color: siteTypeColor[type],
        borderColor: '#ffffff',
        borderWidth: 1.5,
        shadowBlur: 8,
        shadowColor: 'rgba(0,0,0,0.25)',
      },
      label: {
        show: true,
        position: 'right',
        distance: 6,
        formatter: '{b}',
        color: '#334155',
        fontSize: 11,
        textBorderColor: '#fff',
        textBorderWidth: 2,
      },
      // labelLayout 直接作用于最终标签位置，比 data.label.dy 更可靠
      labelLayout: (params) => {
        const site = items[params.dataIndex];
        const dy = site && labelDyByName[site.name];
        return dy ? { dy } : {};
      },
      emphasis: { scale: 1.2 },
      zlevel: 2,
      };
    });

    const option = {
      tooltip: {
        backgroundColor: COLORS.tooltipBg,
        borderColor: 'rgba(13,138,240,0.25)',
        textStyle: { color: '#1a1f36' },
        formatter: (p) =>
          `<b>${p.name}</b><br/>2025年发射：<b>${p.value[2]}</b> 次<br/><span style="color:#64748b;font-size:11px;max-width:240px">${p.data.note}</span>`,
      },
      legend: {
        orient: 'vertical',
        right: 16,
        top: 24,
        itemGap: 14,
        padding: [12, 14],
        backgroundColor: 'rgba(255,255,255,0.92)',
        borderColor: 'rgba(148,163,184,0.25)',
        borderWidth: 1,
        borderRadius: 8,
        shadowColor: 'rgba(15,23,42,0.08)',
        shadowBlur: 10,
        textStyle: { color: COLORS.axisLabel, fontSize: 12 },
        data: types,
        // 独立到最上层 canvas，避免散点波纹层压住图例首项
        zlevel: 3,
      },
      geo: {
        map: mapName,
        roam: true,
        zoom: 1.15,
        center: [108, 34],
        // 限制缩放范围，防止误操作把地图缩没或放过大
        scaleLimit: { min: 0.9, max: 8 },
        label: { show: false },
        itemStyle: { areaColor: '#eef3fb', borderColor: '#b7c8e6', borderWidth: 0.8 },
        emphasis: {
          label: { show: false },
          itemStyle: { areaColor: '#dbeafe' },
        },
      },
      series,
      // 地图工具箱：SSR 无法导出 SVG（未 registerMap）；框选缩放不适用 geo（地图本身支持滚轮缩放拖拽）
      // 图例固定在右上角，工具箱移至右下角避免叠压
      toolbox: {
        ...buildToolbox(instanceRef.current, () => option, {
          filename: '发射场空间分布2025',
          zoom: false,
          svg: false,
          csv: {
            headers: ['发射场', '类型', '2025年发射(次)', '经度', '纬度', '备注'],
            rows: launchSites.sites.map((s) => [s.name, s.type, s.launches, s.coord[0], s.coord[1], s.note || '']),
            source: `${launchSites.source}；底图：${geoSource.name}`,
          },
        }),
        top: 'auto',
        bottom: 14,
      },
    };

    // 注意：默认 merge，禁止 notMerge:true（会删除 geo 组件导致地图消失）
    instanceRef.current.setOption(option);
    const handleResize = () => instanceRef.current?.resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [ready, launchSites, mapName]);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <h3 className="chart-title">发射场空间分布（2025年）</h3>
        <p className="chart-desc">气泡大小对应该发射场 2025 年发射次数，可缩放拖拽查看；蓝色为国家发射场，橙色为商业发射场，青色为海上发射母港</p>
      </div>
      <div style={{ position: 'relative', height: '520px' }}>
        <div ref={chartRef} className="chart-container" style={{ height: '520px' }} />
        {!ready && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.8)', color: '#94a3b8', zIndex: 5,
          }}>
            {error ? <span style={{ color: '#ef4444' }}>{error}</span> : '地图底图加载中…'}
          </div>
        )}
      </div>
      <div className="chart-source">
        底图：{geoSource.name}（{geoSource.note}）；发射数据：{launchSites.source}
      </div>
    </div>
  );
}

/* ---------- 产业链阶段卡片 ---------- */
function StageCard({ stage, index, total }) {
  return (
    <div className="chain-stage-card" style={{ '--stage-color': stage.color }}>
      <div className="chain-stage-header">
        <span className="chain-stage-badge">{stage.stage}</span>
        <h3 className="chain-stage-name">{stage.name}</h3>
      </div>
      <p className="chain-stage-desc">{stage.desc}</p>
      <div className="chain-stage-segments">
        {stage.segments.map((s) => (
          <span key={s} className="chain-segment-tag">{s}</span>
        ))}
      </div>
      <div className="chain-stage-companies">
        <span className="chain-companies-label">代表企业：</span>
        {stage.keyCompanies.map((c) => (
          <span key={c} className="chain-company-chip">{c}</span>
        ))}
      </div>
      {index < total - 1 && (
        <div className="chain-stage-arrow" aria-hidden="true">
          <Icon name="chevron-down" size="lg" />
        </div>
      )}
    </div>
  );
}

/* ---------- 企业矩阵 ---------- */
function EnterpriseMatrix({ enterpriseMatrix }) {
  return (
    <div className="section">
      <h2 className="section-title">产业链代表企业矩阵</h2>
      <p className="section-subtitle">按上中下游与业务领域梳理的核心企业</p>
      <div className="enterprise-matrix">
        {enterpriseMatrix.map((group) => (
          <div key={`${group.stage}-${group.category}`} className="enterprise-matrix-group">
            <div className="enterprise-matrix-header">
              <span
                className="enterprise-stage-dot"
                style={{ background: stageColorMap[group.stage] }}
              />
              <span className="enterprise-stage-label">{group.stage}</span>
              <span className="enterprise-category">{group.category}</span>
            </div>
            <div className="enterprise-list">
              {group.companies.map((c) => (
                <div key={c.name} className="enterprise-item">
                    <div className="enterprise-name">
                      {c.officialUrl ? <a href={c.officialUrl} target="_blank" rel="noreferrer">{c.name} ↗</a> : c.name}
                    </div>
                  <div className="enterprise-meta">
                    <span>{c.focus}</span>
                    <span className="enterprise-region">{c.region}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 生产基地 / 园区 ---------- */
function FacilitySection({ facilityList }) {
  return (
    <div className="section">
      <h2 className="section-title">生产基地与产业园区</h2>
      <p className="section-subtitle">发射场、制造基地与产业集聚区的空间布局</p>
      <div className="facility-grid">
        {facilityList.map((f) => (
          <div key={f.name} className="facility-card">
            <div className="facility-card-top">
              <span
                className="facility-type-tag"
                style={{
                  background: (facilityTypeColor[f.type] || COLORS.blue) + '18',
                  color: facilityTypeColor[f.type] || COLORS.blue,
                }}
              >
                {f.type}
              </span>
              <span className="facility-region">{f.region}</span>
            </div>
            <h3 className="facility-name">{f.name}</h3>
            <p className="facility-desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 页面主组件 ---------- */
const anchorSections = [
  { id: 'stages', label: '上中下游' },
  { id: 'launches', label: '发射场次' },
  { id: 'sitemap', label: '发射场分布' },
  { id: 'enterprises', label: '企业矩阵' },
  { id: 'facilities', label: '生产基地' },
];

function IndustryChain() {
  const { chain, geo } = useData();
  const { industryStages, enterpriseMatrix, facilityList, chainSource } = chain;
  const { launchSites2025, geoSource } = geo;
  const [activeAnchor, setActiveAnchor] = useState('stages');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveAnchor(entry.target.id);
        });
      },
      { rootMargin: '-80px 0px -70% 0px' }
    );
    anchorSections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="page-container ds-page">
      <section className="page-header">
        <h1 className="page-title">企业与产业链</h1>
        <p className="page-desc">
          纵向梳理中国商业航天上中下游价值链，并以 2025 年各发射场真实发射数据与空间分布呈现产业落地格局。
        </p>
        <FreshnessBadge fileKey="chain" source="数据来源：公开信息综合整理" />
      </section>

      <nav className="anchor-nav">
        {anchorSections.map((s) => (
          <button
            key={s.id}
            className={`anchor-nav-item ${activeAnchor === s.id ? 'active' : ''}`}
            onClick={() => scrollTo(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <section className="section" id="stages">
        <h2 className="section-title">产业链上中下游</h2>
        <p className="section-subtitle">从基础供应到终端应用的全价值链梳理</p>
        <div className="chain-stages-row">
          {industryStages.map((stage, idx) => (
            <StageCard key={stage.stage} stage={stage} index={idx} total={industryStages.length} />
          ))}
        </div>
      </section>

      <section className="section" id="launches">
        <LaunchSiteBarChart launchSites={launchSites2025} />
      </section>

      <section className="section" id="sitemap">
        <LaunchSiteMap launchSites={launchSites2025} geoSource={geoSource} />
      </section>

      <section id="enterprises">
        <EnterpriseMatrix enterpriseMatrix={enterpriseMatrix.data} />
      </section>

      <section id="facilities">
        <FacilitySection facilityList={facilityList} />
      </section>

      <div className="data-source-note">
        <p>产业链结构来源：{chainSource}</p>
        <p>
          发射数据来源：{launchSites2025.source}
          {launchSites2025.sourceUrls?.map((u) => (
            <span key={u}> · <a className="ds-wrap-url" href={u} target="_blank" rel="noreferrer">{u}</a></span>
          ))}
        </p>
        <p>底图来源：{geoSource.name}（审图号见底图发布方；地图仅作空间分布示意）</p>
      </div>
    </div>
  );
}

export default IndustryChain;
