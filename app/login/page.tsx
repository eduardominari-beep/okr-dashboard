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
            // debug opcional sem usar "any"
            console.log(
              "API KEY em runtime:",
              (auth.app.options as { apiKey?: string })?.apiKey
            );

            await signInWithPopup(auth, googleProvider);
            window.location.href = "/"; // volta pro dashboard
          } catch (e: unknown) {
            const err = e as Error & { code?: string; message?: string };
            alert(`Erro no popup: ${err.code || err.message}`);
            console.warn(err);
          }
        }}
        className="px-4 py-2 bg-black text-white rounded-2xl"
      >
        Entrar com Google (popup)
      </button>
    </main>
  );
}
