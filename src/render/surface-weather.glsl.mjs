/** onBeforeCompile helpers. Vertex/fragment normals use different spaces. */
export const WEATHER_VERTEX_FRAME = /* glsl */ `
// transformedNormal exists after defaultnormal_vertex; Three has applied normals.
vAnFxWorldNormal = inverseTransformDirection(transformedNormal, viewMatrix);
vAnFxSlope = max(0., vAnFxWorldNormal.y);
`;

export const WEATHER_NORMAL_HELPERS = /* glsl */ `
// heightGradient.xy = (dH/dx, dH/dy), evaluated outside varying control flow.
// Normals and position derivatives are in VIEW space.
vec3 anPerturbWeatherNormal(
  vec3 baseNormal, vec3 positionDx, vec3 positionDy, vec2 heightGradient
) {
  vec3 tangentX = cross(positionDy, baseNormal);
  vec3 tangentY = cross(baseNormal, positionDx);
  float determinant = dot(positionDx, tangentX);
  vec3 perturbed = max(abs(determinant), 1e-8)*baseNormal
                - sign(determinant)*(heightGradient.x*tangentX + heightGradient.y*tangentY);
  return normalize(perturbed);
}
`;

