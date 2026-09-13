const details = new WeakMap();
const OPTIONAL_DETAIL = new Set(['NATURAL_ROCK', 'NATURAL_SHRUB', 'NATURAL_GRASS']);
export function updateSectorVisualQuality(root, { quality = 'balanced' } = {}) {
  let records = details.get(root);
  if (!records) {
    records = [];
    root.traverse?.(node => {
      if (node.isMesh && OPTIONAL_DETAIL.has(node.userData?.semantic)) {
        records.push({ node, visible: node.visible });
      }
    });
    details.set(root, records);
  }
  const show = quality !== 'low';
  for (const record of records) record.node.visible = show && record.visible;
  // Never hide the sector root: its road and terrain must remain available to mirrors.
  if (root.userData) root.userData.asfaltoSectorQuality = { quality, optionalDetails: records.length, detailVisible: show };
}
