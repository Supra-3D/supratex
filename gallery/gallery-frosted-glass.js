import * as THREE from 'three';

// The exterior is deliberately featureless. This material represents daylight
// scattered through sandblasted glass, plus reflections from its rough surface.
export function createFrostedGlass(renderer, width, height, daylightIntensity) {
  const w = 768, h = Math.round(w * height / width);
  const grain = new Float32Array(w * h);
  let seed = 17531;
  const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < grain.length; i++) grain[i] = (random() + random() + random()) / 3;
  const cloudSize = 32, cloud = new Float32Array(cloudSize * cloudSize);
  for (let i = 0; i < cloud.length; i++) cloud[i] = random();
  function haze(x, y) {
    const u = x / w * 10, v = y / w * 10;
    const ix = Math.floor(u), iy = Math.floor(v);
    const sx = THREE.MathUtils.smoothstep(u - ix, 0, 1), sy = THREE.MathUtils.smoothstep(v - iy, 0, 1);
    const top = THREE.MathUtils.lerp(cloud[iy * cloudSize + ix], cloud[iy * cloudSize + ix + 1], sx);
    const bottom = THREE.MathUtils.lerp(cloud[(iy + 1) * cloudSize + ix], cloud[(iy + 1) * cloudSize + ix + 1], sx);
    return THREE.MathUtils.lerp(top, bottom, sy) - .5;
  }
  const colorCanvas = document.createElement('canvas'), normalCanvas = document.createElement('canvas'), roughCanvas = document.createElement('canvas');
  for (const c of [colorCanvas, normalCanvas, roughCanvas]) { c.width = w; c.height = h; }
  const color = colorCanvas.getContext('2d').createImageData(w, h);
  const normal = normalCanvas.getContext('2d').createImageData(w, h);
  const rough = roughCanvas.getContext('2d').createImageData(w, h);
  const linear = Array.from({ length: 256 }, (_, i) => new THREE.Color().setRGB(i / 255, i / 255, i / 255, THREE.SRGBColorSpace).r);
  const meanTransmission = [0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, p = i * 4, g = grain[i] - .5;
    const edgeDistance = Math.min(x, w - 1 - x, y, h - 1 - y) * width / w;
    const edge = Math.exp(-edgeDistance / .018);
    // Dense translucent grain remains visible after tone mapping; the surface
    // normals separately break up reflected light, instead of painting specks.
    const density = g * 54 + haze(x, y) * 6 - edge * 22 + 5 * (1 - y / h);
    color.data.set([192 + density, 201 + density, 205 + density, 255], p);
    for (let channel = 0; channel < 3; channel++) meanTransmission[channel] += linear[color.data[p + channel]] / grain.length;
    const dx = grain[y * w + Math.min(w - 1, x + 1)] - grain[y * w + Math.max(0, x - 1)];
    const dy = grain[Math.min(h - 1, y + 1) * w + x] - grain[Math.max(0, y - 1) * w + x];
    const nx = -dx * .8, ny = dy * .8, length = Math.hypot(nx, ny, 1);
    normal.data.set([(nx / length * .5 + .5) * 255, (ny / length * .5 + .5) * 255, (.5 / length + .5) * 255, 255], p);
    const r = 214 + g * 48;
    rough.data.set([r, r, r, 255], p);
  }
  const makeTexture = (canvas, pixels, colorSpace) => {
    canvas.getContext('2d').putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = colorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  };
  const densityMap = makeTexture(colorCanvas, color, THREE.SRGBColorSpace);
  const material = new THREE.MeshPhysicalMaterial({
    color: '#8d999e', map: densityMap,
    emissive: '#eef4fa', emissiveMap: densityMap, emissiveIntensity: daylightIntensity,
    metalness: 0, roughness: .78,
    roughnessMap: makeTexture(roughCanvas, rough, THREE.NoColorSpace),
    normalMap: makeTexture(normalCanvas, normal, THREE.NoColorSpace),
    normalScale: new THREE.Vector2(.7, .7),
    ior: 1.5, specularIntensity: .65, clearcoat: 0
  });
  material.userData.meanTransmission = meanTransmission;
  return material;
}
