import { Employee } from '../types';

/**
 * Checks if a user has permission to access the Attendance Verification view.
 * Permitted users:
 * - HR Admin & Super Admin
 * - Kanta (EID 1002 - Director Admin & Finance)
 * - Md. Sohel Rana (EID 1013 - Manager Program & Operation)
 * - Farhana Akter (EID 1075 - Program Coordinator)
 * - Any employee assigned as a reporting supervisor to other employees
 */
export const canUserVerifyAttendance = (user: Employee | null, allEmployees: Employee[] = []): boolean => {
  if (!user) return false;
  if (user.role === 'HR ADMIN' || user.role === 'SUPER ADMIN') return true;

  const eid = (user.eid || '').trim();
  const name = (user.nameEn || '').toLowerCase();

  // Specifically designated management IDs/names:
  if (
    eid === '1002' || eid === '1013' || eid === '1075' ||
    name.includes('kanta') || name.includes('sohel rana') || name.includes('farhana')
  ) {
    return true;
  }

  // Any employee currently assigned as supervisor for at least one staff member
  return allEmployees.some(emp => 
    emp.eid !== user.eid && (
      emp.supervisorEid === user.eid || 
      (emp.reportingSupervisor && emp.reportingSupervisor.toLowerCase().includes(user.nameEn.toLowerCase()))
    )
  );
};

/**
 * Checks whether an attendance record belongs to an employee under the current user's supervision
 */
export const isSupervisedBy = (empEid: string, supervisor: Employee | null, allEmployees: Employee[] = []): boolean => {
  if (!supervisor) return false;
  if (supervisor.role === 'HR ADMIN' || supervisor.role === 'SUPER ADMIN') return true;

  const targetEmp = allEmployees.find(e => e.eid === empEid);
  if (!targetEmp) return false;

  // Match supervisor EID or Name
  if (targetEmp.supervisorEid && targetEmp.supervisorEid === supervisor.eid) return true;
  if (targetEmp.reportingSupervisor && targetEmp.reportingSupervisor.toLowerCase().includes(supervisor.nameEn.toLowerCase())) return true;

  // Kanta, Farhana, Sohel Rana have broad managerial verification over program / finance / admin staff:
  const supEid = (supervisor.eid || '').trim();
  const supName = (supervisor.nameEn || '').toLowerCase();
  if (supEid === '1002' || supName.includes('kanta')) {
    // Admin & Finance staff or any staff assigned to her
    return true;
  }
  if (supEid === '1013' || supName.includes('sohel rana')) {
    // Program & Operation staff or any staff assigned to him
    return true;
  }
  if (supEid === '1075' || supName.includes('farhana')) {
    // Program staff or any staff assigned to her
    return true;
  }

  return false;
};
