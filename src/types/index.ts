export type UserRole = 'EMPLOYEE' | 'HR ADMIN' | 'SUPER ADMIN';

export type EmploymentStatus = 'Active' | 'Inactive' | 'Resigned' | 'Terminated';

export type AttendanceStatus =
  | 'P'   // Present
  | 'CL'  // Casual Leave
  | 'SL'  // Sick Leave
  | 'AL'  // Annual Leave
  | 'ML'  // Maternity Leave
  | 'PL'  // Paternity Leave
  | 'UL'  // Unpaid Leave
  | 'A'   // Absent
  | 'WO'  // Weekly Off (Friday or scheduled off)
  | 'PH'  // Public Holiday
  | 'OD'  // Official Duty
  | 'TR'  // Training
  | 'WFH' // Work From Home
  | 'CO'  // Compensatory Off
  | 'HD'; // Half Day

export type VerificationStatus = 'Unverified' | 'Verified' | 'Correction Required';

export interface Employee {
  sl?: number;
  eid: string;
  nameEn: string;
  nameBn?: string;
  designation: string;
  department: string;
  project: string;
  workplace: string;
  status: EmploymentStatus;
  role: UserRole;
  mobileNumber: string;
  personalEmail?: string;
  officialEmail?: string;
  email: string;
  nid?: string;
  dob?: string;
  address?: string;
  highestEducation?: string;
  professionalEducation?: string;
  certificateNumber?: string;
  fatherOrHusbandName?: string;
  motherName?: string;
  gender?: string;
  religion?: string;
  grade?: string;
  netSalary?: string;
  bankAccountNumber?: string;
  natureOfEmployment: 'Permanent' | 'Contractual' | 'Part Time' | 'Project-based' | 'Probationary';
  categoryOfStaff?: string;
  donorName?: string;
  jobLocationCategory?: string;
  jobLocation?: string;
  joiningDate: string; // YYYY-MM-DD or standard string
  doc?: string; // Confirmation date
  resignationDate?: string;
  lastWorkingDay?: string;
  dos?: string; // Separation date
  reasonForDos?: string;
  emergencyContact?: string;
  remarks?: string;
  reportingSupervisor?: string;
  supervisorEid?: string;
  employmentType?: string;
  photoUrl?: string;

  // Working Hours & Schedule Settings (e.g. 6 days, 5 days, 3 days weekly)
  workingDaysPerWeek: number; // 3, 5, or 6
  workScheduleDays: number[]; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  standardInTime: string; // e.g. "09:00 AM"
  standardOutTime: string; // e.g. "05:00 PM"
  dailyHours: number; // e.g. 8 or 6
  extraDutyAllowancePerDay?: number; // e.g. 500 BDT per off-day duty

  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string; // Deterministic format: `${eid}_${date}`
  eid: string;
  employeeName: string;
  department: string;
  project: string;
  date: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  year: string; // YYYY
  status: AttendanceStatus;
  inTime?: string; // e.g. "09:00 AM"
  outTime?: string; // e.g. "05:00 PM"
  hoursWorked?: number; // e.g. 8
  dutyDescription?: string;
  remarks?: string;
  supportingDocument?: string;
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  verificationRemarks?: string;
  source: 'DailyEntry' | 'MonthlyRegister' | 'UploadedRegister' | 'ManualCorrection';
  createdAt: string;
  updatedAt: string;
}

export interface LeaveRecord {
  id: string;
  eid: string;
  employeeName: string;
  leaveType: 'Casual Leave' | 'Sick Leave' | 'Annual Leave' | 'Maternity Leave' | 'Paternity Leave' | 'Unpaid Leave';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  supportingDocument?: string;
  status: VerificationStatus | 'Rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  remarks?: string;
  createdAt: string;
}

export interface MonthlyLock {
  month: string; // YYYY-MM
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  remarks?: string;
}

export interface Holiday {
  id: string; // YYYY-MM-DD
  nameEn: string;
  nameBn: string;
  date: string; // YYYY-MM-DD
  type: 'Public Holiday' | 'LEEDO Special Holiday';
  year: string;
}

export interface UploadedRegister {
  id: string;
  fileName: string;
  fileType: string;
  month: string;
  department?: string;
  project?: string;
  remarks?: string;
  totalRows: number;
  importedCount: number;
  uploadedBy: string;
  uploadedByEid?: string;
  uploadedAt: string;
  fileDataPreview?: Array<Record<string, any>>;
}

export interface AuditLog {
  id: string;
  action: string;
  recordType: 'Attendance' | 'Employee' | 'Leave' | 'Lock' | 'Register' | 'Settings';
  recordId: string;
  eid?: string;
  previousValue?: string;
  newValue?: string;
  modifiedBy: string;
  modifiedAt: string;
  reason?: string;
}

export interface MonthlyAttendanceSummary {
  calendarDays: number;
  scheduledWorkingDays: number;
  presentDays: number;
  casualLeave: number;
  sickLeave: number;
  annualLeave: number;
  maternityLeave: number;
  paternityLeave: number;
  unpaidLeave: number;
  absentDays: number;
  weeklyHolidays: number;
  publicHolidays: number;
  officialDuty: number;
  trainingDays: number;
  workFromHome: number;
  compensatoryOff: number;
  halfDays: number;
  totalLeave: number;
  missingAttendance: number;
  totalHoursWorked?: number;
  scheduledHours?: number;
  extraDutyDays: number;
  extraDutyLeaveEarned: number;
  extraDutyPay: number;
  extraDutyDates: string[];
}
