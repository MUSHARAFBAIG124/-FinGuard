import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  FileText,
  UserCheck,
  ShieldAlert,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard, exact: true },
  { name: 'Loan Applications', to: '/loans', icon: FileText },
  { name: 'Human Review', to: '/reviews', icon: UserCheck },
  { name: 'Fraud Operations', to: '/fraud', icon: ShieldAlert },
  { name: 'AI Governance', to: '/governance', icon: Activity },
];

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setCollapsed(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <aside
      className={cn(
        'flex-shrink-0 flex flex-col border-r border-white/5 h-screen sticky top-0 z-20 transition-all duration-300 ease-out',
        'bg-[#09090b]',
        collapsed ? 'w-16' : 'w-64',
      )}
      style={{
        background: 'linear-gradient(180deg, rgba(9,9,11,0.98) 0%, rgba(12,12,16,0.98) 100%)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Logo */}
      <div
        className={cn(
          'h-16 flex items-center border-b border-white/5 flex-shrink-0 transition-all duration-300',
          collapsed ? 'px-3 justify-center' : 'px-5 justify-between',
        )}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/25">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <span className="font-heading font-bold text-lg text-white leading-none block">
                FinGuard
              </span>
              <span className="text-[10px] font-medium text-emerald-400 tracking-widest uppercase leading-none">
                AI Platform
              </span>
            </div>
          </div>
        )}

        {collapsed && (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <Zap className="w-4 h-4 text-white" />
          </div>
        )}

        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            'flex-shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors',
            collapsed &&
              'absolute -right-3 top-12 bg-[#18181b] border border-white/10 rounded-full p-1 shadow-lg z-30',
          )}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-3.5 h-3.5" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-5 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <p className="px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-3">
            Navigation
          </p>
        )}

        {navItems.map((item) => {
          const isActive = item.exact
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.name}
              to={item.to}
              end={item.exact}
              title={collapsed ? item.name : undefined}
              className={() =>
                cn(
                  'flex items-center gap-3 rounded-xl transition-all duration-200 font-medium text-sm relative group',
                  collapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2.5',
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5',
                )
              }
            >
              {/* Active left accent */}
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-400 rounded-r-full" />
              )}

              <item.icon
                className={cn(
                  'w-[18px] h-[18px] flex-shrink-0 transition-colors',
                  isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300',
                )}
              />

              {!collapsed && <span className="truncate">{item.name}</span>}

              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#1c1c20] border border-white/10 rounded-lg text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl z-50">
                  {item.name}
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom */}
      <div
        className={cn(
          'p-2 border-t border-white/5 space-y-1',
          collapsed && 'flex flex-col items-center',
        )}
      >
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl hover:bg-white/5 hover:text-slate-200 transition-colors font-medium text-sm group relative',
              collapsed ? 'px-0 py-2.5 justify-center w-full' : 'px-3 py-2.5 w-full',
              isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-500',
            )
          }
          title={collapsed ? 'Settings' : undefined}
        >
          <Settings
            className={cn(
              'w-[18px] h-[18px] flex-shrink-0 transition-colors',
              location.pathname === '/settings'
                ? 'text-emerald-400'
                : 'text-slate-500 group-hover:text-slate-300',
            )}
          />
          {!collapsed && <span>Settings</span>}
          {collapsed && (
            <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#1c1c20] border border-white/10 rounded-lg text-xs font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-xl z-50">
              Settings
            </div>
          )}
        </NavLink>

        {!collapsed && user && (
          <div
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
            onClick={() => void logout()}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {user.firstName[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white leading-tight truncate">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {user.role.replace('_', ' ')} (Click to logout)
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
