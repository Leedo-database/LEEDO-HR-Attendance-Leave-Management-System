import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useOrgSettings, compressImageFile } from '../context/OrgSettingsContext';
import { 
  Building2, 
  Languages, 
  LogOut, 
  UserCircle, 
  Clock, 
  Calendar, 
  ShieldAlert, 
  ShieldCheck, 
  UserCheck,
  Camera,
  Upload,
  RefreshCw,
  X,
  Check,
  Image as ImageIcon
} from 'lucide-react';

interface NavbarProps {
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenProfile }) => {
  const { currentUser, role, logout } = useAuth();
  const { language, toggleLanguage, t } = useLanguage();
  const { logoUrl, updateLogo, resetLogo, isLoadingLogo } = useOrgSettings();

  const isHrOrSuper = role === 'HR ADMIN' || role === 'SUPER ADMIN';

  // Quick Logo Change Modal State
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [logoInputUrl, setLogoInputUrl] = useState('');
  const [previewLogo, setPreviewLogo] = useState<string | null>(null);
  const [logoError, setLogoError] = useState('');
  const [logoSuccessMsg, setLogoSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenLogoModal = () => {
    setPreviewLogo(logoUrl);
    setLogoInputUrl('');
    setLogoError('');
    setLogoSuccessMsg('');
    setIsLogoModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoError('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    try {
      setLogoError('');
      const compressedDataUrl = await compressImageFile(file, 360, 360);
      setPreviewLogo(compressedDataUrl);
      setLogoInputUrl('');
    } catch (err: any) {
      setLogoError('Failed to process image file: ' + err.message);
    }
  };

  const handleSaveLogo = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalLogo = previewLogo || logoInputUrl.trim();
    if (!finalLogo) {
      setLogoError('Please upload an image file or provide an image URL.');
      return;
    }

    setIsSaving(true);
    setLogoError('');
    try {
      const res = await updateLogo(finalLogo);
      if (res.success) {
        setLogoSuccessMsg(language === 'bn' ? 'লোগো সফলভাবে পরিবর্তিত ও ক্লাউডে সংরক্ষিত হয়েছে।' : 'Logo updated successfully across the system.');
        setTimeout(() => {
          setIsLogoModalOpen(false);
          setLogoSuccessMsg('');
        }, 1200);
      } else {
        setLogoError(res.error || 'Failed to save logo.');
      }
    } catch (err: any) {
      setLogoError(err.message || 'Error saving logo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    if (!confirm(language === 'bn' ? 'আপনি কি মূল LEEDO ডিফল্ট লোগো ফিরিয়ে আনতে চান?' : 'Reset to the official default LEEDO logo?')) return;
    setIsSaving(true);
    await resetLogo();
    setPreviewLogo('/leedo-logo.svg');
    setLogoSuccessMsg(language === 'bn' ? 'ডিফল্ট লোগো ফিরিয়ে আনা হয়েছে।' : 'Reset to default LEEDO logo successfully.');
    setIsSaving(false);
    setTimeout(() => {
      setIsLogoModalOpen(false);
      setLogoSuccessMsg('');
    }, 1200);
  };

  const getRoleBadge = () => {
    switch (role) {
      case 'SUPER ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-300">
            <ShieldAlert className="w-3 h-3" />
            {t('roleSuperAdmin')}
          </span>
        );
      case 'HR ADMIN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 border border-teal-300">
            <ShieldCheck className="w-3 h-3" />
            {t('roleHrAdmin')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            <UserCheck className="w-3 h-3" />
            {t('roleEmployee')}
          </span>
        );
    }
  };

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Brand & Organization Title */}
            <div className="flex items-center gap-3">
              <div className="relative group">
                <img 
                  src={logoUrl || '/leedo-logo.svg'} 
                  alt="LEEDO Logo" 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/leedo-logo.svg';
                  }}
                  className="w-10 h-10 object-contain shrink-0 rounded transition-transform group-hover:scale-105" 
                />
                
                {/* HR Logo Edit Trigger Button */}
                {isHrOrSuper && (
                  <button
                    onClick={handleOpenLogoModal}
                    className="absolute -bottom-1 -right-1 bg-slate-900/80 hover:bg-emerald-600 text-white p-1 rounded-full shadow-xs opacity-75 hover:opacity-100 transition-all cursor-pointer"
                    title="Change Organization Logo (লোগো পরিবর্তন করুন)"
                  >
                    <Camera className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-900 tracking-tight">LEEDO</span>
                  <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-red-50 text-red-700 border border-red-200 rounded">
                    NGO • Bangladesh
                  </span>
                  {isHrOrSuper && (
                    <button
                      onClick={handleOpenLogoModal}
                      className="text-[10px] text-emerald-700 hover:text-emerald-800 font-bold underline hidden lg:inline-block ml-1"
                    >
                      (Edit Logo)
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-500 hidden md:block">
                  {language === 'bn' ? 'উপস্থিতি ও ছুটি ব্যবস্থাপনা সিস্টেম' : 'HR Attendance & Leave Management System'}
                </p>
              </div>
            </div>

            {/* Language & Profile */}
            <div className="flex items-center gap-2 sm:gap-4">
              
              {/* Work Week Notice Indicator */}
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-md text-[11px] font-medium">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>Fri = Off | Sat = Working Day</span>
              </div>

              {/* Language Switcher */}
              <button
                onClick={toggleLanguage}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 transition-colors"
                title="Toggle English / বাংলা"
              >
                <Languages className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('bilingualToggle')}</span>
              </button>

              {/* User Profile Pill */}
              {currentUser && (
                <div 
                  onClick={onOpenProfile}
                  className="flex items-center gap-2.5 pl-2 pr-3 py-1 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                    {currentUser.nameEn.charAt(0)}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 leading-tight">
                        {language === 'bn' ? currentUser.nameBn || currentUser.nameEn : currentUser.nameEn}
                      </span>
                      {getRoleBadge()}
                    </div>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      {currentUser.eid} • {currentUser.designation}
                    </span>
                  </div>
                </div>
              )}

              {/* Logout */}
              <button
                onClick={logout}
                className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors flex items-center gap-1"
                title={t('logout')}
              >
                <LogOut className="w-4 h-4 text-slate-500 group-hover:text-rose-600" />
                <span className="hidden sm:inline">{t('logout')}</span>
              </button>

            </div>

          </div>
        </div>
      </header>

      {/* Quick Logo Edit Modal for HR / Super Admin */}
      {isLogoModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 text-xs">
            
            {/* Modal Header */}
            <div className="bg-slate-900 px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm">
                  Change Organization Logo (সংস্থার লোগো পরিবর্তন)
                </h3>
              </div>
              <button 
                onClick={() => setIsLogoModalOpen(false)}
                className="text-slate-400 hover:text-white font-bold p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              
              {/* Live Preview Box */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Logo Live Preview (বর্তমান লোগো প্রিভিউ)
                </span>
                <div className="w-24 h-24 p-2 bg-white rounded-xl border border-slate-300 shadow-xs flex items-center justify-center">
                  <img 
                    src={previewLogo || logoUrl || '/leedo-logo.svg'} 
                    alt="Preview" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/leedo-logo.svg';
                    }}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>

              {/* Status Message */}
              {logoSuccessMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl flex items-center gap-2 font-medium">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{logoSuccessMsg}</span>
                </div>
              )}

              {logoError && (
                <div className="p-3 bg-rose-50 text-rose-800 border border-rose-300 rounded-xl font-medium">
                  {logoError}
                </div>
              )}

              <form onSubmit={handleSaveLogo} className="space-y-4">
                
                {/* Upload File Input */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Upload New Image File (ছবি আপলোড করুন)
                  </label>
                  <label className="flex flex-col items-center justify-center w-full p-4 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl cursor-pointer bg-emerald-50/40 hover:bg-emerald-50 transition-colors text-center">
                    <Upload className="w-6 h-6 text-emerald-600 mb-1" />
                    <span className="text-xs font-bold text-emerald-800">
                      Choose logo file (PNG, JPG, SVG, WebP)
                    </span>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      Auto-resized and optimized for fast cloud loading
                    </span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileUpload} 
                      className="hidden" 
                    />
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-px bg-slate-200 flex-1" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">OR Image URL</span>
                  <div className="h-px bg-slate-200 flex-1" />
                </div>

                {/* Direct Image URL */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Image Web URL (ওয়েব লিংক)
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

                {/* Footer Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    disabled={isSaving}
                    className="px-3 py-2 text-slate-600 hover:text-rose-700 font-semibold text-[11px] transition-colors flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset to Default</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLogoModalOpen(false)}
                      className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isSaving ? 'Saving...' : 'Save & Apply'}</span>
                    </button>
                  </div>
                </div>

              </form>

            </div>

          </div>
        </div>
      )}
    </>
  );
};
