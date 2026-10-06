import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { AttendanceRecord, AttendanceStatus, Employee, Holiday } from '../../types';
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Printer, 
  Download, 
  Info,
  Clock,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { 
  getDaysInMonth, 
  formatDateKey, 
  isFriday, 
  calculateMonthlyAttendance,
  ATTENDANCE_STATUS_COLORS 
} from '../../lib/attendanceCalculator';

interface AttendanceCalendarViewProps {
  employees: Employee[];
  allAttendance: AttendanceRecord[];
  holidays: Holiday[];
  onOpenDateModal: (date: string, emp: Employee, existing?: AttendanceRecord) => void;
  onExportExcel: () => void;
}

export const AttendanceCalendarView: React.FC<AttendanceCalendarViewProps> = ({
  employees,
  allAttendance,
  holidays,
  onOpenDateModal,
  onExportExcel
}) => {
  const { currentUser, role } = useAuth();
  const { t, language } = useLanguage();

  const isHrOrSuper = role === 'HR ADMIN' || role === 'SUPER ADMIN';

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedEid, setSelectedEid] = useState<string>(currentUser?.eid || 'EMP-1001');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const targetEmployee = useMemo(() => {
    return employees.find(e => e.eid === selectedEid) || currentUser;
  }, [employees, selectedEid, currentUser]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Get employee's attendance records for this month
  const targetMonthStr = `${year}-${String(month).padStart(2, '0')}`;
  const empMonthRecords = useMemo(() => {
    return allAttendance.filter(a => a.eid === selectedEid && a.month === targetMonthStr);
  }, [allAttendance, selectedEid, targetMonthStr]);

  const recordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    empMonthRecords.forEach(r => map.set(r.date, r));
    return map;
  }, [empMonthRecords]);

  // Monthly summary calculations
  const summary = useMemo(() => {
    return calculateMonthlyAttendance(year, month, empMonthRecords, holidays);
  }, [year, month, empMonthRecords, holidays]);

  // Calendar Grid generation (Sun - Sat)
  const totalDays = getDaysInMonth(year, month);
  const firstDayWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sun ... 6 = Sat

  // Selected date popup detail
  const [activeDateDetail, setActiveDateDetail] = useState<{
    date: string;
    record?: AttendanceRecord;
    isFriday: boolean;
    holiday?: Holiday;
  } | null>(null);

  const holidayDateSet = useMemo(() => {
    const map = new Map<string, Holiday>();
    holidays.forEach(h => map.set(h.date, h));
    return map;
  }, [holidays]);

  return (
    <div className="space-y-6">
      
      {/* Calendar Header Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {t('navCalendar')}
              </h1>
              <p className="text-xs text-slate-500">
                Visual monthly attendance overview. Friday is Weekly Off (WO); Saturday is a regular working day.
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Prev/Next, Employee Filter */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs w-full md:w-auto">
          {/* Employee Picker (HR only) */}
          {isHrOrSuper ? (
            <select
              value={selectedEid}
              onChange={(e) => setSelectedEid(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {employees.map(emp => (
                <option key={emp.eid} value={emp.eid}>
                  {emp.nameEn} ({emp.eid})
                </option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-1.5 bg-slate-100 rounded-lg font-semibold text-slate-700 border border-slate-200">
              {currentUser?.nameEn}
            </div>
          )}

          {/* Month Stepper */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-white rounded text-slate-600 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-bold text-slate-800 text-xs min-w-[130px] text-center">
              {monthNames[month - 1]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-white rounded text-slate-600 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-colors flex items-center gap-1"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('print')}</span>
          </button>
        </div>
      </div>

      {/* Main Grid + Metrics Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Calendar Grid (3 Cols) */}
        <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          
          {/* Weekday Header: Sun - Sat */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-bold text-slate-600">
            <div className="py-2">Sun</div>
            <div className="py-2">Mon</div>
            <div className="py-2">Tue</div>
            <div className="py-2">Wed</div>
            <div className="py-2">Thu</div>
            <div className="py-2 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
              Fri (Off)
            </div>
            <div className="py-2 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-200">
              Sat (Work)
            </div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            
            {/* Blank padding cells before 1st day */}
            {Array.from({ length: firstDayWeekday }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20 bg-slate-50/50 rounded-xl border border-dashed border-slate-200/60" />
            ))}

            {/* Days 1 to totalDays */}
            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
              const dateKey = formatDateKey(year, month, d);
              const friday = isFriday(dateKey);
              const holiday = holidayDateSet.get(dateKey);
              const record = recordMap.get(dateKey);

              const status = record?.status || (friday ? 'WO' : holiday ? 'PH' : undefined);
              const statusColor = status ? ATTENDANCE_STATUS_COLORS[status] : undefined;

              return (
                <div
                  key={dateKey}
                  onClick={() => {
                    setActiveDateDetail({
                      date: dateKey,
                      record,
                      isFriday: friday,
                      holiday
                    });
                  }}
                  className={`h-20 p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    friday
                      ? 'bg-slate-100 border-slate-300'
                      : holiday
                      ? 'bg-blue-50/60 border-blue-200'
                      : record
                      ? 'bg-white hover:border-emerald-400 shadow-xs'
                      : 'bg-white hover:bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${
                      friday ? 'text-slate-600' : 'text-slate-800'
                    }`}>
                      {d}
                    </span>
                    {friday && (
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1 rounded">
                        Off
                      </span>
                    )}
                    {holiday && !friday && (
                      <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1 rounded">
                        PH
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div>
                    {status ? (
                      <div className={`px-2 py-0.5 rounded text-[11px] font-bold border text-center truncate ${
                        statusColor?.bg || 'bg-slate-100'
                      } ${statusColor?.text || 'text-slate-700'} ${statusColor?.border || 'border-slate-300'}`}>
                        {status}
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-300 italic block text-center">
                        —
                      </span>
                    )}
                  </div>

                  {/* Verification dot */}
                  <div className="flex justify-end">
                    {record?.verificationStatus === 'Verified' ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-500" title="Verified by HR" />
                    ) : record ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unverified" />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Color Legend */}
          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-bold text-slate-700 mr-1">Legend:</span>
            <span className="px-2 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">P = Present</span>
            <span className="px-2 py-0.5 rounded font-semibold bg-amber-100 text-amber-800 border border-amber-300">CL = Casual</span>
            <span className="px-2 py-0.5 rounded font-semibold bg-orange-100 text-orange-800 border border-orange-300">SL = Sick</span>
            <span className="px-2 py-0.5 rounded font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300">AL = Annual</span>
            <span className="px-2 py-0.5 rounded font-semibold bg-red-100 text-red-800 border border-red-300">A = Absent</span>
            <span className="px-2 py-0.5 rounded font-semibold bg-slate-200 text-slate-700 border border-slate-300">WO = Weekly Off</span>
            <span className="px-2 py-0.5 rounded font-semibold bg-blue-100 text-blue-800 border border-blue-300">PH = Public Holiday</span>
            <span className="px-2 py-0.5 rounded font-semibold bg-teal-100 text-teal-800 border border-teal-300">WFH = Work From Home</span>
            <span className="px-2 py-0.5 rounded font-semibold bg-violet-100 text-violet-800 border border-violet-300">OD = Official Duty</span>
          </div>

        </div>

        {/* Sidebar Summary (1 Col) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3">
              Monthly Summary ({monthNames[month - 1]})
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Calendar Days:</span>
                <span className="font-bold text-slate-900">{summary.calendarDays}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Scheduled Working Days:</span>
                <span className="font-bold text-indigo-700">{summary.scheduledWorkingDays}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Present Days:</span>
                <span className="font-bold text-emerald-700">{summary.presentDays}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Casual Leave (CL):</span>
                <span className="font-bold text-amber-700">{summary.casualLeave}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Sick Leave (SL):</span>
                <span className="font-bold text-orange-700">{summary.sickLeave}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Annual Leave (AL):</span>
                <span className="font-bold text-yellow-700">{summary.annualLeave}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Weekly Holidays (Fridays):</span>
                <span className="font-bold text-slate-700">{summary.weeklyHolidays}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Public Holidays:</span>
                <span className="font-bold text-blue-700">{summary.publicHolidays}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Absent Days:</span>
                <span className="font-bold text-rose-700">{summary.absentDays}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Missing Attendance:</span>
                <span className="font-bold text-rose-600">{summary.missingAttendance}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4">
            <button
              onClick={onExportExcel}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Excel Register</span>
            </button>
          </div>
        </div>

      </div>

      {/* Date Detail Modal */}
      {activeDateDetail && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="bg-slate-900 px-5 py-3.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold">
                  Date Details: {activeDateDetail.date}
                </h3>
              </div>
              <button
                onClick={() => setActiveDateDetail(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Employee:</span>
                <span className="font-bold text-slate-800">{targetEmployee?.nameEn} ({targetEmployee?.eid})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-slate-900">
                  {activeDateDetail.record?.status || (activeDateDetail.isFriday ? 'WO (Weekly Off)' : activeDateDetail.holiday?.nameEn || 'Not Submitted')}
                </span>
              </div>
              {activeDateDetail.record?.dutyDescription && (
                <div className="py-1 border-b border-slate-100">
                  <span className="text-slate-500 block mb-0.5">Duty Performed:</span>
                  <p className="font-medium text-slate-800 bg-slate-50 p-2 rounded">
                    {activeDateDetail.record.dutyDescription}
                  </p>
                </div>
              )}
              {activeDateDetail.record?.remarks && (
                <div className="py-1 border-b border-slate-100">
                  <span className="text-slate-500 block mb-0.5">Remarks:</span>
                  <p className="font-medium text-slate-800 bg-slate-50 p-2 rounded">
                    {activeDateDetail.record.remarks}
                  </p>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Verification:</span>
                <span className="font-bold text-teal-700">
                  {activeDateDetail.record?.verificationStatus || 'Not applicable'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              {targetEmployee && (
                <button
                  onClick={() => {
                    const dt = activeDateDetail.date;
                    const rec = activeDateDetail.record;
                    setActiveDateDetail(null);
                    onOpenDateModal(dt, targetEmployee, rec);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs"
                >
                  Edit / Submit Entry
                </button>
              )}
              <button
                onClick={() => setActiveDateDetail(null)}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
