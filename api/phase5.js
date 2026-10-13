import crypto from 'node:crypto';
import { get, put } from '@vercel/blob';
import { z } from 'zod';

const QUESTION_INDEX_PATH = 'resources/neet/questions-index.json';
const SESSION_PREFIX = 'practice/sessions/';
const LEARNER_PREFIX = 'practice/learners/';
const SUBJECTS = ['Physics', 'Chemistry', 'Botany', 'Zoology'];
const MODES = ['practice', 'test'];
const ALLOWED_ORIGINS = new Set([
  'https://smis.edu.in',
  'https://www.smis.edu.in',
  'https://presa-seo-console.vercel.app'
]);

function blobToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Private Blob storage is not configured.');
  return process.env.BLOB_READ_WRITE_TOKEN;
}

async function loadJson(path, fallback = null) {
  try {
    const r = await get(path, { access: 'private', token: blobToken() });
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
    contentType: 'application/json', token: blobToken()
  });
  return value;
}

const now = () => new Date().toISOString();
const randomId = (bytes = 16) => crypto.randomBytes(bytes).toString('hex');
const questionPath = id => `resources/neet/questions/${id}.json`;
const sessionPath = id => `${SESSION_PREFIX}${id}.json`;
const learnerPath = id => `${LEARNER_PREFIX}${id}.json`;

function safeQuestion(q) {
  return {
    id: q.id,
    year: q.year,
    subject: q.subject,
    chapter: q.chapter,
    stem: q.stem,
    options: q.options,
    difficulty: q.difficulty || null,
    concept: q.concept || null,
    imageRefs: Array.isArray(q.imageRefs) ? q.imageRefs : []
  };
}

function answerKey(q) {
  const raw = String(q.correctAnswer || '').trim();
  const letters = ['A', 'B', 'C', 'D'];
  const upper = raw.toUpperCase();
  if (letters.includes(upper)) return upper;
  const idx = (q.options || []).findIndex(x => String(x).trim() === raw);
  return idx >= 0 ? letters[idx] : upper;
}

function normalizeAnswer(answer) {
  const upper = String(answer || '').trim().toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(upper)) return upper;
  return upper;
}

async function loadVerifiedQuestions(filters = {}) {
  const index = await loadJson(QUESTION_INDEX_PATH, { questions: [] });
  let summaries = Array.isArray(index?.questions) ? index.questions : [];
  if (filters.year) summaries = summaries.filter(x => x.year === Number(filters.year));
  if (filters.subject) summaries = summaries.filter(x => x.subject === filters.subject);
  if (filters.chapter) summaries = summaries.filter(x => String(x.chapter || '').toLowerCase().includes(String(filters.chapter).toLowerCase()));
  if (filters.difficulty) summaries = summaries.filter(x => x.difficulty === filters.difficulty);

  const questions = [];
  for (const s of summaries.slice(0, 1200)) {
    const q = await loadJson(questionPath(s.id), null);
    if (!q) continue;
    const ready = q.verified === true && q.quality?.indexReady === true;
    if (!ready) continue;
    if (!Array.isArray(q.options) || q.options.length !== 4 || !q.correctAnswer || !q.solution) continue;
    questions.push(q);
  }
  return questions;
}

function shuffled(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function practiceReadiness() {
  const qs = await loadVerifiedQuestions();
  const bySubject = Object.fromEntries(SUBJECTS.map(s => [s, 0]));
  const byYear = {};
  const chapters = {};
  for (const q of qs) {
    bySubject[q.subject] = (bySubject[q.subject] || 0) + 1;
    byYear[q.year] = (byYear[q.year] || 0) + 1;
    const key = `${q.subject} · ${q.chapter}`;
    chapters[key] = (chapters[key] || 0) + 1;
  }
  return {
    ready: qs.length > 0,
    verifiedQuestions: qs.length,
    bySubject,
    byYear,
    topChapters: Object.entries(chapters).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([chapter, count]) => ({ chapter, count })),
    minimumRecommendedForPublicPractice: 20,
    publicPracticeMature: qs.length >= 20,
    note: qs.length ? 'Only verified, index-ready questions are eligible.' : 'The practice engine is live, but no verified/index-ready historical questions are available yet.'
  };
}

async function createSession(args = {}) {
  const mode = MODES.includes(args.mode) ? args.mode : 'practice';
  const count = Math.max(1, Math.min(Number(args.count || 10), 100));
  const filters = {
    year: args.year ? Number(args.year) : undefined,
    subject: SUBJECTS.includes(args.subject) ? args.subject : undefined,
    chapter: args.chapter || undefined,
    difficulty: ['easy', 'moderate', 'hard'].includes(args.difficulty) ? args.difficulty : undefined
  };
  let pool = await loadVerifiedQuestions(filters);
  if (Array.isArray(args.questionIds) && args.questionIds.length) {
    const ids = new Set(args.questionIds);
    pool = pool.filter(q => ids.has(q.id));
  }
  if (!pool.length) {
    const readiness = await practiceReadiness();
    const e = new Error('No verified questions match this practice request yet.');
    e.statusCode = 409;
    e.details = readiness;
    throw e;
  }
  const chosen = shuffled(pool).slice(0, Math.min(count, pool.length));
  const sessionId = randomId(12);
  const sessionToken = randomId(24);
  const learnerId = String(args.learnerId || '').match(/^[a-f0-9]{16,64}$/i) ? args.learnerId : randomId(12);
  const session = {
    id: sessionId,
    tokenHash: crypto.createHash('sha256').update(sessionToken).digest('hex'),
    learnerId,
    mode,
    filters,
    questionIds: chosen.map(q => q.id),
    responses: {},
    createdAt: now(),
    updatedAt: now(),
    finishedAt: null
  };
  await saveJson(sessionPath(sessionId), session);
  return {
    sessionId,
    sessionToken,
    learnerId,
    mode,
    count: chosen.length,
    questions: chosen.map(safeQuestion)
  };
}

function verifySessionToken(session, token) {
  if (!session || !token) return false;
  const incoming = crypto.createHash('sha256').update(String(token)).digest('hex');
  const a = Buffer.from(incoming);
  const b = Buffer.from(String(session.tokenHash || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function updateLearner(learnerId, q, response) {
  const learner = await loadJson(learnerPath(learnerId), {
    id: learnerId, createdAt: now(), updatedAt: now(), attempts: {}, totals: { attempted: 0, correct: 0, wrong: 0 }
  });
  const current = learner.attempts[q.id] || {
    questionId: q.id, subject: q.subject, chapter: q.chapter, concept: q.concept || null,
    year: q.year, difficulty: q.difficulty || null, attempts: 0, correct: 0, wrong: 0, lastAnswer: null, lastAt: null
  };
  current.attempts += 1;
  current.lastAnswer = response.answer;
  current.lastAt = now();
  current.lastConfidence = response.confidence || null;
  if (response.correct) current.correct += 1; else current.wrong += 1;
  learner.attempts[q.id] = current;
  learner.totals.attempted += 1;
  if (response.correct) learner.totals.correct += 1; else learner.totals.wrong += 1;
  learner.updatedAt = now();
  await saveJson(learnerPath(learnerId), learner);
  return learner;
}

async function submitAnswer(args) {
  const session = await loadJson(sessionPath(args.sessionId), null);
  if (!session || !verifySessionToken(session, args.sessionToken)) {
    const e = new Error('Invalid or expired practice session.'); e.statusCode = 403; throw e;
  }
  if (session.finishedAt) { const e = new Error('This session has already been finished.'); e.statusCode = 409; throw e; }
  if (!session.questionIds.includes(args.questionId)) { const e = new Error('Question is not part of this session.'); e.statusCode = 400; throw e; }
  const q = await loadJson(questionPath(args.questionId), null);
  if (!q || q.verified !== true || q.quality?.indexReady !== true) { const e = new Error('Question is no longer available.'); e.statusCode = 409; throw e; }
  const answer = normalizeAnswer(args.answer);
  const correctAnswer = answerKey(q);
  const response = {
    answer,
    correct: answer === correctAnswer,
    confidence: args.confidence || null,
    answeredAt: now()
  };
  session.responses[q.id] = response;
  session.updatedAt = now();
  await saveJson(sessionPath(session.id), session);
  await updateLearner(session.learnerId, q, response);

  if (session.mode === 'test') return { recorded: true, questionId: q.id };
  return {
    recorded: true,
    questionId: q.id,
    correct: response.correct,
    correctAnswer,
    solution: q.solution,
    concept: q.concept || null,
    chapter: q.chapter,
    sourceRef: q.sourceRef || null,
    sourceUrl: q.sourceUrl || null
  };
}

async function finishSession(args) {
  const session = await loadJson(sessionPath(args.sessionId), null);
  if (!session || !verifySessionToken(session, args.sessionToken)) {
    const e = new Error('Invalid or expired practice session.'); e.statusCode = 403; throw e;
  }
  const questions = [];
  for (const id of session.questionIds) {
    const q = await loadJson(questionPath(id), null);
    if (q) questions.push(q);
  }
  const details = questions.map(q => {
    const response = session.responses[q.id] || null;
    const correctAnswer = answerKey(q);
    return {
      questionId: q.id,
      subject: q.subject,
      chapter: q.chapter,
      concept: q.concept || null,
      year: q.year,
      difficulty: q.difficulty || null,
      answered: Boolean(response),
      answer: response?.answer || null,
      correct: Boolean(response?.correct),
      correctAnswer,
      solution: q.solution
    };
  });
  const answered = details.filter(x => x.answered).length;
  const correct = details.filter(x => x.correct).length;
  const wrong = details.filter(x => x.answered && !x.correct).length;
  const skipped = details.length - answered;
  const byChapter = {};
  const bySubject = {};
  for (const d of details) {
    const c = byChapter[d.chapter] || { attempted: 0, correct: 0, wrong: 0 };
    if (d.answered) c.attempted += 1;
    if (d.correct) c.correct += 1;
    if (d.answered && !d.correct) c.wrong += 1;
    byChapter[d.chapter] = c;
    const s = bySubject[d.subject] || { attempted: 0, correct: 0, wrong: 0 };
    if (d.answered) s.attempted += 1;
    if (d.correct) s.correct += 1;
    if (d.answered && !d.correct) s.wrong += 1;
    bySubject[d.subject] = s;
  }
  session.finishedAt = session.finishedAt || now();
  session.updatedAt = now();
  await saveJson(sessionPath(session.id), session);
  return {
    sessionId: session.id,
    learnerId: session.learnerId,
    mode: session.mode,
    total: details.length,
    answered,
    correct,
    wrong,
    skipped,
    accuracy: answered ? correct / answered : 0,
    bySubject,
    byChapter,
    details
  };
}

async function learnerAnalytics(learnerId) {
  const learner = await loadJson(learnerPath(learnerId), null);
  if (!learner) return { learnerId, attempts: 0, message: 'No practice history yet.', bySubject: {}, byChapter: {}, weakAreas: [] };
  const bySubject = {};
  const byChapter = {};
  for (const x of Object.values(learner.attempts || {})) {
    const s = bySubject[x.subject] || { attempts: 0, correct: 0, wrong: 0 };
    s.attempts += x.attempts; s.correct += x.correct; s.wrong += x.wrong; bySubject[x.subject] = s;
    const key = `${x.subject} · ${x.chapter}`;
    const c = byChapter[key] || { attempts: 0, correct: 0, wrong: 0 };
    c.attempts += x.attempts; c.correct += x.correct; c.wrong += x.wrong; byChapter[key] = c;
  }
  const weakAreas = Object.entries(byChapter).map(([area, v]) => ({
    area, ...v, accuracy: v.attempts ? v.correct / v.attempts : 0
  })).filter(x => x.attempts >= 1).sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts).slice(0, 12);
  return { learnerId, totals: learner.totals, bySubject, byChapter, weakAreas, updatedAt: learner.updatedAt };
}

async function errorNotebook(learnerId, limit = 50) {
  const learner = await loadJson(learnerPath(learnerId), null);
  if (!learner) return [];
  return Object.values(learner.attempts || {})
    .filter(x => x.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || String(b.lastAt).localeCompare(String(a.lastAt)))
    .slice(0, Math.max(1, Math.min(Number(limit || 50), 200)));
}

async function createRetest(args) {
  const notebook = await errorNotebook(args.learnerId, 200);
  const ids = notebook.map(x => x.questionId);
  if (!ids.length) { const e = new Error('No incorrect questions are available for a retest yet.'); e.statusCode = 409; throw e; }
  return createSession({ learnerId: args.learnerId, mode: args.mode || 'practice', count: args.count || 10, questionIds: ids });
}

function textResult(value) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }] };
}

export function registerPhase5Tools(mcp) {
  mcp.tool('neet_practice_readiness', 'Show how many verified/index-ready NEET questions are currently available to the interactive practice engine.', {}, async () => textResult(await practiceReadiness()));
  mcp.tool('create_neet_practice_session', 'Create an interactive NEET practice or test session from verified questions. Correct answers are not exposed in the session payload.', {
    mode: z.enum(['practice','test']).default('practice'), count: z.number().int().min(1).max(100).default(10),
    year: z.number().int().optional(), subject: z.enum(SUBJECTS).optional(), chapter: z.string().optional(), difficulty: z.enum(['easy','moderate','hard']).optional(), learnerId: z.string().optional()
  }, async args => textResult(await createSession(args)));
  mcp.tool('submit_neet_practice_answer', 'Submit one answer. Practice mode returns immediate worked feedback; test mode records the response without revealing the answer.', {
    sessionId: z.string(), sessionToken: z.string(), questionId: z.string(), answer: z.string(), confidence: z.enum(['low','medium','high']).optional()
  }, async args => textResult(await submitAnswer(args)));
  mcp.tool('finish_neet_practice_session', 'Finish a NEET practice/test session and return score, chapter/subject diagnostics and worked solutions.', {
    sessionId: z.string(), sessionToken: z.string()
  }, async args => textResult(await finishSession(args)));
  mcp.tool('neet_error_notebook', 'Return a learner error notebook ranked by repeated wrong answers.', {
    learnerId: z.string(), limit: z.number().int().min(1).max(200).default(50)
  }, async args => textResult(await errorNotebook(args.learnerId, args.limit)));
  mcp.tool('neet_practice_analytics', 'Return cumulative accuracy, subject/chapter breakdown and weakest areas for one anonymous learner id.', {
    learnerId: z.string()
  }, async args => textResult(await learnerAnalytics(args.learnerId)));
  mcp.tool('create_neet_retest_session', 'Create a new practice/test session from questions the learner previously answered incorrectly.', {
    learnerId: z.string(), mode: z.enum(['practice','test']).default('practice'), count: z.number().int().min(1).max(100).default(10)
  }, async args => textResult(await createRetest(args)));
}

function setCors(req, res) {
  const origin = String(req.headers?.origin || '');
  if (ALLOWED_ORIGINS.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return {};
}

export async function handlePracticeApi(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const rawUrl = String(req.url || '/');
  const pathname = new URL(rawUrl, 'https://presa-seo-console.vercel.app').pathname;
  const route = pathname.replace(/^\/practice-api\/?/, '').replace(/\/$/, '');
  try {
    if (req.method === 'GET' && route === 'readiness') return res.status(200).json(await practiceReadiness());
    if (req.method === 'POST' && route === 'session') return res.status(200).json(await createSession(readBody(req)));
    if (req.method === 'POST' && route === 'answer') return res.status(200).json(await submitAnswer(readBody(req)));
    if (req.method === 'POST' && route === 'finish') return res.status(200).json(await finishSession(readBody(req)));
    if (req.method === 'GET' && route === 'analytics') {
      const u = new URL(rawUrl, 'https://presa-seo-console.vercel.app');
      return res.status(200).json(await learnerAnalytics(u.searchParams.get('learnerId') || ''));
    }
    if (req.method === 'GET' && route === 'errors') {
      const u = new URL(rawUrl, 'https://presa-seo-console.vercel.app');
      return res.status(200).json(await errorNotebook(u.searchParams.get('learnerId') || '', Number(u.searchParams.get('limit') || 50)));
    }
    if (req.method === 'POST' && route === 'retest') return res.status(200).json(await createRetest(readBody(req)));
    return res.status(404).json({ error: 'practice_api_route_not_found' });
  } catch (e) {
    return res.status(e?.statusCode || 500).json({ error: String(e?.message || e), details: e?.details || undefined });
  }
}
