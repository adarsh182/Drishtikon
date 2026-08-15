import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useConsultation } from '../context/ConsultationContext';
import { getConsultation, getDashboard } from '../services/api';
import type { Consultation, DashboardData } from '../types';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { priorityColor } from '../utils/format';
import { ArrowLeft, GitCompare, LayoutDashboard, ArrowRight } from 'lucide-react';

export default function ConsultationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setSelectedConsultationId } = useConsultation();
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    Promise.all([getConsultation(Number(id)), getDashboard(Number(id))])
      .then(([c, d]) => {
        setConsultation(c);
        setDashboard(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.response?.data?.detail || 'Unable to load consultation details.');
        setLoading(false);
      });
  }, [id]);

  const handleSetActiveAndGoToDashboard = () => {
    if (id) {
      setSelectedConsultationId(Number(id));
      navigate('/');
    }
  };

  const handleSetActiveAndGoToEvolution = () => {
    if (id) {
      setSelectedConsultationId(Number(id));
      navigate('/evolution');
    }
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!consultation || !dashboard) return null;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <Link
          to="/consultations"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={13} /> Back to Consultations
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white p-4 rounded border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{consultation.title}</h2>
            <span className="text-[11px] px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700 capitalize">
              {consultation.status}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {consultation.description || 'Public consultation feedback dataset'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSetActiveAndGoToDashboard}
            className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
          >
            <LayoutDashboard size={13} /> Open Dashboard
          </button>
          <button
            onClick={handleSetActiveAndGoToEvolution}
            className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium px-3 py-1.5 rounded border border-slate-200 transition-colors"
          >
            <GitCompare size={13} /> Policy Evolution
          </button>
        </div>
      </div>

      {/* Compact KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded border border-slate-200 p-3">
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Total Comments</p>
          <p className="text-xl font-semibold text-slate-900 mt-0.5">{dashboard.kpis.total.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded border border-slate-200 p-3">
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Positive Support</p>
          <p className="text-xl font-semibold text-emerald-700 mt-0.5">{dashboard.kpis.positive_pct}%</p>
        </div>
        <div className="bg-white rounded border border-slate-200 p-3">
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Negative Concern</p>
          <p className="text-xl font-semibold text-rose-700 mt-0.5">{dashboard.kpis.negative_pct}%</p>
        </div>
        <div className="bg-white rounded border border-slate-200 p-3">
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">Draft Versions</p>
          <p className="text-xl font-semibold text-slate-900 mt-0.5">{consultation.versions?.length || 0}</p>
        </div>
      </div>

      {/* Draft Versions */}
      <div className="bg-white rounded border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider mb-3">
          Draft Policy Versions
        </h3>
        <div className="grid sm:grid-cols-3 gap-2.5">
          {consultation.versions?.map((v) => (
            <div key={v.id} className="border border-slate-200 bg-slate-50/50 rounded p-3 text-xs">
              <span className="font-mono font-semibold text-slate-900">{v.version_number}</span>
              <p className="text-slate-500 mt-0.5">{v.comment_count.toLocaleString()} comments processed</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top Concerns */}
      <div className="bg-white rounded border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-900 text-xs uppercase tracking-wider">Key Identified Issues</h3>
          <Link to={`/comments?consultation_id=${id}`} className="text-xs font-medium text-blue-700 hover:text-blue-900">
            View All Comments →
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {dashboard.top_issues.map((issue) => (
            <Link
              key={issue.issue}
              to={`/issues/${id}/${encodeURIComponent(issue.issue)}`}
              className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 rounded transition-colors group"
            >
              <div>
                <span className="font-medium text-xs text-slate-900 group-hover:text-blue-700">
                  {issue.issue}
                </span>
                <p className="text-[11px] text-slate-500">{issue.count} comments</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${priorityColor(issue.priority)}`}>
                  {issue.priority} · {issue.negative_pct}% negative
                </span>
                <ArrowRight size={12} className="text-slate-400 group-hover:text-slate-700" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
