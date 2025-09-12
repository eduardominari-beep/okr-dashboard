"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth-provider";
import {
  createClient,
  grantClientAccess,
  listClients,
  listUsers,
  upsertUserByEmail,
  type AppUser,
  type Client,
  type Role,
} from "@/lib/firestore";

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900 ${props.className ?? ""}`}
    />
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 p-5">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export default function AdminPage() {
  const { user, isSuperadmin, logout } = useAuth();

  // ---- Hooks DEVEM vir antes de qualquer return condicional ----
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  const [newClientName, setNewClientName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("admin");

  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");

  const meEmail = user?.email ?? "";

  useEffect(() => {
    // roda sempre; se precisar do user, só checar dentro
    (async () => {
      const [c, u] = await Promise.all([listClients(), listUsers()]);
      setClients(c);
      setUsers(u);
    })();
  }, []);

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => a.email.localeCompare(b.email)),
    [users]
  );

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  // ---- Actions ----

 async function onCreateClient(e: FormEvent) {
  e.preventDefault();
  const name = newClientName.trim();
  if (!name) return;
  try {
    if (!user) throw new Error("Faça login");
    await createClient(name, user.uid);
    setNewClientName("");
    const c = await listClients();
    setClients(c);
    alert("Cliente criado!");
  } catch (err: any) {
    console.error("createClient error:", err);
    alert("Erro ao criar cliente: " + (err?.message || err));
  }
}

 async function onInviteUser(e: FormEvent) {
  e.preventDefault();
  const email = inviteEmail.trim().toLowerCase();
  if (!email) return;
  try {
    await upsertUserByEmail(email, inviteRole);
    setInviteEmail("");
    const u = await listUsers();
    setUsers(u);
    alert("Usuário registrado (pré-login).");
  } catch (err: any) {
    console.error("upsertUserByEmail error:", err);
    alert("Erro ao salvar usuário: " + (err?.message || err));
  }
}

async function onGrantAccess(e: FormEvent) {
  e.preventDefault();
  if (!selectedUserId || !selectedClientId) return;
  try {
    await grantClientAccess(selectedUserId, selectedClientId);
    setSelectedUserId("");
    setSelectedClientId("");
    const u = await listUsers();
    setUsers(u);
    alert("Acesso concedido!");
  } catch (err: any) {
    console.error("grantClientAccess error:", err);
    alert("Erro ao conceder acesso: " + (err?.message || err));
  }
}
  // ---- Render com checagem de acesso (depois dos hooks) ----
  if (!user || !isSuperadmin) {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold">Acesso negado</p>
        <p className="text-sm text-zinc-600">
          Somente superadmin pode acessar o Console Admin.
        </p>
        <button
          onClick={logout}
          className="mt-2 rounded-full bg-black px-4 py-2 text-white"
        >
          Sair
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Console Admin</h1>
          <p className="text-sm text-zinc-600">
            OKR Management System — Powered by Straggia
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600">{meEmail}</span>
          <button
            onClick={logout}
            className="rounded-full bg-black px-4 py-2 text-white"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Criar cliente */}
      <Section title="Criar cliente">
        <form onSubmit={onCreateClient} className="flex gap-3">
          <Input
            placeholder="Nome do cliente"
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
          />
          <button
            type="submit"
            className="whitespace-nowrap rounded-md bg-black px-4 py-2 text-white"
          >
            Adicionar
          </button>
        </form>
      </Section>

      {/* Criar / convidar usuário */}
      <Section title="Criar/Convidar usuário">
        <form onSubmit={onInviteUser} className="flex gap-3">
          <Input
            type="email"
            placeholder="email@dominio.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <select
            className="rounded-md border border-zinc-300 px-3 py-2"
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as Role)}
          >
            <option value="admin">admin</option>
            <option value="editor">editor</option>
            <option value="viewer">viewer</option>
          </select>
          <button
            type="submit"
            className="whitespace-nowrap rounded-md bg-black px-4 py-2 text-white"
          >
            Salvar
          </button>
        </form>
        <p className="mt-2 text-xs text-zinc-500">
          Cria um registro em <code>/users</code>. Quando a pessoa logar com esse
          e-mail, manteremos este registro.
        </p>
      </Section>

      {/* Conceder acesso cliente → usuário */}
      <Section title="Dar acesso de Cliente → Usuário">
        <form onSubmit={onGrantAccess} className="flex flex-col gap-3 md:flex-row">
          <select
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
          >
            <option value="">Selecione usuário…</option>
            {sortedUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email} ({u.role})
              </option>
            ))}
          </select>

          <select
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
          >
            <option value="">Selecione cliente…</option>
            {sortedClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button
            type="submit"
            className="whitespace-nowrap rounded-md bg-black px-4 py-2 text-white"
          >
            Conceder
          </button>
        </form>
      </Section>

      {/* Listas simples */}
      <Section title="Clientes">
        <ul className="list-disc space-y-1 pl-6">
          {sortedClients.map((c) => (
            <li key={c.id}>
              <span className="font-medium">{c.name}</span>{" "}
              <span className="text-xs text-zinc-500">({c.id})</span>
            </li>
          ))}
          {sortedClients.length === 0 && (
            <li className="list-none text-sm text-zinc-500">Nenhum cliente criado.</li>
          )}
        </ul>
      </Section>

      <Section title="Usuários">
        <ul className="list-disc space-y-1 pl-6">
          {sortedUsers.map((u) => (
            <li key={u.id}>
              <span className="font-medium">{u.email}</span>{" "}
              <span className="text-xs text-zinc-500">
                — {u.role} · {u.clientAccess?.length ?? 0} clientes
              </span>
            </li>
          ))}
          {sortedUsers.length === 0 && (
            <li className="list-none text-sm text-zinc-500">Nenhum usuário cadastrado.</li>
          )}
        </ul>
      </Section>
    </main>
  );
}