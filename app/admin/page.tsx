"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  addDoc, setDoc, doc, getDocs, collection, query, where,
} from "firebase/firestore";
import { useAuth } from "../auth-provider";

type Role = "admin" | "editor" | "viewer";

export default function AdminPage() {
  const { user, logout } = useAuth();

  // inputs
  const [clientName, setClientName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<Role>("admin");

  // listas
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string; role?: Role }[]>([]);

  const [selectedUserEmail, setSelectedUserEmail] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");

  // carregar listas
  useEffect(() => {
    (async () => {
      const cs = await getDocs(collection(db, "clients"));
      setClients(cs.docs.map(d => ({ id: d.id, ...(d.data() as any) })));

      const us = await getDocs(collection(db, "users"));
      setUsers(us.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    })();
  }, []);

  async function handleCreateClient() {
    if (!clientName.trim()) return;
    await addDoc(collection(db, "clients"), {
      name: clientName.trim(),
      createdAt: Date.now(),
      createdBy: user?.email || "unknown",
    });
    setClientName("");
    // refresh
    const cs = await getDocs(collection(db, "clients"));
    setClients(cs.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  }

  async function handleCreateUser() {
    const email = newUserEmail.trim().toLowerCase();
    if (!email) return;
    // cria/atualiza o doc do user (convite simples)
    await setDoc(doc(db, "users", email), {
      email,
      defaultRole: newUserRole,
      createdAt: Date.now(),
    }, { merge: true });
    setNewUserEmail("");
    // refresh
    const us = await getDocs(collection(db, "users"));
    setUsers(us.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  }

  async function handleGrantAccess() {
    if (!selectedUserEmail || !selectedClientId) return;
    const email = selectedUserEmail.toLowerCase();
    const memId = `${email}_${selectedClientId}`;
    await setDoc(doc(db, "memberships", memId), {
      userEmail: email,
      clientId: selectedClientId,
      role: "admin", // ou escolha via UI
      createdAt: Date.now(),
    }, { merge: true });
    alert("Acesso concedido!");
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-10">
      <header className="flex justify-between">
        <div>
          <h1 className="text-2xl font-bold">Console Admin</h1>
          <p className="text-sm text-zinc-500">OKR Management System — Powered by Straggia</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm">{user?.email}</span>
          <button onClick={logout} className="px-3 py-1 rounded-full bg-zinc-800 text-white">Sair</button>
        </div>
      </header>

      {/* Criar cliente */}
      <section className="rounded-2xl border p-4 space-y-3">
        <h2 className="font-semibold">Criar cliente</h2>
        <div className="flex gap-3">
          <input
            className="flex-1 rounded-xl border px-3 py-2"
            placeholder="Nome do cliente"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
          />
          <button onClick={handleCreateClient} className="px-4 py-2 rounded-xl bg-black text-white">
            Adicionar
          </button>
        </div>
      </section>

      {/* Criar/Convidar usuário */}
      <section className="rounded-2xl border p-4 space-y-3">
        <h2 className="font-semibold">Criar/Convidar usuário</h2>
        <div className="flex gap-3">
          <input
            className="flex-1 rounded-xl border px-3 py-2"
            placeholder="email@dominio.com"
            value={newUserEmail}
            onChange={e => setNewUserEmail(e.target.value)}
          />
          <select
            className="rounded-xl border px-3 py-2"
            value={newUserRole}
            onChange={e => setNewUserRole(e.target.value as Role)}
          >
            <option value="admin">admin</option>
            <option value="editor">editor</option>
            <option value="viewer">viewer</option>
          </select>
          <button onClick={handleCreateUser} className="px-4 py-2 rounded-xl bg-black text-white">
            Salvar
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          Cria/atualiza um registro em <code>/users</code>. Quando a pessoa logar com esse e-mail, o registro será usado.
        </p>
      </section>

      {/* Dar acesso de cliente a usuário */}
      <section className="rounded-2xl border p-4 space-y-3">
        <h2 className="font-semibold">Dar acesso de Cliente → Usuário</h2>
        <div className="flex gap-3">
          <select
            className="flex-1 rounded-xl border px-3 py-2"
            value={selectedUserEmail}
            onChange={e => setSelectedUserEmail(e.target.value)}
          >
            <option value="">Selecione usuário…</option>
            {users.map(u => (
              <option key={u.id} value={u.email}>{u.email}</option>
            ))}
          </select>

          <select
            className="flex-1 rounded-xl border px-3 py-2"
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
          >
            <option value="">Selecione cliente…</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <button onClick={handleGrantAccess} className="px-4 py-2 rounded-xl bg-black text-white">
            Conceder
          </button>
        </div>
      </section>

      {/* Listas simples */}
      <section className="rounded-2xl border p-4">
        <h3 className="font-semibold mb-3">Clientes</h3>
        <ul className="list-disc pl-6">
          {clients.map(c => <li key={c.id}>{c.name} <span className="text-xs text-zinc-500">({c.id})</span></li>)}
        </ul>
      </section>

      <section className="rounded-2xl border p-4">
        <h3 className="font-semibold mb-3">Usuários</h3>
        <ul className="list-disc pl-6">
          {users.map(u => <li key={u.id}>{u.email}</li>)}
        </ul>
      </section>
    </main>
  );
}