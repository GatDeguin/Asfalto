# Asfalto Nacional V6 — paquete completo

Se recibieron y verificaron los 75 bloques del juego completo: **466981830 bytes** con compresión sin pérdida. Contienen los **477 archivos originales** de la versión preparada para GitHub Pages, incluidos los cinco circuitos, el taller, los modelos, las texturas, el cockpit, la música y la introducción.

Commit del juego: `02843a9ab632ec7183143f6b3b3272e6aa243116`.

SHA-256 del paquete ensamblado: `b895c2829d3ab48575321f54dec31b4660bfeb0822dea7381d2928970cfc0aad`.

El manifiesto `.github/game-import/manifest.json` indica el orden, tamaño y SHA-256 de cada bloque. El paquete se reconstruye concatenando los bloques en ese orden; el resultado es un Git bundle completo.

La versión preparada pasó las pruebas locales de los cinco circuitos, el taller y el guardado en el navegador. El ciclo día/noche está configurado en 12 minutos. El proceso de importación está documentado en [IMPORTACION.md](IMPORTACION.md).
