"""Diagnostic stills, not an automated visual approval or an FPS benchmark."""
import argparse
import base64
import json
import pathlib
from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--current', default='http://127.0.0.1:4173')
    parser.add_argument('--baseline', default='http://127.0.0.1:4174')
    parser.add_argument('--output', default='qa-output/isolation')
    args = parser.parse_args()
    out = pathlib.Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    report = {'rendererClass': 'software: ANGLE SwiftShader', 'cases': []}
    def save():
        (out / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'])
        report['browser'] = browser.version
        for kind, url, quality in [('baseline', args.baseline, 'high'), ('current', args.current, 'cinematic')]:
            context = browser.new_context(viewport={'width': 640, 'height': 360}, device_scale_factor=1, reduced_motion='reduce')
            context.add_init_script("localStorage.setItem('asfalto:v7:asfalto-v6-advanced-graphics-v1',JSON.stringify({quality:'" + quality + "'}));localStorage.setItem('asfalto:v7:cockpit-chevy-settings-v6',JSON.stringify({graphicsQuality:'high',soundEnabled:false}));")
            page = context.new_page()
            result = {'kind': kind, 'messages': [], 'pageErrors': [], 'stills': []}
            report['cases'].append(result)
            page.on('console', lambda message: result['messages'].append({'type': message.type, 'text': message.text}) if message.type in ('error', 'warning') else None)
            page.on('pageerror', lambda error: result['pageErrors'].append(str(error)))
            try:
                page.goto(url + '/?qa=1', wait_until='domcontentloaded', timeout=60000)
                page.evaluate('globalThis.__asfaltoIntro?.skip?.()')
                page.wait_for_function('globalThis.__chevyV6Complete?.homeReady', timeout=240000)
                page.evaluate('__chevyV6Complete.workshop.setActive(false)')
                result['initial'] = page.evaluate("""()=>{const w=__chevyV6Complete.workshop;const materials=[];w.car.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])materials.push({mesh:o.name,material:m.name,type:m.type,metalness:m.metalness,roughness:m.roughness,color:m.color?.getHexString(),normalScale:m.normalScale?.toArray(),env:m.envMap?.uuid,maps:Object.fromEntries(['map','normalMap','roughnessMap','metalnessMap','aoMap','emissiveMap'].map(k=>[k,m[k]?{width:m[k].image?.width,height:m[k].image?.height,anisotropy:m[k].anisotropy,version:m[k].version}:null])),attributes:Object.keys(o.geometry.attributes),visible:o.visible});});return {homeReadyMode:__chevyV6Complete.homeReadyMode,graphics:w.advancedGraphics?.diagnostics(),camera:w.camera.position.toArray(),materials};}""")
                save()
                options = [('initial', None), ('materials-disabled', {'quality': quality, 'materials': False}), ('advanced-off', {'quality': 'off'})]
                if kind == 'current':
                    options.insert(1, ('high', {'quality': 'high'}))
                for name, settings in options:
                    if settings:
                        page.evaluate('(settings)=>__chevyV6Complete.workshop.advancedGraphics.setSettings(settings)', settings)
                    data = page.evaluate("""()=>{const w=__chevyV6Complete.workshop;const png=w.capture();w.renderer.getContext().finish();return {png,graphics:w.advancedGraphics.diagnostics(),render:{...w.renderer.info.render},memory:{...w.renderer.info.memory}};}""")
                    (out / (kind + '-' + name + '.png')).write_bytes(base64.b64decode(data.pop('png').split(',', 1)[1]))
                    result['stills'].append({'name': name, **data})
                    save()
                result['status'] = 'captured-not-approved'
            except Exception as error:
                result.update(status='failed', failure=str(error))
            save()
            context.close()
        browser.close()
    return 1 if any(case.get('status') == 'failed' for case in report['cases']) else 0


if __name__ == '__main__':
    raise SystemExit(main())
