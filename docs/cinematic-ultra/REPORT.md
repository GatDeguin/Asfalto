# ASFALTO NACIONAL — CINEMATIC ULTRA
## Entrega de implementación y verificación

**Estado: código en revisión; no se publicó ni se declara aprobación visual AAA.**

Base: `gh-pages`, `045cd8b7d206418a26d7a75666e557a7e124377a`.
Rama: `graphics/cinematic-ultra-20260918`.
Último cambio funcional: `a1f63870d4e77f869fe711669df17930c2c77e95`.
Los commits siguientes de entrega documentan y empaquetan la revisión.

Se implementó Cinematic a través del pipeline existente, una primera capa de
materialidad/estabilidad y una corrección verificada del vehículo negro en el taller.
La validación de conducción en los cinco circuitos y el presupuesto en GPU física
siguen pendientes. La suite global conserva diez fallos anteriores a esta tarea.
No hay merge, despliegue ni sustitución de los assets publicados.

## 1. Auditoría y contratos

`index.html` carga realmente `src/legacy/module-02.mjs` y
`src/legacy/v6-complete-runtime.js`. No son código descartable por estar en legacy.
El primero conecta `src/app/modular-bootstrap.mjs`, los circuitos, el gobernador,
los gráficos de carrera, el cockpit y el color. El segundo inicia el taller,
carga sus manifiestos/GLB y prepara el vehículo aprobado y los subsistemas visuales.
Se conserva el Three **r180** embebido en los manifiestos existentes.

El auditor literal registra 226 archivos alcanzables y 313 aristas sin destino
literal ausente. El inventario se complementó con lectura de imports construidos
mediante `new URL` y del flujo de manifiestos/gzip/blob; el análisis literal solo
no demuestra ejecución de todas las ramas. Ver `AUDIT.md`.

Se verifican once hashes protegidos, idénticos a la base: runtimes de física,
Rapier, recuperación y entrada, física Falcon, rig de cámara, condiciones de suelo,
controlador de pintura, materiales ambientales, perfiles y ciclo temporal. No se
editaron sus parámetros ni el paso fijo de 120 Hz. Tampoco se sustituyeron trazados,
colisionadores, manifiestos, GLB o atribuciones. Esta igualdad byte a byte no
reemplaza una regresión funcional completa de conducción, controles y guardados.

La aplicación sigue siendo estática, con rutas relativas y sin nuevo proceso de
compilación, backend o servicio de render. Las dependencias Playwright/Python y los
workflows son herramientas opcionales de QA, no requisitos de GitHub Pages.

## 2. Cambios implementados

### Perfil completo y presupuesto

El valor `cinematic` y la etiqueta **Cinemática / Ultra** atraviesan selector,
normalización, persistencia, eventos, calidad solicitada, gobernador, calidad
efectiva, materiales, pases y diagnóstico. Se conservan Adaptativo, Alto,
Equilibrado, Bajo y Apagado, la clave de almacenamiento y el default Equilibrado.
No se fuerza Cinematic ni se migran las preferencias existentes.

El selector funciona desde el taller frío, antes de esperar la preparación del
cockpit. Un propietario compartido por raíz evita duplicar listeners cuando se
entra en carrera. La interfaz distingue **Solicitado** y **Efectivo** y muestra el
motivo de reducción cuando está disponible.

El gobernador existente incorpora Cinematic → Alto → Equilibrado → Bajo. Evalúa
reducción con 240 muestras y p95; exige 600 para recuperación. Adaptativo nunca se
promueve a Cinematic. Se respetan límites base Equilibrado/Eco. La recuperación
Alto → Cinematic admite 16,7 ms a 60 Hz, en lugar de exigir un intervalo imposible
de 16 ms bajo sincronización de 60 Hz. Los umbrales escalan con el objetivo de FPS.
El taller usa otra instancia del mismo gobernador y mide intervalos reales de
presentación: un tirón de 400 ms no queda oculto por el dt recortado de animación.

Las políticas secundarias mapean explícitamente Cinematic a Alto: vegetación,
espejos, agua, clima y cadencia procedural. Los contratos de streaming físico
reciben la familia Alto, no un valor desconocido que altere densidad o simulación.

### Materialidad y estabilidad espacial

Se mantienen materiales por referencia, mapas autorales y callbacks de pintura.
La microtextura respeta tanto `chevyPaintMask` del controlador legado como
`vehiclePigment` del exterior aprobado que carga `vehicle-presentation`.
El contrato también prueba cambio de color y condición mojada del vehículo activo.

Se añaden roles explícitos de asfalto, caucho y vinilo y se refina el detalle de
pintura/minerales con escala métrica y atenuación por footprint. El detalle lejano
se reduce en el shader, sin desplazar geometría física ni convertir toda la
carrocería en metal. No se aplica una máscara general de arañazos al vehículo.
Se mantienen los tratamientos particulares de vidrio, cromado y agua.

La anisotropía Cinematic tiene tope 8, limitado por el dispositivo. El control es
reversible y compartible entre propietarios; respeta valores autorales mayores y
no destruye texturas prestadas ni altera sus espacios de color o mipmaps.
La atenuación se implementó y compiló; no se afirma haber eliminado todo el
shimmering durante conducción, porque esa revisión visual sigue pendiente.

### Render targets, cockpit y color

Cinematic aumenta resolución útil de GTAO/SSGI y GTAO a 32 muestras. La GI conserva
6 rayos × 12 pasos de Alto. El límite constante GLSL de AO se amplía junto con la
política; no se promete trabajo extra mediante un uniform que el bucle ignora.
Se mantiene la coordinación existente entre estimaciones de oclusión.

MSAA sólo selecciona muestras presentes en la intersección de soporte de RGBA16F
y DEPTH_COMPONENT24. Cinematic pide hasta 4, con fallback 2 o 0 según capacidades.
No se supone que soportar 4 implique anunciar 2. Las consultas se hacen al preparar
o recrear recursos, no cada fotograma.

El cockpit conserva profundidad interior independiente y ventanas hacia el mundo.
El pase restaura máscaras, visibilidad, fondo, target, cara/mip, viewport, scissor,
sombras y autoClear en `finally`, incluso si falla el callback del mundo. La
restauración respeta el pixel ratio y viewport físico del destino.

El callback de `race-color-grade` sigue incluyendo mundo e interior. Se mantiene
una aplicación de tone mapping/transferencia de salida y el contrato de LUT en
valores de visualización, no en HDR lineal. No se duplica ACES/gamma ni se añade
postprocesado a la interfaz HTML.

### Corrección real del taller: reflexión local no finita

La validación mostró el automóvil negro en SwiftShader. Se reprodujo también en
la publicación original, en Alto, con materiales avanzados desactivados e incluso
con la capa avanzada apagada. El aislamiento descartó AO, recepción de sombras,
callbacks del material y geometría como explicación suficiente. Al quitar el
`envMap` local y conservar el HDRI existente, reapareció el automóvil correctamente.

La prueba de texels encontró valores inválidos en el PMREM del taller. Reconstruir
con cubemap nuevo o con `PMREMGenerator.fromScene` tampoco los eliminó; no se cambió
el método de captura solo por preferencia arquitectónica.

`workshop-probe-guard.mjs` valida el target HalfFloat antes de vincularlo al coche.
Un resultado no finito, una lectura no disponible o un error de captura produce
un fallback explícito al `scene.environment` existente. El target inválido se
libera, los materiales conservan PBR, y no se vuelve a reconstruir cada frame.
La restauración de contexto permite un nuevo intento. El diagnóstico declara
`scene-hdri-fallback` y el motivo; no dice que el reflejo local siga funcionando.
Un PMREM válido sigue siendo propiedad del controlador y se conserva.

En el arranque final registrado, el atlas era 768 × 1024: 786.432 texels,
23.397 componentes RGB no finitos y una lectura de 6.291.456 bytes por validación.
Se registraron dos validaciones durante la preparación; después quedó bloqueado
el reintento automático. El límite absoluto es 1.048.576 píxeles. Es un coste de
reconstrucción esporádica, no por fotograma; no se midió su coste en GPU física.

**Resultado visual verificado:** la captura final del taller muestra nuevamente
pintura naranja, cromados, neumáticos e interior, con el HDRI existente. No se
sustituyó el GLB, no se cambió la exposición para ocultar el defecto y no se añadió
una luz pegada al coche. Esto corrige la salida negra mediante fallback seguro;
no significa que se haya identificado el material/emisor que originó todos los
valores no finitos ni que el cubemap local esté aprobado en ese dispositivo.

## 3. Diferencias entre perfiles efectivos

| Perfil | Escala de efectos | Límite de ancho | GTAO | SSGI |
|---|---:|---:|---:|---:|
| Cinemática / Ultra | 0,625 | 960 px y 518.400 píxeles totales | 32 | 6 rayos × 12 pasos |
| Alto | 0,5 | 768 px | 24 | 6 × 12 |
| Equilibrado | 0,5 | 576 px | 12 | 3 × 8 |
| Bajo | 0,4 | 384 px | 6 | desactivada |
| Apagado | sin capa avanzada | sin targets avanzados | no | no |

La resolución final, la interna del mundo y la de efectos siguen separadas.
Cinematic y Alto parten de escala interna 1; no se fuerza una salida 4K.
Cinematic conserva presupuesto Alto en GI, sombras, vegetación, agua y espejos;
no se multiplican esas partidas simultáneamente. La oclusión BVH sigue opcional,
con sus controles propios, no activada al máximo por el preset.

GTAO usa profundidad visible; SSGI aproxima rebotes de superficies visibles; DFAO
emplea proxies analíticos OBB; la oclusión BVH tiene su sistema separado. Nada se
presenta como GI exacta, path tracing, RTX hardware o DLSS. No se añadió TAA sin
reproyección, grano, bloom, motion blur, aberración ni desenfoque permanente.

## 4. Pruebas ejecutadas

| Verificación | Resultado | Alcance |
|---|---|---|
| Suite previa | 169: 159 pasan, 10 fallan | Línea base antes de editar gráficos |
| Contratos Cinematic finales | **24/24 pasan** | Node; políticas, recursos, materiales, renderer modelado y probe |
| Suite completa final | **193: 183 pasan, 10 fallan** | Los diez nombres coinciden con la línea base |
| Archivos protegidos | **11/11 hashes iguales** | Integridad de fuente, no aprobación funcional integral |
| Grafo literal | 226 archivos, 313 aristas | Sin destinos literales ausentes |
| Shaders, profundidad normal | Pasa en WebGL2 real | Three r180, ANGLE SwiftShader |
| Shaders, profundidad logarítmica | Pasa en WebGL2 real | Incluye transiciones y liberación de targets |
| Taller real | Capturado; fallback corregido y visible | Assets reales, 640 × 360, sin aprobación AAA general |
| Selector del taller frío | Seleccionado/persistido/solicitado = cinematic | Interfaz real, antes de preparar cockpit |
| Conducción/cinco circuitos | **No validado** | El harness agotó espera de inicio; no hay capturas de los siete casos |
| GPU física/móvil | **No medido** | No se infieren FPS por emular viewport |

Node local: v22.16.0. La CI de referencia informó v22.23.2. Los nuevos contratos
cubren normalización, persistencia, límites y recuperación, cadencia activa,
máscaras de pintura, anisotropía, MSAA, recursos, restauración del cockpit y
rechazo/lifecycle del probe. Se observaron pruebas rojas antes de las correcciones.
No se eliminaron ni debilitaron las pruebas previas.

La suite global **no está verde**. Cuatro fallos previos usan mocks de host/inicio
incompletos; otro espera `.local-data/v7/cockpit-layout.json`, ausente en esta copia.
Dos pruebas de ambiente/parabrisas dependen de `../Web/vendor/three.module.js` del
workspace padre, no incluido aquí. Tres fallan en contratos de vitrina/copas:
dimensiones, geometría y transparencia. Los TAP conservan nombres y trazas.

### Ejecuciones de referencia

- `35415902173`: aislamiento antes/después de la base publicada; vehículo negro
  también en la base y con la capa avanzada apagada.
- `35416735604`: shaders válidos; taller/selector frío reales; intento integral
  con gesto de usuario confirmado. Timeout de 240 s, sin errores de JavaScript,
  respuestas HTTP fallidas ni errores de consola registrados; cero casos de pista.
  El timeout no demuestra por sí solo cuál es la causa del bloqueo de inicio.
- `35417124265`: diagnóstico del PMREM; valores inválidos con las tres rutas
  comprobadas (original, cubemap fresco y captura nativa de escena).
- `35417453100`: integración funcional `a1f63870...`, 24 contratos, repetición de
  ambos fixtures WebGL y capturas del vehículo ya corregido mediante fallback.

Las imágenes del fixture técnico usan misma cámara, iluminación, tiempo,
exposición y resolución final al comparar Alto/Cinematic. No son un antes/después
artístico de los cinco circuitos. La comparación del taller identifica por
separado el defecto de reflexión y su fallback, no una supuesta mejora de FPS.

## 5. Mediciones obtenidas

Entorno gráfico: Chromium 143.0.7499.4, WebGL2,
ANGLE Vulkan / SwiftShader Device (Subzero). Es **render por software**, no GPU
física y tampoco un WebGL simulado mediante mocks.

| Fixture técnico | Cinematic | Alto |
|---|---:|---:|
| Resolución final/intermedia de color | 640 × 360 | 640 × 360 |
| Pixel ratio | 1 | 1 |
| Iluminación de pantalla | 400 × 225 | 320 × 180 |
| MSAA HDR aceptado | 4 | 0: el 2 solicitado no estaba anunciado en la intersección |
| Draw calls del cuadro exterior registrado | 13 | 13 |
| Triángulos | 1.532 | 1.532 |
| Geometrías/texturas | 11/11 | 11/11 |

El fixture de cockpit registró 14 draw calls y 1.544 triángulos. Al liberar la capa,
sus tres targets y la textura procedural propia quedan en cero; también se liberan
proxies y propietarios de filtrado. Son datos del fixture, no del paisaje completo.

La captura final del taller con partículas registró 425 draw calls, 953.329
triángulos y 96 puntos. El aislamiento anterior con movimiento reducido registró
422 calls y 952.953 triángulos: no se mezclan ambos escenarios para deducir una
mejora porcentual. Los contadores son los expuestos por `renderer.info.render`
tras la captura, no una descomposición completa del coste de todos los pases.

Se conservan tiempos crudos de compilación/transición en JSON. No se calcula un
p50/p95 de conducción con unos pocos frames heterogéneos de SwiftShader. El
gobernador expone p50/p95/p99, máximo, tirones y trabajo CPU para mediciones
sostenidas posteriores. No se obtuvo tiempo GPU física, benchmark móvil ni una
promesa verificable de 60 FPS.

## 6. Reproducción

En una copia completa de la rama, con sus assets publicados:

```sh
node --test tools/cinematic-*.test.mjs
node --test tools/*.test.mjs
node tools/cinematic-audit.mjs qa-load-graph.json
node --check src/legacy/module-02.mjs
node --check src/legacy/v6-complete-runtime.js
node server.mjs --port 4173
```

La suite completa devuelve actualmente 1 por los diez fallos anteriores. No se
usó ni se inventó un `npm test` raíz. El servidor recibe `--port`, no `PORT`.

QA opcional, en un entorno Python dedicado y otra terminal:

```sh
python -m pip install playwright==1.57.0
python -m playwright install chromium
python tools/cinematic-browser-qa.py --base-url http://127.0.0.1:4173 --output qa-output/fixture
python tools/cinematic-render-diagnosis.py --base-url http://127.0.0.1:4173 --output qa-output/workshop
python tools/cinematic-browser-qa.py --base-url http://127.0.0.1:4173 --output qa-output/full --full-game --skip-fixtures
```

El último comando reproduce un intento de validación integral; no se documenta
como aprobado. Los workflows conservan evidencia incluso ante fallos. Los workflows
transitorios con escritura se eliminaron al aplicar las correcciones; los de QA
que quedan en la entrega usan permisos de lectura y no despliegan.

`cinematic-delivery.yml` exporta el delta exacto de la rama y comprueba, en un
índice Git temporal, que aplicar el parche a la base reproduce el árbol del commit.
El paquete incluye `changed-files.txt`, hashes por archivo, revisión y logs de test.

## 7. Archivos y límites de aceptación

Aplicación: `index.html`; los dos hosts activos en `src/legacy`; gobernador y
warmup; ajustes/política/coordinador de gráficos; materiales y filtrado; iluminación
de pantalla y capacidades de targets; color y pase de cockpit; helpers de
espejos, capturas, DFAO, atmósfera, vegetación, agua y clima; relieve de superficies;
y presentación/guard del probe del taller. El inventario exacto con rutas y hashes
se genera en la entrega; no se sustituyen assets para explicar el resultado.

Se agregan pruebas Node, fixtures WebGL, herramientas de captura/aislamiento,
auditoría de contratos y documentación. `AUDIT.md` contiene la propuesta visual
específica para Dos Lagos, Horcones, Garibaldi, Lipán e Iguazú. Es una **propuesta**,
no una nueva calibración de cada circuito ya aprobada.

Faltan imágenes emparejadas de todos los circuitos, cielo/clima/vehículo/cámara y
exposición constantes: día, atardecer, noche, lluvia, niebla y nieve permitida,
cockpit/exterior y taller. También falta validar conducción, pausa, recuperación,
multitáctil, espejos reales y guardados en dispositivos físicos y medir p50/p95/GPU
con recorridos sostenidos. No se aumentó resolución de sombras o cubemaps ni se
afirma una mejora medida en esas partidas.

La revisión de código fue del mismo implementador, no una segunda revisión
independiente. La rama se deja sin merge ni despliegue: **base Cinematic funcional
implementada, corrección real de materialidad del taller comprobada, aceptación
artística y funcional integral todavía pendiente**.
