import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COVERAGE_SUMMARY = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
const LCOV_INFO = path.join(__dirname, '..', 'coverage', 'lcov.info');

// Critical files to analyze (as they appear in lcov.info - with backslashes)
const CRITICAL_FILES = [
  'src/services/risk-assessment.service.ts',
  'src/services/model-metrics.service.ts',
  'src/controllers/model.controller.ts',
  'src/controllers/risk-assessment.controller.ts',
  'src/repositories/mongoose-risk-assessment.repository.ts',
  'src/repositories/model-metrics.repository.ts',
];

const CRITICAL_FILES_LCOV = CRITICAL_FILES.map(f => f.replace(/\//g, '\\'));

// Parse coverage-summary.json
const coverageSummary = JSON.parse(fs.readFileSync(COVERAGE_SUMMARY, 'utf8'));

// Extract metrics for critical files
const criticalMetrics = {};

for (const file of CRITICAL_FILES) {
  const fileWithBackslashes = file.replace(/\//g, '\\');
  const fullPath = `C:\\Users\\musha\\OneDrive\\Documents\\fintech\\apps\\api\\${fileWithBackslashes}`;
  
  // Find matching key in coverage
  const matchedKey = coverageSummary[fullPath];
  
  if (matchedKey) {
    criticalMetrics[file] = {
      statements: matchedKey.statements.pct,
      branches: matchedKey.branches.pct,
      functions: matchedKey.functions.pct,
      lines: matchedKey.lines.pct,
      statementsCovered: matchedKey.statements.covered,
      statementsTotal: matchedKey.statements.total,
      branchesCovered: matchedKey.branches.covered,
      branchesTotal: matchedKey.branches.total,
      functionsCovered: matchedKey.functions.covered,
      functionsTotal: matchedKey.functions.total,
      linesCovered: matchedKey.lines.covered,
      linesTotal: matchedKey.lines.total,
    };
  } else {
    criticalMetrics[file] = {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
      matched: false,
    };
  }
}

// Parse lcov.info for uncovered line ranges
const lcovContent = fs.readFileSync(LCOV_INFO, 'utf8');
const fileDataMap = {};

// Parse lcov.info by SF: (source file) markers
const lcovLines = lcovContent.split('\n');
let currentFile = null;

for (const line of lcovLines) {
  if (line.startsWith('SF:')) {
    currentFile = line.substring(3).trim();
    fileDataMap[currentFile] = { uncovered: [] };
  } else if (line.startsWith('DA:') && currentFile) {
    const parts = line.substring(3).split(',');
    if (parts.length === 2) {
      const [lineNum, hits] = parts;
      if (parseInt(hits) === 0) {
        fileDataMap[currentFile].uncovered.push(parseInt(lineNum));
      }
    }
  } else if (line.startsWith('end_of_record')) {
    currentFile = null;
  }
}

// Create uncovered ranges
const uncoveredRanges = {};
for (const file of CRITICAL_FILES) {
  const fileWithBackslashes = file.replace(/\//g, '\\');
  
  // Try to find matching file in lcov map (try both formats)
  let fileData = fileDataMap[fileWithBackslashes];
  
  if (!fileData) {
    // Try with src\ prefix
    fileData = fileDataMap[`src\\${fileWithBackslashes.split('\\').slice(1).join('\\')}`];
  }
  
  if (fileData) {
    const uncovered = fileData.uncovered.sort((a, b) => a - b);
    const ranges = [];
    
    if (uncovered.length > 0) {
      let rangeStart = uncovered[0];
      let rangeEnd = uncovered[0];
      
      for (let i = 1; i < uncovered.length; i++) {
        if (uncovered[i] === rangeEnd + 1) {
          rangeEnd = uncovered[i];
        } else {
          ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}–${rangeEnd}`);
          rangeStart = uncovered[i];
          rangeEnd = uncovered[i];
        }
      }
      ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}–${rangeEnd}`);
    }
    
    uncoveredRanges[file] = ranges;
  }
}

// Output results
console.log('\n========== CRITICAL FILES COVERAGE METRICS ==========\n');

for (const file of CRITICAL_FILES) {
  const metrics = criticalMetrics[file];
  const fileName = file.split('/').pop();
  const serviceName = fileName.replace('.ts', '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  
  console.log(`\n${serviceName}`);
  console.log(`File: ${file}`);
  console.log(`Statements: ${metrics.statements.toFixed(2)}% (${metrics.statementsCovered}/${metrics.statementsTotal})`);
  console.log(`Branches: ${metrics.branches.toFixed(2)}% (${metrics.branchesCovered}/${metrics.branchesTotal})`);
  console.log(`Functions: ${metrics.functions.toFixed(2)}% (${metrics.functionsCovered}/${metrics.functionsTotal})`);
  console.log(`Lines: ${metrics.lines.toFixed(2)}% (${metrics.linesCovered}/${metrics.linesTotal})`);
  
  const ranges = uncoveredRanges[file];
  if (ranges && ranges.length > 0) {
    console.log(`Uncovered lines: ${ranges.join(', ')}`);
  } else {
    console.log('Uncovered lines: None');
  }
}

console.log('\n\n========== JSON OUTPUT ==========\n');
console.log(JSON.stringify({
  criticalMetrics,
  uncoveredRanges,
}, null, 2));
