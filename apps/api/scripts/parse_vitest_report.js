import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Safely parse apps/api/vitest-report.json which may contain a UTF-8 BOM
// and appended textual coverage output. Produce a cleaned JSON file.

const REPORT = path.join(__dirname, '..', 'vitest-report.json');
const OUT = path.join(__dirname, '..', 'vitest-report.cleaned.json');

function stripBOM(s) {
  return s.replace(/^\uFEFF/, '');
}

function findDelimiterIndex(s) {
  // Coverage textual output typically starts with an ANSI colored line containing 'Coverage report'
  const candidates = [
    '\nCoverage report',
    '\n % Coverage report',
    '\n\u001b[',
    '\n-------------------|',
  ];
  let idx = -1;
  for (const c of candidates) {
    const i = s.indexOf(c);
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  return idx;
}

try {
  let raw = fs.readFileSync(REPORT, 'utf8');
  raw = stripBOM(raw);
  const del = findDelimiterIndex(raw);
  const jsonText = del === -1 ? raw : raw.slice(0, del);
  const parsed = JSON.parse(jsonText);
  fs.writeFileSync(OUT, JSON.stringify(parsed, null, 2), 'utf8');
  console.log('WROTE', OUT);
} catch (err) {
  console.error('PARSE_FAILED', err && err.message);
  process.exit(1);
}
