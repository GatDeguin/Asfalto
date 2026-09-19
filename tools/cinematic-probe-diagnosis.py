"""Bounded render diagnosis; does not change the application or saved preferences."""
import base64, json, pathlib
from playwright.sync_api import sync_playwright
out=pathlib.Path('qa-output/probe');out.mkdir(parents=True,exist_ok=True)
report={'renderer':'ANGLE SwiftShader software','cases':[],'errors':[]}
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':640,'height':360},reduced_motion='reduce')
    page.on('pageerror',lambda error:report['errors'].append(str(error)))
    page.goto('http://127.0.0.1:4173/?qa=1',wait_until='domcontentloaded')
    page.evaluate('globalThis.__asfaltoIntro?.skip?.()')
    page.wait_for_function('globalThis.__chevyV6Complete?.homeReady',timeout=240000)
    page.evaluate('__chevyV6Complete.workshop.setActive(false)')
    for mode in ['original','fresh-cube','native-scene']:
        try:
            data=page.evaluate('''mode=>{
              const w=__chevyV6Complete.workshop,T=w.T,r=w.renderer,resources=[],bindings=[];
              const original=w.presentation.getRoomEnvironment();let texture=original,target=null;
              const visible=w.car.visible,savedTarget=r.getRenderTarget(),savedFace=r.getActiveCubeFace(),savedMip=r.getActiveMipmapLevel();
              const viewport=r.getViewport(new T.Vector4()),scissor=r.getScissor(new T.Vector4()),scissorTest=r.getScissorTest(),tone=r.toneMapping,auto=r.autoClear;
              try{
                if(mode!=='original'){
                  const pmrem=new T.PMREMGenerator(r);resources.push(pmrem);w.car.visible=false;
                  const position=w.car.getWorldPosition(new T.Vector3());position.y+=1.15;
                  if(mode==='fresh-cube'){
                    const cube=new T.WebGLCubeRenderTarget(256,{type:T.HalfFloatType});resources.push(cube);
                    const camera=new T.CubeCamera(.1,45,cube);camera.position.copy(position);camera.update(r,w.scene);target=pmrem.fromCubemap(cube.texture);
                  }else target=pmrem.fromScene(w.scene,0,.1,45,{size:256,position});
                  resources.push(target);texture=target.texture;w.car.visible=visible;
                }
                const size=64,quadTarget=new T.WebGLRenderTarget(size,size),g=new T.PlaneGeometry(2,2);
                const mat=new T.ShaderMaterial({uniforms:{source:{value:texture}},vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform sampler2D source; varying vec2 vUv; void main(){vec3 c=texture2D(source,vUv).rgb; bool invalid=any(notEqual(c,c))||any(greaterThan(abs(c),vec3(65000.))); gl_FragColor=invalid?vec4(1.,0.,1.,1.):vec4(clamp(c,0.,1.),1.);}',toneMapped:false,depthTest:false,depthWrite:false});
                resources.push(quadTarget,g,mat);const scene=new T.Scene();scene.add(new T.Mesh(g,mat));r.setRenderTarget(quadTarget);r.setScissorTest(false);r.render(scene,new T.Camera());
                const pixels=new Uint8Array(size*size*4);r.readRenderTargetPixels(quadTarget,0,0,size,size,pixels);let invalid=0,black=0;for(let i=0;i<pixels.length;i+=4){if(pixels[i]===255&&pixels[i+1]===0&&pixels[i+2]===255)invalid++;if(pixels[i]+pixels[i+1]+pixels[i+2]===0)black++;}
                r.setRenderTarget(savedTarget,savedFace,savedMip);r.setViewport(viewport);r.setScissor(scissor);r.setScissorTest(scissorTest);
                w.car.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){bindings.push([m,m.envMap]);m.envMap=texture;m.needsUpdate=true;}});
                const png=w.capture();r.getContext().finish();
                return {mode,invalid,black,total:size*size,mapping:texture.mapping,image:{width:texture.image?.width,height:texture.image?.height},png,glError:r.getContext().getError()};
              }finally{w.car.visible=visible;for(const[m,env]of bindings){m.envMap=env;m.needsUpdate=true;}r.setRenderTarget(savedTarget,savedFace,savedMip);r.setViewport(viewport);r.setScissor(scissor);r.setScissorTest(scissorTest);r.toneMapping=tone;r.autoClear=auto;for(const resource of resources.reverse())resource.dispose();}
            }''',mode)
            (out/(mode+'.png')).write_bytes(base64.b64decode(data.pop('png').split(',',1)[1]));report['cases'].append(data)
        except Exception as error:report['cases'].append({'mode':mode,'failure':str(error)})
        (out/'report.json').write_text(json.dumps(report,indent=2))
    browser.close()
