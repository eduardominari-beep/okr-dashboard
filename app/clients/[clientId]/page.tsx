"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { ClientData } from "@/lib/firestore";

export default function ClientHomePage() {
  const params = useParams<{ clientId: string }>();
  const clientId = params.clientId;

  const [client, setClient] = useState<(ClientData & { id: string }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const ref = doc(db, "clients", clientId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setClient({ id: snap.id, ...(snap.data() as ClientData) });
        } else {
          setError("Cliente não encontrado.");
        }
      } catch (e) {
        const err = e as { message?: string };
        setError(err?.message ?? "Falha ao carregar cliente.");
      }
    })();
  }, [clientId]);

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Cliente</h1>
      {error && <p className="text-red-600">{error}</p>}
      {!error && !client && <p>Carregando…</p>}
      {client && (
        <div className="rounded-lg border p-4">
          <p className="font-medium">{client.name}</p>
          <p className="text-xs text-zinc-500">{client.id}</p>
          <div className="mt-4 text-sm text-zinc-600">
            {/* Aqui depois listaremos os projetos do cliente */}
            Em breve: projetos deste cliente.
          </div>
        </div>
      )}
    </main>
  );
}