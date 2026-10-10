import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useOrgSettings, compressImageFile } from '../../context/OrgSettingsContext';
import { Holiday } from '../../types';
import { doc, setDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { 
  Settings, 
  Calendar, 
  PlusCircle, 
  Trash2, 
  Clock, 
  Building, 
  Briefcase, 
  Check, 
  AlertCircle,
  ShieldCheck,
  Languages,
  Upload,
  Camera,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import { INITIAL_DEPARTMENTS, INITIAL_PROJECTS, INITIAL_HOLIDAYS_2026 } from '../../lib/initialData';

interface SystemSettingsViewProps {
  holidays: Holiday[];
  onRefreshHolidays: () => void;
}

export const SystemSettingsView: React.FC<SystemSettingsViewProps> = ({
  holidays,
  onRefreshHolidays
}) => {
  const { currentUser, role } = useAuth();
  const { t, language, toggleLanguage } = useLanguage();
  const { logoUrl, updateLogo, resetLogo, isLoadingLogo } = useOrgSettings();

  const isSuperAdmin = role === 'SUPER ADMIN';
  const isHrOrSuper = role === 'HR ADMIN' || role === 'SUPER ADMIN';

  // Logo editing state
  const [logoInputUrl, setLogoInputUrl] = useState('');
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [logoMsg, setLogoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSavingLogo, setIsSavingLogo] = useState(false);

  // Add holiday state
  const [newHolidayNameEn, setNewHolidayNameEn] = useState('');
  const [newHolidayNameBn, setNewHolidayNameBn] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayType, setNewHolidayType] = useState<'Public Holiday' | 'LEEDO Special Holiday'>('Public Holiday');
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);

  // Handle Logo Upload File
  const handleLogoFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoMsg({ type: 'error', text: 'Please upload a valid image file (PNG, JPG, SVG, WebP).' });
      return;
    }

    try {
      setLogoMsg(null);
      const compressedDataUrl = await compressImageFile(file, 360, 360);
      setPreviewLogo(compressedDataUrl);
      setLogoInputUrl('');
    } catch (err: any) {
      setLogoMsg({ type: 'error', text: 'Failed to process image: ' + err.message });
    }
  };

  // Save Logo to Firestore Cloud
  const handleSaveLogo = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalLogo = previewLogo || logoInputUrl.trim();
    if (!finalLogo) {
      setLogoMsg({ type: 'error', text: 'Please upload an image file or provide an image URL.' });
      return;
    }

    setIsSavingLogo(true);
    setLogoMsg(null);
    try {
      const res = await updateLogo(finalLogo);
      if (res.success) {
        setLogoMsg({ 
          type: 'success', 
          text: language === 'bn' 
            ? 'সংস্থার লোগো সফলভাবে পরিবর্তিত ও ক্লাউডে সংরক্ষিত হয়েছে।' 
            : 'Organization logo updated and synced to Cloud Firestore successfully.' 
        });
        setTimeout(() => setLogoMsg(null), 4000);
      } else {
        setLogoMsg({ type: 'error', text: res.error || 'Failed to save logo.' });
      }
    } catch (err: any) {
      setLogoMsg({ type: 'error', text: err.message || 'Error saving logo.' });
    } finally {
      setIsSavingLogo(false);
    }
  };

  // Reset to default LEEDO logo
  const handleResetLogo = async () => {
    if (!confirm(language === 'bn' ? 'আপনি কি মূল LEEDO ডিফল্ট লোগো ফিরিয়ে আনতে চান?' : 'Reset to the official default LEEDO logo?')) return;
    setIsSavingLogo(true);
    await resetLogo();
    setPreviewLogo('/leedo-logo.svg');
    setLogoInputUrl('');
    setLogoMsg({ 
      type: 'success', 
      text: language === 'bn' ? 'ডিফল্ট LEEDO লোগো সফলভাবে পুনঃস্থাপন করা হয়েছে।' : 'Reset to official LEEDO logo successfully.' 
    });
    setIsSavingLogo(false);
    setTimeout(() => setLogoMsg(null), 3000);
  };

  // Add Holiday
  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayNameEn) return;

    setIsAddingHoliday(true);
    const holidayYear = newHolidayDate.substring(0, 4);
    const payload: Holiday = {
      id: newHolidayDate,
      date: newHolidayDate,
      nameEn: newHolidayNameEn.trim(),
      nameBn: newHolidayNameBn.trim() || newHolidayNameEn.trim(),
      type: newHolidayType,
      year: holidayYear
    };

    try {
      await setDoc(doc(db, 'holidays', newHolidayDate), payload);

      await addDoc(collection(db, 'auditLogs'), {
        action: 'HOLIDAY_ADDED',
        recordType: 'Settings',
        recordId: newHolidayDate,
        modifiedBy: `${currentUser?.nameEn} (${currentUser?.eid})`,
        modifiedAt: new Date().toISOString(),
        reason: `Added holiday ${newHolidayNameEn} on ${newHolidayDate}`
      });

      setNewHolidayNameEn('');
      setNewHolidayNameBn('');
      setNewHolidayDate('');
      setIsAddingHoliday(false);
      onRefreshHolidays();
    } catch (err: any) {
      setIsAddingHoliday(false);
      alert('Error adding holiday: ' + err.message);
    }
  };

  // Delete Holiday
  const handleDeleteHoliday = async (holidayId: string) => {
    if (!window.confirm('Delete this holiday from organizational calendar?')) return;
    try {
      await deleteDoc(doc(db, 'holidays', holidayId));
      onRefreshHolidays();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-slate-100 text-slate-800">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {t('navSettings')}
              </h1>
              <p className="text-xs text-slate-500">
                Organization branding, logo customization, calendar rules, public holidays, and policy parameters.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Organization Logo & Branding Management Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Organization Logo & Branding (সংস্থার লোগো পরিবর্তন)
              </h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              HR Administration
            </span>
          </div>

          {/* Current Logo Preview */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
            <div className="w-20 h-20 p-2 bg-white rounded-xl border border-slate-300 shadow-xs flex items-center justify-center shrink-0">
              <img 
                src={previewLogo || logoUrl || '/leedo-logo.svg'} 
                alt="Active Logo" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/leedo-logo.svg';
                }}
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div>
              <span className="font-bold text-slate-800 block text-xs">Active Logo Preview</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                This logo automatically displays on the Header Navbar, Login Screen, and Official A4 Monthly Timesheets.
              </p>
            </div>
          </div>

          {logoMsg && (
            <div className={`p-3 rounded-xl flex items-center gap-2 text-xs font-medium ${
              logoMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-rose-50 text-rose-800 border border-rose-300'
            }`}>
              {logoMsg.type === 'success' ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{logoMsg.text}</span>
            </div>
          )}

          {/* Logo Upload Form */}
          <form onSubmit={handleSaveLogo} className="space-y-3 text-xs">
            
            {/* File Upload Option */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Upload Logo Image File (লোগো ফাইল আপলোড)
              </label>
              <label className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl cursor-pointer bg-emerald-50/30 hover:bg-emerald-50/70 transition-colors text-center">
                <Upload className="w-5 h-5 text-emerald-600 mb-1" />
                <span className="text-xs font-bold text-emerald-800">
                  Click to select logo (PNG, JPG, SVG, WebP)
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  Optimized and saved to Cloud Firestore for permanent storage
                </span>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleLogoFileUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            <div className="flex items-center gap-3 my-2">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">OR Image URL</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            {/* Direct URL Input */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Image Web Link / URL (ওয়েব লিংক)
              </label>
              <input
                type="url"
                value={logoInputUrl}
                onChange={(e) => {
                  setLogoInputUrl(e.target.value);
                  if (e.target.value.trim()) {
                    setPreviewLogo(e.target.value.trim());
                  }
                }}
                placeholder="https://example.com/logo.png"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handleResetLogo}
                disabled={isSavingLogo}
                className="px-3 py-2 text-slate-600 hover:text-rose-700 font-semibold text-[11px] transition-colors flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Default</span>
              </button>

              <button
                type="submit"
                disabled={isSavingLogo}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{isSavingLogo ? 'Saving to Cloud...' : 'Save & Apply Logo (সংরক্ষণ করুন)'}</span>
              </button>
            </div>

          </form>
        </div>

        {/* Organization Work-Week Configuration */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Work-Week & Timezone Policy
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-800 block">Weekly Holiday:</span>
                <span className="text-slate-500 text-[11px]">Automatically excluded from scheduled working days</span>
              </div>
              <span className="font-black text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg">
                Friday (শুক্রবার)
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-800 block">Saturday Work Policy:</span>
                <span className="text-slate-500 text-[11px]">Regular working day according to LEEDO Bangladesh HR manual</span>
              </div>
              <span className="font-black text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-lg">
                Regular Working Day
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-800 block">System Timezone:</span>
                <span className="text-slate-500 text-[11px]">Standard Bangladesh Standard Time (BST)</span>
              </div>
              <span className="font-mono font-bold text-slate-800">
                Asia/Dhaka (UTC+06:00)
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
              <div>
                <span className="font-bold text-slate-800 block">Currency & Localization:</span>
                <span className="text-slate-500 text-[11px]">Bangladeshi Taka & DD-MM-YYYY Date Format</span>
              </div>
              <span className="font-bold text-slate-800">
                BDT (৳) • DD-MM-YYYY
              </span>
            </div>
          </div>
        </div>

        {/* Public Holidays Management */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Holidays Calendar ({holidays.length})
              </h3>
            </div>
          </div>

          {/* Add Holiday Form */}
          <form onSubmit={handleAddHoliday} className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200 space-y-3 text-xs">
            <span className="font-bold text-blue-900 block">Add Holiday to Calendar</span>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date</label>
                <input
                  type="date"
                  value={newHolidayDate}
                  onChange={(e) => setNewHolidayDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Type</label>
                <select
                  value={newHolidayType}
                  onChange={(e) => setNewHolidayType(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Public Holiday">Public Holiday</option>
                  <option value="LEEDO Special Holiday">LEEDO Special Holiday</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Holiday Name (English)</label>
              <input
                type="text"
                value={newHolidayNameEn}
                onChange={(e) => setNewHolidayNameEn(e.target.value)}
                placeholder="e.g. Independence Day"
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                required
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isAddingHoliday}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Holiday</span>
              </button>
            </div>
          </form>

          {/* Holiday List */}
          <div className="max-h-56 overflow-y-auto space-y-1.5">
            {holidays.map((h) => (
              <div key={h.id} className="p-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <span className="font-bold text-slate-800">{h.nameEn}</span>
                  <span className="text-[11px] text-slate-500 block">{h.date} • {h.type}</span>
                </div>
                <button
                  onClick={() => handleDeleteHoliday(h.id)}
                  className="p-1 text-slate-400 hover:text-rose-600"
                  title="Delete Holiday"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

        </div>

      </div>

    </div>
  );
};
