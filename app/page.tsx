"use client";

import * as React from "react";
import { Plus, Trash2, Pencil } from "lucide-react";

/* ======================= UI base ======================= */
const Btn = ({
  children,
  onClick,
  variant = "default",
  size = "md",
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "outline";
  size?: "sm" | "md";
  disabled?: boolean;
  title?: string;
}) => {
  const base = "rounded-2xl transition-all flex items-center gap-2 disabled:opacity-50";
  // altura um pouco maior
  const sizes = { sm: "px-3 py-2 text-sm", md: "px-4 py-2.5 text-sm" } as const;
  const variants = {
    default: "bg-black text-white hover:bg-zinc-800",
    outline: "border border-zinc-300 hover:bg-zinc-50",
  } as const;
  return (
    <button title={title} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]}`}>
      {children}
    </button>
  );
};
const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={`border rounded-xl px-3 py-1.5 text-sm ${p.className || ""}`} />
);
const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={`border rounded-xl px-3 py-1.5 text-sm ${p.className || ""}`} />
);
const Card = (p: React.PropsWithChildren<{ className?: string }>) => (
  <div className={`bg-white rounded-2xl shadow-sm border ${p.className || ""}`}>{p.children}</div>
);
const CardC = (p: React.PropsWithChildren<{ className?: string }>) => <div className={`p-4 ${p.className || ""}`}>{p.children}</div>;

/* ======================= Tipos & utils ======================= */
type Role = "viewer" | "editor" | "admin";
type Status = "Não iniciado" | "Em andamento" | "Concluído" | "Bloqueado" | "Cancelado";

type KR = { id: string; descricao: string; previsto: number; realizado: number; unidade: string };
type Acao = { id: string; titulo: string; ownerEmail: string; prazo: string; status: Status; objetivoId?: string | null; projectId?: string | null };
type Objetivo = { id: string; titulo: string; prazo: string; ownerEmail: string; krs: KR[] };
type Projeto = { id: string; nome: string; fase: string; objetivos: Objetivo[] };

const uid = () => Math.random().toString(36).slice(2);
const clamp = (n: number) => (isFinite(n) && n >= 0 ? n : 0);

/* ======================= Pizza de Status (SVG) ======================= */
function StatusPie({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data);
  const colors: Record<string, string> = {
    "Não iniciado": "#9CA3AF",
    "Em andamento": "#3B82F6",
    "Concluído": "#10B981",
    "Bloqueado": "#EF4444",
    "Cancelado": "#6B7280",
  };
  const R = 28, C = 2 * Math.PI * R;
  let offset = 0;
  const arcs = entries
    .filter(([, v]) => v > 0)
    .map(([k, v]) => {
      const len = (v / 100) * C;
      const dash = `${len} ${C - len}`;
      const el = (
        <circle
          key={k}
          r={R}
          cx={32}
          cy={32}
          fill="transparent"
          stroke={colors[k] || "#999"}
          strokeWidth={10}
          strokeDasharray={dash}
          strokeDashoffset={-offset}
        />
      );
      offset += len;
      return el;
    });

  return (
    <div className="flex items-center gap-3">
      <svg width={64} height={64} viewBox="0 0 64 64">
        <circle r={R} cx={32} cy={32} fill="transparent" stroke="#E5E7EB" strokeWidth={10} />
        {arcs}
      </svg>
      <div className="text-xs space-y-1">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded" style={{ background: colors[k] || "#999" }} />
            <span className="text-zinc-600">{k}:</span>
            <b>{v}%</b>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ======================= Página ======================= */
export default function Page() {
  // Papel (DEV: via query ?role=admin|editor|viewer). Default admin para testar tudo.
  const [role, setRole] = React.useState<Role>("admin");
  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("role");
    if (q === "viewer" || q === "editor" || q === "admin") setRole(q);
  }, []);

  const [projects, setProjects] = React.useState<Projeto[]>([]);
  const [selProjectId, setSelProjectId] = React.useState<string | null>(null);
  const [selObjId, setSelObjId] = React.useState<string | null>(null);

  /* --------- Projetos --------- */
  const [novoProjetoNome, setNovoProjetoNome] = React.useState("");
  function addProjeto() {
    if (role === "viewer") return;
    const nome = novoProjetoNome.trim();
    if (!nome) return;
    const p: Projeto = { id: uid(), nome, fase: "Nova", objetivos: [] };
    setProjects((prev) => [p, ...prev]);
    setSelProjectId(p.id);
    setSelObjId(null);
    setNovoProjetoNome("");
  }
  const selProject = projects.find((p) => p.id === selProjectId) || null;
  const canDelete = () => role === "admin";
  function delProjeto(id: string) {
    if (!canDelete()) return;
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    if (!confirm(`Excluir o projeto "${p.nome}" e tudo atrelado?`)) return;
    setProjects((prev) => prev.filter((x) => x.id !== id));
    if (selProjectId === id) {
      setSelProjectId(null);
      setSelObjId(null);
    }
  }

  /* --------- Objetivos --------- */
  const [novoObj, setNovoObj] = React.useState({ titulo: "", prazo: "", ownerEmail: "" });
  function addObjetivo() {
    if (!selProject || role === "viewer") return;
    const titulo = novoObj.titulo.trim();
    if (!titulo) return;
    if (selProject.objetivos.length >= 5) {
      alert("Máximo de 5 objetivos por projeto.");
      return;
    }
    const o: Objetivo = { id: uid(), titulo, prazo: novoObj.prazo, ownerEmail: novoObj.ownerEmail, krs: [] };
    setProjects((prev) =>
      prev.map((p) => (p.id === selProject.id ? { ...p, objetivos: [o, ...p.objetivos] } : p))
    );
    setSelObjId(o.id);
    setNovoObj({ titulo: "", prazo: "", ownerEmail: "" });
  }
  function editObjetivoTitle(id: string, titulo: string) {
    if (role === "viewer") return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id !== selProjectId
          ? p
          : { ...p, objetivos: p.objetivos.map((o) => (o.id === id ? { ...o, titulo } : o)) }
      )
    );
  }
  function delObjetivo(id: string) {
    if (!canDelete()) return;
    if (!confirm("Excluir o objetivo e seus KRs e ações?")) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id !== selProjectId ? p : { ...p, objetivos: p.objetivos.filter((o) => o.id !== id) }
      )
    );
    if (selObjId === id) setSelObjId(null);
  }
  const selObj = selProject?.objetivos.find((o) => o.id === selObjId) || null;

  /* --------- KRs --------- */
  const [novoKR, setNovoKR] = React.useState({ descricao: "", previsto: "", realizado: "", unidade: "%" });
  function addKR() {
    if (!selObj || role === "viewer") return;
    if (selObj.krs.length >= 3) {
      alert("Máximo de 3 KRs por objetivo.");
      return;
    }
    const k: KR = {
      id: uid(),
      descricao: (novoKR.descricao || "").trim() || "KR",
      previsto: clamp(parseFloat(novoKR.previsto as any)) || 100,
      realizado: clamp(parseFloat(novoKR.realizado as any)) || 0,
      unidade: novoKR.unidade || "%",
    };
    setProjects((prev) =>
      prev.map((p) =>
        p.id !== selProjectId
          ? p
          : {
              ...p,
              objetivos: p.objetivos.map((o) => (o.id !== selObjId ? o : { ...o, krs: [...o.krs, k] })),
            }
      )
    );
    setNovoKR({ descricao: "", previsto: "", realizado: "", unidade: novoKR.unidade || "%" });
  }
  function updKR(krId: string, patch: Partial<KR>) {
    if (role === "viewer") return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id !== selProjectId
          ? p
          : {
              ...p,
              objetivos: p.objetivos.map((o) =>
                o.id !== selObjId ? o : { ...o, krs: o.krs.map((k) => (k.id === krId ? { ...k, ...patch } : k)) }
              ),
            }
      )
    );
  }
  function delKR(krId: string) {
    if (!canDelete()) return;
    if (!confirm("Excluir este KR?")) return;
    setProjects((prev) =>
      prev.map((p) =>
        p.id !== selProjectId
          ? p
          : { ...p, objetivos: p.objetivos.map((o) => (o.id !== selObjId ? o : { ...o, krs: o.krs.filter((k) => k.id !== krId) })) }
      )
    );
  }

  /* --------- Ações --------- */
  const [acoes, setAcoes] = React.useState<Acao[]>([]);
  const [novaAcao, setNovaAcao] = React.useState<Partial<Acao>>({
    titulo: "",
    ownerEmail: "",
    prazo: "",
    status: "Não iniciado",
  });
  function addAcao() {
    if (!selObj || role === "viewer") return;
    const a: Acao = {
      id: uid(),
      titulo: (novaAcao.titulo || "").trim() || "Ação",
      ownerEmail: (novaAcao.ownerEmail || "").trim(),
      prazo: (novaAcao.prazo || "").trim(),
      status: (novaAcao.status as Status) || "Não iniciado",
      projectId: selProjectId,
      objetivoId: selObjId,
    };
    setAcoes((prev) => [a, ...prev]); // ✅ apenas 1 inclusão
    setNovaAcao({ titulo: "", ownerEmail: "", prazo: "", status: "Não iniciado" });
  }
  function updAcao(id: string, patch: Partial<Acao>) {
    if (role === "viewer") return;
    setAcoes((prev) => prev.map((a) => (a.id === id ? ({ ...a, ...patch } as Acao) : a)));
  }
  function delAcao(id: string) {
    if (!canDelete()) return;
    if (!confirm("Excluir esta ação?")) return;
    setAcoes((prev) => prev.filter((a) => a.id !== id));
  }
  const acoesDoObjetivo = acoes.filter((a) => a.objetivoId === selObjId);

  /* --------- Cálculos --------- */
  const progressoObj =
    selObj && selObj.krs.length > 0
      ? Math.round(
          (selObj.krs.reduce((acc, k) => acc + (k.previsto > 0 ? Math.min(1, k.realizado / k.previsto) : 0), 0) /
            selObj.krs.length) *
            100
        )
      : 0;

  const distStatus = (() => {
    const total = acoesDoObjetivo.length || 1;
    const count = (s: Status) => acoesDoObjetivo.filter((a) => a.status === s).length;
    return {
      "Não iniciado": Math.round((count("Não iniciado") / total) * 100),
      "Em andamento": Math.round((count("Em andamento") / total) * 100),
      "Concluído": Math.round((count("Concluído") / total) * 100),
      "Bloqueado": Math.round((count("Bloqueado") / total) * 100),
      "Cancelado": Math.round((count("Cancelado") / total) * 100),
    };
  })();

  /* ======================= Render ======================= */
  return (
    <main className="min-h-screen bg-gray-50 p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Projetos Estratégicos</h1>
        <div className="text-sm text-zinc-600">papel: <b>{role}</b></div>
      </header>

      {/* Criar projeto */}
      <div className="flex items-center gap-2">
        <Input placeholder="Novo projeto…" value={novoProjetoNome} onChange={(e) => setNovoProjetoNome(e.currentTarget.value)} />
        <Btn onClick={addProjeto} disabled={role === "viewer"} title={role === "viewer" ? "Somente editor/admin" : undefined}>
          <Plus className="w-4 h-4" /> Adicionar projeto
        </Btn>
      </div>

      {/* Lista de projetos */}
      {projects.length === 0 ? (
        <Card><CardC>Nenhum projeto ainda. Crie um novo.</CardC></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {projects.map((p) => (
            <Card key={p.id} className={selProjectId === p.id ? "ring-2 ring-black" : ""}>
              <CardC>
                <div className="flex items-center justify-between">
                  <div className="cursor-pointer" onClick={() => { setSelProjectId(p.id); setSelObjId(p.objetivos[0]?.id || null); }}>
                    <div className="text-lg font-semibold">{p.nome}</div>
                    <div className="text-xs text-zinc-500">Fase: {p.fase}</div>
                  </div>
                  {canDelete() && (
                    <Btn variant="outline" size="sm" title="Excluir projeto" onClick={() => delProjeto(p.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Btn>
                  )}
                </div>
              </CardC>
            </Card>
          ))}
        </div>
      )}

      {/* Detalhe do projeto selecionado */}
      {selProject && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{selProject.nome} — Objetivos</h2>
            <div className="text-xs text-zinc-500">(até 5 objetivos, 1–3 KRs por objetivo)</div>
          </div>

          {/* Criar Objetivo */}
          <Card>
            <CardC>
              <div className="grid md:grid-cols-4 gap-2">
                <Input placeholder="Novo objetivo…" value={novoObj.titulo} onChange={(e) => setNovoObj({ ...novoObj, titulo: e.currentTarget.value })} />
                <Input placeholder="Prazo (ex: Jul/2026)" value={novoObj.prazo} onChange={(e) => setNovoObj({ ...novoObj, prazo: e.currentTarget.value })} />
                <Input placeholder="Owner (email)" value={novoObj.ownerEmail} onChange={(e) => setNovoObj({ ...novoObj, ownerEmail: e.currentTarget.value })} />
                <Btn onClick={addObjetivo} disabled={role === "viewer"}>Adicionar objetivo</Btn>
              </div>
            </CardC>
          </Card>

          {/* Lista de objetivos */}
          {selProject.objetivos.length === 0 ? (
            <Card><CardC>Nenhum objetivo ainda.</CardC></Card>
          ) : (
            selProject.objetivos.map((o) => (
              <Card key={o.id}>
                <CardC>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-start gap-2">
                        {/* Título maior + quebra */}
                        <textarea
                          className="font-semibold text-[18px] leading-snug border rounded-xl px-3 py-2 min-h-[44px] resize-y w-full"
                          value={o.titulo}
                          onChange={(e) => editObjetivoTitle(o.id, e.currentTarget.value)}
                          disabled={role === "viewer"}
                          rows={2}
                        />
                        {selObjId !== o.id && (
                          <Btn variant="outline" size="sm" onClick={() => setSelObjId(o.id)} title="Abrir detalhes">
                            <Pencil className="w-4 h-4" /> editar KRs & ações
                          </Btn>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        Prazo: {o.prazo || "—"} • Owner: {o.ownerEmail || "—"}
                      </div>
                    </div>
                    {canDelete() && (
                      <Btn variant="outline" size="sm" onClick={() => delObjetivo(o.id)} title="Excluir objetivo">
                        <Trash2 className="w-4 h-4" />
                      </Btn>
                    )}
                  </div>

                  {/* Progresso + Detalhes do objetivo selecionado */}
                  {o.id === selObjId && (
                    <>
                      <div className="mt-4">
                        <div className="text-sm font-medium mb-1">Progresso do Objetivo</div>
                        <div className="w-full h-3 bg-zinc-200 rounded-full overflow-hidden">
                          <div className="h-3 bg-emerald-600" style={{ width: `${progressoObj}%` }} />
                        </div>
                        <div className="text-xs text-zinc-600 mt-1">{progressoObj}% (média dos KRs)</div>
                      </div>

                      {/* KRs */}
                      <div className="mt-4 space-y-2">
                        <div className="text-sm font-medium">KRs (até 3)</div>
                        {o.krs.length === 0 ? (
                          <div className="text-sm text-zinc-500">Nenhum KR ainda.</div>
                        ) : (
                          o.krs.map((k) => (
                            <div key={k.id} className="grid md:grid-cols-7 gap-2 items-center">
                              <Input className="md:col-span-3" value={k.descricao} onChange={(e) => updKR(k.id, { descricao: e.currentTarget.value })} disabled={role === "viewer"} />
                              <Input type="number" placeholder="Previsto" value={k.previsto} onChange={(e) => updKR(k.id, { previsto: parseFloat(e.currentTarget.value || "0") })} disabled={role === "viewer"} />
                              <Input type="number" placeholder="Realizado" value={k.realizado} onChange={(e) => updKR(k.id, { realizado: parseFloat(e.currentTarget.value || "0") })} disabled={role === "viewer"} />
                              <Input placeholder="Unidade" value={k.unidade} onChange={(e) => updKR(k.id, { unidade: e.currentTarget.value })} disabled={role === "viewer"} />
                              {canDelete() && (
                                <Btn variant="outline" size="sm" onClick={() => delKR(k.id)} title="Excluir KR">
                                  <Trash2 className="w-4 h-4" />
                                </Btn>
                              )}
                            </div>
                          ))
                        )}

                        <div className="grid md:grid-cols-7 gap-2 items-center">
                          <Input className="md:col-span-3" placeholder="Novo KR (descrição)" value={novoKR.descricao} onChange={(e) => setNovoKR({ ...novoKR, descricao: e.currentTarget.value })} />
                          <Input type="number" placeholder="Previsto (ex: 100)" value={novoKR.previsto} onChange={(e) => setNovoKR({ ...novoKR, previsto: e.currentTarget.value })} />
                          <Input type="number" placeholder="Realizado (ex: 30)" value={novoKR.realizado} onChange={(e) => setNovoKR({ ...novoKR, realizado: e.currentTarget.value })} />
                          <Input placeholder="Unidade (%)" value={novoKR.unidade} onChange={(e) => setNovoKR({ ...novoKR, unidade: e.currentTarget.value })} />
                          <Btn size="sm" onClick={addKR} disabled={role === "viewer"}><Plus className="w-4 h-4" /> Add KR</Btn>
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="mt-6">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">Ações</div>
                          {/* Pizza dos status */}
                          <StatusPie data={distStatus} />
                        </div>

                        <div className="mt-2 grid md:grid-cols-5 gap-2">
                          <Input className="md:col-span-2" placeholder="Nova ação…" value={novaAcao.titulo || ""} onChange={(e) => setNovaAcao({ ...novaAcao, titulo: e.currentTarget.value })} />
                          <Input placeholder="Owner (email)" value={novaAcao.ownerEmail || ""} onChange={(e) => setNovaAcao({ ...novaAcao, ownerEmail: e.currentTarget.value })} />
                          <Input placeholder="Prazo (ex: Out/2025)" value={novaAcao.prazo || ""} onChange={(e) => setNovaAcao({ ...novaAcao, prazo: e.currentTarget.value })} />
                          <Select value={novaAcao.status || "Não iniciado"} onChange={(e) => setNovaAcao({ ...novaAcao, status: e.currentTarget.value as Status })}>
                            {["Não iniciado","Em andamento","Concluído","Bloqueado","Cancelado"].map((s) => <option key={s} value={s}>{s}</option>)}
                          </Select>
                          <Btn onClick={addAcao} disabled={role === "viewer"}><Plus className="w-4 h-4" /> Add Ação</Btn>
                        </div>

                        <div className="mt-3 max-h-64 overflow-y-auto space-y-2 pr-1">
                          {acoesDoObjetivo.length === 0 ? (
                            <div className="text-sm text-zinc-500">Nenhuma ação.</div>
                          ) : (
                            acoesDoObjetivo.map((a) => (
                              <Card key={a.id}><CardC>
                                <div className="grid md:grid-cols-6 gap-2 items-center">
                                  <Input className="md:col-span-2" value={a.titulo} onChange={(e) => updAcao(a.id, { titulo: e.currentTarget.value })} disabled={role === "viewer"} />
                                  <Input value={a.ownerEmail} onChange={(e) => updAcao(a.id, { ownerEmail: e.currentTarget.value })} disabled={role === "viewer"} />
                                  <Input value={a.prazo} onChange={(e) => updAcao(a.id, { prazo: e.currentTarget.value })} disabled={role === "viewer"} />
                                  <Select value={a.status} onChange={(e) => updAcao(a.id, { status: e.currentTarget.value as Status })} disabled={role === "viewer"}>
                                    {["Não iniciado","Em andamento","Concluído","Bloqueado","Cancelado"].map((s) => <option key={s} value={s}>{s}</option>)}
                                  </Select>
                                  {canDelete() && (
                                    <Btn variant="outline" size="sm" onClick={() => delAcao(a.id)} title="Excluir ação">
                                      <Trash2 className="w-4 h-4" />
                                    </Btn>
                                  )}
                                </div>
                              </CardC></Card>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardC>
              </Card>
            ))
          )}
        </section>
      )}
    </main>
  );
}
