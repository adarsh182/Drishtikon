import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConsultation } from '../context/ConsultationContext';
import { getIssues, getComparison } from '../services/api';
import type { Issue, ComparisonData } from '../types';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { priorityColor, statusColor } from '../utils/format';
import { Search, ArrowRight } from 'lucide-react';

export default function Issues() {
  const { selectedConsultationId, selectedConsultation, loading: contextLoading } = useConsultation();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  useEffect(() => {
    if (!selectedConsultationId) {
      if (!contextLoading) setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      getIssues(selectedConsultationId),
      getComparison(selectedConsultationId).catch(() => null),
    ])
      .then(([issuesRes, compRes]) => {
        if (active) {
          setIssues(issuesRes);
          setComparison(compRes);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err?.response?.data?.detail || 'Unable to load issues.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedConsultationId, contextLoading]);

  if (contextLoading || loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!selectedConsultationId) {
    return (
      <div className="bg-white rounded border border-slate-200 p-8 text-center max-w-md mx-auto mt-12">
        <h2 className="text-sm font-semibold text-slate-800">No Consultation Selected</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Please select or upload a consultation dataset to view identified issues.
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

  const evolutionMap = (comparison?.issue_evolution || []).reduce<Record<string, string>>((acc, curr) => {
    acc[curr.issue] = curr.status;
    return acc;
  }, {});

  const filtered = issues.filter((i) => {
    const matchesSearch = i.issue.toLowerCase().includes(search.toLowerCase());
    const matchesPriority = priorityFilter === 'ALL' || i.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Issues & Evidence Review</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Stakeholder concern categories extracted from consultation comments for{' '}
            <strong className="font-medium text-slate-700">{selectedConsultation?.title || `Consultation #${selectedConsultationId}`}</strong>
          </p>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {issues.length} Categories Identified
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 border border-slate-200 rounded flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded text-xs">
          {['ALL', 'High', 'Medium', 'Low'].map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                priorityFilter === p
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {p === 'ALL' ? 'All Priorities' : `${p} Priority`}
            </button>
          ))}
        </div>
      </div>

      {/* Issues Review Table */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 w-1/3">Issue Category</th>
                <th className="py-2.5 px-4 text-center">Feedback Volume</th>
                <th className="py-2.5 px-4 text-center">Negative Concern</th>
                <th className="py-2.5 px-4 text-center">Priority</th>
                <th className="py-2.5 px-4 text-center">Lifecycle Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No issue categories match the search criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((issue) => {
                  const lifecycle = evolutionMap[issue.issue] || 'PERSISTENT';
                  return (
                    <tr key={issue.issue} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <Link
                          to={`/issues/${selectedConsultationId}/${encodeURIComponent(issue.issue)}`}
                          className="hover:text-blue-700"
                        >
                          {issue.issue}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-700 font-medium">
                        {issue.count.toLocaleString()} comments
                      </td>
                      <td className="py-3 px-4 text-center font-medium text-rose-700">
                        {issue.negative_pct}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${priorityColor(issue.priority)}`}>
                          {issue.priority}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${statusColor(lifecycle)}`}>
                          {lifecycle}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Link
                          to={`/issues/${selectedConsultationId}/${encodeURIComponent(issue.issue)}`}
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
    </div>
  );
}
