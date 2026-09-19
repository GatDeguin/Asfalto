/** Blocking release gate. No allowlist of failing tests, no forced-success exit. */
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const repositoryRoot=fileURLToPath(new URL('../',import.meta.url));
export function runTestSuite({root=repositoryRoot,output=path.join(root,'qa-output')}={}){
 fs.mkdirSync(output,{recursive:true});const tests=fs.readdirSync(path.join(root,'tools')).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>path.join('tools',name));
 if(!tests.length)throw new Error('Release verification found no tests');
 const fd=fs.openSync(path.join(output,'full-suite.tap'),'w');let result;
 // A nested Node test process must own its runner, not inherit child-runner mode.
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 try{result=spawnSync(process.execPath,['--test',...tests],{cwd:root,env,stdio:['ignore',fd,fd],timeout:180000});}finally{fs.closeSync(fd);}
 const status=result.error||result.signal?1:result.status??1;
 fs.writeFileSync(path.join(output,'full-suite-exit-code.txt'),String(status)+'\n');return{status,testFiles:tests.length,error:result.error?.message||null,signal:result.signal||null};
}
export function verifyRelease({root=repositoryRoot,output=path.join(root,'qa-output')}={}){
 const tests=runTestSuite({root,output});const checks=[];
 for(const file of ['src/legacy/module-02.mjs','src/legacy/v6-complete-runtime.js']){const checked=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});checks.push({file,status:checked.status,error:checked.stderr});}
 const audit=spawnSync(process.execPath,['tools/cinematic-audit.mjs',path.join(output,'load-graph.json')],{cwd:root,encoding:'utf8'});fs.writeFileSync(path.join(output,'protected-files.json'),audit.stdout||'');
 let graph;try{graph=JSON.parse(fs.readFileSync(path.join(output,'load-graph.json'),'utf8'));}catch{}
 const missing=graph?.edges?.filter(edge=>!edge.exists)||[];
 const success=tests.status===0&&checks.every(check=>check.status===0)&&audit.status===0&&!!graph&&missing.length===0;
 const report={success,tests,checks,graph:{reachable:graph?.reachable?.length,missing},protectedFiles:graph?.protectedFiles||[],auditError:audit.stderr||null};
 fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success,tests,missing,protectedUnchanged:report.protectedFiles.filter(p=>p.unchanged).length}));return success?0:1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=verifyRelease({output:path.resolve(process.argv[2]||path.join(repositoryRoot,'qa-output'))});
