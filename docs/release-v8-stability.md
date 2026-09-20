# Estabilidad v8 — 19 septiembre 2026

Entrega de Asfalto Nacional v8 para GitHub y GitHub Pages.

## Hallazgos reproducidos
- Camera rig sobrescribía calibración por cuadro; resize sustituía la proyección antes de reaplicar el rig.
- Audio generaba bancos PCM en el hilo principal (medición aislada: ~698 ms); ahora worker, mismos datos y duraciones, truenos reutilizados. Cancelación comprobada durante autorización y generación.
- Cámara del taller sólo restringía habitación, sin sólidos de muebles. Ahora obstáculos originales, instancias y detalles agregados, margen de plano cercano y orientación corregida.
- Payloads pedían no-store pese a tener SHA256: ahora URLs versionadas por hash y caché HTTP, manteniendo verificación de integridad.
- Rival Falcon se preparaba en modo libre. Ahora carga bajo demanda en competencia, con cancelación, deduplicación y reintento.
- Selección de horario reconstruía dos veces la geometría de la misma pista. Ahora actualiza sólo condiciones/colores cuando no cambia circuito.
- Perfil Chrome: cambio night→clear tardó 42.99 s; ~42.47 s muestreados en getProgramInfoLog, sin nuevos PMREM. Causa observada: espera de compilación de shaders. Se estabilizaron cantidades de luces/sombras entre modos, con intensidad cero para apagado y mapas de sombras sin actualización cuando apagados.
- Intro v8 tiene título grabado en el video y otro encabezado HTML. Encabezado oculto cuando se reproduce video final.

## Evidencia inicial (antes de estabilizar variantes)
- pc-stability/report.json: carga carrera 71.834 s, horario clear 48.9996 s, night repetido 17.7 ms.
- pc-profile/report.json: sin cargar Falcon en libre, carga 69.114 s; clear 42.9866 s. No es una comparación controlada suficiente para atribuir ahorro total al Falcon.
- pc-profile/day-switch.cpuprofile: perfil CPU que identifica espera de shaders.

Chrome automatizado no equivale a un iPhone físico ni demuestra 60 FPS universales. No se redujeron resoluciones de texturas, geometrías ni efectos como parte de estas correcciones.


## Validación final

- **84/84 pruebas**: audio worker y cancelación, luz/sombra y GLSL equivalente, caché PMREM, preparación de shaders con los mismos targets/fog que render, serialización, doble click, selección restaurada, cámara taller, assets/prefetch e integración de los cinco autos.
- **PC (`pc-loading-final/report.json`)**: carrera RUNNING, acelerador, pausa, lente manual 27 mm preservada tras resize, ciclo activo y seis cielos. Carga inicial de carrera **50.891 s**, frente a **71.834 s** en la primera medición de esta sesión. Son muestras locales orientativas, no un benchmark controlado de red/hardware.
- **Horario PC**: night 324.4 ms; clear 167.9 ms; night repetido 8.9 ms; golden-hour 627.2 ms; sunset 382.3 ms; moonrise 176.8 ms; overcast 253.7 ms. El salto anterior a clear duraba 43–49 s.
- **Competencia (`pc-final2/report.json`)**: carga del Falcon bajo demanda y llegada a RUNNING, sin errores. Ejecutada antes del último ajuste de preparación oculta; la carga del rival no cambió posteriormente.
- **Emulación iPhone (`mobile-final2/report.json`)**: carga 49.423 s, controles táctiles/pause, lente preservada, seis cielos 10–624.4 ms. AudioContext running y worker solicitado. Sin errores JS ni HTTP.
- **Intro DOM**: un video y rótulo HTML duplicado oculto. La prueba adicional que intentó buscar el segundo 38 del video venció por falta de seek; esa comprobación visual automatizada no se presenta como aprobada. El fotograma extraído del video final está en intro-before.png.
- **Capturas**: pc-loading-final/01-home.png y 02-driving.png; mobile-final2/01-home.png y 02-driving.png. Taller inicial visible sin un mueble delante de la cámara.
- **Inventario** actualizado y validado: 513 archivos, 791858946 bytes; esto verifica integridad de archivos, no toda la matriz de mapas.
- **Revisor independiente**: 8.5/10 técnico. No es una puntuación de fotorrealismo.

## Límites y entrega

La primera carga todavía ronda 50 s en este equipo de prueba y sigue siendo un área de mejora. No se afirma 60 FPS sostenidos. El navegador de prueba usa audio silenciado: se verificó el grafo de audio, sus buffers y estado, no una escucha en un teléfono. La emulación Chrome no reemplaza WebKit/iPhone físico. La entrega corresponde a la base v8 y conserva el historial de v7 en Git.
