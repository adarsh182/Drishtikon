import { useEffect, useState } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { useConsultation } from '../context/ConsultationContext';
import { getIssues, getComparison, getIssueDetail, getIssueEvidence } from '../services/api';
import type { Issue, ComparisonData, IssueDetail as IssueDetailType, Comment } from '../types';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { priorityColor, statusColor, sentimentColor } from '../utils/format';
import { Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

export default function Issues() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { issueName: routeIssueName } = useParams();
  const { selectedConsultationId, selectedConsultation, loading: contextLoading } = useConsultation();

  const [issues, setIssues] = useState<Issue[]>([]);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Selected Issue Master-Detail State
  const initialIssueParam = routeIssueName
    ? decodeURIComponent(routeIssueName)
    : searchParams.get('issue') || '';
  const [selectedIssueName, setSelectedIssueName] = useState<string>(initialIssueParam);
  const [selectedVersionFilter, setSelectedVersionFilter] = useState<string>(searchParams.get('version') || '');

  // Detail & Evidence State
  const [detail, setDetail] = useState<IssueDetailType | null>(null);
  const [evidence, setEvidence] = useState<{ total: number; items: Comment[] }>({ total: 0, items: [] });
  const [evidencePage, setEvidencePage] = useState<number>(1);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [evidenceLoading, setEvidenceLoading] = useState<boolean>(false);

  const [loadingText, setLoadingText] = useState<string>('Connecting to PolicyLens analysis server...');

  const fetchIssuesData = () => {
    if (!selectedConsultationId) return;
    setLoading(true);
    setError(null);
    setLoadingText('Connecting to PolicyLens analysis server...');

    const slowLoadTimer = setTimeout(() => {
      setLoadingText('The analysis server is starting. This may take a few moments.');
    }, 2500);

    Promise.all([
      getIssues(selectedConsultationId),
      getComparison(selectedConsultationId).catch(() => null),
    ])
      .then(([issuesRes, compRes]) => {
        clearTimeout(slowLoadTimer);
        setIssues(issuesRes);
        setComparison(compRes);
        setLoading(false);

        // Select initial issue
        if (issuesRes.length > 0) {
          setSelectedIssueName((prev) => {
            if (prev && issuesRes.some((i) => i.issue === prev)) {
              return prev;
            }
            return issuesRes[0].issue;
          });
        }
      })
      .catch((err) => {
        clearTimeout(slowLoadTimer);
        setError(err.friendlyMessage || err?.response?.data?.detail || 'Unable to load issues.');
        setLoading(false);
      });
  };

  // Load Issues and Comparison data
  useEffect(() => {
    if (!selectedConsultationId) {
      if (!contextLoading) setLoading(false);
      return;
    }
    fetchIssuesData();
  }, [selectedConsultationId, contextLoading]);

  // Load selected issue detail and evidence
  useEffect(() => {
    if (!selectedConsultationId || !selectedIssueName) {
      setDetail(null);
      setEvidence({ total: 0, items: [] });
      return;
    }

    let active = true;
    setDetailLoading(true);

    getIssueDetail(selectedConsultationId, selectedIssueName)
      .then((res) => {
        if (active) {
          setDetail(res);
          setDetailLoading(false);
        }
      })
      .catch(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedConsultationId, selectedIssueName]);

  // Load evidence comments with version filter
  useEffect(() => {
    if (!selectedConsultationId || !selectedIssueName) return;

    let active = true;
    setEvidenceLoading(true);

    getIssueEvidence(selectedConsultationId, selectedIssueName, evidencePage)
      .then((res) => {
        if (active) {
          // If version filter active, filter client-side or display matching items
          const filteredItems = selectedVersionFilter
            ? res.items.filter((c) => c.version === selectedVersionFilter)
            : res.items;
          setEvidence({
            total: selectedVersionFilter ? filteredItems.length : res.total,
            items: filteredItems,
          });
          setEvidenceLoading(false);
        }
      })
      .catch(() => {
        if (active) setEvidenceLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedConsultationId, selectedIssueName, evidencePage, selectedVersionFilter]);

  const handleSelectIssue = (issueName: string) => {
    setSelectedIssueName(issueName);
    setEvidencePage(1);
    setSearchParams(selectedVersionFilter ? { issue: issueName, version: selectedVersionFilter } : { issue: issueName });
  };

  if (contextLoading || loading) return <LoadingState message={loadingText} />;
  if (error) return <ErrorState message={error} onRetry={fetchIssuesData} />;
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

  const filteredIssues = issues.filter((i) => {
    const matchesSearch = i.issue.toLowerCase().includes(search.toLowerCase());
    const matchesPriority = priorityFilter === 'ALL' || i.priority_level.toUpperCase() === priorityFilter.toUpperCase();
    return matchesSearch && matchesPriority;
  });

  const totalEvidencePages = Math.ceil(evidence.total / 20) || 1;
  const currentLifecycle = selectedIssueName ? evolutionMap[selectedIssueName] || 'PERSISTENT' : 'PERSISTENT';

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Issues & Evidence Review</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Master-detail review of stakeholder concern categories and supporting verbatim submissions for{' '}
            <strong className="font-medium text-slate-700">{selectedConsultation?.title || `Consultation #${selectedConsultationId}`}</strong>
          </p>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {issues.length} Identified Categories
        </div>
      </div>

      {/* Master-Detail Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT PANE: Master Issue List (5 cols on lg) */}
        <div className={`lg:col-span-5 space-y-3 ${selectedIssueName ? 'hidden lg:block' : 'block'}`}>
          {/* Filter and Search Bar */}
          <div className="bg-white p-2.5 border border-slate-200 rounded space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Filter issue categories..."
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
                  className={`flex-1 py-1 text-center rounded font-medium transition-colors ${
                    priorityFilter === p
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Issue Category Cards / Master List */}
          <div className="bg-white border border-slate-200 rounded overflow-hidden divide-y divide-slate-100 max-h-[calc(100vh-280px)] overflow-y-auto">
            {filteredIssues.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No issue categories match the filter criteria.
              </div>
            ) : (
              filteredIssues.map((issue) => {
                const isSelected = selectedIssueName === issue.issue;
                const lifecycle = evolutionMap[issue.issue] || 'PERSISTENT';

                return (
                  <button
                    key={issue.issue}
                    type="button"
                    onClick={() => handleSelectIssue(issue.issue)}
                    className={`w-full text-left p-3 transition-colors flex items-start justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-slate-900 text-white font-medium shadow-xs'
                        : 'hover:bg-slate-50/90 text-slate-900'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                          {issue.issue}
                        </span>
                      </div>
                      <div className={`text-[11px] mt-1 flex items-center gap-2 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        <span>{issue.count.toLocaleString()} comments</span>
                        <span>•</span>
                        <span className={isSelected ? 'text-rose-300' : 'text-rose-600 font-medium'}>
                          {issue.negative_pct}% negative
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${statusColor(lifecycle)}`}>
                        {lifecycle}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${priorityColor(issue.priority_level)}`}>
                        {issue.priority_level} Priority
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        {Math.round(issue.priority_score)}/100
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT PANE: Selected Issue Evidence & Breakdown (7 cols on lg) */}
        <div className={`lg:col-span-7 space-y-4 ${selectedIssueName ? 'block' : 'hidden lg:block'}`}>
          {!detail ? (
            <div className="bg-white border border-slate-200 rounded p-12 text-center text-xs text-slate-400">
              {detailLoading ? 'Loading issue evidence...' : 'Select an issue from the list to inspect supporting evidence.'}
            </div>
          ) : (
            <>
              {/* Selected Issue Dossier Header */}
              <div className="bg-white border border-slate-200 rounded p-4 space-y-3 relative">
                <button 
                  onClick={() => handleSelectIssue('')}
                  className="lg:hidden absolute -top-10 left-0 text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 bg-white px-2 py-1 rounded border border-slate-200"
                >
                  ← Back to Categories
                </button>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3 pt-2 lg:pt-0">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">{detail.issue}</h3>
                      <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${statusColor(detail.lifecycle)}`}>
                        Lifecycle: {detail.lifecycle}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        Trajectory: {detail.trajectory}
                      </span>
                    </div>
                    
                    {/* Priority and Evidence Row */}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${priorityColor(detail.priority_level)}`}>
                        {detail.priority_level} Priority
                      </span>
                      <span className="text-xs text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        Score: {Math.round(detail.priority_score)} / 100
                      </span>
                      <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                        detail.evidence_sufficiency === 'INSUFFICIENT' ? 'bg-red-50 text-red-700 border border-red-200' :
                        detail.evidence_sufficiency === 'LIMITED' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                        'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        Evidence: {detail.evidence_sufficiency} · {detail.count.toLocaleString()} submissions
                      </span>
                    </div>
                    
                    {/* Explanation */}
                    <p className="text-xs text-slate-700 mt-2 bg-blue-50/50 p-2 rounded border border-blue-100">
                      <strong>AI Analysis:</strong> {detail.priority_explanation}
                    </p>
                    
                    <p className="text-xs text-slate-500 mt-2">
                      {detail.negative_pct}% negative concern · {detail.positive_pct}% support
                    </p>
                  </div>

                  <Link
                    to={`/comments?issue=${encodeURIComponent(detail.issue)}`}
                    className="text-xs text-blue-700 hover:text-blue-900 font-medium inline-flex items-center gap-1 shrink-0"
                  >
                    Open in Comments Table <ExternalLink size={12} />
                  </Link>
                </div>

                {/* Compact Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {/* Draft Counts */}
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Draft Progression
                    </span>
                    <div className="space-y-0.5">
                      {Object.entries(detail.version_counts).map(([v, count]) => (
                        <div key={v} className="flex justify-between text-[11px]">
                          <span className="font-mono text-slate-700">{v}:</span>
                          <span className="font-semibold text-slate-900">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Sections */}
                  <div className="bg-slate-50 border border-slate-200 rounded p-2">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Sections Affected
                    </span>
                    <div className="space-y-0.5 max-h-16 overflow-y-auto">
                      {detail.sections.slice(0, 3).map((s) => (
                        <div key={s.section} className="flex justify-between text-[11px] truncate">
                          <span className="text-slate-700 truncate pr-1">{s.section}:</span>
                          <span className="font-semibold text-slate-900">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Stakeholders */}
                  <div className="bg-slate-50 border border-slate-200 rounded p-2 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                      Stakeholder Mix
                    </span>
                    <div className="space-y-0.5 max-h-16 overflow-y-auto">
                      {detail.stakeholders.slice(0, 3).map((st) => (
                        <div key={st.stakeholder} className="flex justify-between text-[11px] truncate">
                          <span className="text-slate-700 truncate pr-1">{st.stakeholder}:</span>
                          <span className="font-semibold text-slate-900">{st.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Supporting Evidence Submissions Feed */}
              <div className="bg-white border border-slate-200 rounded overflow-hidden">
                <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                      Verbatim Evidence Stream
                    </h4>
                    <span className="text-[11px] text-slate-500 font-mono">
                      ({evidence.total} comments)
                    </span>
                  </div>

                  {/* Version Filter Tabs */}
                  {Object.keys(detail.version_counts).length > 1 && (
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="text-slate-400 mr-1">Version:</span>
                      <button
                        onClick={() => { setSelectedVersionFilter(''); setEvidencePage(1); }}
                        className={`px-2 py-0.5 rounded transition-colors ${
                          !selectedVersionFilter ? 'bg-slate-900 text-white font-medium' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        All
                      </button>
                      {Object.keys(detail.version_counts).map((v) => (
                        <button
                          key={v}
                          onClick={() => { setSelectedVersionFilter(v); setEvidencePage(1); }}
                          className={`px-2 py-0.5 rounded font-mono transition-colors ${
                            selectedVersionFilter === v ? 'bg-slate-900 text-white font-medium' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4">
                  {evidenceLoading ? (
                    <div className="py-12 text-center text-xs text-slate-400">Loading verbatim evidence...</div>
                  ) : evidence.items.length === 0 ? (
                    <div className="py-10 text-center text-xs text-slate-400">
                      No verbatim evidence comments recorded for this filter.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {evidence.items.map((comment) => (
                        <div key={comment.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                          <blockquote className="text-xs text-slate-900 leading-relaxed font-serif pl-2.5 border-l-2 border-slate-300">
                            "{comment.text}"
                          </blockquote>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] pt-0.5">
                            <span className={`px-1.5 py-0.2 rounded font-medium ${sentimentColor(comment.sentiment)}`}>
                              {comment.sentiment || 'Neutral'}
                            </span>

                            {comment.version && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono">
                                {comment.version}
                              </span>
                            )}

                            {comment.stakeholder_type && (
                              <span className="text-slate-500">
                                Stakeholder: <strong className="font-medium text-slate-700">{comment.stakeholder_type}</strong>
                              </span>
                            )}

                            {comment.section && (
                              <span className="text-slate-500">
                                Section: <strong className="font-medium text-slate-700">{comment.section}</strong>
                              </span>
                            )}

                            <Link
                              to={`/comments?search=${encodeURIComponent(comment.text.slice(0, 30))}`}
                              className="ml-auto text-blue-700 hover:text-blue-900 font-medium inline-flex items-center gap-0.5"
                            >
                              Inspect in Comments Record →
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Compact Pagination */}
                  {totalEvidencePages > 1 && (
                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                      <span className="text-slate-500 text-[11px]">
                        Page {evidencePage} of {totalEvidencePages}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={evidencePage <= 1}
                          onClick={() => setEvidencePage((p) => Math.max(1, p - 1))}
                          className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-medium inline-flex items-center gap-0.5"
                        >
                          <ChevronLeft size={11} /> Prev
                        </button>
                        <button
                          disabled={evidencePage >= totalEvidencePages}
                          onClick={() => setEvidencePage((p) => Math.min(totalEvidencePages, p + 1))}
                          className="px-2 py-0.5 border border-slate-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-medium inline-flex items-center gap-0.5"
                        >
                          Next <ChevronRight size={11} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
