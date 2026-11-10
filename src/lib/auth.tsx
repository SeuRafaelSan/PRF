import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut as fbSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from './firebase';

interface AuthContextType {
  user: User | null;
  userId: string;
  loading: boolean;
  getIdToken: () => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userId: '',
  loading: true,
  getIdToken: async () => null,
  signInWithGoogle: async () => {},
  logout: async () => {}
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Process redirect result if user authenticated via redirect
    getRedirectResult(auth).catch((err) => {
      console.warn("[Auth] Redirect result notification:", err?.message || err);
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getIdToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    try {
      return await auth.currentUser.getIdToken();
    } catch (err) {
      console.error("[Auth] Error getting ID token:", err);
      return null;
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      // If popup was blocked or failed due to environment restrictions, fall back to redirect
      if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/cancelled-popup-request') {
        console.warn("[Auth] Popup blocked or interrupted, attempting redirect login...");
        await signInWithRedirect(auth, provider);
      } else {
        throw err;
      }
    }
  };

  const logout = async () => {
    await fbSignOut(auth);
  };

  const userId = user ? user.uid : '';

  return (
    <AuthContext.Provider value={{
      user,
      userId,
      loading,
      getIdToken,
      signInWithGoogle,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Returns the authenticated user's real UID provided by Firebase Authentication.
 */
export function useUserId(): string {
  const { userId } = useAuth();
  return userId;
}

export async function getCurrentIdToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken();
  } catch (err) {
    console.error("[Auth] Error getting ID token:", err);
    return null;
  }
}
