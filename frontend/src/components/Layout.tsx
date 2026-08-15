import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  AlertTriangle,
  GitCompare,
  Upload,
  FileText,
  Download,
  ChevronDown,
} from 'lucide-react';
import { useConsultation } from '../context/ConsultationContext';
import { getDemoDownloadUrl } from '../services/api';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/evolution', label: 'Policy Evolution', icon: GitCompare },
  { to: '/issues', label: 'Issues & Evidence', icon: AlertTriangle },
  { to: '/comments', label: 'Comments', icon: MessageSquare },
  { to: '/consultations', label: 'Consultations', icon: FileText },
  { to: '/upload', label: 'Upload CSV', icon: Upload },
];

export default function Layout() {
  const { consultations, selectedConsultationId, setSelectedConsultationId } = useConsultation();
  const navigate = useNavigate();

  const handleConsultationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'new') {
      navigate('/upload');
    } else {
      setSelectedConsultationId(Number(val));
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 border-r border-slate-800">
        {/* Header */}
        <div className="p-4 border-b border-slate-800">
          <h1 className="text-sm font-semibold text-white tracking-tight">MCA PolicyLens</h1>
          <p className="text-xs text-slate-400">E-Consultation Analytics</p>
        </div>

        {/* Compact Dataset Selector */}
        <div className="px-3 py-2.5 border-b border-slate-800">
          <label htmlFor="active-dataset" className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
            Active Dataset
          </label>
          <div className="relative">
            <select
              id="active-dataset"
              value={selectedConsultationId ?? ''}
              onChange={handleConsultationChange}
              className="w-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded px-2.5 py-1.5 pr-7 appearance-none focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer truncate"
            >
              {consultations.length === 0 ? (
                <option value="">No consultations loaded</option>
              ) : (
                consultations.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} · {c.title}
                  </option>
                ))
              )}
              <option value="new">+ Upload new dataset</option>
            </select>
            <ChevronDown size={13} className="absolute right-2 top-2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2.5 space-y-0.5" aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`
              }
            >
              <Icon size={15} className="shrink-0 text-slate-400" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer Actions */}
        <div className="p-3 border-t border-slate-800">
          <a
            href={getDemoDownloadUrl()}
            download="mca_econsultation_demo.csv"
            className="flex items-center justify-center gap-1.5 w-full py-1.5 px-2 bg-slate-800/70 hover:bg-slate-800 text-slate-300 hover:text-white rounded text-xs font-medium border border-slate-700/60 transition-colors"
          >
            <Download size={13} className="text-slate-400" />
            Download Demo CSV
          </a>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Subtle Top Banner */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-1.5 text-xs text-slate-600 flex items-center justify-between">
          <span>
            <strong className="font-semibold text-slate-700">DEMO DATA</strong> · Synthetic consultation dataset
          </span>
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            Ministry of Corporate Affairs
          </span>
        </div>

        {/* Page Content */}
        <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
