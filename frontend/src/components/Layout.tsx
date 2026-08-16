import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  AlertTriangle,
  GitCompare,
  Upload,
  FileText,
  ChevronDown,
  Menu,
  X,
} from 'lucide-react';
import { useConsultation } from '../context/ConsultationContext';

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
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleConsultationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'new') {
      navigate('/upload');
      setMobileMenuOpen(false);
    } else {
      setSelectedConsultationId(Number(val));
    }
  };

  const Branding = () => (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 flex-shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
          <circle cx="18" cy="18" r="16.5" stroke="#334155" strokeWidth="1" strokeDasharray="2 2" />
          <circle cx="18" cy="18" r="14" stroke="#64748b" strokeWidth="1.2" />
          <path d="M18 4V8M18 28V32M4 18H8M28 18H32M8.1 8.1L11 11M25 25L27.9 27.9M8.1 27.9L11 25M25 11L27.9 8.1" stroke="#94a3b8" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="18" cy="18" r="7" fill="#0f172a" stroke="#d97706" strokeWidth="1.4" />
          <circle cx="18" cy="18" r="2.8" fill="#f59e0b" />
        </svg>
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <h1 className="text-sm font-semibold tracking-wider text-white uppercase font-sans">
            Drishtikon
          </h1>
          <span className="text-[10px] font-medium text-amber-500 font-sans tracking-normal">
            दृष्टिकोण
          </span>
        </div>
        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
          E-Consultation Analytics · MCA
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Mobile Top Header */}
      <header className="lg:hidden flex items-center justify-between bg-slate-900 px-4 py-3 border-b border-slate-800 shrink-0">
        <Branding />
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="text-slate-300 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`${
          mobileMenuOpen ? 'flex' : 'hidden'
        } lg:flex w-full lg:w-60 bg-slate-900 text-slate-300 flex-col flex-shrink-0 border-r border-slate-800 z-50 absolute lg:static top-[60px] lg:top-0 bottom-0 overflow-y-auto`}
      >
        {/* Desktop Institutional Branding Header */}
        <div className="hidden lg:flex p-4 border-b border-slate-800 items-center gap-3">
          <Branding />
        </div>

        {/* Compact Dataset Selector */}
        <div className="px-4 lg:px-3 py-3 lg:py-2.5 border-b border-slate-800">
          <label htmlFor="active-dataset" className="block text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 lg:mb-1">
            Active Dataset
          </label>
          <div className="relative">
            <select
              id="active-dataset"
              value={selectedConsultationId ?? ''}
              onChange={handleConsultationChange}
              className="w-full bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-sm lg:text-xs rounded px-3 lg:px-2.5 py-2 lg:py-1.5 pr-8 appearance-none focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer truncate"
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
            <ChevronDown size={14} className="absolute right-2.5 lg:right-2 top-2.5 lg:top-2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 lg:p-2.5 space-y-1 lg:space-y-0.5" aria-label="Main navigation">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 lg:gap-2.5 px-3 py-2.5 lg:py-2 rounded text-sm lg:text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`
              }
            >
              <Icon size={18} className="shrink-0 text-slate-400 lg:w-[15px] lg:h-[15px]" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Page Content */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
