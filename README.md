# Asfalto Nacional v7

Instantánea de desarrollo para Chrome. Incluye cinco circuitos, taller 3D, cockpit, tres vehículos seleccionables, campeonato narrativo de 5/10/15 etapas, colección de premios, pruebas de manejo y álbum. El plan de 100 mejoras y sus auditorías todavía no están completos.

## Ejecutar

Requiere Node.js 20.11 o superior y Chrome con aceleración gráfica.

~~~sh
git clone --branch v7 https://github.com/GatDeguin/Asfalto.git
cd Asfalto
node server.mjs
~~~

Abrir la dirección local indicada, normalmente http://127.0.0.1:4273/. En Windows también se puede ejecutar INICIAR_JUEGO.bat: busca un puerto entre 4273 y 4283. No abrir index.html mediante file:. La configuración inicial de cabina/iluminación está en assets/configuration; los cambios locales se guardan en .local-data/v7 y en el navegador. No se requieren archivos del workspace original.

## Estado

Consultar [estado de la versión](docs/v7/STATUS.md) y [los 100 puntos](docs/v7/PLAN-100.md). La primera revisión visual independiente dio 4,8/10. Las auditorías exhaustivas de autos y arquitectura siguen en curso; esta rama no representa una aprobación AAA/AAAA ni un benchmark de laptop.

Los modelos de trofeos aún preparados en Blender y la instrumentación nueva de latencia permanecen fuera de esta instantánea porque todavía no se integraron en el juego.

## Controles

W/flecha arriba: acelerador. S/flecha abajo: freno. A/D o flechas: dirección. Marchas, embrague, cámaras y ayudas muestran sus atajos dentro del juego. Escape abre la pausa. Taller→Fotografía permite inspeccionar el auto y la colección.

## Distribución

Se conserva el historial de v6 en main. Esta subida crea la rama v7 y no cambia la configuración de GitHub Pages. Los archivos son grandes porque incluyen todos los modelos, audio y texturas locales. Licencias y atribuciones de dependencias y materiales se conservan junto a sus activos; esta publicación no cambia esas licencias.
