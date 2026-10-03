# Movimiento semántico — Asfalto Nacional v8

## Contexto y alcance observado

La base elegida es `Asfalto_Nacional_v8`: su README la identifica como base actual. Hay versiones anteriores y copias de publicación fuera de ella; no se sincronizan ni publican en esta tarea. No hay repositorio Git en este checkout ni AGENTS.md aplicable. Antes de modificar, se guardó copia de los archivos afectados en `../Reports/Asfalto_Nacional_v8/motion-semantico-2026-10-03/before/`.

Hechos: aplicación web modular sin paso de build ni framework de UI, ES modules, DOM imperativo, Three.js r180 observado en ejecución, Rapier 0.20.0 local. El perfil persistido pertenece al runtime v6; `reduceMenu` sólo gobierna la presentación. El menú tiene seis secciones, tres modos y doce pruebas; el diálogo de pausa tiene confirmación de reinicio. Controles nativos, teclado y mandos táctiles coexisten con el cockpit. Los recursos de movimiento incorporados son locales. Fuentes del menú: Impact/Arial Narrow y recursos estáticos existentes; no se observó una fuente variable autorizada para este alcance.

Inferencia: quienes juegan necesitan preparar una salida y volver repetidamente al taller sin ceremonia. La identidad industrial argentina de 1973 admite una respuesta contenida, de asentamiento breve y sin rebote. No se midió frecuencia real de usuarios ni se presupone compatibilidad en teléfonos físicos.

Restricción: conservar datos, navegación, simulación, audio y contrato de pausa. No añadir escenas, sonidos, bibliotecas, controles de demostración o tours. El taller y el cockpit ya tienen movimiento espacial propio: no añadir movimiento de cámara como feedback de interfaz. Se mantienen quietos la navegación lateral y Volver siempre; las listas de pruebas al cambiar la ficha; las tarjetas ante hover/foco/presión, y las cifras. Al entrar en otra sección, M1 sí traslada el panel completo 8 px (4 px en pantalla estrecha), sin escala ni cambios de tamaño de sus controles.

## Mapa semántico

| Intención → acción | Dominio | Interfaz → respuesta → reposo → siguiente acción |
|---|---|---|
| Preparar salida → elegir sección/modo | Selecciones existentes del perfil; ninguna operación nueva | Sección activa → entrada corta del contenido nuevo → panel utilizable → elegir ruta/prueba o salir |
| Comparar una prueba → seleccionar ficha disponible | `selectedTest`, marcas y desbloqueos reales | Selección y textos actualizados inmediatamente → disolución local del detalle → datos finales → preparar prueba |
| Cambiar aspecto/inspección → pestaña del taller | Operaciones originales del taller | Pestaña activa → entrada breve de sus controles → panel final → ajustar/volver |
| Detener conducción → abrir pausa | El host pausa antes de `show()` | Fondo inerte y foco en Continuar → entrada de la tarjeta → pausa estable → continuar/ajustes/reinicio |
| Revisar reinicio → Reiniciar/Escape | Reinicio sólo por confirmación explícita | Confirmación/menú excluyentes → relevo local → foco en Seguir en pausa/Continuar → confirmar o salir |
| Regresar → Volver/Escape | Perfil preservado | Vista home/modos → señal de regreso → foco original recuperado → siguiente sección |
| Esperar carga → carga real | Readiness del runtime, progreso real separado del tacómetro decorativo | Estado y cancelación originales → película/poster/indicador existente → fin por operación → tarea disponible |

Presentación: animaciones efímeras, sin callbacks de dominio. Invariantes: una sola entidad interactiva por estado, selección coherente, foco inmediato, resultado independiente de animationend/finished, cancelación sin operaciones de negocio, ningún transform residual.

## Evaluación de las 16 técnicas

| Técnica | Decisión / ubicación real | Necesidad y beneficio esperado | Riesgo principal | Alternativa reducida | Verificación |
|---|---|---|---|---|---|
| Morph | Omitir / no corresponde | Secciones y confirmación no son el mismo objeto que cambia de forma | Roles incorrectos, texto deformado | Cambio directo | Un solo panel activo |
| Stagger | Omitir / modos y listas de pruebas | Orden ya explicado por agrupación y lectura; doce pruebas de uso repetido | Esperas y foco en contenido invisible | Todos disponibles | Selección inmediata, teclado |
| Spring | Omitir / no corresponde | La UI no manipula objetos elásticos; el volante pertenece a simulación | Rebote e interferencia con física | Respuesta directa | Física intacta |
| Easing | Aplicar / secciones, pausa y estados de control | Asentamiento acotado que distingue aparición del estado estable | Cola demasiado larga | 0 ms | Tiempo, interrupción, reposo |
| Crossfade | Adaptar / detalle de prueba, confirmación; película/poster existente | Sustituir información en el mismo lugar; entrada desde opacidad 0,86 sin duplicar estado saliente | Doble lectura o pérdida de contraste | Contenido final inmediato | Datos/foco correctos desde inicio; capturas temporales |
| Shared element | Omitir / vehículo entre taller y carrera | Ya hay carga y cambio de escena 3D; no hay par DOM equivalente | Clones, origen inexistente y coste | Carga original | Sin clones ni rutas nuevas |
| Magnification | Omitir / tarjetas | Borde/fondo/foco ya identifican selección | Objetivo móvil y colisión con vecinos | Énfasis estático | Rectángulo de tarjeta estable al hover/foco |
| Blur | Omitir / pausa | Fondo sólido ya separa la pausa | Pintura extensa, texto/foco ilegible | Fondo sólido | Captura y foco |
| Mask | Omitir / no corresponde | No hay descubrimiento mediante una forma | Contenido oculto y fallbacks | Contenido completo | No nuevas máscaras |
| Variable font | Omitir / títulos | No hay recurso variable autorizado verificado | Ejes ficticios, reflow | Fuente existente | No nuevas fuentes/peticiones |
| Layout animation | Omitir / listas y secciones | No se reordena una colección persistente por esta tarea | FLIP innecesario, deformación, medidas obsoletas | Layout final inmediato | Resize, texto largo, sin huecos |
| Clip path | Omitir / no corresponde | La frontera de apertura no aporta información | Recortar controles/foco | Contenido completo | Sin nuevo clipping |
| Path morph | Omitir / no corresponde | No hay geometrías relacionadas que comunicar | Inventar datos intermedios | Cifras exactas | Datos no animados |
| Stroke draw | Omitir / rutas | El mapa existente no necesita narrar construcción ni causalidad | Sugerir un progreso inexistente | Ruta completa | No tocar mapas/progreso |
| Perspective | Adaptar / escena Three.js existente; omitir en UI | Profundidad real del taller/cockpit orienta la conducción; conservarla | Cámara vestibular adicional | Interfaz plana | No nuevos giros/zoom |
| Particles | Adaptar / clima existente; omitir en feedback UI | Precipitación representa clima real; conservar motor y presupuesto existentes | Confundir éxito con celebración/cantidad | Estado textual original | Sin emisores/loops añadidos |

Justificaciones aceptadas: cuando se elige una sección, su entrada ayuda a reconocer el nuevo contexto y evita confundirlo con una actualización dentro del panel, sin interferir con preparar la salida. Cuando se selecciona una prueba, el relevo del detalle ayuda a relacionar la ficha elegida con su objetivo y marca, sin mover la lista ni retrasar selección. Cuando se abre pausa, su entrada identifica el contexto detenido; el foco y el bloqueo del fondo ocurren antes del primer frame. Cuando se cancela un reinicio, el relevo recupera las opciones originales sin reanudar la carrera.

## Gramática y tokens

Fuente única de tokens: `assets/styles/semantic-motion.css`, consumida por CSS y WAAPI mediante computed style al iniciar, nunca por frame. Respuesta 120 ms; información local 160 ms; contexto 240 ms; recorrido 8 px desktop/4 px pantalla estrecha; asentamiento `cubic-bezier(.2,.7,.2,1)`. Regreso usa signo inverso. Opacidad mínima 0,86: no se crea una fase invisible. Sin escala, retrasos, blur, profundidad nueva, spring o densidad de partículas: tokens para esos efectos se omiten porque no tienen consumidores.

## Contratos previos a implementación

| Campo | M1: contexto del menú/taller | M2: detalle de prueba | M3: pausa/confirmación |
|---|---|---|---|
| Identidad y propósito | Estado real `view/panel/step/tab`; distinguir nuevo contexto | Ficha identificada por testId, detalle del mismo perfil | Sesión detenida; confirmación explícita de reinicio |
| Condiciones | Sin intro, menú abierto, destino visible; primera sincronización estática | Cambia testId mostrado; no por render/refresco de marcas | Host pausó; diálogo abierto o relevo menú/confirmación |
| Resultado | Panel final y perfil original; nav quieta | Selección y datos finales correctos desde evento | Sólo estado visible participa; foco y callbacks originales |
| Geometría | Panel entrante translateX(8→0); home regresando −8→0; Volver/nav excluidos | Sólo `.an-test-info`, sin transformar lista ni acciones | Tarjeta translateY(8→0); relevo sólo opacidad |
| Tiempo | 240 ms, llegada; sin dependencia de operación | 160 ms; sin atraso de datos | 240 ms al abrir, 160 ms relevo; cierre inmediato |
| Interrupción | Reemplazar por última intención válida, cancelar recurso anterior; mismo estado no repite | Reemplazar anterior, nunca restaurar textos obsoletos | Hide/dispose cancela; callbacks inmediatos y una vez |
| Interacción | Controles disponibles desde inicio, semántica y foco originales | Área activa quieta; nombre/textos reales | Fondo inert antes del efecto; Cancelar por defecto en confirmación |
| Adaptación | 4 px en móvil, teclado/tacto; reduced/sin WAAPI/oculto = estático | Reduced = texto final directo | Reduced = diálogo final, sigue teclado y retorno de foco |
| Ciclo de vida | Scope propietario, cancelación al cambio de preferencia/pagehide/dispose; sin bucle | Scope de menu-sections, dispose del observador existente | Scope por instancia, limpia en hide/dispose |
| Evidencia | Capturas 0/50/100%, cambio rápido, resize, veinte regresos | testId/texto, selección rápida, detalle accesible | Veinte ciclos, Escape, foco, desmontaje, cancelación de finished |

## Verificación y entrega

Comandos desde esta carpeta, sin build: `node server.mjs` o `INICIAR_JUEGO.bat`. Elegir Pruebas, cambiar ficha, volver, abrir Conducir y preparar salida; durante conducción usar Escape y revisar la confirmación de reinicio. El ajuste existente **Experiencia y accesibilidad → Reducir movimiento** funciona junto con la preferencia del sistema, sin agregar controles.

Pruebas reproducibles: `node tools/semantic-motion-browser.mjs contracts`, `css`, `app`, `touch` y `driving` (cada modo es un argumento separado). Usa Playwright ya instalado: primero resuelve `playwright` local, después el runtime del entorno. En otro equipo pueden indicarse `ASFALTO_PLAYWRIGHT_PACKAGE` (ruta a package.json del runtime con Playwright) y `CHEVY_CHROME_EXECUTABLE`. No se agregó dependencia al juego. `baseline` se ejecutó antes de implementar; ejecutarlo ahora mide el código actual, no recrea la referencia anterior.

En el workspace los reportes quedan fuera del directorio servido; esta publicación conserva una copia de los reportes y nueve capturas esenciales en `docs/motion-evidence`. Evidencia publicada: [carpeta de evidencia](motion-evidence/). El harness usa fixtures explícitos para probar el componente de pausa, los tokens y selectores CSS reales; los modos app/touch/driving ejecutan la aplicación real. No se presenta el fixture como una carrera ni una operación real de carga.

| Ejecución observada | Resultado |
|---|---|
| [Contratos](motion-evidence/contracts/report.json) | 18 comprobaciones: entrada, foco, fondo inert, Escape/confirmación, interrupción a 0/50/98%, veinte aperturas/cierres, veinte montajes/desmontajes, reducción dinámica del sistema/app, fallback sin WAAPI, limpieza sin promesas rechazadas no manejadas |
| [Política CSS](motion-evidence/css/report.json) | 8 comprobaciones: presión de navegación/Volver sin transform, pseudo-elementos y host estáticos con ambas clases de app y preferencia del sistema |
| [Aplicación](motion-evidence/app/report.json) | 16 comprobaciones: perfil, última intención, efecto conectado al evento real, datos del detalle, cancelación al navegar, seis secciones con reducción, veinte regresos, teclado, resize/orientación y sin desborde del documento |
| [Tacto](motion-evidence/touch/report.json) | 5 comprobaciones: hasTouch/isMobile, selección de 500 m, preparación y regreso por tap, sin errores JS |
| [Carrera real](motion-evidence/driving/report.json) | 6 comprobaciones: salida por UI a RUNNING, pausa física, cancelación de reinicio, continuación, pausa reducida con foco, regreso preservando vehículo; sin errores JS |
| `node --test tools/*.test.mjs` | **307/317 pasan, 10 fallan**. La suite general no está aprobada. Log completo: `unit-suite.log` |

Los cinco modos finales suman **53 comprobaciones de navegador**, sin errores JS ni peticiones HTTP externas observadas. Esto es cobertura de estos recorridos, no auditoría completa de accesibilidad o de todos los circuitos.

### Fallos previos identificados

Reproducidos de forma aislada, con archivos fuente/test idénticos por SHA256 al inventario recibido: [auditoría](motion-evidence/unrelated-failures-audit.json), `unrelated-failures.log`.

- `lazy-rival.test.mjs`: cuatro fallos — Falcon stays unloaded; failed rival preparation; shutdown during conversion; shutdown during presentation. El fixture extrae código actual que usa `rivalAssetPipeline`, pero no define ese objeto (ReferenceError); aún espera el decode anterior.
- `render-preparation.test.mjs`: seis fallos — prepare capture contexts grading=false/true; nested prepare failure async=false/true; fog topology exponential=false/true. El fixture de renderer no provee soporte HDR que el código actual requiere para entrar en el pass; falla con niebla original 1 frente a 2000, 4/80 frente a 2000/4000 o densidad .012 frente a 0. No se modificaron renderer, física ni fixtures previos para ocultar estos fallos.

### Correcciones demostradas

El contrato inicial de pausa falló antes de existir movimiento (`contracts-red.json`). La regresión `navigation-red.json` detectó una disolución del detalle aún activa al salir de Pruebas: se añadió cancelación explícita al cambiar contexto. La revisión independiente reprodujo giro de indicadores y transición del host con la preferencia de app, además del desplazamiento de navegación al presionar. `css-red.json` recoge esos fallos; la política ahora incluye hosts y pseudo-elementos y neutraliza presión de los objetivos establecidos. Los reportes finales correspondientes pasan.

Revisión independiente de código: no encontró fallos críticos ni otro problema importante en scopes, fallback o limpieza. También comprobó cancelación por pagehide/dispose. Sus dos observaciones se corrigieron y probaron; no se extrapola esa revisión a conformidad normativa.

### Apariencia inspeccionada

Se abrieron y observaron realmente `baseline/home.png`, `baseline/tests-stable.png`, `app/section-start.png`, `section-middle.png`, `section-end.png`, `phone-portrait.png`, `phone-landscape.png`, `touch/touch-preparation-landscape.png` y `driving/race-pause.png`. Las capturas de inicio/mitad/final fijan currentTime 0/50% y luego dejan terminar WAAPI: muestran continuidad de posición, no una grabación de todos los frames. El marco de referencia lateral permanece; no hay textos escalados, entidades duplicadas o recorte nuevo observado. En móvil se conserva la composición compacta recibida, incluidas sus regiones desplazables; no se rediseñó su densidad de información.

### Presupuesto y medición

Criterio local: movimiento de UI acotado a 240 ms, 8/4 px; sin bucles nuevos, sin clones, cero efectos transitorios del scope en reposo; p95 de intervalo de frames del recorrido medido por debajo de 20 ms. El resultado responde antes del reposo porque DOM, foco y callbacks son inmediatos. La barra cuantitativa no suaviza valores. El tacómetro existente sólo tiene CSS animation/will-change mientras la superficie indica necesidad vigente; permanece separado del progreso real y se apaga al detenerse.

Entorno de ambas muestras: Windows (`win32`), Node 24.20.0, Playwright 1.62.1, Chrome 154.0.8037.95 headless, ANGLE d3d11; 1280×800, taller Three r180 activo, Chevy 250 SS Serie 2, doce pruebas/seis secciones, contextos nuevos sin throttling configurado. Se midieron seis selecciones sucesivas durante ~2,5 s con rAF y PerformanceObserver de tareas largas. Las muestras son cortas y orientativas.

| Métrica | Antes | Final |
|---|---:|---:|
| Intervalo frame p50 | 16,7 ms | 16,7 ms |
| Intervalo frame p95 | 16,8 ms | 16,8 ms |
| Frame máximo | 133,2 ms | 133,4 ms |
| Frames >34 ms | 2 | 1 |
| Tareas largas / tiempo | 1 / 53 ms | 0 / 0 ms |
| Máximo trabajo síncrono del click | 46,5 ms | 19,4 ms |

No se observó regresión del p95 en esta muestra; persiste un frame largo. No se atribuye una mejora general al cambio ni se promete 60 FPS. No se midieron GPU, memoria o energía. La prueba táctil es emulación Chrome, y el resize desktop usa 390×844/844×390; ninguno equivale a iPhone físico/WebKit.

### Archivos y límites

Nuevos: `src/menu/semantic-motion.mjs`, `assets/styles/semantic-motion.css`, este informe y `tools/semantic-motion-browser.mjs`. Integración: `menu-presentation.mjs`, `menu-sections.mjs`, `race-pause-menu.mjs`, `race-session-presentation.mjs` (referencia versionada), `loading-presentation.css`, `index.html`, `README.md`, `assets/manifests/release.json` (inventario). Los recursos afectados se referencian con su hash de contenido para conservar la política de caché existente.

Dependencias/producto: **cero añadidas**, sin fuentes, medios, conexiones remotas ni cambios de datos. El incremento de entrega queda registrado junto al resultado de `node tools/verify-v8-release.mjs --write` y su verificación independiente en `release-verification.json` fuera de la carpeta servida.

Pendiente: Safari/Firefox, dispositivos físicos, lector de pantalla, zoom de navegador (el viewport recibido aún restringe user-scalable), cambios de fuentes/recurso tardío, toda la gama de errores operativos y sesiones completas de competencia en cada circuito. Los temporizadores y transiciones 3D originales no se sustituyeron; esta tarea no certifica toda la animación de la aplicación ni cumplimiento WCAG completo.

### Verificación de esta publicación

El checkout de `gh-pages` vuelve a pasar los 18 contratos de pausa, las 8 comprobaciones CSS y la integridad del inventario. Al ejecutar la suite general en este checkout pasan **306/317**, con **11 fallos**: los diez ya descritos y `physics-runtime-scratch.test.mjs`, que depende de una copia histórica ubicada fuera del repositorio (`../Reports/Asfalto_Nacional_v8/runtime-gpu-2026-09-27/before/`). Esa copia existe en el workspace de desarrollo, pero no en el checkout de publicación; falla con ENOENT. Se conserva el test y se informa la limitación, sin declarar aprobada la suite. Log: [publication-unit-suite.log](motion-evidence/publication-unit-suite.log). El workflow de GitHub mantiene la suite completa.
