import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useConsultation } from '../context/ConsultationContext';
import { getComments, getVersions, getIssues } from '../services/api';
import type { Comment, Version, Issue } from '../types';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { sentimentColor } from '../utils/format';
import { Search, ChevronLeft, ChevronRight, X, ArrowRight, ExternalLink } from 'lucide-react';

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

const LANG_OPTIONS = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi (हिन्दी)' },
  { code: 'ta', name: 'Tamil (தமிழ்)' },
  { code: 'mr', name: 'Marathi (मराठी)' },
  { code: 'gu', name: 'Gujarati (ગુજરાતી)' },
  { code: 'bn', name: 'Bengali (বাংলা)' },
  { code: 'te', name: 'Telugu (తెలుగు)' },
  { code: 'kn', name: 'Kannada (ಕನ್ನಡ)' },
  { code: 'ml', name: 'Malayalam (മലയാളം)' },
  { code: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'mixed', name: 'Hinglish / Mixed' },
];

const LANG_NAMES: Record<string, string> = {
  en: 'English (en)',
  hi: 'Hindi (हिन्दी)',
  ta: 'Tamil (தமிழ்)',
  mr: 'Marathi (मराठी)',
  gu: 'Gujarati (ગુજરાતી)',
  bn: 'Bengali (বাংলা)',
  te: 'Telugu (తెలుగు)',
  kn: 'Kannada (ಕನ್ನಡ)',
  ml: 'Malayalam (മലയാളം)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
  mixed: 'Hinglish / Code-Mixed',
  unknown: 'Unspecified',
};

function highlightText(text: string, query: string) {
  if (!query || !query.trim()) return text;
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return text;
  const regexPattern = `(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
  const parts = text.split(new RegExp(regexPattern, 'gi'));
  return parts.map((part, i) =>
    terms.some((t) => t.toLowerCase() === part.toLowerCase()) ? (
      <mark key={i} className="bg-amber-200/90 text-slate-950 font-semibold px-0.5 rounded-xs">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export default function Comments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedConsultationId, selectedConsultation, loading: contextLoading } = useConsultation();

  const [search, setSearch] = useState<string>(searchParams.get('search') || '');
  const [version, setVersion] = useState<string>(searchParams.get('version') || '');
  const [sentiment, setSentiment] = useState<string>(searchParams.get('sentiment') || '');
  const [stakeholder, setStakeholder] = useState<string>(searchParams.get('stakeholder') || '');
  const [issue, setIssue] = useState<string>(searchParams.get('issue') || '');
  const [language, setLanguage] = useState<string>(searchParams.get('language') || '');
  const [section, setSection] = useState<string>(searchParams.get('section') || '');
  const [page, setPage] = useState<number>(Number(searchParams.get('page')) || 1);

  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [versionsList, setVersionsList] = useState<Version[]>([]);
  const [issuesList, setIssuesList] = useState<Issue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Slide-over drawer state
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);

  useEffect(() => {
    if (!selectedConsultationId) return;
    getVersions(selectedConsultationId).then(setVersionsList).catch(() => {});
    getIssues(selectedConsultationId).then(setIssuesList).catch(() => {});
  }, [selectedConsultationId]);

  const [loadingText, setLoadingText] = useState<string>('Connecting to PolicyLens analysis server...');

  const fetchCommentsData = () => {
    if (!selectedConsultationId) return;
    setLoading(true);
    setError(null);
    setLoadingText('Connecting to PolicyLens analysis server...');

    const slowLoadTimer = setTimeout(() => {
      setLoadingText('The analysis server is starting. This may take a few moments.');
    }, 2500);

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
    if (language) queryParams.language = language;
    if (section.trim()) queryParams.section = section.trim();

    getComments(queryParams)
      .then((res) => {
        clearTimeout(slowLoadTimer);
        setComments(res.items);
        setTotal(res.total);
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(slowLoadTimer);
        setError(err.friendlyMessage || err?.response?.data?.detail || 'Unable to load comments.');
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!selectedConsultationId) {
      if (!contextLoading) setLoading(false);
      return;
    }
    fetchCommentsData();
  }, [selectedConsultationId, page, search, version, sentiment, stakeholder, issue, language, section, contextLoading]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedComment(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
    setLanguage('');
    setSection('');
    setPage(1);
    setSearchParams({});
  };

  const hasActiveFilters = Boolean(search || version || sentiment || stakeholder || issue || language || section);

  if (contextLoading) return <LoadingState message={loadingText} />;
  if (error) return <ErrorState message={error} onRetry={fetchCommentsData} />;
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
              placeholder="Search comment text or keyword with instant highlighting..."
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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 text-xs">
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
            value={language}
            onChange={(e) => { setLanguage(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-400 text-xs font-medium"
          >
            <option value="">All Languages</option>
            {LANG_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
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
          />

          {hasActiveFilters ? (
            <button
              onClick={handleClearFilters}
              className="flex items-center justify-center gap-1 text-slate-600 hover:text-slate-900 border border-slate-200 rounded px-2 py-1 text-xs hover:bg-slate-50 font-medium"
            >
              <X size={12} /> Clear Filters
            </button>
          ) : (
            <div className="hidden lg:block text-slate-400 text-[11px] self-center text-right pr-1">
              Showing 20/page
            </div>
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
            <table className="w-full text-left text-xs min-w-[800px]">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 w-2/5">Comment Text</th>
                  <th className="py-2.5 px-3 text-center">Sentiment</th>
                  <th className="py-2.5 px-3">Issue Category</th>
                  <th className="py-2.5 px-3 text-center">Version</th>
                  <th className="py-2.5 px-3">Stakeholder</th>
                  <th className="py-2.5 px-3">Section</th>
                  <th className="py-2.5 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comments.map((c) => {
                  const isSelected = selectedComment?.id === c.id;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedComment(c)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-slate-100/90 font-medium' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                        {c.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-start gap-1.5">
                          {c.detected_language && (
                            <span className="shrink-0 text-[10px] uppercase font-mono px-1 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold mt-0.5">
                              {c.detected_language}
                            </span>
                          )}
                          <p className="text-slate-800 line-clamp-2 leading-relaxed font-serif">
                            "{highlightText(c.text, search)}"
                          </p>
                        </div>
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
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedComment(c);
                          }}
                          className="text-blue-700 hover:text-blue-900 font-medium inline-flex items-center gap-0.5 hover:underline"
                        >
                          Inspect <ArrowRight size={10} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Slide-over Drawer for Comment Inspection */}
      {selectedComment && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setSelectedComment(null)}
            className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 transition-opacity"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <aside
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
            role="dialog"
            aria-modal="true"
            aria-label={`Comment Record #${selectedComment.id}`}
          >
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900">
                  Comment Record #{selectedComment.id}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${sentimentColor(selectedComment.sentiment)}`}>
                  {selectedComment.sentiment || 'Neutral'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to={`/comments/${selectedComment.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                  title="Open direct permanent link in new tab"
                >
                  <ExternalLink size={14} />
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedComment(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-colors"
                  title="Close (ESC)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Verbatim Comment Text Block */}
              <div>
                <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">
                  Verbatim Stakeholder Submission
                </label>
                <blockquote className="text-sm text-slate-900 font-serif leading-relaxed pl-3 border-l-2 border-slate-300 bg-slate-50/50 p-3 rounded-r">
                  "{highlightText(selectedComment.text, search)}"
                </blockquote>
              </div>

              {/* Salient Clause / Argument Evidence */}
              {selectedComment.argument_evidence && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded p-3 space-y-1">
                  <span className="text-[10px] font-semibold uppercase text-amber-900 tracking-wider block">
                    Extracted Argument Evidence
                  </span>
                  <p className="text-xs text-amber-950 font-serif italic leading-relaxed">
                    "{selectedComment.argument_evidence}"
                  </p>
                </div>
              )}

              {/* Consultation Context & Analysis Attributes */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                  Classification & Submission Context
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100 items-center">
                    <span className="text-slate-500">Detected Language</span>
                    <span className="font-medium text-slate-900 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px]">
                      {LANG_NAMES[selectedComment.detected_language || 'en'] || selectedComment.detected_language || 'English'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Classified Sentiment</span>
                    <span className="font-semibold text-slate-900">{selectedComment.sentiment || 'Neutral'}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Sentiment Confidence</span>
                    <span className="font-mono text-slate-800">
                      {selectedComment.confidence != null ? `${Math.round(selectedComment.confidence * 100)}%` : '—'}
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100 items-baseline">
                    <span className="text-slate-500">Detected Concern Category</span>
                    <span className="font-semibold text-slate-900 text-right">
                      {selectedComment.issue || 'General Feedback'}
                    </span>
                  </div>

                  {selectedComment.aspect && (
                    <div className="flex justify-between py-1 border-b border-slate-100 items-baseline">
                      <span className="text-slate-500">Policy Aspect Focus</span>
                      <span className="font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                        {selectedComment.aspect}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Policy Draft Version</span>
                    <span className="font-mono font-medium text-slate-900">{selectedComment.version || 'v1.0'}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Stakeholder Group</span>
                    <span className="font-medium text-slate-900">{selectedComment.stakeholder_type || 'Unspecified'}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Document Section</span>
                    <span className="font-medium text-slate-900">{selectedComment.section || 'General'}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Subsection</span>
                    <span className="text-slate-700">{selectedComment.subsection || '—'}</span>
                  </div>
                </div>

                {/* Link to Issue Evidence */}
                {selectedComment.issue && (
                  <div className="pt-2">
                    <Link
                      to={`/issues?issue=${encodeURIComponent(selectedComment.issue)}`}
                      className="inline-flex items-center gap-1.5 w-full justify-center py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-medium border border-slate-200 transition-colors"
                    >
                      Browse all evidence for "{selectedComment.issue}" <ArrowRight size={12} />
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
              <span className="text-[11px]">Press <kbd className="px-1 py-0.5 bg-slate-200 rounded text-[10px] font-mono">ESC</kbd> to close</span>
              <button
                type="button"
                onClick={() => setSelectedComment(null)}
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded font-medium text-xs transition-colors"
              >
                Done
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
