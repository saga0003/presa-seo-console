import fs from 'node:fs';

const path = 'api/index.js';
let source = fs.readFileSync(path, 'utf8');

if (!source.includes("registerPhase2Tools")) {
  source = source.replace(
    "import { z } from 'zod';",
    "import { z } from 'zod';\nimport { registerPhase2Tools } from './phase2.js';"
  );
}

source = source.replace("const VERSION = '0.4.0';", "const VERSION = '0.5.0';");

if (!source.includes('registerPhase2Tools(mcp);')) {
  source = source.replace(
    /\n  return mcp;\n}\n\nexport default async function handler/,
    "\n  registerPhase2Tools(mcp);\n  return mcp;\n}\n\nexport default async function handler"
  );
}

source = source.replace(
  "return res.status(200).json({ ok: true, version: VERSION, storage: !!process.env.BLOB_READ_WRITE_TOKEN });",
  "return res.status(200).json({ ok: true, version: VERSION, storage: !!process.env.BLOB_READ_WRITE_TOKEN, phase2: true });"
);

fs.writeFileSync(path, source);
console.log('Phase 2 MCP tools enabled for build.');
