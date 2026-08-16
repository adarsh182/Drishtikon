import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { useConsultation } from '../context/ConsultationContext';
import { getComparison } from '../services/api';
import type { ComparisonData } from '../types';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { statusColor } from '../utils/format';
import {
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  AlertCircle,
  Activity,
} from 'lucide-react';

const COLORS = {
  Positive: '#059669', // emerald
  Negative: '#e11d48', // rose
  Neutral: '#64748b',  // slate
};

const VERSION_BAR_COLORS = ['#334155', '#475569', '#3b82f6', '#10b981'];

function getEvolutionExplanation(
  status: string,
  changePct: number,
  versionNegativePct: Record<string, number>,
  versions: string[]
): string {
  if (!versions || versions.length === 0) return 'Stakeholder concern tracked across drafts.';
  const firstV = versions[0];
  const lastV = versions[versions.length - 1];
  const firstNeg = versionNegativePct[firstV] ?? 0;
  const lastNeg = versionNegativePct[lastV] ?? 0;

  if (status === 'IMPROVED') {
    return `Negative concern decreased from ${firstNeg}% (${firstV}) down to ${lastNeg}% (${lastV}) — ${Math.abs(changePct)}% net reduction.`;
  }
  if (status === 'EMERGING') {
    return `New or escalating concern in later drafts (${lastNeg}% negative in ${lastV}).`;
  }
  if (status === 'WORSENED') {
    return `Negative concern increased from ${firstNeg}% (${firstV}) up to ${lastNeg}% (${lastV}) — +${changePct}% escalation.`;
  }
  if (changePct === 0) {
    return `Feedback volume and sentiment remained steady across all ${versions.length} draft versions.`;
  }
  return `Concern persisted at a steady level across draft iterations (${lastNeg}% negative in ${lastV}).`;
}

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white text-xs p-2.5 rounded shadow-xl border border-slate-700">
        <p className="font-semibold text-slate-200 mb-1.5 border-b border-slate-800 pb-1">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex items-center justify-between gap-4 text-[11px]">
              <span className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: entry.color || entry.fill || entry.stroke }}
                />
                <span className="text-slate-300">{entry.name}</span>
              </span>
              <span className="font-mono font-medium text-white">
                {typeof entry.value === 'number' && (entry.name.includes('%') || entry.dataKey?.includes('pct'))
                  ? `${entry.value}%`
                  : entry.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function PolicyEvolution() {
  const { selectedConsultationId, selectedConsultation, loading: contextLoading } = useConsultation();
  const [data, setData] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [loadingText, setLoadingText] = useState<string>('Connecting to PolicyLens analysis server...');

  const fetchEvolutionData = () => {
    if (!selectedConsultationId) return;
    setLoading(true);
    setError(null);
    setLoadingText('Connecting to PolicyLens analysis server...');

    const slowLoadTimer = setTimeout(() => {
      setLoadingText('The analysis server is starting. This may take a few moments.');
    }, 2500);

    getComparison(selectedConsultationId)
      .then((cmp) => {
        clearTimeout(slowLoadTimer);
        setData(cmp);
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(slowLoadTimer);
        setError(err.friendlyMessage || err?.response?.data?.detail || 'Unable to load evolution data.');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!selectedConsultationId) {
      if (!contextLoading) setLoading(false);
      return;
    }
    fetchEvolutionData();
  }, [selectedConsultationId, contextLoading]);

  if (contextLoading || loading) return <LoadingState message={loadingText} />;
  if (error) return <ErrorState message={error} onRetry={fetchEvolutionData} />;
  if (!selectedConsultationId || !data) {
    return (
      <div className="bg-white rounded border border-slate-200 p-8 text-center max-w-md mx-auto mt-12">
        <h2 className="text-sm font-semibold text-slate-800">No Consultation Selected</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Please select or upload a consultation to view policy evolution analysis.
        </p>
        <Link
          to="/upload"
          className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-3.5 py-2 rounded transition-colors"
        >
          Upload Consultation CSV
        </Link>
      </div>
    );
  }

  const versions = data.sentiment_by_version.map((v) => v.version);
  const filteredIssues =
    filterStatus === 'ALL'
      ? data.issue_evolution
      : data.issue_evolution.filter((i) => i.status === filterStatus);

  const issueChartData = data.issue_evolution.slice(0, 6).map((item) => {
    const entry: Record<string, any> = { issue: item.issue };
    for (const v of versions) {
      entry[v] = item.version_counts[v] || 0;
    }
    return entry;
  });

  const countByStatus = {
    IMPROVED: data.issue_evolution.filter((i) => i.status === 'IMPROVED').length,
    PERSISTENT: data.issue_evolution.filter((i) => i.status === 'PERSISTENT').length,
    EMERGING: data.issue_evolution.filter((i) => i.status === 'EMERGING').length,
    WORSENED: data.issue_evolution.filter((i) => i.status === 'WORSENED').length,
  };

  // Trajectory Summary Calculations
  const firstVersion = data.sentiment_by_version[0];
  const latestVersion = data.sentiment_by_version[data.sentiment_by_version.length - 1];
  const negativeDropPct =
    firstVersion && latestVersion
      ? Math.round(firstVersion.negative_pct - latestVersion.negative_pct)
      : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Policy Evolution</h2>
            <span className="text-xs font-medium text-slate-500 font-mono">
              ({versions.join(' → ')})
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Comparative analysis of stakeholder concerns across successive policy drafts for{' '}
            <strong className="font-medium text-slate-700">{selectedConsultation?.title || `Consultation #${selectedConsultationId}`}</strong>
          </p>
        </div>

        {/* Status Counts Summary */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
            {countByStatus.IMPROVED} Improved
          </span>
          <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium">
            {countByStatus.PERSISTENT} Persistent
          </span>
          <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-800 border border-blue-200 font-medium">
            {countByStatus.EMERGING} Emerging
          </span>
          <span className="px-2.5 py-1 rounded bg-rose-50 text-rose-800 border border-rose-200 font-medium">
            {countByStatus.WORSENED} Worsened
          </span>
        </div>
      </div>

      {/* Trajectory Insights Overview Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Concern Trajectory</div>
            <div className="text-sm font-semibold text-slate-900">
              {negativeDropPct >= 0 ? `${negativeDropPct}% Reduction in Negative Concern` : `${Math.abs(negativeDropPct)}% Increase in Negative Concern`}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              {firstVersion?.version} ({firstVersion?.negative_pct}% neg) → {latestVersion?.version} ({latestVersion?.negative_pct}% neg)
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0">
            <Activity size={18} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Draft Iterations</div>
            <div className="text-sm font-semibold text-slate-900">{versions.length} Sequential Drafts Evaluated</div>
            <div className="text-[11px] text-slate-500 font-mono">{versions.join(' ➔ ')}</div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3.5 flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={18} />
          </div>
          <div>
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Resolution Status</div>
            <div className="text-sm font-semibold text-slate-900">
              {countByStatus.IMPROVED} Issues Resolved · {countByStatus.PERSISTENT + countByStatus.EMERGING + countByStatus.WORSENED} Requiring Review
            </div>
            <div className="text-[11px] text-slate-500">Derived from multi-version sentiment progression</div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Graphs (Placed Above the Matrix Table) */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Overall Sentiment Trajectory Area Chart */}
        <div className="bg-white border border-slate-200 rounded p-4">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                Overall Sentiment Trajectory
              </h3>
              <p className="text-[11px] text-slate-400">Shift in Positive, Neutral, and Negative feedback across versions</p>
            </div>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              {versions.length} Drafts
            </span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.sentiment_by_version} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="posGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.Positive} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={COLORS.Positive} stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="negGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.Negative} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={COLORS.Negative} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="version" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <Area
                  type="monotone"
                  dataKey="positive_pct"
                  stroke={COLORS.Positive}
                  strokeWidth={2.5}
                  fill="url(#posGradient)"
                  name="Positive %"
                  dot={{ r: 3, fill: COLORS.Positive }}
                />
                <Line
                  type="monotone"
                  dataKey="neutral_pct"
                  stroke={COLORS.Neutral}
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  name="Neutral %"
                  dot={{ r: 2.5, fill: COLORS.Neutral }}
                />
                <Area
                  type="monotone"
                  dataKey="negative_pct"
                  stroke={COLORS.Negative}
                  strokeWidth={2.5}
                  fill="url(#negGradient)"
                  name="Negative %"
                  dot={{ r: 3, fill: COLORS.Negative }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Issue Feedback Volume Comparison Bar Chart */}
        <div className="bg-white border border-slate-200 rounded p-4">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <div>
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                Issue Feedback Volume Comparison
              </h3>
              <p className="text-[11px] text-slate-400">Total comments per topic across successive drafts</p>
            </div>
            <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
              Top 6 Issues
            </span>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={issueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="issue" angle={-15} textAnchor="end" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
                {versions.map((v, idx) => (
                  <Bar
                    key={v}
                    dataKey={v}
                    name={v}
                    fill={VERSION_BAR_COLORS[idx % VERSION_BAR_COLORS.length]}
                    radius={[3, 3, 0, 0]}
                    barSize={14}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Main Issue Evolution Matrix Table */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Issue Evolution Matrix
            </h3>
            <span className="text-[11px] text-slate-500">
              Tracking concern volume and sentiment trajectory across draft iterations
            </span>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded text-xs font-medium flex-wrap">
            {['ALL', 'IMPROVED', 'PERSISTENT', 'EMERGING', 'WORSENED'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  filterStatus === st
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[800px]">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3.5 w-1/4">Issue Name</th>
                {versions.map((v) => (
                  <th key={v} className="py-2.5 px-3 text-center">
                    {v}
                  </th>
                ))}
                <th className="py-2.5 px-3 text-center">Negative % Trajectory</th>
                <th className="py-2.5 px-3 text-center">Net Trend</th>
                <th className="py-2.5 px-3 text-center">Lifecycle</th>
                <th className="py-2.5 px-3.5 text-right">Evidence Context</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={6 + versions.length} className="text-center py-8 text-slate-400">
                    No issues match the selected lifecycle filter.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((item) => {
                  const negTrajectory = versions
                    .map((v) => `${item.version_negative_pct[v] ?? 0}%`)
                    .join(' → ');

                  return (
                    <tr key={item.issue} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3.5 align-top">
                        <Link
                          to={`/issues?issue=${encodeURIComponent(item.issue)}`}
                          className="font-semibold text-slate-900 hover:text-blue-700 block"
                        >
                          {item.issue}
                        </Link>
                        <span className="text-[11px] text-slate-500 block mt-0.5 leading-snug">
                          {getEvolutionExplanation(item.status, item.change_pct, item.version_negative_pct, versions)}
                        </span>
                      </td>

                      {versions.map((v) => {
                        const count = item.version_counts[v] || 0;
                        return (
                          <td key={v} className="py-2.5 px-3 text-center font-medium text-slate-800 align-top">
                            {count > 0 ? (
                              <Link
                                to={`/issues?issue=${encodeURIComponent(item.issue)}&version=${v}`}
                                className="text-slate-800 hover:text-blue-700 hover:underline font-semibold"
                                title={`Inspect ${count} comments in ${v}`}
                              >
                                {count}
                              </Link>
                            ) : (
                              <span className="text-slate-300">0</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-3 text-center font-mono text-[11px] text-slate-600 align-top">
                        {negTrajectory}
                      </td>

                      <td className="py-2.5 px-3 text-center align-top whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
                            item.change_pct < 0
                              ? 'text-emerald-700 bg-emerald-50'
                              : item.change_pct > 0
                              ? 'text-rose-700 bg-rose-50'
                              : 'text-slate-600 bg-slate-100'
                          }`}
                        >
                          {item.change_pct < 0 ? (
                            <TrendingDown size={12} />
                          ) : item.change_pct > 0 ? (
                            <TrendingUp size={12} />
                          ) : (
                            <Minus size={12} />
                          )}
                          {item.change_pct > 0 ? `+${item.change_pct}%` : `${item.change_pct}%`}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center align-top whitespace-nowrap">
                        <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${statusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>

                      <td className="py-2.5 px-3.5 text-right align-top whitespace-nowrap">
                        <Link
                          to={`/issues?issue=${encodeURIComponent(item.issue)}`}
                          className="text-xs font-medium text-blue-700 hover:text-blue-900 inline-flex items-center gap-0.5"
                        >
                          Inspect Evidence <ArrowRight size={11} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
