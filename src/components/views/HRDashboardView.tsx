import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { AttendanceRecord, Employee, Holiday, LeaveRecord } from '../../types';
import { 
  Users, 
  UserCheck, 
  UserMinus, 
  UserX, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  CalendarDays,
  Briefcase,
  FileSpreadsheet,
  Download,
  Filter,
  TrendingUp,
  BarChart3,
  CalendarCheck
} from 'lucide-react';
import { getDaysInMonth, isFriday } from '../../lib/attendanceCalculator';

interface HRDashboardViewProps {
  employees: Employee[];
  allAttendance: AttendanceRecord[];
  holidays: Holiday[];
  leaveRecords: LeaveRecord[];
  onOpenDailyModal: () => void;
  onNavigateToTab: (tab: any) => void;
  onExportExcel: () => void;
}

export const HRDashboardView: React.FC<HRDashboardViewProps> = ({
  employees,
  allAttendance,
  holidays,
  leaveRecords,
  onOpenDailyModal,
  onNavigateToTab,
  onExportExcel
}) => {
  const { t, language } = useLanguage();

  // Current date in Asia/Dhaka
  const todayStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      if (selectedDept !== 'ALL' && e.department !== selectedDept) return false;
      if (selectedProject !== 'ALL' && e.project !== selectedProject) return false;
      return true;
    });
  }, [employees, selectedDept, selectedProject]);

  const activeEmployees = useMemo(() => {
    return filteredEmployees.filter(e => e.status === 'Active');
  }, [filteredEmployees]);

  // Today's stats
  const todayRecords = useMemo(() => {
    const activeEids = new Set(activeEmployees.map(e => e.eid));
    return allAttendance.filter(a => a.date === todayStr && activeEids.has(a.eid));
  }, [allAttendance, todayStr, activeEmployees]);

  const presentTodayCount = useMemo(() => {
    return todayRecords.filter(a => a.status === 'P' || a.status === 'OD' || a.status === 'WFH' || a.status === 'HD').length;
  }, [todayRecords]);

  const onLeaveTodayCount = useMemo(() => {
    return todayRecords.filter(a => ['CL', 'SL', 'AL', 'ML', 'PL', 'UL', 'CO'].includes(a.status)).length;
  }, [todayRecords]);

  const absentTodayCount = useMemo(() => {
    return todayRecords.filter(a => a.status === 'A').length;
  }, [todayRecords]);

  // Monthly stats
  const targetMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  
  const monthlyRecords = useMemo(() => {
    const activeEids = new Set(activeEmployees.map(e => e.eid));
    return allAttendance.filter(a => a.month === targetMonthStr && activeEids.has(a.eid));
  }, [allAttendance, targetMonthStr, activeEmployees]);

  const unverifiedCount = useMemo(() => {
    return monthlyRecords.filter(a => a.verificationStatus === 'Unverified').length;
  }, [monthlyRecords]);

  const verifiedCount = useMemo(() => {
    return monthlyRecords.filter(a => a.verificationStatus === 'Verified').length;
  }, [monthlyRecords]);

  const correctionReqCount = useMemo(() => {
    return monthlyRecords.filter(a => a.verificationStatus === 'Correction Required').length;
  }, [monthlyRecords]);

  // Calculate monthly scheduled working days (excluding Friday weekly off and public holidays)
  const scheduledWorkingDaysCount = useMemo(() => {
    const days = getDaysInMonth(selectedYear, selectedMonth);
    const holidayDateSet = new Set(holidays.map(h => h.date));
    let count = 0;
    for (let d = 1; d <= days; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (!isFriday(dateStr) && !holidayDateSet.has(dateStr)) {
        count++;
      }
    }
    return count;
  }, [selectedYear, selectedMonth, holidays]);

  // Department-wise attendance breakdown
  const departmentStats = useMemo(() => {
    const map = new Map<string, { total: number; present: number }>();
    activeEmployees.forEach(e => {
      if (!map.has(e.department)) {
        map.set(e.department, { total: 0, present: 0 });
      }
      map.get(e.department)!.total++;
    });

    todayRecords.forEach(r => {
      if (['P', 'OD', 'WFH', 'HD'].includes(r.status)) {
        if (map.has(r.department)) {
          map.get(r.department)!.present++;
        }
      }
    });

    return Array.from(map.entries()).map(([dept, data]) => ({
      department: dept,
      total: data.total,
      present: data.present,
      rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
    }));
  }, [activeEmployees, todayRecords]);

  // Leave Type Breakdown for the month
  const leaveBreakdown = useMemo(() => {
    const counts = { CL: 0, SL: 0, AL: 0, UL: 0, Other: 0 };
    monthlyRecords.forEach(r => {
      if (r.status === 'CL') counts.CL++;
      else if (r.status === 'SL') counts.SL++;
      else if (r.status === 'AL') counts.AL++;
      else if (r.status === 'UL') counts.UL++;
      else if (['ML', 'PL', 'CO'].includes(r.status)) counts.Other++;
    });
    return counts;
  }, [monthlyRecords]);

  const departmentsList = useMemo(() => {
    const set = new Set(employees.map(e => e.department));
    return Array.from(set);
  }, [employees]);

  const projectsList = useMemo(() => {
    const set = new Set(employees.map(e => e.project));
    return Array.from(set);
  }, [employees]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Fast Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              {t('navHrDashboard')}
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              LEEDO Central HR
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            {language === 'bn' 
              ? 'দৈনিক ও মাসিক উপস্থিতি তদারকি, যাচাইকরণ, ছুটি ট্র্যাকিং ও রিপোর্ট পরিচালনা।' 
              : 'Real-time attendance oversight, HR verification center, leave records, and official registers.'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenDailyModal}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{t('submitDailyAttendance')}</span>
          </button>
          <button
            onClick={() => onNavigateToTab('verification')}
            className="px-3 py-2 bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{t('navHrVerification')}</span>
          </button>
          <button
            onClick={onExportExcel}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('exportExcel')}</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
            <Filter className="w-3.5 h-3.5" />
            <span>{t('filter')}:</span>
          </div>

          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {[
              'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'
            ].map((m, idx) => (
              <option key={m} value={idx + 1}>{m}</option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[160px]"
          >
            <option value="ALL">All Departments</option>
            {departmentsList.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Project Filter */}
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[160px]"
          >
            <option value="ALL">All Projects</option>
            {projectsList.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="text-[11px] font-medium text-slate-500">
          Showing data for <span className="font-bold text-slate-800">{activeEmployees.length}</span> active staff
        </div>
      </div>

      {/* 8 Essential Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Card 1: Total Active Employees */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">{t('totalActiveEmployees')}</p>
            <p className="text-xl font-extrabold text-slate-900">{activeEmployees.length}</p>
            <span className="text-[10px] text-emerald-600 font-medium">100% on payroll</span>
          </div>
        </div>

        {/* Card 2: Present Today */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">{t('presentToday')}</p>
            <p className="text-xl font-extrabold text-slate-900">{presentTodayCount}</p>
            <span className="text-[10px] text-slate-400 font-medium">
              {activeEmployees.length ? Math.round((presentTodayCount / activeEmployees.length) * 100) : 0}% attendance
            </span>
          </div>
        </div>

        {/* Card 3: On Leave Today */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <UserMinus className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">{t('onLeaveToday')}</p>
            <p className="text-xl font-extrabold text-slate-900">{onLeaveTodayCount}</p>
            <span className="text-[10px] text-amber-600 font-medium">CL / SL / AL approved</span>
          </div>
        </div>

        {/* Card 4: Absent Today */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <UserX className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">{t('absentToday')}</p>
            <p className="text-xl font-extrabold text-slate-900">{absentTodayCount}</p>
            <span className="text-[10px] text-rose-600 font-medium">Unexcused</span>
          </div>
        </div>

        {/* Card 5: Unverified Attendance */}
        <div 
          onClick={() => onNavigateToTab('verification')}
          className="bg-white p-4 rounded-xl border border-amber-200 shadow-xs flex items-center gap-3 cursor-pointer hover:bg-amber-50/50 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">{t('unverifiedAttendance')}</p>
            <p className="text-xl font-extrabold text-amber-700">{unverifiedCount}</p>
            <span className="text-[10px] text-amber-700 font-medium underline">Click to verify</span>
          </div>
        </div>

        {/* Card 6: Verified Attendance */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">{t('verifiedAttendance')}</p>
            <p className="text-xl font-extrabold text-slate-900">{verifiedCount}</p>
            <span className="text-[10px] text-teal-600 font-medium">HR approved records</span>
          </div>
        </div>

        {/* Card 7: Scheduled Working Days */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">{t('scheduledWorkingDays')}</p>
            <p className="text-xl font-extrabold text-slate-900">{scheduledWorkingDaysCount} Days</p>
            <span className="text-[10px] text-slate-500 font-medium">Excludes Fridays & PH</span>
          </div>
        </div>

        {/* Card 8: Pending Corrections */}
        <div 
          onClick={() => onNavigateToTab('verification')}
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-500 leading-tight">{t('pendingCorrections')}</p>
            <p className="text-xl font-extrabold text-slate-900">{correctionReqCount}</p>
            <span className="text-[10px] text-purple-600 font-medium">Review requested</span>
          </div>
        </div>

      </div>

      {/* Charts & Analytical Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Department-wise Attendance Bars */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Department-wise Attendance Status (Today)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Total staff vs present</span>
          </div>

          <div className="space-y-3">
            {departmentStats.map((dept) => (
              <div key={dept.department} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-800 truncate max-w-xs">{dept.department}</span>
                  <span className="text-slate-500">
                    <strong className="text-emerald-700">{dept.present}</strong> / {dept.total} ({dept.rate}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(dept.rate, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leave Type Distribution */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-4 h-4 text-teal-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Leave Breakdown ({targetMonthStr})
              </h3>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50 border border-amber-100 text-xs">
                <span className="font-medium text-amber-900">Casual Leave (CL)</span>
                <span className="font-bold text-amber-800">{leaveBreakdown.CL} Days</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 border border-orange-100 text-xs">
                <span className="font-medium text-orange-900">Sick Leave (SL)</span>
                <span className="font-bold text-orange-800">{leaveBreakdown.SL} Days</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-yellow-50 border border-yellow-100 text-xs">
                <span className="font-medium text-yellow-900">Annual Leave (AL)</span>
                <span className="font-bold text-yellow-800">{leaveBreakdown.AL} Days</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-rose-50 border border-rose-100 text-xs">
                <span className="font-medium text-rose-900">Unpaid Leave (UL)</span>
                <span className="font-bold text-rose-800">{leaveBreakdown.UL} Days</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-purple-50 border border-purple-100 text-xs">
                <span className="font-medium text-purple-900">Other (ML/PL/CO)</span>
                <span className="font-bold text-purple-800">{leaveBreakdown.Other} Days</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={() => onNavigateToTab('leave')}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors text-center"
            >
              Open Leave Management Portal →
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
