# Fluidez y óptica del agua en Asfalto Nacional

Asfalto ejecuta Three r180 sobre WebGL2 y mantiene la física del auto en Rapier a 120 Hz. Las muestras de referencia corresponden a Chrome 157 con ANGLE/D3D11, GeForce RTX 3060 Ti y un viewport de 1280 × 800 a DPR 1. La resolución de escena de Auto en Bajo es 896 × 560.

## Revisión de Screen Space Fluid Rendering for Games

La presentación de Simon Green en GDC 2010 parte de partículas que deben parecer un volumen continuo. En Asfalto, la orilla, el lecho y las cortinas de cascada ya tienen geometría. Las decisiones siguientes distinguen esos dos casos. Los números son páginas del PDF. [Presentación completa](https://developer.download.nvidia.com/presentations/2010/gdc/Direct3D_Effects.pdf)

| Propuesta | Decisión para el juego |
| --- | --- |
| Direct3D 11 y DirectCompute para simulación, ordenamiento, búsqueda e índices espaciales, págs. 4–5 | Conservar WebGL2 y los dueños de los datos existentes. Rapier determina la conducción. La hidrología calcula campos en un worker. La API del ejemplo no se traslada al navegador. |
| Métodos euleriano, lagrangiano y de campo de alturas, págs. 5–7 | Mantener los lagos y ríos sobre geometría y campos de profundidad. El spray de neumáticos y cascadas ya usa lotes acotados de partículas. Una rejilla volumétrica o un solver SPH queda fuera del recorrido de conducción. |
| Marching cubes como reconstrucción de malla a partir de densidad, pág. 8 | Omitir. Sustituir la geometría entregada por una isosuperficie por cuadro añade coste y puede desplazar la silueta de la orilla. |
| Profundidad de esferas proyectadas como sprites y superficie más cercana a cámara, págs. 9–16 | Evaluar únicamente para una masa de spray densa, cercana y continua. El spray disperso funciona como partículas transparentes. Convertirlo en una superficie sólida cambiaría su lectura. |
| Posición y normales desde profundidad, con diferencias que evitan cruzar discontinuidades, págs. 17–19 | Mantener las normales de la malla y las derivadas de las ondas actuales. La reconstrucción desde profundidad tendría sentido sólo si se introduce una superficie de partículas. |
| Gaussiano en unidades del mundo y radio máximo en pantalla, págs. 20–24 | Mantener el detalle de onda según distancia. En un futuro búfer de fluido, el radio debe quedar acotado en píxeles y ser estable al acercar la cámara. |
| Bilateral para preservar bordes y aproximación separable en dos pasadas, págs. 25–31 | Omitir para el agua de malla. Probar la aproximación sólo si existe un búfer real de profundidad de partículas y compararla con bordes de orilla, auto y fondo. |
| Iluminación difusa, difusa envolvente y brillo Blinn–Phong, págs. 32–38 | Conservar la iluminación física del material y el HDR del entorno. El sombreado de ejemplo ilustra cómo reutilizar la normal reconstruida. |
| Fresnel de Schlick y reflexión de entorno, págs. 39–43 | Mantener el Fresnel del shader. Asfalto combina reflejo planar de la ribera visible con HDR de respaldo fuera de la captura. |
| Espesor aproximado con splats aditivos y un búfer de menor resolución, págs. 44–46 | Reutilizar el campo de profundidad existente para el agua de malla. El búfer de splats sería un coste adicional justificado sólo por un volumen de partículas. |
| Absorción según longitud recorrida y coeficientes por color, págs. 47–48 | Aplicado al tinte del agua. A partir de la profundidad vertical y el índice 1,333 se estima el camino refractado antes de la absorción exponencial. El tinte usa colores calibrados por material y el transporte de Three conserva sus parámetros de atenuación. |
| Refracción desplazando la imagen de fondo y composición con profundidad, págs. 11–12 y 49–51 | Mantener la transmisión del agua donde el nivel gráfico la admite y el Z de la geometría en todos los niveles. En Bajo, la transparencia de los vidrios del auto se resuelve con mezcla alfa y el material iluminado. |
| Sombras de color renderizando desde la luz y proyectando profundidad y espesor, págs. 52–56 | Omitir durante la conducción. Es otro render de la superficie y su beneficio depende de que se vea un receptor bajo el agua. |
| Capas ocultas, múltiples reflexiones y refracciones por rayos, págs. 57–58 | Conservar la captura planar y el respaldo HDR. La propuesta de rayos explica el límite de las capas visibles de una representación en espacio de pantalla. |
| Cáusticas mediante rayos refractados hacia el suelo y splats aditivos, págs. 59–65 | Omitir en carrera. Una prueba futura tendría sentido en un encuadre existente que muestre un lecho iluminado y medible. Las cáusticas del ejemplo afectan al receptor, no a la superficie del fluido. |
| Dispersión cromática repitiendo el pase, pág. 65 | Omitir. Añade pasadas para separar los colores y el efecto quedaría concentrado en el lecho. |
| Ruido en espacio de objeto transportado con el flujo para perturbar la normal, págs. 66–70 | Aprovechar la advección y el detalle procedural existentes en ondas y cascadas. Evitar una textura intermedia de ruido para las superficies actuales. |
| Compute para filtro y colisión por BVH como trabajo futuro, pág. 72 | Mantener los índices y las consultas que ya pertenecen a la física y al render. La presentación los propone como extensiones y su coste requiere una medición independiente. |
| Spray, espuma y mapas de mojado como trabajo futuro, pág. 72 | Mantener los emisores acotados, la espuma de impacto y el mojado ligado al clima y al contacto de rueda. Son sistemas ya presentes en Asfalto. |

## Coste de los datos y del cuadro

Separar los consumidores del estado permitió conservar el historial del fantasma y copiarlo sólo al consultar una captura. Antes, 120 publicaciones con 4.000 muestras visitaban 480.000 propiedades de muestras en la prueba instrumentada. El HUD oculto deja de consultar y dibujar ese historial. Los registros de fin de actividad conservan su guardado.

En el render, los nodos de terreno estáticos vuelven a calcular matrices al mover su raíz o cambiarla de padre. Las preparaciones pendientes de los retrovisores se invalidan al cambiar de cámara. El nivel Bajo reúne los materiales refractivos del vehículo una vez y aplica su variante al cambiar de nivel. Los niveles superiores y el taller mantienen los materiales refractivos de origen. [Game Engine Architecture](https://gameenginebook.com/) · [Data-Oriented Design Resources](https://github.com/dbartolini/data-oriented-design)

En Iguazú, los lotes de vegetación comparten geometría y material. Los bloques espaciales de matrices en un búfer contiguo permiten seleccionar una vista antes de que Three suba los datos a la GPU. Cada cámara, incluidos los pases auxiliares, obtiene su selección. Los detalles de ribera mantienen su distancia de visibilidad original. Los sectores de suelo agrupan 545 mallas en 102 lotes tras el tallado del valle de regreso, conservando atributos, índices de triángulos y materiales. El GLB de colisión sigue siendo independiente. [Stefan Reinalter sobre datos de mallas estáticas](https://blog.molecular-matters.com/2011/11/03/adventures-in-data-oriented-design-part-1-mesh-data-3/)

Auto a 60 FPS empieza en Bajo y recupera detalle tras 30 s de ventanas sanas con margen de cadencia, CPU y GPU. Sin consultas GPU fiables, mantiene el nivel inicial. La variante de vidrio en Bajo conserva brillo y transparencia, con una apariencia algo más transparente en la prueba exterior.

## Mediciones de referencia

| Pasada en Iguazú bajo lluvia | Cuadros de escena por segundo | GPU p95 | Llamadas de dibujo |
| --- | ---: | ---: | ---: |
| Antes de agrupar | 18,56 | 34,99 ms | 1.776 |
| Vegetación agrupada | 44,53 | 15,82 ms | 1.483 |
| Ribera agrupada | 56,55 | 10,44 ms | 810 |
| Terreno agrupado | 59,45 | 8,81 ms | 404 |

Cada pasada mide diez segundos de conducción real con teclado, cámara exterior y Auto en Bajo. En la última ventana, el p95 de `requestAnimationFrame` fue 16,8 ms, con un máximo aislado de 66,7 ms. El tiempo de entrada varió entre pasadas y quedó fuera de esas ventanas. Las capturas de la misma zona muestran las líneas de la calzada, la vegetación y el relieve presentes tras la agrupación.

El paquete de render se probó en una pasada secuencial por los cinco circuitos, con movimiento reducido. En cada uno se condujo, pausó, reanudó y regresó al taller. El p95 de cadencia fue de 16,8 ms en los cinco y no se registraron tareas largas en las ventanas de medición. La entrada desde el taller tardó entre 17,15 y 28,46 segundos en esa pasada local.

| Circuito y clima | FPS de escena | GPU p95 | Peor intervalo rAF |
| --- | ---: | ---: | ---: |
| Dos Lagos, despejado | 59,72 | 12,92 ms | 33,4 ms |
| Aconcagua, despejado | 58,63 | 10,30 ms | 33,4 ms |
| Cuesta de Lipán, nieve ligera | 60,09 | 8,85 ms | 16,9 ms |
| Paso Garibaldi, nieve ligera | 58,35 | 10,44 ms | 33,5 ms |
| Cataratas del Iguazú, lluvia | 60,13 | 7,67 ms | 16,9 ms |

En salidas en frío independientes a Aconcagua, la versión anterior tardó 44,68 s hasta poder conducir y promedió 43,85 FPS en los primeros diez segundos medidos. Con el arranque directo, dos repeticiones tardaron 36,58 y 39,17 s y dieron 46,55 y 58,79 FPS. La variación en frío queda fuera de las cifras de la pasada secuencial.

En Dos Lagos, una pasada anterior en Alto fijo dio 34,52 FPS en cabina y 41,79 FPS en persecución al conducir. Con Auto y la variante de vidrio, otra pasada alcanzó 59,57 FPS en cabina, 60,17 en persecución en movimiento y 59,64 con lluvia nocturna. La comparación entre estas dos configuraciones incluye un cambio de resolución y de calidad. En un corte de seis cuadros de persecución con el mismo nivel, el pase de transmisión pasó de 2.822 llamadas adicionales a cero y el p95 de GPU bajó de 11,74 a 9,64 ms.

Se ejecutó RenderDoc 1.47 con un Chrome aislado en ANGLE/D3D11. La variante de GPU en proceso cerró el objetivo y la de proceso separado perdió la conexión de depuración antes de capturar. El equipo carecía de Nsight Graphics. Las mediciones registradas proceden de Chrome DevTools Protocol, contadores del motor y consultas de tiempo WebGL2. [RenderDoc 1.47](https://github.com/baldurk/renderdoc/releases/tag/v1.47) · [Captura de ANGLE con RenderDoc](https://github.com/google/angle/blob/main/doc/DebuggingTips.md#running-angle-under-renderdoc) · [Nsight Graphics](https://docs.nvidia.com/nsight-graphics/UserGuide/)

## Perfilado del Sprint de Dos Lagos

Nsight Systems 2026.6.1 registró 2.232 llamadas a `Present1` y 1.108 a `D3DCompile` durante la sesión de Chrome sobre D3D11. Son eventos de API en la línea temporal. Windows deshabilitó WDDM por permisos y el controlador denegó acceso a contadores de hardware. Otra prueba de RenderDoc con ANGLE/OpenGL perdió la conexión antes de capturar un cuadro del juego. [Nsight Systems para Windows](https://docs.nvidia.com/nsight-systems/UserGuide/#system-wide-api-trace-on-windows) · [Permisos de contadores NVIDIA](https://developer.nvidia.com/ERR_NVGPUCTRPERM)

La instrumentación WebGL encontró cuatro mapas de roca y dos de vegetación subidos en el mismo cuadro cerca del metro 57. La precarga de los seis mapas trasladó las subidas a la pantalla de carga y produjo resultados de cadencia dispares. La solución integrada comparte los 21 mapas de la ida con el tramo de regreso. La raíz visual del circuito conserva la propiedad de las texturas y cada tramo mantiene sus propios metadatos. [Gestión de recursos y bucle de juego en la tercera edición de Jason Gregory](https://www.oreilly.com/library/view/game-engine-architecture/9781351974271/) · [Datos de mallas de Stefan Reinalter](https://blog.molecular-matters.com/2011/11/03/adventures-in-data-oriented-design-part-1-mesh-data-3/)

La auditoría de la escena confirmó que los propietarios pasaron de 42 a 21 objetos de textura. El navegador pidió los mismos 21 archivos en ambos casos. En ventanas de 18 s sin perfilador, los tres controles registraron saltos de 133–150 ms. Las dos pasadas con mapas compartidos quedaron por debajo de 75 ms. La cadencia varió de 41,7 a 52,7 FPS en los controles y de 44,0 a 52,8 FPS con la corrección.

El atlas de franjas del Falcon se prepara al cargar el rival. La captura de referencia registró una subida de 14,2 ms durante la carrera. Con el cambio se registró una sola subida de 19,1 ms durante la carga y ninguna durante los 78 s observados en tiempo real. Esa pasada promedió 41,6 FPS entre la primera y la última muestra y tuvo un salto de 83,3 ms.

Después de la ventana en tiempo real, el piloto de QA completó la vuelta de 22,7 km con pasos físicos de Rapier a 120 Hz, sin teletransportes ni recuperaciones. Se verificaron la clasificación, el regreso al taller y la persistencia del resultado tras recargar. La etapa de física acelerada se usa para validar el recorrido y se excluye de las cifras de cadencia. El aviso de guardado de la ficha de resultado pasó de 1,22 a 11,84 de contraste en las comprobaciones de 1280 y 390 píxeles de ancho. [Contraste mínimo del texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

Sprint y Viaje muestran «Sin dato» en la consistencia mientras la actividad carece de una medición.

Las consultas GPU en 137 cuadros muestreados dieron 8,25 ms p95 para la captura principal del mundo, 5,64 ms para el reflejo de ribera y 5,28 ms para el retrovisor interior. Cada auxiliar se mide sólo en los cuadros en los que se ejecuta, por lo que esos percentiles se leen por separado. La suma de los renderizados medidos dio un p95 de 16,72 ms por cuadro muestreado y excluye comandos sin consulta.

### Ensayos de geometría del terreno

Se midieron los primeros 20 segundos conducidos del Sprint en cabina, entre unos 8 y 226 m. El perfilador leyó consultas GPU de WebGL2 aproximadamente cada nueve cuadros y contó los triángulos y envíos de Three en la captura principal del mundo. Los FPS corresponden a cuadros de escena enviados entre la primera y la última muestra. Tres controles en sesiones aisladas muestran la variación de esa medida.

| Variante | Triángulos del terreno por captura | Envíos de Three | GPU mundo p95 | FPS medios |
| --- | ---: | ---: | ---: | ---: |
| Publicada, tres pasadas | 545.713 | 18 | 9,24–10,34 ms | 49,23–57,90 |
| Sectores de 1.024 m, dos pasadas | 465.850–465.866 | 89,7–89,8 | 10,50–11,60 ms | 45,66–50,78 |
| Sectores de 2.048 m | 470.244 | 38,1 | 9,57 ms | 52,80 |
| Sectores de 4.096 m | 477.793 | 24,6 | 10,36 ms | 46,58 |
| Sectores de 1.024 m agrupados con `WEBGL_multi_draw`, segunda pasada | 465.908 | 18 | 9,82 ms | 53,50 |
| Mismo terreno con índices de la grilla de regreso ordenados en bloques de 8 × 8 | 545.713 | 18 | 9,73 ms | 51,39 |

La división fina conservó triángulos, normales, UV y materiales. Al pasar de 18 a unos 90 envíos, ambas pasadas empeoraron el tiempo GPU del mundo. Los ensayos con agrupamiento y los de sectores más grandes carecen de una mejora repetida sobre la referencia. El reordenamiento conservó la geometría y el número de envíos. Sus cifras quedaron dentro de la variación del control y registró un salto de 167 ms. Se retiraron los prototipos del juego. Los contadores de hardware serían necesarios para atribuir un resultado a reutilización de vértices. [Rendimiento de la tubería gráfica de NVIDIA](https://developer.nvidia.com/gpugems/gpugems/part-v-performance-and-practicalities/chapter-28-graphics-pipeline-performance) · [Recursos de diseño orientado a datos](https://github.com/dbartolini/data-oriented-design)

### Preparación compartida de retrovisores

Three r180 compila los programas de ambos retrovisores con la misma escena, estado del renderizador y capas de cámara. La preparación usa un solo pase mientras coincida esa configuración. Cada espejo conserva su cámara, textura, resolución y frecuencia de actualización. Si las capas difieren, se preparan ambos pases antes de mostrar los reflejos.

En los dos controles de 25 s, el espejo izquierdo recibió 1.866 llamadas nativas de preparación en cada ventana de conducción. Con el cambio recibió cero en las dos pasadas. Los dos reflejos estuvieron disponibles a los 18–22 ms desde el inicio de la medición, frente a 5,29–6,14 s en los controles. Las capturas muestran la ruta en ambos espejos. Los promedios de 49,23–56,04 FPS de los controles y 50,25 FPS de la pasada comparable con el cambio no acreditan una mejora de la cadencia general.

La repetición de 78 s en calidad Baja cruzó el minuto con el cielo pasando de nublado a despejado y siguió conduciendo al iniciarse la transición a hora dorada. Promedió 56,20 FPS y no registró bloqueos, errores de navegador ni saltos de presentación superiores a 75 ms. El taller volvió a estar disponible 85 ms después de pulsar el botón. Esta ventana corresponde a un tramo inicial del Sprint en este equipo, con un ciclo de cielo configurado a 360 s. La suma de las consultas GPU por cuadro alcanzó 17,39 ms p95 en 488 cuadros muestreados. Los dos renderizados que escriben en `ASFALTO_COLOR_HDR` sumaron 5,05 ms p95 dentro de esa muestra.

### Recorrido de escena en el pase de cabina

El pase interior conserva sus capas, luces y profundidad. Al cambiar la jerarquía de la escena se identifican los grupos sin objetos de cabina, guías del editor ni luces. Se omite la visita a esos grupos durante el dibujo interior y se restaura su visibilidad al salir, incluso si el renderizador falla. La vista exterior sigue dibujando el mundo completo.

En dos controles y dos pruebas alternadas de 25 s en Dos Lagos, el p95 de GPU del pase interior fue de 6,77–7,33 ms en los controles y 4,79–5,54 ms con la poda. El tiempo medio de CPU dentro de la llamada de renderizado interior fue de 3,70–3,74 ms y 3,23–3,41 ms, respectivamente. Los cuadros de escena enviados pasaron de 47,30–48,12 FPS a 52,38–57,16 FPS en esas cuatro ventanas instrumentadas. Las capturas del mismo tramo muestran el tablero, la ruta y ambos reflejos. Las pruebas cubren una luz que se añade o retira dentro de un grupo, visibilidad previa y restauración tras una excepción.

## Regresiones corregidas

- En la primera salida a Iguazú se pedía antes el GLB de Dos Lagos, de 24,2 MB. El arranque utiliza ahora la escena seleccionada. En una sesión aislada con el mismo perfilador, la entrada bajó de 27,70 a 19,54 segundos. Al simular un HTTP 503 en la primera petición, el juego preparó Dos Lagos como respaldo, recuperó la selección de Iguazú y permitió conducir. Cancelar con el GLB retenido devolvió el control al taller. Tras completar la carga pendiente, una nueva salida a Dos Lagos se inició correctamente.
- La proyección física en Dos Lagos saltaba a un segmento incorrecto junto a un límite de la rejilla. La búsqueda ahora amplía el perímetro hasta demostrar cuál es el tramo más cercano. El 0–100 completó la medición con teclado y guardó un único recibo a 120 Hz. La ficha muestra la marca oficial de 14,508 s y distingue la duración del intento. El recibo reapareció tras recargar.
- En el HUD vertical del móvil, el estado de aceite y la temperatura ocupaban una fila que recortaba el segundo valor. Ahora se muestran en dos líneas. En la emulación de iPhone 13 en Chromium se comprobaron ambos valores visibles, la liberación del pedal tras cancelar el toque y veinte ciclos de pausa y reanudación.

## Comprobaciones reproducibles

- Ejecutar `node --test` con los archivos `tools/*.test.mjs` según el shell. Pasaron las 359 pruebas locales, incluidas proyección física, historial, arranque, ciclo de vida de espejos, selección por cámara, superficies agrupadas y restauración de materiales.
- Configurar `PLAYWRIGHT_PACKAGE` si Playwright está fuera de la raíz y `CHROME_PATH` para indicar el Chrome de prueba. Ejecutar `node tools/roadtest-browser.mjs <directorio-de-evidencia>`. El 0–100 usa teclado, movimiento reducido y un perfil aislado. Verifica pausa, resultado y persistencia tras recargar.
- Ejecutar `node tools/track-drive-browser.mjs <directorio-de-evidencia> [circuito] [--draw-detail]` con el mismo entorno. Abre los circuitos desde el taller y comprueba aceleración, pausa, reanudación y regreso. Al elegir un circuito, comprueba también que su escena sea la única solicitada en la primera salida. Guarda cadencia, GPU, tareas largas, preparación de shaders y capturas.
- Ejecutar `node tools/water-optics.gpu.mjs <archivo-json>`. La prueba lee la absorción del fragmento en WebGL. A 2 m obtiene 0,275 perpendicular y 0,380 rasante, con cero en la orilla de profundidad cero y una llamada de dibujo en cada muestra.

El benchmark separa cuadros de escena enviados, intervalos de `requestAnimationFrame`, consultas de tiempo de GPU y tareas del hilo principal. La validación cubre este equipo y los tramos recorridos. Quedan por medir vueltas completas, otros motores de navegador y dispositivos físicos.
