import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { LeaveRecord, Employee } from '../../types';
import { doc, setDoc, addDoc, collection, deleteDoc } from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../../lib/firebase';
import { 
  Briefcase, 
  PlusCircle, 
  Calendar, 
  Check, 
  X, 
  Clock, 
  AlertCircle, 
  FileText, 
  Download,
  Filter,
  CheckCircle2,
  Trash2
} from 'lucide-react';
import { exportLeaveUtilizationExcel } from '../../lib/excelGenerator';
import { calculateEmployeeLeaveQuota } from '../../lib/attendanceCalculator';

interface LeaveManagementViewProps {
  leaveRecords: LeaveRecord[];
  employees: Employee[];
  onRefreshLeaves: () => void;
  isMonthLocked: boolean;
}

export const LeaveManagementView: React.FC<LeaveManagementViewProps> = ({
  leaveRecords,
  employees,
  onRefreshLeaves,
  isMonthLocked
}) => {
  const { currentUser, role } = useAuth();
  const { t, language } = useLanguage();

  const isHrOrSuper = role === 'HR ADMIN' || role === 'SUPER ADMIN';

  // Leave Application Modal
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveRecord['leaveType']>('Casual Leave');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalDays, setTotalDays] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [supportingDoc, setSupportingDoc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Automatically calculate working days when dates change
  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      const diffTime = e.getTime() - s.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      setTotalDays(diffDays > 0 ? diffDays : 1);
    }
  };

  // Submit Leave Application
  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setFormError('');

    if (totalDays <= 0) {
      setFormError('End date must be on or after start date.');
      return;
    }

    if (!reason.trim()) {
      setFormError('Please enter the reason for leave.');
      return;
    }

    setIsSubmitting(true);

    try {
      const leaveId = `leave_${Date.now()}`;
      const nowStr = new Date().toISOString();

      const payload: LeaveRecord = {
        id: leaveId,
        eid: currentUser.eid,
        employeeName: currentUser.nameEn,
        leaveType: selectedLeaveType,
        startDate,
        endDate,
        totalDays,
        reason: reason.trim(),
        supportingDocument: supportingDoc.trim(),
        status: isHrOrSuper ? 'Verified' : 'Unverified',
        createdAt: nowStr
      };

      if (isHrOrSuper) {
        payload.verifiedBy = `${currentUser.nameEn} (HR)`;
        payload.verifiedAt = nowStr;
      }

      await setDoc(doc(db, 'leaveRecords', leaveId), sanitizeForFirestore(payload));

      await addDoc(collection(db, 'auditLogs'), sanitizeForFirestore({
        action: 'LEAVE_SUBMITTED',
        recordType: 'Leave',
        recordId: leaveId,
        eid: currentUser.eid,
        modifiedBy: `${currentUser.nameEn} (${currentUser.eid})`,
        modifiedAt: nowStr,
        reason: `Applied for ${totalDays} days of ${selectedLeaveType}`
      }));

      setIsSubmitting(false);
      setIsApplyModalOpen(false);
      setReason('');
      setSupportingDoc('');
      onRefreshLeaves();
    } catch (err: any) {
      setIsSubmitting(false);
      setFormError(err.message || 'Failed to submit leave application.');
    }
  };

  // HR Verify or Reject
  const handleUpdateStatus = async (record: LeaveRecord, newStatus: LeaveRecord['status'], remarks?: string) => {
    const nowStr = new Date().toISOString();
    const updated: LeaveRecord = {
      ...record,
      status: newStatus,
      verifiedBy: `${currentUser?.nameEn} (HR Admin)`,
      verifiedAt: nowStr,
      remarks: remarks || `Leave status updated to ${newStatus}`
    };

    try {
      await setDoc(doc(db, 'leaveRecords', record.id), updated);

      await addDoc(collection(db, 'auditLogs'), {
        action: `LEAVE_${newStatus.toUpperCase().replace(/\s+/g, '_')}`,
        recordType: 'Leave',
        recordId: record.id,
        eid: record.eid,
        previousValue: JSON.stringify(record),
        newValue: JSON.stringify(updated),
        modifiedBy: `${currentUser?.nameEn} (${currentUser?.eid})`,
        modifiedAt: nowStr,
        reason: `HR ${newStatus} leave application`
      });

      onRefreshLeaves();
    } catch (err: any) {
      alert('Error updating leave: ' + err.message);
    }
  };

  // Delete Leave
  const handleDeleteLeave = async (id: string) => {
    if (!window.confirm('Delete this leave application?')) return;
    try {
      await deleteDoc(doc(db, 'leaveRecords', id));
      onRefreshLeaves();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Filtered leaves
  const displayedLeaves = useMemo(() => {
    if (isHrOrSuper) {
      return leaveRecords;
    }
    return leaveRecords.filter(l => l.eid === currentUser?.eid);
  }, [leaveRecords, isHrOrSuper, currentUser]);

  // Leave Balances for logged-in user (Ratio-based: 6d=16 CL, 14 SL, 0 AL; pro-rata with .5 rounding up)
  const balance = useMemo(() => {
    const quota = calculateEmployeeLeaveQuota(
      currentUser?.workingDaysPerWeek || (currentUser?.workScheduleDays ? currentUser.workScheduleDays.length : 6)
    );
    const empLeaves = leaveRecords.filter(
      l => l.eid === currentUser?.eid && (l.status === 'Verified' || l.status === 'Unverified')
    );
    let clUsed = 0;
    let slUsed = 0;
    let alUsed = 0;
    let otherUsed = 0;

    empLeaves.forEach(l => {
      if (l.leaveType === 'Casual Leave') clUsed += l.totalDays;
      else if (l.leaveType === 'Sick Leave') slUsed += l.totalDays;
      else if (l.leaveType === 'Annual Leave') alUsed += l.totalDays;
      else otherUsed += l.totalDays;
    });

    return {
      cl: { total: quota.casualLeave, used: clUsed, remaining: Math.max(0, quota.casualLeave - clUsed) },
      sl: { total: quota.sickLeave, used: slUsed, remaining: Math.max(0, quota.sickLeave - slUsed) },
      al: { total: 0, used: alUsed, remaining: 0 },
      other: otherUsed,
      ratio: quota.ratio,
      workingDays: currentUser?.workingDaysPerWeek || (currentUser?.workScheduleDays ? currentUser.workScheduleDays.length : 6)
    };
  }, [leaveRecords, currentUser]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {t('navLeaveManagement')}
              </h1>
              <p className="text-xs text-slate-500">
                Official LEEDO leave records, annual entitlements ({balance.workingDays} working days/week, {balance.ratio}% ratio), and HR verification.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto">
          {isHrOrSuper && (
            <button
              onClick={() => exportLeaveUtilizationExcel(employees, leaveRecords, new Date().getFullYear())}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Leave Report</span>
            </button>
          )}

          <button
            onClick={() => setIsApplyModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t('applyLeave')}</span>
          </button>
        </div>
      </div>

      {/* Leave Entitlement Cards (For Current Employee) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-900">Casual Leave (CL)</span>
            <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">{balance.workingDays}d/wk</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-amber-700">{balance.cl.remaining}</span>
            <span className="text-xs text-slate-400">/ {balance.cl.total} days</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{balance.cl.used} days taken</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-orange-900">Sick Leave (SL)</span>
            <span className="text-[10px] text-orange-700 font-bold bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">{balance.workingDays}d/wk</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-orange-700">{balance.sl.remaining}</span>
            <span className="text-xs text-slate-400">/ {balance.sl.total} days</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{balance.sl.used} days taken</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs opacity-80">
          <span className="text-xs font-semibold text-slate-500">Annual Leave (AL)</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-slate-400">0</span>
            <span className="text-xs text-slate-400">/ 0 days</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">No Annual Leave policy</p>
        </div>

        {/* Compensatory Off (CO) Earned from Extra Duty */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 rounded-xl border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">Compensatory Off (CO)</span>
            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.2 bg-emerald-600 text-white rounded">Earned</span>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-emerald-700">Available</span>
          </div>
          <p className="text-[10px] text-emerald-800 mt-1">Earned via Extra Off-Day Duties</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-purple-900">Other Leaves</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-purple-700">{balance.other}</span>
            <span className="text-xs text-slate-400">days</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Maternity / Paternity / Unpaid</p>
        </div>
      </div>

      {/* Leave Applications Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
            {isHrOrSuper ? 'All Organization Leave Records' : 'My Leave Applications'}
          </h3>
          <span className="text-[11px] text-slate-400 font-medium">
            {displayedLeaves.length} applications
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Leave Type</th>
                <th className="px-4 py-3">Start Date</th>
                <th className="px-4 py-3">End Date</th>
                <th className="px-4 py-3 text-center">Days</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3 text-center">Verification</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedLeaves.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                    No leave records found.
                  </td>
                </tr>
              ) : (
                displayedLeaves.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-900 block">{l.employeeName}</span>
                      <span className="text-[11px] text-slate-500 font-mono">{l.eid}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-800">
                      {l.leaveType}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {l.startDate}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {l.endDate}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-slate-900">
                      {l.totalDays}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate text-slate-600">
                      {l.reason}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        l.status === 'Verified'
                          ? 'bg-teal-50 text-teal-800 border-teal-200'
                          : l.status === 'Rejected'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isHrOrSuper && l.status === 'Unverified' && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(l, 'Verified')}
                              className="px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-[10px] font-bold transition-colors"
                              title="Verify Leave"
                            >
                              Verify
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(l, 'Rejected')}
                              className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold transition-colors"
                              title="Reject Leave"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {(isHrOrSuper || l.eid === currentUser?.eid) && (
                          <button
                            onClick={() => handleDeleteLeave(l.id)}
                            className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-rose-700 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Leave Modal */}
      {isApplyModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 text-xs">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm">{t('applyLeave')}</h3>
              </div>
              <button
                onClick={() => setIsApplyModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Leave Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedLeaveType}
                  onChange={(e) => setSelectedLeaveType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="Casual Leave">Casual Leave (CL)</option>
                  <option value="Sick Leave">Sick Leave (SL)</option>
                  <option value="Annual Leave">Annual Leave (AL)</option>
                  <option value="Maternity Leave">Maternity Leave (ML)</option>
                  <option value="Paternity Leave">Paternity Leave (PL)</option>
                  <option value="Unpaid Leave">Unpaid Leave (UL)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleDateChange(e.target.value, endDate)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    End Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleDateChange(startDate, e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Calculated Working Days: <strong className="text-emerald-700">{totalDays}</strong>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Reason for Leave <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why you are taking this leave..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Supporting Document Ref / Medical Prescription (Optional)
                </label>
                <input
                  type="text"
                  value={supportingDoc}
                  onChange={(e) => setSupportingDoc(e.target.value)}
                  placeholder="e.g. Dr. prescription ref / travel memo"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Leave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
