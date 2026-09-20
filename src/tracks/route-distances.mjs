export function wrapRouteDistance(value, length) {
  return ((value % length) + length) % length;
}
export function signedRouteDistance(from, to, length) {
  return wrapRouteDistance(to-from+length*.5,length)-length*.5;
}
