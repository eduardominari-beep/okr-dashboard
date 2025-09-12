"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth-provider";
import { getDoc, doc, getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";

type ClientData = {
  name: string;
  createdAt?: unknown;
  createdBy?: string;
  admins?: string[];
};
type Client = ClientData & { id: string };

export default function ClientsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        if (!user) {
          setClients([]);
          setLoading(false);
          return;
        }

        // Lê o doc do usuário para pegar clientAccess e superadmin
        const uref = doc(db, "users", user.uid);
        const usnap = await getDoc(uref);
        const udata = usnap.exists() ? (usnap.data() as any) : null;
        const isSuper = !!udata?.superadmin;
        const allowed: string[] = Array.isArray(udata?.clientAccess) ? udata.clientAccess : [];

        // Busca os clients
        const csnap = await getDocs(collection(db, "clients"));
        const all = csnap.docs.map((d) => ({ id: d.id, ...(d.data() as ClientData) }));

        // Se superadmin, mostra todos. Caso contrário, só os autorizados
        setClients(isSuper ? all : all.filter((c) => allowed.includes(c.id)));
      } catch (e: any) {
        setError(e?.message || "Falha ao carregar clientes");
      } finally {
        setLoading(false);
      }
    }
    load();
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
          <li key={c.id} className="rounded-lg border p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-zinc-500">{c.id}</div>
            </div>
            {/* Assim que criarmos a página de projetos do cliente, esse link pode apontar para /clients/[id] */}
            <Link
            href={`/clients/${c.id}`} className="rounded-md bg-black px-3 py-1.5 text-white">
            Entrar
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}