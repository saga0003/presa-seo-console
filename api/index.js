import crypto from 'node:crypto';
import { google } from 'googleapis';
import { put, get } from '@vercel/blob';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const BASE_URL = process.env.BASE_URL || 'https://presa-seo-console.vercel.app';
const REDIRECT_URI = `${BASE_URL}/auth/google/callback`;
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_PATH = 'oauth/google-search-console.json';

function oauthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, REDIRECT_URI);
}

async function loadGoogleTokens() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Private credential storage is not configured.');
  try {
    const result = await get(TOKEN_PATH, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!result || result.statusCode === 404 || !result.stream) throw new Error('Google Search Console is not connected yet.');
    const chunks=[];
    for await (const chunk of result.stream) chunks.push(Buffer.from(chunk));
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (e) {
    if (String(e?.message || e).includes('not found') || e?.statusCode === 404) throw new Error('Google Search Console is not connected yet.');
    throw e;
  }
}

async function saveGoogleTokens(tokens) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Private credential storage is not configured.');
  await put(TOKEN_PATH, JSON.stringify(tokens), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
}

async function authFromStore() {
  const tokens = await loadGoogleTokens();
  const auth = oauthClient();
  auth.setCredentials(tokens);
  auth.on('tokens', async fresh => {
    if (!fresh || Object.keys(fresh).length === 0) return;
    const current = await loadGoogleTokens();
    await saveGoogleTokens({ ...current, ...fresh, refresh_token: fresh.refresh_token || current.refresh_token });
  });
  return auth;
}

async function queryGsc({ siteUrl, startDate, endDate, dimensions=['query'], rowLimit=1000 }) {
  const sc = google.searchconsole({ version:'v1', auth:await authFromStore() });
  const r = await sc.searchanalytics.query({ siteUrl, requestBody:{ startDate,endDate,dimensions,rowLimit } });
  return r.data.rows || [];
}

function makeMcp() {
  const mcp = new McpServer({ name:'Presa SEO Console', version:'0.2.0' });
  mcp.tool('list_sites','List Google Search Console properties available to the connected account.',{},async()=>{
    const sc=google.searchconsole({version:'v1',auth:await authFromStore()});
    const r=await sc.sites.list();
    return {content:[{type:'text',text:JSON.stringify(r.data.siteEntry||[],null,2)}]};
  });
  mcp.tool('search_performance','Get GSC clicks, impressions, CTR and average position.',{
    siteUrl:z.string(),startDate:z.string(),endDate:z.string(),dimensions:z.array(z.enum(['query','page','date','device','country'])).default(['query']),rowLimit:z.number().int().min(1).max(25000).default(1000)
  },async args=>({content:[{type:'text',text:JSON.stringify(await queryGsc(args),null,2)}]}));
  mcp.tool('keyword_performance','Get performance and ranking URLs for one keyword.',{
    siteUrl:z.string(),keyword:z.string(),startDate:z.string(),endDate:z.string()
  },async({siteUrl,keyword,startDate,endDate})=>{
    const sc=google.searchconsole({version:'v1',auth:await authFromStore()});
    const r=await sc.searchanalytics.query({siteUrl,requestBody:{startDate,endDate,dimensions:['query','page'],rowLimit:25000,dimensionFilterGroups:[{filters:[{dimension:'query',operator:'equals',expression:keyword}]}]}});
    return {content:[{type:'text',text:JSON.stringify(r.data.rows||[],null,2)}]};
  });
  mcp.tool('find_opportunities','Find high-impression queries near page one or with weak CTR.',{
    siteUrl:z.string(),startDate:z.string(),endDate:z.string(),minImpressions:z.number().default(50)
  },async({siteUrl,startDate,endDate,minImpressions})=>{
    const rows=await queryGsc({siteUrl,startDate,endDate,dimensions:['query'],rowLimit:25000});
    const out=rows.filter(r=>(r.impressions||0)>=minImpressions&&(((r.position||0)>=4&&(r.position||0)<=20)||(r.ctr||0)<0.02));
    return {content:[{type:'text',text:JSON.stringify(out,null,2)}]};
  });
  return mcp;
}

export default async function handler(req,res){
  const url = new URL(req.url, BASE_URL);
  const path = url.pathname;
  if(req.method==='GET' && path==='/') return res.status(200).json({name:'Presa SEO Console',status:'ok',version:'0.2.0',mcp:'/mcp',googleConnect:'/auth/google'});
  if(req.method==='GET' && path==='/health') return res.status(200).json({ok:true,storage:!!process.env.BLOB_READ_WRITE_TOKEN});
  if(req.method==='GET' && path==='/auth/google'){
    if(!process.env.GOOGLE_CLIENT_ID||!process.env.GOOGLE_CLIENT_SECRET) return res.status(503).send('Google OAuth credentials are not configured.');
    const target=oauthClient().generateAuthUrl({access_type:'offline',prompt:'consent',scope:[SCOPE],state:crypto.randomBytes(24).toString('hex')});
    res.writeHead(302,{Location:target}); return res.end();
  }
  if(req.method==='GET' && path==='/auth/google/callback'){
    try{
      const code=url.searchParams.get('code'); if(!code) throw new Error('Missing OAuth code');
      const {tokens}=await oauthClient().getToken(code);
      if(!tokens.refresh_token) return res.status(200).send('<h1>Google connected, but no refresh token was returned.</h1><p>Please reconnect with consent.</p>');
      await saveGoogleTokens(tokens);
      const auth=oauthClient(); auth.setCredentials(tokens);
      const sc=google.searchconsole({version:'v1',auth});
      const sites=await sc.sites.list();
      const count=(sites.data.siteEntry||[]).length;
      return res.status(200).send(`<h1>Google Search Console connected</h1><p>Your authorization has been stored securely in Presa SEO Console private storage.</p><p>${count} Search Console ${count===1?'property':'properties'} available.</p><p>You can close this tab and return to ChatGPT.</p>`);
    }catch(e){return res.status(500).send(`<h1>Connection error</h1><p>${String(e.message).replace(/[<>&]/g,'')}</p>`);}
  }
  if(req.method==='GET' && path==='/auth/status'){
    try{
      const auth=await authFromStore();
      const sc=google.searchconsole({version:'v1',auth});
      const r=await sc.sites.list();
      return res.status(200).json({connected:true,sites:(r.data.siteEntry||[]).map(x=>({siteUrl:x.siteUrl,permissionLevel:x.permissionLevel}))});
    }catch(e){return res.status(200).json({connected:false,message:e.message});}
  }
  if(path==='/mcp' && req.method==='POST'){
    try{
      const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined});
      await makeMcp().connect(transport);
      return await transport.handleRequest(req,res,req.body);
    }catch(e){return res.status(500).json({error:e.message});}
  }
  if(path==='/mcp' && (req.method==='GET'||req.method==='DELETE')) return res.status(405).send('Method not allowed in stateless mode');
  return res.status(404).send('Not found');
}
