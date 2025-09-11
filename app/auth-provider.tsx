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
import { ensureUserDoc } from "@/lib/firestore";

/** ----------------------------------------------------------------
 *  SUPERADMINS – lido no build (client-safe porque é NEXT_PUBLIC_*)
 * ----------------------------------------------------------------*/
const SUPERADMINS_RAW = process.env.NEXT_PUBLIC_SUPERADMINS ?? "";
const SUPERADMINS: string[] = SUPERADMINS_RAW
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

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

  // --- DEBUG INICIAL (uma vez por carregamento) ---
  useEffect(() => {
    // ajuda a verificar se a env chegou ao client bundle
    // (vai aparecer no console do browser)
    console.log("[AUTH] NEXT_PUBLIC_SUPERADMINS (raw):", SUPERADMINS_RAW);
    console.log("[AUTH] NEXT_PUBLIC_SUPERADMINS (parsed):", SUPERADMINS);
    if (SUPERADMINS.length === 0) {
      console.warn(
        "[AUTH] SUPERADMINS vazio. Confira no Vercel: Project → Settings → Environment Variables. " +
          "Ex.: NEXT_PUBLIC_SUPERADMINS=eduardo.minari@gmail.com"
      );
    }
  }, []);

  // Observa sessão
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      console.log("[AUTH] onAuthStateChanged ->", u?.email ?? "anon");
      if (u?.uid && u.email) {
        try {
          await ensureUserDoc(u.uid, u.email);
        } catch (err) {
          console.warn("[AUTH] ensureUserDoc falhou:", err);
        }
      }
    });

    // Finaliza possíveis redirects
    getRedirectResult(auth).catch((e) => {
      const err = e as { code?: string; message?: string };
      if (err?.code) {
        console.warn("[AUTH] getRedirectResult:", err.code, err.message);
      }
    });

    return () => unsub();
  }, []);

  // Calcula superadmin
  const isSuperadmin = useMemo(() => {
    const email = user?.email?.toLowerCase() ?? "";
    const flag = email ? SUPERADMINS.includes(email) : false;
    // DEBUG por render para confirmar a avaliação
    console.log("[AUTH] isSuperadmin?", { email, SUPERADMINS, flag });
    return flag;
  }, [user?.email]);

  async function loginWithGoogle() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      const err = e as { code?: string; message?: string };
      console.warn("[AUTH] popup sign-in error:", err?.code, err?.message);

      // Fallback para cenários comuns
      if (
        err?.code === "auth/popup-blocked" ||
        err?.code === "auth/popup-closed-by-user" ||
        err?.code === "auth/unauthorized-domain"
      ) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      alert("Falha no login: " + (err?.message || err?.code || "erro desconhecido"));
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