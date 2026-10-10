import React, { useState, useEffect } from 'react';
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
  Sparkles,
  CloudCheck,
  Save,
  MapPin,
  GraduationCap,
  Users
} from 'lucide-react';
import { WEEKDAYS_MAP, calculateEmployeeLeaveQuota } from '../../lib/attendanceCalculator';

interface UserProfileViewProps {
  onClose?: () => void;
}

export const UserProfileView: React.FC<UserProfileViewProps> = ({ onClose }) => {
  const { currentUser, role, updateCurrentEmployeeProfile } = useAuth();
  const { t, language } = useLanguage();

  // Profile editable fields
  const [nameEn, setNameEn] = useState(currentUser?.nameEn || '');
  const [nameBn, setNameBn] = useState(currentUser?.nameBn || '');
  const [mobileNumber, setMobileNumber] = useState(currentUser?.mobileNumber || '');
  const [emergencyContact, setEmergencyContact] = useState(currentUser?.emergencyContact || '');
  const [personalEmail, setPersonalEmail] = useState(currentUser?.personalEmail || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [address, setAddress] = useState(currentUser?.address || '');
  const [highestEducation, setHighestEducation] = useState(currentUser?.highestEducation || '');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Sync state whenever currentUser updates from Firestore
  useEffect(() => {
    if (currentUser) {
      setNameEn(currentUser.nameEn || '');
      setNameBn(currentUser.nameBn || '');
      setMobileNumber(currentUser.mobileNumber || '');
      setEmergencyContact(currentUser.emergencyContact || '');
      setPersonalEmail(currentUser.personalEmail || '');
      setEmail(currentUser.email || '');
      setAddress(currentUser.address || '');
      setHighestEducation(currentUser.highestEducation || '');
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingProfile(true);
    setProfileMsg(null);

    try {
      const res = await updateCurrentEmployeeProfile({
        nameEn: nameEn.trim(),
        nameBn: nameBn.trim(),
        mobileNumber: mobileNumber.trim(),
        emergencyContact: emergencyContact.trim(),
        personalEmail: personalEmail.trim(),
        email: email.trim(),
        address: address.trim(),
        highestEducation: highestEducation.trim(),
      });

      if (res.success) {
        setProfileMsg({ 
          type: 'success', 
          text: language === 'bn' 
            ? 'প্রোফাইল ক্লাউড ডাটাবেজে (Firebase Cloud) সফলভাবে সংরক্ষিত হয়েছে।' 
            : 'Profile successfully updated and saved to Cloud Database (Firebase Firestore).' 
        });
        setTimeout(() => setProfileMsg(null), 4000);
      } else {
        setProfileMsg({ 
          type: 'error', 
          text: res.error || 'Failed to sync updates to Cloud.' 
        });
      }
    } catch (err: any) {
      setProfileMsg({ 
        type: 'error', 
        text: err.message || 'Error occurred while saving profile.' 
      });
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ 
        type: 'error', 
        text: 'New password must be at least 6 characters long.' 
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ 
        type: 'error', 
        text: 'New password and confirmation password do not match.' 
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await updateCurrentEmployeeProfile({
        password: newPassword
      });

      if (res.success) {
        setPasswordMsg({ 
          type: 'success', 
          text: language === 'bn' 
            ? 'নতুন পাসওয়ার্ড সফলভাবে সংরক্ষিত হয়েছে। পরবর্তীতে এটি দিয়ে লগইন করুন।' 
            : 'Password successfully changed and saved to Cloud. Use this for next login.' 
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordMsg(null), 4500);
      } else {
        setPasswordMsg({ 
          type: 'error', 
          text: res.error || 'Failed to update password on cloud.' 
        });
      }
    } catch (err: any) {
      setPasswordMsg({ 
        type: 'error', 
        text: err.message || 'An error occurred while updating password.' 
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner with Cloud Persistence Indicator */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900 tracking-tight">
                  {t('navMyProfile')}
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                  <span>Cloud Synced (Firebase Firestore)</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Personal identity, contact details, assigned supervisor, and cloud account credentials.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="px-3 py-1 bg-slate-100 rounded-lg border border-slate-200 font-mono">
            EID: {currentUser.eid}
          </span>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200">
            {currentUser.role}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Profile Identity Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-700 to-teal-500 text-white font-black text-2xl flex items-center justify-center shadow-md mb-3">
            {currentUser.nameEn ? currentUser.nameEn.charAt(0) : 'U'}
          </div>
          <h2 className="text-base font-bold text-slate-900">{currentUser.nameEn}</h2>
          {currentUser.nameBn && <p className="text-xs text-slate-500 font-medium">{currentUser.nameBn}</p>}
          
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
              {currentUser.designation}
            </span>
          </div>

          <div className="w-full mt-6 pt-6 border-t border-slate-100 space-y-3 text-xs text-left">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Employee ID (EID)</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{currentUser.eid}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Department</span>
              <span className="font-semibold text-slate-800">{currentUser.department}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Project / Workplace</span>
              <span className="font-semibold text-slate-800">{currentUser.project} • {currentUser.workplace}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Reporting Supervisor</span>
              <span className="font-bold text-emerald-800">{currentUser.reportingSupervisor || 'Murshida Akhter Kanta'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Joining Date</span>
              <span className="font-mono text-slate-800 font-medium">{currentUser.joiningDate}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">Employment Nature</span>
              <span className="font-medium text-slate-700">{currentUser.natureOfEmployment || 'Permanent'}</span>
            </div>
          </div>
        </div>

        {/* Right Columns: Edit Profile & Password Form */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Editable Personal & Contact Details Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-xs">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Edit Personal & Contact Information (ব্যক্তিগত ও যোগাযোগের তথ্য)
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">
                Changes persist to Cloud Firestore
              </span>
            </div>

            {profileMsg && (
              <div className={`p-3 rounded-xl flex items-center gap-2 mb-4 font-medium ${
                profileMsg.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' 
                  : 'bg-rose-50 text-rose-800 border border-rose-300'
              }`}>
                {profileMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{profileMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Employee Name in English (ইংরেজি নাম) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="Full Name in English"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Employee Name in Bangla (বাংলায় নাম)
                  </label>
                  <input
                    type="text"
                    value={nameBn}
                    onChange={(e) => setNameBn(e.target.value)}
                    placeholder="নাম বাংলায় লিখুন"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Mobile Number (মোবাইল নম্বর) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="+880 1..."
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Emergency Contact (জরুরি যোগাযোগ নম্বর)
                  </label>
                  <input
                    type="text"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="Emergency Contact"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Official Email (অফিসিয়াল ইমেইল)
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="employee@leedo.org.bd"
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Personal Email (ব্যক্তিগত ইমেইল)
                  </label>
                  <input
                    type="email"
                    value={personalEmail}
                    onChange={(e) => setPersonalEmail(e.target.value)}
                    placeholder="personal@gmail.com"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Present Address (বর্তমান ঠিকানা)
                  </label>
                  <div className="relative">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="House, Road, Area, Thana, District"
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Highest Education (শিক্ষাগত যোগ্যতা)
                  </label>
                  <div className="relative">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={highestEducation}
                      onChange={(e) => setHighestEducation(e.target.value)}
                      placeholder="e.g. Masters, B.Sc, BA, HSC"
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Assigned Shift
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${currentUser.standardInTime || '09:00 AM'} - ${currentUser.standardOutTime || '05:00 PM'} (${currentUser.dailyHours || 8}h)`}
                    className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingProfile}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSubmittingProfile ? 'Saving to Cloud...' : 'Save Profile Changes (সংরক্ষণ করুন)'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Change Security Password */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-xs">
            <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
              <KeyRound className="w-4 h-4 text-slate-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Account Security & Password (পাসওয়ার্ড পরিবর্তন)
              </h3>
            </div>

            {passwordMsg && (
              <div className={`p-3 rounded-xl flex items-center gap-2 mb-4 font-medium ${
                passwordMsg.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' 
                  : 'bg-rose-50 text-rose-800 border border-rose-300'
              }`}>
                {passwordMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    New Password (নতুন পাসওয়ার্ড) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Confirm New Password (পুনরায় লিখুন) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{isChangingPassword ? 'Updating...' : 'Update Password (পাসওয়ার্ড আপডেট)'}</span>
                </button>
              </div>
            </form>
          </div>

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

            {/* Annual Leave Entitlement Quota */}
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

        </div>

      </div>

    </div>
  );
};
