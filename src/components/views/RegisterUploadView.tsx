import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Employee, UploadedRegister, AttendanceRecord, AttendanceStatus } from '../../types';
import { doc, setDoc, addDoc, collection, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import * as XLSX from 'xlsx';
import { 
  UploadCloud, 
  FileText, 
  FileSpreadsheet, 
  Image as ImageIcon, 
  Check, 
  AlertCircle, 
  Download, 
  Eye, 
  Archive,
  Calendar,
  Search,
  Filter,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Bell,
  Send,
  UserCheck
} from 'lucide-react';
import { INITIAL_DEPARTMENTS, INITIAL_PROJECTS } from '../../lib/initialData';

interface RegisterUploadViewProps {
  uploadedRegisters: UploadedRegister[];
  employees: Employee[];
  allAttendance: AttendanceRecord[];
  onRefreshUploads: () => void;
  onRefreshAttendance: () => void;
}

export const RegisterUploadView: React.FC<RegisterUploadViewProps> = ({
  uploadedRegisters,
  employees,
  allAttendance,
  onRefreshUploads,
  onRefreshAttendance
}) => {
  const { currentUser, role } = useAuth();
  const { t, language } = useLanguage();

  const isHrOrSuper = role === 'HR ADMIN' || role === 'SUPER ADMIN';

  // Active view tab for HR: 'tracker' (who hasn't uploaded), 'upload', 'archive'
  const [activeTab, setActiveTab] = useState<'tracker' | 'upload' | 'archive'>(isHrOrSuper ? 'tracker' : 'upload');

  // Month and Year selection
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedDept, setSelectedDept] = useState<string>(currentUser?.department || INITIAL_DEPARTMENTS[0]);
  const [selectedProject, setSelectedProject] = useState<string>(currentUser?.project || INITIAL_PROJECTS[0]);
  const [uploadRemarks, setUploadRemarks] = useState('');

  // Status tracker filters (HR view)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MISSING' | 'UPLOADED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [trackerDeptFilter, setTrackerDeptFilter] = useState('ALL');
  const [trackerProjectFilter, setTrackerProjectFilter] = useState('ALL');
  const [reminderSentMap, setReminderSentMap] = useState<Record<string, boolean>>({});

  // File state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Array<Record<string, any>>>([]);
  const [validationReport, setValidationReport] = useState<{
    validEids: number;
    invalidEids: string[];
    totalRows: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewingRegister, setPreviewingRegister] = useState<UploadedRegister | null>(null);

  const monthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Active employees list
  const activeEmployees = useMemo(() => {
    return employees.filter(e => e.status === 'Active');
  }, [employees]);

  // Map of uploads for the selected month by Employee EID
  const uploadsByEmployeeForMonth = useMemo(() => {
    const map = new Map<string, UploadedRegister>();
    uploadedRegisters.forEach(r => {
      if (r.month === monthStr) {
        if (r.uploadedByEid) {
          map.set(r.uploadedByEid.toUpperCase(), r);
        }
        // Extract EID from uploadedBy string e.g. "Md. Omar (EMP-1002)"
        const match = r.uploadedBy.match(/\((EMP-\d+)\)/i);
        if (match) {
          map.set(match[1].toUpperCase(), r);
        }
      }
    });
    return map;
  }, [uploadedRegisters, monthStr]);

  // Check if current logged-in employee uploaded for selected month
  const currentEmployeeUpload = useMemo(() => {
    if (!currentUser) return null;
    return uploadsByEmployeeForMonth.get(currentUser.eid.toUpperCase()) || null;
  }, [uploadsByEmployeeForMonth, currentUser]);

  // Submission statistics
  const submissionStats = useMemo(() => {
    let uploadedCount = 0;
    activeEmployees.forEach(emp => {
      if (uploadsByEmployeeForMonth.has(emp.eid.toUpperCase())) {
        uploadedCount++;
      }
    });
    const totalCount = activeEmployees.length;
    const pendingCount = Math.max(0, totalCount - uploadedCount);
    const percentage = totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0;
    return {
      total: totalCount,
      uploaded: uploadedCount,
      pending: pendingCount,
      percentage
    };
  }, [activeEmployees, uploadsByEmployeeForMonth]);

  // Filtered employees for HR submission tracker
  const filteredEmployeesForTracker = useMemo(() => {
    return activeEmployees.filter(emp => {
      const isUploaded = uploadsByEmployeeForMonth.has(emp.eid.toUpperCase());

      if (statusFilter === 'MISSING' && isUploaded) return false;
      if (statusFilter === 'UPLOADED' && !isUploaded) return false;

      if (trackerDeptFilter !== 'ALL' && emp.department !== trackerDeptFilter) return false;
      if (trackerProjectFilter !== 'ALL' && emp.project !== trackerProjectFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesEid = emp.eid.toLowerCase().includes(q);
        const matchesName = emp.nameEn.toLowerCase().includes(q) || (emp.nameBn && emp.nameBn.includes(q));
        if (!matchesEid && !matchesName) return false;
      }

      return true;
    });
  }, [activeEmployees, uploadsByEmployeeForMonth, statusFilter, trackerDeptFilter, trackerProjectFilter, searchQuery]);

  // Handle file input
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    const fileName = file.name.toLowerCase();

    // If it's Excel or CSV, parse rows
    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const binaryStr = event.target?.result;
          const workbook = XLSX.read(binaryStr, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheetName];
          const rows: any[] = XLSX.utils.sheet_to_json(sheet);

          setParsedRows(rows);

          // Validate EIDs
          const activeEids = new Set(employees.map(emp => emp.eid.toUpperCase()));
          const invalid: string[] = [];
          let validCount = 0;

          rows.forEach((row) => {
            const eid = (row['EID'] || row['eid'] || row['Employee ID'] || '').toString().trim().toUpperCase();
            if (eid && activeEids.has(eid)) {
              validCount++;
            } else if (eid) {
              invalid.push(eid);
            }
          });

          setValidationReport({
            validEids: validCount,
            invalidEids: invalid,
            totalRows: rows.length
          });
        } catch (err: any) {
          alert('Error parsing spreadsheet: ' + err.message);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      // Image or PDF
      setParsedRows([]);
      setValidationReport(null);
    }
  };

  // Confirm Import into Firestore
  const handleConfirmImport = async () => {
    if (!uploadedFile || !currentUser) return;
    setIsProcessing(true);

    const uploadId = `upload_${Date.now()}`;
    const nowStr = new Date().toISOString();

    try {
      let importedCount = 0;

      // If we parsed tabular data with EID and Dates
      if (parsedRows.length > 0) {
        const batch = writeBatch(db);
        const empMap = new Map(employees.map(e => [e.eid.toUpperCase(), e]));

        parsedRows.forEach((row) => {
          const rawEid = (row['EID'] || row['eid'] || row['Employee ID'] || '').toString().trim().toUpperCase();
          const targetEmp = empMap.get(rawEid);
          if (!targetEmp) return;

          // Check if row has Date and Status
          const date = row['Date'] || row['date'];
          const status = (row['Status'] || row['status'] || 'P').toString().toUpperCase() as AttendanceStatus;

          if (date && status) {
            const docId = `${targetEmp.eid}_${date}`;
            const ref = doc(db, 'attendance', docId);

            const record: AttendanceRecord = {
              id: docId,
              eid: targetEmp.eid,
              employeeName: targetEmp.nameEn,
              department: targetEmp.department,
              project: targetEmp.project,
              date: String(date),
              month: String(date).substring(0, 7),
              year: String(date).substring(0, 4),
              status,
              remarks: row['Remarks'] || row['remarks'] || 'Imported via register upload',
              verificationStatus: 'Verified',
              verifiedBy: `${currentUser.nameEn} (Register Upload)`,
              verifiedAt: nowStr,
              source: 'UploadedRegister',
              createdAt: nowStr,
              updatedAt: nowStr
            };

            batch.set(ref, record, { merge: true });
            importedCount++;
          }
        });

        if (importedCount > 0) {
          await batch.commit();
        }
      }

      // Save upload record to uploadedRegisters collection
      const registerRecord: UploadedRegister = {
        id: uploadId,
        fileName: uploadedFile.name,
        fileType: uploadedFile.name.split('.').pop() || 'unknown',
        month: monthStr,
        department: isHrOrSuper ? selectedDept : currentUser.department,
        project: isHrOrSuper ? selectedProject : currentUser.project,
        remarks: uploadRemarks.trim() || `${currentUser.nameEn}'s monthly attendance register for ${monthNames[selectedMonth - 1]} ${selectedYear}`,
        totalRows: parsedRows.length,
        importedCount,
        uploadedBy: `${currentUser.nameEn} (${currentUser.eid})`,
        uploadedByEid: currentUser.eid,
        uploadedAt: nowStr,
        fileDataPreview: parsedRows.slice(0, 5)
      };

      await setDoc(doc(db, 'uploadedRegisters', uploadId), registerRecord);

      // Audit Log
      await addDoc(collection(db, 'auditLogs'), {
        action: 'REGISTER_UPLOADED',
        recordType: 'Register',
        recordId: uploadId,
        eid: currentUser.eid,
        modifiedBy: `${currentUser.nameEn} (${currentUser.eid})`,
        modifiedAt: nowStr,
        reason: `Uploaded ${uploadedFile.name} for ${monthStr}, imported ${importedCount} records.`
      });

      setIsProcessing(false);
      setUploadedFile(null);
      setParsedRows([]);
      setValidationReport(null);
      setUploadRemarks('');
      alert(`Register document uploaded successfully for ${monthNames[selectedMonth - 1]} ${selectedYear}!`);
      onRefreshUploads();
      if (importedCount > 0) onRefreshAttendance();
    } catch (err: any) {
      setIsProcessing(false);
      alert('Upload error: ' + err.message);
    }
  };

  // Export missing list to Excel (HR action)
  const handleExportStatusReport = () => {
    const data = filteredEmployeesForTracker.map(emp => {
      const reg = uploadsByEmployeeForMonth.get(emp.eid.toUpperCase());
      return {
        'Employee ID': emp.eid,
        'Name': emp.nameEn,
        'Designation': emp.designation,
        'Department': emp.department,
        'Project / Branch': emp.project,
        'Working Days/Week': emp.workingDaysPerWeek || 6,
        'Period': `${monthNames[selectedMonth - 1]} ${selectedYear}`,
        'Submission Status': reg ? 'UPLOADED' : 'MISSING / NOT UPLOADED',
        'Uploaded File': reg?.fileName || 'N/A',
        'Uploaded Date': reg?.uploadedAt ? new Date(reg.uploadedAt).toLocaleDateString('en-GB') : 'N/A'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Register_Status');
    XLSX.writeFile(wb, `LEEDO_Register_Submission_Status_${monthStr}.xlsx`);
  };

  // Send quick reminder alert (HR action)
  const handleSendReminder = (emp: Employee) => {
    setReminderSentMap(prev => ({ ...prev, [emp.eid]: true }));
    alert(`Formal submission reminder recorded for ${emp.nameEn} (${emp.eid}) for ${monthNames[selectedMonth - 1]} ${selectedYear}.`);
  };

  // Historical records for current view (filtered by user if employee)
  const displayedArchives = useMemo(() => {
    if (isHrOrSuper) {
      return uploadedRegisters;
    }
    return uploadedRegisters.filter(
      r => r.uploadedByEid === currentUser?.eid || r.uploadedBy.includes(currentUser?.eid || '')
    );
  }, [uploadedRegisters, isHrOrSuper, currentUser]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-700">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {language === 'bn' ? 'রেজিস্টার আপলোড ও আর্কাইভ' : 'Register Upload & Archive'}
              </h1>
              <p className="text-xs text-slate-500">
                {isHrOrSuper
                  ? 'Track staff register submissions, monitor missing registers, and archive physical/digital attendance sheets.'
                  : 'Upload your signed monthly attendance register scan (PDF, Image, or Spreadsheet) for monthly HR reconciliation.'}
              </p>
            </div>
          </div>
        </div>

        {/* View Mode Tabs (HR has Tracker + Upload + Archive; Employee has Upload + My Uploads) */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          {isHrOrSuper && (
            <button
              onClick={() => setActiveTab('tracker')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === 'tracker'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              <span>কারা আপলোড করেনি (Tracker)</span>
              {submissionStats.pending > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                  {submissionStats.pending}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'upload'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-teal-600" />
            <span>{isHrOrSuper ? 'Upload Register' : 'Upload My Register'}</span>
          </button>

          <button
            onClick={() => setActiveTab('archive')}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              activeTab === 'archive'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Archive className="w-3.5 h-3.5 text-blue-600" />
            <span>{isHrOrSuper ? `Digital Archive (${uploadedRegisters.length})` : 'My Archive'}</span>
          </button>
        </div>
      </div>

      {/* Month & Year Selection Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-600" />
          <span className="font-bold text-slate-800">Target Reporting Month:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-semibold text-slate-800"
          >
            {monthNames.map((m, idx) => (
              <option key={m} value={idx + 1}>{m}</option>
            ))}
          </select>

          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-semibold text-slate-800"
          >
            {[2024, 2025, 2026, 2027].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* EMPLOYEE VIEW: Personal Monthly Submission Status Banner */}
      {!isHrOrSuper && (
        <div>
          {currentEmployeeUpload ? (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-start sm:items-center justify-between gap-3 text-xs text-emerald-900">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-sm block text-emerald-950">
                    রেজিস্টার আপলোড সম্পন্ন (Uploaded)!
                  </span>
                  <p className="text-[11px] text-emerald-800 mt-0.5">
                    Your attendance register for <strong>{monthNames[selectedMonth - 1]} {selectedYear}</strong> has been uploaded on{' '}
                    <span className="font-mono">{new Date(currentEmployeeUpload.uploadedAt).toLocaleDateString('en-GB')}</span>.
                    (File: <span className="font-medium">{currentEmployeeUpload.fileName}</span>)
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-600 text-white font-bold rounded-lg shrink-0 text-[11px]">
                Verified / Stored
              </span>
            </div>
          ) : (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex items-start sm:items-center justify-between gap-3 text-xs text-rose-900">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-700 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-black text-sm block text-rose-950">
                    রেজিস্টার আপলোড বাকি (Not Uploaded Yet)
                  </span>
                  <p className="text-[11px] text-rose-800 mt-0.5">
                    You have not uploaded your signed attendance register for <strong>{monthNames[selectedMonth - 1]} {selectedYear}</strong>. Please upload below.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab('upload')}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shrink-0 text-[11px] transition-colors"
              >
                Upload Now
              </button>
            </div>
          )}
        </div>
      )}

      {/* HR VIEW: Employee Register Submission Status Tracker ("hr dekte parbe kar kar ta upload hoy nai") */}
      {isHrOrSuper && activeTab === 'tracker' && (
        <div className="space-y-4">
          
          {/* Top 4 KPI Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 block uppercase font-medium">Total Active Staff</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{submissionStats.total}</span>
              <span className="text-[10px] text-slate-400">All registered employees</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-emerald-700 block uppercase font-medium">Registers Uploaded</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">{submissionStats.uploaded}</span>
              <span className="text-[10px] text-emerald-600">{submissionStats.percentage}% submitted</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-rose-200 bg-rose-50/40 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-rose-700 block uppercase font-black">
                  আপলোড বাকি (Not Uploaded)
                </span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <span className="text-2xl font-black text-rose-700 mt-1 block">{submissionStats.pending}</span>
              <span className="text-[10px] text-rose-600">Pending register submission</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] text-slate-500 block uppercase font-medium">Submission Rate</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black text-teal-700">{submissionStats.percentage}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div 
                  className="bg-emerald-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${submissionStats.percentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Filter Bar & Search */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
            
            {/* Quick Filter Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                  statusFilter === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Staff ({submissionStats.total})
              </button>

              <button
                onClick={() => setStatusFilter('MISSING')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'MISSING'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                }`}
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>কার কারটা আপলোড হয় নাই ({submissionStats.pending})</span>
              </button>

              <button
                onClick={() => setStatusFilter('UPLOADED')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 ${
                  statusFilter === 'UPLOADED'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Uploaded ({submissionStats.uploaded})</span>
              </button>
            </div>

            {/* Right side controls: Search & Export */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search staff name / EID..."
                  className="pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <select
                value={trackerDeptFilter}
                onChange={(e) => setTrackerDeptFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium"
              >
                <option value="ALL">All Departments</option>
                {INITIAL_DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <button
                onClick={handleExportStatusReport}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-300 flex items-center gap-1.5 transition-colors"
                title="Download spreadsheet report of register submissions"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Export Report (XLSX)</span>
              </button>
            </div>

          </div>

          {/* Submission Status Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Staff Monthly Register Status — {monthNames[selectedMonth - 1]} {selectedYear}
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                Showing {filteredEmployeesForTracker.length} of {activeEmployees.length} employees
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Designation & Department</th>
                    <th className="px-4 py-3">Project / Location</th>
                    <th className="px-4 py-3 text-center">Schedule</th>
                    <th className="px-4 py-3 text-center">Register Status</th>
                    <th className="px-4 py-3">Uploaded Document</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployeesForTracker.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                        No employees found matching the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployeesForTracker.map((emp) => {
                      const upload = uploadsByEmployeeForMonth.get(emp.eid.toUpperCase());
                      const isUploaded = !!upload;
                      const reminderSent = reminderSentMap[emp.eid];

                      return (
                        <tr 
                          key={emp.eid} 
                          className={`hover:bg-slate-50 transition-colors ${
                            !isUploaded ? 'bg-rose-50/20' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{emp.nameEn}</div>
                            <div className="text-[11px] font-mono text-slate-500 font-semibold">{emp.eid}</div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">{emp.designation}</div>
                            <div className="text-[11px] text-slate-500">{emp.department}</div>
                          </td>

                          <td className="px-4 py-3 text-slate-600">
                            {emp.project}
                            {emp.workplace && <div className="text-[10px] text-slate-400">{emp.workplace}</div>}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {emp.workingDaysPerWeek || 6}d/wk
                            </span>
                          </td>

                          <td className="px-4 py-3 text-center">
                            {isUploaded ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Uploaded (আপলোড সম্পন্ন)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                                <XCircle className="w-3 h-3" />
                                <span>Not Uploaded (আপলোড বাকি)</span>
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {upload ? (
                              <div>
                                <div className="font-semibold text-slate-900 truncate max-w-xs flex items-center gap-1.5">
                                  {upload.fileType.includes('xls') || upload.fileType === 'csv' ? (
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  ) : upload.fileType === 'pdf' ? (
                                    <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                  ) : (
                                    <ImageIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  )}
                                  <span>{upload.fileName}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  {new Date(upload.uploadedAt).toLocaleDateString('en-GB')} ({upload.importedCount || 0} rows)
                                </div>
                              </div>
                            ) : (
                              <span className="text-[11px] text-rose-600 italic">No document submitted yet</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {isUploaded ? (
                              <button
                                onClick={() => alert(`Document Details:\nFile: ${upload.fileName}\nUploaded: ${upload.uploadedAt}\nRemarks: ${upload.remarks || 'None'}`)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded text-xs transition-colors inline-flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5 text-slate-600" />
                                <span>View</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSendReminder(emp)}
                                disabled={reminderSent}
                                className={`px-2.5 py-1 rounded text-xs font-bold transition-colors inline-flex items-center gap-1 ${
                                  reminderSent
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                }`}
                              >
                                <Bell className="w-3 h-3" />
                                <span>{reminderSent ? 'Reminded' : 'Send Reminder'}</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* UPLOAD FORM (Available to Everyone: Employees upload their own, HR can upload staff/department registers) */}
      {activeTab === 'upload' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                {isHrOrSuper ? 'Upload Attendance Document or Digital Register' : 'Upload Your Monthly Register (আপনার রেজিস্টার আপলোড করুন)'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Target Period: <strong>{monthNames[selectedMonth - 1]} {selectedYear}</strong> for {currentUser?.nameEn} ({currentUser?.eid})
              </p>
            </div>
            <span className="px-2.5 py-1 bg-teal-50 text-teal-800 font-bold rounded-lg text-xs border border-teal-200">
              {currentUser?.designation} • {currentUser?.department}
            </span>
          </div>

          {/* Department / Project selector (HR can choose, for regular staff it is fixed to their department) */}
          {isHrOrSuper && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Department</label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                >
                  {INITIAL_DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Target Project / Branch</label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5"
                >
                  {INITIAL_PROJECTS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Drag and Drop Box */}
          <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100/50 transition-colors">
            <input
              type="file"
              id="register-file"
              accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="register-file" className="cursor-pointer flex flex-col items-center">
              <UploadCloud className="w-12 h-12 text-emerald-600 mb-2" />
              <span className="text-sm font-bold text-slate-800">
                {uploadedFile ? uploadedFile.name : 'Click to select file or drag & drop'}
              </span>
              <span className="text-xs text-slate-500 mt-1">
                Supports Excel (.xlsx, .xls), CSV, Scanned PDF, JPG, and PNG register copies (Max 15MB)
              </span>
            </label>
          </div>

          {/* Excel / CSV Parsed Validation Preview */}
          {validationReport && (
            <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-teal-900">
                <Check className="w-4 h-4 text-teal-600" />
                <span>Spreadsheet Parsed: {validationReport.totalRows} rows identified</span>
              </div>
              <p className="text-teal-800">
                Validated <strong>{validationReport.validEids}</strong> active employee records against database.
                {validationReport.invalidEids.length > 0 && (
                  <span className="text-rose-700 ml-2">
                    (Unrecognized EIDs: {validationReport.invalidEids.slice(0, 5).join(', ')})
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Upload Remarks */}
          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">Archive Remarks / Notes</label>
            <input
              type="text"
              value={uploadRemarks}
              onChange={(e) => setUploadRemarks(e.target.value)}
              placeholder="e.g. Signed physical register copy for October 2026 verified by supervisor"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
            />
          </div>

          {/* Action Button */}
          {uploadedFile && (
            <div className="flex justify-end pt-2">
              <button
                onClick={handleConfirmImport}
                disabled={isProcessing}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isProcessing ? 'Processing & Archiving...' : 'Confirm Upload & Archive'}</span>
              </button>
            </div>
          )}

        </div>
      )}

      {/* ARCHIVE VIEW: Historical Uploads */}
      {activeTab === 'archive' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Archive className="w-4 h-4 text-slate-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                {isHrOrSuper ? 'Historical Attendance Register Digital Archive' : 'My Uploaded Documents Archive'}
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {displayedArchives.length} archived files
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">File Name</th>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3">Department / Project</th>
                  <th className="px-4 py-3 text-center">Imported Records</th>
                  <th className="px-4 py-3">Uploaded By</th>
                  <th className="px-4 py-3">Upload Date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedArchives.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                      No register documents uploaded yet.
                    </td>
                  </tr>
                ) : (
                  displayedArchives.map((reg) => (
                    <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                          {reg.fileType.includes('xls') || reg.fileType === 'csv' ? (
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                          ) : reg.fileType === 'pdf' ? (
                            <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" />
                          )}
                          <span className="truncate max-w-xs">{reg.fileName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-slate-700">
                        {reg.month}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {reg.department} • {reg.project}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-700">
                        {reg.importedCount || 0}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {reg.uploadedBy}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {new Date(reg.uploadedAt).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => alert(`Archive Metadata:\nFile: ${reg.fileName}\nMonth: ${reg.month}\nUploaded by: ${reg.uploadedBy}\nRemarks: ${reg.remarks || 'None'}`)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-emerald-700 transition-colors"
                          title="View metadata"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
