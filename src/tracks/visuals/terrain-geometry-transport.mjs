export function packTerrainGeometry(geometry, copy = false) {
  const pack = attribute => {
    if (!attribute) return null;
    const {itemSize, normalized} = attribute;
    let array = attribute.array;
    if (attribute.isInterleavedBufferAttribute) {
      const {array: source, stride} = attribute.data;
      array = new source.constructor(attribute.count * itemSize);
      for (let vertex = 0; vertex < attribute.count; vertex++) {
        const start = vertex * stride + attribute.offset;
        for (let component = 0; component < itemSize; component++) {
          array[vertex * itemSize + component] = source[start + component];
        }
      }
    } else if (copy) {
      array = array.slice();
    }
    return {array, itemSize, normalized};
  };
  return {position: pack(geometry.attributes.position), color: pack(geometry.attributes.color),
    normal: copy ? null : pack(geometry.attributes.normal), index: pack(geometry.index)};
}

export function unpackTerrainGeometry(THREE, data) {
  const geometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(data)) {
    if (!attribute) continue;
    const buffer = new THREE.BufferAttribute(attribute.array, attribute.itemSize, attribute.normalized);
    if (name === 'index') geometry.setIndex(buffer);
    else geometry.setAttribute(name, buffer);
  }
  return geometry;
}

export function terrainTransferList(data) {
  return [...new Set(Object.values(data).filter(Boolean).map(attribute => attribute.array.buffer))];
}
