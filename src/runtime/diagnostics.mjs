/** Read-on-demand QA snapshot. No polling, monkey patches, or personal data. */
if(new URLSearchParams(globalThis.location?.search).get('qa')==='1'){
 globalThis.__asfaltoDiagnostics=Object.freeze({snapshot(){const app=globalThis.__cockpit,host=globalThis.__chevyV6Complete,world=app?.raceWorld;
  return {bootstrap:globalThis.__asfaltoEngineBootstrap?.diagnostics(),startup:globalThis.__asfaltoV7Startup?.diagnostics(),frames:globalThis.__asfaltoFrames?.diagnostics(),
   runtime:world?.getState?.().status,track:globalThis.__asfaltoV6Modular?.getDiagnostics?.(),vehicle:globalThis.__asfaltoSelectedPlayerVehicle,
   rendering:app?.v7RenderDiagnostics?.(),resources:world?.getResourceLifetimeDiagnostics?.(),performance:world?.getPerformanceDiagnostics?.(),audio:world?.getState?.().audio,
   workshop:{loaded:host?.workshop?.loaded,loading:host?.workshop?.loading,failed:host?.workshop?.failed,active:host?.workshop?.active,memory:host?.workshop?.renderer?.info.memory},heapBytes:performance.memory?.usedJSHeapSize??null};}});
}
