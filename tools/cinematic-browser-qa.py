"""Run with Python + playwright==1.57.0; QA-only, no application dependencies.
Software-rendered frames are not hardware FPS or a mobile performance benchmark.
"""
import argparse
import json
import pathlib
import time
from playwright.sync_api import sync_playwright


def save(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False), encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:4173')
    parser.add_argument('--output', default='qa-output/browser')
    parser.add_argument('--full-game', action='store_true')
    args = parser.parse_args()
    out = pathlib.Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=[
            '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'])
        for logarithmic in (1, 0):
            page = browser.new_page(viewport={'width': 960, 'height': 720}, device_scale_factor=1)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            result = {'kind': 'bounded-WebGL-fixture', 'logarithmic': logarithmic,
                      'browser': browser.version, 'rendererClass': 'software: requested ANGLE SwiftShader'}
            try:
                page.goto(f'{args.base_url}/tools/cinematic-webgl.html?log={logarithmic}', wait_until='domcontentloaded', timeout=60000)
                page.wait_for_function('window.__cinematicWebglDone===true', timeout=180000)
                result.update(page.evaluate('window.__cinematicWebglReport'))
                if result.get('status') == 'passed':
                    for quality in ('high', 'cinematic'):
                        diagnostics = page.evaluate('(q)=>window.__cinematicCapture(q)', quality)
                        page.locator('#qa').screenshot(path=str(out / f'fixture-log-{logarithmic}-{quality}.png'))
                        save(out / f'fixture-log-{logarithmic}-{quality}.json', diagnostics)
                    result['disposed'] = page.evaluate('window.__cinematicDispose()')
                else:
                    page.screenshot(path=str(out / f'fixture-log-{logarithmic}-failed.png'))
            except Exception as error:
                result.update(status='failed', failure=str(error))
            result['pageErrors'] = errors
            save(out / f'fixture-log-{logarithmic}.json', result)
            results.append(result)
            page.close()
        if args.full_game:
            context = browser.new_context(viewport={'width': 960, 'height': 540}, device_scale_factor=1, reduced_motion='reduce')
            context.add_init_script("""localStorage.setItem('asfalto:v7:asfalto-v6-advanced-graphics-v1',JSON.stringify({quality:'cinematic'}));localStorage.setItem('asfalto:v7:cockpit-chevy-settings-v6',JSON.stringify({graphicsQuality:'high',soundEnabled:false}));""")
            page = context.new_page()
            errors, failed_requests = [], []
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.on('response', lambda response: failed_requests.append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
            game = {'kind': 'full-game', 'browser': browser.version, 'rendererClass': 'software: requested ANGLE SwiftShader', 'cases': []}
            try:
                page.goto(args.base_url + '/?qa=1', wait_until='domcontentloaded', timeout=60000)
                page.evaluate('globalThis.__asfaltoIntro?.skip?.()')
                page.keyboard.press('Escape')
                page.wait_for_function('globalThis.__chevyV6Complete?.homeReady', timeout=240000)
                game['homeReadyMode'] = page.evaluate('__chevyV6Complete.homeReadyMode')
                if game['homeReadyMode'] != 'rendered-workshop':
                    raise RuntimeError('Workshop reached fallback, not a validated 3D render')
                page.screenshot(path=str(out / 'workshop.png'))
                game['workshop'] = page.evaluate('({graphics:__chevyV6Complete.workshop?.advancedGraphics?.diagnostics(),buffer:[__chevyV6Complete.workshop?.renderer?.domElement.width,__chevyV6Complete.workshop?.renderer?.domElement.height]})')
                page.evaluate("void __chevyV6Complete.startDrive('free').then(value=>window.__qaStart={value}).catch(error=>window.__qaStart={error:String(error)})")
                page.wait_for_function('window.__qaStart!==undefined', timeout=240000)
                game['start'] = page.evaluate('__qaStart')
                if not game['start'].get('value'):
                    raise RuntimeError('Actual startDrive failed: ' + str(game['start']))
                cases = [
                    ('dos_lagos', 'clear', 'clear', 'cockpit'),
                    ('dos_lagos', 'sunset', 'clear', 'chase'),
                    ('aconcagua_horcones', 'clear', 'clear', 'chase'),
                    ('paso_garibaldi', 'night', 'rain', 'cockpit'),
                    ('paso_garibaldi', 'overcast', 'heavy-snow', 'chase'),
                    ('cuesta_lipan', 'clear', 'clear', 'chase'),
                    ('cataratas_iguazu', 'overcast', 'fog', 'chase')]
                for index, (track, sky, weather, camera) in enumerate(cases):
                    case = {'track': track, 'sky': sky, 'weather': weather, 'camera': camera}
                    try:
                        page.evaluate("([track,sky,weather])=>{window.__qaSelection=null;void __cockpit.raceSelectCircuit(track,{skyId:sky,weather}).then(()=>__cockpit.raceStart()).then(()=>window.__qaSelection={ok:true}).catch(error=>window.__qaSelection={error:String(error)})}", [track, sky, weather])
                        page.wait_for_function('window.__qaSelection!==null', timeout=180000)
                        selection = page.evaluate('__qaSelection')
                        if not selection.get('ok'):
                            raise RuntimeError(str(selection))
                        page.evaluate('(mode)=>__cockpit.raceSetCamera(mode)', camera)
                        page.wait_for_timeout(1500)
                        case['diagnostics'] = page.evaluate('({render:__cockpit.v7RenderDiagnostics(),graphics:__asfaltoAdvancedGraphics.diagnostics(),environment:__cockpit.raceWorld.getAdvancedGraphicsEnvironment(),performance:__cockpit.raceWorld.getPerformanceDiagnostics(),camera:__cockpit.raceCameraMode(),state:__cockpit.raceGetState()})')
                        page.screenshot(path=str(out / f'case-{index}-{track}-{sky}-{weather}-{camera}.png'), timeout=60000)
                        case['status'] = 'captured-not-human-approved'
                    except Exception as error:
                        case.update(status='failed', failure=str(error))
                    game['cases'].append(case)
                    save(out / 'full-game.json', game)
                game['status'] = 'captured' if all(c['status'] != 'failed' for c in game['cases']) else 'failed'
            except Exception as error:
                game.update(status='failed', failure=str(error))
                try:
                    page.screenshot(path=str(out / 'full-game-failed.png'), timeout=15000)
                except Exception:
                    pass
            game.update(pageErrors=errors, failedRequests=failed_requests)
            save(out / 'full-game.json', game)
            results.append(game)
            context.close()
        browser.close()
    save(out / 'summary.json', [{'kind': r['kind'], 'status': r.get('status'), 'failure': r.get('failure')} for r in results])
    return 1 if any(r.get('status') == 'failed' for r in results) else 0


if __name__ == '__main__':
    raise SystemExit(main())
