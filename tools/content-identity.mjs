import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const sha=x=>createHash('sha256').update(x).digest('hex').slice(0,16);
const quote=/(["'`])((?:\.\.?\/|src\/|assets\/)[^\s"'`<>]+)\1(?!\s*:)/g;
const normalize=s=>s.replace(quote,(all,q,ref)=>q+version(ref,null)+q);
function version(ref,id){
 const [url,hash]=ref.split('#'),[bare,search]=url.split('?');
 const params=new URLSearchParams(search);params.delete('v');if(id!==null&&id!==undefined)params.set('v',id);
 return bare+(params.size?'?'+params:'')+(hash?'#'+hash:'');
}
function target(p,ref){
 const bare=decodeURIComponent(ref.split(/[?#]/)[0]);
 return /^(?:\.\/)?(?:src|assets)\//.test(bare)?bare.replace(/^\.\//,''):path.posix.normalize(path.posix.join(path.posix.dirname(p),bare));
}
function filesAt(root){const out=[];function visit(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['.git','node_modules','test-results','playwright-report'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())visit(p);else if(e.isFile())out.push(path.relative(root,p).replaceAll('\\','/'));}}visit(root);return out.sort();}

export function applyContentIdentity(root,baseline){
 // The release inventory contains hashes of this graph; hashing it back into the graph is self-referential.
 const inventoryPath='assets/manifests/release.json';
 const files=filesAt(root).filter(p=>p!==inventoryPath),baselineTexts=new Map(),versionVotes=new Map();
 // Published URLs are authoritative for unchanged dependencies, even if a copied
 // source importer has no version or an older version. Choose one deterministically
 // if an earlier release already contained inconsistent identities for a target.
 for(const p of filesAt(baseline))if(/\.(?:mjs|js|html|css)$/.test(p)){
  const text=fs.readFileSync(path.join(baseline,p),'utf8');baselineTexts.set(p,text);
  for(const match of text.matchAll(quote)){
   const d=target(p,match[2]),query=match[2].split('#')[0].split('?')[1];
   if(d===inventoryPath)continue;
   const id=new URLSearchParams(query).get('v');
   if(!versionVotes.has(d))versionVotes.set(d,new Map());
   const votes=versionVotes.get(d);votes.set(id,(votes.get(id)||0)+1);
  }
 }
 const priorIds=new Map([...versionVotes].map(([d,votes])=>[d,[...votes].sort((a,b)=>b[1]-a[1]||String(a[0]??'').localeCompare(String(b[0]??'')))[0][0]]));
 const nodes=new Map(),changed=new Set();
 for(const p of files){
  const bytes=fs.readFileSync(path.join(root,p));
  const text=/\.(?:mjs|js|html|css)$/.test(p)?bytes.toString():null;
  const digest=sha(text===null?bytes:normalize(text)),basePath=path.join(baseline,p);
  const baseText=baselineTexts.get(p);
  const same=fs.existsSync(basePath)&&digest===sha(text===null?fs.readFileSync(basePath):normalize(baseText??fs.readFileSync(basePath,'utf8')));
  if(!same)changed.add(p);
  // Restore unchanged published bytes before rewriting affected dependencies.
  nodes.set(p,{digest,text:same&&text!==null?baseText:text,originalText:text,dependencies:[]});
 }
 for(const[p,n]of nodes)if(n.text!==null){
  n.text=n.text.replace(quote,(all,q,ref)=>{const d=target(p,ref);return d===inventoryPath?q+version(ref,null)+q:priorIds.has(d)?q+version(ref,priorIds.get(d))+q:all;});
  n.dependencies=[...n.text.matchAll(quote)].map(m=>target(p,m[2])).filter(d=>nodes.has(d));
  // Canonicalizing an inconsistent published URL changes its importer too.
  if(!changed.has(p)&&n.text!==baselineTexts.get(p))changed.add(p);
 }
 let grew;do{grew=false;for(const[p,n]of nodes)if(!changed.has(p)&&n.dependencies.some(d=>changed.has(d))){changed.add(p);grew=true;}}while(grew);
 // Strongly connected components avoid recursive hash oscillation in module cycles.
 let index=0;const stack=[],components=[];
 function visit(p){
  const n=nodes.get(p);n.index=n.low=index++;stack.push(p);n.stacked=true;
  for(const d of n.dependencies){const v=nodes.get(d);if(v.index===undefined){visit(d);n.low=Math.min(n.low,v.low);}else if(v.stacked)n.low=Math.min(n.low,v.index);}
  if(n.low===n.index){const members=[];let d;do{d=stack.pop();nodes.get(d).stacked=false;nodes.get(d).component=components.length;members.push(d);}while(d!==p);components.push(members.sort());}
 }
 for(const p of nodes.keys())if(nodes.get(p).index===undefined)visit(p);
 const ids=new Map();
 function componentId(i){
  if(ids.has(i))return ids.get(i);
  const parts=components[i].map(p=>{const n=nodes.get(p);return p+':'+n.digest+':'+n.dependencies.filter(d=>nodes.get(d).component!==i).sort().map(d=>d+':'+componentId(nodes.get(d).component)).join('|');});
  const id=sha(parts.join('\n'));ids.set(i,id);return id;
 }
 for(const[p,n]of nodes)if(n.text!==null){
  const updated=n.text.replace(quote,(all,q,ref)=>{const d=target(p,ref);return changed.has(d)?q+version(ref,componentId(nodes.get(d).component))+q:all;});
  if(updated!==n.originalText)fs.writeFileSync(path.join(root,p),updated);
 }
 return {changed:[...changed].sort(),identities:Object.fromEntries([...changed].map(p=>[p,componentId(nodes.get(p).component)])),baselineIdentityConflicts:[...versionVotes].filter(([,v])=>v.size>1).map(([target,v])=>({target,selected:priorIds.get(target),versions:[...v.keys()]}))};
}



if(process.argv.includes('--baseline')){const baseline=process.argv[process.argv.indexOf('--baseline')+1];if(!baseline)throw new Error('Missing baseline checkout');const result=applyContentIdentity(path.resolve(import.meta.dirname,'..'),path.resolve(baseline));console.log(JSON.stringify({changed:result.changed.length,canonicalized:result.baselineIdentityConflicts.length}));}
