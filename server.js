import http from 'node:http';
import crypto from 'node:crypto';
import { google } from 'googleapis';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const REDIRECT_URI = `${BASE_URL}/auth/google/callback`;
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI,
  );
}

function authFromEnv() {
  if (!process.env.GOOGLE_REFRESH_TOKEN) throw new Error('Google Search Console is not connected yet.');
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return auth;
}

async function queryGsc({ siteUrl, startDate, endDate, dimensions = ['query'], rowLimit = 1000 }) {
  const searchconsole = google.searchconsole({ version: 'v1', auth: authFromEnv() });
  const r = await searchconsole.searchanalytics.query({
    siteUrl,
    requestBody: { startDate, endDate, dimensions, rowLimit },
  });
  return r.data.rows || [];
}

function makeServer() {
  const mcp = new McpServer({ name: 'Presa SEO Console', version: '0.1.0' });

  mcp.tool('list_sites', 'List Google Search Console properties available to the connected account.', {}, async () => {
    const sc = google.searchconsole({ version: 'v1', auth: authFromEnv() });
    const r = await sc.sites.list();
    return { content: [{ type: 'text', text: JSON.stringify(r.data.siteEntry || [], null, 2) }] };
  });

  mcp.tool('search_performance', 'Get Search Console clicks, impressions, CTR and average position grouped by query/page/date/device/country.', {
    siteUrl: z.string(),
    startDate: z.string().describe('YYYY-MM-DD'),
    endDate: z.string().describe('YYYY-MM-DD'),
    dimensions: z.array(z.enum(['query','page','date','device','country'])).default(['query']),
    rowLimit: z.number().int().min(1).max(25000).default(1000),
  }, async (args) => {
    const rows = await queryGsc(args);
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  });

  mcp.tool('keyword_performance', 'Get performance and ranking URLs for one keyword/query in a date range.', {
    siteUrl: z.string(), keyword: z.string(), startDate: z.string(), endDate: z.string(),
  }, async ({ siteUrl, keyword, startDate, endDate }) => {
    const sc = google.searchconsole({ version: 'v1', auth: authFromEnv() });
    const r = await sc.searchanalytics.query({ siteUrl, requestBody: {
      startDate, endDate, dimensions: ['query','page'], rowLimit: 25000,
      dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'equals', expression: keyword }] }],
    }});
    return { content: [{ type: 'text', text: JSON.stringify(r.data.rows || [], null, 2) }] };
  });

  mcp.tool('find_opportunities', 'Find queries with meaningful impressions that are close to page one or have weak CTR.', {
    siteUrl: z.string(), startDate: z.string(), endDate: z.string(), minImpressions: z.number().default(50),
  }, async ({ siteUrl, startDate, endDate, minImpressions }) => {
    const rows = await queryGsc({ siteUrl, startDate, endDate, dimensions: ['query'], rowLimit: 25000 });
    const opportunities = rows.filter(r => (r.impressions || 0) >= minImpressions && (((r.position || 0) >= 4 && (r.position || 0) <= 20) || (r.ctr || 0) < 0.02));
    return { content: [{ type: 'text', text: JSON.stringify(opportunities, null, 2) }] };
  });

  return mcp;
}

const sessions = new Map();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', BASE_URL);
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ name: 'Presa SEO Console', status: 'ok', mcp: '/mcp', googleConnect: '/auth/google' }));
  }
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (req.method === 'GET' && url.pathname === '/auth/google') {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      res.writeHead(503, { 'content-type': 'text/plain' }); return res.end('Google OAuth credentials are not configured.');
    }
    const state = crypto.randomBytes(24).toString('hex');
    const auth = oauthClient();
    const target = auth.generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: [SCOPE], state });
    res.writeHead(302, { location: target }); return res.end();
  }
  if (req.method === 'GET' && url.pathname === '/auth/google/callback') {
    try {
      const code = url.searchParams.get('code');
      if (!code) throw new Error('Missing OAuth code');
      const { tokens } = await oauthClient().getToken(code);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<h1>Google connected</h1><p>Presa SEO Console received authorization.</p><p>For V1 setup, securely add the refresh token to the deployment environment as <code>GOOGLE_REFRESH_TOKEN</code>. Do not commit it to GitHub.</p><pre>${tokens.refresh_token ? 'Refresh token generated successfully.' : 'No refresh token returned; revoke app access and reconnect with consent.'}</pre>`);
    } catch (e) { res.writeHead(500); return res.end(`OAuth error: ${e.message}`); }
  }
  if (url.pathname === '/mcp' && (req.method === 'POST' || req.method === 'GET' || req.method === 'DELETE')) {
    try {
      let body;
      if (req.method === 'POST') {
        body = await new Promise((resolve, reject) => { let d=''; req.on('data', c => d += c); req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch(e){ reject(e); } }); });
      }
      const sessionId = req.headers['mcp-session-id'];
      let transport = sessionId ? sessions.get(sessionId) : undefined;
      if (!transport && req.method === 'POST') {
        transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => crypto.randomUUID(), onsessioninitialized: id => sessions.set(id, transport) });
        transport.onclose = () => { if (transport.sessionId) sessions.delete(transport.sessionId); };
        await makeServer().connect(transport);
      }
      if (!transport) { res.writeHead(400); return res.end('Invalid or missing MCP session'); }
      return await transport.handleRequest(req, res, body);
    } catch (e) { res.writeHead(500, { 'content-type':'application/json' }); return res.end(JSON.stringify({ error: e.message })); }
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => console.log(`Presa SEO Console listening on ${PORT}`));
