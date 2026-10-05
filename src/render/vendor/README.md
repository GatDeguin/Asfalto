GTAOShader.js procede de https://github.com/mrdoob/three.js/blob/r180/examples/jsm/shaders/GTAOShader.js (Three.js r180, licencia MIT adjunta en THREE-LICENSE.txt).

gtao-shader-factory.mjs conserva su implementación y recibe el namespace Three desde el runtime local, evitando cargar una segunda copia del motor. screen-space-lighting.mjs adapta la lectura de profundidad logarítmica, limita los accesos de texel y los valores de horizonte; el filtro y la composición pertenecen a Asfalto Nacional.

FXAAShader.js procede de https://github.com/mrdoob/three.js/blob/r180/examples/jsm/shaders/FXAAShader.js (Three.js r180, licencia MIT adjunta). fxaa-shader-factory.mjs recibe el namespace del runtime local; adapta únicamente la luminancia perceptual de detección de bordes, el umbral/subpíxel y los chunks de salida. El muestreo de color conserva HDR lineal: no se aplica exposición ni tone mapping en el buffer intermedio. No hay segunda copia de Three ni dependencia de red.
