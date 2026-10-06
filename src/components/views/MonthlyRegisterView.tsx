import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { AttendanceRecord, AttendanceStatus, Employee, Holiday } from '../../types';
import { doc, writeBatch, collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../../lib/firebase';
import { getDaysInMonth, isFriday, formatDateKey, ATTENDANCE_STATUS_COLORS } from '../../lib/attendanceCalculator';
import { 
  FileSpreadsheet, 
  Save, 
  Send, 
  Check, 
  AlertTriangle, 
  Printer, 
  Sparkles, 
  Calendar, 
  Info,
  Clock,
  ShieldCheck
} from 'lucide-react';

interface MonthlyRegisterViewProps {
  employees: Employee[];
  allAttendance: AttendanceRecord[];
  holidays: Holiday[];
  onRefreshAttendance: () => void;
  isMonthLocked: boolean;
}

export const MonthlyRegisterView: React.FC<MonthlyRegisterViewProps> = ({
  employees,
  allAttendance,
  holidays,
  onRefreshAttendance,
  isMonthLocked
}) => {
  const { currentUser, role } = useAuth();
  const { t, language } = useLanguage();

  const isHrOrSuper = role === 'HR ADMIN' || role === 'SUPER ADMIN';

  const [selectedEid, setSelectedEid] = useState<string>(currentUser?.eid || 'EMP-1001');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  // The employee currently being viewed
  const targetEmployee = useMemo(() => {
    return employees.find(e => e.eid === selectedEid) || currentUser;
  }, [employees, selectedEid, currentUser]);

  const totalDays = useMemo(() => {
    return getDaysInMonth(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  // Existing records from global attendance state
  const existingRecordsMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    allAttendance.forEach(a => {
      if (a.eid === selectedEid && a.month === monthStr) {
        map.set(a.date, a);
      }
    });
    return map;
  }, [allAttendance, selectedEid, monthStr]);

  // Form state: Map of date string -> AttendanceStatus & DutyDescription
  const [registerEntries, setRegisterEntries] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [conflicts, setConflicts] = useState<Array<{ date: string; existingStatus: string; newStatus: string }>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [showConflictWarning, setShowConflictWarning] = useState(false);

  // Initialize or re-populate table when month, year, or employee changes
  useEffect(() => {
    const holidayDateSet = new Set(holidays.map(h => h.date));
    const entries: Record<string, { status: AttendanceStatus; remarks: string }> = {};

    for (let d = 1; d <= totalDays; d++) {
      const dateKey = formatDateKey(selectedYear, selectedMonth, d);
      const existing = existingRecordsMap.get(dateKey);

      if (existing) {
        entries[dateKey] = {
          status: existing.status,
          remarks: existing.remarks || ''
        };
      } else {
        const friday = isFriday(dateKey);
        const isPH = holidayDateSet.has(dateKey);

        if (friday) {
          entries[dateKey] = { status: 'WO', remarks: 'Friday Weekly Off' };
        } else if (isPH) {
          const hol = holidays.find(h => h.date === dateKey);
          entries[dateKey] = { status: 'PH', remarks: hol?.nameEn || 'Public Holiday' };
        } else {
          entries[dateKey] = { status: 'P', remarks: '' };
        }
      }
    }
    setRegisterEntries(entries);
    setSaveSuccessMsg('');
    setShowConflictWarning(false);
  }, [selectedYear, selectedMonth, selectedEid, existingRecordsMap, totalDays, holidays]);

  const handleStatusChange = (dateKey: string, newStatus: AttendanceStatus) => {
    setRegisterEntries(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        status: newStatus
      }
    }));
  };

  const handleRemarksChange = (dateKey: string, text: string) => {
    setRegisterEntries(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        remarks: text
      }
    }));
  };

  // Quick fill all working days (Mon-Thu, Sat-Sun) as Present (P)
  const handleAutoFillWorkingDays = () => {
    const holidayDateSet = new Set(holidays.map(h => h.date));
    setRegisterEntries(prev => {
      const updated = { ...prev };
      for (let d = 1; d <= totalDays; d++) {
        const dateKey = formatDateKey(selectedYear, selectedMonth, d);
        const friday = isFriday(dateKey);
        const isPH = holidayDateSet.has(dateKey);

        if (!friday && !isPH) {
          updated[dateKey] = {
            ...updated[dateKey],
            status: 'P'
          };
        }
      }
      return updated;
    });
  };

  // Detect conflicts between existing saved daily records and current edits
  const detectConflicts = () => {
    const conflictList: Array<{ date: string; existingStatus: string; newStatus: string }> = [];
    Object.keys(registerEntries).forEach(dateKey => {
      const existing = existingRecordsMap.get(dateKey);
      const current = registerEntries[dateKey];
      if (existing && existing.status !== current.status) {
        conflictList.push({
          date: dateKey,
          existingStatus: existing.status,
          newStatus: current.status
        });
      }
    });
    return conflictList;
  };

  const handleSaveBatch = async (isFinalSubmission: boolean = false) => {
    if (!targetEmployee) return;

    if (isMonthLocked && !isHrOrSuper) {
      alert(t('monthLockedNotice'));
      return;
    }

    const detected = detectConflicts();
    if (detected.length > 0 && !showConflictWarning) {
      setConflicts(detected);
      setShowConflictWarning(true);
      return;
    }

    setIsSaving(true);
    setSaveSuccessMsg('');

    try {
      const batch = writeBatch(db);
      const nowStr = new Date().toISOString();

      Object.entries(registerEntries).forEach(([dateKey, val]) => {
        const docId = `${targetEmployee.eid}_${dateKey}`;
        const ref = doc(db, 'attendance', docId);

        const existing = existingRecordsMap.get(dateKey);

        const payload: AttendanceRecord = {
          id: docId,
          eid: targetEmployee.eid,
          employeeName: targetEmployee.nameEn,
          department: targetEmployee.department,
          project: targetEmployee.project,
          date: dateKey,
          month: monthStr,
          year: String(selectedYear),
          status: val.status,
          dutyDescription: existing?.dutyDescription || '',
          remarks: val.remarks || existing?.remarks || '',
          verificationStatus: isHrOrSuper ? 'Verified' : 'Unverified',
          source: 'MonthlyRegister',
          createdAt: existing?.createdAt || nowStr,
          updatedAt: nowStr
        };

        if (isHrOrSuper) {
          payload.verifiedBy = `${currentUser?.nameEn || 'HR'} (HR)`;
          payload.verifiedAt = nowStr;
        } else if (existing?.verifiedBy) {
          payload.verifiedBy = existing.verifiedBy;
          if (existing?.verifiedAt) {
            payload.verifiedAt = existing.verifiedAt;
          }
        }

        batch.set(ref, sanitizeForFirestore(payload), { merge: true });
      });

      await batch.commit();

      // Record Audit Log
      try {
        await addDoc(collection(db, 'auditLogs'), {
          action: isFinalSubmission ? 'MONTHLY_REGISTER_SUBMITTED' : 'MONTHLY_REGISTER_DRAFT_SAVED',
          recordType: 'Attendance',
          recordId: `${targetEmployee.eid}_${monthStr}`,
          eid: targetEmployee.eid,
          modifiedBy: `${currentUser?.nameEn} (${currentUser?.eid})`,
          modifiedAt: nowStr,
          reason: `Monthly attendance register for ${monthStr} saved (${totalDays} dates).`
        });
      } catch (e) {
        console.warn('Audit error:', e);
      }

      setIsSaving(false);
      setShowConflictWarning(false);
      setSaveSuccessMsg(
        isFinalSubmission
          ? 'Monthly Register submitted successfully and synced to central attendance records.'
          : 'Draft saved successfully.'
      );
      onRefreshAttendance();
    } catch (err: any) {
      setIsSaving(false);
      alert('Error saving register: ' + err.message);
    }
  };

  const statusOptions: AttendanceStatus[] = [
    'P', 'CL', 'SL', 'AL', 'ML', 'PL', 'UL', 'A', 'WO', 'PH', 'OD', 'TR', 'WFH', 'CO', 'HD'
  ];

  return (
    <div className="space-y-6">
      
      {/* Header & Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {t('navMonthlyRegister')}
              </h1>
              <p className="text-xs text-slate-500">
                Individual month grid submission (01 – {totalDays} days) synced directly with daily attendance records.
              </p>
            </div>
          </div>
        </div>

        {/* Month, Year, Employee Selector */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs w-full md:w-auto">
          {/* Employee Selector (HR Only) */}
          {isHrOrSuper ? (
            <select
              value={selectedEid}
              onChange={(e) => setSelectedEid(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {employees.map(emp => (
                <option key={emp.eid} value={emp.eid}>
                  {emp.nameEn} ({emp.eid}) - {emp.department}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg font-semibold text-slate-700">
              {currentUser?.nameEn} ({currentUser?.eid})
            </div>
          )}

          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            onClick={() => window.print()}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-colors flex items-center gap-1.5"
            title="Print Register"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('print')}</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {saveSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{saveSuccessMsg}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMsg('')}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Conflict Warning Dialog */}
      {showConflictWarning && (
        <div className="p-4 bg-amber-50 border border-amber-300 text-amber-900 text-xs rounded-xl space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-900">Attendance Conflict Warning</h4>
              <p className="text-amber-800 mt-0.5">
                We detected {conflicts.length} conflicting dates where a daily attendance entry was already recorded with a different status:
              </p>
            </div>
          </div>

          <div className="max-h-32 overflow-y-auto bg-white/70 p-2.5 rounded-lg border border-amber-200 space-y-1">
            {conflicts.map((c) => (
              <div key={c.date} className="flex justify-between text-[11px]">
                <span className="font-medium text-slate-700">{c.date}</span>
                <span>
                  Existing: <strong className="text-rose-700">{c.existingStatus}</strong> → New:{' '}
                  <strong className="text-emerald-700">{c.newStatus}</strong>
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => handleSaveBatch(true)}
              className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg transition-colors"
            >
              Confirm and Overwrite Conflicting Entries
            </button>
            <button
              onClick={() => setShowConflictWarning(false)}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Target Employee Info Ribbon */}
      <div className="bg-slate-900 text-white px-5 py-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase">Staff Member</span>
            <span className="font-bold">{targetEmployee?.nameEn} ({targetEmployee?.eid})</span>
          </div>
          <div className="hidden sm:block border-l border-slate-700 pl-4">
            <span className="text-slate-400 block text-[10px] uppercase">Designation</span>
            <span className="font-medium">{targetEmployee?.designation}</span>
          </div>
          <div className="hidden md:block border-l border-slate-700 pl-4">
            <span className="text-slate-400 block text-[10px] uppercase">Department / Project</span>
            <span className="font-medium">{targetEmployee?.department} • {targetEmployee?.project}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto fill button */}
          <button
            onClick={handleAutoFillWorkingDays}
            disabled={isMonthLocked && !isHrOrSuper}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="Sets all regular working days to Present (P)"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-200" />
            <span>{t('fillWorkingDaysPresent')}</span>
          </button>
        </div>
      </div>

      {/* Register Calendar Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 w-12 text-center">Day</th>
                <th className="px-3 py-2.5 w-28">Date</th>
                <th className="px-3 py-2.5 w-28">Weekday</th>
                <th className="px-3 py-2.5 w-44">Attendance Status</th>
                <th className="px-3 py-2.5">Duty / Notes / Remarks</th>
                <th className="px-3 py-2.5 w-28 text-center">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
                const dateKey = formatDateKey(selectedYear, selectedMonth, d);
                const dateObj = new Date(dateKey + 'T00:00:00');
                const friday = isFriday(dateKey);
                const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];
                const entry = registerEntries[dateKey] || { status: 'P', remarks: '' };
                const existing = existingRecordsMap.get(dateKey);

                return (
                  <tr
                    key={dateKey}
                    className={`hover:bg-slate-50 transition-colors ${
                      friday ? 'bg-slate-100/70 font-semibold' : ''
                    }`}
                  >
                    {/* Day number */}
                    <td className="px-3 py-2 text-center font-bold text-slate-700">
                      {String(d).padStart(2, '0')}
                    </td>

                    {/* Date */}
                    <td className="px-3 py-2 text-slate-600 font-mono">
                      {dateKey}
                    </td>

                    {/* Day name */}
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        friday ? 'bg-amber-100 text-amber-800' : 'text-slate-600'
                      }`}>
                        {dayName} {friday ? '(Weekly Off)' : ''}
                      </span>
                    </td>

                    {/* Status dropdown */}
                    <td className="px-3 py-2">
                      <select
                        value={entry.status}
                        onChange={(e) => handleStatusChange(dateKey, e.target.value as AttendanceStatus)}
                        disabled={isMonthLocked && !isHrOrSuper}
                        className={`w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
                          ATTENDANCE_STATUS_COLORS[entry.status]?.bg || 'bg-white'
                        } ${ATTENDANCE_STATUS_COLORS[entry.status]?.text || 'text-slate-800'} ${
                          ATTENDANCE_STATUS_COLORS[entry.status]?.border || 'border-slate-300'
                        } disabled:opacity-75`}
                      >
                        {statusOptions.map(opt => (
                          <option key={opt} value={opt} className="bg-white text-slate-800">
                            {opt} — {t(`status_${opt}` as any)}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Duty / Remarks */}
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={entry.remarks}
                        onChange={(e) => handleRemarksChange(dateKey, e.target.value)}
                        placeholder="Duty performed, leave reason, or location..."
                        disabled={isMonthLocked && !isHrOrSuper}
                        className="w-full text-xs px-2.5 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100"
                      />
                    </td>

                    {/* Verification Status */}
                    <td className="px-3 py-2 text-center">
                      {existing?.verificationStatus === 'Verified' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                          <Check className="w-3 h-3" />
                          Verified
                        </span>
                      ) : existing ? (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Unverified
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          Draft
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-slate-400" />
            <span>All entries update the exact same attendance database used by daily attendance.</span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => handleSaveBatch(false)}
              disabled={isSaving || (isMonthLocked && !isHrOrSuper)}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 flex-1 sm:flex-none"
            >
              <Save className="w-4 h-4 text-slate-500" />
              <span>{t('saveDraft')}</span>
            </button>

            <button
              onClick={() => handleSaveBatch(true)}
              disabled={isSaving || (isMonthLocked && !isHrOrSuper)}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 flex-1 sm:flex-none"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{t('submitRegister')}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
