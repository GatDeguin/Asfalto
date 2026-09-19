"""Real application lifecycle regression, not a physical-GPU benchmark.
Run with playwright==1.57.0 against the complete static checkout. No mocks of
Three, physics, assets or the application. The first cockpit transport is held
by Playwright solely to reproduce cancellation; it is removed before retry.
"""
import argparse
import json
import pathlib
import time
from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:4173')
    parser.add_argument('--output', default='qa-output/game')
    args = parser.parse_args()
    out = pathlib.Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    report = {'status': 'running', 'rendererClass': 'ANGLE SwiftShader software',
              'viewportCSS': [640,360], 'DPR': 1, 'captureTimeoutSeconds': 120,
              'qualityForLifecycle': 'Eco / Low (Cinematic shaders tested separately)',
              'cases': [], 'stages': [], 'pageErrors': [], 'consoleErrors': [], 'httpErrors': []}

    def save():
        (out / 'lifecycle.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-gl=angle',
            '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'])
        report['browser'] = browser.version
        context = browser.new_context(viewport={'width': 640, 'height': 360}, device_scale_factor=1,
                                      reduced_motion='reduce')
        context.add_init_script("""localStorage.setItem('asfalto:v7:asfalto-v6-advanced-graphics-v1',JSON.stringify({quality:'low'}));localStorage.setItem('asfalto:v7:cockpit-chevy-settings-v6',JSON.stringify({graphicsQuality:'eco',soundEnabled:false}));""")
        page = context.new_page()
        page.set_default_timeout(15000)
        page.on('pageerror', lambda error: report['pageErrors'].append(str(error)))
        page.on('console', lambda msg: report['consoleErrors'].append(msg.text) if msg.type == 'error' else None)
        page.on('response', lambda response: report['httpErrors'].append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
        held = []
        blocked_url = '**/assets/manifests/cockpit-payload.json*'
        page.route(blocked_url, lambda route: held.append(route))

        def checkpoint(label):
            report['phase'] = label
            report['state'] = page.evaluate("""()=>({startup:globalThis.__asfaltoV7Startup?.diagnostics(),modular:globalThis.__asfaltoV6Modular?.getDiagnostics(),session:globalThis.__chevyV6Complete?.sessionDiagnostics(),phase:document.body.dataset.v7Phase,body:document.body.className,load:document.querySelector('.an-v7-load-state p')?.textContent,fault:globalThis.__cockpit?.runtimeFailureDiagnostics?.(),workshopActive:globalThis.__chevyV6Complete?.workshop?.active,loadUi:[...document.querySelectorAll('.an-v7-load-state,#an-session-loading,.an-v7-load-state [data-cancel]')].map(el=>({tag:el.tagName,id:el.id,hidden:el.hidden,inert:el.inert,disabled:el.disabled,display:getComputedStyle(el).display,visibility:getComputedStyle(el).visibility,rect:el.getBoundingClientRect().toJSON(),ancestors:[...function*(n){for(;n;n=n.parentElement)yield n;}(el)].map(n=>({id:n.id,hidden:n.hidden,inert:n.inert}))}))})""")
            report['stages'].append({'phase': label, 'load': report['state'].get('load')})
            save()

        def wait(expression, label, timeout=180):
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                if page.evaluate(expression):
                    checkpoint(label)
                    return
                page.wait_for_timeout(1000)
                checkpoint(label + ':waiting')
            raise TimeoutError(label + ': application did not satisfy ' + expression)

        def still(name, workshop=False):
            if workshop:
                page.evaluate('__chevyV6Complete.workshop.setActive(false)')
            else:
                page.evaluate('__cockpit.setRendering(false)')
            try:
                page.screenshot(path=str(out / (name + '.png')), timeout=120000)
            finally:
                if workshop:
                    page.evaluate('__chevyV6Complete.workshop.setActive(true)')
                else:
                    page.evaluate('__cockpit.setRendering(true)')

        try:
            page.goto(args.base_url + '/?qa=1', wait_until='domcontentloaded', timeout=60000)
            page.keyboard.press('Escape')
            wait('!!globalThis.__chevyV6Complete?.homeReady', 'workshop-ready', 180)
            assert page.evaluate('__chevyV6Complete.homeReadyMode') == 'rendered-workshop', '3D workshop fell back'
            report['workshop'] = page.evaluate('({graphics:__chevyV6Complete.workshop.advancedGraphics.diagnostics(),buffer:[__chevyV6Complete.workshop.canvas.width,__chevyV6Complete.workshop.canvas.height]})')
            still('workshop', workshop=True)
            # Observe the public method, preserving its behavior and the real click gesture.
            page.evaluate("""()=>{const game=__chevyV6Complete,original=game.startDrive;window.__qaStarts=[];game.startDrive=(...args)=>original(...args).then(value=>{__qaStarts.push({value});return value;},error=>{__qaStarts.push({error:String(error)});throw error;});}""")
            page.locator('.an-v7-quick-drive').click()
            wait("globalThis.__asfaltoV7Startup?.diagnostics().phase==='loading'", 'cold-load-held', 30)
            deadline=time.monotonic()+10
            while not held and time.monotonic()<deadline:
                page.wait_for_timeout(50)
            assert held, 'Cockpit request was not intercepted: cancellation scenario invalid'
            assert page.evaluate('__chevyV6Complete.workshop.active===false'), 'Hidden workshop still rendering during loading'
            started = time.monotonic()
            page.locator('.an-v7-load-state [data-cancel]').click()
            wait("__qaStarts.length===1&&!__chevyV6Complete.sessionDiagnostics().request?.active", 'canceled-and-released', 10)
            report['cancel'] = {'responseSeconds': time.monotonic()-started, 'result': page.evaluate('__qaStarts[0]'), 'controlledBlockedTransport': True}
            assert report['cancel']['result'].get('value') is False, 'Canceled session reported success'
            page.unroute(blocked_url)
            for route in held:
                try:
                    route.abort('aborted')
                except Exception:
                    pass  # The real AbortSignal may have already closed this request.
            page.locator('.an-v7-quick-drive').click()
            wait('__qaStarts.length===2', 'retry-started', 240)
            assert page.evaluate('__qaStarts[1].value===true'), 'Retry failed: ' + str(page.evaluate('__qaStarts[1]'))
            assert page.evaluate('navigator.userActivation.hasBeenActive'), 'No real browser gesture'
            report['start'] = page.evaluate('__qaStarts')
            # Real route selection, environment, simulation startup and both camera families.
            cases = [('dos_lagos','clear','clear','cockpit'),
                     ('aconcagua_horcones','sunset','clear','chase'),
                     ('paso_garibaldi','night','rain','cockpit'),
                     ('cuesta_lipan','overcast','light-snow','chase'),
                     ('cataratas_iguazu','overcast','fog','chase')]
            for index,(track,sky,weather,camera) in enumerate(cases):
                case = {'track':track,'sky':sky,'weather':weather,'camera':camera,'status':'preparing'}
                report['cases'].append(case)
                save()
                page.evaluate("""([track,sky,weather])=>{window.__qaSelection=null;void __cockpit.raceSelectCircuit(track,{skyId:sky,weather}).then(()=>__cockpit.raceStart()).then(()=>__qaSelection={ok:true},error=>__qaSelection={error:String(error)});}""", [track,sky,weather])
                wait('window.__qaSelection!==null', 'track-'+track, 150)
                assert page.evaluate('__qaSelection.ok===true'), str(page.evaluate('__qaSelection'))
                page.evaluate('(mode)=>__cockpit.raceSetCamera(mode)', camera)
                page.wait_for_timeout(1200)
                case['diagnostics'] = page.evaluate("""()=>({render:__cockpit.v7RenderDiagnostics(),performance:__cockpit.raceWorld.getPerformanceDiagnostics(),state:__cockpit.raceGetState(),camera:__cockpit.raceCameraMode(),fault:__cockpit.runtimeFailureDiagnostics()})""")
                assert case['diagnostics']['state']['track']['id'] == track
                still(str(index)+'-'+track)
                case['status'] = 'rendered-real-assets'
                save()
            page.keyboard.press('Escape')
            page.wait_for_timeout(200)
            report['pause'] = page.evaluate('({body:document.body.className,session:__chevyV6Complete.sessionDiagnostics()})')
            assert 'an-race-paused' in report['pause']['body'], 'Escape did not open pause'
            page.evaluate("__chevyV6Complete.openMenu('home')")
            wait("document.body.classList.contains('v6-menu-open')", 'returned-to-workshop', 30)
            still('workshop-return', workshop=True)
            assert not report['pageErrors'], 'Uncaught page errors: '+str(report['pageErrors'])
            assert not any('Shader Error' in message for message in report['consoleErrors']), 'Shader compilation failed'
            assert not report['httpErrors'], 'Failed resource responses: '+str(report['httpErrors'])
            report['status'] = 'passed'
        except Exception as error:
            report['status'] = 'failed'
            report['failure'] = str(error)
            try:
                checkpoint('failure')
                page.evaluate('globalThis.__chevyV6Complete?.workshop?.setActive(false);globalThis.__cockpit?.setRendering(false)')
                page.screenshot(path=str(out / 'failure.png'), timeout=30000)
            except Exception as capture_error:
                report['captureError'] = str(capture_error)
        finally:
            save()
            context.close()
            browser.close()
    if report['status'] != 'passed':
        raise SystemExit('Actual game lifecycle failed: '+report.get('failure','unknown'))
    print('Actual game lifecycle passed: cancellation, retry, five tracks, pause and workshop return.')


if __name__ == '__main__':
    main()
