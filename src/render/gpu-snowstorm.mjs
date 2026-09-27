export const SNOW_VERTEX_GLSL = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>

attribute vec4 aSeed;
uniform float u_time, uPointScale, uGravity;
uniform float uOpacity, uEnclosed, uGround;
uniform vec3 uWind, uExtent;
uniform mat4 uCarInverse;
varying float vFade, vSeed;
varying vec3 vWorld;

void main() {
  float seed = aSeed.w;
  // Gravity with linear air drag at terminal velocity: v = g / k.
  // Steady settling avoids unbounded acceleration and per-flake state.
  float inverseDrag = .102 + seed * .224;
  float terminalSpeed = max(0., uGravity) * inverseDrag;
  vec3 drift = vec3(uWind.x, -terminalSpeed, uWind.z);

  // World-space trajectories in a camera-centered volume.
  vec3 world = mod(
    position + drift * u_time - cameraPosition + uExtent * .5, uExtent
  ) - uExtent * .5 + cameraPosition;
  vec2 phase = aSeed.xy * 6.2831853;
  world.xz += sin(vec2(.71, .53) * u_time + phase) * (.4 + seed)
            + sin(vec2(1.61, 1.37) * u_time + phase.yx * 3.) * .17;

  vec3 relative = abs((world - cameraPosition) / (uExtent * .5));
  float border = 1. - smoothstep(
    .72, 1., max(relative.x, max(relative.y, relative.z))
  );
  float nearFade = smoothstep(.45, 1.4, length(world - cameraPosition));
  float groundFade = smoothstep(-.05, .25, world.y - uGround);
  vFade = border * nearFade * groundFade * uOpacity;

  // Once per vertex, rather than once per covered fragment.
  vec3 car = (uCarInverse * vec4(world, 1.)).xyz;
  if (uEnclosed > .5 && abs(car.x) < 1.75 && abs(car.z) < .91
      && car.y > -.4 && car.y < 1.4) vFade = 0.;

  vSeed = seed;
  vWorld = world;
  vec4 mvPosition = viewMatrix * vec4(world, 1.);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = clamp(
    (.035 + seed * .055) * uPointScale / max(.1, -mvPosition.z), 1., 32.
  );
  #include <logdepthbuf_vertex>
  // Clipped points never launch fragment work.
  if (vFade < .005) gl_Position = vec4(2., 2., 2., 1.);
}
`;

export const SNOW_FRAGMENT_GLSL = /* glsl */ `
#include <logdepthbuf_pars_fragment>

uniform vec3 uLightDirection, uLightColor, uAmbient;
uniform float uLightIntensity;
varying float vFade, vSeed;
varying vec3 vWorld;

void main() {
  // Analytic coverage: no sprite texture or simulation here.
  vec2 p = gl_PointCoord * 2. - 1.;
  float r2 = dot(p, p);
  float aa = max(fwidth(r2), .015);
  float alpha = (1. - smoothstep(.55 - aa, 1. + aa, r2)) * vFade;
  if (alpha < .005) discard;

  vec3 eye = cameraPosition - vWorld;
  vec3 toCamera = eye * inversesqrt(max(dot(eye, eye), .000001));
  vec3 toLight = uLightDirection
              * inversesqrt(max(dot(uLightDirection, uLightDirection), .000001));
  float mu = clamp(dot(toLight, toCamera), -1., 1.);
  float diffuse = .32 + .68 * abs(mu);
  float forwardScattering = pow(max(0., -mu), 6.);
  vec3 radiance = uAmbient + uLightColor * max(0., uLightIntensity)
                * (diffuse * .25 + forwardScattering * .18);

  gl_FragColor = vec4(radiance * (.84 + vSeed * .16), alpha);
  #include <logdepthbuf_fragment>
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

/**
 * One Points object, one material, one draw per camera pass.
 * Static attributes; update() only changes u_time.
 *
 * uniforms accepts existing { value: ... } objects by reference. The sky owns
 * uLightDirection (world-space vector TOWARD sun/moon), uLightColor (linear),
 * uLightIntensity and uAmbient. Its existing 720-second clock is authoritative.
 * Three supplies camera matrices/position; no CPU loop updates flakes.
 *
 * Positions intentionally stay world-space even inside a transformed parent.
 * Call setCount() to enable, resize() on viewport/FOV changes, dispose() on exit.
 */
export function createGpuSnowstorm(T, parent, {
  capacity = 10000,
  uniforms: borrowed = {}
} = {}) {
  capacity = Math.max(1, Math.min(10000, capacity | 0));
  const positions = new Float32Array(capacity * 3);
  const seeds = new Float32Array(capacity * 4);
  let rng = 0x1374fa;
  const random = () => {
    rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
    return rng / 4294967296;
  };
  // Initialization only: no attribute uploads during flight.
  for (let i = 0; i < capacity; i++) {
    positions[i * 3] = random() * 42;
    positions[i * 3 + 1] = random() * 24;
    positions[i * 3 + 2] = random() * 48;
    for (let j = 0; j < 4; j++) seeds[i * 4 + j] = random();
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new T.BufferAttribute(seeds, 4));
  geometry.setDrawRange(0, 0);

  const uniforms = {
    u_time: { value: 0 },
    uPointScale: { value: 600 },
    uGravity: { value: 9.81 },
    uWind: { value: new T.Vector3(2, 0, .5) },
    uExtent: { value: new T.Vector3(42, 24, 48) },
    uLightDirection: { value: new T.Vector3(.4, .8, .2).normalize() },
    uLightColor: { value: new T.Color(1, 1, 1) },
    uLightIntensity: { value: 1 },
    uAmbient: { value: new T.Color(.12, .14, .18) },
    uOpacity: { value: .6 },
    uCarInverse: { value: new T.Matrix4() },
    uEnclosed: { value: 0 },
    uGround: { value: -100000 },
    ...borrowed
  };
  const material = new T.ShaderMaterial({
    name: 'AN_GPU_Snowstorm', uniforms,
    vertexShader: SNOW_VERTEX_GLSL,
    fragmentShader: SNOW_FRAGMENT_GLSL,
    transparent: true, depthTest: true, depthWrite: false
  });
  const mesh = new T.Points(geometry, material);
  mesh.name = 'AN_GPU_Snowstorm_10000';
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.castShadow = false;
  mesh.userData.asfaltoPrewarm = true;
  parent.add(mesh);

  let disposed = false, drawCount = 0, lastHeight = 0, lastFov = 0;
  return {
    mesh,
    uniforms,
    update(seconds) {
      if (!disposed && Number.isFinite(seconds)) uniforms.u_time.value = seconds;
    },
    setCount(count) {
      if (disposed) return;
      const next = Math.max(0, Math.min(capacity, count | 0));
      if (next === drawCount) return;
      drawCount = next;
      geometry.setDrawRange(0, next);
      mesh.visible = next > 0;
    },
    resize(pixelHeight, fovRadians) {
      if (disposed || !(pixelHeight > 0) || !(fovRadians > 0 && fovRadians < Math.PI)) return;
      if (pixelHeight === lastHeight && fovRadians === lastFov) return;
      lastHeight = pixelHeight;
      lastFov = fovRadians;
      uniforms.uPointScale.value = pixelHeight / (2 * Math.tan(fovRadians * .5));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mesh.removeFromParent();
      geometry.dispose();
      material.dispose();
      // Borrowed sky uniforms remain owned by the sky controller.
    }
  };
}

