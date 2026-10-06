import { AttendanceRecord, AttendanceStatus, Employee, Holiday, MonthlyAttendanceSummary } from '../types';

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

export function isFriday(dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDay() === 5; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
}

export const WEEKDAYS_MAP: { id: number; nameEn: string; nameBn: string; shortEn: string }[] = [
  { id: 6, nameEn: 'Saturday', nameBn: 'শনিবার', shortEn: 'Sat' },
  { id: 0, nameEn: 'Sunday', nameBn: 'রবিবার', shortEn: 'Sun' },
  { id: 1, nameEn: 'Monday', nameBn: 'সোমবার', shortEn: 'Mon' },
  { id: 2, nameEn: 'Tuesday', nameBn: 'মঙ্গলবার', shortEn: 'Tue' },
  { id: 3, nameEn: 'Wednesday', nameBn: 'বুধবার', shortEn: 'Wed' },
  { id: 4, nameEn: 'Thursday', nameBn: 'বৃহস্পতিবার', shortEn: 'Thu' },
  { id: 5, nameEn: 'Friday', nameBn: 'শুক্রবার (সাপ্তাহিক ছুটি)', shortEn: 'Fri' }
];

// Auto-calculate daily working hours from Start Time and End Time (e.g. 09:00 AM to 05:00 PM -> 8 hours)
export function calculateDailyHoursFromTimes(inTime: string, outTime: string): number {
  if (!inTime || !outTime) return 8;

  const parseTimeToMinutes = (t: string): number | null => {
    const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3] ? match[3].toUpperCase() : null;
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  };

  const inMins = parseTimeToMinutes(inTime);
  const outMins = parseTimeToMinutes(outTime);
  if (inMins === null || outMins === null) return 8;

  let diff = outMins - inMins;
  if (diff <= 0) diff += 24 * 60; // overnight shift support
  const hours = Math.round((diff / 60) * 10) / 10;
  return hours > 0 ? hours : 8;
}

// LEEDO Official Leave Quota Calculation Rule:
// Benchmark (Full-time): 6 days / week, 8 hrs/day -> 16 days Casual Leave, 14 days Sick Leave, 0 Annual Leave.
// Pro-rata by working days per week: ratio = workingDays / 6.
// Rounding rule: If decimal >= 0.5 round up (e.g. 5.5 -> 6), else round down.
export function calculateEmployeeLeaveQuota(workingDaysPerWeek: number = 6) {
  const days = Math.min(Math.max(Number(workingDaysPerWeek) || 6, 1), 7);
  const ratio = days / 6;

  const clRaw = 16 * ratio;
  const slRaw = 14 * ratio;

  // Round figure: >= .5 rounds up (Math.round in JS does exactly this)
  const clRounded = Math.round(clRaw);
  const slRounded = Math.round(slRaw);

  return {
    casualLeave: clRounded,
    sickLeave: slRounded,
    annualLeave: 0, // LEEDO Policy: No annual leave
    ratio: Math.round(ratio * 100)
  };
}

// Checks if a given date is a scheduled working day for an employee (supporting 3, 5, or 6 days/week)
export function isEmployeeScheduledWorkDay(dateStr: string, employee?: Employee): boolean {
  const d = new Date(dateStr + 'T00:00:00');
  const weekday = d.getDay(); // 0=Sun ... 6=Sat

  // Friday is organization weekly holiday for everyone
  if (weekday === 5) return false;

  if (employee?.workScheduleDays && employee.workScheduleDays.length > 0) {
    return employee.workScheduleDays.includes(weekday);
  }

  // Default: Saturday (6) through Thursday (4) are working days
  return true;
}

// Determines if an attendance entry qualifies as Extra Duty / Out-of-Roster Duty (which earns extra leave & payment)
export function isExtraDutyDay(dateStr: string, employee?: Employee, status?: AttendanceStatus, isHoliday?: boolean): boolean {
  if (!status) return false;
  // Working statuses: P, OD, TR, WFH, HD
  const isWorkingStatus = status === 'P' || status === 'OD' || status === 'TR' || status === 'WFH' || status === 'HD';
  if (!isWorkingStatus) return false;

  const isScheduled = isEmployeeScheduledWorkDay(dateStr, employee);
  const isFri = isFriday(dateStr);

  // If working on Friday, non-scheduled day, or public holiday: it is Extra Duty!
  return isFri || !isScheduled || !!isHoliday;
}

export function calculateMonthlyAttendance(
  year: number,
  month: number, // 1 to 12
  records: AttendanceRecord[],
  holidays: Holiday[],
  employee?: Employee
): MonthlyAttendanceSummary {
  const totalDays = getDaysInMonth(year, month);
  const holidayDateSet = new Set(holidays.map(h => h.date));

  // Map existing records by date
  const recordsByDate = new Map<string, AttendanceRecord>();
  records.forEach(r => recordsByDate.set(r.date, r));

  let presentDays = 0;
  let casualLeave = 0;
  let sickLeave = 0;
  let annualLeave = 0;
  let maternityLeave = 0;
  let paternityLeave = 0;
  let unpaidLeave = 0;
  let absentDays = 0;
  let weeklyHolidays = 0;
  let publicHolidays = 0;
  let officialDuty = 0;
  let trainingDays = 0;
  let workFromHome = 0;
  let compensatoryOff = 0;
  let halfDays = 0;
  let missingAttendance = 0;
  let scheduledWorkingDays = 0;
  let totalHoursWorked = 0;
  let extraDutyDays = 0;
  let extraDutyLeaveEarned = 0;
  const extraDutyDates: string[] = [];

  const standardDailyHours = employee?.dailyHours || 8;
  const allowanceRate = employee?.extraDutyAllowancePerDay || 500; // standard NGO Extra Duty Allowance: BDT 500/day

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = formatDateKey(year, month, day);
    const isFri = isFriday(dateStr);
    const isPublicHoliday = holidayDateSet.has(dateStr);
    const isScheduledWorkDay = isEmployeeScheduledWorkDay(dateStr, employee);

    if (isFri || !isScheduledWorkDay) {
      weeklyHolidays++;
    } else if (isPublicHoliday) {
      publicHolidays++;
    } else {
      scheduledWorkingDays++;
    }

    const rec = recordsByDate.get(dateStr);
    if (!rec) {
      if (isScheduledWorkDay && !isFri && !isPublicHoliday) {
        missingAttendance++;
      }
      continue;
    }

    // Check if this record is on an off-day / non-scheduled day / public holiday (Extra Duty)
    const isExtra = isExtraDutyDay(dateStr, employee, rec.status, isPublicHoliday);
    if (isExtra) {
      if (rec.status === 'HD') {
        extraDutyDays += 0.5;
        extraDutyLeaveEarned += 0.5;
      } else {
        extraDutyDays += 1;
        extraDutyLeaveEarned += 1;
      }
      extraDutyDates.push(dateStr);
    }

    switch (rec.status) {
      case 'P':
        presentDays++;
        totalHoursWorked += rec.hoursWorked || standardDailyHours;
        break;
      case 'CL':
        casualLeave++;
        break;
      case 'SL':
        sickLeave++;
        break;
      case 'AL':
        annualLeave++;
        break;
      case 'ML':
        maternityLeave++;
        break;
      case 'PL':
        paternityLeave++;
        break;
      case 'UL':
        unpaidLeave++;
        break;
      case 'A':
        absentDays++;
        break;
      case 'OD':
        officialDuty++;
        totalHoursWorked += rec.hoursWorked || standardDailyHours;
        break;
      case 'TR':
        trainingDays++;
        totalHoursWorked += rec.hoursWorked || standardDailyHours;
        break;
      case 'WFH':
        workFromHome++;
        totalHoursWorked += rec.hoursWorked || standardDailyHours;
        break;
      case 'CO':
        compensatoryOff++;
        break;
      case 'HD':
        halfDays++;
        presentDays += 0.5;
        totalHoursWorked += rec.hoursWorked || (standardDailyHours / 2);
        break;
      case 'WO':
        break;
      case 'PH':
        break;
    }
  }

  const totalLeave = casualLeave + sickLeave + annualLeave + maternityLeave + paternityLeave + unpaidLeave;
  const scheduledHours = scheduledWorkingDays * standardDailyHours;
  const extraDutyPay = extraDutyDays * allowanceRate;

  return {
    calendarDays: totalDays,
    scheduledWorkingDays,
    presentDays,
    casualLeave,
    sickLeave,
    annualLeave,
    maternityLeave,
    paternityLeave,
    unpaidLeave,
    absentDays,
    weeklyHolidays,
    publicHolidays,
    officialDuty,
    trainingDays,
    workFromHome,
    compensatoryOff,
    halfDays,
    totalLeave,
    missingAttendance,
    totalHoursWorked,
    scheduledHours,
    extraDutyDays,
    extraDutyLeaveEarned,
    extraDutyPay,
    extraDutyDates
  };
}

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, { bg: string; text: string; border: string }> = {
  P: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300' },
  CL: { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300' },
  SL: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  AL: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  ML: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  PL: { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
  UL: { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
  A: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
  WO: { bg: 'bg-slate-200', text: 'text-slate-700', border: 'border-slate-300' },
  PH: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  OD: { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300' },
  TR: { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300' },
  WFH: { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300' },
  CO: { bg: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-300' },
  HD: { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', border: 'border-fuchsia-300' },
};
