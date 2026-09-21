import fs from 'node:fs';
import crypto from 'node:crypto';
import {buildAnalysisReport} from './analysis-export.mjs';
const [inputFile,outputFile]=process.argv.slice(2);
if(!inputFile || !outputFile || process.argv.length!==4) throw Error('Usage: node local-lab/analyze-study.mjs INPUT.json OUTPUT.json (new file only)');
const raw=fs.readFileSync(inputFile),report=buildAnalysisReport(JSON.parse(raw));
report.input_sha256=crypto.createHash('sha256').update(raw).digest('hex');report.created_at=new Date().toISOString();
fs.writeFileSync(outputFile,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({analysis_version:report.analysis_version,strata:report.strata.length,pairs:report.pairs.length,confirmatory_authorized:false}));
