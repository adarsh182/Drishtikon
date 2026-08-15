import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useConsultation } from '../context/ConsultationContext';
import { getComments, getVersions, getIssues } from '../services/api';
import type { Comment, Version, Issue } from '../types';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { sentimentColor } from '../utils/format';
import { Search, ChevronLeft, ChevronRight, X, ArrowRight } from 'lucide-react';

const STAKEHOLDERS = [
  'Small Business',
  'Large Enterprise',
  'Professional',
  'Industry Association',
  'NGO',
  'Citizen',
  'Legal Professional',
  'Other',
];

export default function Comments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedConsultationId, selectedConsultation, loading: contextLoading } = useConsultation();

  const [search, setSearch] = useState<string>(searchParams.get('search') || '');
  const [version, setVersion] = useState<string>(searchParams.get('version') || '');
  const [sentiment, setSentiment] = useState<string>(searchParams.get('sentiment') || '');
  const [stakeholder, setStakeholder] = useState<string>(searchParams.get('stakeholder') || '');
  const [issue, setIssue] = useState<string>(searchParams.get('issue') || '');
  const [section, setSection] = useState<string>(searchParams.get('section') || '');
  const [page, setPage] = useState<number>(Number(searchParams.get('page')) || 1);

  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [versionsList, setVersionsList] = useState<Version[]>([]);
  const [issuesList, setIssuesList] = useState<Issue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedConsultationId) return;
    getVersions(selectedConsultationId).then(setVersionsList).catch(() => {});
    getIssues(selectedConsultationId).then(setIssuesList).catch(() => {});
  }, [selectedConsultationId]);

  useEffect(() => {
    if (!selectedConsultationId) {
      if (!contextLoading) setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    const queryParams: Record<string, string | number> = {
      consultation_id: selectedConsultationId,
      page,
      page_size: 20,
    };
    if (search.trim()) queryParams.search = search.trim();
    if (version) queryParams.version = version;
    if (sentiment) queryParams.sentiment = sentiment;
    if (stakeholder) queryParams.stakeholder = stakeholder;
    if (issue) queryParams.issue = issue;
    if (section.trim()) queryParams.section = section.trim();

    getComments(queryParams)
      .then((res) => {
        if (active) {
          setComments(res.items);
          setTotal(res.total);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err?.response?.data?.detail || 'Unable to load comments.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedConsultationId, page, search, version, sentiment, stakeholder, issue, section, contextLoading]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setVersion('');
    setSentiment('');
    setStakeholder('');
    setIssue('');
    setSection('');
    setPage(1);
    setSearchParams({});
  };

  const hasActiveFilters = Boolean(search || version || sentiment || stakeholder || issue || section);

  if (contextLoading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!selectedConsultationId) {
    return (
      <div className="bg-white rounded border border-slate-200 p-8 text-center max-w-md mx-auto mt-12">
        <h2 className="text-sm font-semibold text-slate-800">No Consultation Selected</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Please select or upload a consultation to browse comments.
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

  const totalPages = Math.ceil(total / 20) || 1;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Comments Record</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Public feedback submissions for{' '}
            <strong className="font-medium text-slate-700">{selectedConsultation?.title || `Consultation #${selectedConsultationId}`}</strong>
          </p>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {total.toLocaleString()} Comments in Dataset
        </div>
      </div>

      {/* Compact Filter Bar */}
      <div className="bg-white p-3 border border-slate-200 rounded space-y-2.5">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search comment text or issues..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
          <button
            type="submit"
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-4 py-1.5 rounded transition-colors"
          >
            Search
          </button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <select
            value={version}
            onChange={(e) => { setVersion(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs"
          >
            <option value="">All Versions</option>
            {versionsList.map((v) => (
              <option key={v.id} value={v.version_number}>
                {v.version_number} ({v.comment_count})
              </option>
            ))}
          </select>

          <select
            value={sentiment}
            onChange={(e) => { setSentiment(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs"
          >
            <option value="">All Sentiments</option>
            <option value="Positive">Positive</option>
            <option value="Neutral">Neutral</option>
            <option value="Negative">Negative</option>
          </select>

          <select
            value={issue}
            onChange={(e) => { setIssue(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs"
          >
            <option value="">All Issues</option>
            {issuesList.map((i) => (
              <option key={i.issue} value={i.issue}>
                {i.issue}
              </option>
            ))}
          </select>

          <select
            value={stakeholder}
            onChange={(e) => { setStakeholder(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs"
          >
            <option value="">All Stakeholders</option>
            {STAKEHOLDERS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Section (e.g. Compliance)"
            value={section}
            onChange={(e) => { setSection(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs"
          >
          </input>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center justify-center gap-1 text-slate-600 hover:text-slate-900 border border-slate-200 rounded px-2 py-1 text-xs hover:bg-slate-50"
            >
              <X size={12} /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Research-Grade Comments Table */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">Loading comments...</div>
        ) : comments.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400">
            No comments found matching the specified filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 w-2/5">Comment Text</th>
                  <th className="py-2.5 px-3 text-center">Sentiment</th>
                  <th className="py-2.5 px-3">Issue Category</th>
                  <th className="py-2.5 px-3 text-center">Version</th>
                  <th className="py-2.5 px-3">Stakeholder</th>
                  <th className="py-2.5 px-3">Section</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comments.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                      {c.id}
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="text-slate-800 line-clamp-2 leading-relaxed font-serif">
                        "{c.text}"
                      </p>
                    </td>
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${sentimentColor(c.sentiment)}`}>
                        {c.sentiment || 'Neutral'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 font-medium whitespace-nowrap">
                      {c.issue || 'General Feedback'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-slate-700 whitespace-nowrap">
                      {c.version || 'v1.0'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {c.stakeholder_type || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                      {c.section || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <Link
                        to={`/comments/${c.id}`}
                        className="text-blue-700 hover:text-blue-900 font-medium inline-flex items-center gap-0.5"
                      >
                        Inspect <ArrowRight size={10} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Compact Pagination Bar */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50/30">
            <span className="text-slate-500">
              Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total.toLocaleString()} comments
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-slate-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-medium inline-flex items-center gap-0.5"
              >
                <ChevronLeft size={12} /> Prev
              </button>
              <span className="px-2 font-medium text-slate-700">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 border border-slate-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-medium inline-flex items-center gap-0.5"
              >
                Next <ChevronRight size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
