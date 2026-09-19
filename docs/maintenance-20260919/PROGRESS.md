# Registro de ejecución — PLAN.md
Base reproducida: 193 tests; 183 pasan; 10 fallan (baseline.tap).
Revisión remota confirma gh-pages en 36d8c746.

## Implementación local comprobada
- A1: señal de cancelación y plazo propios por operación; cierre inmediato de la presentación; descarte/liberación tardía. Regresiones rojas y verdes guardadas.
- A2: frontera de fallo del bucle con pausa, liberación de entradas y recuperación explícita; un solo RAF.
- A3: emergencia tras 1.500 ms severos sostenidos y al menos ocho muestras; histéresis ordinaria conservada.
- A4/A7: política del renderer del taller y límites nominales conjuntos de HDR/profundidad/MSAA; diagnóstico de dimensiones reales.
- A5: caché de preparación limitada y con invalidación; preparación abortable y restauración de calidad.
- A6: proxies cacheados por objeto/buffer y consulta espacial; cámara/volúmenes/exclusiones conservados.
- A8: suite completa estricta, canario de fallo nuevo y flujo de promoción release/validated condicionado a contratos y navegador.
- Diez fallos previos resueltos: fixtures de host completos, Three r180 del propio proyecto, semillas locales publicadas y presupuesto geométrico de medallas.
- Reconciliación explícita de contratos: se mantienen dimensiones del cuerpo de la vitrina y se prueban aparte herrajes; se mide cara y anilla de medalla por separado; no se elimina el límite de 35.000 triángulos.
- Suite local final antes de navegador: 232 tests, 232 pasan, cero fallos/cancelados/omitidos. Grafo: 229 archivos, 323 aristas, cero destinos ausentes. Once hashes protegidos iguales.

## Decisiones de integración
La publicación actual continúa en gh-pages. El flujo nuevo promueve a esa rama solo después de validar release/validated y solicita su build de Pages. No se cambia el proveedor estático ni se imponen dependencias al jugador. La conexión no concede administración de branch protection (403 comprobado); este flujo no puede impedir un push directo del propietario por fuera de él.
La validación de navegador se realiza con assets completos en CI y ANGLE SwiftShader. No equivale a mediciones de GPU física ni a rendimiento móvil.
