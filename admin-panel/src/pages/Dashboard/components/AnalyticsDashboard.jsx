import { useEffect, useState, useContext, useRef } from 'react';
import { Database, TrendingUp, BarChart3, PieChart, Layers, HelpCircle, Activity } from 'lucide-react';
import { AuthContext } from '../../../context/AuthContext';
import { fetchWithAuth } from '../../../utils/api';

export default function AnalyticsDashboard() {
  const { sessionId } = useContext(AuthContext);
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState([]);

  // Data for visual widgets
  const [kpis, setKpis] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [barData, setBarData] = useState([]);
  const [donutData, setDonutData] = useState([]);
  const [pivotData, setPivotData] = useState([]);
  const [rowHeaders, setRowHeaders] = useState([]);
  const [colHeaders, setColHeaders] = useState([]);
  const [heatmapTitle, setHeatmapTitle] = useState('Segment Distribution Heatmap');
  const [healthStats, setHealthStats] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null); // { column, value }
  const [slicerColumn, setSlicerColumn] = useState(null);
  const [filterOptions, setFilterOptions] = useState([]);
  const lastLoadedTable = useRef(null);

  // Fetch all tables on load
  useEffect(() => {
    const loadTables = async () => {
      try {
        const res = await fetchWithAuth(`/tables/${sessionId}`);
        if (res.success && res.tables.length > 0) {
          setTables(res.tables);
          setSelectedTable(res.tables[0]); // default to first table
        }
      } catch (err) {
        console.error("Failed to load tables:", err);
      } finally {
        setLoading(false);
      }
    };
    if (sessionId) loadTables();
  }, [sessionId]);

  // Reset filter on table switch
  useEffect(() => {
    setActiveFilter(null);
    setFilterOptions([]);
    setSlicerColumn(null);
    setHealthStats(null);
  }, [selectedTable]);

  // Fetch metadata and aggregate dynamic dashboard items when table or activeFilter changes
  useEffect(() => {
    if (!selectedTable || !sessionId) return;

    const loadAnalytics = async () => {
      setLoading(true);
      try {
        // Fetch health stats
        try {
          const healthRes = await fetchWithAuth(`/table/${sessionId}/${selectedTable}/health`);
          if (healthRes.success) {
            setHealthStats(healthRes.stats);
          }
        } catch (e) {
          console.error("Failed to load table health:", e);
        }

        // 1. Fetch column metadata classification
        const metaRes = await fetchWithAuth(`/table/${sessionId}/${selectedTable}/metadata`);
        if (!metaRes.success) return;

        const cols = metaRes.columns;
        setMetadata(cols);

        // Discovered Semantics
        const identifierCol = cols.find(c => c.classification === 'IDENTIFIER') || cols[0];
        const measureCol = cols.find(c => c.classification === 'MEASURE') || cols.find(c => c.classification === 'IDENTIFIER') || cols[0];
        const temporalCol = cols.find(c => c.classification === 'DIMENSION_TEMPORAL');
        const categoricalCol = cols.find(c => c.classification === 'DIMENSION_CATEGORICAL') || cols.find(c => c.classification === 'IDENTIFIER') || cols[0];

        // Populate slicer options on table switch
        if (categoricalCol && lastLoadedTable.current !== selectedTable) {
          setSlicerColumn(categoricalCol.column_name);
          try {
            const slicerAgg = await fetchWithAuth(`/table/${sessionId}/${selectedTable}/aggregate`, {
              method: 'POST',
              body: JSON.stringify({
                groupBy: categoricalCol.column_name,
                aggregateCol: identifierCol.column_name,
                aggregateFunc: 'COUNT'
              })
            });
            if (slicerAgg.success) {
              setFilterOptions(slicerAgg.data.map(d => d.group_key).slice(0, 10)); // Limit to top 10 slicer values
              lastLoadedTable.current = selectedTable;
            }
          } catch (e) { }
        }

        // Build filter payload parameters
        const filterParams = activeFilter ? {
          filterCol: activeFilter.column,
          filterVal: activeFilter.value
        } : {};

        // 2. Fetch KPI aggregates concurrently
        const kpiList = [];

        // KPI 1: Total Records Count
        try {
          const r1 = await fetchWithAuth(`/table/${sessionId}/${selectedTable}/aggregate`, {
            method: 'POST',
            body: JSON.stringify({
              groupBy: identifierCol.column_name,
              aggregateCol: identifierCol.column_name,
              aggregateFunc: 'COUNT',
              ...filterParams
            })
          });
          const totalRecords = r1.data.reduce((acc, curr) => acc + curr.val, 0);
          kpiList.push({
            title: `Total ${selectedTable.toUpperCase()}`,
            value: totalRecords >= 1000 ? `${(totalRecords / 1000).toFixed(1)}K` : totalRecords,
            subtitle: `Unique records tracked`,
            color: 'var(--accent-primary)'
          });
        } catch (e) { }

        // KPI 2: Measure Sum
        if (measureCol) {
          try {
            const r2 = await fetchWithAuth(`/table/${sessionId}/${selectedTable}/aggregate`, {
              method: 'POST',
              body: JSON.stringify({
                groupBy: categoricalCol.column_name,
                aggregateCol: measureCol.column_name,
                aggregateFunc: 'SUM',
                ...filterParams
              })
            });
            const sumVal = r2.data.reduce((acc, curr) => acc + curr.val, 0);
            kpiList.push({
              title: `Total ${measureCol.column_name.toUpperCase()}`,
              value: sumVal >= 1000000 ? `$${(sumVal / 1000000).toFixed(1)}M` : sumVal >= 1000 ? `${(sumVal / 1000).toFixed(1)}K` : sumVal,
              subtitle: `Cumulative volume calculated`,
              color: 'var(--success)'
            });
          } catch (e) { }

          // KPI 3: Measure Average
          try {
            const r3 = await fetchWithAuth(`/table/${sessionId}/${selectedTable}/aggregate`, {
              method: 'POST',
              body: JSON.stringify({
                groupBy: categoricalCol.column_name,
                aggregateCol: measureCol.column_name,
                aggregateFunc: 'AVG',
                ...filterParams
              })
            });
            const avgVal = r3.data.length > 0 ? (r3.data.reduce((acc, curr) => acc + curr.val, 0) / r3.data.length) : 0;
            kpiList.push({
              title: `Avg. ${measureCol.column_name.toUpperCase()}`,
              value: avgVal >= 1000 ? `${(avgVal / 1000).toFixed(1)}K` : avgVal.toFixed(1),
              subtitle: `Average scale per group`,
              color: '#38bdf8'
            });
          } catch (e) { }
        }
        setKpis(kpiList);

        // 3. Fetch Trend Data (group by Temporal, SUM of Measure)
        if (temporalCol && measureCol) {
          try {
            const trendRes = await fetchWithAuth(`/table/${sessionId}/${selectedTable}/aggregate`, {
              method: 'POST',
              body: JSON.stringify({
                groupBy: temporalCol.column_name,
                aggregateCol: measureCol.column_name,
                aggregateFunc: 'SUM',
                ...filterParams
              })
            });
            // Sort by year/date key ascending
            const sorted = trendRes.data.sort((a, b) => a.group_key.localeCompare(b.group_key));
            setTrendData(sorted);
          } catch (e) { }
        } else {
          setTrendData([]);
        }

        // 4. Fetch Bar Distribution Data (group by Categorical, COUNT of Identifiers)
        if (categoricalCol && identifierCol) {
          try {
            const barRes = await fetchWithAuth(`/table/${sessionId}/${selectedTable}/aggregate`, {
              method: 'POST',
              body: JSON.stringify({
                groupBy: categoricalCol.column_name,
                aggregateCol: identifierCol.column_name,
                aggregateFunc: 'COUNT',
                ...filterParams
              })
            });
            setBarData(barRes.data.slice(0, 8)); // Top 8 items
          } catch (e) { }
        }

        // 5. Fetch Donut Distribution Data (group by Categorical, SUM of Measures)
        if (categoricalCol && measureCol) {
          try {
            const donutRes = await fetchWithAuth(`/table/${sessionId}/${selectedTable}/aggregate`, {
              method: 'POST',
              body: JSON.stringify({
                groupBy: categoricalCol.column_name,
                aggregateCol: measureCol.column_name,
                aggregateFunc: 'SUM',
                ...filterParams
              })
            });
            setDonutData(donutRes.data.slice(0, 5)); // Top 5 categories
          } catch (e) { }
        }

        // 6. Fetch Pivot Heatmap Data
        const possibleCols = cols.filter(c => c.column_name !== categoricalCol.column_name);
        const secondCol = possibleCols.find(c => c.classification === 'DIMENSION_TEMPORAL') ||
          possibleCols.find(c => c.classification === 'DIMENSION_CATEGORICAL') ||
          possibleCols.find(c => c.classification === 'IDENTIFIER') ||
          possibleCols[0];

        if (categoricalCol && secondCol && identifierCol) {
          try {
            setHeatmapTitle(`${categoricalCol.column_name.toUpperCase()} vs. ${secondCol.column_name.toUpperCase()} Intensity`);
            const pivotRes = await fetchWithAuth(`/table/${sessionId}/${selectedTable}/pivot`, {
              method: 'POST',
              body: JSON.stringify({
                rowCol: categoricalCol.column_name,
                colCol: secondCol.column_name,
                aggregateCol: identifierCol.column_name,
                aggregateFunc: 'COUNT',
                ...filterParams
              })
            });
            if (pivotRes.success && pivotRes.data.length > 0) {
              const rowsSet = new Set();
              const colsSet = new Set();
              pivotRes.data.forEach(d => {
                rowsSet.add(d.row_key);
                colsSet.add(d.col_key);
              });
              setPivotData(pivotRes.data);
              setRowHeaders(Array.from(rowsSet).slice(0, 6)); // limit to top 6 rows
              setColHeaders(Array.from(colsSet).slice(0, 6)); // limit to top 6 cols
            } else {
              setPivotData([]);
              setRowHeaders([]);
              setColHeaders([]);
            }
          } catch (e) {
            console.error("Failed to load pivot matrix:", e);
          }
        } else {
          setPivotData([]);
          setRowHeaders([]);
          setColHeaders([]);
        }

      } catch (err) {
        console.error("Failed to compile analytics dashboard details:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [selectedTable, sessionId, activeFilter]);

  // Compute SVG polygons for spline trend area chart
  const renderTrendSvg = () => {
    if (trendData.length === 0) return null;

    const width = 500;
    const height = 180;
    const padding = 30;

    const maxVal = Math.max(...trendData.map(d => d.val)) || 1;
    const minVal = Math.min(...trendData.map(d => d.val)) || 0;
    const valRange = maxVal - minVal || 1;

    const points = trendData.map((d, index) => {
      const x = padding + (index / (trendData.length - 1 || 1)) * (width - 2 * padding);
      const y = height - padding - ((d.val - minVal) / valRange) * (height - 2 * padding);
      return { x, y, label: d.group_key, val: d.val };
    });

    const pathD = points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');

    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="50%" stopColor="var(--accent-primary)" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.05)" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.05)" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.15)" strokeWidth={1} />

        {/* Filled Area */}
        <path d={areaD} fill="url(#areaGrad)" />

        {/* Line Path */}
        <path d={pathD} fill="none" stroke="url(#lineGrad)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />

        {/* Glowing Data Nodes */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={5} fill="var(--accent-primary)" stroke="white" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 0 4px var(--accent-primary))' }} />
            <text x={p.x} y={height - 8} fill="var(--text-secondary)" fontSize="10" textAnchor="middle" fontFamily="Inter, sans-serif">
              {p.label}
            </text>
            <text x={p.x} y={p.y - 12} fill="var(--text-primary)" fontSize="10" fontWeight="600" textAnchor="middle" fontFamily="Inter, sans-serif">
              {p.val >= 1000 ? `${(p.val / 1000).toFixed(1)}K` : p.val}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  // Render glowing Segmented SVG Donut Chart
  const renderDonutChart = () => {
    if (donutData.length === 0) return null;

    const totalVal = donutData.reduce((acc, curr) => acc + curr.val, 0) || 1;
    const colors = ['#6366f1', '#10b981', '#38bdf8', '#fbbf24', '#ec4899'];

    let accumulatedPercentage = 0;
    const segments = donutData.map((d, index) => {
      const percent = (d.val / totalVal) * 100;
      const startAngle = accumulatedPercentage;
      accumulatedPercentage += percent;
      return {
        ...d,
        percent,
        color: colors[index % colors.length]
      };
    });

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{ width: '160px', height: '160px', position: 'relative' }}>
          <svg width="100%" height="100%" viewBox="0 0 42 42" className="donut" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth="4" />
            {segments.map((seg, idx) => {
              const strokeDasharray = `${seg.percent} ${100 - seg.percent}`;
              // Offset calculation for correct circle segment placements
              const strokeDashoffset = 100 - segments.slice(0, idx).reduce((acc, curr) => acc + curr.percent, 0) + 25;
              return (
                <circle
                  key={idx}
                  cx="21"
                  cy="21"
                  r="15.915"
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth="4.5"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 0.3s ease' }}
                />
              );
            })}
          </svg>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>100%</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Volume</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, minWidth: '150px', overflow: 'hidden' }}>
          {segments.map((seg, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={seg.group_key}>
                  {seg.group_key}
                </span>
              </div>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>{seg.percent.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>

      {/* Header Selector Control */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Activity size={26} color="var(--accent-primary)" />
            Interactive Analytics Dashboard
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px', fontSize: '0.9rem' }}>
            Dynamic metadata-driven analysis classified by Dimensions & Measures
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Table Slicer:</span>
          <select
            className="form-input"
            style={{
              minWidth: '180px',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-primary)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
            disabled={tables.length === 0}
          >
            {tables.map(tbl => (
              <option key={tbl} value={tbl} style={{ background: '#111222' }}>{tbl.toUpperCase()}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Interactive Filter Slicer Row */}
      {filterOptions.length > 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '18px 24px',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            marginBottom: '24px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Layers size={16} color="var(--accent-primary)" />
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Interactive BI Category Slicer: {slicerColumn?.toUpperCase()}
              </span>
            </div>
            {activeFilter && (
              <button
                onClick={() => setActiveFilter(null)}
                style={{
                  fontSize: '0.75rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: 'none',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Clear Filter
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveFilter(null)}
              style={{
                background: !activeFilter ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                color: !activeFilter ? 'white' : 'var(--text-secondary)',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: !activeFilter ? '0 0 12px rgba(99, 102, 241, 0.3)' : 'none'
              }}
            >
              All Categories
            </button>
            {filterOptions.map(opt => (
              <button
                key={opt}
                onClick={() => setActiveFilter({ column: slicerColumn, value: opt })}
                style={{
                  background: activeFilter?.value === opt ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                  color: activeFilter?.value === opt ? 'white' : 'var(--text-secondary)',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: activeFilter?.value === opt ? '0 0 12px rgba(99, 102, 241, 0.3)' : 'none'
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && kpis.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh' }}>
          <h3 style={{ opacity: 0.6 }}>Analyzing table structures and assembling widgets...</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Summary KPIs Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
            {healthStats && (
              <div
                className="glass-panel"
                style={{
                  padding: '24px',
                  borderRadius: '16px',
                  borderLeft: `4px solid #fbbf24`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em' }}>
                    Schema Health
                  </span>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    {healthStats.integrityScore}%
                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: '#fbbf24' }}>
                      ({healthStats.sizeFormatted})
                    </span>
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {healthStats.indexCount} db index constraints
                  </span>
                </div>

                <div style={{ position: 'relative', width: '56px', height: '56px' }}>
                  <svg width="56" height="56" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="3"
                      strokeDasharray="100"
                      strokeDashoffset={100 - healthStats.integrityScore}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                    {healthStats.completenessScore}%
                  </div>
                </div>
              </div>
            )}

            {kpis.map((kpi, idx) => (
              <div
                key={idx}
                className="glass-panel"
                style={{
                  padding: '24px',
                  borderRadius: '16px',
                  borderLeft: `4px solid ${kpi.color}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.05em' }}>
                  {kpi.title}
                </span>
                <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {kpi.value}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {kpi.subtitle}
                </span>
              </div>
            ))}
          </div>

          {/* Main Visuals Grid Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', flexWrap: 'wrap' }} className="analytics-grid">

            {/* Horizontal Progress Bars: Group Distribution */}
            <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <BarChart3 size={20} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Distribution Breakdown</h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '280px', overflowY: 'auto', paddingRight: '8px' }}>
                {barData.length === 0 ? (
                  <div style={{ opacity: 0.5 }}>No categorizable dimensions found to segment.</div>
                ) : (
                  barData.map((item, idx) => {
                    const maxVal = Math.max(...barData.map(b => b.val)) || 1;
                    const percentWidth = (item.val / maxVal) * 100;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 500 }}>
                          <span style={{ color: 'var(--text-primary)' }}>{item.group_key}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{item.val} items</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${percentWidth}%`,
                              height: '100%',
                              background: 'linear-gradient(90deg, var(--accent-primary), #a78bfa)',
                              borderRadius: '4px',
                              boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)',
                              transition: 'width 0.5s ease-out'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Glowing Segment Donut Widget */}
            <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <PieChart size={20} color="#10b981" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Proportional Volume Share</h3>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '220px' }}>
                {donutData.length === 0 ? (
                  <div style={{ opacity: 0.5 }}>No aggregatable numeric measures available.</div>
                ) : (
                  renderDonutChart()
                )}
              </div>
            </div>

            {/* Glowing Spline Spline Trend Chart */}
            <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px', gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <TrendingUp size={20} color="var(--accent-primary)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Temporal Trends Analysis</h3>
              </div>

              <div style={{ height: '220px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0' }}>
                {trendData.length === 0 ? (
                  <div style={{ opacity: 0.5, textAlign: 'center' }}>
                    <Layers size={36} color="var(--text-secondary)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                    No temporal dimension column (like DATE, Year) found in this table to plot trends.
                  </div>
                ) : (
                  renderTrendSvg()
                )}
              </div>
            </div>

            {/* Matrix Segment Heatmap Widget */}
            <div className="glass-panel" style={{ padding: '28px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '20px', gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Layers size={20} color="#fbbf24" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>{heatmapTitle}</h3>
                </div>
                <span style={{ fontSize: '0.75rem', background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                  Pivot Heatmap
                </span>
              </div>

              {pivotData.length === 0 || rowHeaders.length === 0 || colHeaders.length === 0 ? (
                <div style={{ opacity: 0.5, textAlign: 'center', padding: '24px' }}>
                  No cross-tabulated segments available to visualize heatmap grid.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', padding: '4px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '12px', borderBottom: '1px solid var(--border-glass)', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Row / Col</th>
                        {colHeaders.map(col => (
                          <th key={col} style={{ padding: '12px', borderBottom: '1px solid var(--border-glass)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rowHeaders.map(row => (
                        <tr key={row}>
                          <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.02)', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {row}
                          </td>
                          {colHeaders.map(col => {
                            const match = pivotData.find(d => d.row_key === row && d.col_key === col);
                            const val = match ? match.val : 0;
                            const maxVal = Math.max(...pivotData.map(d => d.val)) || 1;
                            const intensity = maxVal > 0 ? (val / maxVal) : 0;

                            // Glowing gradient color scheme for matrix segments
                            const bgOpacity = intensity * 0.4 + 0.05;
                            const textColor = intensity > 0.5 ? 'white' : 'var(--text-secondary)';

                            return (
                              <td
                                key={col}
                                style={{
                                  padding: '8px',
                                  borderBottom: '1px solid rgba(255,255,255,0.02)',
                                  textAlign: 'center'
                                }}
                              >
                                <div
                                  style={{
                                    background: `rgba(99, 102, 241, ${bgOpacity})`,
                                    border: `1px solid rgba(99, 102, 241, ${intensity * 0.3})`,
                                    color: textColor,
                                    padding: '10px',
                                    borderRadius: '8px',
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    boxShadow: intensity > 0.7 ? '0 0 12px rgba(99, 102, 241, 0.2)' : 'none',
                                    transition: 'all 0.2s',
                                    cursor: 'help'
                                  }}
                                  title={`${row} x ${col} : ${val} items`}
                                >
                                  {val}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
