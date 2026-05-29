#!/usr/bin/env node
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import assert from "node:assert/strict";

const TARGET_CITIES = [
  ["sao paulo", "Sao Paulo", 16], ["barueri", "Barueri", 14], ["alphaville", "Alphaville", 14], ["osasco", "Osasco", 12],
  ["campinas", "Campinas", 15], ["jundiai", "Jundiai", 14], ["sorocaba", "Sorocaba", 13], ["guarulhos", "Guarulhos", 13],
  ["sao bernardo do campo", "Sao Bernardo do Campo", 12], ["santo andre", "Santo Andre", 11], ["sao caetano do sul", "Sao Caetano do Sul", 11],
  ["ribeirao preto", "Ribeirao Preto", 10], ["sao jose dos campos", "Sao Jose dos Campos", 12], ["santos", "Santos", 10],
  ["curitiba", "Curitiba", 11], ["rio de janeiro", "Rio de Janeiro", 11], ["belo horizonte", "Belo Horizonte", 11],
  ["porto alegre", "Porto Alegre", 10], ["caxias do sul", "Caxias do Sul", 10], ["florianopolis", "Florianopolis", 10]
].map(([key, label, weight]) => ({ key, label, weight }));

const SECTORS = [
  ["education", "educacao/escolas", 15, ["colegio", "escola", "ensino", "educacional", "matriculas", "rematricula", "alunos", "mensalidade", "mantenedora"]],
  ["construction", "construcao civil", 12, ["construtora", "incorporadora", "obra", "engenharia", "empreendimento", "imoveis", "imobiliario"]],
  ["health", "saude/clinicas", 12, ["clinica", "hospital", "laboratorio", "diagnostico", "medico", "saude"]],
  ["logistics", "logistica", 13, ["logistica", "transportes", "entregas", "fulfillment", "centro de distribuicao", "operador logistico"]],
  ["industry", "industria", 14, ["industria", "industrial", "fabrica", "producao", "manufatura", "planta", "lean", "tpm", "wcm"]],
  ["retail", "varejo/franquias", 12, ["varejo", "loja", "franquia", "franqueadora", "shopping", "restaurante", "rede"]],
  ["services", "servicos b2b", 10, ["servicos", "facilities", "terceirizacao", "tecnologia", "software", "fintech"]]
].map(([key, label, weight, keywords]) => ({ key, label, weight, keywords }));

const SIGNALS = [
  ["expansion_pressure", "crescimento rapido ou expansao", 34, ["capta", "captou", "aporte", "rodada", "investimento", "expansao", "acelera expansao", "novas unidades", "nova unidade", "abre unidade", "inaugura unidade", "abrir lojas", "nova fabrica", "novo centro de distribuicao", "crescer 5x", "crescer 7x"]],
  ["management_hiring", "contratacao de gestao/processos", 33, ["contrata controller", "vaga controller", "fp&a", "gerente de operacoes", "gerente de processos", "gerente de melhoria continua", "gerente de planejamento", "s&op", "business partner financeiro", "gerente comercial", "diretor de operacoes"]],
  ["systems_upgrade", "implantacao de sistemas e indicadores", 29, ["implantacao de erp", "implanta erp", "sap", "totvs", "crm", "bi", "power bi", "automacao", "digitalizacao", "gestao logistica", "omnichannel"]],
  ["operational_bottleneck", "gargalo operacional ou atendimento", 32, ["atraso nas entregas", "reclamacoes", "procon", "fila de espera", "problemas no atendimento", "sla", "backlog", "entregas atrasadas", "gargalo", "baixa previsibilidade"]],
  ["commercial_pressure", "pressao comercial/receita", 31, ["queda de vendas", "queda no faturamento", "queda de receita", "queda de matriculas", "evasao escolar", "inadimplencia escolar", "captacao de alunos", "rematricula", "churn", "perda de clientes"]],
  ["financial_pressure", "pressao financeira sem colapso", 29, ["margem pressionada", "prejuizo", "renegocia divida", "capital de giro", "emprestimo", "credito", "fidc", "debenture", "alongamento de divida", "caixa pressionado"]],
  ["leadership_transition", "sucessao, venda ou mudanca de lideranca", 27, ["troca de ceo", "troca de cfo", "novo diretor", "nova diretoria", "sucessao familiar", "busca socio", "socio estrategico", "busca investidor", "venda da empresa", "valuation", "m&a"]],
  ["distress", "crise aberta/distress", 18, ["recuperacao judicial", "pede recuperacao", "demite", "demissoes", "fecha unidade", "fecha fabrica", "corte de funcionarios", "reestruturacao", "turnaround"]]
].map(([type, label, weight, keywords]) => ({ type, label, weight, keywords }));

const CONSULTING_SUPPLY = ["consultoria empresarial", "consultoria especializada", "servicos de consultoria", "nossa consultoria", "somos uma consultoria", "assessoria empresarial", "solucoes para reduzir custos", "como reduzir custos", "como melhorar processos", "guia completo", "curso de", "webinar", "palestra", "treinamento", "ebook", "5 dicas", "10 dicas", "especialista explica"];
const WEAK_CONTENT = ["artigo", "opiniao", "coluna", "podcast", "evento", "premio", "ranking", "levantamento", "pesquisa aponta"];
const PRIVATE_HINTS = ["ltda", "s/a", "sa", "grupo", "rede", "cooperativa", "industria", "logistica", "transportes", "colegio", "escola", "clinica", "franquia", "holding", "brasil"];
const GOVERNMENT_HINTS = ["prefeitura", "governo", "secretaria municipal", "secretaria estadual", "ministerio publico", "tribunal", "camara municipal"];

const FIXTURE = [
  item("Coplana Cooperativa Agroindustrial", "Jaboticabal", "Coplana abre vaga para Gerente de Melhoria Continua", "Vaga exige Lean, TPM/WCM, produtividade, automacao, indicadores e melhoria continua industrial.", "Job board", "https://example.com/coplana-vaga"),
  item("Trinio", "Sao Paulo", "Trinio capta R$ 32 mi e mira crescimento de 5 a 7 vezes", "Fintech quer acelerar expansao, ampliar equipe comercial e estruturar operacao nos proximos 12 meses.", "Noticia", "https://example.com/trinio-aporte"),
  item("Mova", "Sao Paulo", "Mova capta US$ 2 mi para acelerar expansao de eletropostos", "Empresa planeja chegar a 50 pontos de recarga ate o fim de 2026.", "Noticia", "https://example.com/mova-aporte"),
  item("BYD Brasil", "Sao Paulo", "BYD impulsiona vendas, mas enfrenta reclamacoes por atraso nas entregas", "Clientes relatam atraso, problemas de atendimento e gargalos de entrega depois de descontos agressivos.", "Noticia", "https://example.com/byd-reclamacoes"),
  item("Colegio Trinus", "Caxias do Sul", "Colegio Trinus prepara abertura com captacao de recursos e campanha de matriculas", "Escola privada em implantacao precisa estruturar captacao de alunos, operacao e planejamento financeiro.", "Site da escola", "https://example.com/colegio-trinus"),
  item("Industria Orion Ltda", "Campinas", "Industria Orion implanta ERP e contrata gerente de planejamento", "Projeto envolve SAP, S&OP, indicadores, previsibilidade de faturamento e controle de backlog.", "Noticia", "https://example.com/orion-erp"),
  item("Loja Exemplo", "Sao Paulo", "Como reduzir custos na sua empresa com consultoria empresarial", "Nossa consultoria especializada ajuda sua empresa a reduzir custos com 10 dicas.", "Blog consultoria", "https://example.com/consultoria-vende"),
  item("Frigorifico Exemplo Ltda", "Sorocaba", "Frigorifico Exemplo pede recuperacao judicial", "Empresa pede recuperacao judicial e apresenta plano para renegociar dividas.", "Administradora judicial", "https://example.com/frigorifico-rj")
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
  const stateFile = resolve(args.stateFile ?? ".lead-state/state.json");
  await mkdir(runDir, { recursive: true });
  await mkdir(dirname(stateFile), { recursive: true });
  const state = await loadState(stateFile);
  const { rawSignals, sourceReports } = mode === "live" ? await collectLive() : { rawSignals: FIXTURE, sourceReports: [{ name: "fixture", ok: true, records: FIXTURE.length }] };
  const classified = rawSignals.map((raw) => classify(raw));
  const candidates = dedupe(classified.filter((lead) => lead.status === "lead"));
  const { newLeads, repeatedLeads, updatedState } = splitNewLeads(candidates, state);
  const rejectedSignals = classified.filter((lead) => lead.status === "rejected");
  const longList = buildLongList(updatedState);
  const status = operationalStatus({ rawSignals, candidates, newLeads, rejectedSignals, sourceReports, mode });
  const metadata = { run_id: runId, mode, generated_at: new Date().toISOString() };
  const result = { metadata, rawSignals, candidates, newLeads, repeatedLeads, rejectedSignals, longList, sourceReports, status };
  await saveState(stateFile, updatedState);
  await writeArtifacts(runDir, result);
  console.log(`Run: ${runId}`);
  console.log(`Status: ${status.state}`);
  console.log(`Candidates: ${candidates.length}`);
  console.log(`New leads: ${newLeads.length}`);
  console.log(`Long list: ${longList.length}`);
  console.log(`Artifacts: ${runDir}`);
  if (mode === "live" && status.state === "FAIL") process.exitCode = 1;
}

async function collectLive() {
  const rawSignals = [];
  const sourceReports = [];
  try {
    const records = await collectNewsSignals();
    rawSignals.push(...records);
    sourceReports.push({ name: "google-news-rss", ok: true, records: records.length });
  } catch (error) {
    sourceReports.push({ name: "google-news-rss", ok: false, records: 0, error: error.message });
  }
  return { rawSignals, sourceReports };
}

async function collectNewsSignals() {
  const priorityCities = TARGET_CITIES.slice(0, 16).map((city) => city.label);
  const bases = [
    "empresa capta investimento expansao novas unidades",
    "startup capta cresce operacao comercial atendimento",
    "empresa abre nova unidade contrata gerente operacoes",
    "industria implanta ERP SAP contrata controller",
    "vaga gerente melhoria continua industria",
    "vaga controller expansao empresa",
    "gerente planejamento S&OP industria vaga",
    "atraso entregas reclamacoes empresa crescimento",
    "Procon reclamacoes atraso entrega empresa",
    "queda matriculas escola privada inadimplencia",
    "escola privada captacao alunos rematricula",
    "empresa busca investidor socio estrategico expansao",
    "sucessao familiar empresa venda socio",
    "margem pressionada prejuizo capital de giro empresa",
    "rede varejo fecha lojas plano eficiencia",
    "empresa implanta CRM omnichannel atendimento"
  ];
  const queries = [...bases];
  for (const base of bases.slice(0, 12)) for (const city of priorityCities.slice(0, 10)) queries.push(`${base} "${city}"`);
  const records = [];
  for (const query of queries) {
    try { records.push(...await fetchRss(query)); } catch { }
  }
  return records;
}

async function fetchRss(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", `${query} when:21d`);
  url.searchParams.set("hl", "pt-BR");
  url.searchParams.set("gl", "BR");
  url.searchParams.set("ceid", "BR:pt-419");
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "user-agent": "consultoria-lead-hunter/0.1" } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const xml = await response.text();
    return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8).map((match, index) => {
      const block = match[1];
      const title = decodeXml(tag(block, "title"));
      const text = stripHtml(decodeXml(tag(block, "description")));
      return {
        id: `rss-${hash(query + title + index)}`,
        title,
        text,
        company_name: extractCompanyName(`${title} ${text}`),
        city: inferCity(`${title} ${text}`)?.label ?? "",
        source_name: decodeXml(tag(block, "source")) || "Google News RSS",
        source_url: decodeXml(tag(block, "link")),
        published_at: decodeXml(tag(block, "pubDate")),
        detected_at: new Date().toISOString(),
        search_query: query
      };
    }).filter((record) => record.title && record.source_url);
  } finally {
    clearTimeout(timer);
  }
}

function classify(raw) {
  const detectedAt = iso(raw.detected_at ?? raw.published_at);
  const text = norm([raw.title, raw.text, raw.company_name, raw.city, raw.source_name].filter(Boolean).join(" "));
  const supply = hits(text, CONSULTING_SUPPLY);
  if (supply.length) return reject(raw, "consulting_supply_or_generic_advice", `Parece oferta/conteudo de consultoria, nao demanda: ${supply.join(", ")}`, detectedAt);
  const signalMatches = matchedSignals(text);
  if (!signalMatches.length) return reject(raw, "no_fresh_business_pain_signal", "Nao ha gatilho recente de crescimento, processo, receita, caixa, atendimento, sucessao ou gestao.", detectedAt);
  if (!hasPrivateActor(raw, text)) return reject(raw, "no_identifiable_private_company", "Nao ha empresa privada identificavel para abordagem.", detectedAt, signalMatches[0].type);
  const sector = inferSector(text);
  const city = inferCity(raw.city || text);
  const primary = signalMatches[0];
  const weakPenalty = hits(text, WEAK_CONTENT).length ? -10 : 0;
  const score = clamp(primary.weight + (sector?.weight ?? 6) + (city?.weight ?? 5) + recency(detectedAt) + (raw.company_name ? 11 : 4) + (raw.source_url ? 6 : 0) + clamp(signalMatches.length * 5, 0, 14) + (primary.type === "distress" ? -18 : 0) + weakPenalty, 0, primary.type === "distress" ? 72 : 100);
  if (score < 50) return reject(raw, "low_priority_signal", "Sinal existe, mas ficou fraco para prospeccao.", detectedAt, primary.type);
  const company = raw.company_name || extractCompanyName(`${raw.title} ${raw.text}`) || "Empresa privada nao identificada";
  return {
    id: raw.id ?? null,
    status: "lead",
    fingerprint: fingerprint({ ...raw, company_name: company }, primary.type),
    company_name: company,
    sector: sector?.label ?? "setor a confirmar",
    city: city?.label ?? raw.city ?? "",
    source_name: raw.source_name ?? "",
    source_url: raw.source_url ?? "",
    title: raw.title ?? "",
    detected_at: detectedAt,
    signal_type: primary.type,
    signal_label: primary.label,
    pain_level: primary.type === "distress" ? "distress" : score >= 78 ? "active_pain" : "latent_pain",
    score,
    urgency: score >= 82 ? "high" : score >= 66 ? "medium" : "watch",
    rationale: buildRationale(primary, signalMatches, sector, city, company),
    recommended_approach: approach(primary.type, sector?.key),
    who_to_contact: contactRole(primary.type, sector?.key),
    contact_search_url: contactSearchUrl(company),
    why_now: whyNow(primary.type),
    evidence_keywords: signalMatches.flatMap((match) => match.hits),
    raw
  };
}

function matchedSignals(text) {
  return SIGNALS.map((rule) => ({ ...rule, hits: hits(text, rule.keywords) })).filter((rule) => rule.hits.length).sort((a, b) => b.weight - a.weight || b.hits.length - a.hits.length);
}

function dedupe(leads) {
  const kept = [];
  for (const lead of leads) {
    const existing = kept.find((item) => item.fingerprint === lead.fingerprint || (sameCompany(item, lead) && tokenSimilarity(item.title, lead.title) >= 0.28));
    if (!existing) kept.push({ ...lead, duplicate_count: 0, merged_source_urls: uniq([lead.source_url]), merged_titles: uniq([lead.title]) });
    else {
      existing.duplicate_count += 1;
      existing.merged_source_urls = uniq([...existing.merged_source_urls, lead.source_url]);
      existing.merged_titles = uniq([...existing.merged_titles, lead.title]);
      existing.evidence_keywords = uniq([...existing.evidence_keywords, ...lead.evidence_keywords]);
      if (lead.score > existing.score) Object.assign(existing, lead, { duplicate_count: existing.duplicate_count, merged_source_urls: existing.merged_source_urls, merged_titles: existing.merged_titles, evidence_keywords: existing.evidence_keywords });
    }
  }
  return kept.sort((a, b) => b.score - a.score || a.company_name.localeCompare(b.company_name));
}

function splitNewLeads(candidates, state) {
  const now = new Date().toISOString();
  const seen = state.seen ?? {};
  const longList = state.long_list ?? {};
  const newLeads = [];
  const repeatedLeads = [];
  for (const lead of candidates) {
    const key = lead.fingerprint;
    if (seen[key]) {
      repeatedLeads.push({ ...lead, is_new: false, first_seen_at: seen[key].first_seen_at, last_seen_at: now });
      seen[key] = { ...seen[key], last_seen_at: now, seen_count: (seen[key].seen_count ?? 1) + 1 };
    } else {
      newLeads.push({ ...lead, is_new: true, first_seen_at: now, last_seen_at: now });
      seen[key] = { fingerprint: key, first_seen_at: now, last_seen_at: now, seen_count: 1, company_name: lead.company_name, title: lead.title, signal_type: lead.signal_type };
    }
    const current = longList[key];
    longList[key] = current && current.score >= lead.score ? { ...current, last_seen_at: now, seen_count: seen[key].seen_count } : { ...lead, first_seen_at: current?.first_seen_at ?? now, last_seen_at: now, seen_count: seen[key].seen_count };
  }
  return { newLeads, repeatedLeads, updatedState: { version: 1, updated_at: now, seen, long_list: longList } };
}

function buildLongList(state) {
  return Object.values(state.long_list ?? {}).sort((a, b) => b.score - a.score || String(b.last_seen_at).localeCompare(String(a.last_seen_at)));
}

async function loadState(path) {
  if (!existsSync(path)) return { version: 1, seen: {}, long_list: {} };
  try { return JSON.parse(await readFile(path, "utf8")); } catch { return { version: 1, seen: {}, long_list: {} }; }
}

async function saveState(path, state) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2) + "\n");
}

function operationalStatus({ rawSignals, candidates, newLeads, rejectedSignals, sourceReports, mode }) {
  const sourcesOk = sourceReports.filter((source) => source.ok && source.records > 0);
  const sourcesFailed = sourceReports.filter((source) => !source.ok);
  const warnings = [];
  const failures = [];
  if (!sourceReports.length) failures.push("no_sources_configured");
  if (!sourcesOk.length) failures.push("no_source_returned_records");
  if (!rawSignals.length) failures.push("no_raw_signals");
  if (!candidates.length) warnings.push("no_ranked_candidates_this_run");
  if (!newLeads.length) warnings.push("no_new_leads_after_dedupe");
  if (sourcesFailed.length) warnings.push("one_or_more_sources_failed");
  const state = failures.length ? "FAIL" : warnings.length ? "WARNING" : "SUCCESS";
  return { state, mode, generated_at: new Date().toISOString(), counts: { raw_signals: rawSignals.length, ranked_candidates: candidates.length, new_leads: newLeads.length, rejected_signals: rejectedSignals.length, sources_ok: sourcesOk.length, sources_failed: sourcesFailed.length }, sources_ok: sourcesOk.map((s) => s.name), sources_failed: sourcesFailed.map((s) => ({ name: s.name, error: s.error ?? "unknown_error" })), warnings, failures };
}

async function writeArtifacts(runDir, result) {
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, "raw-signals.json"), JSON.stringify(result.rawSignals, null, 2) + "\n");
  await writeFile(join(runDir, "candidates.json"), JSON.stringify(result.candidates, null, 2) + "\n");
  await writeFile(join(runDir, "new-leads.json"), JSON.stringify(result.newLeads, null, 2) + "\n");
  await writeFile(join(runDir, "repeated-leads.json"), JSON.stringify(result.repeatedLeads, null, 2) + "\n");
  await writeFile(join(runDir, "long-list.json"), JSON.stringify(result.longList, null, 2) + "\n");
  await writeFile(join(runDir, "rejected-signals.json"), JSON.stringify(result.rejectedSignals, null, 2) + "\n");
  await writeFile(join(runDir, "operational-status.json"), JSON.stringify(result.status, null, 2) + "\n");
  await writeFile(join(runDir, "run-metadata.json"), JSON.stringify(result.metadata, null, 2) + "\n");
  await writeFile(join(runDir, "new-leads.csv"), toCsv(result.newLeads));
  await writeFile(join(runDir, "long-list.csv"), toCsv(result.longList));
  await writeFile(join(runDir, "summary.md"), toSummary(result));
  await prepareEmail({ runDir, to: "eduardo.minari@gmail.com" });
}

async function prepareEmail(args) {
  const runDir = resolve(args.runDir ?? ".");
  const to = args.to ?? "eduardo.minari@gmail.com";
  const summary = await readFile(join(runDir, "summary.md"), "utf8");
  const status = JSON.parse(await readFile(join(runDir, "operational-status.json"), "utf8"));
  const subject = `Consultoria Lead Hunter - ${status.counts.new_leads} novos - ${status.state}`;
  const body = ["Eduardo,", "", "Segue o radar semanal de leads para consultoria.", "", summary.trim(), "", "Arquivos anexos:", "- new-leads.csv", "- new-leads.json", "- long-list.csv", "- long-list.json", "", "Regra central: o sistema procura gatilhos de dor ou mudanca recente e rejeita conteudo de consultoria vendendo consultoria.", ""].join("\n");
  await writeFile(join(runDir, "email-body.txt"), body);
  await writeFile(join(runDir, "email-subject.txt"), subject + "\n");
  await writeFile(join(runDir, "email-to.txt"), to + "\n");
}

async function selfTest() {
  const consultingAd = classify(item("Consultoria XYZ", "Sao Paulo", "Como reduzir custos na sua empresa com consultoria empresarial", "Nossa consultoria especializada oferece servicos de consultoria.", "Blog", "https://example.com/ad"));
  assert.equal(consultingAd.status, "rejected");
  assert.equal(consultingAd.exclusion_reason, "consulting_supply_or_generic_advice");
  const good = classify(item("Escola Alfa Ltda", "Campinas", "Escola Alfa registra queda de matriculas e reforca captacao de alunos", "Escola privada lida com inadimplencia escolar e rematricula abaixo do esperado.", "Noticia", "https://example.com/escola"));
  assert.equal(good.status, "lead");
  assert.equal(good.signal_type, "commercial_pressure");
  const tempRoot = resolve(`.tmp-consultoria-${Date.now()}`);
  const statePath = join(tempRoot, "state", "state.json");
  const firstRun = join(tempRoot, "run-1");
  await collect({ mode: "fixture", runId: "test-fixture-1", outDir: firstRun, stateFile: statePath });
  const firstStatus = JSON.parse(await readFile(join(firstRun, "operational-status.json"), "utf8"));
  const firstNew = JSON.parse(await readFile(join(firstRun, "new-leads.json"), "utf8"));
  assert.equal(firstStatus.state, "SUCCESS");
  assert.equal(firstNew.length, 7);
  assert.equal(firstNew[0].signal_type === "distress", false);
  assert.equal(firstNew.some((lead) => /consultoria empresarial|como reduzir custos/i.test(lead.title)), false);
  const secondRun = join(tempRoot, "run-2");
  await collect({ mode: "fixture", runId: "test-fixture-2", outDir: secondRun, stateFile: statePath });
  const secondStatus = JSON.parse(await readFile(join(secondRun, "operational-status.json"), "utf8"));
  const secondNew = JSON.parse(await readFile(join(secondRun, "new-leads.json"), "utf8"));
  assert.equal(secondStatus.state, "WARNING");
  assert.equal(secondNew.length, 0);
  await rm(tempRoot, { recursive: true, force: true });
  console.log("All tests passed");
}

function reject(raw, reason, detail, detectedAt, signalType = null) {
  return { id: raw.id ?? null, status: "rejected", company_name: raw.company_name ?? "", city: raw.city ?? "", source_name: raw.source_name ?? "", source_url: raw.source_url ?? "", title: raw.title ?? "", detected_at: detectedAt, signal_type: signalType, score: 0, urgency: "reject", exclusion_reason: reason, exclusion_detail: detail, promotion_allowed: false, raw };
}
function buildRationale(primary, matches, sector, city, company) { return [`${company} tem sinal recente de ${primary.label}`, sector ? `setor ${sector.label}` : "setor a confirmar", city ? `em ${city.label}` : "cidade a confirmar", matches.length > 1 ? `com sinais cruzados: ${matches.slice(1, 3).map((m) => m.label).join(", ")}` : null].filter(Boolean).join("; ") + "."; }
function approach(type, sectorKey) { if (sectorKey === "education") return "Abordar mantenedor/direcao com diagnostico de captacao, rematricula, inadimplencia, atendimento e eficiencia administrativa."; if (type === "expansion_pressure") return "Abordar diretoria/fundadores com organizacao de crescimento: processos, indicadores, caixa, governanca e maquina comercial."; if (type === "management_hiring") return "Abordar a area que esta contratando com apoio rapido para desenhar processos, KPIs e rotina de gestao enquanto a vaga nao fecha."; if (type === "operational_bottleneck") return "Abordar operacoes/atendimento com diagnostico de gargalos, SLA, causa raiz, fila e plano de melhoria em 30 dias."; if (type === "systems_upgrade") return "Abordar financeiro/operacoes/tecnologia com redesenho de processo antes ou durante ERP, CRM ou BI."; if (type === "commercial_pressure") return "Abordar diretoria comercial/financeira com plano de recuperacao de receita, funil, precificacao, retencao e indicadores."; if (type === "leadership_transition") return "Abordar socios/diretoria com pauta de valuation, sucessao, governanca, organizacao financeira e preparacao para investidor."; return "Abordar com diagnostico rapido de crescimento, caixa, processos e indicadores."; }
function contactRole(type, sectorKey) { if (sectorKey === "education") return "mantenedor, diretor geral, diretor financeiro ou coordenador comercial"; if (type === "expansion_pressure") return "fundador, CEO, COO, diretor de expansao ou diretor financeiro"; if (type === "management_hiring") return "diretor da area contratante, RH executivo, COO, CFO ou controller"; if (type === "operational_bottleneck") return "COO, diretor de operacoes, atendimento, logistica ou experiencia do cliente"; if (type === "systems_upgrade") return "CFO, COO, gerente de projeto, tecnologia, controller ou operacoes"; if (type === "commercial_pressure") return "CEO, diretor comercial, marketing, mantenedor ou CFO"; if (type === "leadership_transition") return "socios, conselho, CEO, CFO ou diretor juridico"; return "CEO, CFO, COO ou socios"; }
function whyNow(type) { return ({ expansion_pressure: "Crescimento recente cria risco de perda de controle, caixa, qualidade e atendimento.", management_hiring: "A empresa esta tentando contratar gestao; ha janela para apoio antes da estrutura estabilizar.", systems_upgrade: "ERP/CRM/BI sem processo claro costuma cristalizar problema antigo.", operational_bottleneck: "Reclamacoes e atrasos recentes viram perda de receita e reputacao rapidamente.", commercial_pressure: "Queda de vendas/matriculas/inadimplencia exige acao antes do ciclo seguinte.", financial_pressure: "Pressao de caixa/margem demanda plano financeiro e operacional crivel.", leadership_transition: "Mudanca societaria ou de diretoria abre espaco para organizar numeros e governanca.", distress: "Crise aberta exige resposta rapida, mas deve ser lead de menor prioridade comercial." })[type] ?? "Ha sinal recente de mudanca que pode abrir conversa consultiva."; }
function inferSector(text) { const n = norm(text); return SECTORS.map((s) => ({ ...s, hitCount: hits(n, s.keywords).length })).filter((s) => s.hitCount).sort((a, b) => b.weight + b.hitCount - (a.weight + a.hitCount))[0] ?? null; }
function inferCity(value = "") { const n = norm(value); return TARGET_CITIES.find((city) => n.includes(city.key)) ?? null; }
function hasPrivateActor(raw, text) { if (hits([raw.company_name, raw.source_name].filter(Boolean).join(" "), GOVERNMENT_HINTS).length) return false; return Boolean(raw.company_name && raw.company_name.length > 2) || hits(text, PRIVATE_HINTS).length > 0 || /\b[a-z0-9]+\.com(\.br)?\b/.test(text); }
function extractCompanyName(text) { const value = stripSourceSuffix(String(text).trim()); const explicit = value.match(/\b(?:empresa|grupo|rede|colegio|escola|industria|fintech|startup)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ&.\- ]{2,60})\b/); if (explicit) return cleanCompanyName(explicit[1]); const beforeVerb = value.match(/^([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÀ-ÿ&.\- ]{2,70})\s+(?:capta|captou|recebe|abre|inaugura|contrata|implanta|planeja|busca|enfrenta|registra|pede|fecha|demite|acelera)\b/i); if (beforeVerb) return cleanCompanyName(beforeVerb[1]); return ""; }
function cleanCompanyName(value) { return String(value).replace(/\b(no|na|em|com|para|por|apos|depois|antes|durante)\b.*$/i, "").replace(/\s+/g, " ").trim().slice(0, 80); }
function stripSourceSuffix(value) { return value.replace(/\s+-\s+[^-]{2,50}$/g, "").trim(); }
function fingerprint(raw, signalType) { const company = norm(raw.company_name || extractCompanyName(`${raw.title} ${raw.text}`)); const city = norm(raw.city || inferCity(`${raw.title} ${raw.text}`)?.label || ""); const titleTokens = norm(raw.title).split(" ").filter((token) => token.length > 4).slice(0, 8).join(" "); return hash([company, city, signalType, titleTokens].join("|")); }
function sameCompany(a, b) { return norm(a.company_name) && norm(a.company_name) === norm(b.company_name) && (!a.city || !b.city || norm(a.city) === norm(b.city)); }
function item(company_name, city, title, text, source_name, source_url) { return { id: hash(company_name + title), company_name, city, title, text, source_name, source_url, published_at: "2026-05-24T10:00:00.000Z", detected_at: "2026-05-24T10:00:00.000Z" }; }
function toCsv(leads) { const headers = ["score", "urgency", "signal_type", "company_name", "sector", "city", "title", "who_to_contact", "contact_search_url", "source_url", "recommended_approach"]; return headers.join(",") + "\n" + leads.map((lead) => headers.map((h) => csv(lead[h])).join(",")).join("\n") + "\n"; }
function toSummary(result) { const lines = [`# Consultoria Lead Hunter - ${result.metadata.run_id}`, "", `Status: ${result.status.state}`, `Modo: ${result.metadata.mode}`, `Gerado em: ${result.metadata.generated_at}`, "", "## Contagens", "", `- Sinais brutos: ${result.rawSignals.length}`, `- Candidatos ranqueados: ${result.candidates.length}`, `- Novos leads nesta semana: ${result.newLeads.length}`, `- Long list acumulada: ${result.longList.length}`, `- Rejeitados: ${result.rejectedSignals.length}`, "", "## Novos leads", ""]; for (const lead of result.newLeads.slice(0, 40)) lines.push(`- ${lead.score} | ${lead.company_name} | ${lead.signal_label} | ${lead.city || "cidade a confirmar"} | contato: ${lead.who_to_contact} | ${lead.rationale}`); if (!result.newLeads.length) lines.push("- Nenhum lead novo apos deduplicacao semanal."); if (result.status.warnings.length || result.status.failures.length) { lines.push("", "## Alertas", ""); for (const w of result.status.warnings) lines.push(`- WARNING: ${w}`); for (const f of result.status.failures) lines.push(`- FAIL: ${f}`); } return lines.join("\n") + "\n"; }
function contactSearchUrl(company) { return `https://www.google.com/search?q=${encodeURIComponent(`"${company}" contato diretor financeiro operacoes comercial`)}`; }
function recency(value) { const ts = new Date(value).getTime(); if (!Number.isFinite(ts)) return 6; const days = Math.max(0, Math.floor((Date.now() - ts) / 86400000)); return days <= 7 ? 16 : days <= 21 ? 12 : days <= 45 ? 7 : 2; }
function iso(value) { const d = new Date(value || Date.now()); return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString(); }
function hits(text, keywords) { const n = norm(text); return keywords.filter((k) => contains(n, k)); }
function contains(text, keyword) { const k = norm(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"); return new RegExp(`(^|[^a-z0-9])${k}($|[^a-z0-9])`).test(text); }
function norm(value = "") { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9/@:.+\-\s]/g, " ").replace(/\s+/g, " ").trim(); }
function tokenSimilarity(a, b) { const A = new Set(norm(a).split(" ").filter((t) => t.length > 3)); const B = new Set(norm(b).split(" ").filter((t) => t.length > 3)); if (!A.size || !B.size) return 0; const inter = [...A].filter((t) => B.has(t)).length; return inter / new Set([...A, ...B]).size; }
function tag(block, name) { return block.match(new RegExp(`<${name}(?: [^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1] ?? ""; }
function stripHtml(value) { return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(); }
function decodeXml(value) { return stripHtml(String(value).replaceAll("<![CDATA[", "").replaceAll("]]>", "").replaceAll("&amp;", "&").replaceAll("&quot;", "\"").replaceAll("&#39;", "'").replaceAll("&lt;", "<").replaceAll("&gt;", ">")); }
function uniq(values) { return [...new Set(values.filter(Boolean))]; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function csv(value) { return `"${String(value ?? "").replaceAll("\"", "\"\"")}"`; }
function hash(value) { let h = 0; for (let i = 0; i < String(value).length; i += 1) h = Math.imul(31, h) + String(value).charCodeAt(i) | 0; return Math.abs(h).toString(36); }
function parseArgs(argv) { const out = {}; for (const arg of argv) { if (!arg.startsWith("--")) continue; const [k, v = "true"] = arg.slice(2).split("="); out[k.replace(/-([a-z])/g, (_, l) => l.toUpperCase())] = v; } return out; }
