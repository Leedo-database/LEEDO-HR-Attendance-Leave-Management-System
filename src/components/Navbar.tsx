import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  Building2, 
  Languages, 
  LogOut, 
  UserCircle, 
  Clock, 
  Calendar,
  ShieldAlert,
  ShieldCheck,
  UserCheck
} from 'lucide-react';

interface NavbarProps {
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenProfile }) => {
  const { currentUser, role, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();

  const getRoleBadge = () => {
    switch (role) {
      case 'SUPER ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
            <ShieldAlert className="w-3 h-3" />
            {t('roleSuperAdmin')}
          </span>
        );
      case 'HR ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-300">
            <ShieldCheck className="w-3 h-3" />
            {t('roleHrAdmin')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <UserCheck className="w-3 h-3" />
            {t('roleEmployee')}
          </span>
        );
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand & Organization Title */}
          <div className="flex items-center gap-3">
            <img 
              src="/leedo-logo.svg" 
              alt="LEEDO Logo" 
              className="w-10 h-10 object-contain shrink-0" 
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900 tracking-tight">LEEDO</span>
                <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-red-50 text-red-700 border border-red-200 rounded">
                  NGO • Bangladesh
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden md:block">
                {language === 'bn' ? 'উপস্থিতি ও ছুটি ব্যবস্থাপনা সিস্টেম' : 'HR Attendance & Leave Management System'}
              </p>
            </div>
          </div>

          {/* Language & Profile */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* Work Week Notice Indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-md text-[11px] font-medium">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Fri = Off | Sat = Working Day</span>
            </div>

            {/* Language Switcher */}
            <button
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition-colors"
              title="Toggle English / বাংলা"
            >
              <Languages className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('bilingualToggle')}</span>
            </button>

            {/* User Profile Pill */}
            {currentUser && (
              <div 
                onClick={onOpenProfile}
                className="flex items-center gap-2.5 pl-2 pr-3 py-1 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {currentUser.nameEn.charAt(0)}
                </div>
                <div className="hidden md:block text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 leading-tight">
                      {language === 'bn' ? currentUser.nameBn || currentUser.nameEn : currentUser.nameEn}
                    </span>
                    {getRoleBadge()}
                  </div>
                  <span className="text-[11px] text-slate-500 block leading-tight">
                    {currentUser.eid} • {currentUser.designation}
                  </span>
                </div>
              </div>
            )}

            {/* Logout */}
            <button
              onClick={logout}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors flex items-center gap-1"
              title={t('logout')}
            >
              <LogOut className="w-4 h-4 text-slate-500 group-hover:text-rose-600" />
              <span className="hidden sm:inline">{t('logout')}</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
