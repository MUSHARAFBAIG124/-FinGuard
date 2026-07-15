import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Activity,
  Zap,
  Lock,
  Brain,
  TrendingUp,
  Shield,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// ── Animated background nodes ──────────────────────────────────────────────────

const FloatingOrb = ({ className }: { className: string }) => (
  <div
    className={`absolute rounded-full blur-[80px] animate-pulse-slow pointer-events-none ${className}`}
  />
);

const FeatureBadge = ({
  icon: Icon,
  text,
  sub,
  color,
  delay,
}: {
  icon: React.ElementType;
  text: string;
  sub: string;
  color: string;
  delay: string;
}) => (
  <div
    className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/8 backdrop-blur-sm"
    style={{ animation: `slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay} both` }}
  >
    <div className={`p-2 rounded-lg ${color} flex-shrink-0`}>
      <Icon className="w-4 h-4" />
    </div>
    <div>
      <p className="text-xs font-semibold text-white leading-tight">{text}</p>
      <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#07070a] relative overflow-hidden">
      {/* ── Animated background ─────────────────────────────────────────────── */}
      <FloatingOrb className="top-[-15%] left-[-5%] w-[500px] h-[500px] bg-emerald-600/10" />
      <FloatingOrb className="bottom-[-10%] right-[-5%] w-[600px] h-[500px] bg-indigo-600/10" />
      <FloatingOrb className="top-[50%] left-[40%] w-[400px] h-[400px] bg-purple-600/6" />

      {/* ── Grid overlay ────────────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* ── Left Panel: Branding ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] flex-shrink-0 p-12 relative z-10 border-r border-white/5">
        {/* Logo */}
        <div style={{ animation: 'fadeIn 0.5s ease-out both' }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-lg font-heading font-bold text-white leading-none">FinGuard AI</p>
              <p className="text-[10px] text-emerald-400 font-medium tracking-widest uppercase leading-tight">
                Enterprise Platform
              </p>
            </div>
          </div>
        </div>

        {/* Hero text */}
        <div className="space-y-8">
          <div style={{ animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both' }}>
            <h1 className="text-4xl font-heading font-bold text-white leading-tight mb-4">
              AI-Powered
              <br />
              <span className="gradient-text">Credit Risk</span>
              <br />
              Management
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Enterprise-grade risk assessment with explainable AI, real-time fraud detection, and
              model governance. Built for teams who demand precision.
            </p>
          </div>

          {/* Feature badges */}
          <div className="space-y-3">
            <FeatureBadge
              icon={Brain}
              text="SHAP Explainability"
              sub="Transparent AI decisions, every time"
              color="bg-indigo-500/15 border border-indigo-500/20 text-indigo-400"
              delay="0.2s"
            />
            <FeatureBadge
              icon={Activity}
              text="PSI Drift Detection"
              sub="Real-time model health monitoring"
              color="bg-amber-500/15 border border-amber-500/20 text-amber-400"
              delay="0.3s"
            />
            <FeatureBadge
              icon={Shield}
              text="Fraud Detection Engine"
              sub="Rule-based + ML anomaly detection"
              color="bg-red-500/15 border border-red-500/20 text-red-400"
              delay="0.4s"
            />
            <FeatureBadge
              icon={TrendingUp}
              text="Model Registry"
              sub="Full governance lifecycle management"
              color="bg-emerald-500/15 border border-emerald-500/20 text-emerald-400"
              delay="0.5s"
            />
          </div>
        </div>

        {/* Stats row */}
        <div
          className="grid grid-cols-3 gap-4 pt-6 border-t border-white/5"
          style={{ animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.6s both' }}
        >
          {[
            { value: '95.2%', label: 'Model Accuracy' },
            { value: '< 50ms', label: 'Inference Time' },
            { value: '0.978', label: 'ROC AUC Score' },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-xl font-heading font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Panel: Login Form ──────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div
          className="w-full max-w-sm"
          style={{ animation: 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both' }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-emerald-500/20 to-indigo-600/20 border border-emerald-500/30 rounded-2xl mb-3">
              <Zap className="w-7 h-7 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-heading font-bold text-white">FinGuard AI</h1>
            <p className="text-slate-400 text-sm mt-1">Enterprise Credit Risk Platform</p>
          </div>

          {/* Card */}
          <div className="glass-panel p-8">
            {/* Card header */}
            <div className="mb-7">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="w-4 h-4 text-emerald-400" />
                <h2 className="text-lg font-heading font-semibold text-white">Secure Sign In</h2>
              </div>
              <p className="text-slate-400 text-sm">Access your risk management dashboard</p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="flex items-start gap-3 p-3 mb-5 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/40 transition-all"
                  placeholder="you@finguard.ai"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 pr-11 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/40 transition-all"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 active:scale-[0.98]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Sign in securely
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 border-t border-white/5 pt-4 text-center text-[10px] text-slate-600">
              Authentication is verified against the FinGuard API.
            </p>
          </div>

          <p className="text-center text-xs text-slate-700 mt-5">
            FinGuard AI Platform · Portfolio Demo v1.0
          </p>
        </div>
      </div>
    </div>
  );
};
