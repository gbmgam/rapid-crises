import React, { ReactNode, createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut, updateProfile, signInAnonymously, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, getDocs, deleteDoc, addDoc } from 'firebase/firestore';

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  notifyOnAlert: boolean;
}

export type UserRole = 'guest' | 'user' | 'responder' | 'admin' | 'superadmin' | 'observer';

interface AuthContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  login: (type?: 'google' | 'guest', email?: string, password?: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  responderLogin: (responderId: string, password: string) => Promise<void>;
  adminLogin: (email: string, password: string, totp?: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateRole: (role: UserRole) => Promise<void>;
  updateUserProfile: (displayName: string, photoURL: string) => Promise<void>;
  emergencyContacts: EmergencyContact[];
  addContact: (contact: Omit<EmergencyContact, 'id'>) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  updateContact: (id: string, contact: Partial<EmergencyContact>) => Promise<void>;
  convertToAccount: (email: string, password: string) => Promise<void>;
  inviteResponder: (data: { responderId: string; name: string; email: string; zone?: string }) => Promise<void>;
  logAuditAction: (action: string, details: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (u: User) => {
    try {
      const docRef = doc(db, 'users', u.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        // Force superadmin role for bootstrapped admin if not already set
        if (u.email === 'gbm3914@gmail.com' && data.role !== 'superadmin') {
           await updateDoc(docRef, { role: 'superadmin', updatedAt: serverTimestamp() });
           setProfile({ ...data, role: 'superadmin' });
        } else {
           setProfile(data);
        }
      } else {
        const isSuperAdmin = u.email === 'gbm3914@gmail.com';
        const newProfile = {
          uid: u.uid,
          anon_id: u.isAnonymous ? `GUEST_${u.uid.slice(0, 6)}` : `USER_${u.uid.slice(0, 6)}`.toUpperCase(),
          email: u.email,
          displayName: u.displayName || (u.isAnonymous ? 'Guest User' : 'New User'),
          role: isSuperAdmin ? 'superadmin' : (u.isAnonymous ? 'guest' : 'user'), 
          isAnonymous: u.isAnonymous,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(docRef, newProfile);
        setProfile(newProfile);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
    }
  };

  const fetchContacts = async (u: User) => {
    const path = 'user_emergency_contacts';
    try {
      const q = query(collection(db, path), where('user_id', '==', u.uid));
      const querySnapshot = await getDocs(q);
      const contacts: EmergencyContact[] = [];
      querySnapshot.forEach((doc) => {
        contacts.push({ id: doc.id, ...doc.data() } as EmergencyContact);
      });
      setEmergencyContacts(contacts);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  };

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await fetchProfile(u);
        await fetchContacts(u);
      } else {
        setProfile(null);
        setEmergencyContacts([]);
      }
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (type: 'google' | 'guest' = 'google', email?: string, password?: string) => {
    if (type === 'google') {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } else if (type === 'guest') {
      await signInAnonymously(auth);
    } else if (email && password) {
      await signInWithEmailAndPassword(auth, email, password);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName });
    // Profile creation handled by onAuthStateChanged -> fetchProfile
  }, []);

  const responderLogin = useCallback(async (responderId: string, password: string) => {
    const path = 'responders';
    try {
      const q = query(collection(db, path), where('responder_id', '==', responderId));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        throw new Error("Invalid Responder Identifier");
      }
      const responderDoc = querySnapshot.docs[0];
      const responderData = responderDoc.data();
      
      if (responderData.email) {
        await signInWithEmailAndPassword(auth, responderData.email, password);
      } else {
        throw new Error("Responder link failure. Contact Admin.");
      }
    } catch (err) {
      if (err instanceof Error && (err.message === "Invalid Responder Identifier" || err.message === "Responder link failure. Contact Admin.")) {
        throw err;
      }
      handleFirestoreError(err, OperationType.LIST, path);
    }
  }, []);

  const adminLogin = useCallback(async (email: string, password: string, totp?: string) => {
    // Basic auth
    await signInWithEmailAndPassword(auth, email, password);
    // MFA simulation
    if (totp !== '123456') { // Mock TOTP
       await signOut(auth);
       throw new Error("Invalid MFA Protocol Code");
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const updateRole = useCallback(async (role: UserRole) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), { role, updatedAt: serverTimestamp() });
      setProfile(prev => ({ ...prev, role }));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  }, [user]);

  const updateUserProfile = useCallback(async (displayName: string, photoURL: string) => {
    if (!user) return;
    try {
      await updateProfile(user, { displayName, photoURL });
      await updateDoc(doc(db, 'users', user.uid), { displayName, photoURL, updatedAt: serverTimestamp() });
      setProfile(prev => ({ ...prev, displayName, photoURL }));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  }, [user]);

  const addContact = useCallback(async (contact: Omit<EmergencyContact, 'id'>) => {
    if (!user) return;
    try {
      const docRef = doc(collection(db, 'user_emergency_contacts'));
      await setDoc(docRef, { ...contact, user_id: user.uid, createdAt: serverTimestamp() });
      setEmergencyContacts(prev => [...prev, { ...contact, id: docRef.id } as EmergencyContact]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'user_emergency_contacts');
    }
  }, [user]);

  const removeContact = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'user_emergency_contacts', id));
      setEmergencyContacts(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `user_emergency_contacts/${id}`);
    }
  }, []);

  const updateContact = useCallback(async (id: string, contact: Partial<EmergencyContact>) => {
    try {
      await updateDoc(doc(db, 'user_emergency_contacts', id), { ...contact, updatedAt: serverTimestamp() });
      setEmergencyContacts(prev => prev.map(c => c.id === id ? { ...c, ...contact } : c));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `user_emergency_contacts/${id}`);
    }
  }, []);

  const convertToAccount = useCallback(async (email: string, password: string) => {
    if (!user || !user.isAnonymous) return;
    
    // In Firebase, we can "link" an anonymous account to a credential
    // However, simplest parity for this spec is to register and migrate
    // We'll use the proper Firebase linking if possible
    try {
       // Mock flow for linking or converting guest -> registered
       // (Real Firebase linking code usually involves linkWithCredential)
       await register(email, password, profile.displayName);
    } catch (err) {
      console.error("Conversion failed", err);
      throw err;
    }
  }, [user, profile, register]);

  const inviteResponder = useCallback(async (data: { responderId: string; name: string; email: string; zone?: string }) => {
    if (!user) return;
    try {
      const responderRef = doc(collection(db, 'responders'));
      await setDoc(responderRef, {
        ...data,
        invitedBy: user.uid,
        status: 'invited',
        role: 'responder',
        createdAt: serverTimestamp()
      });
      
      // Simulate sending invite email/temp password
      console.log(`[SYS] Invitation sent to ${data.email}. Temp Credentials: ID: ${data.responderId} PWD: TEMP_${data.responderId}`);
    } catch (err) {
       handleFirestoreError(err, OperationType.WRITE, 'responders');
    }
  }, [user]);

  const logAuditAction = useCallback(async (action: string, details: any) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'audit_logs'), {
        userId: user.uid,
        userEmail: user.email,
        role: profile?.role,
        action,
        details,
        timestamp: serverTimestamp(),
        ip: 'PROXIED_SESSION_IP' // Simulated
      });
    } catch (err) {
      console.error("Audit logging failed", err);
    }
  }, [user, profile]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    login,
    register,
    responderLogin,
    adminLogin,
    resetPassword,
    logout,
    updateRole,
    updateUserProfile,
    emergencyContacts,
    addContact,
    removeContact,
    updateContact,
    convertToAccount,
    inviteResponder,
    logAuditAction
  }), [user, profile, loading, login, register, responderLogin, adminLogin, logout, updateRole, updateUserProfile, emergencyContacts, addContact, removeContact, updateContact, convertToAccount, inviteResponder, logAuditAction]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
