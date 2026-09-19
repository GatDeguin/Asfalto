# Ledger — docs/audit-repairs/PLAN.md
Base reconstruida desde artefactos existentes; gh-pages remoto verificado sin cambios.
Baseline: node --test tools/*.test.mjs → 193 tests, 183 pass, 10 fail.
Decisión: trabajar en copia aislada porque el contenedor no resuelve github.com;
lecturas y publicación mediante el conector GitHub. No se alteró producción.

A1 completo: 17/17 pruebas específicas. Suite conserva los diez fallos previos; se añadieron cinco contratos sin regresiones nuevas.

A2 completo: 3/3 contratos nuevos; frontera latched, pausa existente con continuar deshabilitado y recuperación tras inicio exitoso; RAF único cancelado al disponer.
A3 completo: 14/14 contratos de sobrecarga/perfiles; emergencia 2 s, mínimo 8 muestras, recuperación ordinaria preservada.

A4/A7 completo: 13/13 contratos de presupuesto/materiales. Presupuesto principal conservador 256 MiB escritorio / 96 MiB teléfono (no VRAM medida), dos HDR+profundidad+MSAA y efectos; límites previos a asignación. Taller aplica DPR estable y limita mapas de sombra sin quitar contacto.

A5 completo: 15/15 contratos caché/perfiles. Invalidación por contexto, vehículo, escena, variantes, recursos y cap; preparaciones abortadas/fallidas no se cachean.

A6 completo: 11/11 contratos DFAO/materiales. Índice espacial y caché de instancias con invalidación por matrices, geometría, visibilidad y altas/bajas; se conserva traversal por objeto para detectar cambios.

Fallos previos resueltos: mocks alineados con openPreparedRace/canLeaveWorkshop y DOM de marca; import de tests ambientales usa Three r180 empaquetado. El servidor realmente apuntaba al workspace padre: se corrigió a datos locales propios, migración no destructiva y alias del archivo de iluminación. Se bloquea acceso HTTP a .local-data/.git. La vitrina vuelve a envolvente .42m, <=35000 triángulos y tiras sin sombras, preservando las 20 identidades y alturas (incluido aro de medallas).
Suite completa: 224/224, cero fallos y ninguna prueba omitida.

Revisión adicional: reintento inmediato tras cancelar separado de la operación anterior; prewarmViews ahora restaura vistas al cancelar; caída sostenida >1s/cuadro no queda excluida. Gate estricto probado con fallo intencional fuera del subset Cinematic. Publicación normal desde release mediante promoción solo posterior a verify; protección administrativa de pushes directos no está disponible por el conector.
