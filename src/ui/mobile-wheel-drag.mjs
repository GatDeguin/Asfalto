/** CSS-pixel travel from centre to one lock; called only for the phone profile. */
export function phoneWheelDragPixels(width,height){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return 104;
  return Math.max(90,Math.min(120,Math.round(Math.min(width,height)*.26)));
}
