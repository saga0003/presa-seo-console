import crypto from 'node:crypto';
import { get, put } from '@vercel/blob';
import { z } from 'zod';

const CATALOG_PATH = 'resources/neet/catalog.json';
const QUESTION_INDEX_PATH = 'resources/neet/questions-index.json';
const YEARS = Array.from({ length: 13 }, (_, i) => 2026 - i); // 2026..2014
const SUBJECTS = ['Physics', 'Chemistry', 'Botany', 'Zoology'];

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

function slugify(s = '') {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140);
}

function idFor(parts) {
  return crypto.createHash('sha1').update(parts.filter(Boolean).join('|').toLowerCase()).digest('hex').slice(0, 16);
}

function questionPath(id) {
  return `resources/neet/questions/${id}.json`;
}

function now() { return new Date().toISOString(); }

function defaultCatalogItems() {
  const items = [{
    id: 'neet-pyq-hub', kind: 'hub', title: 'NEET Previous Year Question Papers with Solutions',
    slug: 'neet/previous-year-question-papers', url: 'https://smis.edu.in/neet/previous-year-question-papers/',
    status: 'planned', intent: 'informational-commercial', hasHtml: false, hasPdf: false,
    rights: 'original-index', notes: 'Primary PYQ authority hub. Link to lawful source papers and original St. Mary’s solutions.'
  }];
  for (const year of YEARS) {
    items.push({
      id: `neet-pyq-${year}`, kind: 'year', year,
      title: `NEET ${year} Question Paper with Solutions`,
      slug: `neet/previous-year-question-papers/${year}`,
      url: `https://smis.edu.in/neet/previous-year-question-papers/${year}/`,
      status: 'planned', intent: 'informational', hasHtml: false, hasPdf: false,
      rights: 'original-solution-plus-lawful-source-link'
    });
  }
  for (const subject of SUBJECTS) {
    items.push({
      id: `neet-pyq-${slugify(subject)}`, kind: 'subject', subject,
      title: `NEET ${subject} Previous Year Questions with Solutions`,
      slug: `neet/previous-year-question-papers/${slugify(subject)}`,
      url: `https://smis.edu.in/neet/previous-year-question-papers/${slugify(subject)}/`,
      status: 'planned', intent: 'informational', hasHtml: false, hasPdf: false,
      rights: 'original-solution-plus-lawful-source-link'
    });
  }
  return items;
}

async function loadCatalog() {
  const existing = await loadJson(CATALOG_PATH, null);
  if (existing?.items) return existing;
  const seeded = { version: 1, updatedAt: now(), items: defaultCatalogItems() };
  await saveJson(CATALOG_PATH, seeded);
  return seeded;
}

async function saveCatalog(items) {
  return saveJson(CATALOG_PATH, { version: 1, updatedAt: now(), items });
}

async function loadQuestionIndex() {
  return await loadJson(QUESTION_INDEX_PATH, { version: 1, updatedAt: now(), questions: [] });
}

async function saveQuestionIndex(questions) {
  return saveJson(QUESTION_INDEX_PATH, { version: 1, updatedAt: now(), questions });
}

function questionQuality(q) {
  const checks = {
    hasStem: Boolean(q.stem?.trim()),
    hasFourOptions: Array.isArray(q.options) && q.options.filter(Boolean).length === 4,
    hasCorrectAnswer: Boolean(q.correctAnswer),
    hasSolution: Boolean(q.solution?.trim()),
    hasSource: Boolean(q.sourceUrl || q.sourceRef),
    hasYear: Number.isInteger(q.year),
    hasSubject: SUBJECTS.includes(q.subject),
    hasChapter: Boolean(q.chapter?.trim()),
    rightsDeclared: Boolean(q.rights)
  };
  const passed = Object.values(checks).filter(Boolean).length;
  return { checks, score: Math.round((passed / Object.keys(checks).length) * 100), indexReady: passed === Object.keys(checks).length };
}

function questionSummary(q) {
  const quality = questionQuality(q);
  return {
    id: q.id, year: q.year, subject: q.subject, chapter: q.chapter || null,
    difficulty: q.difficulty || null, sourceType: q.sourceType || null,
    rights: q.rights || null, qualityScore: quality.score, indexReady: quality.indexReady,
    updatedAt: q.updatedAt || null
  };
}

function coverage(catalog, questionIndex) {
  const published = catalog.items.filter(x => x.status === 'published');
  const byKind = {};
  for (const x of catalog.items) byKind[x.kind] = (byKind[x.kind] || 0) + 1;
  const questions = questionIndex.questions || [];
  const questionCoverage = {};
  for (const s of SUBJECTS) questionCoverage[s] = questions.filter(q => q.subject === s).length;
  const yearCoverage = {};
  for (const y of YEARS) yearCoverage[y] = questions.filter(q => q.year === y).length;
  return {
    catalogItems: catalog.items.length,
    publishedItems: published.length,
    byKind,
    questions: questions.length,
    indexReadyQuestions: questions.filter(q => q.indexReady).length,
    subjectQuestionCounts: questionCoverage,
    yearQuestionCounts: yearCoverage
  };
}

function pageBlueprint({ kind, year, subject, chapter, questionId }) {
  if (kind === 'hub') return {
    h1: 'NEET Previous Year Question Papers with Solutions',
    requiredSections: ['Quick answer', 'Year-wise papers 2014–2026', 'Subject-wise PYQs', 'Chapter-wise PYQs', 'How to use PYQs', 'Latest NEET pattern', 'FAQs', 'Related mock tests'],
    internalLinks: ['/best-neet-coaching-in-karnataka/', '/best-neet-long-term-coaching-2026-27/', '/neet-model-question-papers-2026/'],
    schemaGuidance: ['BreadcrumbList', 'CollectionPage'],
    indexRule: 'index only when the page contains substantial unique guidance and useful navigation'
  };
  if (kind === 'year') return {
    h1: `NEET ${year} Question Paper with Solutions`,
    requiredSections: ['Paper overview', 'Lawful paper/download source', 'Subject breakdown', 'Original solutions', 'Difficulty analysis', 'Chapter distribution', 'Answer review', 'Related years'],
    schemaGuidance: ['BreadcrumbList', 'Article'],
    indexRule: 'index when paper source is verified and original analysis/solutions add meaningful value'
  };
  if (kind === 'subject') return {
    h1: `NEET ${subject} Previous Year Questions with Solutions`,
    requiredSections: ['Year filter', 'Chapter filter', 'Question practice', 'Common concepts', 'Mistake patterns', 'Related subject resources'],
    schemaGuidance: ['BreadcrumbList', 'CollectionPage'],
    indexRule: 'index when enough verified questions exist to be useful'
  };
  if (kind === 'chapter') return {
    h1: `NEET ${subject} ${chapter} Previous Year Questions`,
    requiredSections: ['Concept summary', 'Verified PYQs', 'Worked solutions', 'Frequent errors', 'Related chapters'],
    schemaGuidance: ['BreadcrumbList', 'CollectionPage'],
    indexRule: 'avoid thin pages; require a useful question set and original explanations'
  };
  if (kind === 'question') return {
    h1: `NEET ${year} ${subject} Question${questionId ? ` – ${questionId}` : ''}`,
    requiredSections: ['Question', 'Options', 'Correct answer', 'Worked solution', 'Concept tested', 'Why other options are wrong where useful', 'Related PYQs'],
    schemaGuidance: ['BreadcrumbList'],
    indexRule: 'index only high-quality, verified, standalone-useful question pages; otherwise keep inside collection pages'
  };
  throw new Error('Unsupported blueprint kind.');
}

export function registerPhase3Tools(mcp) {
  mcp.tool('neet_resource_inventory', 'Return the NEET resource-library catalog and coverage status for hub, year, subject and question resources.', {}, async () => {
    const [catalog, qi] = await Promise.all([loadCatalog(), loadQuestionIndex()]);
    return { content: [{ type: 'text', text: JSON.stringify({ catalog, coverage: coverage(catalog, qi) }, null, 2) }] };
  });

  mcp.tool('upsert_neet_resource', 'Create or update one NEET resource record in the persistent library catalog.', {
    id: z.string().optional(), kind: z.enum(['hub','year','subject','chapter','question','pdf','tool']),
    title: z.string().min(3), slug: z.string().min(1), url: z.string().url().optional(), status: z.enum(['planned','draft','published','verified']).default('planned'),
    year: z.number().int().min(1988).max(2100).optional(), subject: z.enum(SUBJECTS).optional(), chapter: z.string().optional(),
    sourceUrl: z.string().url().optional(), sourceType: z.string().optional(), rights: z.string().default('original'),
    hasHtml: z.boolean().default(false), hasPdf: z.boolean().default(false), notes: z.string().optional()
  }, async args => {
    const c = await loadCatalog();
    const id = args.id || idFor([args.kind, args.slug]);
    const idx = c.items.findIndex(x => x.id === id || x.slug === args.slug);
    const record = { ...(idx >= 0 ? c.items[idx] : {}), ...args, id, updatedAt: now() };
    if (idx >= 0) c.items[idx] = record; else c.items.push(record);
    await saveCatalog(c.items);
    return { content: [{ type: 'text', text: JSON.stringify(record, null, 2) }] };
  });

  mcp.tool('bulk_upsert_neet_resources', 'Create or update multiple NEET resource catalog records at once.', {
    resources: z.array(z.object({
      kind: z.enum(['hub','year','subject','chapter','question','pdf','tool']), title: z.string().min(3), slug: z.string().min(1),
      url: z.string().url().optional(), status: z.enum(['planned','draft','published','verified']).default('planned'),
      year: z.number().int().min(1988).max(2100).optional(), subject: z.enum(SUBJECTS).optional(), chapter: z.string().optional(),
      sourceUrl: z.string().url().optional(), sourceType: z.string().optional(), rights: z.string().default('original'),
      hasHtml: z.boolean().default(false), hasPdf: z.boolean().default(false), notes: z.string().optional()
    })).min(1).max(100)
  }, async ({ resources }) => {
    const c = await loadCatalog();
    const changed = [];
    for (const args of resources) {
      const id = idFor([args.kind, args.slug]);
      const idx = c.items.findIndex(x => x.id === id || x.slug === args.slug);
      const record = { ...(idx >= 0 ? c.items[idx] : {}), ...args, id, updatedAt: now() };
      if (idx >= 0) c.items[idx] = record; else c.items.push(record);
      changed.push(record);
    }
    await saveCatalog(c.items);
    return { content: [{ type: 'text', text: JSON.stringify({ count: changed.length, changed }, null, 2) }] };
  });

  mcp.tool('upsert_neet_question', 'Store one verified NEET/PYQ question with original solution metadata and update the searchable question index.', {
    id: z.string().optional(), year: z.number().int().min(1988).max(2100), subject: z.enum(SUBJECTS), chapter: z.string().min(1),
    stem: z.string().min(3), options: z.array(z.string()).length(4), correctAnswer: z.string().min(1), solution: z.string().min(1),
    concept: z.string().optional(), difficulty: z.enum(['easy','moderate','hard']).optional(), paperCode: z.string().optional(), questionNumber: z.string().optional(),
    sourceUrl: z.string().url().optional(), sourceRef: z.string().optional(), sourceType: z.string().default('official-or-verified'),
    rights: z.string().default('source-linked-original-solution'), imageRefs: z.array(z.string()).default([]), verified: z.boolean().default(false)
  }, async args => {
    const stemHash = crypto.createHash('sha1').update(args.stem.trim().toLowerCase()).digest('hex');
    const id = args.id || idFor([String(args.year), args.subject, args.paperCode || '', args.questionNumber || '', stemHash]);
    const q = { ...args, id, stemHash, updatedAt: now() };
    const quality = questionQuality(q);
    q.quality = quality;
    await saveJson(questionPath(id), q);
    const idx = await loadQuestionIndex();
    const summary = questionSummary(q);
    const existing = idx.questions.findIndex(x => x.id === id);
    if (existing >= 0) idx.questions[existing] = summary; else idx.questions.push(summary);
    await saveQuestionIndex(idx.questions);
    return { content: [{ type: 'text', text: JSON.stringify(q, null, 2) }] };
  });

  mcp.tool('neet_question_search', 'Search stored NEET questions by year, subject, chapter and readiness.', {
    year: z.number().int().optional(), subject: z.enum(SUBJECTS).optional(), chapterContains: z.string().optional(), indexReadyOnly: z.boolean().default(false), limit: z.number().int().min(1).max(200).default(50)
  }, async ({ year, subject, chapterContains, indexReadyOnly, limit }) => {
    const idx = await loadQuestionIndex();
    let rows = idx.questions || [];
    if (year) rows = rows.filter(x => x.year === year);
    if (subject) rows = rows.filter(x => x.subject === subject);
    if (chapterContains) rows = rows.filter(x => String(x.chapter || '').toLowerCase().includes(chapterContains.toLowerCase()));
    if (indexReadyOnly) rows = rows.filter(x => x.indexReady);
    rows = rows.slice(0, limit);
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  });

  mcp.tool('neet_question_qa', 'Audit stored NEET questions for missing evidence, weak solutions, duplicates and index-readiness.', {
    limit: z.number().int().min(1).max(500).default(200)
  }, async ({ limit }) => {
    const idx = await loadQuestionIndex();
    const rows = (idx.questions || []).slice(0, limit);
    const duplicateGroups = new Map();
    const details = [];
    for (const s of rows) {
      const q = await loadJson(questionPath(s.id), null);
      if (!q) { details.push({ id: s.id, error: 'missing-question-record' }); continue; }
      const quality = questionQuality(q);
      const key = q.stemHash || crypto.createHash('sha1').update(q.stem || '').digest('hex');
      if (!duplicateGroups.has(key)) duplicateGroups.set(key, []);
      duplicateGroups.get(key).push(q.id);
      details.push({ id: q.id, year: q.year, subject: q.subject, chapter: q.chapter, ...quality, verified: Boolean(q.verified) });
    }
    const duplicates = [...duplicateGroups.entries()].filter(([, ids]) => ids.length > 1).map(([stemHash, ids]) => ({ stemHash, ids }));
    return { content: [{ type: 'text', text: JSON.stringify({ audited: details.length, indexReady: details.filter(x => x.indexReady).length, duplicates, details }, null, 2) }] };
  });

  mcp.tool('neet_page_blueprint', 'Return the SEO/content blueprint and indexation rule for a NEET hub, year, subject, chapter or question page.', {
    kind: z.enum(['hub','year','subject','chapter','question']), year: z.number().int().optional(), subject: z.enum(SUBJECTS).optional(), chapter: z.string().optional(), questionId: z.string().optional()
  }, async args => ({ content: [{ type: 'text', text: JSON.stringify(pageBlueprint(args), null, 2) }] }));

  mcp.tool('neet_resource_gap_report', 'Return the next highest-value gaps in the NEET resource library without recommending thin doorway pages.', {
    minQuestionsForSubjectPage: z.number().int().min(1).default(20), minQuestionsForYearPage: z.number().int().min(1).default(60)
  }, async ({ minQuestionsForSubjectPage, minQuestionsForYearPage }) => {
    const [catalog, qi] = await Promise.all([loadCatalog(), loadQuestionIndex()]);
    const cov = coverage(catalog, qi);
    const actions = [];
    const hub = catalog.items.find(x => x.kind === 'hub');
    if (!hub || hub.status !== 'published') actions.push({ priority: 100, type: 'hub', action: 'Publish the canonical NEET PYQ hub with substantial unique guidance and year/subject navigation.' });
    for (const y of YEARS) {
      const count = cov.yearQuestionCounts[y] || 0;
      const record = catalog.items.find(x => x.kind === 'year' && x.year === y);
      if (count >= minQuestionsForYearPage && record?.status !== 'published') actions.push({ priority: 90, type: 'year', year: y, count, action: `Publish NEET ${y} year page with verified paper source, analysis and original solutions.` });
      else if (count < minQuestionsForYearPage) actions.push({ priority: 70, type: 'question-ingest', year: y, count, needed: minQuestionsForYearPage - count, action: `Ingest/verify more NEET ${y} questions before creating a standalone indexable year page.` });
    }
    for (const s of SUBJECTS) {
      const count = cov.subjectQuestionCounts[s] || 0;
      const record = catalog.items.find(x => x.kind === 'subject' && x.subject === s);
      if (count >= minQuestionsForSubjectPage && record?.status !== 'published') actions.push({ priority: 85, type: 'subject', subject: s, count, action: `Publish ${s} PYQ collection with filters and worked solutions.` });
      else if (count < minQuestionsForSubjectPage) actions.push({ priority: 65, type: 'question-ingest', subject: s, count, needed: minQuestionsForSubjectPage - count, action: `Add verified ${s} PYQs before indexing a standalone subject page.` });
    }
    actions.sort((a,b) => b.priority - a.priority);
    return { content: [{ type: 'text', text: JSON.stringify({ coverage: cov, actions }, null, 2) }] };
  });

  mcp.tool('neet_library_manifest', 'Return the canonical URL architecture for the St. Mary’s NEET resource library.', {}, async () => {
    const catalog = await loadCatalog();
    return { content: [{ type: 'text', text: JSON.stringify({
      root: 'https://smis.edu.in/neet/previous-year-question-papers/',
      years: YEARS.map(y => `https://smis.edu.in/neet/previous-year-question-papers/${y}/`),
      subjects: SUBJECTS.map(s => `https://smis.edu.in/neet/previous-year-question-papers/${slugify(s)}/`),
      questionPattern: 'https://smis.edu.in/neet/pyq/{year}/{subject}/{chapter}/{question-id}/',
      rules: ['One canonical URL per intent', 'No thin auto-indexed pages', 'Link/attribute lawful source papers', 'Publish original worked solutions and analysis', 'Verify answer/source before indexation', 'Question pages must be standalone-useful or remain inside collections'],
      catalog: catalog.items
    }, null, 2) }] };
  });
}
