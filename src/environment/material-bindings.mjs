const ROLES = new Set(['asphalt', 'shoulder', 'terrain', 'water', 'snow']);

export function collectMaterialBindings(roots, roleNames = {}) {
  const list = Array.isArray(roots) ? roots : [roots];
  const byName = new Map();
  for (const [role, names] of Object.entries(roleNames)) {
    if (!ROLES.has(role) || !Array.isArray(names)) throw new TypeError('invalid authored material role map');
    for (const name of names) {
      if (typeof name !== 'string' || name.length === 0 || byName.has(name)) throw new TypeError('invalid or duplicate authored material name');
      byName.set(name, role);
    }
  }
  const seen = new Set();
  const bindings = [];
  for (const root of list) {
    if (!root) continue;
    if (typeof root.traverse !== 'function') throw new TypeError('invalid adapter-owned visual root');
    root.traverse(object => {
      if (!object?.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        const role = material && byName.get(material.name || '');
        if (!role || seen.has(material)) continue;
        seen.add(material);
        bindings.push(Object.freeze({ role, material }));
      }
    });
  }
  return Object.freeze(bindings);
}
