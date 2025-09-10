"use client";

import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">OKR Management System</h1>
        <p className="text-sm text-zinc-500">Powered by Straggia</p>
      </div>

      <button
        onClick={async () => {
          try {
            await signInWithPopup(auth, googleProvider);
            window.location.href = "/";
          } catch (e: unknown) {
            const err = e as Error & { code?: string; message?: string };
            alert(`Erro no login: ${err.code || err.message}`);
            console.warn(err);
          }
        }}
        className="px-5 py-2.5 bg-black text-white rounded-2xl shadow hover:opacity-90"
      >
        Entrar com Google
      </button>
    </main>
  );
}