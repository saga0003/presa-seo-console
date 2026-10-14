import fs from 'node:fs';

const path = 'api/index.js';
let source = fs.readFileSync(path, 'utf8');

source = source.replace(
  "import { z } from 'zod';",
  "import { z } from 'zod';\nimport { registerPhase2Tools } from './phase2.js';\nimport { registerPhase3Tools } from './phase3.js';\nimport { registerPhase4Tools } from './phase4.js';\nimport { registerPhase5Tools, handlePracticeApi } from './phase5.js';"
);
source = source.replace(/const VERSION = '0\.[0-9]+\.0';/, "const VERSION = '0.8.0';");

source = source.replace(
  /\n  return mcp;\n}\n\nexport default async function handler/,
  "\n  registerPhase2Tools(mcp);\n  registerPhase3Tools(mcp);\n  registerPhase4Tools(mcp, { queryGsc });\n  registerPhase5Tools(mcp);\n  return mcp;\n}\n\nexport default async function handler"
);

source = source.replace(
  /export default async function handler\(req, res\) \{\n/,
  "export default async function handler(req, res) {\n  const requestPath = new URL(req.url || '/', BASE_URL).pathname;\n  if (requestPath.startsWith('/practice-api/')) return handlePracticeApi(req, res);\n"
);

source = source.replace(
  "return res.status(200).json({ ok: true, version: VERSION, storage: !!process.env.BLOB_READ_WRITE_TOKEN });",
  "return res.status(200).json({ ok: true, version: VERSION, storage: !!process.env.BLOB_READ_WRITE_TOKEN, phase2: true, phase3: true, phase4: true, phase5: true });"
);

fs.writeFileSync(path, source);
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/.phase5-build', 'Presa SEO Console Phase 5 build\n');
console.log('Phase 2 through Phase 5 enabled for build.');
