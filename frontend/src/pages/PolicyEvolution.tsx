import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
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
} from 'lucide-react';

const COLORS = {
  Positive: '#059669',
  Negative: '#e11d48',
  Neutral: '#64748b',
};

const VERSION_BAR_COLORS = ['#334155', '#475569', '#64748b', '#94a3b8'];

function getEvolutionExplanation(status: string, changePct: number): string {
  if (status === 'IMPROVED') {
    return 'Public concern decreased substantially following draft revisions.';
  }
  if (status === 'EMERGING') {
    return 'New concern introduced or escalated in later draft revisions.';
  }
  if (status === 'WORSENED') {
    return 'Negative stakeholder feedback increased across draft versions.';
  }
  if (changePct === 0) {
    return 'Concern volume remained constant across all draft versions.';
  }
  return 'Stakeholder concern persisted at a steady level across revisions.';
}

export default function PolicyEvolution() {
  const { selectedConsultationId, selectedConsultation, loading: contextLoading } = useConsultation();
  const [data, setData] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    if (!selectedConsultationId) {
      if (!contextLoading) setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getComparison(selectedConsultationId)
      .then((res) => {
        if (active) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err?.response?.data?.detail || 'Unable to load Policy Evolution data.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedConsultationId, contextLoading]);

  if (contextLoading || loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
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
        <div className="flex items-center gap-2 text-xs">
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
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded text-xs font-medium">
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
          <table className="w-full text-left text-xs">
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
                <th className="py-2.5 px-3.5 text-right">Evidence</th>
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
                      <td className="py-3 px-3.5 align-top">
                        <Link
                          to={`/issues/${selectedConsultationId}/${encodeURIComponent(item.issue)}`}
                          className="font-semibold text-slate-900 hover:text-blue-700 block"
                        >
                          {item.issue}
                        </Link>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          {getEvolutionExplanation(item.status, item.change_pct)}
                        </span>
                      </td>

                      {versions.map((v) => {
                        const count = item.version_counts[v] || 0;
                        return (
                          <td key={v} className="py-3 px-3 text-center font-medium text-slate-800 align-top">
                            {count}
                          </td>
                        );
                      })}

                      <td className="py-3 px-3 text-center font-mono text-[11px] text-slate-600 align-top">
                        {negTrajectory}
                      </td>

                      <td className="py-3 px-3 text-center align-top whitespace-nowrap">
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

                      <td className="py-3 px-3 text-center align-top whitespace-nowrap">
                        <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${statusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>

                      <td className="py-3 px-3.5 text-right align-top whitespace-nowrap">
                        <Link
                          to={`/issues/${selectedConsultationId}/${encodeURIComponent(item.issue)}`}
                          className="text-xs font-medium text-blue-700 hover:text-blue-900 inline-flex items-center gap-0.5"
                        >
                          View Evidence <ArrowRight size={11} />
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

      {/* Analytical Charts Row */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Overall Sentiment Trajectory */}
        <div className="bg-white border border-slate-200 rounded p-4">
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">
            Overall Sentiment Trajectory
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sentiment_by_version} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <XAxis dataKey="version" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip formatter={(val: any) => [`${val}%`, '']} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="positive_pct"
                  stroke={COLORS.Positive}
                  strokeWidth={2}
                  name="Positive %"
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="neutral_pct"
                  stroke={COLORS.Neutral}
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  name="Neutral %"
                  dot={{ r: 2.5 }}
                />
                <Line
                  type="monotone"
                  dataKey="negative_pct"
                  stroke={COLORS.Negative}
                  strokeWidth={2}
                  name="Negative %"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Issue Volume by Version */}
        <div className="bg-white border border-slate-200 rounded p-4">
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">
            Issue Feedback Volume Comparison
          </h3>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={issueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="issue" angle={-15} textAnchor="end" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 6 }} />
                {versions.map((v, idx) => (
                  <Bar
                    key={v}
                    dataKey={v}
                    name={v}
                    fill={VERSION_BAR_COLORS[idx % VERSION_BAR_COLORS.length]}
                    radius={[2, 2, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
