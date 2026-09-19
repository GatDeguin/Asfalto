# Cinematic Ultra — implementación incremental

Base publicada: `gh-pages`, `045cd8b7d206418a26d7a75666e557a7e124377a`.
Rama aislada: `graphics/cinematic-ultra-20260918`. No se modifica la publicación.

## Objetivo y límites
Refinar el sistema WebGL/Three existente. Física v6 a 120 Hz, controles,
colisiones, recorridos, cámara, ajustes mecánicos y HDRI/clima/ciclo quedan intactos.
No hay DLSS, RTX, path tracing, TAA sin reproyección, motor nuevo ni build obligatorio.
Los 19 apartados del encargo son la referencia. Esta entrega distingue código
verificado de dirección artística pendiente de validación visual.

## Secuencia y puertas de verificación
1. Registrar grafo desde index.html, versión de Three, recursos y pruebas de base.
2. Escribir pruebas que fallan por Cinematic: normalización, persistencia/eventos,
   jerarquía, límites del gobernador, recuperación 600 muestras, auto nunca Cinematic.
3. Implementar política explícita Cinematic, mantener preferencias/valores anteriores,
   integrar carrera y taller. Presupuestos de streaming y físicas quedan en familia Alto.
4. Añadir prueba de muestras MSAA por intersección real de formatos; corregir selección.
   Cinematic: GTAO 32 muestras, efectos .625 y 960 px / 518400 píxeles máximo;
   GI 6x12, DFAO/volúmenes/espejos/vegetación como Alto. Sin resolución 4K forzada.
5. Refinar microdetalle filtrado, materiales de asfalto/caucho/vinilo y anisotropía
   reversible, sin sustituir mapas ni referencias. Probar identidad y liberación.
6. Probar restauración del cockpit ante error; preservar profundidad independiente,
   LUT después de tone mapping y sombras/deformación de vegetación.
7. Ejecutar node --test real, servidor estático y compilación WebGL con Three embebido.
   Documentar renderer, resoluciones y límites de las mediciones; sin promesas de FPS.
8. Revisar diff contra invariantes, entregar parche, informe y rama/PR sin merge automático.

## Línea base
`node --test tools/*.test.mjs`: 169 pruebas, 159 aprobadas, 10 fallidas antes de editar.
Los fallos previos no se eliminan ni se debilitan; su inventario se guarda en el informe.
No existe package.json raíz. Node del contenedor: v22.16.0.

## Registro de decisiones
- La rama publicada gh-pages es posterior a main: se preserva su contenido.
- El gobernador continúa siendo el existente; el taller usa una instancia propia
  para medir su escena, sin modificar el paso físico ni el tamaño de los assets.
- Cinematic es manual. Auto mantiene techo Alto. Las preferencias existentes no migran.
- Técnicas secundarias usan explícitamente la familia Alto, no el fallback Equilibrado.
- No se añade acumulación temporal: la mejora de estabilidad es espacial.
