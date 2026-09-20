# Runtime ownership and asynchronous work

This inventory covers application source, excluding the bundled Rapier vendor. A scheduled one-shot yield is not a perpetual visual loop. The source reference table below enumerates every direct RAF/timer/observer/Worker call site; dependency-injected scheduling is listed by owner here.

| Owner | Starts / work | Stops / cancellation |
|---|---|---|
| Shared frame scheduler | First workshop/editor/drive subscription; one native RAF | Unsubscribe removes owner; no enabled owner means no RAF; hidden document suspends; non-persisted pagehide disposes observer/listeners |
| Driving | Prepared runtime; fixed outer 60 Hz accumulator and Rapier 120 Hz remain unchanged | Disabled in menus/loading/hidden document; shutdown unsubscribes |
| Workshop | Loaded and visible workshop | Disabled during driving/preparation; mobile release and final disposal unsubscribe |
| 3D HUD / mobile DOM HUD | Race ready; 30 Hz / 20 Hz on shared scheduler | Disabled outside driving, disposal unsubscribes, cancels ownership and rejects late initialization |
| Session telemetry / legacy HUD adapter | Session ready; 30 Hz; legacy display only when actually visible | Session stop / runtime-dispose; never separate eternal RAF |
| Lighting editor | Shared scheduler 4 Hz only while editor is open | Editor dispose; removes store subscription and event owner |
| Shader preparation | Explicit final output variants, compiler batches and bounded readiness frames | AbortSignal, 120 s deadline, geometry/material/target disposal invalidation; no renderer mutation across yield |
| Phone release / first frame / warmup | Finite one/two-frame presentation handoffs | Signal checked around handoff; runtime preparation owns deadline; no recurring callback |
| UI focus / resize / route collection | One RAF or short timeout after explicit UI action | One-shot completion, no recurring work; page-owned DOM remains valid between scenes |
| Loading films | Visible intro/transition; readiness, crossfade, long-wait and exit timers | stop/end clears timers, video callbacks and scoped observers; global reconcile observer is page-owned |
| Menu section / refinement / phase observers | Installed once on page DOM | Explicit dispose on owner; intentionally shared across races, counts checked after GC |
| Audio scene observer | Runtime ready; body class changes only | runtime-dispose disconnects |
| Core gzip worker | Requested compressed bootstrap source | Pending requests have 45 s deadline; idle microtask terminates; error, pagehide and runtime-dispose reject pending work and terminate |
| Soundscape worker | Audio preparation after user action | Complete/error/abort/45 s timeout terminates; PCM retained by weak AudioContext cache |
| Ray geometry worker | Occlusion explicitly enabled; bounded triangle selection | Controller dispose terminates; stale results ignored by generation; mode off is default |
| Legacy preflight decode worker / LOD queue | Compatibility API definitions only; no current product call sites | Not instantiated in audited product flows; modern binary loaders own actual assets |
| Track manager | One selected track request | Abort, supersession, timeout; late adapters unloaded; failed cleanup retains owner for retry |
| Asset, startup and texture loaders | Explicit requested dependency | AbortSignal, size/hash check, finite deadline; no monolithic fallback |
| Route prefetch | Selected route, debounced demand | Supersession/cancel clears debounce/timeout and aborts transport; bounded cache |
| PMREM/HDRI and ray geometry yields | Requested environment or geometry preparation | Bounded work, generation/AbortSignal and disposal; no autonomous periodic rebuild |
| GPU fence wait | Mobile first presented frame | Signal, 20 s deadline, fence deletion; short polls required because WebGL exposes no completion event |
| Toast, result, profile download | Explicit UI event; finite display/revoke timers | Replaced toast timers cleared; race message timer cleared on dispose; download URL revoked once |
| Editor persistence debounce | Dirty edit only | Flush/cancel on editor disposal; pagehide flush, no per-frame writes |
| Load readiness legacy bridge | Requested older API that has no ready event | Bounded polling owned by caller; timers removed on ready/error/abort/deadline |

## Residency policy
The page owns the menu shell and its observers. The prepared driving host owns one selected track, one selected vehicle, its renderer, audio engine and bounded environment caches while paused in the menu. Replacing a track releases the outgoing scene. Mobile retires workshop GPU allocations before driving; reopening rebuilds it. These retained owners are deliberate reuse, not abandoned scene objects. Final host shutdown releases the driving/HUD GPU contexts and audio; native allocations are measured independently of Three's counters. Original compressed CPU assets and explicitly shared images remain reusable and are not closed by a borrowed scene.

## Source call sites

Generated with `node tools/no-freeze/inventory.mjs`.

| Source owner | Direct calls (line: type) |
|---|---|
| `src/audio/prepare-soundscape-banks.mjs` | 3: Worker<br>11: setTimeout |
| `src/game/lighting-preset-file.mjs` | 12: setTimeout<br>15: setTimeout |
| `src/legacy/asfalto-v6-integration-runtime.js` | 2381: setTimeout |
| `src/legacy/cockpit-v5-browser.js` | 115: setTimeout<br>118: setTimeout<br>123: setTimeout<br>139: setTimeout |
| `src/legacy/cockpit-v5-preflight.js` | 20: Worker<br>30: setTimeout |
| `src/legacy/module-02.mjs` | 737: setTimeout<br>771: setTimeout<br>1506: Worker<br>1535: setTimeout<br>4219: setTimeout<br>4375: setTimeout<br>5716: setTimeout<br>7846: requestAnimationFrame<br>7967: requestAnimationFrame<br>8008: setTimeout<br>8981: requestAnimationFrame<br>9930: MutationObserver<br>10002: requestAnimationFrame, setTimeout |
| `src/legacy/v6-complete-runtime.js` | 179: setTimeout<br>214: setTimeout<br>572: requestAnimationFrame<br>573: requestAnimationFrame<br>575: setTimeout<br>582: setTimeout<br>624: setTimeout |
| `src/menu/loading-presentation.js` | 60: setTimeout<br>73: setTimeout<br>104: setTimeout<br>161: setTimeout<br>162: requestAnimationFrame<br>173: setTimeout<br>182: MutationObserver<br>201: MutationObserver<br>207: MutationObserver |
| `src/menu/menu-presentation.mjs` | 119: requestAnimationFrame<br>146: requestAnimationFrame<br>153: requestAnimationFrame<br>237: setTimeout |
| `src/menu/menu-refinements.mjs` | 62: MutationObserver |
| `src/menu/menu-sections.mjs` | 138: MutationObserver |
| `src/menu/race-session-presentation.mjs` | 74: MutationObserver |
| `src/menu/v7-experience.mjs` | 33: MutationObserver |
| `src/menu/v7-race-photo-capture.mjs` | 7: setTimeout |
| `src/performance/phone-cockpit-texture-pack.mjs` | 53: setTimeout |
| `src/render/hdri-transition.mjs` | 13: setTimeout |
| `src/render/phone-gpu-ready.mjs` | 2: setTimeout |
| `src/render/pmrem-cache.mjs` | 3: setTimeout |
| `src/render/ray-geometry.mjs` | 4: setTimeout |
| `src/render/ray-traced-occlusion.mjs` | 62: Worker |
| `src/runtime/abortable.mjs` | 30: setTimeout<br>32: setTimeout |
| `src/runtime/demand-loader.mjs` | 11: setTimeout |
| `src/runtime/frame-scheduler.mjs` | 24: MutationObserver |
| `src/runtime/phone-start-memory.mjs` | 8: requestAnimationFrame |
| `src/runtime/route-prefetch.mjs` | 14: setTimeout<br>38: setTimeout |
| `src/runtime/startup-demand.mjs` | 38: setTimeout |
| `src/runtime/versioned-storage.js` | 37: setTimeout |
| `src/tracks/track-manager.mjs` | 109: setTimeout |
