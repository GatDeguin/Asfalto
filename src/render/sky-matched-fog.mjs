const clamp01=value=>Math.max(0,Math.min(1,value));

/** Sample the already loaded panorama, not a guessed weather palette. */
export function sampleSkyHorizon(THREE,texture) {
  const image=texture?.image,{data,width,height}=image||{};
  if(!texture?.isDataTexture||!data||width<2||height<2)return null;
  const channels=data.length/(width*height);if(channels!==3&&channels!==4)return null;
  const decode=texture.type===THREE.HalfFloatType?THREE.DataUtils.fromHalfFloat:texture.type===THREE.FloatType?value=>value:texture.type===THREE.UnsignedByteType?value=>value/255:null;
  if(!decode)return null;
  const values=[[],[],[]],count=Math.min(32,width);
  for(const fraction of [.48,.50,.52]){
    const row=Math.min(height-1,Math.floor(height*fraction));
    for(let index=0;index<count;index++){
      const offset=(row*width+Math.floor(index*width/count))*channels;
      for(let component=0;component<3;component++){const value=decode(data[offset+component]);if(Number.isFinite(value)&&value>=0)values[component].push(value);}
    }
  }
  if(values.some(channel=>channel.length<3))return null;
  // Discard isolated sun/highlight pixels and dark horizon objects.
  const rgb=values.map(channel=>{channel.sort((a,b)=>a-b);const trim=Math.floor(channel.length*.12),middle=channel.slice(trim,channel.length-trim);return middle.reduce((sum,value)=>sum+value,0)/middle.length;});
  return new THREE.Color().setRGB(...rgb,texture.colorSpace===THREE.SRGBColorSpace?THREE.SRGBColorSpace:THREE.LinearSRGBColorSpace);
}

function displayedSkyColor(THREE,radiance,exposure,mode,intensity,target) {
  let r=radiance.r*intensity,g=radiance.g*intensity,b=radiance.b*intensity;
  if(mode===THREE.ACESFilmicToneMapping){
    // Same transform as this bundled Three's tonemapping_pars_fragment. Fog is
    // mixed AFTER tone mapping, so its stored linear color must be display-linear.
    const scale=exposure/.6;r*=scale;g*=scale;b*=scale;
    const fit=value=>(value*(value+.0245786)-.000090537)/(value*(.983729*value+.432951)+.238081);
    const ar=fit(.59719*r+.35458*g+.04823*b),ag=fit(.076*r+.90834*g+.01566*b),ab=fit(.0284*r+.13383*g+.83777*b);
    r=1.60475*ar-.53108*ag-.07367*ab;g=-.10208*ar+1.10813*ag-.00605*ab;b=-.00327*ar-.07276*ag+1.07602*ab;
  }else if(mode===THREE.ReinhardToneMapping){r=r*exposure/(1+r*exposure);g=g*exposure/(1+g*exposure);b=b*exposure/(1+b*exposure);}
  else if(mode===THREE.LinearToneMapping){r*=exposure;g*=exposure;b*=exposure;}
  else if(mode!==THREE.NoToneMapping)return null;
  return target.setRGB(clamp01(r),clamp01(g),clamp01(b));
}

export function createSkyMatchedFog({THREE,scene,renderer}={}) {
  const sampled=new WeakMap(),baselineColor=new THREE.Color(),matchedColor=new THREE.Color();
  const rotation=new THREE.Euler(),rotationMatrix=new THREE.Matrix4(),shaderState={enabled:false,texture:null,intensity:1,rotation:new THREE.Matrix3()};
  // Inverse of Three's ACES fit/matrices, used only for a user-selected display
  // color (or original unaligned fog). The automatic path retains source radiance.
  const inverseInput=new THREE.Matrix3().set(.59719,.35458,.04823,.076,.90834,.01566,.0284,.13383,.83777).invert();
  const inverseOutput=new THREE.Matrix3().set(1.60475,-.53108,-.07367,-.10208,1.10813,-.00605,-.00327,-.07276,1.07602).invert();
  const inverseValue=new THREE.Vector3(),linearColor=new THREE.Color();
  let fog=null,baselineDensity=0,source=null,lastExposure=null,lastMode=null,lastIntensity=null,radiance=null,colorReady=false,matched=false,sourceSamples=0,lastSkyRevision=null;
  let automaticMatched=false,automaticDensity=0,lastPolicy={},lastEnvironment={},linearDepth=0;
  function restore(){if(fog){fog.density=baselineDensity;fog.color.copy(baselineColor);}fog=null;matched=false;automaticMatched=false;source=null;radiance=null;lastExposure=null;lastSkyRevision=null;shaderState.enabled=false;shaderState.texture=null;}
  function resolve(policy,environment={}){
    lastPolicy=policy;lastEnvironment=environment;
    if(scene.fog!==fog){restore();if(scene.fog&&'density'in scene.fog){fog=scene.fog;baselineDensity=Number.isFinite(environment.fog?.density)?environment.fog.density:fog.density;baselineColor.set(environment.fog?.color??fog.color);}}
    if(!fog)return false;
    if(environment.dayCycle){if(Number.isFinite(environment.fog?.density))baselineDensity=environment.fog.density;if(environment.fog?.color)baselineColor.set(environment.fog.color);}
    const background=scene.background,exposure=renderer?.toneMappingExposure??environment.exposure??1,mode=renderer?.toneMapping??THREE.ACESFilmicToneMapping,intensity=scene.backgroundIntensity??1;
    const liveHorizon=background?.userData?.asfaltoSkyHorizon,revision=background?.userData?.asfaltoSkyRevision;
    if(liveHorizon?.isColor){if(background!==source||revision!==lastSkyRevision){source=background;radiance=liveHorizon;lastSkyRevision=revision;lastExposure=null;}}
    else if(background!==source){source=background;radiance=null;lastSkyRevision=null;if(background?.isTexture){if(!sampled.has(background)){sampled.set(background,sampleSkyHorizon(THREE,background));sourceSamples++;}radiance=sampled.get(background);}lastExposure=null;}
    if(exposure!==lastExposure||mode!==lastMode||intensity!==lastIntensity){colorReady=!!(radiance&&displayedSkyColor(THREE,radiance,exposure,mode,intensity,matchedColor));lastExposure=exposure;lastMode=mode;lastIntensity=intensity;}
    automaticMatched=policy.opticalFogDensity!=null&&colorReady;automaticDensity=policy.opticalFogDensity??baselineDensity;
    return true;
  }
  function customColor(){const c=scene.userData?.asfaltoFogOverride?.color;return typeof c==='string'&&/^#[0-9a-f]{6}$/i.test(c)?c:null;}
  function invertDisplayColor(display,target){
    const exposure=Math.max(.000001,lastExposure??1),mode=lastMode??THREE.ACESFilmicToneMapping;
    if(mode===THREE.ACESFilmicToneMapping){
      inverseValue.set(display.r,display.g,display.b).applyMatrix3(inverseOutput);
      const inverseFit=y=>{const a=1-.983729*y,b=.0245786-.432951*y,c=-.000090537-.238081*y;return(-b+Math.sqrt(Math.max(0,b*b-4*a*c)))/(2*a);};
      inverseValue.set(inverseFit(inverseValue.x),inverseFit(inverseValue.y),inverseFit(inverseValue.z)).applyMatrix3(inverseInput).multiplyScalar(.6/exposure);
      return target.setRGB(inverseValue.x,inverseValue.y,inverseValue.z);
    }
    if(mode===THREE.ReinhardToneMapping){const inverse=v=>v/(Math.max(.000001,1-v)*exposure);return target.setRGB(inverse(display.r),inverse(display.g),inverse(display.b));}
    if(mode===THREE.LinearToneMapping)return target.copy(display).multiplyScalar(1/exposure);
    if(mode===THREE.NoToneMapping)return target.copy(display);
    return null;
  }
  return{
    update(policy,environment={}){
      if(!resolve(policy,environment))return;
      const override=scene.userData?.asfaltoFogOverride,explicitColor=customColor();
      const density=Number.isFinite(override?.density)&&override.density>=0?override.density:null;
      fog.density=density??automaticDensity;matched=!explicitColor&&automaticMatched;
      fog.color.copy(matched?matchedColor:baselineColor);if(explicitColor)fog.color.set(explicitColor);
      shaderState.enabled=matched&&source.colorSpace!==THREE.SRGBColorSpace;shaderState.texture=shaderState.enabled?(source.userData?.asfaltoSkyEquirect||source):null;shaderState.intensity=lastIntensity;
      if(scene.backgroundRotation)rotation.copy(scene.backgroundRotation);else rotation.set(0,0,0);rotation.x*=-1;rotation.y*=-1;rotation.z*=-1;shaderState.rotation.setFromMatrix4(rotationMatrix.makeRotationFromEuler(rotation));
    },
    getEffectiveState(policy=lastPolicy,environment=lastEnvironment){
      if(!resolve(policy,environment))return null;
      return {density:automaticDensity,color:'#'+(automaticMatched?matchedColor:baselineColor).getHexString()};
    },
    prepareRender({linearOutput=false}={}){
      if(!linearOutput||!resolve(lastPolicy,lastEnvironment))return null;
      if(linearDepth>0){linearDepth++;let restored=false;return()=>{if(!restored){restored=true;linearDepth--;}};}
      if(automaticMatched&&!customColor())linearColor.copy(radiance).multiplyScalar(lastIntensity);
      else if(!invertDisplayColor(fog.color,linearColor))return null;
      const targetFog=fog,saved=fog.color.clone();fog.color.copy(linearColor);linearDepth++;let restored=false;
      return()=>{if(restored)return;restored=true;targetFog.color.copy(saved);linearDepth--;};
    },
    restore,
    shaderState,
    diagnostics:()=>({matched,directionalSurfaceMatch:shaderState.enabled,source:source?.name||null,sourceSamples,color:matched?'#'+matchedColor.getHexString():null,linearOutput:linearDepth>0}),
  };
}
