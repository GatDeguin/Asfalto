GTAOShader.js procede de https://github.com/mrdoob/three.js/blob/r180/examples/jsm/shaders/GTAOShader.js (Three.js r180, licencia MIT adjunta en THREE-LICENSE.txt).

gtao-shader-factory.mjs conserva su implementación y recibe el namespace Three desde el runtime local, evitando cargar una segunda copia del motor. screen-space-lighting.mjs adapta la lectura de profundidad logarítmica, limita los accesos de texel y los valores de horizonte; el filtro y la composición pertenecen a Asfalto Nacional.
