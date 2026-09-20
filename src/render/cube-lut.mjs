const clamp01=v=>Math.max(0,Math.min(1,v));
function uncomment(line){let quoted=false;for(let i=0;i<line.length;i++){if(line[i]==='"')quoted=!quoted;if(line[i]==='#'&&!quoted)return line.slice(0,i);}return line;}
/** Strict single-table IRIDAS .cube reader. Source outputs are not clamped. */
export function parseCubeLut(text){
 if(typeof text!=='string')throw new TypeError('CUBE text must be a string');
 let title='',kind=null,size=0,domainMin=[0,0,0],domainMax=[1,1,1],data=null,row=0,started=false;const seen=new Set();
 const fail=(line,message)=>{throw new TypeError('CUBE line '+line+': '+message);};
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/);
 for(let index=0;index<lines.length;index++){
  const line=uncomment(lines[index]).trim();if(!line)continue;
  const [head,...tokens]=line.split(/\s+/),lineNo=index+1;
  if(/^[A-Za-z_]/.test(head)){
   if(started)fail(lineNo,'header after data');if(seen.has(head))fail(lineNo,'duplicate '+head);seen.add(head);
   if(head==='TITLE'){if(line==='TITLE'){title='';continue;}const match=/^TITLE\s+"(.*)"$/.exec(line);if(!match)fail(lineNo,'TITLE must be quoted');title=match[1];continue;}
   if(head==='LUT_1D_SIZE'||head==='LUT_3D_SIZE'){
    if(kind)fail(lineNo,'combined 1D/3D tables are not supported');kind=head==='LUT_1D_SIZE'?'1D':'3D';size=Number(tokens[0]);
    if(tokens.length!==1||!Number.isInteger(size)||size<2||size>(kind==='3D'?128:65536))fail(lineNo,'invalid table size');
    data=new Float32Array((kind==='3D'?size**3:size)*3);continue;
   }
   if(head==='DOMAIN_MIN'||head==='DOMAIN_MAX'){
    const values=tokens.map(Number);if(values.length!==3||!values.every(Number.isFinite))fail(lineNo,'invalid domain');
    if(head==='DOMAIN_MIN')domainMin=values;else domainMax=values;continue;
   }
   fail(lineNo,'unknown directive '+head);
  }
  if(!data)fail(lineNo,'table size must precede data');started=true;
  const values=[head,...tokens].map(Number);if(values.length!==3||!values.every(Number.isFinite))fail(lineNo,'each row must contain three finite values');
  if(row*3>=data.length)fail(lineNo,'too many data rows');data.set(values,row++*3);
 }
 if(!kind||!data)fail(lines.length,'table size is missing');if(row*3!==data.length)fail(lines.length,'expected '+data.length/3+' data rows, got '+row);
 if(domainMax.some((v,i)=>v<=domainMin[i]))fail(lines.length,'DOMAIN_MAX must exceed DOMAIN_MIN for every channel');
 return Object.freeze({title,kind,size,domainMin:Object.freeze(domainMin),domainMax:Object.freeze(domainMax),data});
}
export function sampleCubeLut(lut,rgb){
 const coord=rgb.map((v,i)=>clamp01((v-lut.domainMin[i])/(lut.domainMax[i]-lut.domainMin[i]))*(lut.size-1));
 if(lut.kind==='1D')return coord.map((v,i)=>{const a=Math.floor(v),b=Math.min(lut.size-1,a+1),f=v-a;return lut.data[a*3+i]*(1-f)+lut.data[b*3+i]*f;});
 const lo=coord.map(Math.floor),hi=lo.map(v=>Math.min(lut.size-1,v+1)),f=coord.map((v,i)=>v-lo[i]),out=[0,0,0],n=lut.size;
 for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){
  const at=((x?hi[0]:lo[0])+n*((y?hi[1]:lo[1])+n*(z?hi[2]:lo[2])))*3;
  const weight=(x?f[0]:1-f[0])*(y?f[1]:1-f[1])*(z?f[2]:1-f[2]);for(let c=0;c<3;c++)out[c]+=lut.data[at+c]*weight;
 }return out;
}
