/** Thin, nearly planar instrument covers: direct compositing keeps the dial sharp.
 * Approximation: parallel air/glass/air interfaces, no absorption and negligible
 * image displacement. Not suitable for a windshield, thick lenses or curved optics.
 * Reflection remains lit by the game's lights/environment, including grazing Fresnel.
 */
export function installSS250InstrumentGlass(T,root){
 const replacements=new Map(),bindings=[];
 root.traverse(o=>{if(!o.isMesh)return;const materials=Array.isArray(o.material)?o.material:[o.material];
  const next=materials.map(source=>{
   if(source.name!=='SS250_InstrumentGlass')return source;
   if(!replacements.has(source)){
    const m=new T.MeshPhysicalMaterial({name:source.name,color:0x000000,metalness:0,roughness:.018,ior:1.52,transmission:0,transparent:true,opacity:1,depthWrite:false,side:T.FrontSide,envMapIntensity:source.envMapIntensity??1});
    m.userData={...source.userData,ss250ThinInstrumentCover:true};
    m.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      float ss250Cos=clamp(abs(dot(normal,normalize(vViewPosition))),0.0,1.0);
      float ss250F0=0.042579995;
      float ss250F=ss250F0+(1.0-ss250F0)*pow(1.0-ss250Cos,5.0);
      diffuseColor.a=2.0*ss250F/(1.0+ss250F);
      outgoingLight/=max(ss250F,0.0001);
      #include <opaque_fragment>
    `);};m.customProgramCacheKey=()=> 'ss250-thin-instrument-cover-v1';replacements.set(source,m);
   }
   return replacements.get(source);
  });
  if(next.some((m,i)=>m!==materials[i])){bindings.push([o,o.material]);o.material=Array.isArray(o.material)?next:next[0];}
 });
 return {covers:bindings.length,dispose(){for(const[o,m]of bindings)o.material=m;for(const m of replacements.values())m.dispose();bindings.length=0;replacements.clear();}};
}
