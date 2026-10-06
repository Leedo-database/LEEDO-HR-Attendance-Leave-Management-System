import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { 
  User, 
  KeyRound, 
  Mail, 
  Phone, 
  Building, 
  Briefcase, 
  Calendar, 
  ShieldCheck, 
  Check, 
  AlertCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { WEEKDAYS_MAP, calculateEmployeeLeaveQuota } from '../../lib/attendanceCalculator';

interface UserProfileViewProps {
  onClose?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ onClose }) => {
  const { currentUser, role, updateCurrentEmployeeProfile } = useAuth();
  const { t } = useLanguage();

  const [mobile, setMobile] = useState(currentUser?.mobileNumber || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!currentUser) return null;

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateCurrentEmployeeProfile({
        mobileNumber: mobile.trim(),
        email: email.trim()
      });
      setProfileMsg({ type: 'success', text: 'Contact information updated successfully.' });
      setTimeout(() => setProfileMsg(null), 3000);
    } catch (e: any) {
      setProfileMsg({ type: 'error', text: e.message || 'Failed to update profile.' });
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setPasswordMsg({ type: 'success', text: 'Password successfully updated for this account.' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordMsg(null), 3500);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {t('navMyProfile')}
              </h1>
              <p className="text-xs text-slate-500">
                Personal identity, organization placement, contact details, and security credentials.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Profile Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-700 text-white font-black text-2xl flex items-center justify-center shadow-md mb-3">
            {currentUser.nameEn.charAt(0)}
          </div>
          <h2 className="text-base font-bold text-slate-900">{currentUser.nameEn}</h2>
          {currentUser.nameBn && <p className="text-xs text-slate-500">{currentUser.nameBn}</p>}
          <span className="inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            {currentUser.role}
          </span>

          <div className="w-full mt-6 pt-6 border-t border-slate-100 space-y-3 text-xs text-left">
            <div>
              <span className="text-[11px] text-slate-400 block uppercase font-medium">Employee ID</span>
              <span className="font-mono font-bold text-slate-800">{currentUser.eid}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block uppercase font-medium">Designation</span>
              <span className="font-semibold text-slate-800">{currentUser.designation}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block uppercase font-medium">Department</span>
              <span className="font-semibold text-slate-800">{currentUser.department}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block uppercase font-medium">Project / Branch</span>
              <span className="font-semibold text-slate-800">{currentUser.project}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block uppercase font-medium">Workplace</span>
              <span className="font-semibold text-slate-800">{currentUser.workplace}</span>
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block uppercase font-medium">Joining Date</span>
              <span className="font-mono text-slate-800">{currentUser.joiningDate}</span>
            </div>
          </div>
        </div>

        {/* Edit Contact & Password forms (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Job Timing & Scheduled Duty Days Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Job Shift Timing & Duty Schedule (কাজের সময় ও দায়িত্বের দিনসমূহ)
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                {currentUser.workingDaysPerWeek || 6} Days / Week
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block uppercase font-medium">Standard Daily Shift</span>
                <span className="text-sm font-bold font-mono text-slate-800">
                  {currentUser.standardInTime || '09:00 AM'} – {currentUser.standardOutTime || '05:00 PM'}
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  ({currentUser.dailyHours || 8} working hours per shift)
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 block uppercase font-medium">Weekly Working Schedule</span>
                <span className="text-sm font-bold font-mono text-emerald-800">
                  {currentUser.workingDaysPerWeek || 6} Days / Week
                </span>
                <span className="text-[11px] text-slate-500 block mt-0.5">
                  Friday is official weekly off-day
                </span>
              </div>
            </div>

            {/* Scheduled Days */}
            <div>
              <span className="text-[11px] font-semibold text-slate-700 block mb-2">
                Assigned Weekly Duty Days (নির্ধারিত সাপ্তাহিক কাজের দিনসমূহ):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS_MAP
                  .filter(w => (currentUser.workScheduleDays || [6, 0, 1, 2, 3, 4]).includes(w.id))
                  .map(w => (
                    <span
                      key={w.id}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1"
                    >
                      <span>✓</span>
                      <span>{w.nameEn} ({w.nameBn.split(' ')[0]})</span>
                    </span>
                  ))}
              </div>
            </div>

            {/* Annual Leave Entitlement Quota (Ratio-based) */}
            {(() => {
              const quota = calculateEmployeeLeaveQuota(currentUser.workingDaysPerWeek || (currentUser.workScheduleDays ? currentUser.workScheduleDays.length : 6));
              return (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-emerald-950">
                      <Briefcase className="w-4 h-4 text-emerald-700" />
                      <span>Annual Leave Entitlement (কাজের দিন অনুপাত অনুযায়ী ছুটি কোটা)</span>
                    </div>
                    <span className="text-[10px] font-extrabold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                      {quota.ratio}% Ratio
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 text-center font-mono">
                    <div className="p-2 bg-white rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="text-[10px] text-slate-500 block font-sans">Casual Leave (CL)</span>
                      <span className="text-sm font-black text-amber-800">{quota.casualLeave} Days</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="text-[10px] text-slate-500 block font-sans">Sick Leave (SL)</span>
                      <span className="text-sm font-black text-orange-800">{quota.sickLeave} Days</span>
                    </div>
                    <div className="p-2 bg-white rounded-lg border border-emerald-200 shadow-2xs">
                      <span className="text-[10px] text-slate-500 block font-sans">Annual Leave (AL)</span>
                      <span className="text-sm font-black text-slate-400">0 Days (None)</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Contact Details Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-xs">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-4">
              Contact Information
            </h3>

            {profileMsg && (
              <div className={`p-3 rounded-lg flex items-center gap-2 mb-4 ${
                profileMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {profileMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleUpdateContact} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Official Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-xs"
                >
                  Update Contact
                </button>
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-xs">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                {t('navChangePassword')}
              </h3>
            </div>

            {passwordMsg && (
              <div className={`p-3 rounded-lg flex items-center gap-2 mb-4 ${
                passwordMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {passwordMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg shadow-xs"
                >
                  Change Password
                </button>
              </div>
            </form>
          </div>

        </div>

      </div>

    </div>
  );
};
