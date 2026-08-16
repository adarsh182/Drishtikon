import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { Link } from 'react-router-dom';
import { useConsultation } from '../context/ConsultationContext';
import { getDashboard } from '../services/api';
import type { DashboardData } from '../types';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { priorityColor } from '../utils/format';
import { ArrowRight, AlertTriangle, GitCompare, MessageSquare } from 'lucide-react';

const COLORS = {
  Positive: '#059669', // subtle emerald
  Negative: '#e11d48', // subtle rose
  Neutral: '#64748b',  // slate
};

export default function Dashboard() {
  const { selectedConsultationId, loading: contextLoading } = useConsultation();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingText, setLoadingText] = useState<string>('Connecting to PolicyLens analysis server...');

  const fetchDashboard = () => {
    if (!selectedConsultationId) return;
    setLoading(true);
    setError(null);
    setLoadingText('Connecting to PolicyLens analysis server...');

    const slowLoadTimer = setTimeout(() => {
      setLoadingText('The analysis server is starting. This may take a few moments.');
    }, 2500);

    getDashboard(selectedConsultationId)
      .then((dash) => {
        clearTimeout(slowLoadTimer);
        setData(dash);
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(slowLoadTimer);
        setError(err.friendlyMessage || err?.response?.data?.detail || 'Unable to load dashboard data.');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!selectedConsultationId) {
      if (!contextLoading) setLoading(false);
      return;
    }
    fetchDashboard();
  }, [selectedConsultationId, contextLoading]);

  if (contextLoading || loading) return <LoadingState message={loadingText} />;
  if (error) return <ErrorState message={error} onRetry={fetchDashboard} />;
  if (!selectedConsultationId || !data) {
    return (
      <div className="bg-white rounded border border-slate-200 p-8 text-center max-w-md mx-auto mt-12">
        <h2 className="text-sm font-semibold text-slate-800">No Consultation Selected</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Please select or upload a consultation dataset to view analysis.
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

  const pieData = [
    { name: 'Positive', value: data.kpis.positive },
    { name: 'Neutral', value: data.kpis.neutral },
    { name: 'Negative', value: data.kpis.negative },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            {data.consultation.title}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {data.consultation.description || 'Stakeholder feedback summary and policy review analysis'}
          </p>
        </div>
        <div className="text-xs text-slate-500">
          Status: <span className="font-medium text-slate-700 capitalize">{data.consultation.status}</span>
        </div>
      </div>

      {/* Compact KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded p-3.5">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Total Feedback</span>
          <p className="text-xl font-semibold text-slate-900 mt-1">{data.kpis.total.toLocaleString()}</p>
          <span className="text-[11px] text-slate-400">Submissions</span>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3.5">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Positive Support</span>
          <p className="text-xl font-semibold text-emerald-700 mt-1">{data.kpis.positive_pct}%</p>
          <span className="text-[11px] text-slate-400">{data.kpis.positive.toLocaleString()} comments</span>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3.5">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Neutral Inquiries</span>
          <p className="text-xl font-semibold text-slate-700 mt-1">{data.kpis.neutral_pct}%</p>
          <span className="text-[11px] text-slate-400">{data.kpis.neutral.toLocaleString()} comments</span>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3.5">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Negative Concern</span>
          <p className="text-xl font-semibold text-rose-700 mt-1">{data.kpis.negative_pct}%</p>
          <span className="text-[11px] text-slate-400">{data.kpis.negative.toLocaleString()} comments</span>
        </div>

        <div className="bg-white border border-slate-200 rounded p-3.5 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Drafts Evaluated</span>
          <p className="text-xl font-semibold text-slate-900 mt-1">{data.versions.length}</p>
          <span className="text-[11px] text-slate-400 font-mono">
            {data.versions.map((v) => v.version_number).join(' → ')}
          </span>
        </div>
      </div>

      {/* Row 1: Sentiment Overview & Sentiment Trajectory */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Sentiment Distribution Donut */}
        <div className="bg-white border border-slate-200 rounded p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 border-b border-slate-100 pb-2 gap-2">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Sentiment Distribution
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-600" /> Positive {data.kpis.positive_pct}%
              </span>
              <span className="flex items-center gap-1 text-slate-600 font-medium">
                <span className="w-2 h-2 rounded-full bg-slate-500" /> Neutral {data.kpis.neutral_pct}%
              </span>
              <span className="flex items-center gap-1 text-rose-700 font-medium">
                <span className="w-2 h-2 rounded-full bg-rose-600" /> Negative {data.kpis.negative_pct}%
              </span>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={78}
                  innerRadius={48}
                  stroke="#fff"
                  strokeWidth={2}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={COLORS[entry.name as keyof typeof COLORS]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: any) => [`${val} comments`, 'Count']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Trajectory Across Drafts */}
        <div className="bg-white border border-slate-200 rounded p-4">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Sentiment Trajectory Across Drafts
            </h3>
            <Link to="/evolution" className="text-xs font-medium text-blue-700 hover:text-blue-900 inline-flex items-center gap-0.5">
              Policy Evolution →
            </Link>
          </div>
          <div className="h-64 sm:h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sentiment_by_version} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="version" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip formatter={(val: any) => [`${val}%`, '']} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingBottom: 6 }} />
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
      </div>

      {/* Row 2: Key Policy Concerns & Feedback Distribution by Section */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Key Policy Concerns Requiring Review */}
        <div className="bg-white border border-slate-200 rounded p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-rose-600" />
                <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                  Key Policy Concerns Requiring Review
                </h3>
              </div>
              <Link to="/issues" className="text-xs font-medium text-blue-700 hover:text-blue-900">
                All Issues ({data.top_issues.length}) →
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {data.top_issues.length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">No specific issues detected</p>
              ) : (
                data.top_issues.slice(0, 5).map((issue) => (
                  <Link
                    key={issue.issue}
                    to={`/issues?issue=${encodeURIComponent(issue.issue)}`}
                    className="flex flex-col sm:flex-row sm:items-center justify-between py-2.5 px-2 hover:bg-slate-50 rounded transition-colors group gap-2"
                  >
                    <div className="pr-4">
                      <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-700 block mb-0.5">
                        {issue.issue}
                      </span>
                      <span className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                        <span>{issue.count} comments</span>
                        <span>·</span>
                        <strong className="text-rose-700 font-medium">{issue.negative_pct}% negative</strong>
                        <span>·</span>
                        <span className={`px-1.5 py-0.5 rounded border ${
                          issue.evidence_sufficiency === 'INSUFFICIENT' ? 'bg-red-50 text-red-700 border-red-200' :
                          issue.evidence_sufficiency === 'LIMITED' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                          'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {issue.evidence_sufficiency} Evidence
                        </span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-end">
                        <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${priorityColor(issue.priority_level)}`}>
                          {issue.priority_level} Priority
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium mt-0.5 pr-0.5">
                          {Math.round(issue.priority_score)}/100
                        </span>
                      </div>
                      <ArrowRight size={13} className="text-slate-400 group-hover:text-slate-700 hidden sm:block" />
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100 text-right">
            <Link
              to="/issues"
              className="text-xs font-medium text-slate-700 hover:text-slate-900 inline-flex items-center gap-1"
            >
              Open Issues & Verbatim Evidence Master-Detail <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        {/* Feedback by Policy Section */}
        <div className="bg-white border border-slate-200 rounded p-4">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Feedback Distribution by Section
            </h3>
            <span className="text-[11px] text-slate-400">Stacked Sentiment Breakdown</span>
          </div>
          <div className="h-64 sm:h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.sections.slice(0, 6)} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="section" angle={-15} textAnchor="end" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip formatter={(val: any) => [`${val}%`, '']} />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 6 }} />
                <Bar dataKey="positive_pct" fill={COLORS.Positive} name="Positive %" stackId="a" />
                <Bar dataKey="neutral_pct" fill={COLORS.Neutral} name="Neutral %" stackId="a" />
                <Bar dataKey="negative_pct" fill={COLORS.Negative} name="Negative %" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Stakeholder Dissent & Quick Consultation Actions */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Negative Sentiment by Stakeholder Group */}
        <div className="bg-white border border-slate-200 rounded p-4">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
              Negative Concern by Stakeholder Group
            </h3>
            <span className="text-[11px] text-slate-400">Highest Opposition Segments</span>
          </div>
          <div className="h-64 sm:h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.stakeholders.slice(0, 6)} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="stakeholder" angle={-15} textAnchor="end" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 10, fill: '#64748b' }} />
                <Tooltip formatter={(val: any) => [`${val}%`, 'Negative Concern']} />
                <Bar dataKey="negative_pct" fill={COLORS.Negative} name="Negative %" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Consultation Actions & Scope */}
        <div className="bg-white border border-slate-200 rounded p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
              <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                Deliberation & Review Tools
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">Dataset #{data.consultation.id}</span>
            </div>

            <div className="space-y-2.5">
              <Link
                to="/evolution"
                className="flex items-center justify-between p-2.5 rounded border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
                    <GitCompare size={15} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-700">
                      Policy Evolution Matrix
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Track whether draft revisions resolved stakeholder objections across versions
                    </p>
                  </div>
                </div>
                <ArrowRight size={13} className="text-slate-400 group-hover:text-slate-700" />
              </Link>

              <Link
                to="/issues"
                className="flex items-center justify-between p-2.5 rounded border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-rose-50 text-rose-700 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={15} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-700">
                      Issues & Evidence Master-Detail
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Inspect verbatim submissions categorised by topic, priority, and section
                    </p>
                  </div>
                </div>
                <ArrowRight size={13} className="text-slate-400 group-hover:text-slate-700" />
              </Link>

              <Link
                to="/comments"
                className="flex items-center justify-between p-2.5 rounded border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded bg-slate-100 text-slate-700 flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={15} />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-900 group-hover:text-blue-700">
                      Search & Filter Raw Submissions
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Full-text search with highlighting and slide-over comment inspection
                    </p>
                  </div>
                </div>
                <ArrowRight size={13} className="text-slate-400 group-hover:text-slate-700" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
