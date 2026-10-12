import crypto from 'node:crypto';
import net from 'node:net';
import { get, put } from '@vercel/blob';
import { z } from 'zod';

const REGISTRY_PATH = 'competitors/registry.json';
const DEFAULT_COMPETITORS = [
  { name: 'ALLEN', baseUrl: 'https://www.allen.in/', domain: 'allen.in', tags: ['neet', 'jee', 'national'], enabled: true, source: 'seed' },
  { name: 'Aakash', baseUrl: 'https://www.aakash.ac.in/', domain: 'aakash.ac.in', tags: ['neet', 'jee', 'national'], enabled: true, source: 'seed' },
  { name: 'Physics Wallah', baseUrl: 'https://www.pw.live/', domain: 'pw.live', tags: ['neet', 'jee', 'national'], enabled: true, source: 'seed' },
  { name: 'NEETprep', baseUrl: 'https://www.neetprep.com/', domain: 'neetprep.com', tags: ['neet', 'practice', 'national'], enabled: true, source: 'seed' },
  { name: 'Vedantu', baseUrl: 'https://www.vedantu.com/', domain: 'vedantu.com', tags: ['neet', 'jee', 'national'], enabled: true, source: 'seed' }
];

const STOPWORDS = new Set(['www','com','in','the','and','for','with','from','this','that','your','you','our','are','was','were','has','have','had','how','what','why','when','where','who','best','top','online','course','courses','class','classes','exam','exams','2025','2026','2027','2028','neet','jee']);

function token() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Private Blob storage is not configured.');
  return process.env.BLOB_READ_WRITE_TOKEN;
}

async function loadJson(path, fallback = null) {
  try {
    const r = await get(path, { access: 'private', token: token() });
    if (!r || r.statusCode === 404 || !r.stream) return fallback;
    const chunks = [];
    for await (const chunk of r.stream) chunks.push(Buffer.from(chunk));
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (e) {
    if (e?.statusCode === 404 || String(e?.message || e).toLowerCase().includes('not found')) return fallback;
    throw e;
  }
}

async function saveJson(path, value) {
  await put(path, JSON.stringify(value, null, 2), {
    access: 'private', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json', token: token()
  });
  return value;
}

function canonicalDomain(input) {
  const raw = input.includes('://') ? input : `https://${input}`;
  const u = new URL(raw);
  return u.hostname.toLowerCase().replace(/^www\./, '');
}

function normalizeUrl(input) {
  const u = new URL(input);
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) {
    if (/^(utm_|gclid|fbclid|ref$|source$)/i.test(key)) u.searchParams.delete(key);
  }
  return u.toString();
}

function assertPublicUrl(input) {
  const u = new URL(input);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http/https URLs are allowed.');
  if (u.username || u.password) throw new Error('Credentialed URLs are not allowed.');
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) throw new Error('Private hosts are not allowed.');
  const ipType = net.isIP(h);
  if (ipType) {
    const blockedV4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
    const blockedV6 = /^(::1$|fc|fd|fe80)/i;
    if ((ipType === 4 && blockedV4.test(h)) || (ipType === 6 && blockedV6.test(h))) throw new Error('Private IPs are not allowed.');
  }
  return u;
}

async function safeFetch(input, { timeoutMs = 9000, maxRedirects = 3, accept = 'text/html,application/xhtml+xml,application/xml,text/xml,text/plain;q=0.8,*/*;q=0.5' } = {}) {
  let u = assertPublicUrl(input);
  for (let i = 0; i <= maxRedirects; i++) {
    const r = await fetch(u, {
      redirect: 'manual',
      headers: { 'user-agent': 'PresaSEOConsole/0.5 (+https://presa-seo-console.vercel.app)', accept },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if ([301,302,303,307,308].includes(r.status)) {
      const loc = r.headers.get('location');
      if (!loc) throw new Error(`Redirect without location from ${u}`);
      u = assertPublicUrl(new URL(loc, u).toString());
      continue;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${u}`);
    const len = Number(r.headers.get('content-length') || 0);
    if (len > 2_500_000) throw new Error('Response too large to analyze safely.');
    return { response: r, url: u.toString(), text: await r.text() };
  }
  throw new Error('Too many redirects.');
}

function decodeEntities(s = '') {
  return s.replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(html = '') {
  return decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<noscript[\s\S]*?<\/noscript>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
}

function firstMatch(html, re) {
  const m = re.exec(html);
  return m ? decodeEntities(stripTags(m[1] || m[2] || '')).trim() : null;
}

function metaContent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const a = new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i').exec(html);
  if (a) return decodeEntities(a[1]).trim();
  const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i').exec(html);
  return b ? decodeEntities(b[1]).trim() : null;
}

function linkRel(html, rel) {
  const r1 = new RegExp(`<link[^>]+rel=["'][^"']*${rel}[^"']*["'][^>]+href=["']([^"']+)["']`, 'i').exec(html);
  const r2 = new RegExp(`<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*${rel}[^"']*["']`, 'i').exec(html);
  return decodeEntities((r1 || r2)?.[1] || '').trim() || null;
}

function headings(html, level) {
  const out = [];
  const re = new RegExp(`<h${level}[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi');
  let m;
  while ((m = re.exec(html)) && out.length < 30) {
    const t = stripTags(m[1]);
    if (t) out.push(t.slice(0, 240));
  }
  return out;
}

function schemaTypes(html) {
  const types = new Set();
  const re = /["']@type["']\s*:\s*(?:["']([^"']+)["']|\[([^\]]+)\])/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) types.add(m[1]);
    if (m[2]) for (const x of m[2].match(/["']([^"']+)["']/g) || []) types.add(x.replace(/["']/g,''));
  }
  return [...types].slice(0, 30);
}

function analyzeHtml(url, html, keyword = '') {
  const text = stripTags(html);
  const words = text ? text.split(/\s+/).filter(Boolean) : [];
  const h1 = headings(html,1), h2 = headings(html,2), h3 = headings(html,3);
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map(m => m[1]);
  const origin = new URL(url).origin;
  let internalLinks = 0, externalLinks = 0;
  for (const href of links) {
    try {
      const u = new URL(href, url);
      if (!['http:','https:'].includes(u.protocol)) continue;
      if (u.origin === origin) internalLinks++; else externalLinks++;
    } catch {}
  }
  const lower = text.toLowerCase();
  const kw = keyword.trim().toLowerCase();
  const occurrences = kw ? lower.split(kw).length - 1 : null;
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const canonical = linkRel(html, 'canonical');
  const modified = metaContent(html, 'article:modified_time') || firstMatch(html, /["']dateModified["']\s*:\s*["']([^"']+)["']/i);
  const published = metaContent(html, 'article:published_time') || firstMatch(html, /["']datePublished["']\s*:\s*["']([^"']+)["']/i);
  const schemas = schemaTypes(html);
  return {
    url,
    domain: canonicalDomain(url),
    title,
    description: metaContent(html,'description'),
    canonical,
    h1,
    h2,
    h3,
    wordCount: words.length,
    internalLinks,
    externalLinks,
    schemaTypes: schemas,
    hasFaqSchema: schemas.some(x => /faqpage/i.test(x)),
    hasHowToSchema: schemas.some(x => /howto/i.test(x)),
    published,
    modified,
    keyword: keyword || null,
    exactKeywordOccurrences: occurrences,
    titleContainsKeyword: kw ? (title || '').toLowerCase().includes(kw) : null,
    h1ContainsKeyword: kw ? h1.some(x => x.toLowerCase().includes(kw)) : null,
    contentHash: crypto.createHash('sha256').update(text).digest('hex')
  };
}

function hashKey(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

async function analyzePage(url, keyword = '', saveSnapshot = true) {
  const fetched = await safeFetch(url);
  const current = analyzeHtml(fetched.url, fetched.text, keyword);
  const path = `competitors/pages/${hashKey(normalizeUrl(current.url))}.json`;
  const previous = await loadJson(path, null);
  const diff = previous ? {
    changed: previous.contentHash !== current.contentHash,
    titleChanged: previous.title !== current.title,
    descriptionChanged: previous.description !== current.description,
    wordCountDelta: current.wordCount - (previous.wordCount || 0),
    h2Changed: JSON.stringify(previous.h2 || []) !== JSON.stringify(current.h2 || []),
    previousCheckedAt: previous.checkedAt || null
  } : { changed: null, firstSnapshot: true };
  const saved = { ...current, checkedAt: new Date().toISOString() };
  if (saveSnapshot) await saveJson(path, saved);
  return { ...current, diff };
}

async function loadRegistry() {
  const existing = await loadJson(REGISTRY_PATH, null);
  if (existing?.competitors) return existing;
  const seeded = { updatedAt: new Date().toISOString(), competitors: DEFAULT_COMPETITORS.map((x, i) => ({ ...x, id: `seed-${i + 1}`, createdAt: new Date().toISOString() })) };
  await saveJson(REGISTRY_PATH, seeded);
  return seeded;
}

async function saveRegistry(competitors) {
  return saveJson(REGISTRY_PATH, { updatedAt: new Date().toISOString(), competitors });
}

function parseSitemapXml(xml) {
  const urls = [];
  const entries = [...xml.matchAll(/<url\b[\s\S]*?<loc>([\s\S]*?)<\/loc>[\s\S]*?<\/url>/gi)];
  for (const e of entries) {
    const block = e[0];
    const loc = decodeEntities(stripTags(e[1]));
    const lm = /<lastmod>([\s\S]*?)<\/lastmod>/i.exec(block);
    if (loc) urls.push({ url: loc.trim(), lastmod: lm ? stripTags(lm[1]) : null });
  }
  const sitemapLocs = [...xml.matchAll(/<sitemap\b[\s\S]*?<loc>([\s\S]*?)<\/loc>[\s\S]*?<\/sitemap>/gi)].map(m => decodeEntities(stripTags(m[1])).trim()).filter(Boolean);
  return { urls, sitemapLocs };
}

async function discoverSitemaps(baseUrl) {
  const base = assertPublicUrl(baseUrl);
  const origin = base.origin;
  const found = new Set();
  try {
    const robots = await safeFetch(`${origin}/robots.txt`, { accept: 'text/plain,*/*;q=0.5' });
    for (const line of robots.text.split(/\r?\n/)) {
      const m = /^\s*sitemap\s*:\s*(\S+)/i.exec(line);
      if (m) found.add(m[1].trim());
    }
  } catch {}
  if (!found.size) {
    for (const candidate of [`${origin}/sitemap_index.xml`, `${origin}/sitemap.xml`]) {
      try {
        const r = await safeFetch(candidate, { accept: 'application/xml,text/xml,*/*;q=0.5' });
        if (/<(?:urlset|sitemapindex)\b/i.test(r.text)) { found.add(candidate); break; }
      } catch {}
    }
  }
  return [...found];
}

async function collectSitemapUrls(baseUrl, { maxSitemaps = 5, maxUrls = 500 } = {}) {
  const roots = await discoverSitemaps(baseUrl);
  const queue = [...roots];
  const seenMaps = new Set();
  const urls = new Map();
  while (queue.length && seenMaps.size < maxSitemaps && urls.size < maxUrls) {
    const mapUrl = queue.shift();
    if (!mapUrl || seenMaps.has(mapUrl)) continue;
    seenMaps.add(mapUrl);
    try {
      const r = await safeFetch(mapUrl, { accept: 'application/xml,text/xml,*/*;q=0.5' });
      const parsed = parseSitemapXml(r.text);
      for (const x of parsed.urls) {
        if (urls.size >= maxUrls) break;
        try {
          const u = assertPublicUrl(x.url);
          if (canonicalDomain(u.toString()) === canonicalDomain(baseUrl)) urls.set(normalizeUrl(u.toString()), { url: normalizeUrl(u.toString()), lastmod: x.lastmod });
        } catch {}
      }
      for (const child of parsed.sitemapLocs) if (!seenMaps.has(child) && queue.length < 30) queue.push(child);
    } catch {}
  }
  return { sitemaps: [...seenMaps], urls: [...urls.values()] };
}

function meaningfulTokens(text = '') {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g,' ').split(/[\s-]+/).filter(x => x.length > 2 && !STOPWORDS.has(x));
}

function scoreUrlForKeyword(url, keyword) {
  const hay = decodeURIComponent(new URL(url).pathname).toLowerCase().replace(/[-_/]+/g,' ');
  const toks = meaningfulTokens(keyword);
  let score = 0;
  for (const t of toks) if (hay.includes(t)) score += 3;
  if (/neet/.test(keyword.toLowerCase()) && /neet/.test(hay)) score += 2;
  if (/jee/.test(keyword.toLowerCase()) && /jee/.test(hay)) score += 2;
  return score;
}

function observedThemes(entries) {
  const counts = new Map();
  for (const e of entries) {
    let path = '';
    try { path = decodeURIComponent(new URL(e.url).pathname); } catch {}
    for (const t of meaningfulTokens(path)) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()].sort((a,b) => b[1] - a[1]).slice(0, 15).map(([theme,count]) => ({ theme, count }));
}

async function scanSite(baseUrl, { keyword = '', maxUrls = 400, maxSitemaps = 5, changedLimit = 25, saveSnapshot = true } = {}) {
  const domain = canonicalDomain(baseUrl);
  const current = await collectSitemapUrls(baseUrl, { maxUrls, maxSitemaps });
  const path = `competitors/sites/${hashKey(domain)}.json`;
  const previous = await loadJson(path, null);
  const old = new Map((previous?.urls || []).map(x => [x.url, x]));
  const added = [], updated = [];
  for (const x of current.urls) {
    const p = old.get(x.url);
    if (!p) added.push(x);
    else if (x.lastmod && p.lastmod && x.lastmod !== p.lastmod) updated.push({ ...x, previousLastmod: p.lastmod });
  }
  const keywordMatches = keyword ? current.urls.map(x => ({ ...x, score: scoreUrlForKeyword(x.url, keyword) })).filter(x => x.score > 0).sort((a,b) => b.score - a.score).slice(0, 20) : [];
  const saved = { domain, baseUrl, checkedAt: new Date().toISOString(), sitemaps: current.sitemaps, urls: current.urls };
  if (saveSnapshot) await saveJson(path, saved);
  return {
    domain, checkedAt: saved.checkedAt, sitemapCount: current.sitemaps.length, urlCount: current.urls.length,
    firstSnapshot: !previous,
    added: added.slice(0, changedLimit), updated: updated.slice(0, changedLimit),
    observedThemes: observedThemes([...added, ...updated]), keywordMatches
  };
}

function serpPath(keyword) {
  return `competitors/serp/${hashKey(keyword.trim().toLowerCase())}.json`;
}

function topDistinctCompetitors(results, selfDomain) {
  const seen = new Set();
  const out = [];
  const self = selfDomain ? selfDomain.replace(/^www\./,'').toLowerCase() : null;
  for (const r of [...results].sort((a,b) => (a.rank || 999) - (b.rank || 999))) {
    try {
      const domain = canonicalDomain(r.url);
      if (self && (domain === self || domain.endsWith(`.${self}`))) continue;
      if (seen.has(domain)) continue;
      seen.add(domain);
      out.push({ rank: r.rank || out.length + 1, domain, url: normalizeUrl(r.url), title: r.title || null, snippet: r.snippet || null });
      if (out.length === 3) break;
    } catch {}
  }
  return out;
}

async function findCandidatePage(baseUrl, keyword) {
  const data = await collectSitemapUrls(baseUrl, { maxSitemaps: 4, maxUrls: 350 });
  const scored = data.urls.map(x => ({ ...x, score: scoreUrlForKeyword(x.url, keyword) })).sort((a,b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].url : baseUrl;
}

function benchmark(analyses) {
  const good = analyses.filter(x => x && !x.error);
  if (!good.length) return null;
  const counts = good.map(x => x.wordCount || 0).sort((a,b) => a-b);
  const schemaCounts = new Map();
  for (const x of good) for (const t of x.schemaTypes || []) schemaCounts.set(t, (schemaCounts.get(t) || 0) + 1);
  return {
    pagesAnalyzed: good.length,
    wordCount: { min: counts[0], max: counts[counts.length - 1], average: Math.round(counts.reduce((a,b) => a+b,0) / counts.length) },
    commonSchemaTypes: [...schemaCounts.entries()].sort((a,b) => b[1]-a[1]).slice(0,10).map(([type,count]) => ({ type,count })),
    faqPageUsage: good.filter(x => x.hasFaqSchema).length,
    titlesUsingExactKeyword: good.filter(x => x.titleContainsKeyword).length,
    h1sUsingExactKeyword: good.filter(x => x.h1ContainsKeyword).length
  };
}

function gapActions(own, bench, competitors) {
  const actions = [];
  if (!own || !bench) return actions;
  if (own.wordCount < bench.wordCount.average * 0.65) actions.push('Competitors cover materially more useful text. Expand missing subtopics, examples and evidence rather than padding word count.');
  const common = (bench.commonSchemaTypes || []).filter(x => x.count >= Math.max(2, Math.ceil(bench.pagesAnalyzed / 2))).map(x => x.type);
  const missing = common.filter(x => !(own.schemaTypes || []).includes(x));
  if (missing.length) actions.push(`Review whether these commonly used structured-data types are genuinely applicable: ${missing.join(', ')}.`);
  if (!own.titleContainsKeyword && bench.titlesUsingExactKeyword >= 2) actions.push('Review title intent: at least two leading competitors use the exact query in the title while our page does not.');
  if (!own.h1ContainsKeyword && bench.h1sUsingExactKeyword >= 2) actions.push('Review H1 intent alignment; leading pages more explicitly answer the query.');
  if ((own.internalLinks || 0) < Math.max(3, Math.round(competitors.reduce((s,x) => s + (x.internalLinks || 0),0) / Math.max(competitors.length,1) * 0.5))) actions.push('Strengthen relevant internal links into and out of the target page.');
  return actions;
}

export function registerPhase2Tools(mcp) {
  mcp.tool('competitor_registry', 'List all manually tracked competitors. The registry is editable and persists in private storage.', {}, async () => {
    const r = await loadRegistry();
    return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
  });

  mcp.tool('add_competitor', 'Add or update any competitor in the persistent competitor registry.', {
    name: z.string().min(1), baseUrl: z.string().url(), tags: z.array(z.string()).default([]), notes: z.string().optional(), enabled: z.boolean().default(true)
  }, async ({ name, baseUrl, tags, notes, enabled }) => {
    assertPublicUrl(baseUrl);
    const r = await loadRegistry();
    const domain = canonicalDomain(baseUrl);
    const now = new Date().toISOString();
    const existing = r.competitors.find(x => x.domain === domain);
    const entry = { id: existing?.id || `cmp-${hashKey(domain).slice(0,10)}`, name, baseUrl, domain, tags, notes: notes || existing?.notes || null, enabled, source: existing?.source || 'manual', createdAt: existing?.createdAt || now, updatedAt: now };
    const competitors = existing ? r.competitors.map(x => x.domain === domain ? entry : x) : [...r.competitors, entry];
    await saveRegistry(competitors);
    return { content: [{ type: 'text', text: JSON.stringify({ saved: true, competitor: entry }, null, 2) }] };
  });

  mcp.tool('remove_competitor', 'Remove a competitor from the persistent registry by domain.', {
    domain: z.string().min(1)
  }, async ({ domain }) => {
    const d = canonicalDomain(domain);
    const r = await loadRegistry();
    const before = r.competitors.length;
    const competitors = r.competitors.filter(x => x.domain !== d);
    await saveRegistry(competitors);
    return { content: [{ type: 'text', text: JSON.stringify({ removed: before !== competitors.length, domain: d, remaining: competitors.length }, null, 2) }] };
  });

  mcp.tool('record_serp_snapshot', 'Store live organic search results for a keyword. Presa automatically treats the first 3 distinct non-St. Mary’s domains as dynamic competitors for that keyword.', {
    keyword: z.string().min(1), selfDomain: z.string().default('smis.edu.in'), engine: z.string().default('live-web-search'),
    results: z.array(z.object({ rank: z.number().int().min(1), url: z.string().url(), title: z.string().optional(), snippet: z.string().optional() })).min(1).max(20)
  }, async ({ keyword, selfDomain, engine, results }) => {
    const dynamicTop3 = topDistinctCompetitors(results, selfDomain);
    const payload = { keyword, engine, searchedAt: new Date().toISOString(), selfDomain, dynamicTop3, results };
    await saveJson(serpPath(keyword), payload);
    return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  });

  mcp.tool('get_serp_snapshot', 'Get the latest stored search-result snapshot and its first 3 dynamic competitors for a keyword.', {
    keyword: z.string().min(1)
  }, async ({ keyword }) => {
    const data = await loadJson(serpPath(keyword), null);
    return { content: [{ type: 'text', text: JSON.stringify(data || { keyword, found: false }, null, 2) }] };
  });

  mcp.tool('analyze_competitor_page', 'Analyze a public competitor or St. Mary’s page: title, meta, headings, word count, links, schema, freshness signals and page-change diff.', {
    url: z.string().url(), keyword: z.string().default(''), saveSnapshot: z.boolean().default(true)
  }, async ({ url, keyword, saveSnapshot }) => {
    const out = await analyzePage(url, keyword, saveSnapshot);
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
  });

  mcp.tool('scan_competitor_site', 'Scan a competitor sitemap and report newly added/updated URLs plus observed public content themes. This observes public changes; it does not claim access to private keyword tracking.', {
    baseUrl: z.string().url(), keyword: z.string().default(''), maxUrls: z.number().int().min(20).max(1000).default(400), maxSitemaps: z.number().int().min(1).max(10).default(5), changedLimit: z.number().int().min(1).max(100).default(25)
  }, async args => {
    const out = await scanSite(args.baseUrl, args);
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
  });

  mcp.tool('competitor_radar', 'Run a change scan across enabled tracked competitors and return public sitemap additions/updates and emerging URL themes.', {
    keyword: z.string().default(''), competitorLimit: z.number().int().min(1).max(15).default(5), maxUrlsPerSite: z.number().int().min(20).max(600).default(250), changedLimitPerSite: z.number().int().min(1).max(50).default(15)
  }, async ({ keyword, competitorLimit, maxUrlsPerSite, changedLimitPerSite }) => {
    const r = await loadRegistry();
    const competitors = r.competitors.filter(x => x.enabled).slice(0, competitorLimit);
    const scans = await Promise.all(competitors.map(async c => {
      try { return { competitor: c, scan: await scanSite(c.baseUrl, { keyword, maxUrls: maxUrlsPerSite, maxSitemaps: 4, changedLimit: changedLimitPerSite }) }; }
      catch (e) { return { competitor: c, error: String(e?.message || e) }; }
    }));
    return { content: [{ type: 'text', text: JSON.stringify({ checkedAt: new Date().toISOString(), keyword: keyword || null, scans }, null, 2) }] };
  });

  mcp.tool('keyword_competitor_brief', 'Analyze the first 3 dynamic competitors stored for a keyword, plus relevant pages from tracked competitors, and compare them with our target page. Before calling this for a fresh keyword, record a live SERP snapshot.', {
    keyword: z.string().min(1), ownPageUrl: z.string().url().optional(), includeTracked: z.boolean().default(true), trackedLimit: z.number().int().min(0).max(5).default(3)
  }, async ({ keyword, ownPageUrl, includeTracked, trackedLimit }) => {
    const serp = await loadJson(serpPath(keyword), null);
    if (!serp?.dynamicTop3?.length) throw new Error('No SERP snapshot stored for this keyword. Record current organic results first.');
    const dynamic = await Promise.all(serp.dynamicTop3.map(async x => {
      try { return { source: 'dynamic-top3', rank: x.rank, domain: x.domain, analysis: await analyzePage(x.url, keyword, true) }; }
      catch (e) { return { source: 'dynamic-top3', rank: x.rank, domain: x.domain, url: x.url, error: String(e?.message || e) }; }
    }));

    let tracked = [];
    if (includeTracked && trackedLimit > 0) {
      const reg = await loadRegistry();
      const dynamicDomains = new Set(serp.dynamicTop3.map(x => x.domain));
      const selected = reg.competitors.filter(x => x.enabled && !dynamicDomains.has(x.domain)).slice(0, trackedLimit);
      tracked = await Promise.all(selected.map(async c => {
        try {
          const candidate = await findCandidatePage(c.baseUrl, keyword);
          return { source: 'tracked', competitor: c, candidateUrl: candidate, analysis: await analyzePage(candidate, keyword, true) };
        } catch (e) { return { source: 'tracked', competitor: c, error: String(e?.message || e) }; }
      }));
    }

    const competitorAnalyses = [...dynamic.map(x => x.analysis), ...tracked.map(x => x.analysis)].filter(Boolean);
    const own = ownPageUrl ? await analyzePage(ownPageUrl, keyword, true) : null;
    const bench = benchmark(competitorAnalyses);
    const actions = gapActions(own, bench, competitorAnalyses);
    return { content: [{ type: 'text', text: JSON.stringify({ keyword, serpSearchedAt: serp.searchedAt, dynamicTop3: dynamic, trackedCompetitors: tracked, ownPage: own, benchmark: bench, recommendedActions: actions }, null, 2) }] };
  });
}
