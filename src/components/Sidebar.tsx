import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  LayoutDashboard,
  CalendarCheck,
  CalendarDays,
  FileSpreadsheet,
  Clock,
  Briefcase,
  Users,
  CheckCircle2,
  UploadCloud,
  FileText,
  History,
  Settings,
  ShieldCheck,
  User,
  KeyRound
} from 'lucide-react';

import { Employee } from '../types';
import { canUserVerifyAttendance } from '../lib/supervisorUtils';

export type NavTab =
  | 'dashboard'
  | 'profile'
  | 'daily-attendance'
  | 'monthly-register'
  | 'timesheet'
  | 'calendar'
  | 'leave'
  | 'employees'
  | 'verification'
  | 'upload-archive'
  | 'reports'
  | 'audit-logs'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  employees?: Employee[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  employees = [],
}) => {
  const { role, currentUser } = useAuth();
  const { t, language } = useLanguage();

  const isHrOrSuper = role === 'HR ADMIN' || role === 'SUPER ADMIN';
  const canVerify = isHrOrSuper || canUserVerifyAttendance(currentUser, employees);

  const employeeNavItems = [
    { id: 'dashboard' as NavTab, label: t('navDashboard'), icon: LayoutDashboard },
    { id: 'timesheet' as NavTab, label: language === 'bn' ? 'মাসিক টাইম শিট (Timesheet)' : 'Monthly Timesheet', icon: FileText },
    ...(canVerify ? [{ id: 'verification' as NavTab, label: language === 'bn' ? 'উপস্থিতি অনুমোদন ও যাচাই' : 'Attendance Verification', icon: CheckCircle2 }] : []),
    { id: 'daily-attendance' as NavTab, label: t('navDailyAttendance'), icon: Clock },
    { id: 'monthly-register' as NavTab, label: t('navMonthlyRegister'), icon: FileSpreadsheet },
    { id: 'calendar' as NavTab, label: t('navCalendar'), icon: CalendarDays },
    { id: 'leave' as NavTab, label: t('navMyLeave'), icon: Briefcase },
    { id: 'upload-archive' as NavTab, label: language === 'bn' ? 'রেজিস্টার আপলোড ও আর্কাইভ' : 'Register Upload & Archive', icon: UploadCloud },
    { id: 'profile' as NavTab, label: t('navMyProfile'), icon: User },
  ];

  const hrNavItems = [
    { id: 'dashboard' as NavTab, label: t('navHrDashboard'), icon: LayoutDashboard },
    { id: 'employees' as NavTab, label: t('navEmployees'), icon: Users },
    { id: 'timesheet' as NavTab, label: language === 'bn' ? 'মাসিক টাইম শিট (Timesheets)' : 'Staff Timesheets', icon: FileText },
    { id: 'daily-attendance' as NavTab, label: t('navDailyAttendance'), icon: Clock },
    { id: 'monthly-register' as NavTab, label: t('navMonthlyRegister'), icon: FileSpreadsheet },
    { id: 'calendar' as NavTab, label: t('navCalendar'), icon: CalendarDays },
    { id: 'verification' as NavTab, label: t('navHrVerification'), icon: CheckCircle2 },
    { id: 'leave' as NavTab, label: t('navLeaveManagement'), icon: Briefcase },
    { id: 'upload-archive' as NavTab, label: t('navRegisterUpload'), icon: UploadCloud },
    { id: 'reports' as NavTab, label: t('navReports'), icon: FileText },
    { id: 'audit-logs' as NavTab, label: t('navAuditLogs'), icon: History },
    { id: 'settings' as NavTab, label: t('navSettings'), icon: Settings },
  ];

  const navItems = isHrOrSuper ? hrNavItems : employeeNavItems;

  const handleItemClick = (id: NavTab) => {
    onSelectTab(id);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-16 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Organization Mini Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
              LD
            </div>
            <div>
              <p className="text-xs font-semibold text-white tracking-wide uppercase">
                {isHrOrSuper ? 'HR Administration' : 'Employee Portal'}
              </p>
              <p className="text-[11px] text-slate-400 truncate max-w-[170px]">
                {currentUser?.department || 'LEEDO Bangladesh'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer info: Friday weekly off reminder */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60">
          <div className="text-[11px] text-slate-400 leading-relaxed">
            <span className="text-emerald-400 font-semibold block mb-0.5">LEEDO Work Hours:</span>
            Sat – Thu: 9:00 AM – 5:00 PM<br />
            <span className="text-amber-400 font-medium">Friday: Weekly Off</span>
          </div>
        </div>
      </aside>
    </>
  );
};
