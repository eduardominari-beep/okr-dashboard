#!/usr/bin/env node
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";

const TARGET_CITIES = [
  ["sao paulo", "Sao Paulo", 18], ["barueri", "Barueri", 18], ["alphaville", "Alphaville", 18],
  ["osasco", "Osasco", 14], ["santana de parnaiba", "Santana de Parnaiba", 15],
  ["sao bernardo do campo", "Sao Bernardo do Campo", 14], ["santo andre", "Santo Andre", 12],
  ["sao caetano do sul", "Sao Caetano do Sul", 12], ["guarulhos", "Guarulhos", 14],
  ["campinas", "Campinas", 17], ["jundiai", "Jundiai", 16], ["sorocaba", "Sorocaba", 15],
  ["ribeirao preto", "Ribeirao Preto", 10], ["sao jose dos campos", "Sao Jose dos Campos", 13],
  ["santos", "Santos", 10], ["indaiatuba", "Indaiatuba", 11], ["piracicaba", "Piracicaba", 10],
  ["americana", "Americana", 9], ["limeira", "Limeira", 8], ["atibaia", "Atibaia", 8],
  ["cotia", "Cotia", 9], ["embu das artes", "Embu das Artes", 8]
].map(([name, label, weight]) => ({ name, label, weight }));

const OFFERINGS = [
  ["glass_facade", "vidros e fachadas", ["vidro", "vidros", "pele de vidro", "fachada", "fachadas", "envidracamento", "vitrine"]],
  ["frames", "esquadrias", ["esquadria", "esquadrias", "caixilho", "caixilhos", "aluminio", "portas", "janelas"]],
  ["painting", "pintura", ["pintura", "repintura", "pintura predial", "pintura industrial", "acabamento", "revestimento"]],
  ["roofing", "coberturas", ["cobertura", "coberturas", "telhado", "quadra coberta", "fechamento lateral", "estrutura metalica"]],
  ["civil_works", "obra civil e adequacao", ["obra", "obras", "obra civil", "reforma", "retrofit", "adequacao", "implantacao", "construcao", "ampliacao", "expansao", "demolicao", "alvenaria", "piso", "contrapiso", "drywall", "forro"]],
  ["hydraulic", "hidraulica", ["hidraulica", "hidraulico", "instalacao hidraulica", "instalacoes hidraulicas", "rede hidraulica", "tubulacao", "agua fria", "agua quente", "esgoto", "drenagem interna", "sprinklers", "combate a incendio"]],
  ["electrical", "eletrica", ["eletrica", "eletrico", "instalacao eletrica", "instalacoes eletricas", "rede eletrica", "infraestrutura eletrica", "entrada de energia", "subestacao", "quadros eletricos", "iluminacao", "spda", "cabeamento"]],
  ["industrial_logistics", "galpoes e implantacao industrial", ["galpao", "galpoes", "centro de distribuicao", "cd", "fabrica", "planta industrial", "linha de producao"]]
].map(([key, label, keywords]) => ({ key, label, keywords }));

const PROCUREMENT = ["licitacao", "aviso de licitacao", "dispensa de licitacao", "inexigibilidade de licitacao", "pregao", "pregao eletronico", "pregao presencial", "edital", "termo de referencia", "ata de registro de precos", "registro de precos", "tomada de precos", "concorrencia publica", "contratacao publica", "compras publicas", "comprasnet", "pncp", "portal nacional de contratacoes publicas", "bec sp", "bolsa eletronica de compras", "diario oficial", "extrato de contrato", "contrato administrativo", "sessao publica", "menor preco", "chamamento publico", "homologacao", "adjudicacao"];
const PUBLIC_NOISE = ["recapeamento", "pavimentacao", "tapa buraco", "playground", "praca publica", "manutencao de praca", "zeladoria", "limpeza urbana", "sinalizacao viaria", "calcada publica", "drenagem urbana", "poda de arvore"];
const GOVERNMENT = ["prefeitura", "governo do estado", "governo federal", "secretaria municipal", "secretaria estadual", "camara municipal", "autarquia", "fundacao municipal"];
const PRIVATE = ["ltda", "s/a", "sa", "grupo", "rede", "industria", "industrial", "shopping", "condominio", "logistica", "empreendimentos", "incorporadora", "construtora", "company", "brasil"];
const SIGNALS = [
  ["private_permit", 32, ["alvara", "aprovacao de projeto", "projeto aprovado", "licenca de construcao", "licenciamento urbanistico", "alvara de execucao", "uso comercial", "uso industrial"]],
  ["environmental_license", 28, ["licenca de instalacao", "licenca previa", "cetesb", "licenciamento ambiental", "viabilidade ambiental"]],
  ["industrial_expansion", 32, ["expansao fabril", "expansao industrial", "nova fabrica", "ampliacao da fabrica", "planta industrial", "linha de producao", "area produtiva"]],
  ["warehouse_or_logistics", 29, ["centro de distribuicao", "novo cd", "galpao logistico", "hub logistico", "operacao logistica", "condominio logistico"]],
  ["commercial_expansion", 25, ["nova loja", "inaugura unidade", "nova unidade", "expansao da rede", "abre unidade", "loja conceito", "implantacao de loja"]],
  ["corporate_fitout", 25, ["retrofit", "mudanca de sede", "nova sede", "escritorio corporativo", "fitout", "adequacao predial", "reforma corporativa"]],
  ["building_systems_upgrade", 27, ["adequacao hidraulica", "adequacao eletrica", "instalacoes hidraulicas", "instalacoes eletricas", "infraestrutura eletrica", "rede hidraulica", "rede eletrica", "subestacao", "entrada de energia", "combate a incendio", "sprinklers"]],
  ["construction_hiring_signal", 20, ["gerente de obras", "coordenador de obras", "analista de facilities", "engenheiro de implantacao", "implantacao de unidade", "expansao imobiliaria"]]
].map(([type, weight, keywords]) => ({ type, weight, keywords }));

const FIXTURE = [
  signal("Rede Aurora Ltda", "Campinas", "Rede Aurora anuncia nova loja em Campinas com retrofit de fachada", "Implantacao de loja conceito com reforma interna, fachada de vidro, esquadrias de aluminio e pintura externa."),
  signal("Rede Aurora Ltda", "Campinas", "Rede Aurora abre unidade conceito em Campinas", "Projeto de expansao envolve obra de retrofit, fachada comercial e adequacao predial."),
  signal("Industria Prisma S/A", "Jundiai", "Industria Prisma inicia ampliacao de fabrica em Jundiai", "Expansao fabril com nova area produtiva, fechamento lateral, pintura industrial e adequacao de galpao."),
  signal("Operadora Atlas Logistica", "Barueri", "Operadora Atlas contrata gerente de obras para novo CD em Barueri", "Implantacao de centro de distribuicao, adequacao civil, docas e estrutura metalica."),
  signal("Quimica Boreal Ltda", "Sorocaba", "CETESB registra licenca de instalacao para expansao da Quimica Boreal", "Solicitacao privada de licenca de instalacao para ampliacao de planta industrial, obra civil e novo bloco produtivo."),
  signal("Shopping Vale Norte", "Sao Paulo", "Shopping Vale Norte prepara retrofit de fachada em Sao Paulo", "Retrofit de fachada, nova pele de vidro, esquadrias e pintura em areas comuns."),
  signal("Prefeitura Municipal", "Campinas", "Prefeitura publica licitacao para recapeamento de vias", "Edital de pregao para recapeamento asfaltico e sinalizacao viaria."),
  signal("Secretaria Municipal", "Osasco", "Manutencao de playground publico tem ordem de servico", "Manutencao corretiva de playground e praca publica."),
  signal("Marca Litoral Ltda", "Santos", "Empresa anuncia campanha de marketing em Santos", "Acao promocional sem indicio de obra, reforma, implantacao ou expansao fisica."),
  signal("Centro Medico Altus Ltda", "Osasco", "Centro Medico Altus inicia reforma com adequacao hidraulica e eletrica", "Grupo privado vai adequar instalacoes hidraulicas, rede eletrica, pintura e obra civil para nova unidade."),
  signal("Condominio Logistico Sigma", "Guarulhos", "Condominio Logistico Sigma faz adequacao eletrica para novo operador", "Empreendimento privado prepara obra civil, subestacao, infraestrutura eletrica, pintura e adequacao hidraulica em modulo logistico.")
];

const command = process.argv[2] ?? "collect";
const args = parseArgs(process.argv.slice(3));
if (command === "test") await selfTest();
else if (command === "email") await prepareEmail(args);
else await collect(args);

async function collect(args) {
  const mode = args.mode ?? "fixture";
  const runId = args.runId ?? `${mode}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const runDir = resolve(args.outDir ?? `data/runs/${runId}`);
  await mkdir(runDir, { recursive: true });
  const { rawSignals, sourceReports } = mode === "live" ? await collectLive() : { rawSignals: FIXTURE, sourceReports: [{ name: "fixture", ok: true, records: FIXTURE.length }] };
  const classified = rawSignals.map((item) => classify(item));
  const rankedLeads = dedupe(classified.filter((item) => item.status === "lead"));
  const rejectedSignals = classified.filter((item) => item.status === "rejected");
  const status = operationalStatus({ rawSignals, rankedLeads, rejectedSignals, sourceReports, mode });
  const metadata = { run_id: runId, mode, generated_at: new Date().toISOString() };
  const result = { metadata, rawSignals, rankedLeads, rejectedSignals, sourceReports, status };
  await writeArtifacts(runDir, result);
  console.log(`Run: ${runId}`);
  console.log(`Status: ${status.state}`);
  console.log(`Leads: ${rankedLeads.length}`);
  console.log(`Rejected: ${rejectedSignals.length}`);
  console.log(`Artifacts: ${runDir}`);
  if (mode === "live" && status.state === "FAIL") process.exitCode = 1;
}

async function collectLive() {
  const queries = [];
  const bases = ["expansao fabrica obra fachada", "nova unidade implantacao loja reforma fachada", "centro de distribuicao obra galpao", "retrofit sede corporativa obra", "adequacao hidraulica eletrica pintura obra civil"];
  for (const base of bases) for (const city of TARGET_CITIES.slice(0, 8)) queries.push(`${base} \"${city.label}\"`);
  const rawSignals = [];
  const sourceReports = [];
  for (const query of queries) {
    try {
      const items = await fetchRss(query);
      rawSignals.push(...items);
      sourceReports.push({ name: `rss:${query}`, ok: true, records: items.length });
    } catch (error) {
      sourceReports.push({ name: `rss:${query}`, ok: false, records: 0, error: error.message });
    }
  }
  return { rawSignals, sourceReports };
}

async function fetchRss(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${query} when:30d`);
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "BR");
  url.searchParams.set("ceid", "BR:pt-419");
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "user-agent": "obra-hunter-ai/0.1" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 6).map((match, index) => {
      const block = match[1];
      const title = decodeXml(tag(block, "title"));
      const text = stripHtml(decodeXml(tag(block, "description")));
      return { id: `rss-${hash(query + title + index)}`, title, text, company_name: "", city: inferCity(`${title} ${text}`)?.label ?? "", source_name: decodeXml(tag(block, "source")) || "Google News RSS", source_url: decodeXml(tag(block, "link")), published_at: decodeXml(tag(block, "pubDate")), detected_at: new Date().toISOString() };
    }).filter((item) => item.title && item.source_url);
  } finally {
    clearTimeout(timer);
  }
}

function classify(raw) {
  const detectedAt = iso(raw.detected_at ?? raw.published_at);
  const text = norm([raw.title, raw.text, raw.company_name, raw.city, raw.address, raw.source_name].filter(Boolean).join(" "));
  const procurement = hits(text, PROCUREMENT);
  if (procurement.length) return reject(raw, "public_procurement_hard_reject", `Contem termo de licitacao/compra publica: ${procurement.join(", ")}`, detectedAt);
  const noise = hits(text, PUBLIC_NOISE);
  if (noise.length) return reject(raw, "public_maintenance_noise", `Contem ruido de manutencao publica: ${noise.join(", ")}`, detectedAt);
  const signalMatch = bestSignal(text);
  if (!signalMatch) return reject(raw, "no_probable_construction_signal", "Nao ha sinal forte de obra, implantacao, expansao, licenca ou retrofit.", detectedAt);
  if (!hasPrivateActor(raw, text)) return reject(raw, "no_private_actor", "Nao ha empresa privada identificavel para abordagem comercial.", detectedAt, signalMatch.type);
  const offerings = matchedOfferings(text, signalMatch.type);
  if (!offerings.length) return reject(raw, "no_sales_fit", "Nao ha aderencia clara ao escopo comercial.", detectedAt, signalMatch.type);
  const city = inferCity(raw.city || text);
  const score = clamp(signalMatch.weight + (city?.weight ?? 4) + recency(detectedAt) + (raw.company_name ? 9 : 4) + (raw.source_url ? 5 : 0) + (raw.address ? 5 : 0) + clamp(offerings.length * 4, 4, 12) + (hasDirectOffering(offerings) ? 10 : 4) + (["industrial_expansion", "warehouse_or_logistics", "private_permit"].includes(signalMatch.type) ? 6 : 0), 0, 100);
  const fit = score >= 82 && hasDirectOffering(offerings) ? "high" : score >= 68 ? "medium" : score >= 55 ? "low" : "reject";
  if (fit === "reject") return reject(raw, "low_commercial_score", "Sinal privado existe, mas prioridade comercial ficou baixa.", detectedAt, signalMatch.type);
  return {
    id: raw.id ?? null, status: "lead", company_name: raw.company_name || "Empresa privada nao identificada", city: city?.label ?? raw.city ?? "", address: raw.address ?? "", source_name: raw.source_name ?? "", source_url: raw.source_url ?? "", title: raw.title ?? "", detected_at: detectedAt,
    signal_type: signalMatch.type, score, commercial_fit: fit, estimated_ticket_band: ticket(score, signalMatch.type), matched_offerings: offerings,
    rationale: `Sinal ${signalMatch.type} com ator privado${city ? ` em ${city.label}` : ""} e aderencia a ${offerings.map((item) => item.label).join(", ")}.`,
    recommended_approach: approach(signalMatch.type, offerings),
    why_this_is_probable_construction_signal: signalMatch.reason,
    why_this_is_probable_private_opportunity: `Ha ator privado identificavel e o sinal nao depende de licitacao publica.`,
    why_this_matches_commercial_scope: `Aderencia detectada ao escopo comercial: ${offerings.map((item) => item.label).join(", ")}.`,
    exclusion_reason: null, evidence: { signal_keywords: signalMatch.hits, offering_keywords: offerings.flatMap((item) => item.hits), source_url: raw.source_url ?? null }, raw
  };
}

function reject(raw, reason, detail, detectedAt, signalType = null) {
  return { id: raw.id ?? null, status: "rejected", company_name: raw.company_name ?? "", city: raw.city ?? "", source_name: raw.source_name ?? "", source_url: raw.source_url ?? "", title: raw.title ?? "", detected_at: detectedAt, signal_type: signalType, score: 0, commercial_fit: "reject", estimated_ticket_band: "none", exclusion_reason: reason, exclusion_detail: detail, promotion_allowed: false, raw };
}

function dedupe(leads) {
  const kept = [];
  for (const lead of leads) {
    const existing = kept.find((item) => {
      const sameCompany = norm(item.company_name) === norm(lead.company_name);
      const sameCity = !item.city || !lead.city || norm(item.city) === norm(lead.city);
      const sameAddress = item.address && lead.address && norm(item.address) === norm(lead.address);
      return sameCompany && sameCity && (sameAddress || item.signal_type === lead.signal_type || tokenSimilarity(item.title, lead.title) >= 0.25);
    });
    if (!existing) kept.push({ ...lead, duplicate_count: 0, merged_source_urls: uniq([lead.source_url]), merged_titles: uniq([lead.title]) });
    else {
      existing.duplicate_count += 1;
      existing.merged_source_urls = uniq([...existing.merged_source_urls, lead.source_url]);
      existing.merged_titles = uniq([...existing.merged_titles, lead.title]);
      if (lead.score > existing.score) Object.assign(existing, lead, { duplicate_count: existing.duplicate_count, merged_source_urls: existing.merged_source_urls, merged_titles: existing.merged_titles });
    }
  }
  return kept.sort((a, b) => b.score - a.score || a.company_name.localeCompare(b.company_name));
}

function operationalStatus({ rawSignals, rankedLeads, rejectedSignals, sourceReports, mode }) {
  const sourcesOk = sourceReports.filter((source) => source.ok && source.records > 0);
  const sourcesFailed = sourceReports.filter((source) => !source.ok);
  const warnings = [];
  const failures = [];
  if (!sourceReports.length) failures.push("no_sources_configured");
  if (!sourcesOk.length) failures.push("no_source_returned_records");
  if (!rawSignals.length) failures.push("no_raw_signals");
  if (!rankedLeads.length) failures.push("no_ranked_private_leads");
  if (sourcesFailed.length) warnings.push("one_or_more_sources_failed");
  const state = failures.length ? "FAIL" : warnings.length ? "WARNING" : "SUCCESS";
  return { state, mode, generated_at: new Date().toISOString(), counts: { raw_signals: rawSignals.length, ranked_leads: rankedLeads.length, rejected_signals: rejectedSignals.length, sources_ok: sourcesOk.length, sources_failed: sourcesFailed.length }, sources_ok: sourcesOk.map((s) => s.name), sources_failed: sourcesFailed.map((s) => ({ name: s.name, error: s.error ?? "unknown_error" })), warnings, failures };
}

async function writeArtifacts(runDir, result) {
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "raw-signals.json"), JSON.stringify(result.rawSignals, null, 2) + "\n");
  await writeFile(join(runDir, "ranked-leads.json"), JSON.stringify(result.rankedLeads, null, 2) + "\n");
  await writeFile(join(runDir, "rejected-signals.json"), JSON.stringify(result.rejectedSignals, null, 2) + "\n");
  await writeFile(join(runDir, "operational-status.json"), JSON.stringify(result.status, null, 2) + "\n");
  await writeFile(join(runDir, "run-metadata.json"), JSON.stringify(result.metadata, null, 2) + "\n");
  await writeFile(join(runDir, "leads.csv"), toCsv(result.rankedLeads));
  await writeFile(join(runDir, "summary.md"), toSummary(result));
  await prepareEmail({ runDir, to: "eduardo.minari@gmail.com" });
}

async function prepareEmail(args) {
  const runDir = resolve(args.runDir ?? ".");
  const to = args.to ?? "eduardo.minari@gmail.com";
  const summary = await readFile(join(runDir, "summary.md"), "utf8");
  const status = JSON.parse(await readFile(join(runDir, "operational-status.json"), "utf8"));
  const subject = `Obra Hunter AI - ${status.state} - ${status.counts.ranked_leads} leads`;
  const body = ["Eduardo,", "", "Segue o radar semanal de oportunidades privadas de obra.", "", summary.trim(), "", "Arquivos anexos:", "- leads.csv", "- ranked-leads.json", "", "Observacao: licitacoes, pregoes, editais publicos e manutencao urbana generica sao rejeitados antes do ranking comercial.", ""].join("\n");
  await writeFile(join(runDir, "email-body.txt"), body);
  await writeFile(join(runDir, "email-subject.txt"), subject + "\n");
  await writeFile(join(runDir, "email-to.txt"), to + "\n");
  console.log(`Email prepared for ${to}`);
}

async function selfTest() {
  const procurement = classify(signal("Construtora Exemplo Ltda", "Sao Paulo", "Construtora privada vence pregao para fachada de vidro", "Edital do PNCP trata de obra com esquadrias e pintura."));
  assert.equal(procurement.status, "rejected");
  assert.equal(procurement.exclusion_reason, "public_procurement_hard_reject");
  const good = classify(signal("Clinica Modelo Ltda", "Osasco", "Clinica privada inicia adequacao hidraulica e eletrica", "Reforma de nova unidade inclui obra civil, instalacoes hidraulicas, instalacoes eletricas e pintura predial."));
  assert.equal(good.status, "lead");
  assert.equal(good.signal_type, "building_systems_upgrade");
  const tmp = resolve(`.tmp-test-${Date.now()}`);
  await collect({ mode: "fixture", runId: "test-fixture", outDir: tmp });
  const status = JSON.parse(await readFile(join(tmp, "operational-status.json"), "utf8"));
  const leads = JSON.parse(await readFile(join(tmp, "ranked-leads.json"), "utf8"));
  assert.equal(status.state, "SUCCESS");
  assert.equal(leads.length, 7);
  assert.equal(leads.some((lead) => /licitacao|pregao|edital|pncp|recapeamento|playground/i.test(lead.title)), false);
  await rm(tmp, { recursive: true, force: true });
  console.log("All tests passed");
}

function bestSignal(text) {
  return SIGNALS.map((rule) => ({ ...rule, hits: hits(text, rule.keywords) })).filter((rule) => rule.hits.length).sort((a, b) => b.weight - a.weight || b.hits.length - a.hits.length).map((rule) => ({ ...rule, reason: `Detectado por termos: ${rule.hits.join(", ")}.` }))[0] ?? null;
}
function matchedOfferings(text, signalType) {
  const found = OFFERINGS.map((rule) => ({ key: rule.key, label: rule.label, hits: hits(text, rule.keywords) })).filter((rule) => rule.hits.length);
  if (!found.length && ["industrial_expansion", "warehouse_or_logistics", "private_permit", "corporate_fitout"].includes(signalType)) found.push({ key: "civil_works", label: "obra civil e adequacao", hits: ["sinal fisico de implantacao/expansao"] });
  return found;
}
function hasPrivateActor(raw, text) { return !hits([raw.company_name, raw.source_name].filter(Boolean).join(" "), GOVERNMENT).length && (raw.company_name || hits(text, PRIVATE).length || /\b[a-z0-9]+\.com(\.br)?\b/.test(text)); }
function hasDirectOffering(items) { return items.some((item) => ["glass_facade", "frames", "painting", "roofing"].includes(item.key)); }
function approach(type, offerings) { const scope = offerings.map((item) => item.label).join(", "); if (type === "building_systems_upgrade") return `Abordar facilities, engenharia ou manutencao predial com proposta para ${scope}.`; if (["industrial_expansion", "warehouse_or_logistics"].includes(type)) return `Abordar operacoes, engenharia ou compras antes da contratacao final de fornecedores para ${scope}.`; return `Abordar expansao, facilities ou compras com tese direta para ${scope}.`; }
function ticket(score, type) { if (score >= 88 && ["industrial_expansion", "warehouse_or_logistics", "private_permit"].includes(type)) return "strategic"; if (score >= 78) return "high"; if (score >= 62) return "medium"; return "low"; }
function inferCity(value = "") { const n = norm(value); return TARGET_CITIES.find((city) => n.includes(city.name)); }
function signal(company_name, city, title, text) { return { id: hash(company_name + title), company_name, city, title, text, address: city, source_name: "Fixture controlada", source_url: `https://example.com/${hash(title)}`, published_at: "2026-05-24T10:00:00.000Z" }; }
function toCsv(leads) { const headers = ["score", "commercial_fit", "estimated_ticket_band", "company_name", "city", "signal_type", "title", "source_url", "recommended_approach"]; return headers.join(",") + "\n" + leads.map((lead) => headers.map((h) => csv(lead[h])).join(",")).join("\n") + "\n"; }
function toSummary(result) { const lines = [`# Obra Hunter AI - ${result.metadata.run_id}`, "", `Status: ${result.status.state}`, `Modo: ${result.metadata.mode}`, `Gerado em: ${result.metadata.generated_at}`, "", "## Contagens", "", `- Sinais brutos: ${result.rawSignals.length}`, `- Leads ranqueados: ${result.rankedLeads.length}`, `- Sinais rejeitados: ${result.rejectedSignals.length}`, `- Fontes OK: ${result.status.counts.sources_ok}`, `- Fontes com falha: ${result.status.counts.sources_failed}`, "", "## Top leads", ""]; for (const lead of result.rankedLeads.slice(0, 10)) lines.push(`- ${lead.score} | ${lead.company_name} | ${lead.city} | ${lead.signal_type} | ${lead.rationale}`); if (!result.rankedLeads.length) lines.push("- Nenhum lead privado acionavel nesta execucao."); if (result.status.warnings.length || result.status.failures.length) { lines.push("", "## Alertas", ""); for (const w of result.status.warnings) lines.push(`- WARNING: ${w}`); for (const f of result.status.failures) lines.push(`- FAIL: ${f}`); } return lines.join("\n") + "\n"; }
function recency(value) { const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000)); return days <= 14 ? 13 : days <= 45 ? 9 : days <= 90 ? 5 : 0; }
function iso(value) { const d = new Date(value || Date.now()); return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(); }
function hits(text, keywords) { const n = norm(text); return keywords.filter((k) => contains(n, k)); }
function contains(text, keyword) { const k = norm(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"); return new RegExp(`(^|[^a-z0-9])${k}($|[^a-z0-9])`).test(text); }
function norm(value = "") { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9/@:.+\-\s]/g, " ").replace(/\s+/g, " ").trim(); }
function tokenSimilarity(a, b) { const A = new Set(norm(a).split(" ").filter((x) => x.length > 3)); const B = new Set(norm(b).split(" ").filter((x) => x.length > 3)); if (!A.size || !B.size) return 0; const inter = [...A].filter((x) => B.has(x)).length; return inter / new Set([...A, ...B]).size; }
function tag(block, name) { return block.match(new RegExp(`<${name}(?: [^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? ""; }
function stripHtml(value) { return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
function decodeXml(value) { return stripHtml(String(value).replaceAll("<![CDATA[", "").replaceAll("]]>", "").replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">")); }
function uniq(values) { return [...new Set(values.filter(Boolean))]; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function csv(value) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function hash(value) { let h = 0; for (let i = 0; i < value.length; i += 1) h = Math.imul(31, h) + value.charCodeAt(i) | 0; return Math.abs(h).toString(36); }
function parseArgs(argv) { const out = {}; for (const arg of argv) { if (!arg.startsWith("--")) continue; const [k, v = "true"] = arg.slice(2).split("="); out[k.replace(/-([a-z])/g, (_, l) => l.toUpperCase())] = v; } return out; }
