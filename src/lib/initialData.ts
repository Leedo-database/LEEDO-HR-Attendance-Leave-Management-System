import { Employee, Holiday, AttendanceRecord, LeaveRecord, MonthlyLock } from '../types';
import { LEEDO_ALL_EMPLOYEES } from './employeeDatabase';

export const INITIAL_DEPARTMENTS = [
  'Admin & Finance',
  'Program & Operation',
  'Grants Acquisition',
  'Executive Management'
];

export const INITIAL_PROJECTS = [
  'Head Office',
  'Peace Home',
  'Shelter (Kamalapur)',
  'Shelter (Kodomtoli)',
  'School Under the Sky (Mirpur)',
  'School Under the Sky (Tejgaon)',
  'School Under the Sky (RayerBazar)',
  'School Under the Sky (Airport)',
  'Inclusive School',
  'Vocational Trade School'
];

export const INITIAL_DESIGNATIONS = [
  'Founder & ED',
  'Director - Admin & Finance',
  'Manager HR & Admin',
  'Accountant',
  'Monitoring Officer',
  'Program Coordinator',
  'Special Educator',
  'Street Educator',
  'Social Mobilizer',
  'Mother',
  'Cook',
  'Teacher',
  'Football Coach',
  'Cricket Coach',
  'Music Teacher',
  'Psycho-social Facilitator',
  'Security Guard'
];

export const INITIAL_HOLIDAYS_2026: Holiday[] = [
  { id: '2026-02-21', date: '2026-02-21', nameEn: 'International Mother Language Day', nameBn: 'আন্তর্জাতিক মাতৃভাষা দিবস', type: 'Public Holiday', year: '2026' },
  { id: '2026-03-26', date: '2026-03-26', nameEn: 'Independence & National Day', nameBn: 'স্বাধীনতা ও জাতীয় দিবস', type: 'Public Holiday', year: '2026' },
  { id: '2026-03-20', date: '2026-03-20', nameEn: 'Eid-ul-Fitr (Estimated)', nameBn: 'ঈদুল ফিতর', type: 'Public Holiday', year: '2026' },
  { id: '2026-03-21', date: '2026-03-21', nameEn: 'Eid-ul-Fitr Holiday', nameBn: 'ঈদুল ফিতর ছুটি', type: 'Public Holiday', year: '2026' },
  { id: '2026-04-14', date: '2026-04-14', nameEn: 'Bengali New Year (Pohela Boishakh)', nameBn: 'পহেলা বৈশাখ', type: 'Public Holiday', year: '2026' },
  { id: '2026-05-01', date: '2026-05-01', nameEn: 'May Day (Labour Day)', nameBn: 'মে দিবস', type: 'Public Holiday', year: '2026' },
  { id: '2026-05-27', date: '2026-05-27', nameEn: 'Eid-ul-Azha (Estimated)', nameBn: 'ঈদুল আজহা', type: 'Public Holiday', year: '2026' },
  { id: '2026-05-28', date: '2026-05-28', nameEn: 'Eid-ul-Azha Holiday', nameBn: 'ঈদুল আজহা ছুটি', type: 'Public Holiday', year: '2026' },
  { id: '2026-08-15', date: '2026-08-15', nameEn: 'National Mourning Day', nameBn: 'জাতীয় শোক দিবস', type: 'Public Holiday', year: '2026' },
  { id: '2026-10-20', date: '2026-10-20', nameEn: 'Durga Puja (Bijaya Dashami)', nameBn: 'দূর্গাপূজা (বিজয়া দশমী)', type: 'Public Holiday', year: '2026' },
  { id: '2026-12-16', date: '2026-12-16', nameEn: 'Victory Day', nameBn: 'বিজয় দিবস', type: 'Public Holiday', year: '2026' },
  { id: '2026-12-25', date: '2026-12-25', nameEn: 'Christmas Day', nameBn: 'বড়দিন', type: 'Public Holiday', year: '2026' }
];

export const INITIAL_EMPLOYEES: Employee[] = LEEDO_ALL_EMPLOYEES;

export const INITIAL_LEAVE_RECORDS: LeaveRecord[] = [
  {
    id: 'leave_001',
    eid: '1004',
    employeeName: 'Md. Habibur Rahman',
    leaveType: 'Casual Leave',
    startDate: '2026-09-08',
    endDate: '2026-09-09',
    totalDays: 2,
    reason: 'Family emergency at village home',
    status: 'Verified',
    verifiedBy: 'Md. Omar Faruque (HR)',
    verifiedAt: '2026-09-10 11:30',
    remarks: 'Approved as per LEEDO Casual Leave entitlement',
    createdAt: '2026-09-07T10:00:00.000Z'
  },
  {
    id: 'leave_002',
    eid: '1007',
    employeeName: 'Athui Marma',
    leaveType: 'Sick Leave',
    startDate: '2026-09-14',
    endDate: '2026-09-15',
    totalDays: 2,
    reason: 'Viral fever and doctor consultation',
    supportingDocument: 'medical_prescription.pdf',
    status: 'Verified',
    verifiedBy: 'Md. Omar Faruque (HR)',
    verifiedAt: '2026-09-16 10:15',
    remarks: 'Medical prescription attached & verified',
    createdAt: '2026-09-14T08:30:00.000Z'
  },
  {
    id: 'leave_003',
    eid: '1017',
    employeeName: 'Nargis Akhter',
    leaveType: 'Casual Leave',
    startDate: '2026-10-04',
    endDate: '2026-10-05',
    totalDays: 2,
    reason: 'Personal urgent work in Dhaka',
    status: 'Unverified',
    createdAt: '2026-10-02T14:20:00.000Z'
  }
];
