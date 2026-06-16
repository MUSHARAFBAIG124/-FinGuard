import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPORT = path.join(__dirname, '..', 'vitest-report.json');

function stripAnsi(s){ return s.replace(/\x1b\[[0-9;]*m/g,''); }
function stripBOM(s){ return s.replace(/^\uFEFF/, ''); }

const txt = stripBOM(fs.readFileSync(REPORT, 'utf8'));
// find header line index
const lines = txt.split(/\r?\n/).map(stripAnsi);
const headerIdx = lines.findIndex(l=>l.includes('File') && l.includes('% Stmts'));
if(headerIdx===-1) { console.error('coverage header not found'); process.exit(1); }
// separator is next line
let i = headerIdx+2; // skip header and separator
const rows = [];
for(; i<lines.length; i++){
  const line = lines[i];
  if(!line || line.startsWith('-------------------')) break;
  const parts = line.split('|').map(p=>p.trim());
  if(parts.length<5) continue;
  rows.push({file: parts[0], statements: parts[1], branches: parts[2], functions: parts[3], lines: parts[4], uncovered: parts[5]||''});
}

const overall = rows.find(r=>r.file==='All files');
console.log('OVERALL COVERAGE:', overall? overall : rows[0]);

const numericRows = rows.map(r=>{ const s = parseFloat(r.statements)||NaN; return {...r, sN: s}; }).filter(r=>!isNaN(r.sN));
numericRows.sort((a,b)=>a.sN-b.sN);
console.log('\nTOP 10 LOWEST-COVERED FILES:');
numericRows.slice(0,10).forEach(r=>console.log(r.file.padEnd(40), r.statements));

// critical file lookup
const critical = [
  'services/risk-assessment.service.ts',
  'services/model-metrics.service.ts',
  'controllers/model.controller.ts',
  'controllers/risk-assessment.controller.ts',
  'repositories/mongoose-risk-assessment.repository.ts',
  'repositories/model-metrics.repository.ts'
];
console.log('\nCRITICAL FILES BREAKDOWN:');
for(const c of critical){
  const match = rows.find(r=>r.file.includes(c) || r.file.endsWith(c) || r.file.includes(c.split('/').pop()));
  if(match) console.log(c, '->', match.statements, match.branches, match.functions, match.lines, 'uncovered:', match.uncovered);
  else {
    // try substring search in full text
    const li = lines.findIndex(l=>l.includes(c.split('/').pop()));
    if(li!==-1){
      const parts = lines[li].split('|').map(p=>p.trim());
      console.log(c,'->', parts[1], parts[2], parts[3], parts[4], 'uncovered:', parts[5]||'');
    } else {
      console.log(c,'-> not found in coverage table');
    }
  }
}

// Output uncovered line numbers for rows under 95
console.log('\nUNCOVERED LINES (rows under 95% statements):');
numericRows.filter(r=>parseFloat(r.statements)<95).forEach(r=>{
  if(r.uncovered && r.uncovered!=='') console.log(r.file, '->', r.uncovered);
});
