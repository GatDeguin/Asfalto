import {readdir,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const args=process.argv.slice(2),option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const testDirectory=path.resolve(option('--tests-dir','tools')),report=path.resolve(option('--report','qa-output/all-tests.tap'));
try{
 const tests=(await readdir(testDirectory)).filter(name=>name.endsWith('.test.mjs')).sort().map(name=>path.join(testDirectory,name));
 if(!tests.length)throw Error('No tests discovered; refusing a false green release.');
 await mkdir(path.dirname(report),{recursive:true});
 // Never inherit an enclosing node:test worker protocol into this independent suite.
 const childEnv={...process.env};delete childEnv.NODE_TEST_CONTEXT;
 const result=await new Promise((resolve,reject)=>{let output='';const child=spawn(process.execPath,['--test',...tests],{stdio:['ignore','pipe','pipe'],env:childEnv});for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output+=chunk;});child.once('error',reject);child.once('close',(code,signal)=>resolve({code,signal,output}));});
 await writeFile(report,result.output);const summary=result.output.split('\n').filter(line=>/^# (tests|pass|fail|cancelled|skipped|duration_ms) /.test(line));console.log(summary.join('\n'));
 if(result.code!==0||result.signal)throw Error(`Test suite failed (exit ${result.code}, signal ${result.signal||'none'}). See ${report}`);
 console.log(`Strict release gate passed: ${tests.length} test files. No tolerated-failure list.`);
}catch(error){console.error(error.message);process.exitCode=1;}
