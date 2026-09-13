# Asfalto Nacional v7 — mandos táctiles y estabilidad

Versión en desarrollo: https://gatdeguin.github.io/Asfalto/

## Cambios

- En teléfono se conduce arrastrando el volante 3D real. Acelerador y freno están juntos a la derecha; un pulgar desliza entre ambos mientras el otro gira.
- Mandos reúne caja manual/automática, embrague, freno de mano, recuperación y vista exterior. La inspección exterior pausa; volver a conducir recupera el cockpit. PC conserva sus cámaras y mandos.
- Panel compacto en paisaje, velocidad en km/h, encuadre móvil con raycasting alineado, áreas seguras y liberación de entradas en pausa/cancelación/cambio de orientación.
- Arranque manual coherente en neutro, con indicación de engranar primera. Automático sale en primera. El reset genérico conserva su comportamiento anterior.
- Perfil de teléfono independiente: presupuestos móviles de resolución/texturas, HUD sin contexto WebGL adicional, Page Cache y recuperación de audio. Los límites y fuentes PC permanecen intactos.
- Paquete opcional de imágenes de cabina para teléfono. Mantiene geometría y UV originales; reduce imágenes grandes antes de decodificarlas. La primera versión añadía 15,25 MB y conservaba el JSON; la corrección móvil del 13 de septiembre descrita abajo reemplaza esa ruta. El ahorro de memoria citado en los informes es teórico, no una medición del iPhone.
- Guardarraíles de los primeros sectores de Lipán alineados con la colisión autoritativa, perfil continuo y postes apoyados. Geometría de ruta/colisión conservada; no es certificación vial ni relevamiento de obra.
- Rótulos del vehículo coherentes con la selección SS/400.

## Verificación y límites

Chrome táctil: carga, volante+pedales simultáneos, freno, caja, pausa, inspección, retrato/paisaje y regreso al taller. El manifiesto verifica archivos y 174 combinaciones de selección. Pruebas CPU dirigidas cubren plataforma, física, proyección/raycast y regresión PC.

En la prueba de WebKit de Playwright en Windows, UI y física respondieron, pero se reprodujo una captura negra tras redimensionar incluso un canvas mínimo de color plano. Los píxeles internos son válidos. La causa interna y su alcance fuera de ese entorno siguen sin confirmar. Esta prueba no acredita Safari ni un iPhone 15 Pro Max físico; faltan memoria, temperatura, audio y rendimiento sostenido en el equipo real.

Revisión visual independiente de mandos móviles: 8,0/10 (ergonomía, legibilidad y visibilidad de carretera/volante). Se observaron volante y pedales simultáneos, botones completos y avisos separados. La última separación del aviso se verificó reemplazando la URL de la misma hoja de estilo; la prueba pública posterior registrará la carga completa final. Esta nota no certifica el iPhone físico ni la calidad artística global.

No hay aceptación global AAAA ni cierre de los 100 puntos.

## Estado del resto de v7

El taller fue cerrado por el usuario tras su última revisión 7,2/10. La flota jugable sigue siendo Chevy 250 SS Serie 2 y Chevrolet 400. Bel Air 1957 convertible y Sapo 1953 siguen en construcción; no se incluyen todavía como vehículos jugables. Continúan pendientes la fidelidad artística de autos/cabinas, validación visual completa de Lipán, campeonatos/premios y todas las averías de principio a fin.

La intro es una película generada, no una captura del juego. Igualar su percepción visual sigue siendo un objetivo abierto.

## Datos

GitHub Pages conserva progreso y ajustes en el navegador del jugador. Se publica sólo calibración pública de cabina y un preset de iluminación vacío; ningún archivo personal de Configuracion. Se conservan atribuciones y licencias.

## Corrección de entrada a carrera móvil — 13 de septiembre

Ante el reporte de recarga de Chrome en iPhone antes de largar, se redujo la acumulación de recursos durante la preparación. El taller libera su escena antes de cargar la carrera y se reconstruye al volver. Una transición vigente impide que volver de otra app reactive el taller a mitad de carga. Se espera cualquier cambio de vehículo pendiente.

El teléfono ahora carga seis piezas GLB secuencialmente y evita el JSON de cabina de 59 MB y sus cadenas base64. La geometría y las texturas móviles son las mismas; PC conserva su carga y configuración gráfica. Los GLB suman80,88MB: es una mitigación del pico de memoria, no una reducción de transferencia ni una medición de RAM del iPhone.

Prueba local: entrada a pista, aceleración y regreso al taller reconstruido. Revisión independiente CPU y pruebas de cancelación/visibilidad/propiedad de transición. La causa del reinicio físico sigue sin confirmar; falta que el usuario pruebe nuevamente en su iPhone.

## Reinicio móvil: segunda iteración — 13 de septiembre

El usuario confirmó que la mitigación anterior no solucionó el reinicio en Chrome de su iPhone. Esta iteración separa buffers geométricos de archivos GLB en teléfono, reutiliza rangos intercalados y decodifica las texturas de una en una. El renderer móvil inicia dentro de su presupuesto de resolución. Se conservan modelos, UV y materiales; PC mantiene su almacenamiento, decodificación y presupuesto gráfico anteriores.

La carga guarda su última etapa localmente. Si quedó incompleta, la próxima apertura muestra un aviso con diagnóstico copiable. El aviso no afirma por sí solo un cierre por memoria: una recarga manual también puede dejar una preparación incompleta.

117 pruebas CPU aprobadas, incluidas comparaciones exactas de los atributos de las seis piezas móviles originales. Revisión independiente CPU:8/10 dentro del alcance de esta mitigación. Esto no confirma resolución en el iPhone físico; esa verificación sigue pendiente.

## Arranque móvil R3 — 13 de septiembre

La captura física confirmó queR2 tampoco resolvió el reinicio. La última etiqueta de radio cubría también la preparación gráfica y el primer render; no demuestra una falla de la radio. La radio se mantiene funcional.

El primer render móvil ahora espera la aplicación de ajustes y un cuadro de interfaz. El diagnóstico distingue descarga/modelo/control de radio, editor, efectos y cada subpaso del primer cuadro. En teléfono se evita construir la jerarquía adicional PivotPainter: la medición anterior registró591meshes,13geometrías y1773materiales derivados incluso con el efecto finalmente desactivado. Se conservan vegetación, materiales y viento base;PC mantiene la jerarquía completa y sus ajustes.

122 pruebas de regresión y22 pruebas específicas de vegetación/render/materiales pasaron. La validación en iPhone físico sigue pendiente.

## Cockpit móvil R4 — 13 de septiembre

El diagnóstico físico deR3 registra interrupción durante decodificación del volante, antes de radio/render; la causa única sigue sin demostrarse. Se elimina la carga de mallas de edición completas de cabina/tablero/volante/palanca en teléfono: carga directamente las geometrías de juego ya existentes, conserva matrices exactas mediante los límites fuente y evita descargar otroLOD para esas piezas. En el editor móvil esas cuatro piezas también usan la malla de juego;PC conserva las fuentes completas.

Texturas de las seis piezas preparadas offline a1024 píxeles, sólo teléfono. Transferencia80,883,712→44,867,780 bytes. La suma teóricaRGBA de esas imágenes pasa161,218,560→82,575,360 bytes; no es medición de RAM ni GPU total o pico físico. Frente y pedales conservan geometría.

128pruebas de regresión y4 específicasLOD/editor aprobadas; comparación exacta de matrices/UV/posiciones/normales/índices y materiales. Revisión técnica independiente8/10 dentro de este alcance. Confirmación de estabilidad en iPhone físico pendiente.
