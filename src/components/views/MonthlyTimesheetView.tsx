import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Employee, AttendanceRecord, Holiday, AttendanceStatus } from '../../types';
import { 
  Printer, 
  Download, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  FileText, 
  User, 
  Building,
  Briefcase,
  Sparkles
} from 'lucide-react';
import { 
  getDaysInMonth, 
  formatDateKey, 
  isFriday, 
  isEmployeeScheduledWorkDay, 
  isExtraDutyDay,
  WEEKDAYS_MAP,
  calculateMonthlyAttendance,
  ATTENDANCE_STATUS_COLORS 
} from '../../lib/attendanceCalculator';
import { canUserVerifyAttendance } from '../../lib/supervisorUtils';

interface MonthlyTimesheetViewProps {
  employees: Employee[];
  allAttendance: AttendanceRecord[];
  holidays: Holiday[];
}

export const MonthlyTimesheetView: React.FC<MonthlyTimesheetViewProps> = ({
  employees,
  allAttendance,
  holidays
}) => {
  const { currentUser, role } = useAuth();
  const { t, language } = useLanguage();

  const isHrOrSuper = role === 'HR ADMIN' || role === 'SUPER ADMIN';
  const canSelectStaff = isHrOrSuper || canUserVerifyAttendance(currentUser, employees);

  const [selectedEid, setSelectedEid] = useState<string>(currentUser?.eid || '1004');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  const targetEmployee = useMemo(() => {
    return employees.find(e => e.eid === selectedEid) || currentUser;
  }, [employees, selectedEid, currentUser]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[selectedMonth - 1];
  const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const totalDays = useMemo(() => getDaysInMonth(selectedYear, selectedMonth), [selectedYear, selectedMonth]);

  // Employee attendance records for this month
  const empRecords = useMemo(() => {
    return allAttendance.filter(a => a.eid === selectedEid && a.month === monthStr);
  }, [allAttendance, selectedEid, monthStr]);

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    empRecords.forEach(r => map.set(r.date, r));
    return map;
  }, [empRecords]);

  const holidayDateSet = useMemo(() => {
    const map = new Map<string, Holiday>();
    holidays.forEach(h => map.set(h.date, h));
    return map;
  }, [holidays]);

  // Calculations
  const summary = useMemo(() => {
    return calculateMonthlyAttendance(selectedYear, selectedMonth, empRecords, holidays, targetEmployee || undefined);
  }, [selectedYear, selectedMonth, empRecords, holidays, targetEmployee]);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      
      {/* Top Controls Bar (Hidden during print) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-50 text-red-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                NGO Monthly Time Sheet (মাসিক টাইম শিট)
              </h1>
              <p className="text-xs text-slate-500">
                Print-ready official LEEDO staff timesheet compliant with INGO/NGO donor reporting and audit requirements.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs w-full md:w-auto">
          {/* Employee Selector (HR and Supervisors) */}
          {canSelectStaff ? (
            <select
              value={selectedEid}
              onChange={(e) => setSelectedEid(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 max-w-[260px]"
            >
              {employees.map(emp => (
                <option key={emp.eid} value={emp.eid}>
                  {emp.eid} - {emp.nameEn} ({emp.designation})
                </option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-1.5 bg-slate-100 rounded-lg font-semibold text-slate-700 border border-slate-200">
              {currentUser?.eid} - {currentUser?.nameEn}
            </div>
          )}

          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-700"
          >
            {monthNames.map((m, idx) => (
              <option key={m} value={idx + 1}>{m}</option>
            ))}
          </select>

          {/* Year Selector */}
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-700"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Print Button */}
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>Print Timesheet (A4)</span>
          </button>
        </div>
      </div>

      {/* Printable Sheet Container (Styled like official LEEDO A4 Sheet) */}
      <div className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-300 shadow-md print:shadow-none print:border-none print:p-0 text-slate-900">
        
        {/* LEEDO Official Header */}
        <div className="flex items-center justify-between border-b-2 border-red-600 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <img 
              src="/leedo-logo.svg" 
              alt="LEEDO Logo" 
              className="w-16 h-16 object-contain shrink-0" 
            />
            <div>
              <h2 className="text-xl font-black text-red-600 tracking-tight leading-tight">
                LEEDO
              </h2>
              <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Local Education and Economic Development Organization
              </p>
              <p className="text-[10px] text-slate-500">
                Reg No. DSS: Dha-06041 | NGO Affairs Bureau Reg No: 3012
              </p>
              <p className="text-[10px] text-slate-500">
                Head Office: House No. 427/6, Jawchar, Ashrafabad, Kamrangirchar, Dhaka-1211, Bangladesh
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-block px-3 py-1 bg-red-50 text-red-700 font-extrabold text-xs uppercase rounded border border-red-200">
              Staff Monthly Timesheet
            </span>
            <p className="text-xs font-bold text-slate-700 mt-1">
              Period: {monthName} {selectedYear}
            </p>
          </div>
        </div>

        {/* Employee & Work Schedule Metadata Box */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-5">
          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Staff Name:</span>
            <span className="font-bold text-slate-900 text-sm">{targetEmployee?.nameEn}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Employee ID (EID):</span>
            <span className="font-mono font-bold text-slate-900 text-sm">{targetEmployee?.eid}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Designation:</span>
            <span className="font-semibold text-slate-800">{targetEmployee?.designation}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Department:</span>
            <span className="font-semibold text-slate-800">{targetEmployee?.department}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Duty Station / Location:</span>
            <span className="font-semibold text-slate-800">{targetEmployee?.workplace || targetEmployee?.project}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Employment Nature:</span>
            <span className="font-semibold text-slate-800">{targetEmployee?.natureOfEmployment}</span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Shift Timing:</span>
            <span className="font-bold text-slate-900 font-mono">
              {targetEmployee?.standardInTime || '09:00 AM'} – {targetEmployee?.standardOutTime || '05:00 PM'} ({targetEmployee?.dailyHours || 8}h)
            </span>
          </div>

          <div>
            <span className="text-[10px] uppercase font-semibold text-slate-500 block">Assigned Weekly Duty Days:</span>
            <span className="font-bold text-emerald-800">
              {targetEmployee?.workingDaysPerWeek || (targetEmployee?.workScheduleDays ? targetEmployee.workScheduleDays.length : 6)} Days / Wk
            </span>
            <span className="text-[10px] text-slate-500 block truncate">
              {WEEKDAYS_MAP
                .filter(w => (targetEmployee?.workScheduleDays || [6, 0, 1, 2, 3, 4]).includes(w.id))
                .map(w => w.shortEn)
                .join(', ')}
            </span>
          </div>
        </div>

        {/* Timesheet Table */}
        <div className="overflow-x-auto border border-slate-300 rounded-lg mb-5">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100 text-slate-800 font-bold uppercase text-[10px] border-b border-slate-300">
              <tr>
                <th className="px-2.5 py-1.5 border-r border-slate-300 w-10 text-center">Day</th>
                <th className="px-2.5 py-1.5 border-r border-slate-300 w-24">Date</th>
                <th className="px-2.5 py-1.5 border-r border-slate-300 w-16">Weekday</th>
                <th className="px-2.5 py-1.5 border-r border-slate-300 w-24 text-center">Scheduled</th>
                <th className="px-2.5 py-1.5 border-r border-slate-300 w-16 text-center">Status</th>
                <th className="px-2.5 py-1.5 border-r border-slate-300 w-20 text-center">Time In</th>
                <th className="px-2.5 py-1.5 border-r border-slate-300 w-20 text-center">Time Out</th>
                <th className="px-2.5 py-1.5 border-r border-slate-300 w-16 text-center">Hours</th>
                <th className="px-2.5 py-1.5 border-r border-slate-300">Task / Duty Description</th>
                <th className="px-2.5 py-1.5 w-20 text-center">Verified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
                const dateKey = formatDateKey(selectedYear, selectedMonth, d);
                const dateObj = new Date(dateKey + 'T00:00:00');
                const isFri = isFriday(dateKey);
                const isSched = isEmployeeScheduledWorkDay(dateKey, targetEmployee || undefined);
                const hol = holidayDateSet.get(dateKey);
                const rec = recordMap.get(dateKey);

                const status = rec?.status || (isFri ? 'WO' : !isSched ? 'WO' : hol ? 'PH' : '-');
                const isOff = isFri || !isSched;
                const isExtra = isExtraDutyDay(dateKey, targetEmployee || undefined, rec?.status, !!hol);

                const inTime = rec?.inTime || (status === 'P' || status === 'OD' || status === 'WFH' ? targetEmployee?.standardInTime || '09:00 AM' : '—');
                const outTime = rec?.outTime || (status === 'P' || status === 'OD' || status === 'WFH' ? targetEmployee?.standardOutTime || '05:00 PM' : '—');
                const hours = rec?.hoursWorked || (status === 'P' || status === 'OD' || status === 'WFH' ? targetEmployee?.dailyHours || 8 : 0);

                return (
                  <tr 
                    key={dateKey} 
                    className={`${
                      isExtra 
                        ? 'bg-amber-50/80 font-semibold' 
                        : isOff 
                        ? 'bg-slate-100/70 font-semibold' 
                        : hol 
                        ? 'bg-blue-50/50' 
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-2.5 py-1 text-center font-bold border-r border-slate-300">
                      {String(d).padStart(2, '0')}
                    </td>
                    <td className="px-2.5 py-1 font-mono text-[11px] border-r border-slate-300">
                      {dateKey}
                    </td>
                    <td className="px-2.5 py-1 border-r border-slate-300">
                      <span className={isFri ? 'text-amber-800 font-bold' : ''}>
                        {dayNames[dateObj.getDay()]}
                      </span>
                    </td>
                    <td className="px-2.5 py-1 text-center border-r border-slate-300">
                      {isExtra ? (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 border border-amber-400">
                          ⚡ Extra Duty
                        </span>
                      ) : (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isSched && !isFri ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {isSched && !isFri ? 'Work Day' : 'Weekly Off'}
                        </span>
                      )}
                    </td>
                    <td className="px-2.5 py-1 text-center font-bold border-r border-slate-300">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        (status && status in ATTENDANCE_STATUS_COLORS)
                          ? ATTENDANCE_STATUS_COLORS[status as AttendanceStatus].bg + ' ' + ATTENDANCE_STATUS_COLORS[status as AttendanceStatus].text
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-2.5 py-1 text-center font-mono text-[11px] border-r border-slate-300">
                      {inTime}
                    </td>
                    <td className="px-2.5 py-1 text-center font-mono text-[11px] border-r border-slate-300">
                      {outTime}
                    </td>
                    <td className="px-2.5 py-1 text-center font-mono font-bold text-[11px] border-r border-slate-300">
                      {hours > 0 ? hours : '—'}
                    </td>
                    <td className="px-2.5 py-1 text-[11px] text-slate-700 max-w-xs truncate border-r border-slate-300">
                      {isExtra ? (
                        <div className="flex items-center gap-1.5">
                          <span className="px-1 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            +1 CO Leave & ৳ Pay
                          </span>
                          <span className="truncate">{rec?.dutyDescription || 'Official Duty outside roster'}</span>
                        </div>
                      ) : (
                        rec?.dutyDescription || rec?.remarks || (isFri ? 'Weekly Holiday (Friday)' : !isSched ? 'Non-scheduled Day' : hol ? hol.nameEn : 'Regular Duties')
                      )}
                    </td>
                    <td className="px-2.5 py-1 text-center">
                      {rec?.verificationStatus === 'Verified' ? (
                        <span className="text-[10px] font-bold text-teal-700">✓ Verified</span>
                      ) : rec ? (
                        <span className="text-[10px] text-amber-700">Pending</span>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Timesheet Summary Totals Block */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 mb-6 text-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-900 uppercase text-[11px]">
              Monthly Attendance, Hours & Extra Duty Summary
            </h4>
            {summary.extraDutyDays > 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>{summary.extraDutyDays} Extra Duty Days Performed</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 block">Scheduled Working Days:</span>
              <span className="font-black text-slate-900 text-sm">{summary.scheduledWorkingDays} Days</span>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 block">Total Days Present:</span>
              <span className="font-black text-emerald-700 text-sm">{summary.presentDays} Days</span>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 block">Total Hours Worked:</span>
              <span className="font-black text-slate-900 text-sm">{summary.totalHoursWorked || (summary.presentDays * (targetEmployee?.dailyHours || 8))} Hours</span>
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-slate-200">
              <span className="text-[10px] text-slate-500 block">Total Leave Taken:</span>
              <span className="font-black text-amber-700 text-sm">{summary.totalLeave} Days (CL:{summary.casualLeave}, SL:{summary.sickLeave}, AL:{summary.annualLeave})</span>
            </div>
          </div>

          {/* Extra Duty & Compensatory Compensation Grid */}
          <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50/60 rounded-lg border border-amber-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-[10px] font-semibold text-amber-800 uppercase block">Extra Duties Outside Roster:</span>
              <span className="text-sm font-black text-amber-950 font-mono">
                {summary.extraDutyDays} Days
              </span>
              <span className="text-[10px] text-amber-700 block mt-0.5">Duties performed on off-days</span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-amber-800 uppercase block">Compensatory Leave Earned (CO):</span>
              <span className="text-sm font-black text-emerald-700 font-mono">
                +{summary.extraDutyLeaveEarned} Days (CO Leave)
              </span>
              <span className="text-[10px] text-emerald-700 block mt-0.5">Added to employee leave balance</span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-amber-800 uppercase block">Extra Duty Allowance Entitlement:</span>
              <span className="text-sm font-black text-amber-900 font-mono">
                ৳{summary.extraDutyPay.toLocaleString()} BDT
              </span>
              <span className="text-[10px] text-amber-700 block mt-0.5">Rate: ৳{targetEmployee?.extraDutyAllowancePerDay || 500}/day</span>
            </div>
          </div>
        </div>

        {/* NGO Certification & 4 Signatures Block (Standard INGO / NGO Format) */}
        <div className="mt-8 pt-4 border-t border-slate-300 text-xs">
          <p className="text-[11px] italic text-slate-600 mb-8 text-center">
            "I hereby certify that the hours and tasks recorded above represent an accurate, honest, and complete account of official time dedicated to LEEDO organizational objectives during this reporting month."
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center text-[11px]">
            <div>
              <div className="border-b border-slate-400 pb-1 mb-1 min-h-[36px] flex items-end justify-center font-serif italic text-slate-800">
                {targetEmployee?.nameEn}
              </div>
              <span className="font-bold text-slate-900 block">Employee Signature</span>
              <span className="text-[10px] text-slate-500">{targetEmployee?.designation}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Date: ____________</span>
            </div>

            <div>
              <div className="border-b border-slate-400 pb-1 mb-1 min-h-[36px] flex items-end justify-center">
                &nbsp;
              </div>
              <span className="font-bold text-slate-900 block">Supervisor / Project Lead</span>
              <span className="text-[10px] text-slate-500">{targetEmployee?.project}</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Date: ____________</span>
            </div>

            <div>
              <div className="border-b border-slate-400 pb-1 mb-1 min-h-[36px] flex items-end justify-center font-medium text-slate-700">
                Md. Omar Faruque
              </div>
              <span className="font-bold text-slate-900 block">Manager HR & Admin</span>
              <span className="text-[10px] text-slate-500">LEEDO Central Office</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Date: ____________</span>
            </div>

            <div>
              <div className="border-b border-slate-400 pb-1 mb-1 min-h-[36px] flex items-end justify-center font-medium text-slate-700">
                Forhad Hossain
              </div>
              <span className="font-bold text-slate-900 block">Executive Director</span>
              <span className="text-[10px] text-slate-500">LEEDO Bangladesh</span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Date: ____________</span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
