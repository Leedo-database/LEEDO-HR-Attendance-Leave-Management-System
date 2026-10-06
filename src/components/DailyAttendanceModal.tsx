import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { AttendanceRecord, AttendanceStatus, Employee, Holiday } from '../types';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, sanitizeForFirestore } from '../lib/firebase';
import { isFriday, isEmployeeScheduledWorkDay, ATTENDANCE_STATUS_COLORS } from '../lib/attendanceCalculator';
import { X, Check, AlertCircle, Calendar, ShieldCheck, Clock, Sparkles } from 'lucide-react';

interface DailyAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (record: AttendanceRecord) => void;
  initialDate?: string;
  targetEmployee?: Employee; // HR can submit for another employee
  existingRecord?: AttendanceRecord | null;
  holidays: Holiday[];
  isMonthLocked?: boolean;
}

export const DailyAttendanceModal: React.FC<DailyAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialDate,
  targetEmployee,
  existingRecord,
  holidays,
  isMonthLocked = false
}) => {
  const { currentUser, role } = useAuth();
  const { t, language } = useLanguage();

  const isHrOrSuper = role === 'HR ADMIN' || role === 'SUPER ADMIN';
  const employee = targetEmployee || currentUser;

  // Format today in YYYY-MM-DD
  const getTodayString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [date, setDate] = useState<string>(initialDate || getTodayString());
  const [status, setStatus] = useState<AttendanceStatus>('P');
  const [dutyDescription, setDutyDescription] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [supportingDoc, setSupportingDoc] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [dayNotice, setDayNotice] = useState<string>('');

  // Auto-detect Friday or Public Holiday when date changes
  useEffect(() => {
    if (existingRecord) {
      setStatus(existingRecord.status);
      setDutyDescription(existingRecord.dutyDescription || '');
      setRemarks(existingRecord.remarks || '');
      setSupportingDoc(existingRecord.supportingDocument || '');
      return;
    }

    if (!date) return;

    const friday = isFriday(date);
    const matchedHoliday = holidays.find(h => h.date === date);
    const isScheduled = isEmployeeScheduledWorkDay(date, employee || undefined);

    if (friday) {
      setStatus('WO');
      setDayNotice(language === 'bn' ? 'শুক্রবার: সাপ্তাহিক ছুটি (Weekly Holiday)' : 'Friday: Weekly Holiday');
    } else if (matchedHoliday) {
      setStatus('PH');
      setDayNotice(`${matchedHoliday.nameEn} (${language === 'bn' ? matchedHoliday.nameBn : 'Public Holiday'})`);
    } else if (!isScheduled) {
      setStatus('WO');
      setDayNotice(language === 'bn' ? 'সাপ্তাহিক রস্টারের বাইরের দিন (Weekly Off)' : 'Non-Scheduled Day: Outside weekly duty roster');
    } else {
      setStatus('P');
      setDayNotice('');
    }
  }, [date, existingRecord, holidays, employee, language]);

  if (!isOpen || !employee) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!date) {
      setErrorMsg('Please select a date.');
      return;
    }

    if (isMonthLocked && !isHrOrSuper) {
      setErrorMsg(t('monthLockedNotice'));
      return;
    }

    setIsSubmitting(true);

    try {
      const docId = `${employee.eid}_${date}`;
      const monthStr = date.substring(0, 7);
      const yearStr = date.substring(0, 4);

      const payload: AttendanceRecord = {
        id: docId,
        eid: employee.eid,
        employeeName: employee.nameEn,
        department: employee.department,
        project: employee.project,
        date,
        month: monthStr,
        year: yearStr,
        status,
        dutyDescription: dutyDescription.trim(),
        remarks: remarks.trim(),
        supportingDocument: supportingDoc.trim(),
        verificationStatus: isHrOrSuper ? 'Verified' : (existingRecord?.verificationStatus || 'Unverified'),
        source: existingRecord ? 'ManualCorrection' : 'DailyEntry',
        createdAt: existingRecord?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (isHrOrSuper) {
        payload.verifiedBy = `${currentUser?.nameEn || 'HR'} (${currentUser?.role || 'HR ADMIN'})`;
        payload.verifiedAt = new Date().toISOString();
      } else if (existingRecord?.verifiedBy) {
        payload.verifiedBy = existingRecord.verifiedBy;
        if (existingRecord?.verifiedAt) {
          payload.verifiedAt = existingRecord.verifiedAt;
        }
      }

      const cleanPayload = sanitizeForFirestore(payload);

      // Set to Firestore deterministic ID
      try {
        await setDoc(doc(db, 'attendance', docId), cleanPayload);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.WRITE, `attendance/${docId}`);
      }

      // Record in Audit Log
      try {
        const auditPayload = sanitizeForFirestore({
          action: existingRecord ? 'ATTENDANCE_CORRECTED' : 'ATTENDANCE_SUBMITTED',
          recordType: 'Attendance',
          recordId: docId,
          eid: employee.eid,
          previousValue: existingRecord ? JSON.stringify(existingRecord) : null,
          newValue: JSON.stringify(payload),
          modifiedBy: `${currentUser?.nameEn} (${currentUser?.eid})`,
          modifiedAt: new Date().toISOString(),
          reason: isHrOrSuper ? 'HR attendance update' : 'Employee daily submission'
        });
        await addDoc(collection(db, 'auditLogs'), auditPayload);
      } catch (auditErr) {
        console.warn('Audit log write error:', auditErr);
      }

      setIsSubmitting(false);
      onSuccess(payload);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Failed to submit attendance.');
    }
  };

  const statusOptions: { value: AttendanceStatus; label: string; desc: string }[] = [
    { value: 'P', label: 'P - Present', desc: 'Attended regular duties' },
    { value: 'CL', label: 'CL - Casual Leave', desc: 'Approved casual leave' },
    { value: 'SL', label: 'SL - Sick Leave', desc: 'Medical / illness leave' },
    { value: 'AL', label: 'AL - Annual Leave', desc: 'Planned annual leave' },
    { value: 'UL', label: 'UL - Unpaid Leave', desc: 'Leave without pay' },
    { value: 'A', label: 'A - Absent', desc: 'Unapproved absence' },
    { value: 'WO', label: 'WO - Weekly Off', desc: 'Friday weekly holiday' },
    { value: 'PH', label: 'PH - Public Holiday', desc: 'Bangladesh National Holiday' },
    { value: 'OD', label: 'OD - Official Duty', desc: 'Deputation / field mission' },
    { value: 'TR', label: 'TR - Training', desc: 'Attending training session' },
    { value: 'WFH', label: 'WFH - Work From Home', desc: 'Approved remote duty' },
    { value: 'CO', label: 'CO - Compensatory Off', desc: 'Compensatory leave' },
    { value: 'HD', label: 'HD - Half Day', desc: 'Half day attendance (0.5)' }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                {existingRecord ? 'Edit Attendance Record' : t('submitDailyAttendance')}
              </h3>
              <p className="text-xs text-slate-400">
                {employee.nameEn} ({employee.eid}) • {employee.department}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {dayNotice && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-semibold">{dayNotice}</span>
            </div>
          )}

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('date')} <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={!!existingRecord} // If editing, date is locked
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:bg-slate-100"
              required
            />
          </div>

          {/* Attendance Status Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('status')} <span className="text-rose-500">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-medium"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.desc}
                </option>
              ))}
            </select>
          </div>

          {/* Duty Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('dutyDescription')} <span className="text-slate-400 font-normal">(Optional for leave)</span>
            </label>
            <textarea
              rows={2}
              value={dutyDescription}
              onChange={(e) => setDutyDescription(e.target.value)}
              placeholder="e.g. Conducted Mobile School class at Sadarghat, attended staff meeting..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t('remarks')} <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any specific note, venue, or doctor prescription ref..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          {/* Verification Status info for HR */}
          {isHrOrSuper && (
            <div className="bg-teal-50 border border-teal-200 p-2.5 rounded-lg flex items-center gap-2 text-xs text-teal-800">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
              <span>As HR Admin, this entry will be automatically marked as <strong>Verified</strong>.</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{t('loading')}</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{existingRecord ? 'Update Record' : t('submit')}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
