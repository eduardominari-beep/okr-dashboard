#!/usr/bin/env node
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 9000;
const MAX_HTML_CHARS = 700000;
const BAD_EMAIL_PREFIXES = /^(example|teste|test|privacy|privacidade|abuse|postmaster|webmaster)$/i;
const BAD_DOMAINS = [
  "google.com", "google.com.br", "news.google.com", "facebook.com", "instagram.com", "youtube.com",
  "jusbrasil.com.br", "reclameaqui.com.br", "linkedin.com"
];
const CONTACT_PATH_RE = /contato|contact|fale|atendimento|comercial|franquia|expans|implant|engenharia|facilities|obras|fornecedor/i;
const CNPJ_DATA_DOMAINS = /casadosdados|cnpj\.biz|econodata|empresascnpj|cnpjrocks|consultasocio/i;

export async function enrichContactPublicly(lead, options = {}) {
  const companyName = cleanCompanyName(lead.company_name);
  if (!companyName || /empresa privada nao identificada/i.test(companyName)) {
    return emptyEvidence("Empresa nao identificada; enriquecimento publico nao executado.");
  }

  const candidates = [];
  for (const url of seedUrlsFromLead(lead)) candidates.push({ url, source: "lead_source" });

  const maxSearchResults = Number(options.maxSearchResults ?? 5);
  if (options.search !== false) {
    const resultUrls = await searchPublicWeb(companyName, maxSearchResults);
    for (const url of resultUrls) candidates.push({ url, source: "public_search" });
  }

  const uniqueCandidates = uniqueBy(candidates, (item) => normalizeUrlForKey(item.url))
    .filter((item) => isUsefulUrl(item.url))
    .slice(0, Number(options.maxPages ?? 8));

  const pages = [];
  for (const candidate of uniqueCandidates) {
    const page = await fetchEvidencePage(candidate.url, candidate.source);
    if (!page) continue;
    pages.push(page);
    for (const contactUrl of page.contactLinks.slice(0, 3)) {
      if (uniqueCandidates.some((item) => normalizeUrlForKey(item.url) === normalizeUrlForKey(contactUrl))) continue;
      const contactPage = await fetchEvidencePage(contactUrl, "contact_page");
      if (contactPage) pages.push(contactPage);
    }
  }

  return buildContactEvidence(companyName, pages);
}

export function extractContactEvidence(html, baseUrl) {
  const sourceUrl = safeUrl(baseUrl);
  const base = sourceUrl ? new URL(sourceUrl) : null;
  const text = decodeHtml(stripScripts(html));
  const links = extractLinks(html, base);
  const emails = uniqueBy(extractEmails(text), (value) => value.toLowerCase());
  const phones = uniqueBy(extractPhones(text), (value) => onlyDigits(value)).slice(0, 5);
  const contactLinks = uniqueBy(
    links.filter((url) => CONTACT_PATH_RE.test(url) && isUsefulUrl(url)),
    normalizeUrlForKey
  ).slice(0, 8);
  const linkedinCompany = links.find((url) => /linkedin\.com\/company\//i.test(url)) ?? "not_found";
  const linkedinPeople = links.find((url) => /linkedin\.com\/in\//i.test(url)) ?? "not_found";

  return {
    emails,
    phones,
    contactLinks,
    linkedinCompany,
    linkedinPeople,
    textSample: compact(text).slice(0, 700)
  };
}

export function mergeContactFields(existing, evidence) {
  if (!evidence || evidence.qualidade_contato === "baixa") return existing;
  const currentRank = contactQualityRank(existing.qualidade_contato);
  const evidenceRank = contactQualityRank(evidence.qualidade_contato);
  if (evidenceRank < currentRank) return existing;

  return {
    ...existing,
    contato_prioritario: evidence.contato_prioritario ?? existing.contato_prioritario,
    tipo_contato: evidence.tipo_contato ?? existing.tipo_contato,
    telefone_alta_probabilidade: firstFound(existing.telefone_alta_probabilidade, evidence.telefone_alta_probabilidade),
    email_alta_probabilidade: firstFound(existing.email_alta_probabilidade, evidence.email_alta_probabilidade),
    formulario_ou_pagina_contato: firstFound(existing.formulario_ou_pagina_contato, evidence.formulario_ou_pagina_contato),
    linkedin_empresa: firstFound(existing.linkedin_empresa, evidence.linkedin_empresa),
    linkedin_decisor: firstFound(existing.linkedin_decisor, evidence.linkedin_decisor),
    fonte_contato_url: firstFound(existing.fonte_contato_url, evidence.fonte_contato_url),
    qualidade_contato: evidenceRank >= currentRank ? evidence.qualidade_contato : existing.qualidade_contato,
    comentario_contato: evidence.comentario_contato ?? existing.comentario_contato,
    contact_enrichment_mode: evidence.contact_enrichment_mode,
    contact_enrichment_sources: evidence.contact_enrichment_sources
  };
}

function buildContactEvidence(companyName, pages) {
  if (!pages.length) return emptyEvidence("Nenhuma pagina publica util encontrada para contato.");

  const scoredPages = pages.map((page) => ({
    ...page,
    score: pageScore(companyName, page)
  })).sort((a, b) => b.score - a.score);

  const officialPages = scoredPages.filter((page) => page.isOfficial);
  const official = officialPages[0];
  const anyPage = scoredPages[0];
  const allPhones = uniqueBy(scoredPages.flatMap((page) => page.phones), (phone) => onlyDigits(phone)).slice(0, 3);
  const allEmails = uniqueBy(scoredPages.flatMap((page) => page.emails), (email) => email.toLowerCase()).slice(0, 3);
  const allForms = uniqueBy(scoredPages.flatMap((page) => page.contactLinks), normalizeUrlForKey).slice(0, 3);
  const linkedinCompany = scoredPages.map((page) => page.linkedinCompany).find((url) => url && url !== "not_found") ?? "not_found";
  const linkedinPeople = scoredPages.map((page) => page.linkedinPeople).find((url) => url && url !== "not_found") ?? "not_found";
  const bestSource = official ?? anyPage;
  const hasDirect = allPhones.length > 0 || allEmails.length > 0;
  const hasRoute = hasDirect || allForms.length > 0 || linkedinCompany !== "not_found";
  const quality = contactQuality({ bestSource, hasDirect, hasRoute });

  if (quality === "baixa") return emptyEvidence("Paginas publicas encontradas, mas sem telefone, e-mail, formulario ou LinkedIn confiavel.");

  return {
    contato_prioritario: inferContactPersona(bestSource),
    tipo_contato: bestSource.isOfficial ? "site oficial / contato publico" : bestSource.isCnpjData ? "base publica CNPJ / contato cadastral" : "fonte publica nao oficial",
    telefone_alta_probabilidade: allPhones.join(" / ") || "not_found",
    email_alta_probabilidade: allEmails.join(" / ") || "not_found",
    formulario_ou_pagina_contato: allForms[0] ?? (bestSource.isContactPage ? bestSource.url : "not_found"),
    linkedin_empresa: linkedinCompany,
    linkedin_decisor: linkedinPeople,
    fonte_contato_url: bestSource.url,
    qualidade_contato: quality,
    comentario_contato: `${bestSource.isOfficial ? "Contato encontrado em fonte oficial." : "Contato encontrado em fonte publica; validar antes de disparo."} ${bestSource.evidenceSummary}`,
    contact_enrichment_mode: "public_web_contact_enrichment",
    contact_enrichment_sources: scoredPages.slice(0, 5).map((page) => ({
      url: page.url,
      source: page.source,
      official: page.isOfficial,
      phones: page.phones.slice(0, 2),
      emails: page.emails.slice(0, 2),
      contact_links: page.contactLinks.slice(0, 2)
    }))
  };
}

async function searchPublicWeb(companyName, limit) {
  const queries = [
    `${companyName} contato telefone email`,
    `${companyName} site oficial contato`,
    `${companyName} CNPJ telefone`
  ];
  const urls = [];
  for (const query of queries) {
    const searchUrl = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    try {
      const html = await fetchText(searchUrl, DEFAULT_TIMEOUT_MS);
      urls.push(...extractSearchUrls(html));
      if (urls.length >= limit) break;
    } catch {
      // Search is best-effort; missing search results should not fail the run.
    }
  }
  return uniqueBy(urls, normalizeUrlForKey).slice(0, limit);
}

async function fetchEvidencePage(url, source) {
  const safe = safeUrl(url);
  if (!safe || !isUsefulUrl(safe)) return null;
  try {
    const html = await fetchText(safe, DEFAULT_TIMEOUT_MS);
    const evidence = extractContactEvidence(html, safe);
    const host = new URL(safe).hostname.toLowerCase();
    return {
      url: safe,
      source,
      host,
      isContactPage: CONTACT_PATH_RE.test(safe),
      isCnpjData: CNPJ_DATA_DOMAINS.test(host),
      isOfficial: false,
      evidenceSummary: `${evidence.phones.length} telefone(s), ${evidence.emails.length} e-mail(s), ${evidence.contactLinks.length} rota(s) de contato.`,
      ...evidence
    };
  } catch {
    return null;
  }
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "Mozilla/5.0 obra-hunter-ai contact-enrichment/0.2",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.6"
      }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!/html|text|xml|json/i.test(contentType)) throw new Error(`Unsupported content type: ${contentType}`);
    return (await response.text()).slice(0, MAX_HTML_CHARS);
  } finally {
    clearTimeout(timer);
  }
}

function pageScore(companyName, page) {
  const host = page.host;
  const tokens = companyTokens(companyName);
  const official = tokens.some((token) => host.includes(token)) && !CNPJ_DATA_DOMAINS.test(host);
  page.isOfficial = official;
  let score = 0;
  if (official) score += 50;
  if (page.isContactPage) score += 15;
  if (page.isCnpjData) score += 18;
  if (page.phones.length) score += 20;
  if (page.emails.length) score += 20;
  if (page.contactLinks.length) score += 10;
  if (page.linkedinCompany !== "not_found") score += 7;
  if (BAD_DOMAINS.some((domain) => host.endsWith(domain))) score -= 50;
  return score;
}

function contactQuality({ bestSource, hasDirect, hasRoute }) {
  if (!bestSource || !hasRoute) return "baixa";
  if (bestSource.isOfficial && hasDirect) return "alta";
  if (bestSource.isOfficial && hasRoute) return "media_alta";
  if (bestSource.isCnpjData && hasDirect) return "media_alta";
  if (hasDirect) return "media";
  return "baixa";
}

function inferContactPersona(page) {
  const text = `${page.url} ${page.textSample}`;
  if (/franquia|expans/i.test(text)) return "expansao, franquias, implantacao ou novos negocios";
  if (/engenharia|obra|facilities|manutencao/i.test(text)) return "engenharia, facilities, obras ou manutencao";
  if (/comercial|atendimento|vendas/i.test(text)) return "comercial/atendimento; pedir responsavel por obras, expansao ou facilities";
  return "expansao, engenharia, facilities, obras ou compras";
}

function extractSearchUrls(html) {
  const urls = [];
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const raw = decodeHtml(match[1]);
    const decoded = decodeDuckDuckGoUrl(raw);
    if (decoded && /^https?:\/\//i.test(decoded)) urls.push(decoded);
  }
  return urls.filter(isUsefulUrl);
}

function decodeDuckDuckGoUrl(raw) {
  try {
    const absolute = raw.startsWith("//") ? `https:${raw}` : raw.startsWith("/") ? `https://duckduckgo.com${raw}` : raw;
    const url = new URL(absolute);
    const uddg = url.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : absolute;
  } catch {
    return raw;
  }
}

function extractLinks(html, base) {
  const links = [];
  for (const match of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    try {
      const url = base ? new URL(decodeHtml(match[1]), base).toString() : decodeHtml(match[1]);
      if (/^https?:\/\//i.test(url)) links.push(url);
    } catch {
      // Ignore malformed links.
    }
  }
  return uniqueBy(links, normalizeUrlForKey);
}

function extractEmails(text) {
  return [...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)]
    .map((match) => match[0].replace(/[),.;:]+$/, ""))
    .filter((email) => {
      const [prefix, domain] = email.split("@");
      if (!prefix || !domain || BAD_EMAIL_PREFIXES.test(prefix)) return false;
      if (/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/i.test(email)) return false;
      return true;
    });
}

function extractPhones(text) {
  const phones = [];
  for (const match of text.matchAll(/(?:\+?55[\s.-]*)?(?:\(?\d{2}\)?[\s.-]*)?(?:9[\s.-]*)?\d{4}[\s.-]?\d{4}/g)) {
    const formatted = formatBrazilPhone(match[0]);
    if (formatted) phones.push(formatted);
  }
  return phones;
}

function formatBrazilPhone(value) {
  let digits = onlyDigits(value);
  if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return null;
  if (/^0+$/.test(digits)) return null;
  const ddd = digits.slice(0, 2);
  const local = digits.slice(2);
  if (Number(ddd) < 11 || Number(ddd) > 99) return null;
  if (local.length === 8) return `(${ddd}) ${local.slice(0, 4)}-${local.slice(4)}`;
  return `(${ddd}) ${local.slice(0, 5)}-${local.slice(5)}`;
}

function seedUrlsFromLead(lead) {
  return [lead.source_url, lead.raw?.source_url, lead.formulario_ou_pagina_contato, lead.fonte_contato_url]
    .filter(Boolean)
    .filter((url) => /^https?:\/\//i.test(url));
}

function isUsefulUrl(raw) {
  const url = safeUrl(raw);
  if (!url) return false;
  const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  if (BAD_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))) return false;
  if (/\.(pdf|zip|rar|7z|jpg|jpeg|png|gif|webp|svg)$/i.test(new URL(url).pathname)) return false;
  return true;
}

function safeUrl(raw) {
  try {
    const url = new URL(String(raw));
    if (!/^https?:$/i.test(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function cleanCompanyName(value) {
  return String(value ?? "")
    .replace(/\b(ltda|eireli|s\/a|s\.a\.|sa|me|epp|industria|comercio|servicos|participacoes)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function companyTokens(value) {
  const stop = new Set(["de", "da", "do", "das", "dos", "e", "com", "brasil", "grupo", "rede"]);
  return normalize(value).split(" ").filter((token) => token.length >= 4 && !stop.has(token)).slice(0, 4);
}

function firstFound(current, candidate) {
  return current && current !== "not_found" ? current : candidate && candidate !== "not_found" ? candidate : "not_found";
}

function contactQualityRank(value) {
  if (/^alta/i.test(value ?? "")) return 4;
  if (/media_alta/i.test(value ?? "")) return 3;
  if (/media/i.test(value ?? "")) return 2;
  return 1;
}

function emptyEvidence(comment) {
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
    comentario_contato: comment,
    contact_enrichment_mode: "public_web_contact_enrichment",
    contact_enrichment_sources: []
  };
}

function stripScripts(value) {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function compact(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeUrlForKey(value) {
  const safe = safeUrl(value);
  if (!safe) return String(value ?? "");
  const url = new URL(safe);
  url.searchParams.sort();
  return url.toString().replace(/\/$/, "");
}

function uniqueBy(values, keyFn) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const key = keyFn(value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export async function selfTest() {
  const html = `
    <html><body>
      <a href="/contato">Contato</a>
      <a href="https://www.linkedin.com/company/acme-obras/">LinkedIn</a>
      Fale conosco: comercial@acmeobras.com.br ou (11) 98765-4321.
    </body></html>`;
  const evidence = extractContactEvidence(html, "https://www.acmeobras.com.br/");
  assert.deepEqual(evidence.emails, ["comercial@acmeobras.com.br"]);
  assert.deepEqual(evidence.phones, ["(11) 98765-4321"]);
  assert.equal(evidence.contactLinks[0], "https://www.acmeobras.com.br/contato");
  assert.equal(evidence.linkedinCompany, "https://www.linkedin.com/company/acme-obras/");

  const merged = mergeContactFields(
    { telefone_alta_probabilidade: "not_found", email_alta_probabilidade: "not_found", formulario_ou_pagina_contato: "not_found", qualidade_contato: "baixa" },
    { telefone_alta_probabilidade: "(11) 98765-4321", email_alta_probabilidade: "not_found", formulario_ou_pagina_contato: "https://www.acmeobras.com.br/contato", qualidade_contato: "alta", fonte_contato_url: "https://www.acmeobras.com.br/contato" }
  );
  assert.equal(merged.telefone_alta_probabilidade, "(11) 98765-4321");
  assert.equal(merged.qualidade_contato, "alta");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href && process.argv[2] === "test") {
  await selfTest();
  console.log("Contact enrichment tests passed");
}
