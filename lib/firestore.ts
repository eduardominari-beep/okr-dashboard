// lib/firestore.ts
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type Role = "admin" | "editor" | "viewer";

export type ClientData = {
  name: string;
  createdAt?: unknown;   // serverTimestamp()
  createdBy?: string;    // uid
  admins?: string[];     // uids
};
export type Client = ClientData & { id: string };

export type AppUserData = {
  email: string;
  role: Role;
  clientAccess: string[];
  projectAccess: string[];
  createdAt?: unknown;   // serverTimestamp()
};
export type AppUser = AppUserData & { id: string };

// -------- USERS --------

export async function ensureUserDoc(uid: string, email: string): Promise<void> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const payload: AppUserData = {
      email,
      role: "viewer",
      clientAccess: [],
      projectAccess: [],
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
  }
}

export async function listUsers(): Promise<AppUser[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as AppUserData),
  }));
}

/** Cria um registro de usuário pré-login usando ID aleatório */
export async function upsertUserByEmail(
  email: string,
  role: Role = "viewer"
): Promise<string> {
  const ref = doc(collection(db, "users"));
  const payload: AppUserData = {
    email: email.toLowerCase(),
    role,
    clientAccess: [],
    projectAccess: [],
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, payload);
  return ref.id;
}

export async function setUserAccess(
  userId: string,
  params: Partial<Pick<AppUserData, "role" | "clientAccess" | "projectAccess">>
): Promise<void> {
  const ref = doc(db, "users", userId);
  const cur = await getDoc(ref);
  if (!cur.exists()) throw new Error("Usuário não encontrado");

  await setDoc(ref, params, { merge: true });
}

// -------- CLIENTS --------

export async function createClient(name: string, createdByUid: string): Promise<string> {
  const ref = doc(collection(db, "clients"));
  const payload: ClientData = {
    name: name.trim(),
    createdAt: serverTimestamp(),
    createdBy: createdByUid,
    admins: [createdByUid],
  };
  await setDoc(ref, payload);
  return ref.id;
}

export async function listClients(): Promise<Client[]> {
  const snap = await getDocs(collection(db, "clients"));
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as ClientData),
  }));
}

export async function grantClientAccess(userId: string, clientId: string): Promise<void> {
  const ref = doc(db, "users", userId);
  const cur = await getDoc(ref);
  if (!cur.exists()) throw new Error("Usuário não encontrado");

  const data = cur.data() as AppUserData;
  const next = Array.from(new Set([...(data.clientAccess || []), clientId]));

  await setDoc(ref, { clientAccess: next }, { merge: true });
}