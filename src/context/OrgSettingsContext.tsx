import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db, sanitizeForFirestore } from '../lib/firebase';
import { useAuth } from './AuthContext';

const DEFAULT_LOGO = '/leedo-logo.svg';

interface OrgSettingsContextType {
  logoUrl: string;
  updateLogo: (newLogo: string) => Promise<{ success: boolean; error?: string }>;
  resetLogo: () => Promise<void>;
  isLoadingLogo: boolean;
}

const OrgSettingsContext = createContext<OrgSettingsContextType | undefined>(undefined);

export const OrgSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('leedo_org_logo') || DEFAULT_LOGO;
    } catch {
      return DEFAULT_LOGO;
    }
  });
  const [isLoadingLogo, setIsLoadingLogo] = useState(false);

  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'organization');

    // Attach real-time snapshot listener
    const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data?.logoUrl && typeof data.logoUrl === 'string') {
          setLogoUrl(data.logoUrl);
          try {
            localStorage.setItem('leedo_org_logo', data.logoUrl);
          } catch {
            // ignore
          }
        }
      }
    }, (err) => {
      console.warn('Org settings snapshot listener note:', err);
    });

    return () => unsubscribe();
  }, []);

  const updateLogo = async (newLogo: string): Promise<{ success: boolean; error?: string }> => {
    if (!newLogo || !newLogo.trim()) {
      return { success: false, error: 'Please provide a valid image URL or upload an image file.' };
    }

    setIsLoadingLogo(true);
    const settingsRef = doc(db, 'settings', 'organization');
    const payload = {
      logoUrl: newLogo.trim(),
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser ? `${currentUser.nameEn} (${currentUser.eid})` : 'HR Admin'
    };

    try {
      await setDoc(settingsRef, sanitizeForFirestore(payload), { merge: true });
      setLogoUrl(newLogo.trim());
      try {
        localStorage.setItem('leedo_org_logo', newLogo.trim());
      } catch {
        // ignore
      }
      setIsLoadingLogo(false);
      return { success: true };
    } catch (err: any) {
      setIsLoadingLogo(false);
      console.error('Failed to save logo to Firestore:', err);
      // Still update locally for user convenience
      setLogoUrl(newLogo.trim());
      try {
        localStorage.setItem('leedo_org_logo', newLogo.trim());
      } catch {
        // ignore
      }
      return { success: false, error: err.message || 'Failed to sync to cloud database' };
    }
  };

  const resetLogo = async (): Promise<void> => {
    setIsLoadingLogo(true);
    const settingsRef = doc(db, 'settings', 'organization');
    const payload = {
      logoUrl: DEFAULT_LOGO,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser ? `${currentUser.nameEn} (${currentUser.eid})` : 'HR Admin'
    };

    try {
      await setDoc(settingsRef, sanitizeForFirestore(payload), { merge: true });
    } catch (err) {
      console.warn('Failed to reset logo in Firestore:', err);
    }
    setLogoUrl(DEFAULT_LOGO);
    try {
      localStorage.removeItem('leedo_org_logo');
    } catch {
      // ignore
    }
    setIsLoadingLogo(false);
  };

  return (
    <OrgSettingsContext.Provider value={{ logoUrl, updateLogo, resetLogo, isLoadingLogo }}>
      {children}
    </OrgSettingsContext.Provider>
  );
};

export const useOrgSettings = (): OrgSettingsContextType => {
  const context = useContext(OrgSettingsContext);
  if (!context) {
    throw new Error('useOrgSettings must be used within an OrgSettingsProvider');
  }
  return context;
};

/**
 * Utility to resize & compress image files uploaded by user into clean base64 data URLs
 */
export const compressImageFile = (file: File, maxWidth = 360, maxHeight = 360): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Export high quality PNG with transparency support
          resolve(canvas.toDataURL('image/png', 0.95));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image file.'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
};
