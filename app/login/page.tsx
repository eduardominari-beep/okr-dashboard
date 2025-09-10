"use client";

import { auth, googleProvider } from "@/lib/firebase";
import { signInWithPopup } from "firebase/auth";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Bem-vindo!</h1>
      <button
        onClick={async () => {
          try {
            // debug opcional
            console.log("API KEY em runtime:", (auth.app.options as any)?.apiKey);
            await signInWithPopup(auth, googleProvider);
            window.location.href = "/"; // volta pro dashboard
          } catch (e: any) {
            alert(`Erro no popup: ${e?.code || e?.message}`);
            console.warn(e);
          }
        }}
        className="px-4 py-2 bg-black text-white rounded-2xl"
      >
        Entrar com Google (popup)
      </button>
    </main>
  );
}