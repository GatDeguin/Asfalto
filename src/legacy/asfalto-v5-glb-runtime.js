
(function publishGlbCore(root) {
  'use strict';

  async function decodePayloadById(documentRoot, id, decode) {
    if (!documentRoot || typeof documentRoot.getElementById !== 'function') {
      throw new Error('documento payload inválido: ' + id);
    }
    const node = documentRoot.getElementById(id);
    if (!node) throw new Error('payload ausente: ' + id);
    if (typeof decode !== 'function') throw new Error('decoder payload inválido: ' + id);
    if (node.dataset.encoding === "external-url") { const encoded = await globalThis.AsfaltoV6AssetCore.readExternalPayload(node); const decoded = await decode(encoded); node.textContent = ""; return decoded; } const encoded = node.textContent; const decoded = await decode(encoded); node.textContent = ""; return decoded;
  }

  const AsfaltoV5PayloadCore = Object.freeze({
    decodePayloadById,
  });

  function validateNodeGraph(json, label) {
    const definitions = Array.isArray(json.nodes) ? json.nodes : [];
    const meshes = Array.isArray(json.meshes) ? json.meshes : [];
    const parents = new Int32Array(definitions.length);
    parents.fill(-1);

    function requireNodeIndex(value, message) {
      if (!Number.isInteger(value) || value < 0 || value >= definitions.length) {
        throw new Error(label + ': ' + message + value);
      }
    }

    definitions.forEach((definition, nodeIndex) => {
      if (!definition || typeof definition !== 'object') {
        throw new Error(label + ': nodo GLB inválido ' + nodeIndex);
      }
      if (definition.mesh != null
          && (!Number.isInteger(definition.mesh)
            || definition.mesh < 0
            || definition.mesh >= meshes.length)) {
        throw new Error(
          label + ': índice mesh GLB inválido nodo ' + nodeIndex + ' mesh ' + definition.mesh,
        );
      }
      if (definition.children != null && !Array.isArray(definition.children)) {
        throw new Error(label + ': children GLB inválido nodo ' + nodeIndex);
      }
      for (const childIndex of definition.children || []) {
        requireNodeIndex(
          childIndex,
          'índice child GLB inválido nodo ' + nodeIndex + ' child ',
        );
        if (parents[childIndex] !== -1) {
          throw new Error(label + ': nodo GLB con múltiples padres ' + childIndex);
        }
        parents[childIndex] = nodeIndex;
      }
    });

    const state = new Uint8Array(definitions.length);
    function visit(nodeIndex) {
      if (state[nodeIndex] === 1) {
        throw new Error(label + ': ciclo en grafo GLB nodo ' + nodeIndex);
      }
      if (state[nodeIndex] === 2) return;
      state[nodeIndex] = 1;
      for (const childIndex of definitions[nodeIndex].children || []) visit(childIndex);
      state[nodeIndex] = 2;
    }
    for (let nodeIndex = 0; nodeIndex < definitions.length; nodeIndex += 1) {
      visit(nodeIndex);
    }

    if (json.scenes == null || (Array.isArray(json.scenes) && json.scenes.length === 0)) {
      return Object.freeze({
        definitions,
        rootIndices: definitions
          .map((_, nodeIndex) => nodeIndex)
          .filter(nodeIndex => parents[nodeIndex] === -1),
      });
    }
    if (!Array.isArray(json.scenes)) throw new Error(label + ': scenes GLB inválidas');
    json.scenes.forEach((scene, candidateSceneIndex) => {
      if (!scene || (scene.nodes != null && !Array.isArray(scene.nodes))) {
        throw new Error(label + ': escena GLB inválida ' + candidateSceneIndex);
      }
      for (const nodeIndex of scene.nodes || []) {
        requireNodeIndex(
          nodeIndex,
          'índice node GLB inválido escena ' + candidateSceneIndex + ' node ',
        );
        if (parents[nodeIndex] !== -1) {
          throw new Error(
            label + ': node GLB con padre no puede ser root escena '
              + candidateSceneIndex + ' node ' + nodeIndex,
          );
        }
      }
    });
    const sceneIndex = json.scene ?? 0;
    if (!Number.isInteger(sceneIndex) || sceneIndex < 0 || sceneIndex >= json.scenes.length) {
      throw new Error(label + ': índice escena GLB inválido ' + sceneIndex);
    }
    const rootIndices = json.scenes[sceneIndex].nodes || [];
    return Object.freeze({ definitions, rootIndices });
  }


  async function decodeMeshoptDocument(sourceJson, sourceBin, decoder, label = 'GLB') {
    const compressed = (sourceJson?.bufferViews || []).some(
      view => view?.extensions?.EXT_meshopt_compression,
    );
    if (!compressed) return Object.freeze({ json: sourceJson, bin: sourceBin });
    if (!decoder || !decoder.ready || typeof decoder.decodeGltfBuffer !== 'function') {
      throw new Error(label + ': MeshoptDecoder no disponible');
    }
    await decoder.ready;
    const json = JSON.parse(JSON.stringify(sourceJson));
    const views = json.bufferViews || [];
    const chunks = [];
    let totalLength = 0;
    const align4 = value => (value + 3) & ~3;

    for (let index = 0; index < views.length; index += 1) {
      const view = views[index];
      if (!view || !Number.isSafeInteger(view.byteLength) || view.byteLength < 0) {
        throw new Error(label + ': bufferView inválida ' + index);
      }
      totalLength = align4(totalLength);
      const target = new Uint8Array(view.byteLength);
      const extension = view.extensions?.EXT_meshopt_compression;
      if (extension) {
        const count = Number(extension.count);
        const stride = Number(extension.byteStride);
        const sourceOffset = Number(extension.byteOffset || 0);
        const sourceLength = Number(extension.byteLength);
        if (!Number.isSafeInteger(count) || count < 0
            || !Number.isSafeInteger(stride) || stride <= 0
            || count * stride !== view.byteLength
            || !Number.isSafeInteger(sourceOffset) || sourceOffset < 0
            || !Number.isSafeInteger(sourceLength) || sourceLength <= 0
            || sourceOffset + sourceLength > sourceBin.byteLength
            || Number(extension.buffer || 0) !== 0) {
          throw new Error(label + ': EXT_meshopt_compression inválida en bufferView ' + index);
        }
        const encoded = sourceBin.subarray(sourceOffset, sourceOffset + sourceLength);
        await decoder.decodeGltfBuffer(
          target,
          count,
          stride,
          encoded,
          extension.mode,
          extension.filter || 'NONE',
        );
        delete view.extensions.EXT_meshopt_compression;
        if (Object.keys(view.extensions).length === 0) delete view.extensions;
      } else {
        const sourceOffset = Number(view.byteOffset || 0);
        if (Number(view.buffer || 0) !== 0 || !Number.isSafeInteger(sourceOffset)
            || sourceOffset < 0 || sourceOffset + view.byteLength > sourceBin.byteLength) {
          throw new Error(label + ': bufferView externa no soportada ' + index);
        }
        target.set(sourceBin.subarray(sourceOffset, sourceOffset + view.byteLength));
      }
      chunks.push({ offset: totalLength, bytes: target });
      view.buffer = 0;
      view.byteOffset = totalLength;
      totalLength += target.byteLength;
    }

    const bin = new Uint8Array(align4(totalLength));
    for (const chunk of chunks) bin.set(chunk.bytes, chunk.offset);
    json.buffers = [{ byteLength: bin.byteLength }];
    for (const field of ['extensionsUsed', 'extensionsRequired']) {
      if (!Array.isArray(json[field])) continue;
      json[field] = json[field].filter(name => name !== 'EXT_meshopt_compression');
      if (json[field].length === 0) delete json[field];
    }
    return Object.freeze({ json, bin });
  }


  async function completeGlbToObject(THREE, bytes, label, helpers) {
    for (const name of ['parseGlb', 'makeAttribute', 'textureFromInfo']) {
      if (!helpers || typeof helpers[name] !== 'function') {
        throw new Error(label + ': helper GLB inválido ' + name);
      }
    }
    const { parseGlb, makeAttribute, textureFromInfo } = helpers;

    let { json, bin } = parseGlb(bytes);
    ({ json, bin } = await decodeMeshoptDocument(json, bin, helpers.meshoptDecoder, label));
    const graph = validateNodeGraph(json, label);
    const textureCache = new Map();

    async function loadTexture(info, srgb = false) {
      if (!info || info.index == null) return null;
      const transform = info.extensions?.KHR_texture_transform || null;
      const cacheKey = info.index + ':' + (srgb ? 'srgb' : 'linear')
        + ':' + JSON.stringify(transform);
      if (!textureCache.has(cacheKey)) {
        textureCache.set(
          cacheKey,
          textureFromInfo(THREE, json, bin, info, srgb),
        );
      }
      return textureCache.get(cacheKey);
    }

    const materials = await Promise.all((json.materials || []).map(async (definition, index) => {
      const pbr = definition.pbrMetallicRoughness || {};
      const extensions = definition.extensions || {};
      const clearcoat = extensions.KHR_materials_clearcoat;
      const transmission = extensions.KHR_materials_transmission;
      const ior = extensions.KHR_materials_ior;
      const emissiveStrength = extensions.KHR_materials_emissive_strength?.emissiveStrength ?? 1;
      const PhysicalMaterial = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;
      const MaterialType = clearcoat || transmission || ior
        ? PhysicalMaterial
        : THREE.MeshStandardMaterial;
      const base = pbr.baseColorFactor || [1, 1, 1, 1];
      const emissive = definition.emissiveFactor || [0, 0, 0];
      const [map, metalRoughMap, normalMap, emissiveMap, occlusionMap] = await Promise.all([
        loadTexture(pbr.baseColorTexture, true),
        loadTexture(pbr.metallicRoughnessTexture, false),
        loadTexture(definition.normalTexture, false),
        loadTexture(definition.emissiveTexture, true),
        loadTexture(definition.occlusionTexture, false),
      ]);
      const material = new MaterialType({
        name: definition.name || 'Material_' + index,
        color: new THREE.Color(base[0], base[1], base[2]),
        opacity: base[3] ?? 1,
        transparent: definition.alphaMode === 'BLEND'
          || (base[3] ?? 1) < 1
          || (transmission?.transmissionFactor ?? 0) > 0,
        alphaTest: definition.alphaMode === 'MASK' ? (definition.alphaCutoff ?? 0.5) : 0,
        depthWrite: definition.alphaMode !== 'BLEND',
        side: definition.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
        map,
        metalness: pbr.metallicFactor ?? 1,
        roughness: pbr.roughnessFactor ?? 1,
        metalnessMap: metalRoughMap,
        roughnessMap: metalRoughMap,
        normalMap,
        emissive: new THREE.Color(emissive[0], emissive[1], emissive[2]),
        emissiveMap,
        emissiveIntensity: emissiveStrength,
        aoMap: occlusionMap,
        aoMapIntensity: definition.occlusionTexture?.strength ?? 1,
      });
      if (normalMap && material.normalScale) {
        const scale = definition.normalTexture?.scale ?? 1;
        material.normalScale.set(scale, scale);
      }
      if (clearcoat && 'clearcoat' in material) {
        material.clearcoat = clearcoat.clearcoatFactor ?? 0;
        material.clearcoatRoughness = clearcoat.clearcoatRoughnessFactor ?? 0;
      }
      if (transmission && 'transmission' in material) {
        material.transmission = transmission.transmissionFactor ?? 0;
      }
      if (ior && 'ior' in material) material.ior = ior.ior ?? 1.5;
      return material;
    }));
    const fallbackMaterial = new THREE.MeshStandardMaterial({
      name: 'Material_Default',
      color: 0xffffff,
      roughness: 0.8,
      metalness: 0.05,
    });

    const vertexColorVariants = new Map();

    function materialForPrimitive(primitive, meshIndex, primitiveIndex) {
      let baseMaterial = fallbackMaterial;
      if (primitive.material != null) {
        const materialIndex = primitive.material;
        if (!Number.isInteger(materialIndex)
            || materialIndex < 0
            || materialIndex >= materials.length) {
          throw new Error(
            label + ': material GLB inválido mesh ' + meshIndex
              + ' primitiva ' + primitiveIndex + ' índice ' + materialIndex,
          );
        }
        baseMaterial = materials[materialIndex];
      }
      if (primitive.attributes?.COLOR_0 == null) return baseMaterial;
      if (!vertexColorVariants.has(baseMaterial)) {
        const variant = baseMaterial.clone();
        variant.vertexColors = true;
        vertexColorVariants.set(baseMaterial, variant);
      }
      return vertexColorVariants.get(baseMaterial);
    }


    const meshTemplates = (json.meshes || []).map((meshDefinition, meshIndex) => {
      const group = new THREE.Group();
      group.name = meshDefinition.name || 'Mesh_' + meshIndex;
      for (const [primitiveIndex, primitive] of (meshDefinition.primitives || []).entries()) {
        if ((primitive.mode ?? 4) !== 4 || primitive.attributes?.POSITION == null) {
          throw new Error(label + ': primitiva GLB no soportada ' + primitiveIndex);
        }
        const geometry = new THREE.BufferGeometry();
        const semanticNames = {
          POSITION: 'position',
          NORMAL: 'normal',
          TEXCOORD_0: 'uv',
          TEXCOORD_1: 'uv2',
          COLOR_0: 'color',
          TANGENT: 'tangent',
        };
        for (const [semantic, accessorIndex] of Object.entries(primitive.attributes)) {
          const attributeName = semanticNames[semantic];
          if (attributeName) {
            geometry.setAttribute(
              attributeName,
              makeAttribute(THREE, json, bin, accessorIndex),
            );
          }
        }
        if (primitive.indices != null) {
          geometry.setIndex(makeAttribute(THREE, json, bin, primitive.indices));
        }
        if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        const object = new THREE.Mesh(
          geometry,
          materialForPrimitive(primitive, meshIndex, primitiveIndex),
        );
        object.name = group.name + '_Primitive_' + primitiveIndex;
        object.castShadow = false;
        object.receiveShadow = true;
        group.add(object);
      }
      return group;
    });

    const nodes = graph.definitions.map((definition, index) => {
      const object = definition.mesh != null
        ? meshTemplates[definition.mesh].clone(true)
        : new THREE.Group();
      object.name = definition.name || 'Node_' + index;
      // Controls and mechanical ownership belong to nodes, including instanced meshes.
      if(definition.extras && typeof definition.extras==='object' && !Array.isArray(definition.extras)) {
        object.userData={...object.userData,...JSON.parse(JSON.stringify(definition.extras))};
      }
      if (definition.matrix) {
        object.matrix.fromArray(definition.matrix);
        object.matrixAutoUpdate = false;
      } else {
        if (definition.translation) object.position.fromArray(definition.translation);
        if (definition.rotation) object.quaternion.fromArray(definition.rotation);
        if (definition.scale) object.scale.fromArray(definition.scale);
      }
      return object;
    });
    graph.definitions.forEach((definition, index) => {
      for (const childIndex of definition.children || []) {
        nodes[index].add(nodes[childIndex]);
      }
    });
    const sceneRoot = new THREE.Group();
    sceneRoot.name = label;
    for (const nodeIndex of graph.rootIndices) sceneRoot.add(nodes[nodeIndex]);
    sceneRoot.updateMatrixWorld(true);
    return sceneRoot;
  }

  function createCollisionProbe(THREE, collisionRoot) {
    if (!THREE || typeof THREE.Raycaster !== 'function'
        || typeof THREE.Vector3 !== 'function') {
      throw new Error('THREE invalido para collision probe');
    }
    if (!collisionRoot || typeof collisionRoot.traverse !== 'function') {
      throw new Error('collisionRoot invalido');
    }
    const meshes = [];
    collisionRoot.traverse(object => {
      if (object?.isMesh) meshes.push(object);
    });
    const raycaster = new THREE.Raycaster();
    const origin = new THREE.Vector3();
    const down = new THREE.Vector3(0, -1, 0);
    const forward = new THREE.Vector3(0, 0, -1);
    const result = {
      groundHit: false,
      groundDistance: null,
      collided: false,
      obstacleDistance: null,
    };
    let sampleCount = 0;

    function sample({ roadY = -1.035, viewZ = 1.35, speedMps = 0 } = {}) {
      collisionRoot.updateMatrixWorld?.(true);
      origin.set(0, roadY + 3, viewZ);
      raycaster.set(origin, down);
      raycaster.far = 6;
      const ground = raycaster.intersectObjects(meshes, false)[0] || null;
      origin.set(0, roadY + 0.65, viewZ);
      raycaster.set(origin, forward);
      raycaster.far = Math.max(1.25, Math.min(8, speedMps * 0.12));
      const obstacle = raycaster.intersectObjects(meshes, false)[0] || null;
      result.groundHit = Boolean(ground);
      result.groundDistance = ground?.distance ?? null;
      result.collided = Boolean(obstacle && obstacle.distance <= 1.25);
      result.obstacleDistance = obstacle?.distance ?? null;
      sampleCount += 1;
      return result;
    }

    function getState() {
      return Object.freeze({
        sampleCount,
        lastResult: Object.freeze({ ...result }),
      });
    }
    return Object.freeze({ meshCount: meshes.length, sample, getState });
  }

  function createCollisionImpactBridge(probe) {
    if (!probe || typeof probe.sample !== 'function') {
      throw new Error('collision probe invalido');
    }
    const intervalSeconds = 1 / 20;
    const result = {
      sampled: false,
      impacted: false,
      suppressed: false,
      sample: null,
    };
    let accumulator = 0;
    let latched = false;
    let sampleCount = 0;

    function update(deltaSeconds, context = {}) {
      result.sampled = false;
      result.impacted = false;
      result.suppressed = false;
      accumulator += Math.max(0, Number(deltaSeconds) || 0);
      if (accumulator + 1e-9 < intervalSeconds) return result;
      accumulator = 0;
      result.sampled = true;
      result.sample = probe.sample(context);
      sampleCount += 1;
      if (!result.sample?.collided) {
        latched = false;
        return result;
      }
      if (context.raceStatus !== 'RUNNING') {
        result.suppressed = true;
        return result;
      }
      result.suppressed = latched || Boolean(context.routeBarrierImpact);
      latched = true;
      if (!result.suppressed && typeof context.onImpact === 'function') {
        context.onImpact(result.sample);
        result.impacted = true;
      }
      return result;
    }

    function getState() {
      return Object.freeze({ latched, sampleCount });
    }
    return Object.freeze({ update, getState });
  }

  root.AsfaltoV5PayloadCore = AsfaltoV5PayloadCore;
  root.AsfaltoV5GlbCore = Object.freeze({
    completeGlbToObject,
    decodeMeshoptDocument,
    createCollisionImpactBridge,
    createCollisionProbe,
  });
}(globalThis));
