# Asfalto Nacional 8.1 — candidata de prueba

Esta entrega prepara la web/PWA y Windows y corrige defectos encontrados al
conducir. **Todavía no certifica 60 FPS sostenidos, todos los campeonatos
jugados ni compatibilidad física de iPhone/Android.** Las condiciones de
cierre y las pruebas pendientes se conservan más abajo.

## Cambios

- Frenada: se eliminó la fuerza residual que hacía retroceder el auto al
  completar 100–0. El apoyo de freno respeta el par disponible, la pendiente
  y la adherencia del neumático. No se fija artificialmente la velocidad.
- Tren motriz: el embrague reacciona cuando el eje intenta superar el límite
  del motor. Las ruedas en el aire integran par y freno; el diferencial
  autoblocante usa un reparto coherente de par, velocidad e inercia. Se
  corrige el patinamiento divergente sin recortar la velocidad de la rueda
  ni reducir el desgaste. El seguimiento de RPM sigue siendo una aproximación.
- Pruebas: llegar a la meta sin cumplir el objetivo ahora cierra el intento
  y explica el resultado, con opciones de repetición y taller. No concede
  fichas. Cumplir el objetivo en el último paso físico conserva la marca.
- Taller: conversión, restauración, apariencia, puesta a punto y fotografía
  conceden experiencia por aprendizaje una sola vez. Repetir las acciones
  conserva sus efectos e historial, sin subir de nivel indefinidamente con
  el mismo botón. Se conserva toda la experiencia anterior a esta versión.
- Renderizado: retener recursos inspecciona cada material compartido una
  vez por llamada. Las variantes primarias ya preparadas se reutilizan sólo
  mientras siguen vivos sus programas y coincide toda la configuración.
  Volver rápidamente al estado anterior no dibuja durante una preparación
  pendiente. No cambian física, iluminación seleccionada ni calidad elegida.
- Terreno: nuevas mallas de enlace de Blender unen banquina y terreno de
  Garibaldi y el acceso inicial S01 de Lipán. Se usa el mismo apoyo para
  imagen y colisión. Los trazados originales y los sectores anteriores se
  conservan; no se añadieron regresos ni circuitos nuevos.
- Daños: los respaldos interiores y las piezas del vano del Chevy y Bel Air
  acompañan la deformación. Los triángulos demasiado largos se subdividen
  durante la autoría, nunca al chocar. Reparar recupera la geometría original.
- PWA: manifiesto e iconos del emblema del juego, instalación pequeña y
  descarga completa opcional, cancelable y reanudable por archivo. La
  descarga se pausa al conducir, también si otra pestaña está jugando.
  Actualizar conserva la partida y mantiene coherentes los recursos de una
  carrera abierta.
- Windows: paquete x64 con Electron 45.3.3, perfil persistente y actualización
  manual. El juego se sirve localmente desde un origen fijo; la instalación
  no requiere Node.js. No se añadieron dependencias externas al runtime web.

## Ejecutar y actualizar

Web: [abrir Asfalto Nacional](https://gatdeguin.github.io/Asfalto/).
En iPhone, abrir con Safari y elegir Compartir → Agregar a inicio. La prueba
en dispositivo real todavía está pendiente.

Para disponer del juego completo sin conexión, usar Ajustes → Aplicación y
juego sin conexión y esperar la confirmación de descarga completa. Requiere
aproximadamente 944 MB además del espacio de la instalación. Cancelar
conserva los archivos ya verificados; no borra fichas ni álbum. El navegador
administra el espacio disponible y puede revocar almacenamiento no persistente.
Después de una actualización se indican los recursos que falten.

Windows: el instalador está en la
[candidata de GitHub](https://github.com/GatDeguin/Asfalto/releases/tag/v8.1.0-rc1).
Instalar sobre la versión anterior conserva el perfil. Esta candidata no
tiene firma de editor. Web y Windows tienen perfiles separados; la opción
de exportar/importar del taller permite trasladar el archivo de progreso.

Código web local: ejecutar `node server.mjs`. Verificaciones reproducibles:

```sh
node tools/build-pwa.mjs --check
node tools/verify-v8-release.mjs
node --test tools/*.test.mjs
```

## Evidencia y límites

La regresión automática y el inventario exacto se registran junto a esta
candidata en `qa-8.1-rc1.json`. Los ensayos de conducción usan pedales,
dirección y cambios reales a tiempo normal, con recibos autoritativos
`qa:false`; las pruebas de estados sintéticos se identifican aparte.

Se completaron y persistieron once pruebas desde un perfil nuevo: 0–100,
500 m, frenada 100–0, velocímetro, slalom, recuperación 80–120, consumo,
0–160, 1.000 m, ruta húmeda y velocidad máxima. Los desbloqueos de nivel 2 se obtuvieron con
esa progresión. La frenada integrada midió 48,36 m. Los 1,8 km mojados se
completaron en Dos Lagos, con frenada y apoyo en curva. La estimación de
consumo se presenta como modelo, no como medición de un vehículo real.

Velocidad máxima guardó 176,10 km/h estables durante tres segundos después
de reparar la transmisión e instalar admisión y escape mediante los controles
del taller. Se conservaron los once recibos, 121 fichas y 144 XP al recargar.
Este ensayo verifica funcionamiento y progresión; no aísla el efecto de cada
modificación. El círculo de giro completo sigue pendiente.

Otra pasada completa de Aconcagua (21 km) verificó el cierre de una prueba
sin objetivo cumplido: apareció el motivo, se volvió al taller y se recargó
sin medalla ni fichas adicionales. No se cuenta ese intento como una prueba
de velocidad máxima superada.

Garibaldi se recorrió de taller a meta: 24 km, tráfico, ciclo de cielo,
resultado y tres fichas conservadas después de recargar. Esa referencia
anterior al ajuste promedió 58,57 FPS, p95 20,94 ms y máximo 1.746 ms. No se
presenta como una prueba de 60 FPS ni como comparación con otra ruta.

RenderDoc capturó un cuadro real D3D11 de Dos Lagos y Nsight Systems generó
una traza. Windows no habilitó WDDM. En 20 alternancias repetidas de faros,
las preparaciones primarias pasaron de 20 a cero; el ensayo todavía registró
un tirón ajeno a esa preparación. Sigue pendiente la medición completa y
aislada del paquete final y la investigación de los picos restantes.

La PWA se probó con servidor apagado y caché HTTP deshabilitada, actualización
entre versiones, conservación de perfil/IndexedDB, cancelación, cuota y
coordinación entre pestañas. Chrome informó cero problemas de instalabilidad.
Eso no sustituye instalar y jugar en Safari de un iPhone físico.

Un paquete provisional de Windows se instaló, reinició y actualizó desde 8.0. El perfil y el archivo
JPEG técnico de IndexedDB se conservaron exactamente (excepto el contador
de revisión de almacenamiento). Las 13 comprobaciones de APIs del paquete
instalado incluyen contexto seguro, almacenamiento, workers, WASM,
AudioWorklet, WebGL2 y respuestas parciales de archivos.
El acta adjunta a la publicación de GitHub identifica por SHA-256 el instalador
final y sus comprobaciones; este informe previo no sustituye ese ensayo.

## Condiciones de cierre pendientes

1. Sostener el presupuesto de cuadros en viajes completos aislados, con
   caché fría, tráfico y cielo dinámico; ampliar hardware y dispositivos.
2. Terminar y persistir las doce pruebas, siete competencias y treinta
   etapas manejando, incluyendo reintentos, abandonos, economía y servicios.
3. Recorrer completos los cinco escenarios con la candidata final; cerrar
   defectos restantes de arte y colisión y la extensión de las 100 mejoras.
4. Resolver el coste de CPU del daño severo simultáneo: el caso más pesado
   medido sigue excediendo 16,67 ms. No se garantiza 60 FPS al impactar.
5. Instalación y sesión real de iPhone y Android, orientación, controles,
   audio, suspensión, reapertura y rendimiento.

Esta lista distingue trabajo entregado de verificación pendiente. La
candidata permite obtener evidencia de esos dispositivos y continuar el
cierre sin declarar terminado lo que todavía no fue comprobado.
