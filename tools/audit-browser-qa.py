"""Actual application smoke tests; ANGLE SwiftShader, never a hardware FPS claim."""
import argparse
import base64
import json
import pathlib
import time
from playwright.sync_api import sync_playwright


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--base-url', default='http://127.0.0.1:4173')
    parser.add_argument('--output', default='qa-output/browser')
    args = parser.parse_args()
    out = pathlib.Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    report = {'rendererClass': 'ANGLE SwiftShader software', 'cases': [], 'stages': [], 'errors': [], 'httpErrors': []}
    def save():
        (out/'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding='utf-8')
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'])
        report['browser'] = browser.version
        context = browser.new_context(viewport={'width': 640, 'height': 360}, device_scale_factor=1, reduced_motion='reduce')
        context.add_init_script("""localStorage.setItem('asfalto:v7:asfalto-v6-advanced-graphics-v1',JSON.stringify({quality:'balanced'}));localStorage.setItem('asfalto:v7:cockpit-chevy-settings-v6',JSON.stringify({graphicsQuality:'balanced',soundEnabled:false}));""")
        page = context.new_page()
        page.on('pageerror', lambda error: report['errors'].append(str(error)))
        page.on('console', lambda message: report['errors'].append(message.text) if message.type == 'error' and 'AUDIT_INJECTED_FRAME_FAILURE' not in message.text else None)
        page.on('response', lambda response: report['httpErrors'].append({'url': response.url, 'status': response.status}) if response.status >= 400 else None)
        def state():
            return page.evaluate("""()=>({loading:[...document.querySelectorAll('.an-loading-stage,.an-v7-load-state p,#loading-text')].map(n=>n.textContent),failure:document.querySelector('.an-v7-load-state[data-state=error] p')?.textContent,startup:globalThis.__asfaltoV7Startup?.diagnostics(),request:globalThis.__chevyV6Complete?.sessionDiagnostics()?.request,cockpitReady:globalThis.__cockpit?.ready,cockpitError:globalThis.__cockpit?.error,body:document.body.className})""")
        def wait_flag(flag, seconds=180):
            deadline = time.monotonic()+seconds
            while time.monotonic() < deadline:
                value = page.evaluate(flag)
                if value is not None:
                    return value
                snapshot = state()
                if not report['stages'] or snapshot != report['stages'][-1]['state']:
                    report['stages'].append({'state': snapshot, 'at': time.time()})
                    print(json.dumps(snapshot, ensure_ascii=False), flush=True)
                    save()
                if snapshot.get('failure'):
                    raise RuntimeError(snapshot['failure'])
                if report['errors']:
                    raise RuntimeError(str(report['errors'][-1]))
                page.wait_for_timeout(2000)
            raise TimeoutError('Application did not complete: '+json.dumps(state(), ensure_ascii=False))
        def capture(name):
            was = page.evaluate('__cockpit.isRendering()')
            page.evaluate('__cockpit.setRendering(false)')
            try:
                page.screenshot(path=str(out/name), timeout=60000)
            finally:
                page.evaluate('(v)=>__cockpit.setRendering(v)', was)
        try:
            held = []
            page.route('**/cockpit-payload.json*', lambda route: held.append(route))
            page.goto(args.base_url+'/?qa=1', wait_until='domcontentloaded', timeout=60000)
            page.evaluate('globalThis.__asfaltoIntro?.skip?.()')
            page.wait_for_function('globalThis.__chevyV6Complete?.homeReady', timeout=180000)
            if page.evaluate('__chevyV6Complete.homeReadyMode') != 'rendered-workshop':
                raise RuntimeError('The real workshop did not render')
            report['workshop'] = page.evaluate('__chevyV6Complete.workshop.advancedGraphics.diagnostics()')
            page.evaluate('__chevyV6Complete.workshop.setActive(false)')
            png = page.evaluate('__chevyV6Complete.workshop.capture()')
            (out/'workshop.png').write_bytes(base64.b64decode(png.split(',',1)[1]))
            page.evaluate('__chevyV6Complete.workshop.setActive(true)')
            # Verify actual UI propagation, then use balanced for bounded software smoke tests.
            report['settings'] = page.evaluate("""()=>{const s=document.querySelector('[data-advanced-graphics-quality]'),out=[];for(const quality of ['cinematic','low','balanced']){s.value=quality;s.dispatchEvent(new Event('change',{bubbles:true}));out.push({quality,stored:JSON.parse(__asfaltoV7Storage.getItem('asfalto-v6-advanced-graphics-v1')).quality,requested:__asfaltoAdvancedGraphics.getSettings().quality});}return out;}""")
            assert all(item['quality']==item['stored']==item['requested'] for item in report['settings'])
            page.evaluate("""()=>{const g=__chevyV6Complete,original=g.startDrive;g.startDrive=(...args)=>{window.__auditStart=null;return original(...args).then(value=>{window.__auditStart={value};return value;},error=>{window.__auditStart={error:String(error)};throw error;});};}""")
            page.locator('.an-v7-quick-drive').click(timeout=60000)
            page.wait_for_function("globalThis.__asfaltoV7Startup?.diagnostics().phase==='loading'", timeout=30000)
            page.locator('.an-v7-load-state [data-cancel]').click(timeout=15000)
            canceled = wait_flag('window.__auditStart',15)
            assert canceled.get('value') is False, canceled
            assert page.evaluate('__chevyV6Complete.sessionDiagnostics().request.active') is False
            assert page.evaluate("document.body.classList.contains('v6-menu-open')")
            report['cancellation'] = {'returnedToMenu': True, 'heldTransportRequests': len(held), 'state': state()}
            page.unroute('**/cockpit-payload.json*')
            for route in held:
                try:
                    route.abort()
                except Exception:
                    pass  # An aborted browser request may already have closed its route.
            save()
            page.locator('.an-v7-quick-drive').click(timeout=60000)
            started = wait_flag('window.__auditStart',300)
            assert started.get('value') is True, started
            assert page.evaluate('__cockpit.ready')
            report['firstStart'] = state()
            cases = [('dos_lagos','clear','clear','cockpit'),('dos_lagos','sunset','clear','chase'),('aconcagua_horcones','clear','clear','chase'),('paso_garibaldi','night','rain','cockpit'),('paso_garibaldi','overcast','heavy-snow','chase'),('cuesta_lipan','clear','clear','chase'),('cataratas_iguazu','overcast','fog','chase')]
            for index,(track,sky,weather,camera) in enumerate(cases):
                page.evaluate("""([track,skyId,weather])=>{window.__auditSelection=null;__cockpit.setRendering(false);void __cockpit.raceSelectCircuit(track,{skyId,weather}).then(()=>__cockpit.raceStart()).then(()=>{__cockpit.setRendering(true);window.__auditSelection={ok:true};}).catch(error=>window.__auditSelection={error:String(error)});} """,[track,sky,weather])
                selected=wait_flag('window.__auditSelection',180)
                assert selected.get('ok'), selected
                page.evaluate('(mode)=>__cockpit.raceSetCamera(mode)',camera)
                page.wait_for_timeout(1200)
                diagnostics=page.evaluate('({render:__cockpit.v7RenderDiagnostics(),graphics:__asfaltoAdvancedGraphics.diagnostics(),performance:__cockpit.raceWorld.getPerformanceDiagnostics(),track:__cockpit.raceWorld.track.id,camera:__cockpit.raceCameraMode(),failure:__cockpit.frameFailureDiagnostics()})')
                assert diagnostics['track']==track
                assert not diagnostics['failure']['failed'],diagnostics['failure']
                capture(f'case-{index}-{track}.png')
                report['cases'].append({'track':track,'sky':sky,'weather':weather,'camera':camera,'diagnostics':diagnostics,'status':'rendered-software-smoke-not-art-approval'})
                save()
            # Exercise actual input/pause release, not synthetic physics measurements.
            page.keyboard.down('w');page.wait_for_timeout(200);page.keyboard.press('Escape');page.keyboard.up('w')
            page.wait_for_function("__cockpit.raceWorld.getState().status==='PAUSED'",timeout=10000)
            report['pause']={'status':page.evaluate('__cockpit.raceWorld.getState().status'),'controls':page.evaluate('__cockpit.raceWorld.getInput()')}
            page.locator('[data-pause-action=resume]').click()
            # A one-shot error in the actual frame path must latch, pause and show recovery.
            page.evaluate("""()=>{const w=__cockpit.raceWorld,original=w.getRenderFrame;w.getRenderFrame=function(){w.getRenderFrame=original;throw Error('AUDIT_INJECTED_FRAME_FAILURE');};}""")
            page.wait_for_function('__cockpit.frameFailureDiagnostics().failed',timeout=15000)
            assert page.locator('[data-pause-action=resume]').is_disabled()
            report['injectedFrameFailure']=page.evaluate('__cockpit.frameFailureDiagnostics()')
            capture('failure-recovery.png')
            page.locator('[data-pause-action=workshop]').click()
            assert page.evaluate("document.body.classList.contains('v6-menu-open')")
            page.locator('.an-v7-quick-drive').click(timeout=60000)
            assert wait_flag('window.__auditStart',180).get('value')
            assert not page.evaluate('__cockpit.frameFailureDiagnostics().failed')
            report['recovery']={'newSessionStarted':True,'failure':page.evaluate('__cockpit.frameFailureDiagnostics()')}
            report['status']='passed'
            if report['errors'] or report['httpErrors']:
                raise RuntimeError('Browser or HTTP errors were recorded')
        except Exception as error:
            report.update(status='failed',failure=str(error))
            try:
                report['lastState']=state()
                page.screenshot(path=str(out/'failed.png'),timeout=15000)
            except Exception:
                pass
        finally:
            save();context.close();browser.close()
    return 0 if report.get('status')=='passed' else 1

if __name__=='__main__':
    raise SystemExit(main())
