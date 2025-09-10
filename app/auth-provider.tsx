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
    getRedirectResult(auth).catch((e: unknown) => {
      const err = e as Error & { code?: string; message?: string };
      if (err) {
        console.warn(
          "Firebase getRedirectResult error:",
          err.code || "sem-code",
          err.message
        );
      }
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

  const isSuperadmin = !!(
    user?.email && superadmins.includes(user.email.toLowerCase())
  );

  async function loginWithGoogle() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: unknown) {
      const err = e as Error & { code?: string; message?: string };
      console.warn(
        "Firebase popup sign-in error:",
        err.code || "sem-code",
        err.message
      );

      // Fallback quando popup é bloqueado ou domínio não está autorizado
      if (
        err.code === "auth/popup-blocked" ||
        err.code === "auth/popup-closed-by-user" ||
        err.code === "auth/unauthorized-domain"
      ) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      alert(
        "Falha no login: " +
          (err.message || err.code || "erro desconhecido")
      );
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