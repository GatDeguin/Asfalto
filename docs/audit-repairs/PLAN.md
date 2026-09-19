# Reparación de auditoría 2026-09-19

Base publicada: 36d8c74638c3e588b1d6c68b0c4b56f123a9e2a3.
Autorización: corregir lo relevado y actualizar repositorio y Pages.

## Contratos globales
Preservar física v6/120 Hz, parámetros mecánicos, rutas/colisiones, controles,
calibraciones, assets y Three r180. Mantener publicación estática.
No ocultar fallos previos ni prometer FPS sin hardware.

## Secuencia y comprobación
1. A1: señal de cancelación desde sesión a manager/transportes; rechazar esperas
   bloqueadas; limpieza tardía sin commit obsoleto. Tests de aborto, timeout y reintento.
2. A2: frontera de fallo del RAF con pausa, liberación de entradas y regreso seguro.
   Tests de excepción, un solo bucle y recuperación explícita.
3. A3: reducción por sobrecarga severa sostenida (tiempo + muestras mínimas),
   conservando histéresis ordinaria y recuperación. Tests 30/60 FPS, picos y límites.
4. A4/A7: política verificable del renderer del taller y presupuesto nominal HDR
   compartido, aplicado antes de asignar. Tests de resize, DPR, LUT, MSAA y restauración.
5. A5: caché de preparación por contexto/escena/vehículo/políticas/variantes,
   no cachear fallo/aborto. Tests de reinicio, invalidación y cancelación.
6. A6: índice de proxies estáticos y actualización de objetos sucios; consulta
   espacial y top-k conservando exclusiones. Tests con instancias lejanas y movimientos.
7. Corregir diez fallos de suite: reparar fixtures de host, dependencia Three
   local, datos iniciales del servidor y contratos reales de vitrina; no relajar aserciones.
8. A8: suite completa estricta, validación de rutas y shaders antes de promoción;
   CI para cada cambio relevante y despliegue condicionado a validación.
9. Revisión integral, tests, evidencia de navegador en CI si está disponible,
   publicar solamente el árbol probado y confirmar el estado de Pages.

## Riesgos de integración a probar
Aborto durante selección y nuevo inicio; tarea obsoleta que resuelve tarde;
excepción mientras hay entradas activas; DPR alto con LUT; recursos compartidos;
cambio de circuito/vehículo/contexto; aislamiento de mocks sin tocar producción.
