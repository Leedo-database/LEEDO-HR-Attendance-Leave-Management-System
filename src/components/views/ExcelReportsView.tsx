import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { AttendanceRecord, Employee, Holiday, LeaveRecord } from '../../types';
import { 
  FileSpreadsheet, 
  Download, 
  Printer, 
  FileText, 
  Calendar, 
  Users, 
  Building, 
  Briefcase,
  AlertCircle,
  Clock
} from 'lucide-react';
import { 
  exportMonthlyRegisterExcel, 
  exportIndividualAttendanceExcel, 
  exportLeaveUtilizationExcel 
} from '../../lib/excelGenerator';
import { INITIAL_DEPARTMENTS, INITIAL_PROJECTS } from '../../lib/initialData';

interface ExcelReportsViewProps {
  employees: Employee[];
  allAttendance: AttendanceRecord[];
  holidays: Holiday[];
  leaveRecords: LeaveRecord[];
  onNavigateToTimesheet?: () => void;
}

export const ExcelReportsView: React.FC<ExcelReportsViewProps> = ({
  employees,
  allAttendance,
  holidays,
  leaveRecords,
  onNavigateToTimesheet
}) => {
  const { currentUser, role } = useAuth();
  const { t } = useLanguage();

  const isHrOrSuper = role === 'HR ADMIN' || role === 'SUPER ADMIN';

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedProject, setSelectedProject] = useState<string>('ALL');
  const [selectedEid, setSelectedEid] = useState<string>(currentUser?.eid || 'EMP-1001');

  // Trigger A: Org-wide Monthly Register
  const handleExportOrgRegister = () => {
    exportMonthlyRegisterExcel(selectedYear, selectedMonth, employees, allAttendance, holidays);
  };

  // Trigger B: Department-wise Register
  const handleExportDeptRegister = () => {
    if (selectedDept === 'ALL') {
      alert('Please select a specific department.');
      return;
    }
    exportMonthlyRegisterExcel(selectedYear, selectedMonth, employees, allAttendance, holidays, selectedDept);
  };

  // Trigger C: Project-wise Register
  const handleExportProjectRegister = () => {
    if (selectedProject === 'ALL') {
      alert('Please select a specific project.');
      return;
    }
    exportMonthlyRegisterExcel(selectedYear, selectedMonth, employees, allAttendance, holidays, undefined, selectedProject);
  };

  // Trigger D: Individual Attendance Report
  const handleExportIndividual = () => {
    const emp = employees.find(e => e.eid === selectedEid) || currentUser;
    if (!emp) return;
    const empRecords = allAttendance.filter(a => a.eid === emp.eid && a.month === `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`);
    exportIndividualAttendanceExcel(emp, selectedYear, selectedMonth, empRecords, holidays);
  };

  // Trigger E: Leave Utilization
  const handleExportLeave = () => {
    exportLeaveUtilizationExcel(employees, leaveRecords, selectedYear);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {t('navReports')}
              </h1>
              <p className="text-xs text-slate-500">
                Official NGO/INGO formatted Excel (XLSX) registers and print-ready A4 reports with authorization signatures.
              </p>
            </div>
          </div>
        </div>

        {/* Global Period Selectors */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-700"
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
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 font-medium text-slate-700"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid of Report Generators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* Report 0: Official NGO Monthly Timesheet (Always available for individual printing) */}
        <div className="bg-gradient-to-br from-red-50 to-rose-50/40 p-5 rounded-xl border-2 border-red-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="w-9 h-9 rounded-lg bg-red-600 text-white flex items-center justify-center mb-3 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-red-600 text-white">
                NGO Standard
              </span>
              <span className="text-[10px] font-bold text-red-700">Audit Compliant</span>
            </div>
            <h3 className="font-bold text-sm text-slate-900">Monthly Time Sheet (মাসিক টাইম শিট)</h3>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Official INGO/NGO monthly staff timesheet with in/out times, hours, supervisor and ED sign-offs. Both individual employees and HR can view and print for any staff member.
            </p>
          </div>
          <div className="pt-4 border-t border-red-200/60 mt-4">
            <button
              onClick={onNavigateToTimesheet}
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Open & Print Timesheet</span>
            </button>
          </div>
        </div>

        {/* Regular Employee Restricted Notice: If user is not HR, hide the 6 organization registers */}
        {!isHrOrSuper && (
          <div className="col-span-1 md:col-span-2 bg-slate-50 p-6 rounded-xl border border-slate-200 text-xs flex flex-col justify-center">
            <div className="flex items-center gap-2 text-slate-700 font-bold mb-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span>HR Administration Restricted Reports</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Organization-wide Master Registers, Department Exports, Project/Donor Reports, and Annual Leave Utilization Spreadsheets are restricted exclusively to HR Admin & Management accounts.
            </p>
            <p className="text-slate-500 mt-2">
              As an employee, please use the <strong>Monthly Time Sheet (মাসিক টাইম শিট)</strong> module above to inspect your attendance, verify extra duties worked, and print your signed monthly A4 timesheet.
            </p>
          </div>
        )}

        {/* The 6 Organization Reports (HR ADMIN & SUPER ADMIN ONLY) */}
        {isHrOrSuper && (
          <>
            {/* Report 1: Org-wide Monthly Register */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center mb-3">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Organization Monthly Register</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Full 01–31 date grid for all active employees with attendance codes (P, CL, SL, AL, WO, PH, OD, etc.) and complete formula totals.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={handleExportOrgRegister}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Master Register (XLSX)</span>
                </button>
              </div>
            </div>

            {/* Report 2: Individual Employee Statement */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center mb-3">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Individual Employee Statement</h3>
                <p className="text-xs text-slate-500 mt-1 mb-2 leading-relaxed">
                  Day-by-day attendance report for a specific employee including duties performed, leave remarks, and verification status.
                </p>

                <select
                  value={selectedEid}
                  onChange={(e) => setSelectedEid(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 mb-2"
                >
                  {employees.map(e => (
                    <option key={e.eid} value={e.eid}>{e.nameEn} ({e.eid})</option>
                  ))}
                </select>
              </div>
              <div className="pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={handleExportIndividual}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Statement (XLSX)</span>
                </button>
              </div>
            </div>

            {/* Report 3: Department-wise Register */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center mb-3">
                  <Building className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Department-wise Register</h3>
                <p className="text-xs text-slate-500 mt-1 mb-2 leading-relaxed">
                  Filtered register for specific department head review and audit compliance.
                </p>

                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 mb-2"
                >
                  <option value="ALL">Select a Department</option>
                  {INITIAL_DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={handleExportDeptRegister}
                  className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Department Register</span>
                </button>
              </div>
            </div>

            {/* Report 4: Project-wise Register */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center mb-3">
                  <Clock className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Project / Program Register</h3>
                <p className="text-xs text-slate-500 mt-1 mb-2 leading-relaxed">
                  Donor reporting register for projects (Peace Home, Mobile School, Transitional Shelter, etc.).
                </p>

                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 mb-2"
                >
                  <option value="ALL">Select a Project</option>
                  {INITIAL_PROJECTS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={handleExportProjectRegister}
                  className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Project Register</span>
                </button>
              </div>
            </div>

            {/* Report 5: Annual Leave Utilization Report */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center mb-3">
                  <Briefcase className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Annual Leave Utilization Report</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Consolidated employee-wise summary of CL, SL, AL, and other leave utilization for Year {selectedYear}.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={handleExportLeave}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Leave Report (XLSX)</span>
                </button>
              </div>
            </div>

            {/* Report 6: Print Preview A4 Layout */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-3">
                  <Printer className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Print-Ready A4 Document</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Instant print layout configured with LEEDO official letterhead, prepared by, verified by HR, and Executive Director signature blocks.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={() => window.print()}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print A4 Layout</span>
                </button>
              </div>
            </div>
          </>
        )}

      </div>

    </div>
  );
};
