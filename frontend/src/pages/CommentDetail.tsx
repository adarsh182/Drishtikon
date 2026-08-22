import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getComment, getSimilarComments } from '../services/api';
import type { Comment, SimilarComment } from '../types';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { sentimentColor } from '../utils/format';
import { ArrowLeft, ArrowRight, ChevronDown, ChevronRight, Globe, Layers, Sparkles, Copy, FileText } from 'lucide-react';

const LANG_MAP: Record<string, string> = {
  en: 'English',
  hi: 'Hindi (हिन्दी)',
  mr: 'Marathi (मराठी)',
  gu: 'Gujarati (ગુજરાતી)',
  bn: 'Bengali (বাংলা)',
  ta: 'Tamil (தமிழ்)',
  te: 'Telugu (తెలుగు)',
  kn: 'Kannada (ಕನ್ನಡ)',
  ml: 'Malayalam (മലയാളം)',
  pa: 'Punjabi (ਪੰਜਾਬੀ)',
  mixed: 'Hinglish / Code-Mixed',
  unknown: 'Unspecified',
};

export default function CommentDetail() {
  const { id } = useParams();
  const [comment, setComment] = useState<Comment | null>(null);
  const [similarComments, setSimilarComments] = useState<SimilarComment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingSimilar, setLoadingSimilar] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState<boolean>(false);

  const fetchCommentDetail = () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    getComment(Number(id))
      .then((res) => {
        setComment(res);
        setLoading(false);

        // Fetch similar comments
        setLoadingSimilar(true);
        getSimilarComments(Number(id))
          .then((sim) => setSimilarComments(sim))
          .catch(() => setSimilarComments([]))
          .finally(() => setLoadingSimilar(false));
      })
      .catch((err) => {
        setError(err.friendlyMessage || err?.response?.data?.detail || 'Unable to load comment details.');
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCommentDetail();
  }, [id]);

  if (loading) return <LoadingState message="Loading comment details..." />;
  if (error) return <ErrorState message={error} onRetry={fetchCommentDetail} />;
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
  const langName = LANG_MAP[comment.detected_language || 'unknown'] || comment.detected_language || 'Unspecified';

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
          <div className="flex items-center gap-2.5">
            <div>
              <span className="text-xs font-semibold text-slate-900">
                Comment Record #{comment.id}
              </span>
              <span className="text-[11px] text-slate-500 block">
                Consultation #{comment.consultation_id}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 text-[11px] px-2 py-0.5 rounded font-medium">
              <Globe size={11} /> {langName}
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

          {comment.argument_evidence && (
            <div className="mt-3 bg-slate-50 border border-slate-200/80 rounded p-2.5 text-xs text-slate-700 flex items-start gap-2">
              <FileText size={14} className="text-slate-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-800">Extracted Argument Evidence:</span>
                <p className="italic text-slate-600 mt-0.5">"{comment.argument_evidence}"</p>
              </div>
            </div>
          )}
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
                <span className="text-slate-500">Policy Aspect</span>
                <span className="font-semibold text-slate-800">{comment.aspect || 'General'}</span>
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

        {/* Similar Comments Section (Semantic Similarity & Near Duplicates) */}
        <div className="border-t border-slate-200 p-5 bg-slate-50/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-600" />
              <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Semantically Similar Comments (Multilingual Embeddings)
              </h3>
            </div>
            <span className="text-[11px] text-slate-500">Cosine Similarity &ge; 75%</span>
          </div>

          {loadingSimilar ? (
            <p className="text-xs text-slate-400 italic">Calculating cross-lingual vector similarity...</p>
          ) : similarComments.length > 0 ? (
            <div className="space-y-2.5">
              {similarComments.map((sim) => (
                <div key={sim.comment_id} className="bg-white border border-slate-200 rounded p-3 text-xs space-y-1.5 hover:border-slate-300 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link to={`/comments/${sim.comment_id}`} className="font-mono font-medium text-blue-700 hover:underline">
                        #{sim.comment_id}
                      </Link>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                        {(sim.similarity_score * 100).toFixed(1)}% Match
                      </span>
                      {sim.detected_language && (
                        <span className="text-[10px] text-slate-500 uppercase">{sim.detected_language}</span>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${sentimentColor(sim.sentiment)}`}>
                      {sim.sentiment || 'Neutral'}
                    </span>
                  </div>
                  <p className="text-slate-800 italic font-serif">"{sim.text}"</p>
                  <div className="text-[10px] text-slate-500 flex gap-3 pt-1 border-t border-slate-100">
                    <span>Draft: {sim.version || 'v1.0'}</span>
                    <span>Stakeholder: {sim.stakeholder_type || 'Unspecified'}</span>
                    <span>Issue: {sim.issue || 'General Feedback'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No other comments exceed the semantic similarity threshold for this submission.</p>
          )}
        </div>

        {/* Technical Details Expandable */}
        <div className="border-t border-slate-200 bg-slate-50/60 p-3">
          <button
            onClick={() => setShowTechnical(!showTechnical)}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            {showTechnical ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Technical AI Methodology & Provenance
          </button>

          {showTechnical && (
            <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 text-[11px] space-y-1 font-mono text-slate-600">
              <div><strong>Sentiment Model:</strong> {comment.model_name || 'cardiffnlp/twitter-xlm-roberta-base-sentiment-multilingual'}</div>
              <div><strong>Embedding Model:</strong> sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2</div>
              <div><strong>Language Detection:</strong> {comment.detected_language || 'unknown'} (confidence: {comment.language_confidence ?? 'N/A'})</div>
              <div><strong>Aspect Confidence:</strong> {comment.aspect_confidence ?? 'N/A'}</div>
              <div><strong>Record ID:</strong> comment_id={comment.id}, consultation_id={comment.consultation_id}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

