import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useConsultation } from '../context/ConsultationContext';
import { getIssueDetail, getIssueEvidence } from '../services/api';
import type { IssueDetail as IssueDetailType, Comment } from '../types';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { priorityColor, sentimentColor } from '../utils/format';
import { ArrowLeft, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';

export default function IssueDetail() {
  const { id: routeId, issueName: routeIssueName } = useParams();
  const { selectedConsultationId } = useConsultation();

  const consultationId = routeId ? Number(routeId) : selectedConsultationId;
  const issueName = decodeURIComponent(routeIssueName || '');

  const [detail, setDetail] = useState<IssueDetailType | null>(null);
  const [evidence, setEvidence] = useState<{ total: number; items: Comment[] }>({ total: 0, items: [] });
  const [page, setPage] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [evidenceLoading, setEvidenceLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [loadingText, setLoadingText] = useState<string>('Connecting to PolicyLens analysis server...');

  const fetchIssueDetail = () => {
    if (!consultationId || !issueName) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setLoadingText('Connecting to PolicyLens analysis server...');

    const slowLoadTimer = setTimeout(() => {
      setLoadingText('The analysis server is starting. This may take a few moments.');
    }, 2500);

    getIssueDetail(consultationId, issueName)
      .then((res) => {
        clearTimeout(slowLoadTimer);
        setDetail(res);
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(slowLoadTimer);
        setError(err.friendlyMessage || err?.response?.data?.detail || 'Unable to load issue details.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchIssueDetail();
  }, [consultationId, issueName]);

  useEffect(() => {
    if (!consultationId || !issueName) return;

    let active = true;
    setEvidenceLoading(true);

    getIssueEvidence(consultationId, issueName, page)
      .then((res) => {
        if (active) {
          setEvidence({ total: res.total, items: res.items });
          setEvidenceLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setEvidenceLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [consultationId, issueName, page]);

  if (loading) return <LoadingState message={loadingText} />;
  if (error) return <ErrorState message={error} onRetry={fetchIssueDetail} />;
  if (!consultationId || !detail) {
    return (
      <div className="bg-white rounded border border-slate-200 p-8 text-center max-w-md mx-auto mt-12">
        <h2 className="text-sm font-semibold text-slate-800">Issue Category Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Could not locate data for issue category "{issueName}".
        </p>
        <Link
          to="/issues"
          className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-3.5 py-2 rounded transition-colors"
        >
          Back to Issues
        </Link>
      </div>
    );
  }

  const totalPages = Math.ceil(evidence.total / 20) || 1;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          to="/issues"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={13} /> Back to Issues & Evidence
        </Link>
      </div>

      {/* Issue Overview Header */}
      <div className="bg-white border border-slate-200 rounded p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{detail.issue}</h2>
            <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${priorityColor(detail.priority_level)}`}>
              {detail.priority_level} Priority
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${
              detail.evidence_sufficiency === 'INSUFFICIENT' ? 'bg-red-50 text-red-700' :
              detail.evidence_sufficiency === 'LIMITED' ? 'bg-yellow-50 text-yellow-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {detail.evidence_sufficiency} Evidence
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Stakeholder concern summary and verbatim evidence record
          </p>
        </div>

        <Link
          to={`/comments?issue=${encodeURIComponent(detail.issue)}`}
          className="text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 px-3 py-1.5 rounded transition-colors self-start sm:self-auto"
        >
          Browse All {detail.count} Comments →
        </Link>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded p-3">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Total Mentions</span>
          <p className="text-lg font-semibold text-slate-900 mt-0.5">{detail.count.toLocaleString()}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded p-3">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Negative Concern</span>
          <p className="text-lg font-semibold text-rose-700 mt-0.5">{detail.negative_pct}%</p>
        </div>
        <div className="bg-white border border-slate-200 rounded p-3">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Positive Support</span>
          <p className="text-lg font-semibold text-emerald-700 mt-0.5">{detail.positive_pct}%</p>
        </div>
        <div className="bg-white border border-slate-200 rounded p-3">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Neutral Inquiries</span>
          <p className="text-lg font-semibold text-slate-700 mt-0.5">{detail.neutral_pct}%</p>
        </div>
      </div>

      {/* Breakdown Grids */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Version Breakdown */}
        <div className="bg-white border border-slate-200 rounded p-3.5">
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2.5">
            Volume by Policy Draft
          </h3>
          <div className="divide-y divide-slate-100">
            {Object.entries(detail.version_counts).map(([v, count]) => (
              <div key={v} className="py-2 flex items-center justify-between text-xs">
                <span className="font-mono text-slate-700">{v}</span>
                <span className="font-medium text-slate-900">{count} comments</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section Distribution */}
        <div className="bg-white border border-slate-200 rounded p-3.5">
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2.5">
            Affected Sections
          </h3>
          <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto">
            {detail.sections.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No section data</p>
            ) : (
              detail.sections.map((s) => (
                <div key={s.section} className="py-2 flex items-center justify-between text-xs">
                  <span className="text-slate-700 truncate pr-2">{s.section}</span>
                  <span className="font-medium text-slate-900 shrink-0">{s.count}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stakeholder Distribution */}
        <div className="bg-white border border-slate-200 rounded p-3.5">
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2.5">
            Stakeholder Groups
          </h3>
          <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto">
            {detail.stakeholders.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No stakeholder data</p>
            ) : (
              detail.stakeholders.map((st) => (
                <div key={st.stakeholder} className="py-2 flex items-center justify-between text-xs">
                  <span className="text-slate-700 truncate pr-2">{st.stakeholder}</span>
                  <span className="font-medium text-slate-900 shrink-0">{st.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Supporting Evidence Comments */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Supporting Consultation Evidence
            </h3>
            <span className="text-[11px] text-slate-500">
              Verbatim stakeholder comments supporting this concern category
            </span>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {evidence.total.toLocaleString()} Comments in Record
          </span>
        </div>

        <div className="p-4">
          {evidenceLoading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading evidence comments...</div>
          ) : evidence.items.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">No supporting comments recorded for this category.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {evidence.items.map((comment) => (
                <div key={comment.id} className="py-3.5 first:pt-0 last:pb-0">
                  <p className="text-xs text-slate-800 leading-relaxed font-serif">
                    "{comment.text}"
                  </p>

                  {comment.argument_evidence && comment.argument_evidence !== comment.text && (
                    <p className="text-[11px] text-slate-500 italic mt-1 pl-2 border-l border-slate-200">
                      Key clause: "{comment.argument_evidence}"
                    </p>
                  )}

                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={`px-1.5 py-0.5 rounded font-medium ${sentimentColor(comment.sentiment)}`}>
                      {comment.sentiment}
                    </span>

                    {comment.detected_language && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] uppercase border border-slate-200">
                        {comment.detected_language}
                      </span>
                    )}

                    {comment.aspect && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-medium border border-indigo-100">
                        {comment.aspect}
                      </span>
                    )}

                    {comment.version && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">
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
                      to={`/comments/${comment.id}`}
                      className="ml-auto text-blue-700 hover:text-blue-900 font-medium inline-flex items-center gap-0.5"
                    >
                      Inspect Comment <ArrowRight size={10} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
              <span className="text-slate-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-2.5 py-1 border border-slate-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-medium inline-flex items-center gap-0.5"
                >
                  <ChevronLeft size={12} /> Prev
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2.5 py-1 border border-slate-200 rounded disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 font-medium inline-flex items-center gap-0.5"
                >
                  Next <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
