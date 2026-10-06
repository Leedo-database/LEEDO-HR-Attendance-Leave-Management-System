import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { Navbar } from './components/Navbar';
import { Sidebar, NavTab } from './components/Sidebar';
import { LoginScreen } from './components/LoginScreen';
import { DailyAttendanceModal } from './components/DailyAttendanceModal';
import { HRDashboardView } from './components/views/HRDashboardView';
import { EmployeeDashboardView } from './components/views/EmployeeDashboardView';
import { EmployeeManagementView } from './components/views/EmployeeManagementView';
import { MonthlyRegisterView } from './components/views/MonthlyRegisterView';
import { MonthlyTimesheetView } from './components/views/MonthlyTimesheetView';
import { AttendanceCalendarView } from './components/views/AttendanceCalendarView';
import { HRVerificationView } from './components/views/HRVerificationView';
import { LeaveManagementView } from './components/views/LeaveManagementView';
import { ExcelReportsView } from './components/views/ExcelReportsView';
import { RegisterUploadView } from './components/views/RegisterUploadView';
import { AuditLogsView } from './components/views/AuditLogsView';
import { SystemSettingsView } from './components/views/SystemSettingsView';
import { UserProfileView } from './components/views/UserProfileView';
import { 
  Employee, 
  AttendanceRecord, 
  LeaveRecord, 
  Holiday, 
  MonthlyLock, 
  UploadedRegister, 
  AuditLog 
} from './types';
import { 
  collection, 
  getDocs, 
  onSnapshot, 
  doc, 
  setDoc, 
  writeBatch 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  INITIAL_EMPLOYEES, 
  INITIAL_HOLIDAYS_2026, 
  INITIAL_LEAVE_RECORDS 
} from './lib/initialData';
import { exportMonthlyRegisterExcel } from './lib/excelGenerator';
import { Menu, Calendar } from 'lucide-react';

function MainApp() {
  const { currentUser, role, isLoading } = useAuth();
  const { t, language } = useLanguage();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Firestore Live States
  const [employees, setEmployees] = useState<Employee[]>(INITIAL_EMPLOYEES);
  const [allAttendance, setAllAttendance] = useState<AttendanceRecord[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>(INITIAL_LEAVE_RECORDS);
  const [holidays, setHolidays] = useState<Holiday[]>(INITIAL_HOLIDAYS_2026);
  const [monthlyLocks, setMonthlyLocks] = useState<Record<string, MonthlyLock>>({});
  const [uploadedRegisters, setUploadedRegisters] = useState<UploadedRegister[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Daily Attendance Modal State
  const [isDailyModalOpen, setIsDailyModalOpen] = useState(false);
  const [dailyModalDate, setDailyModalDate] = useState<string | undefined>(undefined);
  const [dailyModalTargetEmp, setDailyModalTargetEmp] = useState<Employee | undefined>(undefined);
  const [dailyModalExistingRecord, setDailyModalExistingRecord] = useState<AttendanceRecord | null>(null);

  // Profile Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Initialize and Seed Firestore on first load if empty
  const fetchAndSeedInitialData = async () => {
    try {
      // 1. Fetch or Seed Employees (all 97 LEEDO staff members)
      const empSnap = await getDocs(collection(db, 'employees'));
      if (empSnap.empty || empSnap.size < 50) {
        const batch = writeBatch(db);
        INITIAL_EMPLOYEES.forEach((emp) => {
          batch.set(doc(db, 'employees', emp.eid), emp, { merge: true });
        });
        await batch.commit();
        setEmployees(INITIAL_EMPLOYEES);
      } else {
        const list: Employee[] = [];
        empSnap.forEach(d => list.push(d.data() as Employee));
        // Sort by numeric EID
        list.sort((a, b) => (Number(a.eid) || 0) - (Number(b.eid) || 0));
        setEmployees(list);
      }

      // 2. Fetch or Seed Holidays
      const holSnap = await getDocs(collection(db, 'holidays'));
      if (holSnap.empty) {
        const batch = writeBatch(db);
        INITIAL_HOLIDAYS_2026.forEach(h => {
          batch.set(doc(db, 'holidays', h.id), h);
        });
        await batch.commit();
        setHolidays(INITIAL_HOLIDAYS_2026);
      } else {
        const list: Holiday[] = [];
        holSnap.forEach(d => list.push(d.data() as Holiday));
        setHolidays(list);
      }

      // 3. Fetch or Seed Leave Records
      const leaveSnap = await getDocs(collection(db, 'leaveRecords'));
      if (leaveSnap.empty) {
        const batch = writeBatch(db);
        INITIAL_LEAVE_RECORDS.forEach(l => {
          batch.set(doc(db, 'leaveRecords', l.id), l);
        });
        await batch.commit();
        setLeaveRecords(INITIAL_LEAVE_RECORDS);
      } else {
        const list: LeaveRecord[] = [];
        leaveSnap.forEach(d => list.push(d.data() as LeaveRecord));
        setLeaveRecords(list);
      }

      // 4. Fetch Attendance
      const attSnap = await getDocs(collection(db, 'attendance'));
      if (!attSnap.empty) {
        const list: AttendanceRecord[] = [];
        attSnap.forEach(d => list.push(d.data() as AttendanceRecord));
        setAllAttendance(list);
      } else {
        // Seed a few initial attendance records for current month so registers and dashboards immediately showcase rich data
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const sampleBatch = writeBatch(db);
        const sampleRecords: AttendanceRecord[] = [];

        INITIAL_EMPLOYEES.slice(0, 4).forEach((emp) => {
          for (let d = 1; d <= 5; d++) {
            const dayStr = String(d).padStart(2, '0');
            const dateStr = `${year}-${month}-${dayStr}`;
            const id = `${emp.eid}_${dateStr}`;
            const dateObj = new Date(dateStr + 'T00:00:00');
            const isFri = dateObj.getDay() === 5;

            const rec: AttendanceRecord = {
              id,
              eid: emp.eid,
              employeeName: emp.nameEn,
              department: emp.department,
              project: emp.project,
              date: dateStr,
              month: `${year}-${month}`,
              year: String(year),
              status: isFri ? 'WO' : 'P',
              dutyDescription: isFri ? '' : 'Regular scheduled duty at project location',
              verificationStatus: 'Verified',
              verifiedBy: 'Anowar Hossain (HR)',
              verifiedAt: new Date().toISOString(),
              source: 'DailyEntry',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            sampleBatch.set(doc(db, 'attendance', id), rec);
            sampleRecords.push(rec);
          }
        });
        await sampleBatch.commit();
        setAllAttendance(sampleRecords);
      }

      // 5. Fetch Monthly Locks
      const locksSnap = await getDocs(collection(db, 'monthlyLocks'));
      const locksMap: Record<string, MonthlyLock> = {};
      locksSnap.forEach(d => {
        const data = d.data() as MonthlyLock;
        locksMap[data.month] = data;
      });
      setMonthlyLocks(locksMap);

      // 6. Fetch Uploaded Registers
      const upSnap = await getDocs(collection(db, 'uploadedRegisters'));
      const upList: UploadedRegister[] = [];
      upSnap.forEach(d => upList.push(d.data() as UploadedRegister));
      setUploadedRegisters(upList);

      // 7. Fetch Audit Logs
      const auditSnap = await getDocs(collection(db, 'auditLogs'));
      const aList: AuditLog[] = [];
      auditSnap.forEach(d => aList.push({ id: d.id, ...d.data() } as AuditLog));
      aList.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
      setAuditLogs(aList);
    } catch (err: any) {
      console.warn('Initial data seeding/fetch note:', err);
    }
  };

  useEffect(() => {
    fetchAndSeedInitialData();

    // Attach real-time listener for attendance
    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => {
      const list: AttendanceRecord[] = [];
      snap.forEach(d => list.push(d.data() as AttendanceRecord));
      setAllAttendance(list);
    }, (err) => {
      console.warn('Attendance snapshot listener err:', err);
    });

    // Real-time listener for audit logs
    const unsubAudit = onSnapshot(collection(db, 'auditLogs'), (snap) => {
      const list: AuditLog[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as AuditLog));
      list.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
      setAuditLogs(list);
    }, (err) => {
      console.warn('Audit snapshot err:', err);
    });

    return () => {
      unsubAttendance();
      unsubAudit();
    };
  }, []);

  // Check if current month is locked
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const isCurrentMonthLocked = monthlyLocks[currentMonthKey]?.isLocked || false;

  const handleOpenDailyModal = (
    date?: string,
    targetEmp?: Employee,
    existing?: AttendanceRecord
  ) => {
    setDailyModalDate(date);
    setDailyModalTargetEmp(targetEmp);
    setDailyModalExistingRecord(existing || null);
    setIsDailyModalOpen(true);
  };

  // Master Excel Download trigger
  const handleExportMasterExcel = () => {
    const d = new Date();
    exportMonthlyRegisterExcel(d.getFullYear(), d.getMonth() + 1, employees, allAttendance, holidays);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-semibold tracking-wider uppercase text-slate-400">
          Loading LEEDO HRMS...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  const isHrOrSuper = role === 'HR ADMIN' || role === 'SUPER ADMIN';

  return (
    <div className="min-h-screen bg-slate-100/70 font-sans text-slate-800">
      
      {/* Top Navbar */}
      <Navbar onOpenProfile={() => setCurrentTab('profile')} />

      {/* Mobile Menu Trigger & Bangladesh Work-Week Notice Banner */}
      <div className="bg-emerald-950 text-emerald-200 px-4 py-1.5 flex items-center justify-between text-[11px] lg:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex items-center gap-1.5 font-bold text-white p-1"
        >
          <Menu className="w-4 h-4" />
          <span>Menu</span>
        </button>
        <div className="flex items-center gap-1 text-[10px]">
          <Calendar className="w-3 h-3 text-amber-400" />
          <span>Fri = Off | Sat = Working Day</span>
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex">
        {/* Left Sidebar */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab)}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          employees={employees}
        />

        {/* Content View Area */}
        <main className="flex-1 lg:pl-64 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full transition-all">
          
          {/* Dashboard Tab */}
          {currentTab === 'dashboard' && (
            isHrOrSuper ? (
              <HRDashboardView
                employees={employees}
                allAttendance={allAttendance}
                holidays={holidays}
                leaveRecords={leaveRecords}
                onOpenDailyModal={() => handleOpenDailyModal()}
                onNavigateToTab={(tab) => setCurrentTab(tab)}
                onExportExcel={handleExportMasterExcel}
              />
            ) : (
              <EmployeeDashboardView
                attendanceRecords={allAttendance.filter(a => a.eid === currentUser.eid)}
                holidays={holidays}
                leaveRecords={leaveRecords.filter(l => l.eid === currentUser.eid)}
                onOpenDailyModal={() => handleOpenDailyModal()}
                onNavigateToTab={(tab) => setCurrentTab(tab)}
                isMonthLocked={isCurrentMonthLocked}
              />
            )
          )}

          {/* Daily Attendance Modal Triggered from Tab */}
          {currentTab === 'daily-attendance' && (
            <div className="space-y-4">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Daily Attendance Portal</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Submit or correct individual daily attendance records.
                  </p>
                </div>
                <button
                  onClick={() => handleOpenDailyModal()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs"
                >
                  + New Daily Attendance Entry
                </button>
              </div>

              {/* Show recent personal logs */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide mb-3">
                  Recent Attendance Logs ({currentUser.nameEn})
                </h3>
                <div className="space-y-2 text-xs">
                  {allAttendance
                    .filter(a => a.eid === currentUser.eid)
                    .slice(0, 10)
                    .map(rec => (
                      <div key={rec.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="font-mono font-bold text-slate-800">{rec.date}</span>
                          <span className="ml-2 font-bold px-2 py-0.5 bg-white border border-slate-300 rounded text-slate-800">
                            {rec.status}
                          </span>
                          <p className="text-[11px] text-slate-500 mt-0.5">{rec.dutyDescription || 'No duty description'}</p>
                        </div>
                        <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                          {rec.verificationStatus}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Monthly Register Tab */}
          {currentTab === 'monthly-register' && (
            <MonthlyRegisterView
              employees={employees}
              allAttendance={allAttendance}
              holidays={holidays}
              onRefreshAttendance={() => fetchAndSeedInitialData()}
              isMonthLocked={isCurrentMonthLocked}
            />
          )}

          {/* Monthly Timesheet Tab (Print-ready NGO format for all staff & HR) */}
          {currentTab === 'timesheet' && (
            <MonthlyTimesheetView
              employees={employees}
              allAttendance={allAttendance}
              holidays={holidays}
            />
          )}

          {/* Attendance Calendar Tab */}
          {currentTab === 'calendar' && (
            <AttendanceCalendarView
              employees={employees}
              allAttendance={allAttendance}
              holidays={holidays}
              onOpenDateModal={(dt, emp, rec) => handleOpenDailyModal(dt, emp, rec)}
              onExportExcel={handleExportMasterExcel}
            />
          )}

          {/* Employee Management Tab (HR Only) */}
          {currentTab === 'employees' && (
            <EmployeeManagementView
              employees={employees}
              onRefreshEmployees={() => fetchAndSeedInitialData()}
            />
          )}

          {/* HR Verification Center Tab (HR Only) */}
          {currentTab === 'verification' && (
            <HRVerificationView
              employees={employees}
              allAttendance={allAttendance}
              monthlyLocks={monthlyLocks}
              onRefreshAttendance={() => fetchAndSeedInitialData()}
              onRefreshLocks={() => fetchAndSeedInitialData()}
            />
          )}

          {/* Leave Management Tab */}
          {currentTab === 'leave' && (
            <LeaveManagementView
              leaveRecords={leaveRecords}
              employees={employees}
              onRefreshLeaves={() => fetchAndSeedInitialData()}
              isMonthLocked={isCurrentMonthLocked}
            />
          )}

          {/* Register Upload & Digital Archive Tab */}
          {currentTab === 'upload-archive' && (
            <RegisterUploadView
              uploadedRegisters={uploadedRegisters}
              employees={employees}
              allAttendance={allAttendance}
              onRefreshUploads={() => fetchAndSeedInitialData()}
              onRefreshAttendance={() => fetchAndSeedInitialData()}
            />
          )}

          {/* Attendance Reports Tab */}
          {currentTab === 'reports' && (
            <ExcelReportsView
              employees={employees}
              allAttendance={allAttendance}
              holidays={holidays}
              leaveRecords={leaveRecords}
              onNavigateToTimesheet={() => setCurrentTab('timesheet')}
            />
          )}

          {/* Audit Logs Tab (HR Only) */}
          {currentTab === 'audit-logs' && (
            <AuditLogsView auditLogs={auditLogs} />
          )}

          {/* System Settings Tab (HR Only) */}
          {currentTab === 'settings' && (
            <SystemSettingsView
              holidays={holidays}
              onRefreshHolidays={() => fetchAndSeedInitialData()}
            />
          )}

          {/* User Profile Tab */}
          {currentTab === 'profile' && (
            <UserProfileView />
          )}

        </main>
      </div>

      {/* Global Daily Attendance Modal */}
      {isDailyModalOpen && (
        <DailyAttendanceModal
          isOpen={isDailyModalOpen}
          onClose={() => setIsDailyModalOpen(false)}
          onSuccess={() => {
            fetchAndSeedInitialData();
          }}
          initialDate={dailyModalDate}
          targetEmployee={dailyModalTargetEmp}
          existingRecord={dailyModalExistingRecord}
          holidays={holidays}
          isMonthLocked={isCurrentMonthLocked}
        />
      )}

    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </LanguageProvider>
  );
}
