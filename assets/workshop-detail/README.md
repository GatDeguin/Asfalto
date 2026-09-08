# Workshop detail assets

These files accompany `src/render/workshop-presentation.mjs`. All assets load locally; the running game makes no Poly Haven requests.

- `workshop_2k.hdr`: unmodified [Poly Haven Workshop](https://polyhaven.com/a/workshop), CC0, photographed by Dimitrios Savva and processed by Jarod Guest. The Radiance panorama is 2048×1024. Runtime decoding uses the locally adapted Three.js r180 HDRLoader, followed by PMREM. Source HDR texture, PMREM generators, temporary capture target and final environments have explicit disposal.
- `wood-*-1k.jpg`: unmodified [Dark Wood](https://polyhaven.com/a/dark_wood), CC0, Dario Barresi / Dimitrios Savva / Rico Cilliers. Base color, OpenGL normal and roughness, each 1024². Applied tile width: 1.2 scene metres.
- `steel-*-1k.jpg`: unmodified [Rusty Metal 02](https://polyhaven.com/a/rusty_metal_02), CC0, Rob Tuytel. Base color, OpenGL normal and roughness, each 1024². Applied tile width: .75 metres on steel and .7 metres on painted metal.
- `workshop-details.glb`: original Blender geometry made for this scene: oil cans with seams/caps, cartons, drums, spare tires, coiled air hose, shop cloth, sockets and ratchet. 121 authored pieces combined into one mesh with seven material primitives, 56,518 exported triangles, 1,464,564 bytes. Editable source: `tools/workshop_visuals/workshop-details.blend`; reproducible generator: `tools/workshop_visuals/build_workshop_details.py`.

`manifest.json` records file hashes, byte counts, pixel dimensions, download URLs, source physical dimensions and tile sizes. `surface-provenance.json` preserves the source API MD5 checks and physical dimensions in millimetres; its `dimensions` field is not image resolution. Run `node tools/workshop_visuals/update_detail_manifest.mjs` to validate those source identities and regenerate the detailed manifest.

Coordinates in the detail GLB are final Three.js world metres, Y up, aligned with the workshop normalized to 18 metres wide. The original workshop and Chevy models are unchanged. The geometry is designed to sit on this workshop's shelves and floor, rather than being an independently rearranged generic kit.

Three.js HDRLoader adaptation retains the MIT license in `THREE-LICENSE.txt`. Poly Haven source terms: [CC0 license](https://polyhaven.com/license).
