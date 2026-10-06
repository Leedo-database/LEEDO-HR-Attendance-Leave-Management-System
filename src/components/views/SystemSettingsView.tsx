import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
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
  Languages
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

  const isSuperAdmin = role === 'SUPER ADMIN';

  // Add holiday state
  const [newHolidayNameEn, setNewHolidayNameEn] = useState('');
  const [newHolidayNameBn, setNewHolidayNameBn] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayType, setNewHolidayType] = useState<'Public Holiday' | 'LEEDO Special Holiday'>('Public Holiday');
  const [isAddingHoliday, setIsAddingHoliday] = useState(false);

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
                Bangladesh NGO calendar rules, public holidays, work-week configuration, and organizational parameters.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
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
