import * as XLSX from 'xlsx';
import { AttendanceRecord, Employee, Holiday } from '../types';
import { calculateMonthlyAttendance, getDaysInMonth, isFriday } from './attendanceCalculator';

export function exportMonthlyRegisterExcel(
  year: number,
  month: number,
  employees: Employee[],
  allAttendance: AttendanceRecord[],
  holidays: Holiday[],
  filterDept?: string,
  filterProject?: string
) {
  const totalDays = getDaysInMonth(year, month);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[month - 1];

  let filteredEmployees = employees.filter(e => e.status === 'Active' || e.status === 'Resigned');
  if (filterDept && filterDept !== 'ALL') {
    filteredEmployees = filteredEmployees.filter(e => e.department === filterDept);
  }
  if (filterProject && filterProject !== 'ALL') {
    filteredEmployees = filteredEmployees.filter(e => e.project === filterProject);
  }

  // Pre-index attendance by EID and Date
  const attendanceMap = new Map<string, AttendanceRecord>();
  allAttendance.forEach(a => {
    attendanceMap.set(`${a.eid}_${a.date}`, a);
  });

  const headerRows = [
    ['LOCAL EDUCATION AND ECONOMIC DEVELOPMENT ORGANIZATION (LEEDO)'],
    ['LEEDO HR ATTENDANCE & LEAVE MANAGEMENT SYSTEM - MONTHLY REGISTER'],
    [`Period: ${monthName} ${year} | Generated on: ${new Date().toLocaleDateString('en-GB')}`],
    [`Filter: ${filterDept ? `Department: ${filterDept}` : 'All Departments'} | ${filterProject ? `Project: ${filterProject}` : 'All Projects'}`],
    [] // blank row
  ];

  // Table Columns Header
  const dateColumns: string[] = [];
  for (let d = 1; d <= totalDays; d++) {
    const dayStr = String(d).padStart(2, '0');
    const fullDate = `${year}-${String(month).padStart(2, '0')}-${dayStr}`;
    const friday = isFriday(fullDate);
    dateColumns.push(`${dayStr}${friday ? ' (F)' : ''}`);
  }

  const tableHeader = [
    'SL',
    'EID',
    'Employee Name',
    'Designation',
    'Department',
    'Project',
    ...dateColumns,
    'Present (P)',
    'CL',
    'SL',
    'AL',
    'ML',
    'PL',
    'UL',
    'Absent (A)',
    'Weekly Off (WO)',
    'Holiday (PH)',
    'Official Duty (OD)',
    'WFH',
    'Half Day (HD)',
    'Working Days',
    'Total Leave'
  ];

  const dataRows: any[][] = [];

  filteredEmployees.forEach((emp, index) => {
    const empRecords: AttendanceRecord[] = [];
    const dayStatusValues: string[] = [];

    for (let d = 1; d <= totalDays; d++) {
      const dayStr = String(d).padStart(2, '0');
      const fullDate = `${year}-${String(month).padStart(2, '0')}-${dayStr}`;
      const rec = attendanceMap.get(`${emp.eid}_${fullDate}`);

      if (rec) {
        empRecords.push(rec);
        dayStatusValues.push(rec.status);
      } else {
        const friday = isFriday(fullDate);
        const isPH = holidays.some(h => h.date === fullDate);
        if (friday) {
          dayStatusValues.push('WO');
        } else if (isPH) {
          dayStatusValues.push('PH');
        } else {
          dayStatusValues.push('-'); // Missing or not recorded
        }
      }
    }

    const summary = calculateMonthlyAttendance(year, month, empRecords, holidays);

    dataRows.push([
      index + 1,
      emp.eid,
      emp.nameEn,
      emp.designation,
      emp.department,
      emp.project,
      ...dayStatusValues,
      summary.presentDays,
      summary.casualLeave,
      summary.sickLeave,
      summary.annualLeave,
      summary.maternityLeave,
      summary.paternityLeave,
      summary.unpaidLeave,
      summary.absentDays,
      summary.weeklyHolidays,
      summary.publicHolidays,
      summary.officialDuty,
      summary.workFromHome,
      summary.halfDays,
      summary.scheduledWorkingDays,
      summary.totalLeave
    ]);
  });

  const footerRows = [
    [],
    ['Notes: P=Present, CL=Casual Leave, SL=Sick Leave, AL=Annual Leave, ML=Maternity, PL=Paternity, UL=Unpaid Leave, A=Absent, WO=Weekly Off (Friday), PH=Public Holiday, OD=Official Duty, WFH=Work From Home, HD=Half Day'],
    [],
    ['Prepared By: ___________________', '', 'Verified By (HR): ___________________', '', 'Authorized Signature: ___________________']
  ];

  const fullSheetData = [...headerRows, tableHeader, ...dataRows, ...footerRows];
  const worksheet = XLSX.utils.aoa_to_sheet(fullSheetData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 5 },  // SL
    { wch: 12 }, // EID
    { wch: 25 }, // Name
    { wch: 22 }, // Designation
    { wch: 25 }, // Dept
    { wch: 20 }, // Project
    ...dateColumns.map(() => ({ wch: 5 })), // Dates
    { wch: 10 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 },
    { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `Register_${monthName}_${year}`);

  const fileName = `LEEDO_Attendance_Register_${year}_${String(month).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}

export function exportIndividualAttendanceExcel(
  employee: Employee,
  year: number,
  month: number,
  records: AttendanceRecord[],
  holidays: Holiday[]
) {
  const totalDays = getDaysInMonth(year, month);
  const summary = calculateMonthlyAttendance(year, month, records, holidays);
  const recordsMap = new Map(records.map(r => [r.date, r]));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[month - 1];

  const data: any[][] = [
    ['LOCAL EDUCATION AND ECONOMIC DEVELOPMENT ORGANIZATION (LEEDO)'],
    ['INDIVIDUAL EMPLOYEE MONTHLY ATTENDANCE STATEMENT'],
    [],
    ['Employee ID:', employee.eid, 'Designation:', employee.designation],
    ['Employee Name:', employee.nameEn, 'Department:', employee.department],
    ['Project:', employee.project, 'Month / Year:', `${monthName} ${year}`],
    [],
    ['Date', 'Day', 'Status Code', 'Status Description', 'Duty Description', 'Remarks', 'Verification Status'],
  ];

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (let d = 1; d <= totalDays; d++) {
    const dayStr = String(d).padStart(2, '0');
    const fullDate = `${year}-${String(month).padStart(2, '0')}-${dayStr}`;
    const dateObj = new Date(fullDate + 'T00:00:00');
    const dayName = dayNames[dateObj.getDay()];
    const rec = recordsMap.get(fullDate);

    data.push([
      fullDate,
      dayName,
      rec ? rec.status : (dateObj.getDay() === 5 ? 'WO' : '-'),
      rec ? rec.status : (dateObj.getDay() === 5 ? 'Weekly Off (Friday)' : 'Not Recorded'),
      rec?.dutyDescription || '',
      rec?.remarks || '',
      rec?.verificationStatus || (dateObj.getDay() === 5 ? 'System' : 'Pending')
    ]);
  }

  data.push([]);
  data.push(['SUMMARY OF ATTENDANCE']);
  data.push(['Total Calendar Days', totalDays, 'Total Working Days Scheduled', summary.scheduledWorkingDays]);
  data.push(['Present Days', summary.presentDays, 'Absent Days', summary.absentDays]);
  data.push(['Casual Leave (CL)', summary.casualLeave, 'Sick Leave (SL)', summary.sickLeave]);
  data.push(['Annual Leave (AL)', summary.annualLeave, 'Unpaid Leave (UL)', summary.unpaidLeave]);
  data.push(['Weekly Off (Fridays)', summary.weeklyHolidays, 'Public Holidays', summary.publicHolidays]);
  data.push(['Official Duty (OD)', summary.officialDuty, 'Work From Home (WFH)', summary.workFromHome]);
  data.push(['Missing Attendance', summary.missingAttendance, 'Total Leave Taken', summary.totalLeave]);
  data.push([]);
  data.push(['Employee Signature: ___________________', '', 'HR Officer Signature: ___________________']);

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [
    { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 30 }, { wch: 25 }, { wch: 18 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${employee.eid}_${monthName}`);
  XLSX.writeFile(wb, `LEEDO_Attendance_${employee.eid}_${year}_${String(month).padStart(2, '0')}.xlsx`);
}

export function exportLeaveUtilizationExcel(
  employees: Employee[],
  leaveRecords: any[],
  year: number
) {
  const data: any[][] = [
    ['LOCAL EDUCATION AND ECONOMIC DEVELOPMENT ORGANIZATION (LEEDO)'],
    [`ANNUAL LEAVE UTILIZATION REPORT - YEAR ${year}`],
    [],
    ['SL', 'EID', 'Employee Name', 'Department', 'Project', 'CL Used', 'SL Used', 'AL Used', 'Other Leave', 'Total Leave Days', 'Status']
  ];

  employees.forEach((emp, i) => {
    const empLeaves = leaveRecords.filter(l => l.eid === emp.eid && (l.status === 'Verified' || l.status === 'Unverified'));
    let cl = 0;
    let sl = 0;
    let al = 0;
    let other = 0;

    empLeaves.forEach(l => {
      if (l.leaveType === 'Casual Leave') cl += l.totalDays || 0;
      else if (l.leaveType === 'Sick Leave') sl += l.totalDays || 0;
      else if (l.leaveType === 'Annual Leave') al += l.totalDays || 0;
      else other += l.totalDays || 0;
    });

    data.push([
      i + 1,
      emp.eid,
      emp.nameEn,
      emp.department,
      emp.project,
      cl,
      sl,
      al,
      other,
      cl + sl + al + other,
      emp.status
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Leave_Utilization_${year}`);
  XLSX.writeFile(wb, `LEEDO_Leave_Utilization_${year}.xlsx`);
}
