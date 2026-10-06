import React, { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { AttendanceRecord, Holiday, LeaveRecord } from '../../types';
import { 
  Clock, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Briefcase, 
  CalendarDays,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  CalendarCheck
} from 'lucide-react';
import { calculateMonthlyAttendance, isFriday, ATTENDANCE_STATUS_COLORS } from '../../lib/attendanceCalculator';

interface EmployeeDashboardViewProps {
  attendanceRecords: AttendanceRecord[];
  holidays: Holiday[];
  leaveRecords: LeaveRecord[];
  onOpenDailyModal: () => void;
  onNavigateToTab: (tab: any) => void;
  isMonthLocked: boolean;
}

export const EmployeeDashboardView: React.FC<EmployeeDashboardViewProps> = ({
  attendanceRecords,
  holidays,
  leaveRecords,
  onOpenDailyModal,
  onNavigateToTab,
  isMonthLocked,
}) => {
  const { currentUser } = useAuth();
  const { t, language } = useLanguage();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const todayStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Find today's record
  const todayRecord = useMemo(() => {
    return attendanceRecords.find(a => a.date === todayStr);
  }, [attendanceRecords, todayStr]);

  // Current month records
  const currentMonthRecords = useMemo(() => {
    const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    return attendanceRecords.filter(a => a.month === monthKey);
  }, [attendanceRecords, currentYear, currentMonth]);

  // Monthly calculated statistics
  const summary = useMemo(() => {
    return calculateMonthlyAttendance(currentYear, currentMonth, currentMonthRecords, holidays);
  }, [currentYear, currentMonth, currentMonthRecords, holidays]);

  // Calculate annual leave balances for current employee
  const leaveBalance = useMemo(() => {
    let clUsed = 0;
    let slUsed = 0;
    let alUsed = 0;

    leaveRecords.forEach(l => {
      if (l.status === 'Verified' || l.status === 'Unverified') {
        if (l.leaveType === 'Casual Leave') clUsed += l.totalDays;
        else if (l.leaveType === 'Sick Leave') slUsed += l.totalDays;
        else if (l.leaveType === 'Annual Leave') alUsed += l.totalDays;
      }
    });

    // LEEDO Annual Entitlement standard: CL=14, SL=14, AL=18
    return {
      clTotal: 14,
      clUsed,
      clRem: Math.max(0, 14 - clUsed),
      slTotal: 14,
      slUsed,
      slRem: Math.max(0, 14 - slUsed),
      alTotal: 18,
      alUsed,
      alRem: Math.max(0, 18 - alUsed),
    };
  }, [leaveRecords]);

  // Upcoming holidays
  const upcomingHolidays = useMemo(() => {
    return holidays
      .filter(h => h.date >= todayStr)
      .slice(0, 3);
  }, [holidays, todayStr]);

  const friday = isFriday(todayStr);

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider bg-white/10 px-2.5 py-1 rounded-md text-emerald-200">
            LEEDO Employee Portal
          </span>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-2">
            Welcome, {currentUser?.nameEn}!
          </h1>
          <p className="text-xs text-emerald-100 mt-1">
            {currentUser?.designation} • {currentUser?.department} ({currentUser?.eid})
          </p>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-white border border-white/30">
            <Clock className="w-3 h-3 text-amber-300" />
            <span>
              Schedule: {currentUser?.workingDaysPerWeek || 6} Days/Week ({currentUser?.dailyHours || 8}h/day, {currentUser?.standardInTime || '09:00 AM'} - {currentUser?.standardOutTime || '05:00 PM'})
            </span>
          </div>
        </div>

        {/* Quick Submit Attendance CTA */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
          {todayRecord ? (
            <div className="px-4 py-2.5 bg-white/15 border border-white/20 rounded-xl text-center">
              <span className="text-[11px] text-emerald-200 block">Today's Attendance</span>
              <span className="text-sm font-bold text-white flex items-center justify-center gap-1.5 mt-0.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                Submitted ({todayRecord.status})
              </span>
            </div>
          ) : (
            <button
              onClick={onOpenDailyModal}
              disabled={isMonthLocked}
              className="px-4 py-2.5 bg-white hover:bg-emerald-50 text-emerald-900 text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Clock className="w-4 h-4 text-emerald-700" />
              <span>{t('submitDailyAttendance')}</span>
            </button>
          )}

          <button
            onClick={() => onNavigateToTab('timesheet')}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
            title="Open official NGO Timesheet to print"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Monthly Timesheet</span>
          </button>

          <button
            onClick={() => onNavigateToTab('monthly-register')}
            className="px-4 py-2.5 bg-emerald-700/80 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl border border-white/20 transition-all flex items-center justify-center gap-1.5"
          >
            <span>Register</span>
          </button>
        </div>
      </div>

      {/* Month Lock Banner if locked */}
      {isMonthLocked && (
        <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{t('monthLockedNotice')}</span>
        </div>
      )}

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Present Days */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Present This Month</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">{summary.presentDays}</p>
          <span className="text-[11px] text-slate-400">
            Out of {summary.scheduledWorkingDays} working days
          </span>
        </div>

        {/* Leave Taken */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Leave This Month</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">{summary.totalLeave}</p>
          <span className="text-[11px] text-slate-400">
            CL: {summary.casualLeave} | SL: {summary.sickLeave} | AL: {summary.annualLeave}
          </span>
        </div>

        {/* Weekly Offs */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Weekly Offs (Fridays)</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900 mt-2">{summary.weeklyHolidays}</p>
          <span className="text-[11px] text-slate-400">Every Friday is weekly off</span>
        </div>

        {/* Missing Entries */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Missing Records</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-rose-600 mt-2">{summary.missingAttendance}</p>
          <span className="text-[11px] text-slate-400">Unrecorded scheduled days</span>
        </div>

      </div>

      {/* Leave Entitlement Tracker & Upcoming Holidays */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Leave Balances Widget */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Annual Leave Balances ({currentYear})
              </h3>
            </div>
            <button
              onClick={() => onNavigateToTab('leave')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <span>Apply for Leave</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Casual Leave */}
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200">
              <span className="text-xs font-semibold text-amber-900 block">Casual Leave (CL)</span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-black text-amber-800">{leaveBalance.clRem}</span>
                <span className="text-xs text-amber-700">/ {leaveBalance.clTotal} days</span>
              </div>
              <p className="text-[10px] text-amber-700/80 mt-1">{leaveBalance.clUsed} days utilized</p>
            </div>

            {/* Sick Leave */}
            <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-200">
              <span className="text-xs font-semibold text-orange-900 block">Sick Leave (SL)</span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-black text-orange-800">{leaveBalance.slRem}</span>
                <span className="text-xs text-orange-700">/ {leaveBalance.slTotal} days</span>
              </div>
              <p className="text-[10px] text-orange-700/80 mt-1">{leaveBalance.slUsed} days utilized</p>
            </div>

            {/* Annual Leave */}
            <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200">
              <span className="text-xs font-semibold text-teal-900 block">Annual Leave (AL)</span>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-2xl font-black text-teal-800">{leaveBalance.alRem}</span>
                <span className="text-xs text-teal-700">/ {leaveBalance.alTotal} days</span>
              </div>
              <p className="text-[10px] text-teal-700/80 mt-1">{leaveBalance.alUsed} days utilized</p>
            </div>
          </div>
        </div>

        {/* Upcoming Holidays Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <CalendarCheck className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Upcoming Holidays
            </h3>
          </div>

          <div className="space-y-3">
            {upcomingHolidays.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No public holidays in the near future.</p>
            ) : (
              upcomingHolidays.map((h) => (
                <div key={h.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex justify-between font-semibold text-slate-800">
                    <span className="truncate">{h.nameEn}</span>
                    <span className="text-blue-600 font-bold shrink-0">{h.date}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{h.nameBn || h.type}</p>
                </div>
              ))
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 mt-4 text-[11px] text-slate-400">
            Bangladesh Government & LEEDO Official Non-working days.
          </div>
        </div>

      </div>

    </div>
  );
};
