"use client";

import { useEffect, useMemo, useState, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../auth-provider";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  listProjects,
  createProject,
  type Project,
  type AppUser,
} from "@/lib/firestore";

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-white p-4 shadow-sm">{children}</div>;
}

export default function ClientProjectsPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [me, setMe] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [newProjectName, setNewProjectName] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (!user) {
          setLoading(false);
          router.push("/clients"); // força voltar para seleção
          return;
        }
        // carrega meu doc (role, clientAccess, projectAccess, superadmin)
        const usnap = await getDoc(doc(db, "users", user.uid));
        if (!usnap.exists()) {
          setError("Seu perfil não foi encontrado.");
          setLoading(false);
          return;
        }
        const meDoc = { id: usnap.id, ...(usnap.data() as any) } as AppUser;
        setMe(meDoc);

        // sanity: precisa ter acesso ao cliente (ou ser superadmin)
        const hasClient =
          meDoc?.superadmin ||
          (Array.isArray(meDoc?.clientAccess) && meDoc.clientAccess.includes(clientId));
        if (!hasClient) {
          setError("Você não tem acesso a este cliente.");
          setLoading(false);
          return;
        }

        // carrega projetos do cliente
        const ps = await listProjects(clientId);
        setProjects(ps);
      } catch (e: any) {
        setError(e?.message || "Falha ao carregar projetos");
      } finally {
        setLoading(false);
      }
    })();
  }, [clientId, user, router]);

  // Permissões
  const isSuper = !!me?.superadmin;
  const role: "admin" | "editor" | "viewer" | undefined = (me?.role as any) || undefined;

  // Admin do cliente vê todos os projetos; senão, filtra pelos atribuídos
  const visibleProjects = useMemo(() => {
    if (!me) return [];
    if (isSuper || role === "admin") return projects;
    const allowed = new Set(me.projectAccess || []);
    return projects.filter((p) => allowed.has(p.id));
  }, [me, projects, isSuper, role]);

  async function onCreateProject(e: FormEvent) {
    e.preventDefault();
    if (!user || !(isSuper || role === "admin")) return;
    const name = newProjectName.trim();
    if (!name) return;
    try {
      await createProject(clientId, name, user.uid);
      setNewProjectName("");
      setProjects(await listProjects(clientId));
    } catch (e: any) {
      alert("Falha ao criar projeto: " + (e?.message || e));
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projetos do Cliente</h1>
          <p className="text-sm text-zinc-600">
            {isSuper ? "Superadmin" : `Papel: ${role ?? "?"}`}
          </p>
        </div>
        <button
          onClick={() => router.push("/clients")}
          className="rounded-2xl border px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          ← Clientes
        </button>
      </header>

      {loading && <Card><div className="text-sm text-zinc-500">Carregando…</div></Card>}
      {error && <Card><div className="text-sm text-red-600">{error}</div></Card>}

      {/* Criar projeto: só admin/superadmin */}
      {(isSuper || role === "admin") && !loading && !error && (
        <Card>
          <form onSubmit={onCreateProject} className="flex gap-3">
            <input
              className="w-full rounded-md border border-zinc-300 px-3 py-2"
              placeholder="Nome do projeto"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
            />
            <button type="submit" className="rounded-md bg-black px-4 py-2 text-white">
              Adicionar
            </button>
          </form>
        </Card>
      )}

      {/* Lista de projetos (filtrada por acesso quando não-admin) */}
      {!loading && !error && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibleProjects.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold">{p.name}</div>
                  <div className="text-xs text-zinc-500">ID: {p.id}</div>
                </div>
                {/* próximos passos: botões OKRs / Atribuir acesso / Excluir (condicional) */}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50"
                  onClick={() => {/* navega para OKRs do projeto (próxima etapa) */}}
                >
                  Ver OKRs
                </button>
                {(isSuper || role === "admin") && (
                  <button
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50"
                    onClick={() => {/* abrirá gestão de usuários do cliente na próxima etapa */}}
                  >
                    Gerenciar Acesso
                  </button>
                )}
              </div>
            </Card>
          ))}
          {visibleProjects.length === 0 && (
            <Card><div className="text-sm text-zinc-500">Nenhum projeto disponível.</div></Card>
          )}
        </div>
      )}
    </main>
  );
}