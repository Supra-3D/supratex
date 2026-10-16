import * as THREE from 'three';

// A GLB POSITION accessor may retain unreferenced vertices after simplification.
// Only vertices belonging to finite, non-degenerate, rendered triangles count.
const sourceTransforms = new WeakMap();
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
const ab = new THREE.Vector3(), ac = new THREE.Vector3();

function actualBounds(root) {
  root.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3();
  root.traverse(node => {
    if (!node.isMesh || !node.geometry?.attributes.position) return;
    const geometry = node.geometry, positions = geometry.attributes.position;
    const indices = geometry.index, count = indices ? indices.count : positions.count;
    const visited = new Uint8Array(positions.count);
    const start = Math.max(0, geometry.drawRange.start);
    const end = Math.min(count, start + geometry.drawRange.count);
    const ranges = Array.isArray(node.material) && geometry.groups.length
      ? geometry.groups.filter(group => node.material[group.materialIndex]?.visible !== false)
      : [{ start, count: end - start }];
    for (const range of ranges) {
      const from = Math.max(start, range.start), to = Math.min(end, range.start + range.count);
      for (let i = from; i + 2 < to; i += 3) {
        const ia = indices ? indices.getX(i) : i;
        const ib = indices ? indices.getX(i + 1) : i + 1;
        const ic = indices ? indices.getX(i + 2) : i + 2;
        a.fromBufferAttribute(positions, ia); b.fromBufferAttribute(positions, ib); c.fromBufferAttribute(positions, ic);
        ab.subVectors(b, a); ac.subVectors(c, a);
        const areaSquared = ab.cross(ac).lengthSq();
        if (!Number.isFinite(areaSquared) || areaSquared <= 1e-28) continue;
        for (const index of [ia, ib, ic]) {
          if (visited[index]) continue;
          visited[index] = 1;
          a.fromBufferAttribute(positions, index).applyMatrix4(node.matrixWorld);
          bounds.expandByPoint(a);
        }
      }
    }
  });
  if (bounds.isEmpty()) throw new Error('The exhibit has no valid surface geometry.');
  return bounds;
}

/**
 * Fit a static GLB to the available display volume, then put its lowest actual
 * triangle exactly on the plinth. No mesh is cut, flattened or lifted.
 * width/depth/height are maximum OBJECT dimensions, not plinth dimensions.
 * Call after attaching root to its parent. Repeated calls are idempotent.
 * pitch/roll are world X/Z corrections in RADIANS applied AFTER rotationY.
 * Their order is Rx(pitch) * Rz(roll) * Ry(rotationY) * sourceQuaternion.
 * This allows an existing slanted base to be levelled without cutting it.
 */
export function settleExhibit(root, { x, z, top, width, depth, height, rotationY = Math.PI, pitch = 0, roll = 0 }) {
  let source = sourceTransforms.get(root);
  if (!source) {
    source = { position: root.position.clone(), quaternion: root.quaternion.clone(), scale: root.scale.clone() };
    sourceTransforms.set(root, source);
  }
  root.position.copy(source.position); root.quaternion.copy(source.quaternion); root.scale.copy(source.scale);
  root.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY));
  root.quaternion.premultiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, 0, roll, 'XYZ')));
  const bounds = actualBounds(root), size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min(width / Math.max(size.x, 1e-9), depth / Math.max(size.z, 1e-9), height / Math.max(size.y, 1e-9));
  const origin = root.getWorldPosition(new THREE.Vector3());
  bounds.min.sub(origin).multiplyScalar(scale).add(origin);
  bounds.max.sub(origin).multiplyScalar(scale).add(origin);
  const center = bounds.getCenter(new THREE.Vector3());
  const shift = new THREE.Vector3(x - center.x, top - bounds.min.y, z - center.z);
  root.scale.multiplyScalar(scale);
  const worldPosition = origin.add(shift);
  root.position.copy(root.parent ? root.parent.worldToLocal(worldPosition) : worldPosition);
  root.updateWorldMatrix(true, true);
  bounds.translate(shift); bounds.getCenter(center); bounds.getSize(size);
  const result = {
    bounds, center, radius: size.length() / 2, minY: bounds.min.y,
    contactGap: bounds.min.y - top, scale,
    footprint: { minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z, width: size.x, depth: size.z }
  };
  root.userData.exhibitGrounding = result;
  return result;
}

function canvas(size) {
  const image = document.createElement('canvas'); image.width = image.height = size;
  return image;
}

/**
 * Bake a one-off contact shadow from the actual mesh underside. An orthographic
 * camera looks upward, so the depth buffer retains the lowest surface at each
 * x/z location (a top-down nearest-surface render would retain the roof/head).
 * The height map is softened in four physical height bands: feet stay dark and
 * crisp; overhangs become light and diffuse. This is not an oval decal.
 *
 * Returns a normal THREE.Mesh. Its CanvasTexture has no retained render target.
 * Either use your regular geometry/material/map disposer, OR call
 * mesh.userData.disposeContactShadow(), which also removes the mesh.
 */
export function createContactShadow(renderer, root, { top, x, z, width, depth }) {
  const resolution = 256;
  const bounds = root.userData.exhibitGrounding?.bounds || actualBounds(root);
  const heightRange = Math.max(.5, bounds.max.y - top + .02);
  const target = new THREE.WebGLRenderTarget(resolution, resolution, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
    depthBuffer: true, stencilBuffer: false
  });
  const bakeScene = new THREE.Scene();
  const bakeMaterial = new THREE.ShaderMaterial({
    uniforms: { surfaceY: { value: top }, heightRange: { value: heightRange } },
    vertexShader: `varying float surfaceHeight; uniform float surfaceY;
      void main() { vec4 world = modelMatrix * vec4(position, 1.0);
        surfaceHeight = max(0.0, world.y - surfaceY);
        gl_Position = projectionMatrix * viewMatrix * world; }`,
    fragmentShader: `varying float surfaceHeight; uniform float heightRange;
      void main() { gl_FragColor = vec4(surfaceHeight / heightRange, 0.0, 0.0, 1.0); }`,
    side: THREE.DoubleSide, depthTest: true, depthWrite: true, toneMapped: false
  });
  root.updateWorldMatrix(true, true);
  root.traverse(node => {
    if (!node.isMesh || !node.geometry) return;
    // Geometry is shared read-only; only these temporary mesh wrappers are new.
    const proxy = new THREE.Mesh(node.geometry, bakeMaterial);
    proxy.matrixAutoUpdate = false; proxy.matrix.copy(node.matrixWorld); proxy.frustumCulled = false;
    bakeScene.add(proxy);
  });
  const camera = new THREE.OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, .001, heightRange + .1);
  camera.position.set(x, top - .05, z); camera.up.set(0, 0, -1); camera.lookAt(x, top + 1, z);
  const previous = {
    target: renderer.getRenderTarget(),
    cubeFace: renderer.getActiveCubeFace(), mipLevel: renderer.getActiveMipmapLevel(),
    clearColor: renderer.getClearColor(new THREE.Color()),
    clearAlpha: renderer.getClearAlpha(), autoClear: renderer.autoClear,
    xr: renderer.xr.enabled, shadows: renderer.shadowMap.enabled
  };
  const pixels = new Uint8Array(resolution * resolution * 4);
  try {
    renderer.xr.enabled = false; renderer.shadowMap.enabled = false; renderer.autoClear = true;
    // Target-local viewport/scissor state uses physical pixels and is independent
    // of the display DPR. Leave the renderer's display state untouched.
    renderer.setRenderTarget(target); renderer.setClearColor(0xffffff, 1);
    renderer.clear(); renderer.render(bakeScene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, resolution, resolution, pixels);
  } finally {
    renderer.setRenderTarget(previous.target, previous.cubeFace, previous.mipLevel);
    renderer.setClearColor(previous.clearColor, previous.clearAlpha);
    renderer.autoClear = previous.autoClear; renderer.xr.enabled = previous.xr;
    renderer.shadowMap.enabled = previous.shadows;
    target.dispose(); bakeMaterial.dispose(); bakeScene.clear();
  }

  const result = canvas(resolution), ctx = result.getContext('2d');
  // Pixel metres control softness independently of display or device resolution.
  const metresPerPixel = Math.max(width, depth) / resolution;
  const bands = [
    { falloff: .012, alpha: .47, blur: .003 },
    { falloff: .035, alpha: .23, blur: .014 },
    { falloff: .095, alpha: .12, blur: .038 },
    { falloff: .22, alpha: .035, blur: .075 }
  ];
  // The below-facing camera reverses X; GPU rows start at the bottom. Reverse
  // both axes to match PlaneGeometry after its -90 degree X rotation.
  for (const band of bands) {
    const layer = canvas(resolution), layerCtx = layer.getContext('2d');
    const raster = layerCtx.createImageData(resolution, resolution);
    for (let row = 0; row < resolution; row++) for (let col = 0; col < resolution; col++) {
      const sourcePixel = ((resolution - 1 - row) * resolution + resolution - 1 - col) * 4;
      const destination = (row * resolution + col) * 4;
      if (pixels[sourcePixel] === 255) continue;
      const altitude = pixels[sourcePixel] / 255 * heightRange;
      raster.data[destination] = 36; raster.data[destination + 1] = 31; raster.data[destination + 2] = 26;
      raster.data[destination + 3] = Math.round(255 * band.alpha * Math.exp(-altitude / band.falloff));
    }
    layerCtx.putImageData(raster, 0, 0);
    ctx.filter = `blur(${band.blur / metresPerPixel}px)`; ctx.drawImage(layer, 0, 0);
  }
  ctx.filter = 'none';
  const texture = new THREE.CanvasTexture(result); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.name = 'Mesh-shaped contact shadow'; mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, top + .00035, z); mesh.renderOrder = 2;
  mesh.userData.contactShadow = true;
  let disposed = false;
  mesh.userData.disposeContactShadow = () => {
    if (disposed) return; disposed = true;
    mesh.removeFromParent(); mesh.geometry.dispose(); material.dispose(); texture.dispose();
  };
  return mesh;
}
