import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConsultation } from '../context/ConsultationContext';
import { getConsultations, getDashboard } from '../services/api';
import type { Consultation, DashboardData } from '../types';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { Check, ArrowRight, Plus } from 'lucide-react';

interface ConsultationRowData {
  consultation: Consultation;
  dash?: DashboardData;
}

export default function Consultations() {
  const { selectedConsultationId, setSelectedConsultationId, loading: contextLoading } = useConsultation();
  const [rows, setRows] = useState<ConsultationRowData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    getConsultations()
      .then(async (list) => {
        if (!active) return;
        const rowList: ConsultationRowData[] = [];
        for (const c of list) {
          try {
            const dash = await getDashboard(c.id);
            rowList.push({ consultation: c, dash });
          } catch {
            rowList.push({ consultation: c });
          }
        }
        if (active) {
          setRows(rowList);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err?.response?.data?.detail || 'Unable to load consultations.');
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (contextLoading || loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Consultation Datasets</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage and switch between loaded policy consultation feedback archives
          </p>
        </div>

        <Link
          to="/upload"
          className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium px-3.5 py-1.5 rounded transition-colors self-start sm:self-auto"
        >
          <Plus size={13} /> Upload New Dataset
        </Link>
      </div>

      {/* Consultations Management Table */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 w-1/3">Consultation Title</th>
                <th className="py-2.5 px-4 text-center">Comments</th>
                <th className="py-2.5 px-4 text-center">Positive %</th>
                <th className="py-2.5 px-4 text-center">Negative %</th>
                <th className="py-2.5 px-4 text-center">Versions</th>
                <th className="py-2.5 px-4 text-center">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400">
                    No consultation datasets found. Upload a CSV to begin.
                  </td>
                </tr>
              ) : (
                rows.map(({ consultation: c, dash }) => {
                  const isSelected = selectedConsultationId === c.id;
                  const total = dash ? dash.kpis.total.toLocaleString() : '—';
                  const pos = dash ? `${dash.kpis.positive_pct}%` : '—';
                  const neg = dash ? `${dash.kpis.negative_pct}%` : '—';
                  const versions = dash ? dash.versions.map((v) => v.version_number).join(' → ') : '—';

                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-slate-50/60' : ''
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-900" title="Active Dataset" />
                          ) : (
                            <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
                          )}
                          <div>
                            <Link
                              to={`/consultations/${c.id}`}
                              className="font-semibold text-slate-900 hover:text-blue-700 block"
                            >
                              {c.title}
                            </Link>
                            <span className="text-[11px] text-slate-500 block truncate max-w-sm">
                              {c.description || `ID: #${c.id}`}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center font-medium text-slate-800">
                        {total}
                      </td>

                      <td className="py-3 px-4 text-center font-medium text-emerald-700">
                        {pos}
                      </td>

                      <td className="py-3 px-4 text-center font-medium text-rose-700">
                        {neg}
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-[11px] text-slate-600">
                        {versions}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-700 capitalize font-medium">
                          {c.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {isSelected ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-900 bg-slate-200/70 px-2 py-1 rounded">
                              <Check size={11} /> Selected
                            </span>
                          ) : (
                            <button
                              onClick={() => setSelectedConsultationId(c.id)}
                              className="text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded transition-colors"
                            >
                              Select
                            </button>
                          )}

                          <Link
                            to={`/consultations/${c.id}`}
                            className="text-blue-700 hover:text-blue-900 font-medium inline-flex items-center"
                            title="View Consultation Summary"
                          >
                            <ArrowRight size={13} />
                          </Link>
                        </div>
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
