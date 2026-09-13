// An off-axis phone viewport frames the real wheel without moving any cabin parts.
// The rig restores its base projection each frame and when switching camera modes.
export function applyPhoneCockpitProjection(camera){
 const portrait=camera.aspect<1;
 camera.fov=portrait?Math.min(camera.fov,98):Math.max(camera.fov,65);
 camera.updateProjectionMatrix();
 camera.projectionMatrix.elements[9]-=portrait?.20:.18;
 // Picking and depth reconstruction must use exactly the displayed frustum.
 camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}
