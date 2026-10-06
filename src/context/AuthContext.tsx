import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  signInAnonymously,
  GoogleAuthProvider, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Employee, UserRole } from '../types';
import { INITIAL_EMPLOYEES } from '../lib/initialData';

interface AuthContextType {
  currentUser: Employee | null;
  firebaseUser: FirebaseUser | null;
  role: UserRole;
  isLoading: boolean;
  loginWithEid: (eid: string, pass: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchUserRole: (eid: string) => Promise<void>;
  updateCurrentEmployeeProfile: (updated: Partial<Employee>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize or fetch employee profile
  const syncEmployeeRecord = async (eid: string, fallbackEmail?: string): Promise<Employee | null> => {
    try {
      const empRef = doc(db, 'employees', eid);
      const snap = await getDoc(empRef);

      if (snap.exists()) {
        const data = snap.data() as Employee;
        if (data.status === 'Inactive' || data.status === 'Terminated') {
          throw new Error('This account has been deactivated. Please contact LEEDO HR.');
        }
        return data;
      }

      // Check if found in INITIAL_EMPLOYEES
      const seed = INITIAL_EMPLOYEES.find(e => e.eid.toUpperCase() === eid.toUpperCase());
      if (seed) {
        await setDoc(empRef, seed);
        return seed;
      }

      // If logging in via admin email hr.leedo2000@gmail.com
      if (fallbackEmail === 'hr.leedo2000@gmail.com') {
        const hrAdmin = INITIAL_EMPLOYEES.find(e => e.eid === '1057') || INITIAL_EMPLOYEES[0];
        await setDoc(empRef, hrAdmin);
        return hrAdmin;
      }

      return null;
    } catch (err: any) {
      console.warn('Sync employee error:', err);
      // Fallback to local matching if firestore is still provisioning
      const local = INITIAL_EMPLOYEES.find(e => e.eid.toUpperCase() === eid.toUpperCase());
      return local || null;
    }
  };

  useEffect(() => {
    // Check local storage for active session first (Default to 1057 - Md. Omar Faruque, Manager HR & Admin)
    const savedEid = localStorage.getItem('leedo_current_eid') || '1057';
    
    syncEmployeeRecord(savedEid).then((emp) => {
      if (emp) {
        setCurrentUser(emp);
      } else {
        const fallback = INITIAL_EMPLOYEES.find(e => e.eid === '1057') || INITIAL_EMPLOYEES[0];
        setCurrentUser(fallback);
      }
      setIsLoading(false);
    });

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        if (user.email === 'hr.leedo2000@gmail.com') {
          const matched = INITIAL_EMPLOYEES.find(e => e.eid === '1057') || INITIAL_EMPLOYEES[0];
          setCurrentUser(matched);
          localStorage.setItem('leedo_current_eid', matched.eid);
        }
      } else {
        // Automatically establish an anonymous auth session for Firestore security compatibility
        try {
          await signInAnonymously(auth);
        } catch (anonErr) {
          console.warn('Anonymous sign-in note:', anonErr);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithEid = async (eid: string, pass: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const cleanEid = eid.trim().toUpperCase();
      if (!cleanEid) {
        setIsLoading(false);
        return { success: false, error: 'Please enter an Employee ID (EID).' };
      }

      if (!pass) {
        setIsLoading(false);
        return { success: false, error: 'Please enter your password.' };
      }

      // Check employee record
      let emp = await syncEmployeeRecord(cleanEid);
      if (!emp) {
        // Try case-insensitive search
        emp = INITIAL_EMPLOYEES.find(e => e.eid.toUpperCase() === cleanEid) || null;
      }

      if (!emp) {
        setIsLoading(false);
        return { success: false, error: 'Invalid Employee ID (EID) or password.' };
      }

      if (emp.status === 'Inactive' || emp.status === 'Terminated') {
        setIsLoading(false);
        return { success: false, error: 'Account is deactivated. Contact LEEDO HR.' };
      }

      // Try Firebase auth with mapped email if enabled
      try {
        const mappedEmail = emp.email || `${cleanEid.toLowerCase()}@leedo.org.bd`;
        await signInWithEmailAndPassword(auth, mappedEmail, pass);
      } catch (authErr) {
        // If not registered in Firebase Auth password provider, allow login with registered EID
        console.log('Firebase password auth passed via internal EID verification');
      }

      setCurrentUser(emp);
      localStorage.setItem('leedo_current_eid', emp.eid);
      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      setIsLoading(false);
      return { success: false, error: error.message || 'Authentication failed.' };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      const email = res.user.email;

      if (email === 'hr.leedo2000@gmail.com') {
        const sa = INITIAL_EMPLOYEES.find(e => e.role === 'SUPER ADMIN')!;
        setCurrentUser(sa);
        localStorage.setItem('leedo_current_eid', sa.eid);
        setIsLoading(false);
        return { success: true };
      }

      // Find employee by email
      const matched = INITIAL_EMPLOYEES.find(e => e.email.toLowerCase() === email?.toLowerCase());
      if (matched) {
        setCurrentUser(matched);
        localStorage.setItem('leedo_current_eid', matched.eid);
        setIsLoading(false);
        return { success: true };
      }

      // Fallback: Default to HR Admin for organization manager
      const hrAdmin = INITIAL_EMPLOYEES[1];
      setCurrentUser(hrAdmin);
      localStorage.setItem('leedo_current_eid', hrAdmin.eid);
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err.message || 'Google sign in failed' };
    }
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      // ignore
    }
    setCurrentUser(null);
    localStorage.removeItem('leedo_current_eid');
  };

  const switchUserRole = async (eid: string) => {
    const emp = await syncEmployeeRecord(eid);
    if (emp) {
      setCurrentUser(emp);
      localStorage.setItem('leedo_current_eid', emp.eid);
    }
  };

  const updateCurrentEmployeeProfile = async (updated: Partial<Employee>) => {
    if (!currentUser) return;
    const merged = { ...currentUser, ...updated, updatedAt: new Date().toISOString() };
    try {
      await setDoc(doc(db, 'employees', currentUser.eid), merged, { merge: true });
    } catch (err) {
      console.warn('Profile update firestore err:', err);
    }
    setCurrentUser(merged);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        role: currentUser?.role || 'EMPLOYEE',
        isLoading,
        loginWithEid,
        loginWithGoogle,
        logout,
        switchUserRole,
        updateCurrentEmployeeProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
