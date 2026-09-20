# No-freeze audit — implementation and evidence plan

Base: 12a1775b12ca69271fcff3161cae2a73f1e1aaee. Comparison: 912b2f805186305774f91dc2891d95d6e4b109a0. Branch: perf/no-freeze-runtime.

## Contract
Preserve all five circuits, vehicles, physics, controls, audio, workshop, progression and player saves. Keep PC visual quality and mobile resource policy. No reload workaround, silent giant fallback, perpetual loader, or swallowed runtime error. No claim of physical iPhone validation from Chromium emulation.

## Sequence
1. Reproduce unchanged local current/previous and production in real Chromium. Capture CDP CPU, network, DOM counters, heap after forced GC, long tasks, frame callbacks and native WebGL allocations. Exercise actual UI through at least three return cycles. Repeat CPU x4 and mobile constrained V8 heap separately, never overlapping GPU runs.
2. Correlate the regression diff with the CPU profile and lifecycle evidence. Record confirmed causes, contributors and disproved hypotheses separately.
3. Add failing focused tests, then remove unbounded fallback; introduce bounded abortable/retryable operations and visible recovery. Cancelled consumers must settle and stale work must not install resources.
4. Split shell demand from workshop/driving/physics/editor/audio initialization. Preserve dependency ordering and selected-asset ownership. Verify the menu requests no driving-only models/physics and no automatic full payload.
5. Make expensive scene preparation cooperative, cache valid work and share visual scheduling. Keep fixed physics unchanged unless a measured defect demands otherwise. Test scheduler cancellation, context loss and disposal.
6. Repair scene resource lifetime, audio, workers, observers and listeners found by repeated flows. Document retained bounded caches separately from leaked resources.
7. Add portable Chromium E2E and CI. Assert errors, timeouts, missing assets, context loss, successful physical movement, responsive cancellation, bounded retained resource growth. Establish runner-tolerant freeze budgets from measurements; do not use a universal 60 FPS gate.
8. Repeat profiles and prolonged circuit/vehicle/weather transitions, persistence corruption/quota/legacy profiles, cancellation and injected asset failures. Independent reviewer examines entire diff and evidence. Fix findings and rerun affected tests.
9. Run complete Node/integration/browser/syntax/release verification, commit coherent increments, push feature branch, open and attach PR against main. Include measurements and limitations; do not merge or deploy this audit implicitly.

## Evidence ledger
Raw reports live outside the distributable at Reports/Asfalto_NoFreeze/2026-09-20. A compact audited results document will be committed here. Instrumentation overhead is identical before/after. Headless D3D11 measurements are host-specific, not a physical mobile GPU claim. CPU profile and shader compilation time must distinguish JS evaluation from GPU driver waits.

- Baseline current run in progress: menu long task 22.6 s, race maximum 38.0 s; first return pending RAF 4, retained heap ~150 MB. These are observations, not yet causal attributions or a leak verdict.
- Static owner inventory completed independently; repeated resource trends and cancellation failures still require runtime confirmation.
