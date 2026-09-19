"""Reversible render isolation for the actual published car; never an art preset."""
import argparse
import base64
import json
import pathlib
from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:4173')
    parser.add_argument('--output', default='qa-output/diagnosis')
    args = parser.parse_args()
    out = pathlib.Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    report = {'rendererClass': 'software: ANGLE SwiftShader', 'stills': [], 'errors': []}
    def save():
        (out / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'])
        context = browser.new_context(viewport={'width': 640, 'height': 360}, device_scale_factor=1)
        context.add_init_script("localStorage.setItem('asfalto:v7:asfalto-v6-advanced-graphics-v1',JSON.stringify({quality:'cinematic'}));")
        page = context.new_page()
        page.on('pageerror', lambda error: report['errors'].append(str(error)))
        page.on('console', lambda message: report['errors'].append(message.text) if message.type == 'error' else None)
        try:
            page.goto(args.base_url + '/?qa=1', wait_until='domcontentloaded', timeout=60000)
            page.evaluate('globalThis.__asfaltoIntro?.skip?.()')
            page.wait_for_function('__chevyV6Complete?.homeReady', timeout=240000)
            page.evaluate('__chevyV6Complete.workshop.setActive(false)')
            for mode in ['unchanged', 'no-ao', 'no-local-env', 'no-received-shadow', 'no-material-hooks', 'normal-debug']:
                data = page.evaluate("""mode=>{
                  const w=__chevyV6Complete.workshop,T=w.T,changes=[],allocated=[],materials=new Set();
                  const change=(object,key,value)=>{changes.push([object,key,object[key]]);object[key]=value;};
                  w.car.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)materials.add(m);});
                  const invalid=[];
                  for(const m of materials){const uniforms=w.renderer.properties.get(m).uniforms||{};for(const [name,u] of Object.entries(uniforms)){const value=u.value;const values=typeof value==='number'?[value]:value?.elements||((value?.isVector2||value?.isVector3||value?.isColor)?value.toArray():null);if(values&&Array.from(values).some(v=>typeof v==='number'&&!Number.isFinite(v)))invalid.push({material:m.name,uniform:name,values:Array.from(values)});}}
                  try{
                    if(mode==='no-ao')for(const m of materials)change(m,'aoMapIntensity',0);
                    if(mode==='no-local-env')for(const m of materials){change(m,'envMap',null);m.needsUpdate=true;}
                    if(mode==='no-received-shadow')w.car.traverse(o=>{if(o.isMesh)change(o,'receiveShadow',false);});
                    if(mode==='no-material-hooks')for(const m of materials){change(m,'onBeforeCompile',()=>{});change(m,'customProgramCacheKey',()=> 'diagnosis-no-hooks');m.needsUpdate=true;}
                    if(mode==='normal-debug'){const m=new T.MeshNormalMaterial();allocated.push(m);w.car.traverse(o=>{if(o.isMesh)change(o,'material',m);});}
                    const png=w.capture();w.renderer.getContext().finish();
                    return {png,invalid,render:{...w.renderer.info.render},contextError:w.renderer.getContext().getError()};
                  }finally{for(const [o,k,v] of changes.reverse()){o[k]=v;if(o.isMaterial)o.needsUpdate=true;}for(const resource of allocated)resource.dispose();}
                }""", mode)
                (out / (mode + '.png')).write_bytes(base64.b64decode(data.pop('png').split(',', 1)[1]))
                report['stills'].append({'mode': mode, **data})
                save()
            report['status'] = 'diagnostic-captures-not-approved'
        except Exception as error:
            report.update(status='failed', failure=str(error))
        save()
        context.close()
        browser.close()
    return 1 if report.get('status') == 'failed' else 0


if __name__ == '__main__':
    raise SystemExit(main())
