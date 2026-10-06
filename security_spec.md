# LEEDO HRMS Security Specification & Data Invariants

## 1. System Invariants
- **Identity Invariant**: An employee can only read their own profile, attendance, and leave records. Only HR Admin and Super Admin (`hr.leedo2000@gmail.com`) can read organization-wide data.
- **Uniqueness Invariant**: Each attendance document ID must follow the deterministic format `EID_YYYY-MM-DD` to structurally eliminate duplicate attendance records.
- **Lock Invariant**: When a month is locked in `/monthlyLocks/{month}`, regular employees are strictly forbidden from creating, updating, or deleting attendance or leave records for that month.
- **Verification Invariant**: Employees cannot self-verify attendance. Only HR Admins and Super Admins can alter `verificationStatus` to `Verified` or update `verifiedBy`.
- **Audit Invariant**: Audit log documents in `/auditLogs` are append-only. No user may mutate or delete existing audit entries.
- **Master Admin Bootstrapping**: `hr.leedo2000@gmail.com` is granted administrative access.

## 2. The "Dirty Dozen" Threat Payloads (Must be Denied)
1. **Payload 1 (Self-Elevation)**: An Employee attempts to update their own role from `EMPLOYEE` to `SUPER ADMIN`.
2. **Payload 2 (Cross-Employee Attendance Snooping)**: Employee `EMP-1002` queries `attendance` with `where('eid', '==', 'EMP-1001')`.
3. **Payload 3 (Self-Verification)**: Employee submits daily attendance with `verificationStatus: "Verified"`.
4. **Payload 4 (Post-Lock Tampering)**: Employee attempts to submit attendance for `2026-08-15` when `monthlyLocks/2026-08` has `isLocked: true`.
5. **Payload 5 (Audit Trail Deletion)**: Any user attempts `deleteDoc(doc(db, 'auditLogs', 'log-123'))`.
6. **Payload 6 (Shadow Field Injection)**: Employee creates an attendance record containing hidden field `__isAdmin: true`.
7. **Payload 7 (Oversized Payload / Denial-of-Wallet)**: Submitting duty description exceeding string boundary (>500 chars).
8. **Payload 8 (Future Resignation Spoofing)**: Employee alters another user's `status` to `Terminated`.
9. **Payload 9 (Orphan Attendance)**: Creating an attendance record for a nonexistent or invalid EID format.
10. **Payload 10 (Leave Balance Forgery)**: Employee directly updates verified leave days without HR audit.
11. **Payload 11 (Unauthenticated Write)**: Direct unauthenticated REST mutation without token.
12. **Payload 12 (Archive Record Overwrite)**: Non-admin overwriting an uploaded physical register record.
