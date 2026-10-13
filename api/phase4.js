import crypto from 'node:crypto';
import { get, put } from '@vercel/blob';
import { z } from 'zod';

const CONTENT_REGISTRY_PATH = 'content/registry.json';
const PHASE3_CATALOG_PATH = 'resources/neet/catalog.json';
const DESIGN_SYSTEM_VERSION = 'smis-content-v1';

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

function now() { return new Date().toISOString(); }
function idFor(value) { return crypto.createHash('sha1').update(String(value).toLowerCase()).digest('hex').slice(0, 16); }
function serpPath(keyword) { return `competitors/serp/${crypto.createHash('sha1').update(keyword.trim().toLowerCase()).digest('hex')}.json`; }

const DEFAULT_REGISTRY = [
  {
    id: 'neet-resource-centre',
    group: 'NEET', type: 'hub', status: 'published',
    primaryKeyword: 'neet resources',
    secondaryKeywords: ['neet study resources', 'neet preparation resources'],
    targetUrl: 'https://smis.edu.in/neet/',
    notes: 'Primary NEET resource hub.'
  },
  {
    id: 'neet-pyq-hub',
    group: 'NEET', type: 'resource-hub', status: 'published',
    primaryKeyword: 'neet previous year question papers',
    secondaryKeywords: ['neet pyq', 'neet question papers with solutions'],
    targetUrl: 'https://smis.edu.in/neet/previous-year-question-papers/',
    notes: 'Primary PYQ collection hub.'
  },
  {
    id: 'neet-model-papers-2026',
    group: 'NEET', type: 'resource', status: 'published',
    primaryKeyword: 'neet model question paper 2026',
    secondaryKeywords: ['neet model paper 2026', 'nta neet sample paper 2026 pdf download'],
    targetUrl: 'https://smis.edu.in/neet-model-question-papers-2026/'
  },
  {
    id: 'neet-seven-months',
    group: 'NEET', type: 'guide', status: 'published',
    primaryKeyword: 'is 7 months enough for neet',
    secondaryKeywords: ['how to crack neet in 7 months', 'are 7 months enough for neet'],
    targetUrl: 'https://smis.edu.in/neet-2026-7-month-study-plan-start-from-october-catch-up-fast/'
  }
];

async function loadRegistry() {
  const existing = await loadJson(CONTENT_REGISTRY_PATH, null);
  if (existing?.items) return existing;
  return await saveJson(CONTENT_REGISTRY_PATH, { version: 1, updatedAt: now(), items: DEFAULT_REGISTRY.map(x => ({ ...x, updatedAt: now() })) });
}

async function saveRegistry(items) {
  return await saveJson(CONTENT_REGISTRY_PATH, { version: 1, updatedAt: now(), items });
}

function rowMetric(row) {
  return { clicks: row?.clicks || 0, impressions: row?.impressions || 0, ctr: row?.ctr || 0, position: row?.position ?? null };
}

function normalizeQuery(q='') { return q.trim().toLowerCase().replace(/\s+/g, ' '); }
function isNavigationalNoise(q='') {
  const s = normalizeQuery(q);
  return /^(smis|smis login|smis portal|smis portal login|smis login page|login smis|smis login portal|smis student login|st mary'?s login|www\.smis)$/.test(s);
}

function classifyQuery(q='') {
  const s = normalizeQuery(q);
  if (/neet/.test(s) && /(previous|pyq|question paper|model paper|sample paper|pdf|mock)/.test(s)) return { group: 'NEET', cluster: 'papers-pyqs', intent: 'resource' };
  if (/neet/.test(s) && /(month|study|prepare|preparation|crack|strategy|plan|time table|timetable)/.test(s)) return { group: 'NEET', cluster: 'study-strategy', intent: 'informational' };
  if (/neet/.test(s) && /(syllabus|chapter|topic|radioactivity|ncert|included|removed)/.test(s)) return { group: 'NEET', cluster: 'syllabus-topics', intent: 'informational' };
  if (/neet/.test(s) && /(cutoff|cut off|rank|college|medical college|counselling|counseling)/.test(s)) return { group: 'NEET', cluster: 'cutoffs-colleges', intent: 'informational-commercial' };
  if (/neet/.test(s) && /(coaching|long term|repeater)/.test(s)) return { group: 'NEET', cluster: 'coaching-commercial', intent: 'commercial' };
  if (/jee/.test(s)) return { group: 'JEE', cluster: 'jee', intent: /coaching|college|best/.test(s) ? 'commercial' : 'informational' };
  if (/pu college|isc|science college|commerce college/.test(s)) return { group: 'PU / ISC', cluster: 'pu-isc', intent: /best|college|admission/.test(s) ? 'commercial' : 'informational' };
  if (/school|icse/.test(s)) return { group: 'School', cluster: 'school', intent: /best|school/.test(s) ? 'commercial' : 'informational' };
  if (/cutoff|cut off|college/.test(s)) return { group: 'NEET', cluster: 'cutoffs-colleges', intent: 'informational-commercial' };
  return { group: 'Other', cluster: 'other', intent: 'unknown' };
}

function coverageForQuery(query, registry, phase3Catalog) {
  const q = normalizeQuery(query);
  const candidates = [];
  for (const item of registry.items || []) {
    const kws = [item.primaryKeyword, ...(item.secondaryKeywords || [])].filter(Boolean).map(normalizeQuery);
    let score = 0;
    for (const k of kws) {
      if (q === k) score = Math.max(score, 100);
      else if (q.includes(k) || k.includes(q)) score = Math.max(score, 75);
      else {
        const qt = new Set(q.split(' '));
        const kt = new Set(k.split(' '));
        const overlap = [...qt].filter(x => kt.has(x)).length / Math.max(1, Math.min(qt.size, kt.size));
        if (overlap >= .65) score = Math.max(score, Math.round(overlap * 70));
      }
    }
    if (score) candidates.push({ score, source: 'content-registry', item });
  }
  for (const item of phase3Catalog?.items || []) {
    const hay = normalizeQuery(`${item.title || ''} ${item.slug || ''}`);
    const qt = q.split(' ').filter(x => x.length > 2);
    const overlap = qt.filter(x => hay.includes(x)).length / Math.max(1, qt.length);
    if (overlap >= .6) candidates.push({ score: Math.round(overlap * 65), source: 'phase3-resource', item });
  }
  candidates.sort((a,b) => b.score - a.score);
  return candidates[0] || null;
}

function opportunityScore(metric, previousMetric, coverage) {
  const pos = metric.position ?? 100;
  let score = 0;
  score += Math.min(35, Math.log2((metric.impressions || 0) + 1) * 6);
  if (pos >= 4 && pos <= 10) score += 28;
  else if (pos > 10 && pos <= 20) score += 34;
  else if (pos > 20 && pos <= 40) score += 18;
  if ((metric.impressions || 0) >= 10 && metric.ctr < .02) score += 12;
  const growth = (metric.impressions || 0) - (previousMetric.impressions || 0);
  if (growth > 0) score += Math.min(12, Math.log2(growth + 1) * 2.5);
  if (!coverage) score += 16;
  else if (coverage.score < 80) score += 8;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function recommendedAction(metric, coverage, classification) {
  const pos = metric.position ?? 100;
  if (!coverage) {
    if (classification.intent === 'resource') return 'Create or expand a dedicated high-value resource page/hub.';
    return 'Create a dedicated page only if the query represents a distinct intent; otherwise add the answer to the nearest authoritative page.';
  }
  const url = coverage.item?.targetUrl || coverage.item?.url || null;
  if (pos > 10 && pos <= 20) return `Strengthen the existing page${url ? ` (${url})` : ''} for a Page 2 → Page 1 push.`;
  if (pos >= 4 && pos <= 10) return `Upgrade the existing page${url ? ` (${url})` : ''} toward Top 3 with stronger intent coverage, evidence and internal links.`;
  if (metric.ctr < .02 && metric.impressions >= 10) return `Improve search snippet/answer alignment on the existing page${url ? ` (${url})` : ''}.`;
  return `Keep the existing page${url ? ` (${url})` : ''} authoritative and expand only where the search intent adds new value.`;
}

function designGuardrails() {
  return {
    version: DESIGN_SYSTEM_VERSION,
    brand: { red: '#C80000', navy: '#131E35', darkGrey: '#545454', surface: '#F6F7F9' },
    typography: {
      family: '-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif',
      desktopH1: '44–72px responsive', mobileH1: '35–48px responsive', body: '15–19px depending hierarchy',
      rules: ['No theme-default decorative display fonts on resource pages', 'No excessive all-caps', 'Body line-height >= 1.55', 'Keep line length readable']
    },
    layout: ['Full-bleed hero allowed, content max-width about 1160px', 'Desktop grids collapse cleanly to 2 columns/tablet and 1 column/mobile', 'No horizontal scrolling at 390px viewport', 'Buttons become full-width when useful on mobile', 'Use generous whitespace; avoid dense card walls'],
    wordpress: ['Use Gutenberg Custom HTML block for authored HTML/CSS so wpautop does not corrupt card/link markup', 'Hide duplicate theme page-title strip on custom landing/resource pages when the content already owns the H1', 'Scope all CSS to the page/root class', 'Do not write raw unwrapped HTML that WordPress can auto-paragraph'],
    ux: ['Do not show inactive years/resources as fake links', 'Label queued/unavailable items clearly', 'Use no more than 1–2 primary CTAs per section', 'Every resource page must have a clear next step and back path where relevant'],
    accessibility: ['Maintain strong text/background contrast', 'Minimum practical tap target ~44px', 'Semantic H1 → H2 → H3 order', 'Do not rely on colour alone for status'],
    visualQA: ['Review desktop and 390px mobile rendering before considering a page complete', 'Check header overlap, duplicate title/breadcrumb strips, card wrapping, typography, CTA overflow and unexpected theme styles']
  };
}

function buildBrief(keyword, classification, coverage, serp) {
  const existing = coverage?.item || null;
  const pageType = classification.intent === 'resource' ? 'resource/hub' : classification.intent === 'commercial' ? 'commercial landing page' : 'answer-led guide';
  const competitors = serp?.dynamicTop3 || [];
  const common = {
    keyword,
    classification,
    recommendation: existing ? 'upgrade-existing' : 'create-or-consolidate',
    existingTarget: existing?.targetUrl || existing?.url || null,
    suggestedPageType: pageType,
    requiredApproach: [
      'Answer the query clearly near the top before promotional content.',
      'Add original evidence, examples, data, worked explanations or decision criteria where relevant.',
      'Avoid producing a new URL when an existing authoritative page can satisfy the same intent.',
      'Use internal links from the nearest hub and to the next useful student action.',
      'Keep sales CTAs contextual and secondary to solving the search intent.'
    ],
    competitorSnapshot: competitors.map(x => ({ rank: x.rank, domain: x.domain, url: x.url, title: x.title || null })),
    designGuardrails: designGuardrails()
  };
  if (classification.cluster === 'papers-pyqs') {
    return { ...common, suggestedTitle: `${keyword.replace(/\b\w/g, c => c.toUpperCase())} | Answers, Solutions & Practice`, sections: ['Quick answer', 'Primary resource/download or practice entry', 'How to use the paper', 'Answer/solution access', 'Difficulty or chapter analysis', 'Related years/subjects', 'Accuracy/source note'] };
  }
  if (classification.cluster === 'study-strategy') {
    return { ...common, suggestedTitle: keyword.replace(/\b\w/g, c => c.toUpperCase()), sections: ['Direct answer in 2–4 sentences', 'Who this advice fits', 'Time/score reality check', 'Week-by-week or phase plan', 'Subject allocation', 'Testing/review loop', 'Common mistakes', 'Next-step resources'] };
  }
  if (classification.cluster === 'syllabus-topics') {
    return { ...common, suggestedTitle: keyword.replace(/\b\w/g, c => c.toUpperCase()), sections: ['Direct yes/no answer', 'Official-source basis', 'Where the topic sits in the syllabus', 'What students should study', 'Common confusion', 'Related chapters/resources'] };
  }
  if (classification.cluster === 'cutoffs-colleges') {
    return { ...common, suggestedTitle: keyword.replace(/\b\w/g, c => c.toUpperCase()), sections: ['Quick answer', 'Latest verified cutoff/rank table', 'Category/state/quota qualifiers', 'Trend vs previous years', 'What the number means for a student', 'Counselling caveat/source note', 'Related colleges/cutoffs'] };
  }
  return { ...common, suggestedTitle: keyword.replace(/\b\w/g, c => c.toUpperCase()), sections: ['Quick answer', 'Decision criteria or explanation', 'Evidence/examples', 'Common questions', 'Related resources', 'Contextual CTA'] };
}

export function registerPhase4Tools(mcp, deps = {}) {
  const queryGsc = deps.queryGsc;
  if (typeof queryGsc !== 'function') throw new Error('Phase 4 requires queryGsc dependency.');

  mcp.tool('content_registry', 'Return the persistent St. Mary’s search-content registry and production statuses.', {}, async () => {
    return { content: [{ type: 'text', text: JSON.stringify(await loadRegistry(), null, 2) }] };
  });

  mcp.tool('upsert_content_item', 'Create or update a search-content item, target keyword, canonical URL and production status.', {
    id: z.string().optional(), group: z.string().default('NEET'), type: z.string().default('guide'),
    status: z.enum(['idea','brief','draft','review','approved','published','measure','hold']).default('idea'),
    primaryKeyword: z.string().min(2), secondaryKeywords: z.array(z.string()).default([]), targetUrl: z.string().url().optional(),
    owner: z.string().optional(), notes: z.string().optional()
  }, async args => {
    const r = await loadRegistry();
    const id = args.id || idFor(args.primaryKeyword);
    const i = r.items.findIndex(x => x.id === id || normalizeQuery(x.primaryKeyword) === normalizeQuery(args.primaryKeyword));
    const item = { ...(i >= 0 ? r.items[i] : {}), ...args, id, updatedAt: now() };
    if (i >= 0) r.items[i] = item; else r.items.push(item);
    await saveRegistry(r.items);
    return { content: [{ type: 'text', text: JSON.stringify(item, null, 2) }] };
  });

  mcp.tool('content_demand_radar', 'Score real Google Search Console queries into a search-demand content opportunity queue while excluding portal/login noise.', {
    siteUrl: z.string(), startDate: z.string(), endDate: z.string(), previousStart: z.string(), previousEnd: z.string(),
    minImpressions: z.number().default(5), limit: z.number().int().min(1).max(200).default(50), includeBrandNavigation: z.boolean().default(false)
  }, async ({ siteUrl, startDate, endDate, previousStart, previousEnd, minImpressions, limit, includeBrandNavigation }) => {
    const [currentRows, previousRows, registry, phase3Catalog] = await Promise.all([
      queryGsc({ siteUrl, startDate, endDate, dimensions: ['query'], rowLimit: 25000 }),
      queryGsc({ siteUrl, startDate: previousStart, endDate: previousEnd, dimensions: ['query'], rowLimit: 25000 }),
      loadRegistry(), loadJson(PHASE3_CATALOG_PATH, { items: [] })
    ]);
    const prev = new Map(previousRows.map(x => [normalizeQuery(x.keys?.[0] || ''), x]));
    const opportunities = [];
    for (const row of currentRows) {
      const query = String(row.keys?.[0] || '').trim();
      if (!query || (row.impressions || 0) < minImpressions) continue;
      if (!includeBrandNavigation && isNavigationalNoise(query)) continue;
      const classification = classifyQuery(query);
      if (classification.group === 'Other' && (row.impressions || 0) < Math.max(10, minImpressions)) continue;
      const metric = rowMetric(row);
      const previous = rowMetric(prev.get(normalizeQuery(query)));
      const cover = coverageForQuery(query, registry, phase3Catalog);
      opportunities.push({
        query, classification, current: metric, previous,
        impressionsDelta: metric.impressions - previous.impressions,
        positionDelta: previous.position != null && metric.position != null ? previous.position - metric.position : null,
        coverage: cover ? { score: cover.score, source: cover.source, targetUrl: cover.item.targetUrl || cover.item.url || null, title: cover.item.title || null } : null,
        opportunityScore: opportunityScore(metric, previous, cover),
        recommendedAction: recommendedAction(metric, cover, classification)
      });
    }
    opportunities.sort((a,b) => b.opportunityScore - a.opportunityScore || b.current.impressions - a.current.impressions);
    return { content: [{ type: 'text', text: JSON.stringify({ period: { startDate, endDate }, previousPeriod: { startDate: previousStart, endDate: previousEnd }, opportunities: opportunities.slice(0, limit) }, null, 2) }] };
  });

  mcp.tool('content_gap_queue', 'Find search-demand queries that have no strong content/resource owner or only weak partial coverage.', {
    siteUrl: z.string(), startDate: z.string(), endDate: z.string(), minImpressions: z.number().default(5), limit: z.number().int().min(1).max(100).default(30)
  }, async ({ siteUrl, startDate, endDate, minImpressions, limit }) => {
    const [rows, registry, phase3Catalog] = await Promise.all([
      queryGsc({ siteUrl, startDate, endDate, dimensions: ['query'], rowLimit: 25000 }),
      loadRegistry(), loadJson(PHASE3_CATALOG_PATH, { items: [] })
    ]);
    const gaps = [];
    for (const row of rows) {
      const query = String(row.keys?.[0] || '').trim();
      if (!query || isNavigationalNoise(query) || (row.impressions || 0) < minImpressions) continue;
      const cover = coverageForQuery(query, registry, phase3Catalog);
      if (cover && cover.score >= 80) continue;
      const classification = classifyQuery(query);
      gaps.push({ query, classification, metrics: rowMetric(row), coverage: cover ? { score: cover.score, source: cover.source, targetUrl: cover.item.targetUrl || cover.item.url || null } : null });
    }
    gaps.sort((a,b) => b.metrics.impressions - a.metrics.impressions || (a.metrics.position ?? 999) - (b.metrics.position ?? 999));
    return { content: [{ type: 'text', text: JSON.stringify(gaps.slice(0, limit), null, 2) }] };
  });

  mcp.tool('content_brief', 'Generate an evidence-led SEO/AEO content brief from a search query, existing coverage and the latest stored dynamic SERP competitors.', {
    keyword: z.string().min(2)
  }, async ({ keyword }) => {
    const [registry, phase3Catalog, serp] = await Promise.all([
      loadRegistry(), loadJson(PHASE3_CATALOG_PATH, { items: [] }), loadJson(serpPath(keyword), null)
    ]);
    const classification = classifyQuery(keyword);
    const cover = coverageForQuery(keyword, registry, phase3Catalog);
    return { content: [{ type: 'text', text: JSON.stringify(buildBrief(keyword, classification, cover, serp), null, 2) }] };
  });

  mcp.tool('page_design_system', 'Return the mandatory St. Mary’s production design and mobile-QA guardrails for future SEO/resource pages.', {}, async () => {
    return { content: [{ type: 'text', text: JSON.stringify(designGuardrails(), null, 2) }] };
  });

  mcp.tool('content_measurement', 'Measure one published keyword/page against a previous comparable period using Google Search Console.', {
    siteUrl: z.string(), keyword: z.string(), pageUrl: z.string().url().optional(),
    currentStart: z.string(), currentEnd: z.string(), previousStart: z.string(), previousEnd: z.string()
  }, async ({ siteUrl, keyword, pageUrl, currentStart, currentEnd, previousStart, previousEnd }) => {
    const filters = [{ dimension: 'query', operator: 'equals', expression: keyword }];
    if (pageUrl) filters.push({ dimension: 'page', operator: 'equals', expression: pageUrl });
    const [current, previous] = await Promise.all([
      queryGsc({ siteUrl, startDate: currentStart, endDate: currentEnd, dimensions: pageUrl ? ['query','page'] : ['query'], rowLimit: 1000, filters }),
      queryGsc({ siteUrl, startDate: previousStart, endDate: previousEnd, dimensions: pageUrl ? ['query','page'] : ['query'], rowLimit: 1000, filters })
    ]);
    const cur = current[0] || {}; const prev = previous[0] || {};
    const report = {
      keyword, pageUrl: pageUrl || null,
      current: rowMetric(cur), previous: rowMetric(prev),
      delta: { clicks: (cur.clicks || 0) - (prev.clicks || 0), impressions: (cur.impressions || 0) - (prev.impressions || 0), ctr: (cur.ctr || 0) - (prev.ctr || 0), positionImprovement: prev.position != null && cur.position != null ? prev.position - cur.position : null }
    };
    return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
  });

  mcp.tool('phase4_daily_plan', 'Produce a ranked daily search-demand plan from GSC plus the persistent content registry, with no thin-page recommendation.', {
    siteUrl: z.string(), startDate: z.string(), endDate: z.string(), previousStart: z.string(), previousEnd: z.string(), limit: z.number().int().min(1).max(30).default(10)
  }, async ({ siteUrl, startDate, endDate, previousStart, previousEnd, limit }) => {
    const [currentRows, previousRows, registry, phase3Catalog] = await Promise.all([
      queryGsc({ siteUrl, startDate, endDate, dimensions: ['query'], rowLimit: 25000 }),
      queryGsc({ siteUrl, startDate: previousStart, endDate: previousEnd, dimensions: ['query'], rowLimit: 25000 }),
      loadRegistry(), loadJson(PHASE3_CATALOG_PATH, { items: [] })
    ]);
    const prev = new Map(previousRows.map(x => [normalizeQuery(x.keys?.[0] || ''), x]));
    const tasks = [];
    for (const row of currentRows) {
      const query = String(row.keys?.[0] || '').trim();
      if (!query || isNavigationalNoise(query) || (row.impressions || 0) < 5) continue;
      const classification = classifyQuery(query);
      if (classification.group === 'Other') continue;
      const metric = rowMetric(row); const p = rowMetric(prev.get(normalizeQuery(query)));
      const cover = coverageForQuery(query, registry, phase3Catalog);
      const score = opportunityScore(metric, p, cover);
      if (score < 35) continue;
      tasks.push({ priority: score, query, classification, metrics: metric, coverage: cover ? { score: cover.score, targetUrl: cover.item.targetUrl || cover.item.url || null } : null, action: recommendedAction(metric, cover, classification) });
    }
    tasks.sort((a,b) => b.priority - a.priority || b.metrics.impressions - a.metrics.impressions);
    return { content: [{ type: 'text', text: JSON.stringify({ generatedAt: now(), designSystem: DESIGN_SYSTEM_VERSION, rule: 'Upgrade/consolidate existing URLs before creating new ones; never recommend thin doorway pages.', tasks: tasks.slice(0, limit) }, null, 2) }] };
  });
}
