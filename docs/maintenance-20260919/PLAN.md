# Correcciones de la auditoría de Asfalto (19-09-2026)

Base publicada: 36d8c74638c3e588b1d6c68b0c4b56f123a9e2a3.
Solicitud: corregir A1–A8 y los tests relevados; actualizar repositorio y Pages tras verificar.

## Contratos preservados
Three r180, juego estático, assets/rutas/colisiones y parámetros físicos 120 Hz sin cambios.
Conservar preferencias, máscaras de pintura, profundidad del cockpit y procesamiento de color.
No convertir las pruebas CPU/SwiftShader en afirmaciones de FPS de GPU física.

## Secuencia y comprobaciones
1. A1: señal hasta track manager, esperas acotadas, resultados tardíos sin commit, cierre inmediato de presentación; tests de timeout, cancelación, retry y unload.
2. A2: frontera de fallo del bucle, suspensión de controles/audio, recuperación explícita sin duplicar RAF; inyección de fallo.
3. A3: reducción de emergencia por tiempo sostenido (no por un tirón), recuperación normal conservada; pruebas 30/60 FPS y caps.
4. A4/A7: política del renderer del taller y presupuesto global de píxeles/targets HDR con diagnóstico; pruebas DPR, resize, perfiles y liberación.
5. A5: cache de preparación por escena, variante y contexto; cancelación/error nunca cacheados.
6. A6: índice espacial de proxies estáticos e invalidación de objetos/instancias/matrices; equivalencia geométrica y benchmark de refresco estático.
7. Tests previos: corregir fixtures/paths del checkout y causa de contratos de vitrina sin suprimir aserciones.
8. A8: suite estricta, validación en CI y publicación condicionada al resultado; pruebas del gate y artefactos identificados por SHA.
9. Revisar diff completo, pruebas de navegador con assets reales disponibles en CI, integridad de archivos protegidos, publicación y verificación del despliegue.

## Riesgos revisados
Cancelación mientras una promesa ignora la señal: liberar UI y descartar la continuación, no fingir que abort() deshace trabajo síncrono.
Refrescos de geometría dinámica/streaming no pueden dejar proxies obsoletos.
Pérdida de contexto/resize invalida preparación y presupuestos, no preferencias.
Los archivos ausentes del paquete fuente local no son assets eliminados: validar el checkout completo remoto en CI.
