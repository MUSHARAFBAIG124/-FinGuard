import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  User,
  Mail,
  Shield,
  Server,
  Database,
  Brain,
  Activity,
  Settings as SettingsIcon,
  Bell,
  Key,
  Moon,
  Monitor,
  Loader2,
} from 'lucide-react';
import { useAIGovernance } from '../governance/useAIGovernance';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const { activeModelVersion, isLoading: aiLoading } = useAIGovernance();

  const [activeTab, setActiveTab] = useState('profile');

  const envName = 'Production';

  const tabs = [
    { id: 'profile', name: 'Profile & Account', icon: User },
    { id: 'system', name: 'System Status', icon: Server },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Key },
    { id: 'appearance', name: 'Appearance', icon: Moon },
  ];

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-heading font-bold text-white mb-1">Platform Settings</h2>
        <p className="text-slate-400 text-sm">
          Manage your account preferences and view system status.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Nav */}
        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="glass-panel p-2 flex flex-row lg:flex-col gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-brand-primary/15 text-brand-primary'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="glass-panel p-6 space-y-8">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-3xl font-heading font-bold text-white shadow-xl">
                  {user?.firstName?.[0] || 'U'}
                </div>
                <div>
                  <h3 className="text-xl font-heading font-bold text-white">
                    {user?.firstName} {user?.lastName}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5" /> {user?.email}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Role
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl">
                    <Shield className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm text-white font-medium">
                      {user?.role?.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Account Status
                  </label>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400 font-medium">Active</span>
                  </div>
                </div>
              </div>

              <div className="pt-5 border-t border-white/5">
                <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-lg text-sm font-medium transition-all">
                  Edit Profile
                </button>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-5">
              <div className="glass-panel p-6">
                <h3 className="text-lg font-heading font-bold text-white mb-4">
                  Environment Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white/3 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                        <Monitor className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Current Environment</p>
                        <p className="text-sm font-semibold text-white">{envName}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/3 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                        <Server className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">API Status</p>
                        <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{' '}
                          Operational
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/3 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                        <Database className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">MongoDB Database</p>
                        <p className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{' '}
                          Operational
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/3 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                        <Brain className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">AI Risk Engine</p>
                        <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{' '}
                          Operational
                          {aiLoading ? (
                            <Loader2 className="w-3 h-3 animate-spin text-slate-500 ml-1" />
                          ) : (
                            <span className="text-xs text-slate-500 ml-1 font-mono font-normal bg-white/5 px-1.5 rounded">
                              v{activeModelVersion}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {['notifications', 'security', 'appearance'].includes(activeTab) && (
            <div className="glass-panel p-6 flex flex-col items-center justify-center min-h-[300px] text-center">
              <SettingsIcon className="w-10 h-10 text-slate-600 mb-3" />
              <h3 className="text-lg font-heading font-medium text-white mb-1">Coming Soon</h3>
              <p className="text-sm text-slate-400 max-w-sm">
                This section of the settings panel is currently under construction and will be
                available in the next release.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
