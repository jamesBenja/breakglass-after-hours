/** Dispose an owned scene/model tree, including label and imported textures. */
export function disposeObject(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of [].concat(object.material ?? [])) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
    object.shadow?.dispose();
  });
  for (const resource of [...textures, ...materials, ...geometries]) resource.dispose();
  root.clear();
}
