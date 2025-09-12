// lib/firestore.ts
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// -------- TYPES --------
export type Role = "admin" | "editor" | "viewer";

export type ClientData = {
  name: string;
  createdAt?: unknown;
  createdBy?: string;
  admins?: string[];
};
export type Client = ClientData & { id: string };

export type ProjectData = {
  name: string;
  description?: string;
  createdAt?: unknown;
  createdBy?: string;
};
export type Project = ProjectData & { id: string };

export type OkrData = {
  objective: string;
  createdAt?: unknown;
  createdBy?: string;
};
export type Okr = OkrData & { id: string };

export type ActionData = {
  title: string;
  ownerEmail: string;
  status: "nao_iniciado" | "em_andamento" | "concluido" | "bloqueado" | "cancelado";
  deadline?: string;
  createdAt?: unknown;
};
export type Action = ActionData & { id: string };

export type AppUserData = {
  email: string;
  role: Role;
  superadmin?: boolean;
  clientAccess: string[];
  projectAccess: string[];
  createdAt?: unknown;
};
export type AppUser = AppUserData & { id: string };

// -------- SUPERADMINS --------
const SUPERADMINS = ["eduardo.minari@gmail.com"];

// -------- USERS --------
export async function ensureUserDoc(uid: string, email: string): Promise<void> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const isSuper = SUPERADMINS.includes(email.toLowerCase());
    const payload: AppUserData = {
      email: email.toLowerCase(),
      role: isSuper ? "admin" : "viewer",
      superadmin: isSuper,
      clientAccess: [],
      projectAccess: [],
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, payload);
  }
}
// Lê o doc do usuário logado
export async function getUser(uid: string): Promise<AppUser | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as AppUserData) };
}

export async function listUsers(): Promise<AppUser[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as AppUserData) }));
}

export async function upsertUserByEmail(email: string, role: Role = "viewer"): Promise<string> {
  const isSuper = SUPERADMINS.includes(email.toLowerCase());
  const payload: AppUserData = {
    email: email.toLowerCase(),
    role: isSuper ? "admin" : role,
    superadmin: isSuper,
    clientAccess: [],
    projectAccess: [],
    createdAt: serverTimestamp(),
  };
  const newRef = await addDoc(collection(db, "users"), payload);
  return newRef.id;
}

// -------- CLIENTS --------
export async function createClient(name: string, createdByUid: string): Promise<string> {
  const payload: ClientData = {
    name: name.trim(),
    createdAt: serverTimestamp(),
    createdBy: createdByUid,
    admins: [createdByUid],
  };
  const newRef = await addDoc(collection(db, "clients"), payload);
  return newRef.id;
}

export async function listClients(): Promise<Client[]> {
  const snap = await getDocs(collection(db, "clients"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ClientData) }));
}

export async function grantClientAccess(userId: string, clientId: string): Promise<void> {
  const ref = doc(db, "users", userId);
  const cur = await getDoc(ref);
  if (!cur.exists()) throw new Error("Usuário não encontrado");
  await updateDoc(ref, { clientAccess: arrayUnion(clientId) });
}

// -------- PROJECTS --------
export async function createProject(clientId: string, name: string, createdBy: string): Promise<string> {
  const payload: ProjectData = {
    name: name.trim(),
    createdAt: serverTimestamp(),
    createdBy,
  };
  const newRef = await addDoc(collection(db, `clients/${clientId}/projects`), payload);
  return newRef.id;
}

export async function listProjects(clientId: string): Promise<Project[]> {
  const snap = await getDocs(collection(db, `clients/${clientId}/projects`));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ProjectData) }));
}

// -------- OKRs --------
export async function createOkr(clientId: string, projectId: string, objective: string, createdBy: string): Promise<string> {
  const payload: OkrData = {
    objective: objective.trim(),
    createdAt: serverTimestamp(),
    createdBy,
  };
  const newRef = await addDoc(collection(db, `clients/${clientId}/projects/${projectId}/okrs`), payload);
  return newRef.id;
}

export async function listOkrs(clientId: string, projectId: string): Promise<Okr[]> {
  const snap = await getDocs(collection(db, `clients/${clientId}/projects/${projectId}/okrs`));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as OkrData) }));
}

// -------- ACTIONS --------
export async function createAction(
  clientId: string,
  projectId: string,
  okrId: string,
  title: string,
  ownerEmail: string,
  status: ActionData["status"] = "nao_iniciado",
  deadline?: string
): Promise<string> {
  const payload: ActionData = {
    title: title.trim(),
    ownerEmail: ownerEmail.toLowerCase(),
    status,
    deadline,
    createdAt: serverTimestamp(),
  };
  const newRef = await addDoc(collection(db, `clients/${clientId}/projects/${projectId}/okrs/${okrId}/actions`), payload);
  return newRef.id;
}

export async function listActions(clientId: string, projectId: string, okrId: string): Promise<Action[]> {
  const snap = await getDocs(collection(db, `clients/${clientId}/projects/${projectId}/okrs/${okrId}/actions`));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as ActionData) }));
}