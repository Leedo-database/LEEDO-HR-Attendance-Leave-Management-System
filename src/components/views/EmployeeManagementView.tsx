import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { Employee, EmploymentStatus, UserRole } from '../../types';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../../lib/firebase';
import * as XLSX from 'xlsx';
import { 
  Users, 
  UserPlus, 
  Search, 
  Filter, 
  Edit3, 
  Eye, 
  UserX, 
  UserCheck, 
  Download, 
  X, 
  Check, 
  AlertCircle,
  Briefcase,
  Phone,
  Mail,
  Building,
  Clock,
  Calendar,
  ChevronDown,
  CheckSquare,
  Square,
  Sparkles
} from 'lucide-react';
import { INITIAL_DEPARTMENTS, INITIAL_PROJECTS, INITIAL_DESIGNATIONS } from '../../lib/initialData';
import { WEEKDAYS_MAP, calculateDailyHoursFromTimes, calculateEmployeeLeaveQuota } from '../../lib/attendanceCalculator';

interface EmployeeManagementViewProps {
  employees: Employee[];
  onRefreshEmployees: () => void;
}

export const EmployeeManagementView: React.FC<EmployeeManagementViewProps> = ({
  employees,
  onRefreshEmployees
}) => {
  const { currentUser, role } = useAuth();
  const { t, language } = useLanguage();

  const isHrOrSuper = role === 'HR ADMIN' || role === 'SUPER ADMIN';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');
  const [filterProject, setFilterProject] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modal states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);

  // Form states for Add/Edit
  const [formEid, setFormEid] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formNameBn, setFormNameBn] = useState('');
  const [formDesignation, setFormDesignation] = useState(INITIAL_DESIGNATIONS[2]);
  const [formDepartment, setFormDepartment] = useState(INITIAL_DEPARTMENTS[0]);
  const [formProject, setFormProject] = useState(INITIAL_PROJECTS[0]);
  const [formWorkplace, setFormWorkplace] = useState('LEEDO Peace Home, Manikganj');
  const [formJoiningDate, setFormJoiningDate] = useState('2024-01-01');
  const [formEmploymentType, setFormEmploymentType] = useState<'Permanent' | 'Contractual' | 'Project-based' | 'Probationary'>('Permanent');
  const [formSupervisor, setFormSupervisor] = useState('Murshida Akhter Kanta (Director - Admin & Finance)');
  const [formSupervisorEid, setFormSupervisorEid] = useState('1002');
  const [formMobile, setFormMobile] = useState('+880 1711 000000');
  const [formEmail, setFormEmail] = useState('');
  const [formStatus, setFormStatus] = useState<EmploymentStatus>('Active');
  const [formRole, setFormRole] = useState<UserRole>('EMPLOYEE');
  const [formResignationDate, setFormResignationDate] = useState('');
  const [formLastWorkingDay, setFormLastWorkingDay] = useState('');
  // Job timings & duty schedule
  const [formStandardInTime, setFormStandardInTime] = useState('09:00 AM');
  const [formStandardOutTime, setFormStandardOutTime] = useState('05:00 PM');
  const [formDailyHours, setFormDailyHours] = useState<number>(8);
  const [formWorkScheduleDays, setFormWorkScheduleDays] = useState<number[]>([6, 0, 1, 2, 3, 4]); // default 6 days (Sat-Thu)
  const [isDutyDaysDropdownOpen, setIsDutyDaysDropdownOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleInTimeChange = (val: string) => {
    setFormStandardInTime(val);
    setFormDailyHours(calculateDailyHoursFromTimes(val, formStandardOutTime));
  };

  const handleOutTimeChange = (val: string) => {
    setFormStandardOutTime(val);
    setFormDailyHours(calculateDailyHoursFromTimes(formStandardInTime, val));
  };

  const toggleDutyDay = (dayId: number) => {
    if (formWorkScheduleDays.includes(dayId)) {
      if (formWorkScheduleDays.length <= 1) {
        alert('An employee must have at least one scheduled duty day per week.');
        return;
      }
      setFormWorkScheduleDays(formWorkScheduleDays.filter(d => d !== dayId));
    } else {
      setFormWorkScheduleDays([...formWorkScheduleDays, dayId].sort((a, b) => a - b));
    }
  };

  // Open modal for new employee
  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setFormEid(`EMP-${1000 + employees.length + 1}`);
    setFormNameEn('');
    setFormNameBn('');
    setFormDesignation(INITIAL_DESIGNATIONS[4]);
    setFormDepartment(INITIAL_DEPARTMENTS[0]);
    setFormProject(INITIAL_PROJECTS[0]);
    setFormWorkplace('LEEDO Field Office');
    setFormJoiningDate(new Date().toISOString().split('T')[0]);
    setFormEmploymentType('Permanent');
    setFormSupervisor('Murshida Akhter Kanta (Director - Admin & Finance)');
    setFormSupervisorEid('1002');
    setFormMobile('+880 ');
    setFormEmail('');
    setFormStatus('Active');
    setFormRole('EMPLOYEE');
    setFormResignationDate('');
    setFormLastWorkingDay('');
    setFormStandardInTime('09:00 AM');
    setFormStandardOutTime('05:00 PM');
    setFormDailyHours(8);
    setFormWorkScheduleDays([6, 0, 1, 2, 3, 4]); // 6 days: Sat-Thu
    setIsDutyDaysDropdownOpen(false);
    setFormError('');
    setIsAddEditModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormEid(emp.eid);
    setFormNameEn(emp.nameEn);
    setFormNameBn(emp.nameBn || '');
    setFormDesignation(emp.designation);
    setFormDepartment(emp.department);
    setFormProject(emp.project);
    setFormWorkplace(emp.workplace);
    setFormJoiningDate(emp.joiningDate);
    setFormEmploymentType((emp.employmentType as any) || 'Permanent');
    const supName = emp.reportingSupervisor || 'Murshida Akhter Kanta (Director - Admin & Finance)';
    const supEid = emp.supervisorEid || (
      supName.toLowerCase().includes('kanta') ? '1002' :
      supName.toLowerCase().includes('sohel rana') ? '1013' :
      supName.toLowerCase().includes('farhana') ? '1075' :
      supName.toLowerCase().includes('omar') ? '1057' :
      supName.toLowerCase().includes('forhad') ? '1001' : ''
    );
    setFormSupervisor(supName);
    setFormSupervisorEid(supEid);
    setFormMobile(emp.mobileNumber);
    setFormEmail(emp.email);
    setFormStatus(emp.status);
    setFormRole(emp.role);
    setFormResignationDate(emp.resignationDate || '');
    setFormLastWorkingDay(emp.lastWorkingDay || '');
    setFormStandardInTime(emp.standardInTime || '09:00 AM');
    setFormStandardOutTime(emp.standardOutTime || '05:00 PM');
    setFormDailyHours(calculateDailyHoursFromTimes(emp.standardInTime || '09:00 AM', emp.standardOutTime || '05:00 PM'));
    setFormWorkScheduleDays(emp.workScheduleDays && emp.workScheduleDays.length > 0 ? emp.workScheduleDays : [6, 0, 1, 2, 3, 4]);
    setIsDutyDaysDropdownOpen(false);
    setFormError('');
    setIsAddEditModalOpen(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formEid.trim() || !formNameEn.trim()) {
      setFormError('EID and Employee English Name are required.');
      return;
    }

    if (formWorkScheduleDays.length === 0) {
      setFormError('Please select at least one scheduled working day for this employee.');
      return;
    }

    setIsSaving(true);

    try {
      const cleanEid = formEid.trim().toUpperCase();
      const nowStr = new Date().toISOString();
      const computedHours = calculateDailyHoursFromTimes(formStandardInTime, formStandardOutTime);

      const payload: Employee = {
        eid: cleanEid,
        nameEn: formNameEn.trim(),
        nameBn: formNameBn.trim(),
        designation: formDesignation,
        department: formDepartment,
        project: formProject,
        workplace: formWorkplace.trim(),
        joiningDate: formJoiningDate,
        employmentType: formEmploymentType,
        natureOfEmployment: (formEmploymentType as any) || 'Permanent',
        reportingSupervisor: formSupervisor.trim(),
        supervisorEid: formSupervisorEid || (
          formSupervisor.toLowerCase().includes('kanta') ? '1002' :
          formSupervisor.toLowerCase().includes('sohel rana') ? '1013' :
          formSupervisor.toLowerCase().includes('farhana') ? '1075' :
          formSupervisor.toLowerCase().includes('omar') ? '1057' :
          formSupervisor.toLowerCase().includes('forhad') ? '1001' : ''
        ),
        mobileNumber: formMobile.trim(),
        email: formEmail.trim() || `${cleanEid.toLowerCase()}@leedo.org.bd`,
        status: formStatus,
        role: formRole,
        workingDaysPerWeek: formWorkScheduleDays.length,
        workScheduleDays: formWorkScheduleDays,
        standardInTime: formStandardInTime.trim() || '09:00 AM',
        standardOutTime: formStandardOutTime.trim() || '05:00 PM',
        dailyHours: computedHours,
        resignationDate: formStatus === 'Resigned' || formStatus === 'Terminated' ? formResignationDate : undefined,
        lastWorkingDay: formStatus === 'Resigned' || formStatus === 'Terminated' ? formLastWorkingDay : undefined,
        createdAt: editingEmployee ? editingEmployee.createdAt : nowStr,
        updatedAt: nowStr
      };

      await setDoc(doc(db, 'employees', cleanEid), sanitizeForFirestore(payload));

      // Record Audit
      try {
        await addDoc(collection(db, 'auditLogs'), {
          action: editingEmployee ? 'EMPLOYEE_UPDATED' : 'EMPLOYEE_CREATED',
          recordType: 'Employee',
          recordId: cleanEid,
          eid: cleanEid,
          previousValue: editingEmployee ? JSON.stringify(editingEmployee) : null,
          newValue: JSON.stringify(payload),
          modifiedBy: `${currentUser?.nameEn} (${currentUser?.eid})`,
          modifiedAt: nowStr,
          reason: editingEmployee ? 'HR Profile modification' : 'New employee onboarding'
        });
      } catch (auditErr) {
        console.warn('Audit err:', auditErr);
      }

      setIsSaving(false);
      setIsAddEditModalOpen(false);
      onRefreshEmployees();
    } catch (err: any) {
      setIsSaving(false);
      setFormError(err.message || 'Failed to save employee profile.');
    }
  };

  // Toggle quick status (Deactivate / Reactivate)
  const handleToggleStatus = async (emp: Employee) => {
    const isDeactivating = emp.status === 'Active';
    const newStatus: EmploymentStatus = isDeactivating ? 'Resigned' : 'Active';
    const nowStr = new Date().toISOString();
    const today = nowStr.split('T')[0];

    const updated: Employee = {
      ...emp,
      status: newStatus,
      resignationDate: isDeactivating ? today : undefined,
      lastWorkingDay: isDeactivating ? today : undefined,
      updatedAt: nowStr
    };

    try {
      await setDoc(doc(db, 'employees', emp.eid), sanitizeForFirestore(updated));

      await addDoc(collection(db, 'auditLogs'), {
        action: isDeactivating ? 'EMPLOYEE_DEACTIVATED' : 'EMPLOYEE_REACTIVATED',
        recordType: 'Employee',
        recordId: emp.eid,
        eid: emp.eid,
        previousValue: JSON.stringify(emp),
        newValue: JSON.stringify(updated),
        modifiedBy: `${currentUser?.nameEn} (${currentUser?.eid})`,
        modifiedAt: nowStr,
        reason: isDeactivating ? 'Employee resigned/left organization' : 'Account reactivated by HR'
      });

      onRefreshEmployees();
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  // Export employee list to Excel
  const handleExportList = () => {
    const data = filteredEmployees.map((e, index) => ({
      'SL': index + 1,
      'EID': e.eid,
      'Name (English)': e.nameEn,
      'Name (Bangla)': e.nameBn || '',
      'Designation': e.designation,
      'Department': e.department,
      'Project': e.project,
      'Work Location': e.workplace,
      'Joining Date': e.joiningDate,
      'Employment Type': e.employmentType,
      'Supervisor': e.reportingSupervisor,
      'Mobile': e.mobileNumber,
      'Email': e.email,
      'Status': e.status,
      'System Role': e.role,
      'Resignation Date': e.resignationDate || 'N/A',
      'Last Working Day': e.lastWorkingDay || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'LEEDO_Staff_List');
    XLSX.writeFile(wb, `LEEDO_Employees_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Filtered list
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesEid = e.eid.toLowerCase().includes(q);
        const matchesName = e.nameEn.toLowerCase().includes(q) || (e.nameBn && e.nameBn.includes(q));
        if (!matchesEid && !matchesName) return false;
      }
      if (filterDept !== 'ALL' && e.department !== filterDept) return false;
      if (filterProject !== 'ALL' && e.project !== filterProject) return false;
      if (filterStatus !== 'ALL' && e.status !== filterStatus) return false;
      return true;
    });
  }, [employees, searchQuery, filterDept, filterProject, filterStatus]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {t('navEmployees')}
              </h1>
              <p className="text-xs text-slate-500">
                Staff directories, designations, branch locations, and lifecycle management with permanent historical records.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs w-full md:w-auto">
          <button
            onClick={handleExportList}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export List (XLSX)</span>
          </button>

          {isHrOrSuper && (
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t('addEmployee')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by EID or Name..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Department Filter */}
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
          >
            <option value="ALL">All Departments</option>
            {INITIAL_DEPARTMENTS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Project Filter */}
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
          >
            <option value="ALL">All Projects</option>
            {INITIAL_PROJECTS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Resigned">Resigned</option>
            <option value="Terminated">Terminated</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <span className="text-[11px] font-medium text-slate-400">
          Showing <strong>{filteredEmployees.length}</strong> of {employees.length} employees
        </span>

      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Designation & Role</th>
                <th className="px-4 py-3">Supervisor / Verifier</th>
                <th className="px-4 py-3">Duty Schedule & Shift</th>
                <th className="px-4 py-3">Department & Project</th>
                <th className="px-4 py-3">Work Location</th>
                <th className="px-4 py-3">Joining Date</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEmployees.map((emp) => (
                <tr key={emp.eid} className="hover:bg-slate-50 transition-colors">
                  {/* Employee Name & EID */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {emp.nameEn.charAt(0)}
                      </div>
                      <div>
                        <span className="font-bold text-slate-900 block">{emp.nameEn}</span>
                        <span className="text-[11px] text-slate-500 font-mono font-medium">{emp.eid}</span>
                      </div>
                    </div>
                  </td>

                  {/* Designation & Role */}
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-800 block">{emp.designation}</span>
                    <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold tracking-wider uppercase ${
                      emp.role === 'SUPER ADMIN'
                        ? 'bg-purple-100 text-purple-800'
                        : emp.role === 'HR ADMIN'
                        ? 'bg-teal-100 text-teal-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {emp.role}
                    </span>
                  </td>

                  {/* Supervisor / Verifier */}
                  <td className="px-4 py-3">
                    <span className="font-semibold text-slate-900 block text-[11px]">
                      {emp.reportingSupervisor || 'Murshida Akhter Kanta'}
                    </span>
                    <span className="text-[9px] text-emerald-800 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 inline-block mt-0.5">
                      Approver / Verifier
                    </span>
                  </td>

                  {/* Duty Schedule & Shift */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-[11px] font-mono text-slate-800">
                      <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>{emp.standardInTime || '09:00 AM'} – {emp.standardOutTime || '05:00 PM'}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {emp.workingDaysPerWeek || 6} days/wk
                      </span>
                      <span className="text-[10px] text-slate-500">({emp.dailyHours || 8}h/day)</span>
                    </div>
                  </td>

                  {/* Department & Project */}
                  <td className="px-4 py-3">
                    <span className="text-slate-800 block">{emp.department}</span>
                    <span className="text-[11px] text-slate-500">{emp.project}</span>
                  </td>

                  {/* Workplace */}
                  <td className="px-4 py-3 text-slate-600">
                    {emp.workplace}
                  </td>

                  {/* Joining Date */}
                  <td className="px-4 py-3 text-slate-600 font-mono">
                    {emp.joiningDate}
                  </td>

                  {/* Status Badge */}
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      emp.status === 'Active'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : emp.status === 'Resigned'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {emp.status}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setViewingEmployee(emp)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-slate-900 transition-colors"
                        title="View Profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {isHrOrSuper && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 hover:text-emerald-700 transition-colors"
                            title="Edit Employee"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleStatus(emp)}
                            className={`p-1.5 hover:bg-slate-100 rounded transition-colors ${
                              emp.status === 'Active' ? 'text-amber-600 hover:text-rose-700' : 'text-emerald-600'
                            }`}
                            title={emp.status === 'Active' ? 'Deactivate / Mark Resigned' : 'Reactivate Account'}
                          >
                            {emp.status === 'Active' ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Employee Modal */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">
                  {editingEmployee ? `Edit Employee (${editingEmployee.eid})` : 'Add New Employee'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
              
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* EID */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Employee ID (EID) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formEid}
                      onChange={(e) => setFormEid(e.target.value.toUpperCase())}
                      disabled={!!editingEmployee} // EID cannot be altered once created
                      placeholder="EMP-1005"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:bg-slate-100 font-mono font-bold"
                      required
                    />
                  </div>

                  {/* Role */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      System Access Role <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value as UserRole)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="HR ADMIN">HR ADMIN</option>
                      <option value="SUPER ADMIN">SUPER ADMIN</option>
                    </select>
                  </div>

                  {/* English Name */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Name in English <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formNameEn}
                      onChange={(e) => setFormNameEn(e.target.value)}
                      placeholder="e.g. Md. Rafiqul Islam"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  {/* Bangla Name */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Name in Bangla (ঐচ্ছিক)
                    </label>
                    <input
                      type="text"
                      value={formNameBn}
                      onChange={(e) => setFormNameBn(e.target.value)}
                      placeholder="e.g. মোঃ রফিকুল ইসলাম"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Designation */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Designation <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formDesignation}
                      onChange={(e) => setFormDesignation(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {INITIAL_DESIGNATIONS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Department <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formDepartment}
                      onChange={(e) => setFormDepartment(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {INITIAL_DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Project */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Project / Program <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formProject}
                      onChange={(e) => setFormProject(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      {INITIAL_PROJECTS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  {/* Workplace */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Work Location / Branch
                    </label>
                    <input
                      type="text"
                      value={formWorkplace}
                      onChange={(e) => setFormWorkplace(e.target.value)}
                      placeholder="e.g. Peace Home Aricha, Manikganj"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Joining Date */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Joining Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formJoiningDate}
                      onChange={(e) => setFormJoiningDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  {/* Employment Type */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Employment Type
                    </label>
                    <select
                      value={formEmploymentType}
                      onChange={(e) => setFormEmploymentType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Permanent">Permanent</option>
                      <option value="Contractual">Contractual</option>
                      <option value="Project-based">Project-based</option>
                      <option value="Probationary">Probationary</option>
                    </select>
                  </div>

                  {/* Mobile */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="text"
                      value={formMobile}
                      onChange={(e) => setFormMobile(e.target.value)}
                      placeholder="+880 1..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Official Email
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="employee@leedo.org.bd"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  {/* Reporting Supervisor Assignment */}
                  <div className="sm:col-span-2 bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-300">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Reporting Supervisor / Verifier (উপস্থিতি অনুমোদনকারী ইন-চার্জ)</span>
                      </label>
                      <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-100/80 px-2 py-0.5 rounded">
                        *এই কর্মকর্তা উপস্থিতির অনুমোদন ও যাচাই করবেন
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          সুপারভাইজার নির্বাচন করুন (Select from Staff List):
                        </label>
                        <select
                          value={formSupervisorEid || (formSupervisor ? 'custom' : '1002')}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'custom') {
                              setFormSupervisorEid('');
                            } else {
                              const mEmp = employees.find(emp => emp.eid === val);
                              if (mEmp) {
                                setFormSupervisorEid(mEmp.eid);
                                setFormSupervisor(`${mEmp.nameEn} (${mEmp.designation})`);
                              }
                            }
                          }}
                          className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white text-slate-800"
                        >
                          <optgroup label="Key Verification In-Charges (প্রধান অনুমোদনকারী কর্মকর্তা)">
                            <option value="1002">Murshida Akhter Kanta - Director (Admin & Finance) [EID: 1002]</option>
                            <option value="1013">Md. Sohel Rana - Manager (Program & Operation) [EID: 1013]</option>
                            <option value="1075">Farhana Akter - Program Coordinator [EID: 1075]</option>
                            <option value="1057">Md. Omar Faruque - Manager (HR & Admin) [EID: 1057]</option>
                            <option value="1001">Forhad Hossain - Executive Director [EID: 1001]</option>
                          </optgroup>
                          <optgroup label="Other Department Leads & Staff">
                            {employees
                              .filter(emp => !['1001', '1002', '1013', '1075', '1057'].includes(emp.eid))
                              .map(emp => (
                                <option key={emp.eid} value={emp.eid}>
                                  {emp.nameEn} ({emp.designation}) [EID: {emp.eid}]
                                </option>
                              ))}
                          </optgroup>
                          <option value="custom">Other / Custom Supervisor Title</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          সুপারভাইজার পদবী ও নাম (Supervisor Name & Title):
                        </label>
                        <input
                          type="text"
                          value={formSupervisor}
                          onChange={(e) => setFormSupervisor(e.target.value)}
                          placeholder="e.g. Murshida Akhter Kanta (Director - Admin & Finance)"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Employment Status
                    </label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as EmploymentStatus)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                    >
                      <option value="Active">Active</option>
                      <option value="Resigned">Resigned</option>
                      <option value="Terminated">Terminated</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>

                  {/* Resignation Date (if Resigned) */}
                  {(formStatus === 'Resigned' || formStatus === 'Terminated') && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Resignation / Exit Date
                      </label>
                      <input
                        type="date"
                        value={formResignationDate}
                        onChange={(e) => setFormResignationDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  )}

                </div>

                {/* Working Hours & Duty Days Roster Section */}
                <div className="pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-600" />
                      <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                        Job Shift Timing & Weekly Duty Schedule (কাজের সময় ও দায়িত্বের দিন)
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {formWorkScheduleDays.length} Days / Week
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    {/* Job Start Time */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Job Start Time (শুরুর সময়) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formStandardInTime}
                        onChange={(e) => handleInTimeChange(e.target.value)}
                        placeholder="e.g. 09:00 AM"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-medium focus:ring-1 focus:ring-emerald-500 text-xs"
                        required
                      />
                      <div className="flex items-center gap-1 mt-1">
                        {['09:00 AM', '08:30 AM', '10:00 AM'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => handleInTimeChange(t)}
                            className="text-[10px] px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-600"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Job End Time */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Job End Time (শেষের সময়) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formStandardOutTime}
                        onChange={(e) => handleOutTimeChange(e.target.value)}
                        placeholder="e.g. 05:00 PM"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-medium focus:ring-1 focus:ring-emerald-500 text-xs"
                        required
                      />
                      <div className="flex items-center gap-1 mt-1">
                        {['05:00 PM', '04:30 PM', '06:00 PM'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => handleOutTimeChange(t)}
                            className="text-[10px] px-1.5 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-600"
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Daily Working Hours (Auto Counted) */}
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Daily Hours (দৈনিক কর্মঘণ্টা)
                      </label>
                      <div className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 flex items-center justify-between">
                        <span>{calculateDailyHoursFromTimes(formStandardInTime, formStandardOutTime)} Hours / day</span>
                        <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                          Auto Counted
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Auto counted from shift timings ({formStandardInTime} – {formStandardOutTime})
                      </span>
                    </div>
                  </div>

                  {/* Multi-Select Duty Days Dropdown Menu */}
                  <div className="relative mb-3">
                    <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>
                        Scheduled Duty Days (কবে কবে ডিউটি - ড্রপডাউন মেনু) <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[11px] font-normal text-emerald-700">
                        {formWorkScheduleDays.length} day{formWorkScheduleDays.length > 1 ? 's' : ''} assigned
                      </span>
                    </label>

                    {/* Dropdown Button */}
                    <button
                      type="button"
                      onClick={() => setIsDutyDaysDropdownOpen(!isDutyDaysDropdownOpen)}
                      className="w-full bg-slate-50 border border-slate-300 hover:border-emerald-500 rounded-lg px-3 py-2 text-left flex items-center justify-between transition-colors shadow-xs"
                    >
                      <div className="flex flex-wrap items-center gap-1.5 overflow-hidden">
                        {formWorkScheduleDays.length === 0 ? (
                          <span className="text-slate-400 italic">Select weekly duty days...</span>
                        ) : (
                          WEEKDAYS_MAP
                            .filter(w => formWorkScheduleDays.includes(w.id))
                            .map(w => (
                              <span
                                key={w.id}
                                className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200"
                              >
                                {w.shortEn} ({w.nameBn.split(' ')[0]})
                              </span>
                            ))
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 shrink-0 ml-2">
                        <span className="text-[10px] font-bold text-slate-700">{formWorkScheduleDays.length} Days</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${isDutyDaysDropdownOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Dropdown Panel */}
                    {isDutyDaysDropdownOpen && (
                      <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-300 rounded-xl shadow-xl p-3 space-y-2">
                        {/* Day Checkboxes */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {WEEKDAYS_MAP.map((w) => {
                            const isChecked = formWorkScheduleDays.includes(w.id);
                            return (
                              <label
                                key={w.id}
                                onClick={() => toggleDutyDay(w.id)}
                                className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors border ${
                                  isChecked
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  {isChecked ? (
                                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400" />
                                  )}
                                  <div>
                                    <span className="block text-xs">{w.nameEn}</span>
                                    <span className="text-[10px] text-slate-500">{w.nameBn}</span>
                                  </div>
                                </div>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                  isChecked ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'
                                }`}>
                                  {isChecked ? 'Working' : 'Off'}
                                </span>
                              </label>
                            );
                          })}
                        </div>

                        <div className="flex justify-end pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => setIsDutyDaysDropdownOpen(false)}
                            className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg text-xs"
                          >
                            Done ({formWorkScheduleDays.length} Days Selected)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Auto-Calculated Annual Leave Entitlement (LEEDO Policy: 6d 8h = 16 CL, 14 SL, 0 AL; Pro-rata with .5 round up) */}
                  {(() => {
                    const quota = calculateEmployeeLeaveQuota(formWorkScheduleDays.length);
                    return (
                      <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                            <Briefcase className="w-4 h-4 text-emerald-700" />
                            <span>Annual Leave Entitlement (কাজের দিন অনুপাত অনুযায়ী ছুটি কোটা):</span>
                          </div>
                          <span className="text-[10px] font-extrabold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                            {formWorkScheduleDays.length} Days/Week ({quota.ratio}%)
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
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

              {/* Sticky Footer for Form Buttons */}
              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg shadow-xs disabled:opacity-50 transition-colors"
                >
                  {isSaving ? 'Saving...' : 'Save Employee Profile'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* View Detailed Profile Modal */}
      {viewingEmployee && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold">Employee Record: {viewingEmployee.eid}</h3>
              </div>
              <button
                onClick={() => setViewingEmployee(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
                <div className="w-12 h-12 rounded-full bg-emerald-600 text-white font-black text-base flex items-center justify-center">
                  {viewingEmployee.nameEn.charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{viewingEmployee.nameEn}</h4>
                  {viewingEmployee.nameBn && <p className="text-slate-500">{viewingEmployee.nameBn}</p>}
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 mt-1 inline-block">
                    {viewingEmployee.role}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Designation:</span>
                  <span className="font-semibold text-slate-800">{viewingEmployee.designation}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Department:</span>
                  <span className="font-semibold text-slate-800">{viewingEmployee.department}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Project / Program:</span>
                  <span className="font-semibold text-slate-800">{viewingEmployee.project}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Workplace:</span>
                  <span className="font-semibold text-slate-800">{viewingEmployee.workplace}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Joining Date:</span>
                  <span className="font-semibold text-slate-800 font-mono">{viewingEmployee.joiningDate}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Employment Type:</span>
                  <span className="font-semibold text-slate-800">{viewingEmployee.employmentType}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Reporting Supervisor:</span>
                  <span className="font-semibold text-slate-800">{viewingEmployee.reportingSupervisor}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Mobile Number:</span>
                  <span className="font-semibold text-slate-800 font-mono">{viewingEmployee.mobileNumber}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Official Email:</span>
                  <span className="font-semibold text-slate-800 font-mono">{viewingEmployee.email}</span>
                </div>
                
                {/* Job Timings & Shift */}
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500">Job Shift Timings:</span>
                  <span className="font-semibold text-slate-800 font-mono">
                    {viewingEmployee.standardInTime || '09:00 AM'} – {viewingEmployee.standardOutTime || '05:00 PM'} ({viewingEmployee.dailyHours || 8} hrs/day)
                  </span>
                </div>

                {/* Scheduled Duty Days */}
                <div className="py-2 border-b border-slate-100">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-slate-500 font-medium">Scheduled Duty Days:</span>
                    <span className="font-bold text-emerald-800 text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {viewingEmployee.workingDaysPerWeek || (viewingEmployee.workScheduleDays ? viewingEmployee.workScheduleDays.length : 6)} Days / Week
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAYS_MAP
                      .filter(w => (viewingEmployee.workScheduleDays || [6, 0, 1, 2, 3, 4]).includes(w.id))
                      .map(w => (
                        <span key={w.id} className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {w.nameEn} ({w.nameBn.split(' ')[0]})
                        </span>
                      ))}
                  </div>
                </div>

                {/* Annual Leave Entitlement Quota (Ratio Based) */}
                {(() => {
                  const quota = calculateEmployeeLeaveQuota(viewingEmployee.workingDaysPerWeek || (viewingEmployee.workScheduleDays ? viewingEmployee.workScheduleDays.length : 6));
                  return (
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-950 mt-2">
                      <span className="font-bold block mb-1">📋 Annual Leave Entitlement (অনুপাত অনুযায়ী ছুটি কোটা):</span>
                      <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                        <div className="p-1.5 bg-white rounded border border-emerald-200">
                          <span className="text-[10px] text-slate-500 block font-sans">Casual (CL)</span>
                          <span className="font-black text-amber-800">{quota.casualLeave} Days</span>
                        </div>
                        <div className="p-1.5 bg-white rounded border border-emerald-200">
                          <span className="text-[10px] text-slate-500 block font-sans">Sick (SL)</span>
                          <span className="font-black text-orange-800">{quota.sickLeave} Days</span>
                        </div>
                        <div className="p-1.5 bg-white rounded border border-emerald-200">
                          <span className="text-[10px] text-slate-500 block font-sans">Annual (AL)</span>
                          <span className="font-black text-slate-400">0 (None)</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Employment Status:</span>
                  <span className="font-bold text-emerald-700">{viewingEmployee.status}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setViewingEmployee(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
