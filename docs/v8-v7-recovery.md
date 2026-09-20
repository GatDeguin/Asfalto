# Recuperación v7 sobre v8 — 20/09/2026

Base v8: `912b2f8`. Fuente funcional v7: `3486664`. Integración sobre v8; no sustitución por una copia de v7.

## Funciones recuperadas

- Fichas visibles en menú, 100 para perfiles nuevos, saldo existente conservado.
- Campeonato nacional de 5, 10 y 15 etapas, calendarios canónicos, inscripción, clasificación física, guardado de resultados y recompensas sin duplicados.
- Pruebas medidas, historial y recibos, colección, trofeos, medallas y recuerdos fotográficos del taller.
- Condición mecánica y visual por vehículo, consumo, reparaciones y asistencia por vuelco/averías.
- Semáforo diegético, ciclos día/noche de 6/12 minutos y variación climática, previsualización de ruta según selección.
- Preparación cancelable, demanda diferida de recursos, presupuesto móvil y controles táctiles.

## Mejoras v8 conservadas

- Calibración de lente por vehículo y estabilidad al redimensionar; restricción espacial de cámara del taller.
- Bancos de audio generados en worker, manejo de activación/suspensión y cancelación.
- Caché PMREM y caché HTTP con integridad, precarga acotada, compilación serializada de shaders y carga diferida del rival.
- Los GLB de vehículos e interiores presentes en v8 se conservan sin cambios. Se recuperan dependencias faltantes, sin reemplazar las piezas detalladas, instrumentos ni controles v8.
- Marca vigente en menú e intro y cierre sin duplicación del logo.

## Correcciones de integración

El gabinete de colección se incorpora a colisiones y actualiza los obstáculos al reconstruirse. Intro y cargas comparten la propiedad del bloqueo de interacción para no dejar el menú inutilizable. En móvil, el render inicial se habilita después de completar shaders. Iguazú conserva sus modelos v8 y vuelve a coincidir con el manifiesto verificado por el adaptador.

Si coexisten partidas v7 y v8 diferentes, el jugador elige antes de iniciar. Se guardan ambas copias exactas y se pueden descargar desde ese diálogo; no se suman saldos ni se comparan revisiones de sistemas diferentes. Una falla de cuota durante la copia mantiene pendiente la recuperación y permite exportar/reintentar.

Se excluye de la publicación `assets/intro/cinematic.mp4`, película antigua sin referencias de ejecución. La intro vigente `cinematic-v7.mp4` permanece. El archivo antiguo sigue disponible en el historial Git.

## Verificación y límites

Las pruebas de unidad cubren física de clasificación, escrituras de perfiles, reparaciones, cámara, audio, cachés, preparación/cancelación, render móvil y migración. Se ejecutan automáticamente en GitHub Actions.

La revisión visual y de navegador se realiza en Chrome PC y emulación móvil. Los informes externos están en `Reports/Asfalto_Nacional_v8/recovery-2026-09-20` y `Reports/Asfalto_Nacional_v8/stability-2026-09-19/recovery-*` del workspace. No se certifican iPhone físico, 60 FPS sostenidos, fotorrealismo ni una matriz exhaustiva de todas las combinaciones. La auditoría independiente es técnica, no una nota estética.

### Resultado de las pruebas

- 189/189 pruebas del repositorio y 57/57 pruebas dirigidas sobre el candidato; sintaxis de todos los módulos verificada.
- Chrome PC: inscripción y largada de campeonato, reparación, saldo tras recarga, cinco mapas, seis cielos, lente manual al redimensionar, audio, pausa, regreso y vitrina; cero errores JavaScript/HTTP.
- Chrome con perfil móvil: escena renderizada, acelerador táctil, pausa, audio, seis cielos, persistencia y selección de los cinco vehículos con sus interiores; cero errores JavaScript/HTTP.
- Diálogo de recuperación de perfiles verificado en viewport móvil: elegir la partida v8 conserva sus 83 fichas y una copia exacta de la partida v7 de 25 fichas de la prueba.
- Auditoría independiente final: 8,5/10 técnica, sin bloqueantes identificados. Las capturas muestran el taller sin cámara dentro del mueble y la ruta/cockpit en móvil.
