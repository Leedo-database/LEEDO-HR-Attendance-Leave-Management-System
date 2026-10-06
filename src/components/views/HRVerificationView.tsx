import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { AttendanceRecord, AttendanceStatus, Employee, MonthlyLock } from '../../types';
import { doc, setDoc, deleteDoc, writeBatch, addDoc, collection } from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../../lib/firebase';
import { 
  CheckCircle2, 
  Lock, 
  Unlock, 
  Trash2, 
  Edit3, 
  Check, 
  Search, 
  Clock, 
  ShieldCheck,
  Calendar,
  Zap,
  Users,
  UserCheck,
  Info
} from 'lucide-react';
import { ATTENDANCE_STATUS_COLORS } from '../../lib/attendanceCalculator';
import { isSupervisedBy } from '../../lib/supervisorUtils';

interface HRVerificationViewProps {
  employees: Employee[];
  allAttendance: AttendanceRecord[];
  monthlyLocks: Record<string, MonthlyLock>;
  onRefreshAttendance: () => void;
  onRefreshLocks: () => void;
}

export const HRVerificationView: React.FC<HRVerificationViewProps> = ({
  employees,
  allAttendance,
  monthlyLocks,
  onRefreshAttendance,
  onRefreshLocks
}) => {
  const { currentUser } = useAuth();
  const { t } = useLanguage();

  const isHrOrSuper = currentUser?.role === 'HR ADMIN' || currentUser?.role === 'SUPER ADMIN';

  // Compute verifiable title & signature based on logged-in user
  const verifierTitle = useMemo(() => {
    if (!currentUser) return 'Supervisor (LEEDO)';
    const eid = (currentUser.eid || '').trim();
    const name = currentUser.nameEn || '';
    if (currentUser.role === 'SUPER ADMIN') return `${name} (Super Admin)`;
    if (currentUser.role === 'HR ADMIN') return `${name} (HR Admin)`;
    if (eid === '1002' || name.toLowerCase().includes('kanta')) return `${name} (Director - Admin & Finance)`;
    if (eid === '1013' || name.toLowerCase().includes('sohel rana')) return `${name} (Manager - Program & Operation)`;
    if (eid === '1075' || name.toLowerCase().includes('farhana')) return `${name} (Program Coordinator)`;
    return `${name} (Supervisor / Approver)`;
  }, [currentUser]);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Unverified' | 'Verified' | 'Correction Required'>('Unverified');
  const [scope, setScope] = useState<'supervisees' | 'all'>(isHrOrSuper ? 'all' : 'supervisees');
  const [supervisorFilter, setSupervisorFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Editing single entry modal state
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('P');
  const [editInTime, setEditInTime] = useState('09:00 AM');
  const [editOutTime, setEditOutTime] = useState('05:00 PM');
  const [editHoursWorked, setEditHoursWorked] = useState<number>(8);
  const [editDutyDescription, setEditDutyDescription] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [editVerificationStatus, setEditVerificationStatus] = useState<'Unverified' | 'Verified' | 'Correction Required'>('Verified');
  const [isProcessing, setIsProcessing] = useState(false);

  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const isMonthLocked = monthlyLocks[monthKey]?.isLocked || false;

  // Map employee EID to employee record
  const employeeMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach(e => map.set(e.eid, e));
    return map;
  }, [employees]);

  // List of distinct supervisors from employee database
  const supervisorList = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      if (e.reportingSupervisor && e.reportingSupervisor.trim()) {
        set.add(e.reportingSupervisor.trim());
      }
    });
    return Array.from(set).sort();
  }, [employees]);

  // Total records supervised by current user in this month
  const mySuperviseeCount = useMemo(() => {
    if (!currentUser) return 0;
    return allAttendance.filter(a => a.month === monthKey && isSupervisedBy(a.eid, currentUser, employees)).length;
  }, [allAttendance, monthKey, currentUser, employees]);

  // Filter records based on month, status, scope, supervisor, and search
  const filteredRecords = useMemo(() => {
    return allAttendance.filter(a => {
      if (a.month !== monthKey) return false;
      if (statusFilter !== 'ALL' && a.verificationStatus !== statusFilter) return false;

      const emp = employeeMap.get(a.eid);

      // Scope filtering
      if (scope === 'supervisees' && currentUser) {
        const supervised = isSupervisedBy(a.eid, currentUser, employees);
        if (!supervised) return false;
      }

      // Explicit Supervisor filter
      if (supervisorFilter !== 'ALL') {
        if (!emp || emp.reportingSupervisor !== supervisorFilter) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchEid = a.eid.toLowerCase().includes(q);
        const matchName = a.employeeName.toLowerCase().includes(q);
        const matchDate = a.date.includes(q);
        const matchDept = (a.department || '').toLowerCase().includes(q);
        if (!matchEid && !matchName && !matchDate && !matchDept) return false;
      }
      return true;
    });
  }, [allAttendance, monthKey, statusFilter, searchQuery, scope, supervisorFilter, employeeMap, currentUser, employees]);

  // Unverified records currently shown
  const unverifiedCount = useMemo(() => {
    return filteredRecords.filter(r => r.verificationStatus !== 'Verified').length;
  }, [filteredRecords]);

  // Select all / deselect all
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRecords.map(r => r.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Batch Verify Selected
  const handleBatchVerify = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);

    try {
      const batch = writeBatch(db);
      const nowStr = new Date().toISOString();

      selectedIds.forEach(id => {
        const ref = doc(db, 'attendance', id);
        batch.update(ref, {
          verificationStatus: 'Verified',
          verifiedBy: verifierTitle,
          verifiedAt: nowStr,
          updatedAt: nowStr
        });
      });

      await batch.commit();

      // Audit Log
      await addDoc(collection(db, 'auditLogs'), sanitizeForFirestore({
        action: 'BATCH_ATTENDANCE_VERIFIED',
        recordType: 'Attendance',
        recordId: `${selectedIds.size}_records`,
        modifiedBy: verifierTitle,
        modifiedAt: nowStr,
        reason: `${verifierTitle} verified ${selectedIds.size} attendance records for ${monthKey}`
      }));

      setSelectedIds(new Set());
      setIsProcessing(false);
      onRefreshAttendance();
    } catch (err: any) {
      setIsProcessing(false);
      alert('Verification error: ' + err.message);
    }
  };

  // 1-Click Mass Verify: Verify All Unverified in the current filtered view
  const handleVerifyAllUnverified = async () => {
    const unverifiedList = filteredRecords.filter(r => r.verificationStatus !== 'Verified');
    if (unverifiedList.length === 0) {
      alert('All displayed records are already verified.');
      return;
    }

    if (!confirm(`Are you sure you want to verify all ${unverifiedList.length} unverified records in one click?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      const nowStr = new Date().toISOString();

      unverifiedList.forEach(r => {
        const ref = doc(db, 'attendance', r.id);
        batch.update(ref, {
          verificationStatus: 'Verified',
          verifiedBy: verifierTitle,
          verifiedAt: nowStr,
          updatedAt: nowStr
        });
      });

      await batch.commit();

      await addDoc(collection(db, 'auditLogs'), sanitizeForFirestore({
        action: 'BATCH_ATTENDANCE_VERIFIED',
        recordType: 'Attendance',
        recordId: `${unverifiedList.length}_records`,
        modifiedBy: verifierTitle,
        modifiedAt: nowStr,
        reason: `${verifierTitle} one-click mass verified ${unverifiedList.length} records for ${monthKey}`
      }));

      setSelectedIds(new Set());
      setIsProcessing(false);
      onRefreshAttendance();
    } catch (err: any) {
      setIsProcessing(false);
      alert('Mass verification error: ' + err.message);
    }
  };

  // Quick Approve single record directly from row
  const handleQuickApprove = async (record: AttendanceRecord) => {
    setIsProcessing(true);
    const nowStr = new Date().toISOString();
    try {
      const ref = doc(db, 'attendance', record.id);
      await setDoc(ref, sanitizeForFirestore({
        ...record,
        verificationStatus: 'Verified',
        verifiedBy: verifierTitle,
        verifiedAt: nowStr,
        updatedAt: nowStr
      }), { merge: true });

      await addDoc(collection(db, 'auditLogs'), sanitizeForFirestore({
        action: 'ATTENDANCE_VERIFIED',
        recordType: 'Attendance',
        recordId: record.id,
        eid: record.eid,
        modifiedBy: verifierTitle,
        modifiedAt: nowStr,
        reason: `Attendance approved by ${verifierTitle}`
      }));

      setIsProcessing(false);
      onRefreshAttendance();
    } catch (err: any) {
      setIsProcessing(false);
      alert('Approval error: ' + err.message);
    }
  };

  // Delete Record (HR / Admin Only)
  const handleDeleteRecord = async (record: AttendanceRecord) => {
    if (!isHrOrSuper) {
      alert('Only HR Admin can delete attendance documents.');
      return;
    }
    if (!confirm(`Delete attendance record for ${record.employeeName} on ${record.date}?`)) return;

    try {
      await deleteDoc(doc(db, 'attendance', record.id));

      await addDoc(collection(db, 'auditLogs'), sanitizeForFirestore({
        action: 'ATTENDANCE_DELETED',
        recordType: 'Attendance',
        recordId: record.id,
        eid: record.eid,
        previousValue: JSON.stringify(record),
        modifiedBy: verifierTitle,
        modifiedAt: new Date().toISOString(),
        reason: 'HR deleted erroneous attendance record'
      }));

      onRefreshAttendance();
    } catch (err: any) {
      alert('Error deleting: ' + err.message);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditStatus(record.status);
    setEditInTime(record.inTime || '09:00 AM');
    setEditOutTime(record.outTime || '05:00 PM');
    setEditHoursWorked(record.hoursWorked || 8);
    setEditDutyDescription(record.dutyDescription || '');
    setEditRemarks(record.remarks || '');
    setEditVerificationStatus(record.verificationStatus);
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    setIsProcessing(true);

    const nowStr = new Date().toISOString();
    const updated: AttendanceRecord = {
      ...editingRecord,
      status: editStatus,
      inTime: editInTime.trim(),
      outTime: editOutTime.trim(),
      hoursWorked: Number(editHoursWorked) || 8,
      dutyDescription: editDutyDescription.trim(),
      remarks: editRemarks.trim(),
      verificationStatus: editVerificationStatus,
      verifiedBy: verifierTitle,
      verifiedAt: nowStr,
      updatedAt: nowStr
    };

    try {
      await setDoc(doc(db, 'attendance', editingRecord.id), sanitizeForFirestore(updated));

      await addDoc(collection(db, 'auditLogs'), sanitizeForFirestore({
        action: 'ATTENDANCE_CORRECTED',
        recordType: 'Attendance',
        recordId: editingRecord.id,
        eid: editingRecord.eid,
        previousValue: JSON.stringify(editingRecord),
        newValue: JSON.stringify(updated),
        modifiedBy: verifierTitle,
        modifiedAt: nowStr,
        reason: `Attendance edited & verified by ${verifierTitle}`
      }));

      setEditingRecord(null);
      setIsProcessing(false);
      onRefreshAttendance();
    } catch (err: any) {
      setIsProcessing(false);
      alert('Error saving record: ' + err.message);
    }
  };

  // Toggle Month Lock (HR only)
  const handleToggleMonthLock = async () => {
    if (!isHrOrSuper) {
      alert('Only HR & Admin can lock/unlock payroll months.');
      return;
    }
    const newLockState = !isMonthLocked;
    const nowStr = new Date().toISOString();

    const lockPayload: MonthlyLock = {
      month: monthKey,
      isLocked: newLockState,
      lockedBy: verifierTitle,
      lockedAt: nowStr,
      remarks: newLockState ? 'Month officially locked for payroll and reporting' : 'Month unlocked by HR'
    };

    try {
      await setDoc(doc(db, 'monthlyLocks', monthKey), sanitizeForFirestore(lockPayload));

      await addDoc(collection(db, 'auditLogs'), sanitizeForFirestore({
        action: newLockState ? 'MONTH_LOCKED' : 'MONTH_UNLOCKED',
        recordType: 'Lock',
        recordId: monthKey,
        modifiedBy: verifierTitle,
        modifiedAt: nowStr,
        reason: lockPayload.remarks
      }));

      onRefreshLocks();
    } catch (err: any) {
      alert('Error updating month lock: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner with Verifier Identity & Month Lock Status */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900 tracking-tight">
                  Attendance Verification & Supervisor Approval
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                  উপস্থিতি যাচাই ও অনুমোদন
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Logged in as Verifier: <strong className="text-slate-800">{verifierTitle}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Month Lock Control */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-slate-400 block font-medium">Month Status: {monthKey}</span>
            <span className={`text-xs font-bold ${isMonthLocked ? 'text-rose-600' : 'text-emerald-600'}`}>
              {isMonthLocked ? '🔒 LOCKED for Payroll' : '🔓 OPEN for edits'}
            </span>
          </div>

          {isHrOrSuper && (
            <button
              onClick={handleToggleMonthLock}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors ${
                isMonthLocked
                  ? 'bg-amber-600 hover:bg-amber-500 text-white'
                  : 'bg-rose-700 hover:bg-rose-600 text-white'
              }`}
            >
              {isMonthLocked ? (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>{t('unlockMonth')}</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t('lockMonth')}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Scope Selector Tabs (My Supervisees vs All Staff) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setScope('supervisees')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              scope === 'supervisees'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>My Supervisees (আমার দায়িত্বাধীন কর্মী)</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
              scope === 'supervisees' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {mySuperviseeCount}
            </span>
          </button>

          <button
            onClick={() => setScope('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              scope === 'all'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>All Staff (সকল কর্মী)</span>
          </button>
        </div>

        {/* 1-Click Mass Verify Button */}
        {unverifiedCount > 0 && (
          <button
            onClick={handleVerifyAllUnverified}
            disabled={isProcessing}
            className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-lg shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>⚡ Verify All Unverified in View ({unverifiedCount})</span>
          </button>
        )}
      </div>

      {/* Filter and Actions Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Month & Year */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
          >
            {[
              'January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'
            ].map((m, idx) => (
              <option key={m} value={idx + 1}>{m}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Verification Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-semibold text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="Unverified">Unverified Only</option>
            <option value="Verified">Verified Only</option>
            <option value="Correction Required">Correction Required</option>
          </select>

          {/* Supervisor Filter (if viewing all) */}
          {scope === 'all' && (
            <select
              value={supervisorFilter}
              onChange={(e) => setSupervisorFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 max-w-[200px]"
            >
              <option value="ALL">All Assigned Supervisors</option>
              {supervisorList.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          {/* Search */}
          <div className="relative min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search EID, Name, Date..."
              className="pl-7 pr-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
          </div>
        </div>

        {/* Selected Batch Verification Button */}
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchVerify}
              disabled={isProcessing}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Verify Selected ({selectedIds.size})</span>
            </button>
          )}
          <span className="text-[11px] text-slate-500 font-medium">
            {filteredRecords.length} records shown
          </span>
        </div>

      </div>

      {/* Table of Attendance Records */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-3 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filteredRecords.length > 0 && selectedIds.size === filteredRecords.length}
                    onChange={handleToggleSelectAll}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Assigned Supervisor</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Timing / Hours</th>
                <th className="px-4 py-3">Duty / Remarks</th>
                <th className="px-4 py-3 text-center">Verification Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                    <p className="font-semibold text-sm">No attendance records found for this filter criteria.</p>
                    <p className="text-xs mt-1">Try switching to "All Staff" or selecting a different month.</p>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => {
                  const emp = employeeMap.get(r.eid);
                  const isVerified = r.verificationStatus === 'Verified';

                  return (
                    <tr 
                      key={r.id} 
                      className={`hover:bg-slate-50 transition-colors ${
                        selectedIds.has(r.id) ? 'bg-emerald-50/50' : ''
                      }`}
                    >
                      {/* Select Checkbox */}
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.id)}
                          onChange={() => handleToggleSelect(r.id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {r.date}
                      </td>

                      {/* Employee */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 block">{r.employeeName}</span>
                        <span className="text-[11px] text-slate-500 font-mono">{r.eid} • {r.department}</span>
                      </td>

                      {/* Assigned Supervisor */}
                      <td className="px-4 py-3 text-[11px] text-slate-600">
                        {emp?.reportingSupervisor || '—'}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded font-extrabold text-[10px] ${
                          r.status in ATTENDANCE_STATUS_COLORS 
                            ? ATTENDANCE_STATUS_COLORS[r.status as AttendanceStatus].bg + ' ' + ATTENDANCE_STATUS_COLORS[r.status as AttendanceStatus].text
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {r.status}
                        </span>
                      </td>

                      {/* Shift / Hours */}
                      <td className="px-4 py-3 text-center font-mono text-[11px]">
                        <div>{r.inTime || emp?.standardInTime || '09:00 AM'} - {r.outTime || emp?.standardOutTime || '05:00 PM'}</div>
                        <span className="text-[10px] text-slate-500 font-bold">{r.hoursWorked || emp?.dailyHours || 8}h</span>
                      </td>

                      {/* Duty / Remarks */}
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-slate-800 truncate font-medium">
                          {r.dutyDescription || '—'}
                        </p>
                        {r.remarks && (
                          <p className="text-[10px] text-slate-500 truncate italic">
                            Note: {r.remarks}
                          </p>
                        )}
                        {r.verifiedBy && (
                          <p className="text-[10px] text-teal-700 font-medium truncate mt-0.5">
                            Verified by: {r.verifiedBy}
                          </p>
                        )}
                      </td>

                      {/* Verification Status */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                          isVerified
                            ? 'bg-teal-50 text-teal-800 border-teal-300'
                            : r.verificationStatus === 'Correction Required'
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : 'bg-amber-50 text-amber-800 border-amber-300'
                        }`}>
                          {r.verificationStatus}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick 1-Click Approve */}
                          {!isVerified && (
                            <button
                              onClick={() => handleQuickApprove(r)}
                              className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded border border-emerald-300 transition-colors flex items-center gap-1"
                              title="Instant Approve"
                            >
                              <Check className="w-3 h-3" />
                              <span>Verify</span>
                            </button>
                          )}

                          {/* Edit / Correct Modal */}
                          <button
                            onClick={() => handleOpenEdit(r)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-emerald-700 transition-colors"
                            title="Edit / Correct attendance"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Delete (HR only) */}
                          {isHrOrSuper && (
                            <button
                              onClick={() => handleDeleteRecord(r)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-600 hover:text-rose-700 transition-colors"
                              title="Delete record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Record Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 text-xs">
            <div className="bg-slate-900 px-5 py-3.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm">
                  Edit & Verify Attendance: {editingRecord.employeeName} ({editingRecord.date})
                </h3>
              </div>
              <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Attendance Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as AttendanceStatus)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold bg-white"
                  >
                    {['P', 'CL', 'SL', 'AL', 'ML', 'PL', 'UL', 'A', 'WO', 'PH', 'OD', 'TR', 'WFH', 'CO', 'HD'].map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Verification Status</label>
                  <select
                    value={editVerificationStatus}
                    onChange={(e) => setEditVerificationStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold bg-white text-emerald-800"
                  >
                    <option value="Verified">Verified (অনুমোদিত)</option>
                    <option value="Unverified">Unverified (অপেক্ষমাণ)</option>
                    <option value="Correction Required">Correction Required (সংশোধন প্রয়োজন)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">In Time</label>
                  <input
                    type="text"
                    value={editInTime}
                    onChange={(e) => setEditInTime(e.target.value)}
                    placeholder="09:00 AM"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Out Time</label>
                  <input
                    type="text"
                    value={editOutTime}
                    onChange={(e) => setEditOutTime(e.target.value)}
                    placeholder="05:00 PM"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hours Worked</label>
                  <input
                    type="number"
                    value={editHoursWorked}
                    onChange={(e) => setEditHoursWorked(Number(e.target.value))}
                    min={0}
                    max={24}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Task / Duty Description</label>
                <textarea
                  rows={2}
                  value={editDutyDescription}
                  onChange={(e) => setEditDutyDescription(e.target.value)}
                  placeholder="Official duty summary performed on this date"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supervisor Remarks / Reason for Edit</label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="e.g. Corrected duty off day duty approved by Director"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-500">
                Approver Signature recorded as: <strong className="text-slate-800">{verifierTitle}</strong>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isProcessing}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-xs disabled:opacity-50"
                >
                  {isProcessing ? 'Saving...' : 'Save & Verify'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
