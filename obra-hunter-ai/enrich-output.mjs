#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const PREDICTIVE = ["segundo semestre de 2026", "2o semestre de 2026", "2º semestre de 2026", "2027", "2028", "2029", "previsao", "previsão", "prevista", "previsto", "deve abrir", "vai abrir", "ira abrir", "irá abrir", "projeta abrir", "planeja abrir", "em implantacao", "em implantação", "obras em andamento", "em construcao", "em construção"];
const WINNABLE = ["franquia", "franqueado", "franqueados", "rede regional", "galeria", "lojas de apoio", "mall", "restaurante", "academia", "clinica", "clínica", "laboratorio", "laboratório", "showroom", "padaria", "cafeteria", "loja-produtora", "unidades em implantacao", "unidades em implantação", "novas unidades", "ponto comercial", "expansao em sao paulo", "expansão em são paulo"];
const HEAVY = ["smart fit", "assaí", "assai", "hapvida", "c&a", "cea", "santander", "iguatemi", "ascenty", "porte engenharia", "racional engenharia"];
const STARTED = ["obra iniciada", "obras iniciadas", "iniciou a obra", "iniciou as obras", "obra em andamento", "obras em andamento", "em construcao", "em construção", "ritmo acelerado", "canteiro", "fase de obra", "execucao da obra", "execução da obra"];
const POST = ["inaugurou", "inaugurada", "inaugurado", "recem-inaugurada", "recém-inaugurada", "recem inaugurada", "recém inaugurada", "entregue", "foi entregue", "passou a operar", "inicia operacao", "inicia operação"];

const CONTACTS = [
  contact(["krispy kreme"], "Joao Luiz Marcola / Krispy Kreme Brasil; time de expansao/operacoes", "executivo/linkedin + formulario oficial", "not_found", "not_found", "https://br.krispykreme.com/pages/contato", "https://www.linkedin.com/company/krispy-kreme-brasil/", "https://br.linkedin.com/in/jo%C3%A3o-luiz-mar%C3%A7ola-66968330", "https://br.krispykreme.com/pages/contato", "media", "Sem telefone/e-mail publico confiavel; melhor rota e formulario oficial + LinkedIn executivo."),
  contact(["max atacadista", "grupo muffato", "muffato"], "Muffato Malls / Grupo Muffato - comercializacao de lojas de apoio", "telefone corporativo + pagina imobiliaria/comercial", "(45) 4009-5003", "not_found", "https://www.muffatomalls.com/", "https://www.linkedin.com/company/grupo-muffato/", "not_found", "https://grupomuffato.com.br/imprensa/grupo-muffato-anuncia-chegada-da-terceira-unidade-do-max-atacadista-em-sorocaba-ipanema-sp/p", "alta_para_mall_media_para_obra_principal", "Contato bom para lojas de apoio/mall; obra principal pode exigir compras/engenharia do grupo."),
  contact(["poupe real"], "Poupe Real Supermercados - atendimento corporativo; LinkedIn empresa e diretoria local", "telefone + e-mail oficial", "(19) 3844-7525", "atendimento@poupereal.com.br", "https://poupereal.com.br/contato/", "https://br.linkedin.com/company/pouperealsupermercados", "not_found", "https://poupereal.com.br/contato/", "alta", "Contato oficial direto encontrado; abordagem deve pedir expansao/engenharia/compras."),
  contact(["greenlife"], "Greenlife Academias - expansao/operacoes", "telefone + e-mail oficial", "(11) 5118-1700 / (11) 93927-9440", "contato@greenlifeacademias.com.br", "https://greenlifeacademias.com.br/contato/", "https://www.linkedin.com/company/greenlife-academias/", "not_found", "https://greenlifeacademias.com.br/contato/", "alta", "Contato oficial bom para pedir responsavel por implantacao das novas unidades."),
  contact(["panobianco"], "Panobianco Academias - expansao/franquias", "e-mail oficial + institucional", "not_found", "contato@panobiancoacademia.com.br", "https://panobiancoacademia.com.br/institucional/", "https://www.linkedin.com/company/panobiancoacademia/", "not_found", "https://panobiancoacademia.com.br/institucional/", "media_alta", "E-mail institucional encontrado; confirmar responsavel por franquias/implantacao."),
  contact(["carflix"], "Carflix - expansao/franquias e operacoes", "telefone + e-mail official + pagina de franquia", "(11) 3035-2199", "contato@carflix.com.br", "https://www.carflix.com.br/sua-carflix", "https://www.linkedin.com/company/carflix/", "not_found", "https://www.carflix.com.br/contato", "alta", "Contato oficial e rota de franquia/expansao encontrados."),
  contact(["giuliana flores", "giulianaflores"], "Giuliana Flores - franquias/expansao", "telefone + e-mail corporativo + pagina de franquia", "(11) 3383-1700 / (11) 4224-9930", "marketing.corp@giulianaflores.com.br", "https://franquia.giulianaflores.com.br/", "https://www.linkedin.com/company/giulianaflores/", "not_found", "https://franquia.giulianaflores.com.br/", "media_alta", "Contato corporativo encontrado; validar se direciona para obras/implantacao das franquias."),
  contact(["l entrecote", "entrecote de paris", "lentrecote"], "L'Entrecote de Paris - expansao/franquias", "telefone + e-mail de franquia", "(11) 94254-4286", "elaine.sousa@lentrecotedeparis.com.br", "https://lentrecotedeparis.com.br/sejaumfranqueado", "https://www.linkedin.com/company/lentrec%C3%B4te-de-paris/", "not_found", "https://guiainternacional.franchisingbrasil.com/l-entrecote-de-paris-en", "alta_mas_confirmar_atualidade", "Contato de franquia encontrado em guia publico; confirmar atualidade antes do disparo."),
  contact(["divino fogao", "divino fogão"], "Divino Fogao - franquias/novos negocios", "telefone + formulario de franquia", "(11) 3811-1560", "not_found", "https://www.divinofogao.com.br/seja-um-franqueado", "https://www.linkedin.com/company/divino-fogao/", "not_found", "https://www.divinofogao.com.br/seja-um-franqueado", "media", "Rota de franquia encontrada; e-mail direto nao encontrado com confianca."),
  contact(["mundo pao do olivier", "mundo pão do olivier", "olivier"], "Mundo Pao do Olivier - administracao/expansao", "telefone + e-mail publico", "(11) 3237-4087 / (11) 2154-3141", "tatiane@mundopaodoolivier.com.br", "https://www.mundopaodoolivier.com.br/contact/", "not_found", "not_found", "https://www.diariocidade.com/sp/sao-paulo/guia/mundo-pao-do-olivier-04750643000103/", "media_alta", "Telefone/e-mail publico encontrados; confirmar responsavel por expansao.")
];

const args = parseArgs(process.argv.slice(2));
const runDir = resolve(args.runDir ?? ".");
const rankedPath = join(runDir, "ranked-leads.json");
const statusPath = join(runDir, "operational-status.json");
const metadataPath = join(runDir, "run-metadata.json");

const leads = JSON.parse(await readFile(rankedPath, "utf8"));
const status = JSON.parse(await readFile(statusPath, "utf8"));
const metadata = JSON.parse(await readFile(metadataPath, "utf8"));

const rejectedByPost = [];
const enriched = [];
for (const lead of leads) {
  const text = leadText(lead);
  const postHits = hits(text, POST);
  const heavyHits = hits(text, HEAVY);
  if (postHits.length || heavyHits.length) {
    rejectedByPost.push({
      ...lead,
      exclusion_reason: postHits.length ? "post_work_not_preventive" : "heavy_homologation_low_win",
      exclusion_detail: postHits.length ? `Obra parece entregue/inaugurada: ${postHits.join(", ")}` : `Baixa chance de concorrencia aberta: ${heavyHits.join(", ")}`
    });
    continue;
  }
  enriched.push(enrich(lead));
}

enriched.sort(compareSalesPriority);
status.counts.ranked_leads = enriched.length;
status.counts.rejected_signals = (status.counts.rejected_signals ?? 0) + rejectedByPost.length;
if (enriched.length === 0 && !status.failures.includes("no_ranked_private_leads")) status.failures.push("no_ranked_private_leads");
status.state = status.failures.length ? "FAIL" : status.warnings.length ? "WARNING" : "SUCCESS";
status.enrichment = {
  contact_fields_added: true,
  removed_after_sales_filter: rejectedByPost.length,
  contacts_with_phone: enriched.filter((lead) => lead.telefone_alta_probabilidade && lead.telefone_alta_probabilidade !== "not_found").length,
  contacts_with_email: enriched.filter((lead) => lead.email_alta_probabilidade && lead.email_alta_probabilidade !== "not_found").length
};

await writeFile(rankedPath, `${JSON.stringify(enriched, null, 2)}\n`, "utf8");
await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8");
await writeFile(join(runDir, "leads.csv"), toCsv(enriched), "utf8");
await writeFile(join(runDir, "summary.md"), toSummary({ metadata, status, leads: enriched }), "utf8");
await prepareEmail(runDir, status, enriched);

console.log(`Enriched contacts: ${enriched.length}`);
console.log(`With phone: ${status.enrichment.contacts_with_phone}`);
console.log(`With email: ${status.enrichment.contacts_with_email}`);
console.log(`Filtered after sales rules: ${rejectedByPost.length}`);

function enrich(lead) {
  const text = leadText(lead);
  const predictive = hits(text, PREDICTIVE);
  const started = hits(text, STARTED);
  const winnable = hits(text, WINNABLE);
  const contactFields = findKnownContact(text) ?? unknownContact();
  const scope = lead.matched_offerings?.map((item) => item.label).join(", ") || "obra civil, pintura, eletrica/hidraulica e adequacoes";
  const chance = chanceFor({ predictive, started, winnable, signalType: lead.signal_type });
  return {
    ...lead,
    chance_concorrencia: chance,
    motivo_filtro: filterReason({ predictive, started, winnable, signalType: lead.signal_type }),
    prioridade: priorityFor(chance, contactFields.qualidade_contato),
    trilha: predictive.length ? "pre-obra: abordar antes da escolha final de fornecedores" : started.length ? "obra iniciada: buscar empreiteiro/compras para pacote parcial" : "qualificar cronograma, concorrencia e responsavel por implantacao",
    sinal_pre_obra: predictive.length ? "sim" : started.length ? "obra_iniciada" : "precisa_qualificar_cronograma",
    janela: predictive.length ? predictive.slice(0, 4).join(", ") : started.length ? "obra ja iniciada; buscar empreiteiro/compras" : "qualificar prazo e concorrencia",
    ticket_estimado_pacote_lg: ticketEstimate(lead.signal_type),
    escopo_lg_provavel: scope,
    quem_abordar_antes_da_empreiteira: personaFor(lead.signal_type, started),
    contato_prioritario: contactFields.contato_prioritario,
    tipo_contato: contactFields.tipo_contato,
    telefone_alta_probabilidade: contactFields.telefone_alta_probabilidade,
    email_alta_probabilidade: contactFields.email_alta_probabilidade,
    formulario_ou_pagina_contato: contactFields.formulario_ou_pagina_contato,
    linkedin_empresa: contactFields.linkedin_empresa,
    linkedin_decisor: contactFields.linkedin_decisor,
    fonte_contato_url: contactFields.fonte_contato_url,
    qualidade_contato: contactFields.qualidade_contato,
    comentario_contato: contactFields.comentario_contato,
    mensagem_sugerida_contato: `Ola, vi um sinal recente de expansao/implantacao de ${lead.company_name || "a empresa"}${lead.city ? ` em ${lead.city}` : ""}. A Sistema LG atua com ${scope}. Voces ja definiram fornecedores para os proximos pacotes de obra ou ainda existe concorrencia aberta para fachada, vidro, pintura, cobertura, civil, eletrica ou hidraulica?`
  };
}

function findKnownContact(text) {
  const normalized = norm(text);
  return CONTACTS.find((entry) => entry.aliases.some((alias) => normalized.includes(norm(alias)))) ?? null;
}

function unknownContact() {
  return {
    contato_prioritario: "expansao, engenharia, facilities, obras ou compras",
    tipo_contato: "precisa qualificar contato direto",
    telefone_alta_probabilidade: "not_found",
    email_alta_probabilidade: "not_found",
    formulario_ou_pagina_contato: "not_found",
    linkedin_empresa: "not_found",
    linkedin_decisor: "not_found",
    fonte_contato_url: "not_found",
    qualidade_contato: "baixa",
    comentario_contato: "Automacao ainda nao encontrou telefone/e-mail publico confiavel; validar contato antes de abordagem fria."
  };
}

function prepareEmail(runDir, status, leads) {
  const topContacts = leads.slice(0, 8).map((lead, index) => `${index + 1}. ${lead.company_name} | ${lead.city} | ${lead.prioridade} | contato: ${lead.contato_prioritario} | tel: ${lead.telefone_alta_probabilidade} | e-mail: ${lead.email_alta_probabilidade}`);
  const subject = `Obra Hunter AI - ${status.state} - ${status.counts.ranked_leads} leads com contato`;
  const body = [
    "Eduardo.",
    "",
    "Segue o radar semanal de oportunidades privadas de obra, priorizando concorrencia ganhavel, pre-obra e pacotes comerciais entre R$300k e R$10M.",
    "",
    "Top contatos para acao comercial:",
    ...(topContacts.length ? topContacts : ["- Nenhum lead acionavel nesta execucao."]),
    "",
    "Arquivos anexos:",
    "- leads.csv, ja com telefone/e-mail quando encontrados, formulario, LinkedIn, qualidade do contato e mensagem sugerida",
    "- ranked-leads.json",
    "",
    "Observacao: licitacoes, pregoes, editais publicos, manutencao urbana generica, obras ja entregues e atores com baixa chance de concorrencia aberta sao rejeitados antes do ranking comercial.",
    ""
  ].join("\n");
  return Promise.all([
    writeFile(join(runDir, "email-body.txt"), body, "utf8"),
    writeFile(join(runDir, "email-subject.txt"), `${subject}\n`, "utf8")
  ]);
}

function toCsv(leads) {
  const headers = ["score", "prioridade", "chance_concorrencia", "trilha", "sinal_pre_obra", "janela", "commercial_fit", "estimated_ticket_band", "ticket_estimado_pacote_lg", "escopo_lg_provavel", "quem_abordar_antes_da_empreiteira", "contato_prioritario", "tipo_contato", "telefone_alta_probabilidade", "email_alta_probabilidade", "formulario_ou_pagina_contato", "linkedin_empresa", "linkedin_decisor", "fonte_contato_url", "qualidade_contato", "comentario_contato", "mensagem_sugerida_contato", "motivo_filtro", "company_name", "city", "signal_type", "title", "source_url", "recommended_approach"];
  return `${headers.join(",")}\n${leads.map((lead) => headers.map((header) => csv(lead[header])).join(",")).join("\n")}\n`;
}

function toSummary({ metadata, status, leads }) {
  const lines = [
    `# Obra Hunter AI - ${metadata.run_id}`,
    "",
    `Status: ${status.state}`,
    `Modo: ${metadata.mode}`,
    `Gerado em: ${metadata.generated_at}`,
    "",
    "## Contatos",
    "",
    `- Leads ranqueados: ${leads.length}`,
    `- Com telefone: ${status.enrichment.contacts_with_phone}`,
    `- Com e-mail: ${status.enrichment.contacts_with_email}`,
    `- Removidos por filtro comercial pos-coleta: ${status.enrichment.removed_after_sales_filter}`,
    "",
    "## Top leads",
    ""
  ];
  for (const lead of leads.slice(0, 10)) {
    lines.push(`- ${lead.score} | ${lead.prioridade} | ${lead.company_name} | ${lead.city} | ${lead.chance_concorrencia} | contato: ${lead.contato_prioritario} | tel: ${lead.telefone_alta_probabilidade} | email: ${lead.email_alta_probabilidade}`);
  }
  if (!leads.length) lines.push("- Nenhum lead privado acionavel nesta execucao.");
  if (status.warnings.length || status.failures.length) {
    lines.push("", "## Alertas", "");
    for (const warning of status.warnings) lines.push(`- WARNING: ${warning}`);
    for (const failure of status.failures) lines.push(`- FAIL: ${failure}`);
  }
  return `${lines.join("\n")}\n`;
}

function chanceFor({ predictive, started, winnable, signalType }) {
  if (predictive.length && winnable.length) return "alta";
  if (winnable.length) return "media_alta";
  if (started.length) return "media";
  if (["predictive_rollout", "commercial_expansion", "building_systems_upgrade", "corporate_fitout", "construction_hiring_signal"].includes(signalType)) return "media_alta";
  return "media";
}

function priorityFor(chance, contactQuality) {
  if (chance === "alta" && /^alta/.test(contactQuality)) return "P0";
  if (["alta", "media_alta"].includes(chance)) return "P1";
  return "P2";
}

function filterReason({ predictive, started, winnable, signalType }) {
  const parts = [];
  if (predictive.length) parts.push(`janela preditiva: ${predictive.slice(0, 3).join(", ")}`);
  if (started.length) parts.push(`obra iniciada: ${started.slice(0, 3).join(", ")}`);
  if (winnable.length) parts.push(`concorrencia acessivel: ${winnable.slice(0, 3).join(", ")}`);
  if (!parts.length) parts.push(`sinal privado ${signalType}; precisa qualificar se concorrencia esta aberta`);
  return parts.join(" | ");
}

function ticketEstimate(signalType) {
  if (["industrial_expansion", "warehouse_or_logistics"].includes(signalType)) return "R$1M-R$10M em pacote parcial";
  if (["commercial_expansion", "predictive_rollout"].includes(signalType)) return "R$300k-R$2M por unidade ou pacote";
  if (["corporate_fitout", "building_systems_upgrade"].includes(signalType)) return "R$300k-R$1.5M";
  return "R$300k-R$10M, sujeito a escopo";
}

function personaFor(signalType, started) {
  if (started.length) return "empreiteiro principal, compras, engenharia ou gerente de obra";
  if (["commercial_expansion", "predictive_rollout"].includes(signalType)) return "expansao, novos negocios, franquias, implantacao ou operacoes";
  if (["industrial_expansion", "warehouse_or_logistics"].includes(signalType)) return "engenharia, expansao, manutencao industrial ou compras";
  if (["corporate_fitout", "building_systems_upgrade"].includes(signalType)) return "facilities, engenharia, obras ou compras";
  return "expansao, engenharia, facilities ou compras";
}

function compareSalesPriority(a, b) {
  const priorities = { P0: 0, P1: 1, P2: 2, P3: 3 };
  const chances = { alta: 0, media_alta: 1, media: 2, baixa: 3 };
  return (priorities[a.prioridade] ?? 9) - (priorities[b.prioridade] ?? 9) ||
    (chances[a.chance_concorrencia] ?? 9) - (chances[b.chance_concorrencia] ?? 9) ||
    b.score - a.score ||
    String(a.company_name).localeCompare(String(b.company_name));
}

function leadText(lead) {
  return [lead.company_name, lead.title, lead.rationale, lead.recommended_approach, lead.city, lead.source_name, lead.raw?.text, lead.raw?.title, lead.raw?.company_name, lead.raw?.raw_query].filter(Boolean).join(" ");
}

function hits(text, keywords) {
  const normalized = norm(text);
  return keywords.filter((keyword) => contains(normalized, keyword));
}

function contains(text, keyword) {
  const normalized = norm(keyword).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${normalized}($|[^a-z0-9])`).test(text);
}

function norm(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9/@:.+\-\s]/g, " ").replace(/\s+/g, " ").trim();
}

function csv(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function contact(aliases, contato_prioritario, tipo_contato, telefone_alta_probabilidade, email_alta_probabilidade, formulario_ou_pagina_contato, linkedin_empresa, linkedin_decisor, fonte_contato_url, qualidade_contato, comentario_contato) {
  return { aliases, contato_prioritario, tipo_contato, telefone_alta_probabilidade, email_alta_probabilidade, formulario_ou_pagina_contato, linkedin_empresa, linkedin_decisor, fonte_contato_url, qualidade_contato, comentario_contato };
}

function parseArgs(argv) {
  const out = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, value = "true"] = arg.slice(2).split("=");
    out[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  return out;
}
