"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../auth-provider";
import {
  createClient,
  listClients,
  listUsers,
  upsertUserByEmail,
  grantClientAccess,
  type Client,
  type AppUser,
  type Role,
} from "@/lib/firestore";
import type { ChangeEvent } from "react";

export default function AdminPage() {
  const { user, isSuperadmin, logout } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  const [clientName, setClientName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [linkUserId, setLinkUserId] = useState<string>("");
  const [linkClientId, setLinkClientId] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      setClients(await listClients());
      setUsers(await listUsers());
    })();
  }, [user]);

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Você não está logado.</p>
      </main>
    );
  }
  if (!isSuperadmin) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-2">Acesso negado</h1>
          <p>Somente superadmin pode acessar o Console Admin.</p>
          <button onClick={logout} className="mt-4 px-4 py-2 rounded-2xl bg-zinc-800 text-white">
            Sair
          </button>
        </div>
      </main>
    );
  }

  async function handleCreateClient() {
    if (!clientName.trim() || !user?.uid) return;
    await createClient(clientName.trim(), user.uid);
    setClientName("");
    setClients(await listClients());
  }

  async function handleInviteUser() {
    if (!inviteEmail.trim()) return;
    await upsertUserByEmail(inviteEmail.trim().toLowerCase(), inviteRole);
    setInviteEmail("");
    setUsers(await listUsers());
  }

  async function handleGrantAccess() {
    if (!linkUserId || !linkClientId) return;
    await grantClientAccess(linkUserId, linkClientId);
    setUsers(await listUsers());
  }

  const onChangeClientName = (e: ChangeEvent<HTMLInputElement>) => setClientName(e.currentTarget.value);
  const onChangeInviteEmail = (e: ChangeEvent<HTMLInputElement>) => setInviteEmail(e.currentTarget.value);
  const onChangeInviteRole = (e: ChangeEvent<HTMLSelectElement>) => setInviteRole(e.currentTarget.value as Role);
  const onChangeLinkUserId = (e: ChangeEvent<HTMLSelectElement>) => setLinkUserId(e.currentTarget.value);
  const onChangeLinkClientId = (e: ChangeEvent<HTMLSelectElement>) => setLinkClientId(e.currentTarget.value);

  return (
    <main className="p-6 max-w-4xl mx-auto flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Console Admin</h1>
          <p className="text-sm text-zinc-500">OKR Management System — Powered by Straggia</p>
        </div>
        <div className="text-right">
          <p className="text-sm">{user.email}</p>
          <button onClick={logout} className="text-sm px-3 py-1 rounded-xl bg-zinc-800 text-white mt-1">
            Sair
          </button>
        </div>
      </header>

      <section className="p-4 rounded-2xl border">
        <h2 className="font-semibold mb-3">Criar cliente</h2>
        <div className="flex gap-2">
          <input
            value={clientName}
            onChange={onChangeClientName}
            placeholder="Nome do cliente"
            className="flex-1 px-3 py-2 rounded-xl border"
          />
          <button onClick={handleCreateClient} className="px-4 py-2 rounded-xl bg-black text-white">
            Adicionar
          </button>
        </div>
      </section>

      <section className="p-4 rounded-2xl border">
        <h2 className="font-semibold mb-3">Criar/Convidar usuário</h2>
        <div className="flex gap-2">
          <input
            value={inviteEmail}
            onChange={onChangeInviteEmail}
            placeholder="email@dominio.com"
            className="flex-1 px-3 py-2 rounded-xl border"
          />
          <select value={inviteRole} onChange={onChangeInviteRole} className="px-3 py-2 rounded-xl border">
            <option value="admin">admin</option>
            <option value="editor">editor</option>
            <option value="viewer">viewer</option>
          </select>
          <button onClick={handleInviteUser} className="px-4 py-2 rounded-xl bg-black text-white">
            Salvar
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          Cria um registro em <code>/users</code>. Quando a pessoa logar com esse e-mail, manteremos este registro.
        </p>
      </section>

      <section className="p-4 rounded-2xl border">
        <h2 className="font-semibold mb-3">Dar acesso de Cliente → Usuário</h2>
        <div className="flex gap-2">
          <select value={linkUserId} onChange={onChangeLinkUserId} className="px-3 py-2 rounded-xl border flex-1">
            <option value="">Selecione usuário…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.email} ({u.role})
              </option>
            ))}
          </select>

          <select value={linkClientId} onChange={onChangeLinkClientId} className="px-3 py-2 rounded-xl border flex-1">
            <option value="">Selecione cliente…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <button onClick={handleGrantAccess} className="px-4 py-2 rounded-xl bg-black text-white">
            Conceder
          </button>
        </div>
      </section>

      <section className="p-4 rounded-2xl border">
        <h2 className="font-semibold mb-3">Clientes</h2>
        <ul className="text-sm grid gap-2">
          {clients.map((c) => (
            <li key={c.id} className="rounded-lg border px-3 py-2 flex items-center justify-between">
              <span>{c.name}</span>
              <code className="text-xs text-zinc-500">{c.id}</code>
            </li>
          ))}
        </ul>
      </section>

      <section className="p-4 rounded-2xl border">
        <h2 className="font-semibold mb-3">Usuários</h2>
        <ul className="text-sm grid gap-2">
          {users.map((u) => (
            <li key={u.id} className="rounded-lg border px-3 py-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{u.email}</div>
                  <div className="text-xs text-zinc-500">role: {u.role}</div>
                </div>
                <code className="text-xs text-zinc-500">{u.id}</code>
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                clients: {u.clientAccess?.length ? u.clientAccess.join(", ") : "—"}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}