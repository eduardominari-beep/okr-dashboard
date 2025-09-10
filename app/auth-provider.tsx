"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, googleProvider } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  User,
} from "firebase/auth";

type Ctx = {
  user: User | null;
  isSuperadmin: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx>({
  user: null,
  isSuperadmin: false,
  loginWithGoogle: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);

    // Se o login caiu em redirect, finaliza aqui sem quebrar a página
    getRedirectResult(auth).catch((e) => {
      if (e) console.warn("Firebase getRedirectResult error:", e?.code, e?.message);
    });

    return () => unsub();
  }, []);

  const superadmins = useMemo(
    () =>
      (process.env.NEXT_PUBLIC_SUPERADMINS || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    []
  );

  const isSuperadmin = !!(user?.email && superadmins.includes(user.email.toLowerCase()));

  async function loginWithGoogle() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.warn("Firebase popup sign-in error:", e?.code, e?.message);

      // Fallback quando popup é bloqueado ou domínio não está autorizado
      if (
        e?.code === "auth/popup-blocked" ||
        e?.code === "auth/popup-closed-by-user" ||
        e?.code === "auth/unauthorized-domain"
      ) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      alert("Falha no login: " + (e?.message || e?.code || "erro desconhecido"));
    }
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthCtx.Provider value={{ user, isSuperadmin, loginWithGoogle, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);