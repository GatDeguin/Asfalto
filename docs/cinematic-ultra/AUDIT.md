# Auditoría de integración — Cinematic Ultra

Base: `GatDeguin/Asfalto`, publicación `gh-pages`, commit
`045cd8b7d206418a26d7a75666e557a7e124377a`. `main` era anterior;
no se usa como base ni se sustituye la publicación. Three embebido: **r180**.

## Grafo de carga efectivo

`index.html` carga los runtimes v6 de física, Rapier, recuperación y entrada;
también carga `src/legacy/module-02.mjs` como módulo y
`src/legacy/v6-complete-runtime.js` como script. **Ambos legacy están activos**.

La rama de carrera es:

```text
index.html
  -> src/legacy/module-02.mjs
     -> src/app/modular-bootstrap.mjs / connectModularHost
        -> host modular, gestor y adaptadores de los cinco circuitos
     -> advanced-graphics-settings (registro temprano del selector)
     -> track-performance-governor (propietario de la carrera)
     -> advanced-graphics
        -> advanced-materials, pivot-painter, distance-field-occlusion
        -> physical-atmosphere, screen-space-lighting, surface-relief
     -> cockpit-render-pass y race-color-grade
```

La rama del taller es:

```text
index.html -> src/legacy/v6-complete-runtime.js -> workshop.initScene
  -> manifiesto workshop-bootstrap / Three y GLB existentes
  -> workshop-presentation, vehicle-presentation, selección e inspección
  -> ray-traced-occlusion (opcional, preferencia separada)
  -> advanced-graphics (propietario del gobernador del taller)
  -> workshop.loop: actualización visual y render
```

Los módulos Three se obtienen mediante los manifiestos/gzip/blob existentes;
no se añade una segunda versión CDN ni un paquete de aplicación.
`node tools/cinematic-audit.mjs qa-load-graph.json` registra **226 archivos
alcanzables y 313 aristas literales**, sin destinos literales ausentes en la copia
revisada. Este inventario no pretende descubrir por sí solo los imports construidos
con `new URL`, ni demostrar que se ejecutó cada rama: las dos cadenas anteriores
se comprobaron además leyendo los puntos de integración.

## Responsabilidades conservadas y cambios

| Área | Responsabilidad / intervención |
|---|---|
| advanced-graphics-settings | Normalizar, persistir y emitir `asfalto:advanced-graphics`; Cinematic es válido, no modifica el valor Equilibrado por defecto. Un único propietario del selector atiende taller frío y carrera. |
| advanced-graphics | Compone subsistemas existentes. Distingue solicitud, límite y calidad efectiva; el taller mide intervalos reales, no el dt de animación recortado. |
| track-performance-governor / render-warmup | Cinematic explícito, techo automático Alto, histéresis y preparación de variantes sin cambiar la simulación. |
| advanced-materials | Identidad, mapas y hooks preservados; escala métrica y atenuación por footprint; roles asfalto, caucho y vinilo. La máscara de pintura Chevy protege su atlas compartido. |
| screen-space-lighting | GTAO de profundidad y SSGI aproximada visible en pantalla; resolución acotada, AO 32, GI 6×12; composición con DFAO ya existente. |
| distance-field-occlusion | Proxies analíticos OBB, no distancia exacta a toda la escena; Cinematic conserva presupuesto Alto. |
| physical-atmosphere | Dispersión simple y extinción por altura existentes; mismo presupuesto Alto, sin densificar clima o alterar noche. |
| pivot-painter | Jerarquía tronco/rama/hoja, alfa y deformación de sombras existentes; Cinematic se mapea explícitamente a Alto. |
| ray-traced-occlusion | BVH opcional con modos propios y workers; no se activa automáticamente ni se presenta como RTX/path tracing. Archivo sin cambios. |
| surface-relief | POM/PDO existentes, máximo 24 pasos y atenuación hasta 95 m; no se cambia geometría ni soporte físico. |
| track-material-controller | Respuesta visual a ambiente/superficie; archivo y estado físico sin cambios. |
| environment-profiles / race-lighting | Elección explícita de cielo y clima, paletas y soporte de luz preservados. |
| race-day-cycle / hdri-transition | Cielo fijo y ciclo de 12 minutos preservados; mezcla de HDRI/PMREM existente, no nueva convolución por frame. |
| chevy-paint-controller / vehicle-lighting | Conservan referencias de pintura, calibraciones, faros y animaciones; no se sustituyen. |
| cockpit-render-pass | Mantiene profundidad interior separada y restaura estados en `finally`, incluso si falla la captura del mundo. |
| cockpit-mirrors / auxiliary-capture-schedule | Cámaras y restauración existentes, presupuesto Alto explícito en Cinematic; no postprocesado recursivo. |
| water-scene-reflection | Agua especial y reflejos existentes, mismo presupuesto Alto; no conversión a material genérico. |
| race-color-grade | LUT en espacio de visualización después del tone mapping; sólo se modifica asignación segura de MSAA y ciclo de recursos. |
| vehicle-camera-rig | Cámaras, lentes y calibraciones sin cambios. |

## Calidad y límites

| Perfil efectivo | Escala de efectos | Ancho máximo de efectos | GTAO | SSGI |
|---|---:|---:|---:|---:|
| Cinematic | 0,625 | 960 px y 518.400 píxeles totales | 32 | 6 rayos × 12 pasos |
| Alto | 0,5 | 768 px | 24 | 6 × 12 |
| Equilibrado | 0,5 | 576 px | 12 | 3 × 8 |
| Bajo | 0,4 | 384 px | 6 | desactivada |
| Apagado | sin capa avanzada | sin targets avanzados | no | no |

La resolución final y la resolución interna del mundo siguen la política previa;
Cinematic y Alto parten de escala interna 1. No se fuerza salida 4K.
Cinematic pide hasta 4 muestras de MSAA únicamente si coinciden los soportes de
RGBA16F y DEPTH_COMPONENT24; fallback 2 o 0 según la intersección comprobada.
El filtrado anisotrópico Cinematic tiene tope 8 y respeta capacidades y valores
autorizados mayores; no se cambian ni se destruyen texturas prestadas.

La reducción se evalúa con una ventana de 240 muestras y p95; la recuperación
requiere 600. La recuperación Alto → Cinematic admite 16,7 ms a 60 Hz, no el umbral
imposible de 16 ms con sincronización de 60 Hz. Un límite base Equilibrado o Eco
se respeta aunque la solicitud avanzada sea Cinematic. Auto nunca llega a Cinematic.
El detalle lejano/streaming físico recibe la familia Alto, no un tier desconocido.
El actualizador procedural legado también reconoce Cinematic: conserva la misma
cadencia de Alto; Equilibrado mantiene su actualización alternada.

## Contratos de color y cámara

En carrera, `race-color-grade.render(callback)` envuelve mundo **e interior**.
Dentro del callback, el pase de cockpit oculta el interior, renderiza el mundo
con iluminación de pantalla, limpia sólo profundidad y renderiza el interior
con sus capas. La profundidad del mundo nunca se reutiliza para aplicar AO al tablero.

Los targets HDR intermedios r180 permanecen lineales; el grade realiza tone mapping,
transferencia a visualización y LUT una vez. Con grade neutro se conserva la ruta
normal del renderer. No se introduce bloom, grano, aberración, desenfoque permanente,
TAA sin reproyección ni ningún filtro sobre la interfaz HTML.

## Dirección por circuito: propuesta, no aprobación artística

| Circuito | Dirección de refinamiento sin cambiar geografía |
|---|---|
| Dos Lagos | Separación de bosque/cielo/carretera; hojas filtradas y agua propia, sin añadir vegetación que tape curvas. |
| Aconcagua · Horcones | Microdetalle mineral contenido y grandes masas legibles; conservar estratos, paleta y silueta sin niebla adicional. |
| Paso Garibaldi | Rugosidad residual en mojado y transiciones del clima existente; nieve sólo donde el perfil ya la permite. |
| Cuesta de Lipán | Estratos y borde vial nítidos, variación cromática contenida y suelo seco existente. |
| Cataratas del Iguazú | Translucencia y movimiento vegetal existentes a presupuesto Alto; agua y bruma ligadas a emisores actuales. |

El código mejora materialidad y precisión de forma transversal. No se declara una
nueva dirección de iluminación calibrada individualmente ni aprobación visual AAA
por circuito; eso requiere las capturas y revisión descritas en REPORT.md.

## Integridad

`protected-baseline.json` y el auditor comprueban igualdad byte a byte de once
archivos protegidos: runtimes físicos/entrada/recuperación, condiciones de suelo,
cámaras, controlador de pintura, materiales ambientales, perfiles y ciclo temporal.
Esto demuestra ausencia de edición en esos archivos; **no sustituye una prueba
funcional completa** de conducción, multitáctil, pausa, taller y recuperación.
No hay GLB, manifiestos, atribuciones, trazados o colisionadores sustituidos.
