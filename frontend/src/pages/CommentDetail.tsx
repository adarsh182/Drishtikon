import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getComment } from '../services/api';
import type { Comment } from '../types';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { sentimentColor } from '../utils/format';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';

export default function CommentDetail() {
  const { id } = useParams();
  const [comment, setComment] = useState<Comment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState<boolean>(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    setError(null);

    getComment(Number(id))
      .then((res) => {
        if (active) {
          setComment(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err?.response?.data?.detail || 'Unable to load comment details.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!comment) {
    return (
      <div className="bg-white rounded border border-slate-200 p-8 text-center max-w-md mx-auto mt-12">
        <h2 className="text-sm font-semibold text-slate-800">Comment Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">Could not locate comment record #{id}.</p>
        <Link
          to="/comments"
          className="inline-block bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-3.5 py-2 rounded transition-colors"
        >
          Back to Comments
        </Link>
      </div>
    );
  }

  const confidencePct = comment.confidence != null ? `${Math.round(comment.confidence * 100)}%` : '—';

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Navigation Breadcrumb */}
      <div>
        <Link
          to="/comments"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={13} /> Back to Comments Record
        </Link>
      </div>

      {/* Main Comment Inspector Card */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <span className="text-xs font-semibold text-slate-900">
              Comment Record #{comment.id}
            </span>
            <span className="text-[11px] text-slate-500 block">
              Consultation #{comment.consultation_id}
            </span>
          </div>
          <span className={`text-xs px-2.5 py-0.5 rounded font-medium ${sentimentColor(comment.sentiment)}`}>
            {comment.sentiment || 'Neutral'}
          </span>
        </div>

        {/* Verbatim Comment Text Block */}
        <div className="p-5 border-b border-slate-200 bg-white">
          <label className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-2">
            Verbatim Submission
          </label>
          <blockquote className="text-sm text-slate-900 font-serif leading-relaxed pl-3 border-l-2 border-slate-300">
            "{comment.text}"
          </blockquote>
        </div>

        {/* Analysis & Context Information Table */}
        <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100 p-5 gap-5">
          {/* Classification Analysis */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Classification Analysis
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Classified Sentiment</span>
                <span className="font-semibold text-slate-800">{comment.sentiment || 'Neutral'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Sentiment Confidence</span>
                <span className="font-mono text-slate-700">{confidencePct}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Detected Concern Category</span>
                <span className="font-semibold text-slate-800">{comment.issue || 'General Feedback'}</span>
              </div>
            </div>

            {comment.issue && (
              <div className="pt-2">
                <Link
                  to={`/issues/${comment.consultation_id}/${encodeURIComponent(comment.issue)}`}
                  className="text-xs font-medium text-blue-700 hover:text-blue-900 inline-flex items-center gap-1"
                >
                  View other comments about this issue <ArrowRight size={11} />
                </Link>
              </div>
            )}
          </div>

          {/* Consultation Context */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Consultation Context
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Policy Draft Version</span>
                <span className="font-mono font-medium text-slate-800">{comment.version || 'v1.0'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Stakeholder Group</span>
                <span className="font-medium text-slate-800">{comment.stakeholder_type || 'Unspecified'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Document Section</span>
                <span className="font-medium text-slate-800">{comment.section || 'General'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Subsection</span>
                <span className="text-slate-700">{comment.subsection || '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Small Technical Details Expandable (For Judging / Demo Verification) */}
        <div className="border-t border-slate-200 bg-slate-50/60 p-3">
          <button
            onClick={() => setShowTechnical(!showTechnical)}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            {showTechnical ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Technical Analysis Details
          </button>

          {showTechnical && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 text-[11px] space-y-1 font-mono text-slate-600">
              <div><strong>Inference Model:</strong> {comment.model_name || 'keyword-fallback-v1'}</div>
              <div><strong>Raw Confidence Score:</strong> {comment.confidence ?? 'N/A'}</div>
              <div><strong>Record ID:</strong> comment_id={comment.id}, consultation_id={comment.consultation_id}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
