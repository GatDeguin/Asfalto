// Requested quality is not a synonym for a hardware capability or a physics preset.
export const GRAPHICS_QUALITY_LABELS=Object.freeze({auto:'Adaptativo',cinematic:'Cinemática / Ultra',high:'Alto',balanced:'Equilibrado',low:'Bajo',off:'Apagado'});
export const GRAPHICS_QUALITY_RANKS=Object.freeze({off:-1,low:0,balanced:1,high:2,cinematic:3});
/** Secondary captures, particles and geometry keep the measured High budget.
 * This explicit mapping prevents an unknown Cinematic value falling to Balanced.
 * Do not pass a presentation-only tier into physical streaming or simulation. */
export const graphicsQualityFamily=tier=>tier==='cinematic'?'high':tier;
export const isHighGraphicsQuality=tier=>graphicsQualityFamily(tier)==='high';
