"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-provider";
import { getDoc, doc, getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppUserData, ClientData } from "@/lib/firestore";

type Client = ClientData & { id: string };

export default function ClientsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        if (!user) {
          setClients([]);
          setLoading(false);
          return;
        }

        const uref = doc(db, "users", user.uid);
        const usnap = await getDoc(uref);
        const udata: AppUserData | undefined = usnap.exists() ? (usnap.data() as AppUserData) : undefined;

        const isSuper = Boolean(udata?.superadmin);
        const allowedIds = Array.isArray(udata?.clientAccess) ? udata!.clientAccess : [];

        const csnap = await getDocs(collection(db, "clients"));
        const all = csnap.docs.map((d) => ({ id: d.id, ...(d.data() as ClientData) }));

        setClients(isSuper ? all : all.filter((c) => allowedIds.includes(c.id)));
      } catch (e) {
        const err = e as { message?: string };
        setError(err?.message ?? "Falha ao carregar clientes");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <p>Faça login para ver seus clientes.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl p-6 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <span className="text-sm text-zinc-600">{user.email}</span>
      </header>

      {loading && <p>Carregando…</p>}
      {error && <p className="text-red-600">{error}</p>}

      {!loading && clients.length === 0 && (
        <p className="text-sm text-zinc-500">Nenhum cliente disponível para você.</p>
      )}

      <ul className="space-y-2">
        {clients.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-zinc-500">{c.id}</div>
            </div>
            <Link
              href={`/clients/${c.id}`}
              className="rounded-md bg-black px-3 py-1.5 text-white"
            >
              Entrar
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}