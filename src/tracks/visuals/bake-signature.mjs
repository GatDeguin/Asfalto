export function bakeSignature(value){
 const text=typeof value==='string'?value:JSON.stringify(value);let a=2166136261,b=2246822507;
 for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,3266489909);}
 return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0')+':'+text.length;
}
