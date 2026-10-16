import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createStudio, createPlinth, studio } from './gallery-architecture.js';
import { settleExhibit, createContactShadow } from './gallery-grounding.js';
import { createInputTexture } from './gallery-input-image.js';
import { createCollectionThumbnail } from './gallery-collection-image.js';
import { createNavigator } from './gallery-navigation.js';

const $ = id => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 760px)').matches;
const state = { assets: [], rooms: [], room: 0, selected: -1, mode: 'hall', loaded: 0, failed: 0, epoch: 0, filter: 'all', highToken: 0, theme: 'dark' };
const loader = new GLTFLoader();
const requests = new Set();
const pointers = new Map();
const movementKeys = new Set();
const movementCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
const walkForward = new THREE.Vector3(), walkRight = new THREE.Vector3(), walkOffset = new THREE.Vector3();
let renderer, scene, camera, orbit, roomGroup, composer, ssao, building, slots = [], pickables = [], markers = [];
let yaw = 0, pitch = 0, transition = null, pointerStart = null, pointerMoved = false, pinchDistance = 0;
let highRoot = null, highSlot = null, highController = null, toastTimer, lastFrame = 0;
let darkEnvironmentTarget, hoverSlot = -1, navigator, destinationMarker;
let parseQueue = Promise.resolve();
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
const entry = studio.entry, entryLook = studio.look;
const darkMode = () => true;
const entryPosition = () => darkMode() ? studio.darkEntry : entry;
const entryTarget = () => darkMode() ? studio.darkLook : entryLook;
const hallHint = () => `${mobile ? 'Click' : 'WASD / click'} to walk <span>·</span> Drag to look <span>·</span> Scroll to zoom`;
const inspectionPosition = slot => slot.center.clone().add(new THREE.Vector3(.35, .18, 1).normalize().multiplyScalar(slot.radius * (mobile ? 3.65 : 2.9))).clamp(studio.bounds.min, studio.bounds.max);
const mapX = x => 90 + x * (154 / 13.2);
const mapY = z => 13 + (z - studio.mapBounds.minZ) * 174 / (studio.mapBounds.maxZ - studio.mapBounds.minZ);
const mapWorld = point => ({ x: (point.x - 90) * 13.2 / 154, z: studio.mapBounds.minZ + (point.y - 13) * (studio.mapBounds.maxZ - studio.mapBounds.minZ) / 174 });

function notify(text) {
  $('toast').textContent = text; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3600);
}
function fail(error) {
  console.error(error);
  $('fatal-message').textContent = location.protocol === 'file:' ? 'Start the local server and open http://localhost:8088/gallery.html to load the 3D assets.' : `Unable to enter the studio: ${error.message}. Enable hardware acceleration in your browser and reload.`;
  $('fatal-error').hidden = false;
}
function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}
function drawText(ctx, w, h, lines, { background = '#eeede7', color = '#384238' } = {}) {
  ctx.fillStyle = background; ctx.fillRect(0, 0, w, h); ctx.fillStyle = color;
  lines.forEach(({ text, size, y, font = 'sans-serif', style = '', color: ink, x = .08 }) => {
    ctx.fillStyle = ink || color; ctx.font = `${style ? style + ' ' : ''}${size}px ${font}`; ctx.fillText(text, w * x, h * y, w * .85);
  });
}
function textTexture(lines, { width = 1024, height = 512, ...palette } = {}) {
  return canvasTexture(width, height, (ctx, w, h) => drawText(ctx, w, h, lines, palette));
}
function drawPlaque(ctx, asset, index) {
  const dark = state.theme === 'dark', caption = dark ? '#c7b995' : '#7c8478';
  drawText(ctx, 768, 280, [
    { text: `${String(index + 1).padStart(2, '0')}   /   ${asset.category}`, size: 25, y: .28, color: caption },
    { text: asset.title, size: 44, y: .59 },
    { text: 'SUPRA-Tex COLLECTION', size: 17, y: .82, color: caption }
  ], { background: dark ? '#383d39' : '#e3dfd5', color: dark ? '#c7b995' : '#384238' });
}
function updateMarkerColors() {
  const dark = state.theme === 'dark';
  slots.forEach(slot => slot.disc.material.color.set(slot.index === state.selected ? (dark ? '#d4bd85' : '#b17b4d') : (dark ? '#94866b' : '#6f695a')));
}
function applySlotTheme(slot) {
  const dark = state.theme === 'dark';
  slot.pedestal.material.color.copy(building.plinthMaterial.color);
  slot.frame.material.color.set(dark ? '#b7a67f' : '#252824');
  slot.ring.material.color.set(dark ? '#c7b995' : '#ddd7c9');
  const label = slot.plaque.material.map;
  drawPlaque(label.image.getContext('2d'), slot.asset, slot.index);
  label.needsUpdate = true;
}
function initAppearance() {
  document.documentElement.dataset.theme = 'dark';
  building.applyTheme();
  scene.background.set('#0e1011'); scene.environment = darkEnvironmentTarget?.texture || null; scene.environmentIntensity = 1;
  camera.far = 170; camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); resize();
  document.querySelector('.panel-header h2').textContent = 'Eight objects';
  document.querySelector('.map-key').lastChild.textContent = ' Viewpoints · Click to walk';
  document.querySelector('.map-heading .eyebrow').textContent = 'Viewpoints';
  renderer.shadowMap.needsUpdate = true;
  const url = new URL(location.href); url.searchParams.delete('theme'); url.searchParams.delete('v'); history.replaceState(null, '', url);
}
function box(w, h, d, x, y, z, material, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function surface(w, h, texture, x, y, z, rotation = 0, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
  mesh.position.set(x, y, z); mesh.rotation.y = rotation; parent.add(mesh); return mesh;
}
function material(color, roughness = .8, metalness = 0) { return new THREE.MeshStandardMaterial({ color, roughness, metalness }); }
function initScene() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
  renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('aria-label', '3D studio. Use WASD to walk, drag or use arrow keys to look around, and scroll to zoom. Select an object using the floor plan or collection.');
  $('viewport').append(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color('#0e1011');
  camera = new THREE.PerspectiveCamera(studio.fov, 1, .025, 170); camera.position.copy(entryPosition()); camera.lookAt(entryTarget());
  orbit = new OrbitControls(camera, renderer.domElement); orbit.enabled = false; orbit.enableDamping = true; orbit.dampingFactor = .085; orbit.rotateSpeed = .6; orbit.zoomSpeed = .8; orbit.panSpeed = .65; orbit.autoRotateSpeed = .6; orbit.maxPolarAngle = Math.PI * .94;
  orbit.addEventListener('start', () => { if (state.mode === 'inspect') { transition = null; setAutoRotate(false); } });
  building = createStudio(scene, renderer, { canvasTexture, textTexture });
  destinationMarker = new THREE.Mesh(new THREE.RingGeometry(.18, .205, 48), new THREE.MeshBasicMaterial({ color: '#e4ca8b', transparent: true, opacity: .85, depthWrite: false, side: THREE.DoubleSide }));
  destinationMarker.rotation.x = -Math.PI / 2; destinationMarker.visible = false; scene.add(destinationMarker);
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: mobile ? darkMode() ? 2 : 0 : 4 });
  composer = new EffectComposer(renderer, target); composer.addPass(new RenderPass(scene, camera));
  ssao = new SSAOPass(scene, camera, 1, 1, mobile ? 12 : 24); ssao.kernelRadius = .22; ssao.minDistance = .0004; ssao.maxDistance = .075; composer.addPass(ssao); composer.addPass(new OutputPass());
  syncAngles(); resize(); bindCanvas();
  window.addEventListener('resize', resize);
  renderer.domElement.addEventListener('webglcontextlost', e => { e.preventDefault(); fail(new Error('Graphics memory is unavailable or the WebGL context was lost')); });
  renderer.setAnimationLoop(animate);
}
function captureRoomEnvironment(position) {
  const generator = new THREE.PMREMGenerator(renderer);
  const hidden = slots.flatMap(slot => [slot.model, slot.contact]).filter(Boolean);
  if (highRoot) hidden.push(highRoot);
  hidden.push(building.reflection, destinationMarker);
  const visible = hidden.map(object => object.visible), prior = scene.environment;
  const viewport = renderer.getViewport(new THREE.Vector4());
  try {
    hidden.forEach(object => { object.visible = false; });
    scene.environment = null; renderer.shadowMap.needsUpdate = true;
    // Reflections and diffuse bounce come from this room's surfaces, windows,
    // and luminaires. There is no unrelated studio HDR in the dark studio.
    return generator.fromScene(scene, 0, .04, 170, { size: 256, position });
  } finally {
    hidden.forEach((object, i) => { object.visible = visible[i]; });
    scene.environment = prior; renderer.setViewport(viewport); generator.dispose();
    renderer.shadowMap.needsUpdate = true;
  }
}
function updateRoomEnvironment() {
  const next = captureRoomEnvironment(new THREE.Vector3(0, 1.7, .2));
  darkEnvironmentTarget?.dispose(); darkEnvironmentTarget = next;
  scene.environment = next.texture; scene.environmentIntensity = 1;
}
function refreshLocalEnvironment(slot) {
  if (!slot.model) return;
  const next = captureRoomEnvironment(slot.center), previous = slot.environmentTarget;
  slot.environmentTarget = next;
  slot.model.traverse(object => {
    if (!object.isMesh) return;
    for (const mat of (Array.isArray(object.material) ? object.material : [object.material])) {
      mat.envMap = next.texture; mat.envMapIntensity = 1; mat.needsUpdate = true;
    }
  });
  previous?.dispose();
}
function refreshLocalEnvironments() {
  // Each object's probe uses its own position, so the window and ceiling
  // highlights move correctly across the room instead of following the camera.
  slots.forEach(refreshLocalEnvironment);
  renderer.shadowMap.needsUpdate = true;
}
function resize() {
  if (!renderer) return;
  const { clientWidth: w, clientHeight: h } = $('viewport'); renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  if (composer) {
    composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(w, h);
    // Keep dark-mode ambient-occlusion edges at the display-pixel resolution.
    if (!darkMode()) ssao.setSize(Math.round(w * (mobile ? .65 : .85)), Math.round(h * (mobile ? .65 : .85)));
  }
}
function syncAngles() { const d = camera.getWorldDirection(new THREE.Vector3()); yaw = Math.atan2(d.x, -d.z); pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)); }
function lookAround() { camera.lookAt(camera.position.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)))); }
function dispose(root) {
  if (!root) return;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(o => { if (o.geometry) geometries.add(o.geometry); for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m) materials.add(m); });
  materials.forEach(m => { Object.values(m).forEach(v => { if (v?.isTexture) textures.add(v); }); m.dispose(); });
  textures.forEach(t => { t.dispose(); t.image?.close?.(); }); geometries.forEach(g => g.dispose());
}
function makeRooms(assets) {
  const rooms = [{ title: 'SUPRA-Tex Studio', assets: assets.slice(0, darkMode() ? 8 : 6) }];
  rooms.forEach((room, r) => room.assets.forEach((a, s) => { a.room = r; a.slot = s; })); return rooms;
}
function makeSlot(asset, index) {
  const [x, z] = (darkMode() ? studio.darkPositions : studio.positions)[index], height = studio.heights[index], width = studio.widths[index];
  const group = new THREE.Group(); roomGroup.add(group);
  const pedestal = createPlinth(x, z, width, height, building.plinthMaterial, group); pedestal.userData.slot = index;
  const label = canvasTexture(768, 280, ctx => drawPlaque(ctx, asset, index));
  const plaque = surface(.69, .25, label, x - width * .14, height * .71, z + width / 2 + .004, 0, group); plaque.userData.slot = index;
  plaque.material = new THREE.MeshStandardMaterial({ map: label, roughness: .92 });
  const viewpoint = new THREE.Vector3(x + .12, 1.68, z + 2.3);
  const marker = new THREE.Group(); marker.position.set(darkMode() ? viewpoint.x : x, .006, viewpoint.z); marker.userData.slot = index;
  const ring = new THREE.Mesh(new THREE.RingGeometry(.18, .195, 48), new THREE.MeshBasicMaterial({ color: '#ddd7c9', side: THREE.DoubleSide, transparent: true, opacity: .62, depthWrite: false })); ring.rotation.x = -Math.PI / 2; marker.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(.175, 40), new THREE.MeshBasicMaterial({ color: '#6f695a', transparent: true, opacity: .3, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = .002; marker.add(disc);
  const number = canvasTexture(128, 128, ctx => { ctx.fillStyle = '#d4bd85'; ctx.font = '48px Georgia'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(index + 1).padStart(2, '0'), 64, 64); });
  const digit = new THREE.Mesh(new THREE.PlaneGeometry(.29, .29), new THREE.MeshBasicMaterial({ map: number, transparent: true, depthWrite: false })); digit.rotation.x = -Math.PI / 2; digit.position.y = .005; marker.add(digit);
  group.add(marker); markers.push(marker); pickables.push(pedestal, plaque, marker);
  const slot = { asset, index, x, z, height, width, viewpoint, group, contact: null, model: null, center: new THREE.Vector3(x, height + .5, z), radius: .85, status: 'waiting', progress: 0, marker, disc, detailed: darkMode() };
  // Eight input photographs occupy the right side of the exhibition wall;
  // the left side is reserved for the paper title and slogan.
  const artwork = new THREE.Group(); group.add(artwork);
  const placements = [
    [-.15, 3.1, -9.265, 0], [1.55, 3.25, -9.265, 0],
    [3.25, 3.1, -9.265, 0], [4.95, 3.25, -9.265, 0],
    [.05, 1.45, -9.265, 0], [1.75, 1.6, -9.265, 0],
    [3.45, 1.45, -9.265, 0], [5.15, 1.6, -9.265, 0]
  ];
  const [ax, ay, az, angle] = darkMode() ? placements[index] : [-6.425, 2.1, [-6.8, -5.3, -3.8, -.5, 1, 2.5][index], Math.PI / 2];
  artwork.position.set(ax, ay, az); artwork.rotation.y = angle;
  artwork.scale.set(.9, .9, 1);
  const frame = box(darkMode() ? 1.3 : .82, darkMode() ? 1.3 : 1.06, .055, 0, 0, 0, material('#252824', .48), artwork); frame.castShadow = true;
  const matte = surface(darkMode() ? 1.22 : .77, darkMode() ? 1.22 : 1.01, textTexture([{ text: '', size: 20, y: .5 }], { background: darkMode() ? '#000000' : '#eae6db' }), 0, 0, .035, 0, artwork);
  if (!darkMode()) matte.material = new THREE.MeshStandardMaterial({ map: matte.material.map, roughness: .9 });
  frame.userData.slot = index; matte.userData.slot = index; pickables.push(frame, matte);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(darkMode() ? 1.22 : .65, darkMode() ? 1.22 : .87), darkMode() ? new THREE.MeshBasicMaterial({ color: '#000000', toneMapped: false }) : new THREE.MeshStandardMaterial({ color: '#eae6db', roughness: .92 }));
  art.position.set(0, 0, .044); art.userData.slot = index; artwork.add(art); pickables.push(art); slot.art = art;
  if (darkMode()) {
    const caption = canvasTexture(768, 96, ctx => {
      ctx.fillStyle = '#c7b995'; ctx.font = '25px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${String(index + 1).padStart(2, '0')}  /  INPUT IMAGE`, 384, 48);
    });
    const label = surface(1.18, .1475, caption, 0, -.77, .044, 0, artwork);
    label.material.transparent = true; label.userData.slot = index; pickables.push(label);
  }
  Object.assign(slot, { pedestal, plaque, ring, frame, artwork });
  applySlotTheme(slot);
  return slot;
}
async function loadRoom(index, chosenSlot = -1, savedView = null) {
  state.epoch++; const epoch = state.epoch; state.room = (index + state.rooms.length) % state.rooms.length; state.loaded = state.failed = 0; state.selected = -1;
  requests.forEach(controller => controller.abort()); requests.clear(); releaseHigh(); transition = null; orbit.enabled = false; state.mode = 'hall';
  if (roomGroup) { slots.forEach(s => s.environmentTarget?.dispose()); scene.remove(roomGroup); dispose(roomGroup); }
  roomGroup = new THREE.Group(); scene.add(roomGroup); pickables = []; markers = [];
  const room = state.rooms[state.room]; slots = room.assets.map(makeSlot);
  updateMarkerColors();
  navigator = createNavigator({ bounds: studio.navigationBounds, obstacles: [
    ...slots.map(s => ({ minX: s.x - s.width / 2, maxX: s.x + s.width / 2, minZ: s.z - s.width / 2, maxZ: s.z + s.width / 2 })),
    ...(building.navigationBlockers || [])
  ] });
  destinationMarker.visible = false;
  camera.fov = savedView?.fov || studio.fov; camera.position.copy(savedView?.position || entryPosition());
  if (savedView) camera.quaternion.copy(savedView.quaternion); else camera.lookAt(entryTarget());
  camera.updateProjectionMatrix(); syncAngles();
  $('room-title').textContent = room.title; $('room-number').textContent = `GALLERY ${String(state.room + 1).padStart(2, '0')} / ${String(state.rooms.length).padStart(2, '0')}`;
  $('map-room').textContent = String(state.room + 1).padStart(2, '0'); $('intro').hidden = false; $('exhibit-card').hidden = true; $('auto-rotate').hidden = true;
  $('total-count').textContent = slots.length;
  $('view-label').textContent = savedView ? 'Studio view' : 'Entrance viewpoint'; $('control-hint').innerHTML = hallHint();
  buildMap(); renderCollection(); updateProgress(); updateZoom(); renderer.shadowMap.needsUpdate = true;
  if (chosenSlot >= 0) selectSlot(chosenSlot);
  await building.ready;
  if (epoch !== state.epoch) return;
  if (darkMode()) updateRoomEnvironment();
  // One decoding job at a time bounds peak memory, even when changing halls quickly.
  const queue = [...slots];
  if (chosenSlot >= 0) queue.unshift(...queue.splice(chosenSlot, 1));
  for (const slot of queue) {
    if (epoch !== state.epoch) return;
    await loadSlot(slot, epoch);
  }
  if (darkMode() && epoch === state.epoch) { updateRoomEnvironment(); refreshLocalEnvironments(); }
}
async function fetchModel(url, controller, onProgress) {
  const response = await fetch(url, { signal: controller.signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length'));
  if (!response.body) return parseModel(await response.arrayBuffer(), url, controller.signal);
  const reader = response.body.getReader(), chunks = []; let received = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); received += value.byteLength; onProgress?.(total ? received / total : 0); }
  if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
  const bytes = new Uint8Array(received); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; } chunks.length = 0;
  return parseModel(bytes.buffer, url, controller.signal);
}
function parseModel(bytes, url, signal) {
  // GLTF decoding cannot be interrupted. Serialize it across room changes and
  // high-resolution requests, and discard canceled work before it starts.
  const task = parseQueue.then(async () => {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    const gltf = await loader.parseAsync(bytes, new URL('.', new URL(url, location.href)).href);
    if (signal.aborted) { dispose(gltf.scene); throw new DOMException('Aborted', 'AbortError'); }
    return gltf.scene;
  });
  parseQueue = task.then(() => undefined, () => undefined);
  return task;
}
function updateDisplaySupport(root, slot, placement) {
  if (slot.displaySupport) { slot.group.remove(slot.displaySupport); dispose(slot.displaySupport); slot.displaySupport = null; }
  if (slot.asset.displaySupport !== 'rear') return;
  const { bounds } = placement, height = bounds.max.y - slot.height;
  const rear = bounds.min.z - .045, supportY = slot.height + height * .57;
  const ray = new THREE.Raycaster(new THREE.Vector3(slot.x, supportY, rear), new THREE.Vector3(0, 0, 1));
  const sides = new Map();
  root.traverse(object => { if (object.isMesh) for (const mat of (Array.isArray(object.material) ? object.material : [object.material])) if (!sides.has(mat)) { sides.set(mat, mat.side); mat.side = THREE.DoubleSide; } });
  let contact;
  try { contact = ray.intersectObject(root, true)[0]?.point; }
  finally { sides.forEach((side, mat) => { mat.side = side; }); }
  if (!contact) contact = new THREE.Vector3(slot.x, supportY, bounds.min.z);
  const group = new THREE.Group(); group.name = `${slot.asset.title} display support`;
  const mat = new THREE.MeshStandardMaterial({ color: '#756b51', metalness: .55, roughness: .55 });
  const add = (geometry, position) => { const mesh = new THREE.Mesh(geometry, mat); mesh.position.copy(position); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); return mesh; };
  const rod = (from, to, radius) => {
    const delta = to.clone().sub(from);
    const mesh = add(new THREE.CylinderGeometry(radius, radius, delta.length(), 16), from.clone().add(to).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  };
  const baseTop = slot.height + .025, elbow = new THREE.Vector3(slot.x, contact.y, rear);
  add(new THREE.BoxGeometry(Math.min(.44, slot.width * .35), .025, .16), new THREE.Vector3(slot.x, slot.height + .0125, rear));
  rod(new THREE.Vector3(slot.x, baseTop, rear), elbow, .012);
  rod(elbow, contact.clone().add(new THREE.Vector3(0, 0, -.014)), .009);
  const pad = add(new THREE.SphereGeometry(.024, 16, 10), contact.clone().add(new THREE.Vector3(0, 0, -.014))); pad.scale.z = .6;
  group.userData.contactPoint = contact.toArray();
  slot.group.add(group); slot.displaySupport = group;
}
function removeDisplayArtifacts(root, cleanup) {
  if (!cleanup) return;
  let matched = false;
  root.traverse(object => {
    const geometry = object.isMesh && object.geometry;
    if (!geometry?.index) return;
    if (geometry.userData.displayArtifactCleanup) { matched = true; return; }
    const source = geometry.index.array;
    if (source.length !== cleanup.originalTriangleCount * 3) return;
    if (geometry.groups.length) throw new Error('Display cleanup expects one material group');
    const ranges = cleanup.excludeTriangleRanges;
    const removed = ranges.reduce((sum, [, count]) => sum + count, 0);
    const kept = new source.constructor(source.length - removed * 3);
    let start = 0, offset = 0;
    for (const [triangle, count] of ranges) {
      const end = triangle * 3;
      if (end < start || count < 1 || end + count * 3 > source.length) throw new Error('Invalid display cleanup range');
      kept.set(source.subarray(start, end), offset); offset += end - start;
      start = end + count * 3;
    }
    kept.set(source.subarray(start), offset);
    // Keep all surviving vertices, normals, UVs and texture bytes untouched.
    // Every subsequent draw, bounds calculation and shadow uses this same index.
    geometry.setIndex(new THREE.BufferAttribute(kept, 1)); geometry.setDrawRange(0, kept.length);
    geometry.userData.displayArtifactCleanup = { removedTriangles: removed, originalTriangles: cleanup.originalTriangleCount };
    matched = true;
  });
  if (!matched) throw new Error('The display cleanup does not match this mesh');
}
function prepareModel(root, slot, high = false) {
  removeDisplayArtifacts(root, slot.asset.meshCleanup);
  slot.group.add(root);
  const [pitch, roll] = slot.asset.restingAngles || [0, 0];
  const placement = settleExhibit(root, { x: slot.x, z: slot.z, top: slot.height, width: slot.width - .28, depth: slot.width - .28, height: studio.exhibitHeights[slot.index], rotationY: Math.PI, pitch, roll });
  slot.placement = placement;
  updateDisplaySupport(root, slot, placement);
  const seen = new Set();
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.userData.slot = slot.index;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) if (m) {
      m.envMapIntensity = 1;
      Object.values(m).forEach(texture => {
        if (!texture?.isTexture || seen.has(texture)) return; seen.add(texture);
        if (!high && !slot.detailed && texture.image && Math.max(texture.image.width, texture.image.height) > 512) {
          const source = texture.image, scale = 512 / Math.max(source.width, source.height), canvas = document.createElement('canvas'); canvas.width = Math.round(source.width * scale); canvas.height = Math.round(source.height * scale); canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height); texture.image = canvas; source.close?.(); texture.needsUpdate = true;
        }
        texture.anisotropy = Math.min(slot.detailed ? 16 : high ? 8 : 2, renderer.capabilities.getMaxAnisotropy());
      });
    }
  });
  slot.center.copy(placement.center); slot.radius = placement.radius;
  building.aimExhibitLight(slot.index, slot.center, studio.exhibitLighting[slot.asset.id]);
  if (slot.contact) { slot.group.remove(slot.contact); slot.contact.userData.disposeContactShadow(); }
  slot.contact = createContactShadow(renderer, root, { top: slot.height, x: slot.x, z: slot.z, width: slot.width - .025, depth: slot.width - .025 });
  slot.group.add(slot.contact);
  return root;
}
async function loadSlot(slot, epoch) {
  const controller = new AbortController(); requests.add(controller); slot.status = 'loading'; updateExhibit(); updateProgress();
  try {
    const root = await fetchModel(slot.detailed ? slot.asset.detailGlb || slot.asset.glb : slot.asset.previewGlb || slot.asset.glb, controller, fraction => { if (epoch !== state.epoch) return; slot.progress = fraction; updateProgress(); if (state.selected === slot.index) updateExhibit(); });
    if (epoch !== state.epoch) { dispose(root); return; }
    slot.model = prepareModel(root, slot); slot.group.add(root); pickables.push(root);
    const print = await createInputTexture(renderer, slot.asset.inputImage, controller.signal);
    if (epoch !== state.epoch) { print.dispose(); return; }
    slot.art.material.map = print; slot.art.material.color.set('#ffffff'); slot.art.material.needsUpdate = true;
    slot.status = 'ready'; state.loaded++;
    if (!slot.detailed) renderCollection();
    if (state.mode === 'inspect' && state.selected === slot.index && highRoot) root.visible = false;
    renderer.shadowMap.needsUpdate = true;
  } catch (error) {
    if (epoch !== state.epoch || error.name === 'AbortError') return;
    console.error('Model failed', slot.asset.glb, error); slot.status = 'error'; state.failed++;
  } finally { requests.delete(controller); if (epoch === state.epoch) { updateExhibit(); updateProgress(); } }
}
function updateProgress() {
  const total = slots.length, done = state.loaded + state.failed;
  const partial = slots.filter(s => s.status === 'loading').reduce((n, s) => n + s.progress, 0);
  $('scene-status').textContent = done === total ? state.failed ? `${state.loaded} objects ready · ${state.failed} objects to retry` : `${total} objects · Studio ready` : `Loading collection ${state.loaded} / ${total}`;
  $('loading-bar').firstElementChild.style.width = `${(done + partial) / total * 100}%`;
  $('loading-bar').firstElementChild.style.opacity = done === total ? '0' : '1';
  document.body.dataset.ready = done === total ? 'true' : 'loading';
}
function buildMap() {
  const svg = $('floor-map'); svg.querySelectorAll('.map-point,.map-camera,.map-home').forEach(n => n.remove());
  slots.forEach(slot => {
    const node = document.createElementNS('http://www.w3.org/2000/svg', 'g'), x = mapX(slot.x), y = mapY(slot.z);
    node.setAttribute('class', 'map-point'); node.setAttribute('role', 'button'); node.setAttribute('tabindex', '0'); node.setAttribute('aria-label', `Viewpoint ${slot.index + 1}: ${slot.asset.title}`); node.dataset.slot = slot.index;
    const px = mapX(slot.marker.position.x), py = mapY(slot.marker.position.z);
    node.innerHTML = `<rect x="${x - 10}" y="${y - 7}" width="20" height="14" rx="1"/><text x="${x}" y="${y}">${String(slot.index + 1).padStart(2, '0')}</text><circle cx="${px}" cy="${py}" r="3"/>`;
    node.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSlot(slot.index); } }); svg.append(node);
  });
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'path'); dot.setAttribute('class', 'map-camera'); dot.setAttribute('d', 'M0 -5L4 4L0 2L-4 4Z'); dot.id = 'map-camera'; svg.append(dot);
  const home = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  home.id = 'map-start'; home.setAttribute('class', 'map-home'); home.setAttribute('role', 'button'); home.setAttribute('tabindex', '0');
  home.setAttribute('aria-label', 'Start viewpoint: return to entrance');
  home.setAttribute('transform', `translate(${mapX(entryPosition().x)} ${mapY(entryPosition().z)})`);
  home.innerHTML = '<title>Return to the initial viewpoint</title><rect x="-26" y="-10" width="52" height="20" rx="3"/><path class="map-home-icon" d="M-19-1l6-5 6 5M-17-2v8h8v-8M-14 6V2h2v4"/><text x="7" y=".5">Start</text>';
  home.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); overview(); } });
  svg.append(home);
}
function updateMapCamera() {
  const dot = $('map-camera'); if (!dot) return;
  const d = camera.getWorldDirection(new THREE.Vector3()); dot.setAttribute('transform', `translate(${mapX(camera.position.x)} ${mapY(camera.position.z)}) rotate(${Math.atan2(d.x, -d.z) * 180 / Math.PI})`);
}
function moveTo(position, target, fov, after, walking = false) {
  movementKeys.clear();
  orbit.enabled = false; setAutoRotate(false);
  let path, lengths, length = 0;
  if (walking && navigator) {
    const route = navigator.route(camera.position, position);
    if (!route.length) { notify('Choose a clear spot on the studio floor.'); return; }
    path = route.map((p, i) => new THREE.Vector3(p.x, THREE.MathUtils.lerp(camera.position.y, position.y, i / Math.max(1, route.length - 1)), p.z));
    lengths = [0]; for (let i = 1; i < path.length; i++) { length += path[i].distanceTo(path[i - 1]); lengths.push(length); }
    position = path[path.length - 1];
  }
  const temp = camera.clone(); temp.position.copy(position); temp.lookAt(target);
  transition = { started: performance.now(), duration: reducedMotion ? 0 : walking ? Math.min(4200, 650 + length * 150) : 1050, from: camera.position.clone(), to: position.clone(), q0: camera.quaternion.clone(), q1: temp.quaternion.clone(), f0: camera.fov, f1: fov, after, path, lengths, length };
}
function walkTo(point) {
  if (!darkMode()) return;
  releaseHigh(); state.selected = -1; state.mode = 'walk';
  $('intro').hidden = false; $('exhibit-card').hidden = true; $('auto-rotate').hidden = true;
  $('view-label').textContent = 'Walking'; $('control-hint').innerHTML = hallHint();
  document.querySelectorAll('.map-point').forEach(node => node.classList.remove('active')); updateMarkerColors(); renderCollection();
  const position = new THREE.Vector3(point.x, 1.72, point.z);
  const direction = camera.getWorldDirection(new THREE.Vector3());
  moveTo(position, position.clone().add(direction.multiplyScalar(4)), camera.fov, () => {
    syncAngles(); $('view-label').textContent = 'Free exploration'; destinationMarker.visible = false;
  }, true);
  if (transition) { destinationMarker.position.set(transition.to.x, .012, transition.to.z); destinationMarker.visible = true; }
}
function keyboardWalkAllowed() {
  return navigator && !document.hidden && !$('help-dialog').open && $('collection-panel').hidden
    && !document.activeElement?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}
function beginKeyboardWalk() {
  transition = null; destinationMarker.visible = false;
  orbit.enabled = false; setAutoRotate(false); syncAngles();
  if (state.mode !== 'walk' || state.selected !== -1) {
    releaseHigh(); state.selected = -1; state.mode = 'walk';
    $('intro').hidden = true; $('exhibit-card').hidden = true; $('auto-rotate').hidden = true;
    document.querySelectorAll('.map-point').forEach(node => node.classList.remove('active'));
    updateMarkerColors(); renderCollection();
  }
  // An inspection can end above a plinth; start walking on its nearest clear floor.
  if (!navigator.free(camera.position)) {
    const safe = navigator.route(camera.position, camera.position)[0];
    if (safe) { camera.position.x = safe.x; camera.position.z = safe.z; }
  }
  camera.position.y = 1.72;
  $('view-label').textContent = 'Free exploration'; $('control-hint').innerHTML = hallHint();
}
function updateKeyboardWalk(delta) {
  if (!movementKeys.size) return;
  if (!keyboardWalkAllowed()) { movementKeys.clear(); return; }
  const forward = Number(movementKeys.has('KeyW')) - Number(movementKeys.has('KeyS'));
  const right = Number(movementKeys.has('KeyD')) - Number(movementKeys.has('KeyA'));
  if (!forward && !right) return;
  camera.getWorldDirection(walkForward); walkForward.y = 0;
  if (walkForward.lengthSq() < 1e-10) walkForward.set(Math.sin(yaw), 0, -Math.cos(yaw));
  walkForward.normalize(); walkRight.crossVectors(walkForward, camera.up).normalize();
  walkOffset.copy(walkForward).multiplyScalar(forward).addScaledVector(walkRight, right).normalize().multiplyScalar(2.2 * delta);
  const next = navigator.move(camera.position, walkOffset);
  camera.position.set(next.x, 1.72, next.z);
}
function selectSlot(index) {
  if (!slots[index]) return;
  destinationMarker.visible = false;
  releaseHigh(); state.selected = index; state.mode = 'point'; const slot = slots[index];
  $('intro').hidden = true; $('exhibit-card').hidden = false; $('auto-rotate').hidden = true;
  $('view-label').textContent = `Viewpoint ${String(index + 1).padStart(2, '0')}`;
  $('control-hint').innerHTML = 'Drag to look <span>·</span> Scroll to zoom <span>·</span> Inspect to orbit';
  document.querySelectorAll('.map-point').forEach(n => n.classList.toggle('active', Number(n.dataset.slot) === index));
  updateMarkerColors();
  updateExhibit(); renderCollection();
  const position = darkMode() ? slot.viewpoint.clone() : new THREE.Vector3(slot.x + .12, 1.68, slot.z + (mobile ? 2.8 : 2.3));
  moveTo(position, slot.center, mobile ? 62 : 55, () => { syncAngles(); }, darkMode());
}
function updateExhibitInput(asset) {
  const img = $('exhibit-input-image'), frame = $('exhibit-input');
  const source = asset.inputImage?.src || '';
  if (img.dataset.inputSource === source) return;
  img.dataset.inputSource = source;
  img.alt = `Input image of ${asset.title}`;
  img.hidden = true; img.removeAttribute('src'); frame.dataset.ready = 'loading';
  createCollectionThumbnail(asset.inputImage).then(async result => {
    if (img.dataset.inputSource !== source) return;
    img.src = result.url;
    await img.decode();
    if (img.dataset.inputSource !== source) return;
    img.hidden = false; frame.dataset.ready = 'true';
  }).catch(error => {
    if (img.dataset.inputSource !== source) return;
    frame.dataset.ready = 'error';
    console.warn('Input image unavailable', source, error);
  });
}
function updateExhibit() {
  const slot = slots[state.selected]; if (!slot) return;
  $('exhibit-title').textContent = slot.asset.title;
  $('exhibit-description').textContent = state.mode === 'inspect' ? 'Click below to return.' : 'Click Inspect below to view details.';
  updateExhibitInput(slot.asset);
  $('exhibit-number').textContent = `${String(slot.index + 1).padStart(2, '0')} / ${slot.asset.category}`;
  $('exhibit-position').textContent = `${slot.index + 1} / ${slots.length}`;
  $('inspect').disabled = slot.status !== 'ready'; $('inspect').innerHTML = state.mode === 'inspect' ? 'Back to viewpoint <span>↙</span>' : 'Inspect <span>↗</span>';
  $('retry-model').hidden = slot.status !== 'error';
  const message = slot.status === 'ready' ? '' : slot.status === 'error' ? 'Unable to load. Click Retry.' : slot.status === 'waiting' ? 'Waiting to load…' : `Loading ${Math.round(slot.progress * 100)}%`;
  $('exhibit-status').textContent = message;
  $('exhibit-status').hidden = !message;
}
function releaseHigh() {
  state.highToken++; highController?.abort(); highController = null;
  if (highRoot) { highSlot?.group.remove(highRoot); pickables = pickables.filter(p => p !== highRoot); dispose(highRoot); highRoot = null; }
  if (highSlot?.model) highSlot.model.visible = true;
  highSlot = null; if (renderer) renderer.shadowMap.needsUpdate = true;
}
async function inspect() {
  const slot = slots[state.selected]; if (!slot || slot.status !== 'ready') return;
  if (state.mode === 'inspect') { selectSlot(state.selected); return; }
  state.mode = 'inspect'; orbit.target.copy(slot.center);
  orbit.minDistance = slot.radius * .3; orbit.maxDistance = slot.radius * 6; orbit.minPolarAngle = .07; orbit.maxPolarAngle = Math.PI * .94;
  const position = inspectionPosition(slot);
  moveTo(position, slot.center, 43, () => { orbit.target.copy(slot.center); orbit.enabled = true; orbit.update(); });
  $('auto-rotate').hidden = false; $('view-label').textContent = 'Inspect · 360°'; $('control-hint').innerHTML = 'Drag to orbit <span>·</span> Scroll to zoom <span>·</span> Right-drag / two-finger pan';
  if (slot.detailed) { updateExhibit(); return; }
  const epoch = state.epoch, token = ++state.highToken, controller = new AbortController(); highController = controller; updateExhibit();
  try {
    const root = await fetchModel(slot.asset.glb, controller, p => { if (token === state.highToken) $('exhibit-status').textContent = `Original model and 4K textures ${Math.round(p * 100)}%`; });
    if (epoch !== state.epoch || token !== state.highToken) { dispose(root); return; }
    highRoot = prepareModel(root, slot, true); highSlot = slot; slot.model.visible = false; slot.group.add(highRoot); pickables.push(highRoot); highController = null;
    renderer.shadowMap.needsUpdate = true; updateExhibit();
  } catch (error) {
    if (error.name === 'AbortError' || token !== state.highToken) return;
    highController = null; updateExhibit(); $('exhibit-status').textContent = 'High-resolution loading failed. You can still inspect the display model; return to the viewpoint to retry.';
  }
}
function overview() {
  destinationMarker.visible = false;
  releaseHigh(); state.selected = -1; state.mode = 'hall'; $('intro').hidden = false; $('exhibit-card').hidden = true; $('auto-rotate').hidden = true; $('view-label').textContent = 'Entrance viewpoint';
  $('control-hint').innerHTML = hallHint();
  document.querySelectorAll('.map-point').forEach(n => n.classList.remove('active')); updateMarkerColors();
  moveTo(entryPosition(), entryTarget(), studio.fov, syncAngles, darkMode()); renderCollection();
}
function resetView() {
  if (state.mode === 'inspect') {
    const slot = slots[state.selected]; setAutoRotate(false);
    moveTo(inspectionPosition(slot), slot.center, 43, () => { orbit.target.copy(slot.center); orbit.enabled = true; orbit.update(); });
  } else if (state.selected >= 0) selectSlot(state.selected); else overview();
}
function setAutoRotate(value) { if (!orbit) return; orbit.autoRotate = value; $('auto-rotate').setAttribute('aria-pressed', String(value)); }
function zoom(factor) {
  if (transition) return;
  if (state.mode === 'inspect') { const offset = camera.position.clone().sub(orbit.target); offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, orbit.minDistance, orbit.maxDistance)); camera.position.copy(orbit.target).add(offset); orbit.update(); }
  else { camera.fov = THREE.MathUtils.clamp(camera.fov * factor, 23, 85); camera.updateProjectionMatrix(); }
  updateZoom();
}
function updateZoom() {
  const slot = slots[state.selected];
  $('zoom-value').textContent = (state.mode === 'inspect' && slot ? slot.radius * (mobile ? 3.65 : 2.9) / Math.max(.01, camera.position.distanceTo(orbit.target)) : Math.tan(THREE.MathUtils.degToRad(studio.fov / 2)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))).toFixed(1) + '×';
}
function hitTest(x, y) {
  const rect = renderer.domElement.getBoundingClientRect(); pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
  for (const hit of raycaster.intersectObjects(pickables, true)) { let o = hit.object; while (o) { if (Number.isInteger(o.userData.slot)) return o.userData.slot; o = o.parent; } } return -1;
}
function navigationPoint(x, y) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1); raycaster.setFromCamera(pointer, camera);
  for (const hit of raycaster.intersectObject(building.architecture, true)) {
    if (hit.object === building.reflection || hit.object.isLight) continue;
    let object = hit.object, visible = true;
    while (object) { if (!object.visible) visible = false; object = object.parent; }
    if (visible) return hit.point;
  }
  return raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
}
function bindCanvas() {
  const canvas = renderer.domElement;
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); pointerStart = { x: e.clientX, y: e.clientY }; pointerMoved = false;
    if (pointers.size > 1) { pointerMoved = true; const p = [...pointers.values()]; pinchDistance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); }
    if (state.mode !== 'inspect') { if (transition) { transition = null; destinationMarker.visible = false; syncAngles(); if (state.mode === 'walk') $('view-label').textContent = 'Free exploration'; } canvas.setPointerCapture(e.pointerId); }
  });
  canvas.addEventListener('pointermove', e => {
    const prev = pointers.get(e.pointerId);
    if (!prev) { if (state.mode !== 'inspect') { hoverSlot = hitTest(e.clientX, e.clientY); canvas.style.cursor = hoverSlot >= 0 || darkMode() && navigationPoint(e.clientX, e.clientY) ? 'pointer' : 'grab'; } return; }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    if (pointerStart && Math.hypot(e.clientX - pointerStart.x, e.clientY - pointerStart.y) > 5) pointerMoved = true;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (state.mode === 'inspect') return;
    if (pointers.size >= 2) { const p = [...pointers.values()], distance = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y); if (pinchDistance > 0) zoom(pinchDistance / Math.max(1, distance)); pinchDistance = distance; return; }
    yaw -= dx * .0034; pitch = THREE.MathUtils.clamp(pitch + dy * .0034, -1.22, 1.22); lookAround(); canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointerup', e => {
    pointers.delete(e.pointerId); if (!pointers.size) pinchDistance = 0;
    if (!pointerMoved && pointerStart && (state.mode !== 'inspect' || darkMode())) {
      const index = hitTest(e.clientX, e.clientY);
      if (index >= 0) selectSlot(index);
      else if (darkMode()) { const point = navigationPoint(e.clientX, e.clientY); if (point) walkTo(point); }
    }
    pointerStart = null; canvas.style.cursor = state.mode === 'inspect' ? 'grab' : 'grab';
  });
  canvas.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); pointerStart = null; pointerMoved = true; pinchDistance = 0; });
  canvas.addEventListener('wheel', e => { if (state.mode === 'inspect') return; e.preventDefault(); zoom(Math.exp(e.deltaY * .001)); }, { passive: false });
}
function renderCollection() {
  if (!state.rooms.length) return;
  const query = $('search').value.trim().toLowerCase();
  const assets = state.assets.filter(a => (state.filter === 'all' || state.filter === a.category) && (!query || [a.title, a.name, a.category].join(' ').toLowerCase().includes(query)));
  $('search-count').textContent = `${assets.length} objects · Select a viewpoint`;
  const list = $('collection-list'); list.replaceChildren();
  if (!assets.length) { const empty = document.createElement('p'); empty.className = 'empty-state'; empty.textContent = 'No objects found. Try another search.'; list.append(empty); }
  assets.forEach(a => {
    const button = document.createElement('button'); button.className = 'collection-item'; button.classList.toggle('active', a.room === state.room && a.slot === state.selected); button.setAttribute('aria-label', `View ${a.title}`);
    const thumb = document.createElement('span'); thumb.className = 'collection-thumb';
    if (darkMode()) {
      // Collection images load directly from the input catalog, independently
      // of GLB loading. Never substitute a model preview or a wall render.
      const img = document.createElement('img'); img.alt = `Input image of ${a.title}`; img.hidden = true;
      thumb.dataset.ready = 'loading'; thumb.append(img);
      createCollectionThumbnail(a.inputImage).then(async result => {
        if (!img.isConnected) return;
        img.dataset.inputSource = result.source; img.src = result.url;
        await img.decode();
        if (!img.isConnected) return;
        img.hidden = false; thumb.dataset.ready = 'true';
      }).catch(error => {
        if (!thumb.isConnected) return;
        thumb.textContent = String(a.slot + 1).padStart(2, '0'); thumb.title = 'Input image unavailable'; thumb.dataset.ready = 'error';
        console.warn('Input thumbnail unavailable', a.inputImage?.src, error);
      });
    } else if (a.preview) {
      const img = document.createElement('img'); img.src = a.preview; img.alt = ''; img.loading = 'lazy';
      img.addEventListener('error', () => { thumb.textContent = String(a.slot + 1).padStart(2, '0'); }); thumb.append(img);
    } else thumb.textContent = String(a.slot + 1).padStart(2, '0');
    const copy = document.createElement('span'), title = document.createElement('strong'), subtitle = document.createElement('small'), arrow = document.createElement('span');
    title.textContent = a.title; subtitle.textContent = `${a.category} / Object ${String(a.slot + 1).padStart(2, '0')}`; copy.append(title, subtitle); arrow.className = 'item-arrow'; arrow.textContent = '↗'; button.append(thumb, copy, arrow);
    button.addEventListener('click', () => { toggleCollection(false); if (a.room !== state.room) loadRoom(a.room, a.slot); else selectSlot(a.slot); }); list.append(button);
  });
}
function toggleCollection(show = $('collection-panel').hidden) { movementKeys.clear(); $('collection-panel').hidden = !show; $('collection-toggle').setAttribute('aria-expanded', String(show)); $('minimap').hidden = show; if (show) { renderCollection(); $('search').focus(); } else $('collection-toggle').focus(); }
function bindUI() {
  initAppearance();
  let mapTouchHandledAt = -Infinity;
  const chooseMapPosition = e => {
    const point = new DOMPoint(e.clientX, e.clientY).matrixTransform($('floor-map').getScreenCTM().inverse());
    if (Math.abs(point.x - mapX(entryPosition().x)) <= 28 && Math.abs(point.y - mapY(entryPosition().z)) <= 12) { overview(); return; }
    const selected = slots.find(slot => {
      const x = mapX(slot.x), y = mapY(slot.z);
      const px = mapX(slot.marker.position.x), py = mapY(slot.marker.position.z);
      return Math.abs(point.x - x) <= 10 && Math.abs(point.y - y) <= 7 || Math.hypot(point.x - px, point.y - py) <= 6;
    });
    if (selected) selectSlot(selected.index);
    else walkTo(mapWorld(point));
  };
  // Mobile browsers may snap a synthetic click to a nearby numbered marker.
  // Route using the original touch coordinates before that adjustment.
  $('floor-map').addEventListener('pointerup', e => {
    if (e.pointerType !== 'touch' || !darkMode()) return;
    e.preventDefault(); mapTouchHandledAt = performance.now(); chooseMapPosition(e);
  });
  $('floor-map').addEventListener('click', e => {
    if (performance.now() - mapTouchHandledAt < 500) return;
    chooseMapPosition(e);
  });
  $('prev-room').hidden = $('next-room').hidden = true;
  $('overview').onclick = overview; $('close-exhibit').onclick = overview; $('inspect').onclick = inspect; $('reset-view').onclick = resetView;
  $('zoom-in').onclick = () => zoom(.8); $('zoom-out').onclick = () => zoom(1.25);
  $('auto-rotate').onclick = () => setAutoRotate(!orbit.autoRotate);
  $('prev-exhibit').onclick = () => selectSlot((state.selected - 1 + slots.length) % slots.length); $('next-exhibit').onclick = () => selectSlot((state.selected + 1) % slots.length);
  $('retry-model').onclick = () => { const slot = slots[state.selected]; if (slot?.status === 'error') { state.failed--; loadSlot(slot, state.epoch); } };
  $('collection-toggle').onclick = () => toggleCollection(); $('collection-close').onclick = () => toggleCollection(false); $('search').oninput = renderCollection;
  $('help-toggle').onclick = () => $('help-dialog').showModal(); $('help-close').onclick = $('help-done').onclick = () => $('help-dialog').close();
  $('help-dialog').addEventListener('click', e => { if (e.target === $('help-dialog')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
  $('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { notify('Fullscreen is unavailable. Try F11.'); } };
  document.addEventListener('fullscreenchange', () => $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Exit fullscreen' : 'Enter fullscreen'));
  const categories = ['all', ...new Set(state.assets.map(a => a.category))];
  categories.forEach(category => { const button = document.createElement('button'); button.textContent = category === 'all' ? 'All' : category; button.classList.toggle('active', category === 'all'); button.onclick = () => { state.filter = category; $('room-tabs').querySelectorAll('button').forEach(b => b.classList.toggle('active', b === button)); renderCollection(); }; $('room-tabs').append(button); });
  window.addEventListener('keydown', e => {
    if ($('help-dialog').open) return;
    if (e.key === 'Escape') { if (!$('collection-panel').hidden) toggleCollection(false); else overview(); return; }
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (movementCodes.has(e.code) && !e.ctrlKey && !e.metaKey && !e.altKey && keyboardWalkAllowed()) {
      e.preventDefault();
      if (!movementKeys.size) beginKeyboardWalk();
      movementKeys.add(e.code); return;
    }
    if (e.key.toLowerCase() === 'r') resetView();
    if (e.key === '+' || e.key === '=') zoom(.85); if (e.key === '-') zoom(1.18);
    if (state.mode !== 'inspect' && !transition && e.key.startsWith('Arrow')) { e.preventDefault(); if (e.key === 'ArrowLeft') yaw -= .09; if (e.key === 'ArrowRight') yaw += .09; if (e.key === 'ArrowUp') pitch = Math.min(1.22, pitch + .07); if (e.key === 'ArrowDown') pitch = Math.max(-1.22, pitch - .07); lookAround(); }
  });
  window.addEventListener('keyup', e => { movementKeys.delete(e.code); });
  window.addEventListener('blur', () => movementKeys.clear());
  document.addEventListener('visibilitychange', () => { if (document.hidden) movementKeys.clear(); });
}
function animate(now) {
  if (document.hidden || $('fatal-error').hidden === false) return;
  const delta = Math.min((now - lastFrame) / 1000, .05); lastFrame = now;
  updateKeyboardWalk(delta);
  if (transition) {
    const t = transition.duration === 0 ? 1 : Math.min(1, (now - transition.started) / transition.duration), smooth = t * t * (3 - 2 * t), current = transition;
    if (current.path?.length > 1 && current.length > 0) {
      const distance = current.length * smooth; let segment = 1;
      while (segment < current.path.length - 1 && current.lengths[segment] < distance) segment++;
      const part = (distance - current.lengths[segment - 1]) / Math.max(.00001, current.lengths[segment] - current.lengths[segment - 1]);
      camera.position.lerpVectors(current.path[segment - 1], current.path[segment], part);
    } else camera.position.lerpVectors(current.from, current.to, smooth);
    camera.quaternion.slerpQuaternions(current.q0, current.q1, smooth); camera.fov = THREE.MathUtils.lerp(current.f0, current.f1, smooth); camera.updateProjectionMatrix();
    if (t === 1) { transition = null; current.after?.(); }
  } else if (state.mode === 'inspect' && orbit.enabled) {
    orbit.update(delta);
    // Keep orbiting inside the architecture, including after panning or zooming.
    camera.position.clamp(studio.bounds.min, studio.bounds.max);
    orbit.target.clamp(studio.bounds.min, studio.bounds.max);
    camera.lookAt(orbit.target);
  }
  markers.forEach((marker, i) => { const selected = i === state.selected; marker.children[0].material.opacity = selected && !reducedMotion ? .7 + Math.sin(now * .003) * .25 : .85; });
  updateMapCamera(); updateZoom(); composer.render(delta);
}
async function main() {
  if (location.protocol === 'file:') return;
  try {
    const responses = await Promise.all([fetch('./gallery-data.json'), fetch('./gallery-detail-data.json'), fetch('./gallery-input-images.json')]);
    if (responses.some(response => !response.ok)) throw new Error('Unable to load the collection');
    const [data, details, inputs] = await Promise.all(responses.map(response => response.json()));
    state.catalog = [...data.assets, ...details.assets].map(asset => ({ ...asset, ...details.details[asset.id], inputImage: inputs[asset.id] }));
    state.rooms = makeRooms(state.catalog); state.assets = state.rooms.flatMap(room => room.assets); $('total-count').textContent = state.assets.length; $('hall-count').textContent = `${state.rooms.length} gallery`;
    initScene(); bindUI(); await loadRoom(0);
  } catch (error) { fail(error); }
}
main();
