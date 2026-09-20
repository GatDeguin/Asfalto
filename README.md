# Asfalto Nacional v8

Juego: https://gatdeguin.github.io/Asfalto/

Correcciones de estabilidad y mediciones: [informe v8](docs/release-v8-stability.md).

## Integración de vehículos y cockpits — 19/09/2026

Esta carpeta es la base v8. Incluye Chevy 250, Chevy 250 SS Serie 2, Chevrolet 400, Bel Air 1957 y Chevrolet 3100. Se conservaron los exteriores actualizados de la v8 del Chevy/400; el interior detallado del 400 se extrajo por separado del trabajo anterior.

Los interiores propios del 400, Bel Air y pickup incluyen instrumentos animados, volante, espejos, limpiaparabrisas ajustados a cada vidrio, radio, contacto, luces y palanca reutilizando los controles funcionales. Bel Air/pickup suman caras de instrumentos legibles y conservan los mapas de relieve originales de la tapicería. En móvil se muestran gas/freno a la derecha y se conserva el volante del auto como mando táctil.

Verificación y límites: informe `../Reports/Asfalto_Nacional_v8/cockpit-integration-2026-09-19/INTEGRACION.md`. Las pruebas móviles son emulación en Chrome, no una certificación sobre iPhone físico. Los vehículos conservan el sistema de física de esta base; no se incorporaron nuevas simulaciones específicas de chasis.

El manual siguiente corresponde a la base recibida y conserva sus instrucciones originales.


Juego completo con cinco circuitos, taller, cockpit, audio y efectos. El ciclo día/noche dura 12 minutos.

La primera carga descarga modelos, música y texturas de alta resolución. Los cambios de taller, cockpit e iluminación se conservan en el navegador de cada jugador; no se escriben archivos en el servidor. La calibración inicial de cabina y los 12 presets de iluminación se incluyen en assets/configuration.

Publicación: Settings → Pages → Deploy from a branch → gh-pages → / (root). El archivo .nojekyll permite servir los módulos y recursos tal como están. Para ejecutar una copia local, usar INICIAR_JUEGO.bat o node server.mjs.

Las licencias y atribuciones de dependencias y materiales permanecen junto a sus archivos. Esta publicación no cambia sus licencias.

---

# Asfalto Nacional v6

Versión web modular de **El Juego**, con las físicas v6 y las funciones de menú, carrera, cockpit, radio, audio, cámaras y taller. Incluye cinco circuitos jugables: Dos Lagos, Aconcagua · Horcones, Paso Garibaldi, Cuesta de Lipán y Cataratas del Iguazú. El cielo/momento del día y el clima se eligen por separado.

## Iniciar en Windows

Ejecutá `INICIAR_JUEGO.bat`. El launcher busca Node.js, elige el primer puerto libre entre 4173 y 4183, espera al servidor local y abre el juego en `http://127.0.0.1`. No abras `index.html` directamente: las restricciones de los navegadores impiden cargar correctamente GLB, audio y HDRI mediante `file:`.

Para cerrar el servidor, volvé a la consola del launcher y presioná `Ctrl+C`.

## Controles

El menú principal presenta la Chevy en el taller 3D. Elegí **Conducir**, **Pruebas**, **Competencia**, **Taller**, **Colección** o **Ajustes** para abrir sus controles. `Esc` abre la pausa durante la carrera: continuar, reiniciar, ajustes o volver al taller. Conducir requiere pulsar la acción de inicio de la sesión. En Taller → Fotografía podés arrastrar la vista, ajustar la cámara y descargar una imagen.

La intro se reproduce automáticamente al iniciar el juego y **Ver intro** permite repetirla. Incluye nueve planos de Google Flow/Veo y la canción `Canciones/Intro.mp3`, mezclada con el ambiente existente, entrada y salida suaves. Se puede saltar con `Esc`. Si el navegador bloquea el sonido automático, empieza silenciada y ofrece **Activar sonido**. La reproducción se detiene completamente al salir.

Activar el sonido durante la reproducción conserva la intro completa. Cambiar de pestaña la pausa y volver continúa desde el mismo punto. Las cargas del inicio, taller y circuito muestran una aguja de tacómetro y marcas de ruta animadas, con la etapa que se está preparando; respetan la opción de movimiento reducido. El taller limita la cámara al interior del piso y las paredes del modelo, incluso con zoom, vistas predefinidas y desplazamientos del editor, dejando margen para el plano cercano de la lente.

La entrega tiene 40 segundos a 1080p/24 fps, ampliados desde clips de 720p. La mezcla final de la canción y el MP4 se realizaron con FFmpeg; el proyecto de REAPER queda actualizado para edición. Las imágenes interpretan los vehículos y paisajes y no son capturas exactas del juego. El taller y el menú alternan `Menu 1.mp3` y `Menu 2.mp3`. Al regresar de una carrera, la canción actual empieza desde cero; al cambiar de sección del menú conserva la reproducción. Motor y radio se silencian al volver al menú o pausar.

La película está en `assets/intro/cinematic.mp4`; la animática anterior se conserva en `assets/intro/animatic.mp4`. El proyecto editable de REAPER, el guion, los storyboards y los cinco componentes modelados en Blender están en `../Produccion/Intro_Menu_2026-09-05/`. Los controles del menú usan renders PNG de esos componentes; sus GLB y el archivo `.blend` se conservan para reutilización.

- Pedales: teclado (`W`/flecha arriba para acelerar, `S`/flecha abajo para frenar) o controles táctiles.
- Volante: teclado, arrastre directo con mouse sobre el volante o gesto táctil.
- Cambios manuales: teclado y palanca interactiva con mouse/táctil.
- Radio y cockpit: los mandos se pueden operar simultáneamente con mouse o tacto mientras los pedales permanecen en el teclado.
- Cámaras, pausa, recuperación y ayudas conservan los atajos mostrados dentro del juego.

En pantallas táctiles podés mantener volante y acelerador con dedos distintos. El botón de pausa aparece junto al selector de cámara; al pausar se liberan los controles. El regreso al taller y el cierre del editor permanecen accesibles en vertical y horizontal. Para conducir con más espacio visible, se recomienda la orientación horizontal.

El gobernador gráfico usa los niveles Alto, Equilibrado y Bajo. Sólo adapta resolución, sombras, vegetación, espejo y precarga visual; la física continúa fija a 120 Hz. El diagnóstico de QA está disponible con `?qa=1` en `window.__ASFALTO_V6_DIAGNOSTICS__`.

Si AudioWorklet no está disponible, el juego usa automáticamente el sintetizador de audio de respaldo; no bloquea la carrera.

## Cielo / momento del día y clima

Los seis cielos proceden de los HDRI de `Cielos`: Día despejado, Día nublado, Tarde dorada, Atardecer, Noche con luna y Noche profunda. Tarde dorada usa el archivo de tarde, no un amanecer. No se añaden momentos sin un HDRI disponible.

Elegí el cielo y, aparte, el clima: despejado, nublado, lluvia, tormenta o niebla. La nieve leve está disponible en Paso Garibaldi y Cuesta de Lipán. Cambiar el clima conserva el HDRI elegido; cambiar el cielo conserva el clima. Los efectos de clima se superponen al cielo base y modifican precipitación, visibilidad, humedad y adherencia de forma coherente. Por eso es posible mantener, por decisión del jugador, un cielo despejado con lluvia.

Ambas selecciones se guardan y se reflejan entre los menús y los ajustes durante la carrera. Al cambiar de circuito se comprueba la compatibilidad del clima; elegí una opción válida si el circuito de destino no admite nieve.

El taller utiliza un HDRI local de Poly Haven, reflejos del propio recinto, materiales de superficie fotográficos y utilería modelada en Blender. El selector de color modifica la carrocería de la Chevy tanto en el taller como en carrera, conservando ruedas, cristales y cromados.

## Vehículos en vistas exteriores

Las cuatro ruedas de la Chevy giran con los ángulos de la simulación física, incluida la marcha atrás, y las delanteras acompañan la dirección. La animación no modifica la carrocería, sus texturas ni la física; sigue funcionando al ajustar **Auto** en el editor. El modelo del Falcon está alineado con su dirección de marcha, sin el giro lateral de 90°. Su preparación para animación conserva las normales originales, evitando el reflejo marmolado que aparecía por una copia incorrecta de atributos; no se repintó la textura.

Las cámaras de persecución y cinematográfica conservan la distancia horizontal a la Chevy y se elevan si el Falcon invade su recorrido. La mirada acompaña la elevación para conservar el encuadre; al despejarse recuperan suavemente la vista original. La anticipación está limitada a 0,8 m alrededor del recorrido de cámara y la elevación adicional a 4 m. No se oculta al rival ni se altera la cámara del cockpit. Si el rival tapa prácticamente el punto de seguimiento, ese límite evita saltos extremos pero no garantiza despejar todo el segmento visual.

## Editor durante la carrera

Abrí la ruedita inferior izquierda, bajá hasta **Composición 3D** y activá **Modo editor**. La carrera se detiene mientras editás. Posición, rotación, escala y calibración de cámara se guardan automáticamente en `../Configuracion/cockpit-layout.json` al usar el launcher local. **Guardar composición** confirma el guardado; `cockpit-layout.previous.json` conserva la versión anterior y el navegador guarda una copia de recuperación. La composición ajustada desde la ruedita el 6 de septiembre incluye 21 elementos.

- **Auto**: posición, rotación y escala del modelo exterior en las cámaras de persecución y cinematográfica. No altera el tamaño del chasis físico ni sus colisiones.
- **Cámara cockpit**: desplazamiento, rotación y lente de 28, 35, 50 u 80 mm, o distancia focal manual. Sólo modifica esta cámara; las exteriores conservan sus ajustes.
- **Retrovisor interior y espejo lateral izquierdo**: modelos independientes con vistas traseras diferentes, posición, rotación y escala editables.
- **Techo**: elemento independiente del cockpit con posición, rotación y escala. También se puede seleccionar directamente en la escena.
- **Cerradura y llave · conjunto**, **Llave de contacto** y **Llavero Chevrolet**: contacto modelado en Blender, montado a la izquierda del volante. Al mover el conjunto se desplazan todas sus piezas; la llave y el llavero también admiten ajustes independientes. Se presenta con la llave insertada; el arranque de la sesión sigue siendo **Girar la llave** en el menú.
- **Palanca · bocha/pomo**: el círculo, los números y el esquema H están tallados en la geometría negra, con relleno claro en las ranuras. Su ajuste independiente se conserva mientras se mueve la palanca; sigue siendo interactiva con mouse y táctil.
- Si un objeto no pertenece a la cámara actual, sigue seleccionado pero sus controles se desactivan y aparece una explicación. Cambiá de cámara para editarlo.

En **Cámara cockpit → Cabeceo · movimiento de cabeza** podés activar la respuesta física y ajustar intensidad, rapidez, desplazamiento e inclinación con deslizadores. Frenadas, curvas y suspensión producen un pequeño paralaje respecto del tablero. La pausa congela el movimiento; editar, recuperar el auto o activar movimiento reducido lo deja en reposo. Los parámetros se guardan en la calibración de cámara de `cockpit-layout.json`, conservando la posición, rotación y lente elegidas.

En **Iluminación → HDRI y exposición** están los deslizadores de brillo del fondo, luz ambiental, exposición, desenfoque y rotaciones X/Y/Z del fondo y de la iluminación. Cada deslizador tiene un valor numérico editable para ajustes finos. También están las luces presentes, faros y niebla; los faros indican si cada ajuste es automático o personalizado.

**LUTs y color** permite elegir entre los 65 LUTs de la carpeta `LUTS`, ajustar intensidad, contraste, saturación, temperatura y matiz. Iluminación y color se guardan juntos por combinación de circuito, HDRI y clima en `../Configuracion/iluminacion-carreras.json`; el navegador conserva una copia local. **Restaurar iluminación** conserva el LUT y **Restaurar color** conserva las luces. El estado al pie del panel indica si el guardado se realizó en disco o sólo en el navegador.

Al comenzar una carrera, cada cámara realiza una entrada breve; editar o cambiar de cámara cancela la animación sin modificar la composición guardada.

El cockpit se dibuja con una profundidad independiente de la pista: al bajar o mover el habitáculo en el editor, el asfalto no atraviesa el piso, el volante ni los pedales. Sus piezas conservan la oclusión entre sí, los espejos mantienen sus vistas y el exterior sigue visible por las ventanas.

La llave y el llavero responden a la aceleración, frenada, giro e inclinación físicos del chasis. El llavero oscila con gravedad y amortiguación; la llave tiene una pequeña holgura y vibración según el motor, manteniendo fija la punta insertada. La pausa congela el movimiento. El editor y la opción de movimiento reducido lo dejan en reposo; ninguna animación se guarda sobre las transformaciones elegidas.

El HUD de carrera se oculta durante la edición y vuelve al salir. Podés restablecer el objeto seleccionado o toda la composición. Los ajustes guardados de versiones anteriores se migran sin borrar los demás elementos.

## Terreno de los circuitos

Los cuatro circuitos tienen refinación visual de pendientes y materiales con variación de escala para reducir la repetición. Dos Lagos conecta sus piezas de suelo en las costuras; Horcones tiene un cierre de ladera de cresta y pie suavizados. El muestreo de vegetación utiliza las superficies refinadas. Se conservan los datos físicos de ruta, costa y colisiones. Las grandes formas del terreno original todavía limitan el realismo; las capturas comparables están en `../Reports/Asfalto_Nacional_v6_modular/terrain-polish-2026-09-06/comparacion.html`.

## Salidas de pista

La simulación conserva la caída y el contacto físico. Si el vehículo atraviesa el terreno, queda demasiado tiempo sin apoyo o pierde una proyección válida de la ruta, se recupera en una posición segura del circuito. La recuperación reinicia velocidades y controles, invalida la vuelta y aplica la penalización correspondiente. Un salto breve normal no provoca recuperación. También podés recuperarlo manualmente con `Backspace`.

## Validación desde la carpeta padre

```text
npm run test:v6:unit
npm run test:v6:browser
npm run validate:v6
npm run accept:v6
```

`assets/manifests/release.json` contiene el inventario reproducible de archivos, tamaños y SHA-256. El informe final se guarda en `Reports/Asfalto_Nacional_v6_modular/acceptance.json`.

Las pruebas de navegador deben ejecutarse en serie: comparten GPU y generan evidencia de rendimiento. `test:v6:browser` es el recorrido de QA modular; `accept:v6` ejecuta por separado la aceptación integral, incluidas unitarias y 20 ciclos de carga/descarga. La emulación móvil no sustituye las pruebas en teléfonos físicos.

## Relieve, color y montañas — septiembre de 2026

Los cinco circuitos activos incluyen parallax occlusion mapping en asfalto, suelo y rocas. Los mapas de altura de 1024 px corresponden a las texturas fotográficas CC0 de Poly Haven; su origen y sus checksums están en [height-provenance.json](assets/tracks/visual-correction/height-provenance.json).

El asfalto tiene hasta 8 mm de relieve visual; ripio y terreno, entre 4,5 y 7 cm; las rocas, entre 12 y 16 cm. El trazado usa búsqueda por capas y refinamiento binario, muestreo con gradientes explícitos, oclusión ambiental suave y profundidad corregida. Las rocas también recortan su contorno mediante una aproximación de curvatura local. Es relieve hacia dentro del volumen original: no añade prismas, no crea salientes fuera de la malla y las sombras proyectadas mantienen la geometría original.

Los vertex colors aportan variaciones regionales de suelo, humedad aparente y mineralización. Sus campos continuos evitan cambios aleatorios entre cargas; las rocas instanciadas conservan su color al reordenarse por distancia. No se cambia la posición de rutas ni de colliders.

Las cadenas de fondo de Dos Lagos, Garibaldi, Horcones y Lipán tienen cumbres dominantes, crestas asimétricas, surcos y bandas minerales; tres planos de profundidad, con 52.736 triángulos en total por circuito. Iguazú mantiene su entorno selvático y sus cataratas.

- Alto: hasta 24 pasos por rayo, desvanecimiento entre 45,6 y 95 m.
- Equilibrado: hasta 12 pasos, entre 23 y 48 m.
- Bajo: conserva texturas, vertex colors y montañas; desactiva el trazado de relieve.

El gobernador de rendimiento elige estos niveles automáticamente. El diagnóstico está en __cockpit.raceWorld.getPerformanceDiagnostics().surfaceRelief. La intensidad del detalle es exclusivamente visual.

## Relieve y vertex colors del taller

El taller modular aplica el mismo shader compartido de los circuitos a siete materiales opacos: piso de hormigón (6 mm), revoque (8 mm), pintura de pared (3,5 mm), madera (4 mm), acero (1,5 mm) y metal pintado rojo/verde (1 mm). Cinco mapas de altura fotográficos CC0 de 1024² coinciden con el albedo, la normal y la rugosidad existentes. Los tres metales reutilizan el mismo juego de mapas.

El recorte de silueta usa la aproximación local de curvatura convexa del shader compartido en madera y metales; actúa en bordes curvos o biselados. No extruye geometría ni reproduce una silueta arbitraria en cantos planos. En piso y paredes continuas se usa POM sin recortar islas UV. La posición física y las sombras geométricas conservan la malla original.

Los colores por vértice añaden variación espacial suave de tono, uso y envejecimiento sobre las texturas. Las caras grandes se subdividen por interpolación antes del agrupado, sin desplazar sus superficies; las molduras finas evitan subdivisión innecesaria. Los accesorios instanciados tienen colores propios que se conservan al cambiar de LOD. La carga comparte texturas y restaura las geometrías originales al liberar el taller.

El control de calidad del shader compartido mantiene 24 pasos máximos en alto, 12 en equilibrado y desactiva POM en bajo. Se puede consultar `__chevyV6Complete.workshop.presentation.diagnostics()` para ver materiales, colores, calidad y recursos.

Verificación: `node --test tests/asfalto_nacional_v6_workshop_*.test.mjs tests/asfalto_nacional_v6_surface_relief.test.mjs` y `node tests/asfalto_nacional_v6_workshop_relief_browser.mjs`. Capturas y resultados en `Reports/Asfalto_Nacional_v6_modular/workshop-relief`.

## Ruedas, dirección y frenos

Abrí **Taller → Ruedas y frenos**. Elegí entre cuatro diseños de llanta, cuatro neumáticos y cuatro kits de freno. Ajustá presiones por eje, relación de dirección, asistencia, reparto delantero y ABS. El kit aumenta automáticamente el tamaño de llanta cuando necesita espacio; elegir una llanta más pequeña reduce el kit compatible.

**Auto** previsualiza el conjunto sobre el vehículo seleccionado. **Mecánica** muestra dirección, suspensión e hidráulica; **Una rueda** permite elegir cada esquina. En **Inspeccionar y accionar** podés girar la dirección, presionar el pedal, animar las ruedas, despiezar, cortar, buscar piezas, ocultarlas o aislarlas. Arrastrá el visor para orbitar y usá la rueda del mouse para acercarte; **Encuadrar** recupera la vista.

**Aplicar al auto** guarda la configuración local y la aplica al taller y al vehículo del jugador en carrera. Los neumáticos cambian agarre, respuesta a presión y diámetro; los frenos modifican par, reparto y resistencia térmica; dirección asistida y ABS actúan en los controles y la simulación existentes. Instalar frenos no cambia la caja de velocidades. **Descartar** o salir de la sección restaura los cambios guardados. **Base clásica** prepara los valores de referencia y requiere aplicar para guardarlos.

Se adaptó la geometría paramétrica de `../Rueda_Direccion_Frenos/Chevy_1969_Laboratorio_3D.html` al renderer Three.js existente. El inspector es una reconstrucción didáctica, con movimientos de pastillas y despiece amplificados; no representa cotas de fabricación. El motor de conducción sigue siendo la física v6. La configuración se comparte entre los autos seleccionables; el cockpit y la configuración de los rivales conservan su funcionamiento independiente.

Los perfiles anteriores sin `chassis` mantienen su calibración de conducción hasta aplicar una configuración desde esta sección. Los valores explícitos se usan en sus unidades mostradas (por ejemplo, 16:1 y 58 %). El inspector se libera al salir para no mantener su geometría activa durante la carrera.

Pruebas dirigidas: `node --test tests/asfalto_nacional_v6_chassis_configuration.test.mjs tests/asfalto_nacional_v6_chassis_mechanism.test.mjs tests/asfalto_nacional_v6_vehicle_chassis.test.mjs`. Prueba completa del flujo con Chrome y datos aislados: `node tests/asfalto_nacional_v6_workshop_chassis_browser.mjs`.

## Materiales, atmósfera e iluminación avanzada

En **Ajustes → Realismo gráfico** elegí Alto, Equilibrado, Bajo, Adaptativo o Apagado. Equilibrado es el valor inicial; el gobernador puede reducir el nivel para sostener el rendimiento. La elección queda guardada localmente y se comparte con el taller. El relieve POM, los vertex colors y las montañas existentes conservan su sistema propio.

| Técnica | Implementación y alcance |
| --- | --- |
| SSS | Dispersión simple aproximada en superficies finas: hojas, cera y plástico fino. No es un BSSRDF volumétrico con espesor interior. |
| Anisotropía, Clear Coat y Sheen | BRDF de MeshPhysicalMaterial en metales cepillados, pintura/barniz y telas. Vidrio, agua y cromados conservan su tratamiento específico. |
| Detail normal/textures | Microtextura procedural repetible de normales y rugosidad, superpuesta al material original. |
| Desgaste de bordes | Curvatura convexa calculada a partir de la geometría y sus vértices soldados; modula color/rugosidad sin modificar la malla física. El cálculo tiene un presupuesto por malla y por actualización. |
| GTAO | Integración de horizontes del shader oficial Three.js r180, con reconstrucción de normales desde profundidad y adaptación para profundidad logarítmica. Se implementó GTAO; no se incorpora el SDK HBAO+ de NVIDIA. |
| SSGI | Rayos hemisféricos que buscan superficies en la profundidad de pantalla, con filtrado bilateral y rebote de color acotado. No puede recoger iluminación de objetos fuera de pantalla. |
| DFAO | Trazado de distancias firmadas analíticas de cajas orientadas cercanas. Es una aproximación por proxies, no un campo voxelizado de cada triángulo; excluye suelo, vegetación, autos, agregados grandes y volúmenes que encierren la cámara. |
| Pivot Painter | Jerarquía de raíz, rama y hoja inferida de componentes conectados. Las sombras usan la misma deformación. No requiere ni sustituye un bake artístico de Pivot Painter. |
| Niebla y rayos de luz | Integración de densidad con altura y extinción Beer–Lambert, con muestreo de oclusión hacia el sol en profundidad de pantalla. Conserva clima, noche y niebla existente cuando el pase está desactivado. |
| Rayleigh/Mie | Dispersión atmosférica esférica de una interacción en una capa del cielo, sincronizada con la luz principal. Conserva HDRI, reflejos y presets; no genera nubes volumétricas. |
| PDO | Desplazamiento de profundidad derivado del punto de intersección del POM existente, compatible con profundidad normal y logarítmica. No altera colisiones ni siluetas físicas. |

El pase del mundo se ejecuta antes del cockpit y conserva la profundidad para los pases posteriores. El taller utiliza el mismo sistema en su renderer. Los recursos propios se liberan al desmontar cada escena y las superficies se actualizan durante el streaming y los cambios de vehículo.

Alto usa hasta 24 muestras de GTAO, 6 rayos SSGI de 12 pasos y 16 proxies DFAO. Equilibrado reduce esos presupuestos a 12, 3 × 8 y 8. GTAO/SSGI se calculan a resolución reducida y se combinan con un filtro que respeta la profundidad. Bajo mantiene GTAO reducido y desactiva SSGI, DFAO y niebla volumétrica; también reduce materiales y animación de hojas. Apagado libera los targets del nuevo postproceso.

Diagnóstico del mundo: __asfaltoAdvancedGraphics.diagnostics(). Taller: __chevyV6Complete.workshop.advancedGraphics.diagnostics(). La API __asfaltoAdvancedGraphics.setSettings permite desactivar técnicas por separado para comparar resultados; el menú expone el nivel global.

Pruebas: tests/asfalto_nacional_v6_advanced_graphics.test.mjs, advanced_materials.test.mjs, physical_atmosphere.test.mjs, distance_field.test.mjs, pivot_painter.test.mjs y screen_space_lighting.test.mjs, con el prefijo asfalto_nacional_v6_. Pruebas GPU y recorrido completo: node tests/asfalto_nacional_v6_advanced_graphics_gpu.mjs y node tests/asfalto_nacional_v6_advanced_graphics_browser.mjs. Evidencia y límites: ../Reports/Asfalto_Nacional_v6_modular/advanced-graphics/.

Corrección de sombras: la capa de clima solo modifica shaders que calculan normales de superficie. Las hojas y ramas conservan su animación y recorte alfa en MeshDepthMaterial/MeshDistanceMaterial, sin referenciar transformedNormal. La regresión tests/asfalto_nacional_v6_pivot_painter_gpu.mjs reproduce la cadena real de clima, material y vegetación en 16 variantes. Después de actualizar archivos en una pestaña ya abierta, recargá el juego para recompilar los shaders.

## Clima, tiempo de carrera y estabilidad

**Nevada Intensa** se elige en el clima de Garibaldi y Cuesta de Lipán. Aumenta la densidad cercana de copos, turbulencia, acumulación y compactación de nieve; cambia también agarre y resistencia de rodadura. La nieve ligera conserva su propia intensidad. Los copos y el terreno siguen la luz del cielo. Se reutilizan los mismos buffers y límites por calidad.

Junto al cielo aparece **Paso del tiempo**: **Ciclo activo · 12 min** o **Cielo fijo**. El ciclo activo comienza en el cielo elegido, recorre progresivamente los seis cielos disponibles y representa 24 horas en 12 minutos de carrera. Amanecer reutiliza los panoramas cálidos con el horizonte luminoso al este. Fondo, reflejos, iluminación, niebla y faros acompañan la transición; la pausa y los menús detienen el reloj. La selección queda guardada y sincronizada entre los tres menús. El clima seleccionado permanece independiente.

El terreno, las banquinas y las rocas sólidas participan en las colisiones y en el contacto de las ruedas. La física conserva el soporte cuando un sector visual sale del campo de visión. Las actualizaciones usan identidad de cada malla; los grupos homónimos ya no fuerzan reconstrucciones continuas. Se mantiene CCD y el comportamiento balístico de los saltos.

El motor tiene temperatura propia, separada del embrague. Refrigeración dañada, exceso de temperatura sostenido e impactos frontales graves pueden producir humo e incendio; las chispas corresponden a contactos metálicos. Las emisiones siguen el capó del vehículo seleccionado. Pausar detiene las partículas; un nuevo estado de carrera reinicia la avería.

**Taller → Ruedas y frenos** reúne neumáticos, llantas, presión, dirección, asistencia, reparto y kits de freno. Apariencia, Mecánica y Puesta a punto enlazan a esa sección y conservan sus restantes funciones. Restaurar apariencia o puesta a punto no sobreescribe la configuración del chasis.

Las gotas y escobillas se ajustan a la abertura medida de la cabina y comparten plano y recorrido de barrido. Se conserva la calibración del cockpit guardada por el usuario. Los controles de formulario tienen identificadores o nombres.

Las optimizaciones eliminan trabajo redundante: diagnóstico de materiales dentro de cada paso físico, reconstrucción de carretera heredada oculta, consultas completas para ancho/peralte, cargas de matrices iguales y automatizaciones de audio idénticas. Los parámetros de sonido se limitan al rango real de cada AudioParam sin modificar la aceleración física.

Prueba integrada con Chrome y configuración aislada: `node tests/asfalto_nacional_v6_integrated_stability_browser.mjs`. Pruebas y capturas: `../Reports/Asfalto_Nacional_v6_modular/integrated-stability/`. Geometría de parabrisas: `../Reports/Asfalto_Nacional_v6_modular/windshield-alignment/`.

