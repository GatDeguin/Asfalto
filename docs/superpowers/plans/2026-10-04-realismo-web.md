# Estabilidad y realismo de imagen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Ejecución autónoma en esta sesión solicitada por el usuario.

**Goal:** Reducir aliasing y microdetalle inestable conservando el gameplay y el presupuesto HDR.
**Architecture:** Extender el adaptador gráfico existente, sin cambiar física ni renderer. AA de salida dentro del compositor de color y después de mundo/cockpit.
**Tech Stack:** ES modules, Three r180, WebGL2, Node test, Chrome/Playwright existentes.
**Spec:** docs/realismo-web.md.

## Global Constraints

- Sin dependencias runtime externas ni nuevos assets de terceros sin licencia.
- No afirmar WebGPU/TAA/upscaling temporal donde no hay implementación.
- Preservar DOM, guardado, física 120 Hz, fotos, input y flujo del menú.
- Informes/capturas grandes fuera del directorio servido; publicación sólo con inventario válido.

## Review Focus

- LUT activo debe recibir HDR con un único tone mapping.
- El cockpit mantiene profundidad independiente y espejos, aun dentro del buffer AA.
- Resize/context restore no deja targets obsoletos ni callbacks después de dispose.
- Texturas compartidas restauran anisotropía cuando se libera el último owner.
- Bajo/teléfono/sin HDR/Apagado alcanzan imagen final funcional sin AA.

## Tasks

- [x] 1. Escribir y ejecutar RED de capacidades, filtrado compartido y reserva de buffer.
  Files: src/render/render-capabilities.mjs, texture-filtering.mjs, render-budget.mjs; tools/photoreal-policy.test.mjs. Interfaces: createRenderCapabilities({renderer, navigator}) → diagnostics/dispose; resolveRenderBudget({spatialResolve}) agrega 12 B/píxel. Tests: detección denegada, contexto restaurado, late callback, mip-only, hardware cap, varios owners, 4K budget.
- [x] 2. Implementar capacidades/filtrado y bandlimit derivativo; ejecutar GREEN y pruebas existentes HDR/render-budget.
  Files: advanced-materials.mjs, advanced-graphics.mjs y dependencias anteriores. Microdetalle conserva shader compatible y la máscara de pigmento.
- [x] 3. Escribir RED con GPU real para AA espacial: diagonal, HDR>1 sin clamp ni doble tone mapping, depth/interior, fallbacks, 20 quality cycles, estado tras callback fallido.
  Files: tools/spatial-antialias.gpu.mjs; src/render/spatial-antialias.mjs; vendor/fxaa-shader-factory.mjs; vendor/FXAAShader.js (MIT Three r180).
- [x] 4. Implementar AA y conectar preparación/render/dispose del taller y carrera dentro del color grading. Actualizar hashes de importación local; ejecutar GREEN.
- [x] 5. App completa: imágenes antes/después, movimiento por input real, seis cielos, lluvia, niebla, cambios rápidos de calidad, resize y retorno al taller. Medir GPU/rAF/CPU submit y recursos en ventanas estables, revisar screenshots realmente.
- [x] 6. Revisión independiente del diff, corregir regresiones con RED→GREEN; generar inventario, documentar evidencia y límites. Sin claim de calidad AAA ni FPS universal. Sin cambios a fallos de fixtures previos ajenos salvo que bloqueen verificación de este bloque.

## Ledger

- 2026-10-04: baseline ejecutado e imágenes inspeccionadas. Ruling: conservar WebGL2; la dependencia GLSL real impide migración transparente. Coste si se reconsidera: migrar materiales/pases a TSL, no un rename del renderer.
- 2026-10-04: el sandbox falla al iniciar procesos y al escribir con apply_patch; lecturas, pruebas y escrituras locales se ejecutan mediante escalación revisada automática. No se modifica configuración de permisos.

- 2026-10-04: revisión independiente identificó URLs distintas de pass-preparation: se unificaron todos los callers; regresión RED 2 registros → GREEN 1.
- 2026-10-04: la prueba de context loss real produjo INVALID_OPERATION al liberar handles después de restablecer el contexto. Se liberan antes, durante loss; recuperación real con glError 0. No se extrapola a pérdida durante compilación pendiente de toda la aplicación.
- 2026-10-04: refinamiento visual tras capturas: añadir apoyo del vehículo con contactos físicos válidos, cinco parches máximos y un dibujo. Pruebas de plano inclinado/no coplanar, datos ausentes, pérdida/interpolación y ciclo de vida. La revisión encontró doble pase transparente y prewarm oculto omitido; regresiones RED→GREEN con forceSinglePass y marca asfaltoPrewarm del sistema existente.
- 2026-10-04: los diez fallos previos de fixtures bloqueaban verificar la entrega. Ruling: actualizar los mocks HDR/AssetPipeline conservando aserciones y hacer autocontenida la referencia física histórica; no cambiar física ni código de negocio. Suite completa local: 330/330.

- 2026-10-05: verificación final de app 23/23; GPU 19/19; UI contratos 18/18; tacto emulado 5/5. Evidencia compacta y captura final incluidas; informes/capturas completos fuera de la carpeta servida.

- 2026-10-05: inventario de fuente verificado dos veces; entrega bajo presupuesto Pages, sin migración ni assets adicionales. Publicación conserva su propio inventario e informes previos.

- 2026-10-05: auditoría de todos los módulos con WeakMap encontró tres cachés adicionales con dos URLs: vehicle-resource-pool, frame-matrices y surface-curvature. Unificadas con hashes y regresión común de los cuatro registros; RED 2/2/2 → GREEN 1/1/1. Se repite la app completa por ownership compartido.

- 2026-10-05: repetición final tras unificar todos los registros: app 23/23 y suite 330/330 en fuente y publicación. Evidencia renovada con los valores observados, sin extrapolar mejora de FPS.
