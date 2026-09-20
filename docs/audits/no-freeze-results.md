# Asfalto Nacional: auditoría de estabilidad

Base `12a1775b12ca69271fcff3161cae2a73f1e1aaee`; comparación `912b2f805186305774f91dc2891d95d6e4b109a0`. Rama `perf/no-freeze-runtime`. Las métricas finales se completan después de cerrar la validación del candidato.

## Causas verificadas

- El menú cargaba el motor de conducción, Rapier y modelos antes de necesitarlos. En Chrome local la primera interacción tardó 38.349 s. El candidato demanda el motor al abrir el taller y difiere física/conducción hasta pedirlas; la shell no crea contextos WebGL ni pide Rapier, module-02 o modelos.
- El bootstrap pequeño podía disparar 59,003,274 bytes de JSON como recuperación silenciosa. La conducción normal también leía ese monolito. Se sustituyó por siete piezas binarias gzip independientes, idénticas a los bytes originales; fallos de red/hash muestran reintento.
- Los shaders se compilaban con estados diferentes del primer render (capas interiores, transmisión, mapas de SpotLight, espejos y sondas). Los perfiles señalan esperas de enlace en `getUniforms`, con tareas de 38–42 s en base12. Preparación por lotes bajo los destinos reales conserva materiales, sombras y efectos.
- CPU sin interrupción durante refinamiento de terreno, cierres de bordes, consulta del camino, cascadas/cámaras y creación inicial de colliders. Se dividió el trabajo conservando datos y orden; no se cambiaron los pasos fijos 60/120 Hz.
- Eliminar atributos de geometría antes de `dispose()` dejaba buffers GPU sin propietario (hidrología y curvatura). También faltaba retirar buffers de instancias. Se libera la geometría antes de separar los atributos y se inventarían los recursos antes de desmontar la escena.
- El Three r180 incorporado no dispone los materiales internos de sombras/VSM ni todas sus asignaciones internas al retirar un renderer. En móvil crecían 12 texturas, 176 buffers y 10 programas por vuelta. Cada renderer ahora posee sus asignaciones WebGL nativas y las retira al cerrarse, sin forzar context loss.
- HUD, sesión, taller y conducción mantenían relojes visuales separados. Se consolidaron en un scheduler con owners y frecuencias, deshabilitados según escena/visibilidad. Los RAF finitos de preparación siguen siendo necesarios para ceder al navegador.
- Inicialización tardía de HUD/audio podía instalar recursos después de cerrar su dueño. Los resultados tardíos se liberan y la suscripción no vuelve a abrirse.
- El botón de recuperación del taller quedaba bajo el menú y dentro de un padre `aria-hidden`. El flujo inyectado HTTP503 ahora permite pulsar Reintentar de verdad.
- Restauración WebGL: callbacks del navegador podían ejecutar microtasks antes de que todos los compositores retiraran sus destinos viejos. Una frontera de tarea espera el final del evento antes de capturar los nuevos buffers. Reanudar está condicionado a preparación exitosa.

## Regresión frente a v7/v8 anterior

El problema no nació entero en `12a1775`: `912b2f8` también produjo una tarea de 34.473 s. La recuperación de funciones amplió los materiales y el trabajo del taller sobre esa arquitectura. No hay evidencia de que el fixed timestep fuera la causa; se conservó. No se atribuye el bloqueo sólo al tamaño de Rapier ni al desgaste de pintura sin perfiles que lo sostengan.

## Cambios y responsabilidades

- `runtime/engine-bootstrap`, `workshop-bootstrap`, `asset-core`, `cockpit-source-loader`, `inflate`, `demand-loader`: demanda, integridad, límites, cancelación y recuperación.
- `runtime/frame-scheduler`, `event-owner`, `context-recovery`, `dispose-all`, `owned-renderer`, `scene-resources`, `diagnostics`: reloj, propietarios, restauración y diagnóstico `?qa=1`.
- `render/shader-preparation`, `material-hook`, cockpit/mirrors/water/workshop: variantes correctas, hooks sin cadenas acumulativas y estado restaurado antes de ceder ejecución.
- `tracks` y preparación Rapier: trabajo cooperativo, índices exactos y descarga de escenas antiguas.
- Adaptadores de `legacy/module-02`, `v6-complete-runtime`, HUD y menú: conexión a esos módulos, sin convertir el archivo central en un nuevo contenedor de sistemas.
- Persistencia: tolerancia a perfil parcialmente viejo, JSON inválido y cuota; se conservan partidas y campos desconocidos. No hay migración destructiva.
- `tools/no-freeze`, pruebas Node y workflow Chromium: ejecución real del producto, perfiles, errores, movimiento físico, capturas no vacías, memoria/GPU y fault injection.

## Método y límites de las métricas

Chrome real Windows D3D11, CDP, una sesión GPU a la vez; mismas sondas antes/después. Heap retenido medido tras GC. El límite V8 384 MB no equivale a RAM total: texturas y ArrayBuffers pueden vivir fuera de old space. La emulación móvil verifica viewport/entrada táctil/presupuesto del juego; no certifica Safari/WebKit ni hardware iPhone.

Los intervalos RAF no equivalen a FPS de presentación: se informan por separado de los contadores del renderer. El profiler es muestreado, no un trazado exhaustivo de compilación/GPU. Se informa GC y muestras parse/compile sólo como estimación; shader link/driver se atribuye mediante stacks. El efecto de la caché de shaders del driver no puede eliminarse completamente entre ejecuciones.

La prueba local usa 2.5 s como límite de tarea individual para detectar freezes, 240 s de preparación y 35 MB de crecimiento retenido entre tres retornos equivalentes. No exige 60 FPS universales. El CI usa un presupuesto separado para SwiftShader y conserva perfiles para revisar desviaciones; valores finales se validan en el runner.

## Validación

Pendiente de completar con matriz final, CPU x4, reentrada sostenida y ejecución remota de CI. Los candidatos rechazados no se contabilizan como aprobados.

## Inventario y reproducción

Ver [owners](no-freeze-owners.md). `npm ci`, `npm test`, `node tools/check-syntax.mjs`, `npm run verify:release`, `AN_ENFORCE=1 npm run test:browser`; variantes `AN_MOBILE=1`, `AN_HEAP_MB=384`, `AN_CPU=4`, `AN_TRACKS`, `AN_VEHICLES`, `AN_WEATHERS`, `AN_SKIES`. `fault-flows.mjs` y `runtime-faults.mjs` prueban recuperación real. Los informes completos quedan en `test-results/no-freeze/` y como artefactos CI, fuera del inventario distribuible.
