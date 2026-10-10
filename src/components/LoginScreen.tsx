import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useOrgSettings } from '../context/OrgSettingsContext';
import { 
  Building2, 
  KeyRound, 
  User, 
  AlertCircle, 
  Languages, 
  Check, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { loginWithEid, loginWithGoogle, isLoading } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const { logoUrl } = useOrgSettings();

  const [eid, setEid] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    const res = await loginWithEid(eid, password);
    if (!res.success) {
      setErrorMsg(res.error || 'Authentication failed. Please verify your EID and password.');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col justify-center items-center p-4">
      
      {/* Language Switcher Top Right */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          onClick={toggleLanguage}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 backdrop-blur-xs border border-white/20 transition-all"
        >
          <Languages className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t('bilingualToggle')}</span>
        </button>
      </div>

      <div className="w-full max-w-md">
        
        {/* Brand Card */}
        <div className="text-center mb-6">
          <img 
            src={logoUrl || "/leedo-logo.svg"} 
            alt="LEEDO Logo" 
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/leedo-logo.svg';
            }}
            className="w-16 h-16 mx-auto mb-3 object-contain drop-shadow-md rounded" 
          />
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            LEEDO
          </h1>
          <p className="text-xs text-red-400 font-bold uppercase tracking-wider">
            Local Education and Economic Development Organization
          </p>
          <p className="text-[11px] text-slate-300 mt-1 max-w-xs mx-auto">
            {language === 'bn' 
              ? 'এইচআর উপস্থিতি ও ছুটি ব্যবস্থাপনা সিস্টেম (NGO Standard)' 
              : 'HR Attendance, Timesheet & Leave Management System'}
          </p>
        </div>

        {/* Login Form Box */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 border border-slate-200">
          
          <h2 className="text-base font-bold text-slate-900 mb-1 text-center">
            Sign In with Employee ID (EID)
          </h2>
          <p className="text-xs text-slate-500 mb-6 text-center">
            Enter your assigned LEEDO credentials to continue
          </p>

          {errorMsg && (
            <div className="p-3 mb-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Employee ID (EID)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={eid}
                  onChange={(e) => setEid(e.target.value.toUpperCase())}
                  placeholder="e.g. EMP-1001, HR-2001"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In to System</span>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="h-px bg-slate-200 flex-1" />
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">or</span>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          {/* Google Sign In */}
          <button
            onClick={loginWithGoogle}
            className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign In with Google Account</span>
          </button>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-slate-400 text-xs">
          © {new Date().getFullYear()} LEEDO Bangladesh • Head Office: Dhaka
        </div>

      </div>
    </div>
  );
};
