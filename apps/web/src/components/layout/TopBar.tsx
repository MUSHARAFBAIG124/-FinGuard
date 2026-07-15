import React, { useState, useEffect } from 'react';
import { Search, Bell, ChevronRight, Wifi } from 'lucide-react';
import { useLocation, Link, useSearchParams, useNavigate } from 'react-router-dom';

const routeMeta: Record<string, { title: string; parent?: string; parentTo?: string }> = {
  '/': { title: 'Executive Dashboard' },
  '/loans': { title: 'Loan Applications', parent: 'Platform', parentTo: '/' },
  '/reviews': { title: 'Human Review Queue', parent: 'Platform', parentTo: '/' },
  '/fraud': { title: 'Fraud Operations', parent: 'Platform', parentTo: '/' },
  '/governance': { title: 'AI Governance', parent: 'Platform', parentTo: '/' },
};

const mockAlerts = [
  { id: 1, text: 'Critical: Account takeover detected', time: '2m ago', color: 'text-red-400' },
  { id: 2, text: 'PSI drift on recent_inquiries: 0.28', time: '15m ago', color: 'text-amber-400' },
  { id: 3, text: 'New model v1.2.5 awaiting approval', time: '1h ago', color: 'text-indigo-400' },
];

export const TopBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const meta = routeMeta[location.pathname] || { title: 'Dashboard' };
  const [bellOpen, setBellOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    const newParams = new URLSearchParams(searchParams);
    if (q) {
      newParams.set('q', q);
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams);
  };

  const searchQuery = searchParams.get('q') || '';

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = currentTime.toLocaleDateString([], { month: 'short', day: 'numeric' });

  return (
    <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 border-b border-white/5 sticky top-0 z-10 bg-[#09090b]/80 backdrop-blur-xl">
      {/* Left: Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm min-w-0">
        {meta.parent && (
          <>
            <Link
              to={meta.parentTo || '/'}
              className="text-slate-500 hover:text-slate-300 transition-colors font-medium"
            >
              {meta.parent}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
          </>
        )}
        <h1 className="font-heading font-semibold text-white truncate">{meta.title}</h1>
      </div>

      {/* Right: Search + Status + Alerts + Time */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search loans, cases, alerts..."
            className="pl-9 pr-4 py-1.5 w-56 rounded-full bg-white/5 border border-white/8 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500/30 transition-all placeholder:text-slate-600 text-white"
          />
        </div>

        {/* Live status */}
        <div
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/8 border border-emerald-500/15 rounded-full"
          title="Connected to FinGuard API"
        >
          <Wifi className="w-3 h-3 text-emerald-400" />
          <span className="text-[11px] font-medium text-emerald-400">Live Data</span>
        </div>

        {/* Date/Time */}
        <div className="hidden lg:block text-right">
          <p className="text-xs font-medium text-white leading-tight">{timeStr}</p>
          <p className="text-[10px] text-slate-500">{dateStr}</p>
        </div>

        <div className="w-px h-5 bg-white/8" />

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setBellOpen((o) => !o)}
            className="relative p-2 rounded-xl hover:bg-white/5 transition-colors text-slate-400 hover:text-white"
          >
            <Bell className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 border-2 border-[#09090b] animate-pulse" />
          </button>

          {/* Notifications dropdown */}
          {bellOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setBellOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 glass-panel z-30 py-2 overflow-hidden">
                <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
                  <p className="text-sm font-semibold text-white font-heading">Notifications</p>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded border border-red-500/20">
                    {mockAlerts.length} new
                  </span>
                </div>
                <div className="divide-y divide-white/5">
                  {mockAlerts.map((a) => (
                    <div
                      key={a.id}
                      className="px-4 py-3 hover:bg-white/3 transition-colors cursor-pointer"
                    >
                      <p className={`text-xs font-medium ${a.color}`}>{a.text}</p>
                      <p className="text-[10px] text-slate-600 mt-1">{a.time}</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-white/5">
                  <button
                    onClick={() => {
                      setBellOpen(false);
                      navigate('/fraud');
                    }}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors w-full text-center"
                  >
                    View all alerts →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
