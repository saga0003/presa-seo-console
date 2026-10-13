import fs from 'node:fs';

const path = 'api/index.js';
let source = fs.readFileSync(path, 'utf8');

if (!source.includes("registerPhase2Tools")) {
  source = source.replace(
    "import { z } from 'zod';",
    "import { z } from 'zod';\nimport { registerPhase2Tools } from './phase2.js';"
  );
}
if (!source.includes("registerPhase3Tools")) {
  source = source.replace(
    "import { registerPhase2Tools } from './phase2.js';",
    "import { registerPhase2Tools } from './phase2.js';\nimport { registerPhase3Tools } from './phase3.js';"
  );
}
if (!source.includes("registerPhase4Tools")) {
  source = source.replace(
    "import { registerPhase3Tools } from './phase3.js';",
    "import { registerPhase3Tools } from './phase3.js';\nimport { registerPhase4Tools } from './phase4.js';"
  );
}

source = source.replace(/const VERSION = '0\.[0-9]+\.0';/, "const VERSION = '0.7.0';");

if (!source.includes('registerPhase2Tools(mcp);')) {
  source = source.replace(
    /\n  return mcp;\n}\n\nexport default async function handler/,
    "\n  registerPhase2Tools(mcp);\n  return mcp;\n}\n\nexport default async function handler"
  );
}
if (!source.includes('registerPhase3Tools(mcp);')) {
  source = source.replace(
    /\n  registerPhase2Tools\(mcp\);\n  return mcp;\n}/,
    "\n  registerPhase2Tools(mcp);\n  registerPhase3Tools(mcp);\n  return mcp;\n}"
  );
}
if (!source.includes('registerPhase4Tools(mcp')) {
  source = source.replace(
    /\n  registerPhase3Tools\(mcp\);\n  return mcp;\n}/,
    "\n  registerPhase3Tools(mcp);\n  registerPhase4Tools(mcp, { queryGsc });\n  return mcp;\n}"
  );
}

source = source.replace(
  /return res\.status\(200\)\.json\(\{ ok: true, version: VERSION, storage: !!process\.env\.BLOB_READ_WRITE_TOKEN(?:, phase2: true)?(?:, phase3: true)? \}\);/,
  "return res.status(200).json({ ok: true, version: VERSION, storage: !!process.env.BLOB_READ_WRITE_TOKEN, phase2: true, phase3: true, phase4: true });"
);

fs.writeFileSync(path, source);
fs.mkdirSync('public', { recursive: true });
fs.writeFileSync('public/.phase4-build', 'Presa SEO Console Phase 2 + Phase 3 + Phase 4 build\n');
console.log('Phase 2, Phase 3 and Phase 4 MCP tools enabled for build.');
