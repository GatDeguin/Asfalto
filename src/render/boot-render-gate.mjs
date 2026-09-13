/** A phone must apply its saved quality and viewport budget before its first GPU submission. */
export function createBootRenderGate(defer=false){let ready=!defer;return Object.freeze({allowed:()=>ready,release(){ready=true;}});}
