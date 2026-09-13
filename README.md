# Asfalto Nacional v7 — mandos táctiles y estabilidad

Versión en desarrollo: https://gatdeguin.github.io/Asfalto/

## Cambios

- En teléfono se conduce arrastrando el volante 3D real. Acelerador y freno están juntos a la derecha; un pulgar desliza entre ambos mientras el otro gira.
- Mandos reúne caja manual/automática, embrague, freno de mano, recuperación y vista exterior. La inspección exterior pausa; volver a conducir recupera el cockpit. PC conserva sus cámaras y mandos.
- Panel compacto en paisaje, velocidad en km/h, encuadre móvil con raycasting alineado, áreas seguras y liberación de entradas en pausa/cancelación/cambio de orientación.
- Arranque manual coherente en neutro, con indicación de engranar primera. Automático sale en primera. El reset genérico conserva su comportamiento anterior.
- Perfil de teléfono independiente: presupuestos móviles de resolución/texturas, HUD sin contexto WebGL adicional, Page Cache y recuperación de audio. Los límites y fuentes PC permanecen intactos.
- Paquete opcional de imágenes de cabina para teléfono. Mantiene geometría y UV originales; reduce imágenes grandes antes de decodificarlas. Añade 15,25 MB de descarga fría y no elimina el JSON original de 59 MB. El ahorro de memoria citado en los informes es teórico, no una medición del iPhone.
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
