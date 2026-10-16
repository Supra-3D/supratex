import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createFrostedGlass } from './gallery-frosted-glass.js';

export const studio = {
  bounds: { min: new THREE.Vector3(-6.15, .18, -9), max: new THREE.Vector3(6.15, 4.4, 14) },
  navigationBounds: { min: new THREE.Vector3(-6.02, 0, -8.85), max: new THREE.Vector3(6.02, 0, 13.95) },
  mapBounds: { minZ: -9.45, maxZ: 14.5 },
  positions: [[-3.7, 3.4], [-.15, .7], [3.5, 1.6], [-3.55, -3.5], [-.1, -5.4], [3.5, -4.5], [-2.7, 8.5], [3.5, 8.5]],
  // Maintain the 5.9 m row spacing, with small lateral offsets between rows.
  // Each central plinth has equal left/right aisle widths; the entrance pair shares a line.
  darkPositions: [[-3.3, 1.4], [.1, .3], [3.4, 1.4], [-3.75, -4.5], [-.2, -5.6], [3.375, -4.5], [-3.5, 7.3], [3.5, 7.3]],
  widths: [1.65, 1.65, 1.45, 1.45, 1.9, 1.5, 1.5, 1.5],
  heights: [.82, 1.1, .96, 1.03, 1.08, .99, 1.0, 1.0],
  exhibitHeights: [1.35, 1.08, 1.25, 1.15, 1.85, 1.16, 1.15, .85],
  // The vessel's projecting rim shades its vertical relief under a steep
  // overhead beam. A farther-forward track position lights that face directly.
  exhibitLighting: { 'confirmed19-m02_v1': { frontOffset: 2.8, intensity: 120 } },
  // Resting orientations from the lower mesh envelope. Pitch and roll are
  // applied in world space after the presentation yaw; no vertices are altered.
  restingAngles: [
    [.16830559042831716, 0],
    [-.0648675246316051, .009424777960769378],
    [-.005529202979233404, -.00018151424220741176],
    [.048365772935248894, .005724679946541399],
    [-.04146843691696507, -.0053197635600787194],
    [-.003783844694439456, .003923500158483252],
    [0, 0],
    [0, 0]
  ],
  entry: new THREE.Vector3(0, 1.72, 12.5), look: new THREE.Vector3(0, 1.45, -2.3), fov: 62,
  darkEntry: new THREE.Vector3(0, 1.72, 12.5), darkLook: new THREE.Vector3(0, 1.45, -2.3)
};

export function createStudio(scene, renderer, { canvasTexture, textTexture }) {
  RectAreaLightUniformsLib.init();
  const textures = new THREE.TextureLoader();
  const materialLoads = [];
  const load = (filename, color, repeat = [1, 1]) => {
    let complete;
    materialLoads.push(new Promise(resolve => { complete = resolve; }));
    const t = textures.load(`./assets/materials/${filename}`, complete, undefined, complete);
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t;
  };
  const plaster = load('plaster-normal.jpg', false, [4, 2]);
  const wall = new THREE.MeshStandardMaterial({ color: '#e5e0d5', roughness: .96, normalMap: plaster, normalScale: new THREE.Vector2(.09, .09) });
  const recess = new THREE.MeshStandardMaterial({ color: '#9a968b', roughness: .95 });
  const frameMaterial = new THREE.MeshStandardMaterial({ color: '#222622', roughness: .42, metalness: .3 });
  const paleStone = new THREE.MeshStandardMaterial({ color: '#b7b3a8', roughness: .68 });
  const brass = new THREE.MeshStandardMaterial({ color: '#756148', metalness: .7, roughness: .38 });
  const architecture = new THREE.Group(); architecture.name = 'Studio architecture'; scene.add(architecture);
  function solid(w, h, d, x, y, z, mat = wall, bevel = 0) {
    const geo = bevel ? new RoundedBoxGeometry(w, h, d, 2, bevel) : new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; architecture.add(mesh); return mesh;
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(13.2, 27), new THREE.MeshStandardMaterial({
    map: load('floor-color.jpg', true, [6.6, 23]), roughnessMap: load('floor-roughness.jpg', false, [6.6, 23]),
    normalMap: load('floor-normal.jpg', false, [6.6, 23]), normalScale: new THREE.Vector2(.12, .12),
    color: '#c3c3bb', roughness: .85, metalness: 0
  }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -.006, 1.2); floor.receiveShadow = true; architecture.add(floor);
  // Fine saw-cut joints divide the poured concrete into large, believable bays.
  const seam = new THREE.MeshBasicMaterial({ color: '#4f514c', transparent: true, opacity: .17, depthWrite: false });
  for (let x = -4.4; x <= 4.4; x += 2.2) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(.008, 24), seam); line.rotation.x = -Math.PI / 2; line.position.set(x, -.004, 2.5); architecture.add(line);
  }
  for (let z = -8; z < 15; z += 2.5) {
    const line = new THREE.Mesh(new THREE.PlaneGeometry(13, .008), seam); line.rotation.x = -Math.PI / 2; line.position.set(0, -.003, z); architecture.add(line);
  }
  // A very weak, rough planar reflection grounds the furniture in the polished floor.
  const reflectedShader = THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms);
  const reflection = new Reflector(new THREE.PlaneGeometry(12.9, 23.5), {
    textureWidth: 768, textureHeight: 768, clipBias: .001, multisample: 0,
    shader: {
      uniforms: reflectedShader,
      vertexShader: Reflector.ReflectorShader.vertexShader,
      fragmentShader: `uniform sampler2D tDiffuse; varying vec4 vUv;
        void main(){vec2 uv=vUv.xy/vUv.w;vec3 c=vec3(0.0);float stepSize=.0015;
        for(int x=-2;x<=2;x++){for(int y=-2;y<=2;y++){c+=texture2D(tDiffuse,uv+vec2(float(x),float(y))*stepSize).rgb;}}
        gl_FragColor=vec4(c/25.0,.035);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`
    }
  });
  reflection.rotation.x = -Math.PI / 2; reflection.position.set(0, -.001, 2.4); reflection.material.transparent = true; reflection.material.depthWrite = false; reflection.renderOrder = 1; architecture.add(reflection);
  const reflect = reflection.onBeforeRender.bind(reflection);
  reflection.onBeforeRender = (r, s, c, ...args) => { if (!s.overrideMaterial) reflect(r, s, c, ...args); };

  // Human-scale shell. The far portal opens into a recessed, softly lit vestibule.
  const westWall = solid(.28, 4.7, 24, -6.6, 2.35, 2.5);
  westWall.name = 'West solid wall';
  solid(5.3, 4.7, .32, -3.95, 2.35, -9.45);
  solid(5.3, 4.7, .32, 3.95, 2.35, -9.45);
  solid(2.6, 1.3, .32, 0, 4.05, -9.45);
  const closedBackWall = solid(2.6, 3.4, .32, 0, 1.7, -9.45);
  closedBackWall.name = 'Closed exhibition wall'; closedBackWall.visible = false;
  const backSkirting = solid(2.6, .065, .04, 0, .034, -9.27, frameMaterial); backSkirting.visible = false;
  solid(.3, 3.4, 3.5, -1.45, 1.7, -11.05, recess); solid(.3, 3.4, 3.5, 1.45, 1.7, -11.05, recess);
  solid(3.2, 3.4, .2, 0, 1.7, -12.8, recess);
  solid(2.8, .06, 3.5, 0, 3.35, -11.05, recess);
  const innerGlow = new THREE.PointLight('#fff1d9', 12, 7, 2); innerGlow.position.set(0, 2.5, -11.7); architecture.add(innerGlow);
  // Broad frosted daylight panels replace the outdoor views on both sides.
  const eastWall = solid(.28, 4.7, 24, 6.6, 2.35, 2.5);
  eastWall.name = 'East solid wall'; eastWall.visible = false;
  const eastWindow = new THREE.Group(); eastWindow.name = 'East window'; architecture.add(eastWindow);
  const windowLength = 9, paneWidth = windowLength, paneHeight = 3.1;
  const daylightIntensity = .7, daylightColor = '#eef4fa';
  const glassWidth = 1.8 - .065;
  const glassRows = [{ y: 1.99, height: 1.875 }, { y: 3.52, height: 1.095 }];
  const glassMaterials = glassRows.map(row => createFrostedGlass(renderer, glassWidth, row.height, daylightIntensity));
  const glassEdge = new THREE.MeshPhysicalMaterial({ color: '#889a99', metalness: 0, roughness: .38, ior: 1.5 });
  const glassSeal = new THREE.MeshStandardMaterial({ color: '#303a39', metalness: 0, roughness: .84 });
  const windowMat = new THREE.MeshStandardMaterial({ color: '#e7e4dc', roughness: .48, metalness: .08 });
  const westWindow = new THREE.Group(); westWindow.name = 'West window'; westWindow.visible = false; architecture.add(westWindow);
  const frostedPanels = [];
  for (const [side, group] of [[1, eastWindow], [-1, westWindow]]) {
    const x = side * 6.6;
    group.add(solid(.28, 4.7, 5.4, x, 2.35, -6.8));
    group.add(solid(.28, 4.7, 9.6, x, 2.35, 9.7));
    group.add(solid(.28, 1, windowLength, x, .5, .4));
    group.add(solid(.28, .55, windowLength, x, 4.425, .4));
    // Individually seated panes have a slim gasket and an 18 mm glass edge.
    // Their scattering surface sits inside the frame, not across its front.
    for (let bay = 0; bay < 5; bay++) glassRows.forEach((row, rowIndex) => {
      const z = -3.2 + bay * 1.8;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(glassWidth + .025, row.height + .025, .024), glassSeal);
      seat.position.set(side * 6.555, row.y, z); seat.rotation.y = -side * Math.PI / 2; group.add(seat);
      const pane = new THREE.Mesh(new THREE.BoxGeometry(glassWidth, row.height, .018),
        [glassEdge, glassEdge, glassEdge, glassEdge, glassMaterials[rowIndex], glassEdge]);
      pane.name = `${side < 0 ? 'West' : 'East'} frosted glass ${bay + 1}-${rowIndex + 1}`;
      pane.position.set(side * 6.535, row.y, z); pane.rotation.y = -side * Math.PI / 2;
      pane.receiveShadow = true;
      group.add(pane); frostedPanels.push(pane);
    });
    for (let i = 0; i <= 5; i++) group.add(solid(.23, 3.22, .065, side * 6.4, 2.57, -4.1 + i * 1.8, windowMat));
    group.add(solid(.34, .07, windowLength + .15, side * 6.4, 1.01, .4, paleStone));
    group.add(solid(.23, .08, windowLength + .1, side * 6.4, 4.13, .4, windowMat));
    group.add(solid(.23, .045, windowLength + .1, side * 6.4, 2.95, .4, windowMat));
  }
  const windowDaylight = new THREE.Group(); windowDaylight.name = 'Window daylight'; windowDaylight.visible = false; architecture.add(windowDaylight);
  // Match the area light to the light transmitted by the visible glass,
  // including its tint and the small area occluded by the window frames.
  const transmittedDaylight = new THREE.Color(0, 0, 0);
  glassMaterials.forEach((material, i) => transmittedDaylight.add(new THREE.Color().fromArray(material.userData.meanTransmission)
    .multiplyScalar(5 * glassWidth * glassRows[i].height / (paneWidth * paneHeight))));
  transmittedDaylight.multiply(new THREE.Color(daylightColor));
  [-6.3, 6.3].forEach(x => {
    const light = new THREE.RectAreaLight(transmittedDaylight, daylightIntensity, paneWidth, paneHeight);
    light.name = x < 0 ? 'West window daylight' : 'East window daylight';
    light.position.set(x, 2.55, .4); light.lookAt(0, 2.55, .4); windowDaylight.add(light);
  });
  // Entry wall, skirting shadow gaps, and a recessed ceiling perimeter.
  solid(4.7, 4.7, .22, -4.15, 2.35, 14.5); solid(4.7, 4.7, .22, 4.15, 2.35, 14.5); solid(3.6, 1.3, .22, 0, 4.05, 14.5);
  // A closed entrance vestibule completes the view through the rear portal,
  // including when a visitor turns around while inspecting the rear exhibits.
  const entranceVestibule = new THREE.Group(); entranceVestibule.name = 'Entrance vestibule'; entranceVestibule.visible = false; architecture.add(entranceVestibule);
  entranceVestibule.position.z = 4;
  const vestibuleSolid = (w, h, d, x, y, z, material = wall) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; entranceVestibule.add(mesh); return mesh;
  };
  vestibuleSolid(.2, 3.5, 2.7, -1.9, 1.75, 11.8);
  vestibuleSolid(.2, 3.5, 2.7, 1.9, 1.75, 11.8);
  vestibuleSolid(4.0, 3.5, .2, 0, 1.75, 13.1);
  vestibuleSolid(3.6, .08, 2.8, 0, -.04, 11.8, floor.material);
  vestibuleSolid(3.6, .1, 2.7, 0, 3.45, 11.8, recess);
  const entranceDoor = new THREE.MeshStandardMaterial({ color: '#303733', roughness: .62, metalness: .15 });
  vestibuleSolid(2.12, 2.77, .06, 0, 1.385, 12.965, frameMaterial);
  [-.5, .5].forEach(x => vestibuleSolid(.98, 2.64, .065, x, 1.34, 12.921, entranceDoor));
  [-.13, .13].forEach(x => {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, .34, 12), brass); handle.position.set(x, 1.22, 12.858); entranceVestibule.add(handle);
  });
  const entrancePanel = new THREE.Mesh(new THREE.PlaneGeometry(.95, .55), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 2.8, roughness: .7 }));
  entrancePanel.position.set(0, 3.394, 11.7); entrancePanel.rotation.x = Math.PI / 2; entranceVestibule.add(entrancePanel);
  const entranceLight = new THREE.RectAreaLight('#ffffff', 2.8, .95, .55); entranceLight.position.set(0, 3.38, 11.7); entranceLight.rotation.x = -Math.PI / 2; entranceVestibule.add(entranceLight);
  entrancePanel.visible = false; entranceLight.visible = false;
  // A small vestibule spotlight illuminates the doors from the hall side.
  const doorLightPosition = new THREE.Vector3(0, 3.2, 11.4), doorLightTarget = new THREE.Vector3(0, 1.4, 12.9);
  const doorLightDirection = doorLightTarget.clone().sub(doorLightPosition).normalize();
  vestibuleSolid(.045, .17, .045, 0, 3.365, 11.4, frameMaterial);
  const doorLamp = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .19, 24), frameMaterial);
  doorLamp.name = 'Entrance door light fixture'; doorLamp.position.copy(doorLightPosition);
  doorLamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), doorLightDirection); entranceVestibule.add(doorLamp);
  const doorLens = new THREE.Mesh(new THREE.CircleGeometry(.061, 24), new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
  doorLens.position.copy(doorLightPosition).addScaledVector(doorLightDirection, .1);
  doorLens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), doorLightDirection); entranceVestibule.add(doorLens);
  const doorSpot = new THREE.SpotLight('#ffffff', 38, 5, .8, .7, 2); doorSpot.name = 'Entrance door spotlight';
  doorSpot.position.copy(doorLens.position).addScaledVector(doorLightDirection, .004); doorSpot.target.position.copy(doorLightTarget);
  doorSpot.castShadow = true; doorSpot.shadow.mapSize.set(512, 512); doorSpot.shadow.camera.near = .1;
  doorSpot.shadow.bias = -.000025; doorSpot.shadow.normalBias = .001;
  entranceVestibule.add(doorSpot, doorSpot.target);
  const ceiling = solid(12.9, .15, 23.7, 0, 4.68, 2.5, new THREE.MeshStandardMaterial({ color: '#e2e0d9', roughness: 1, emissive: '#d9dce1', emissiveIntensity: .13 })); ceiling.castShadow = false;
  solid(.045, .065, 24, -6.445, .034, 2.5, frameMaterial); solid(.045, .065, 24, 6.445, .034, 2.5, frameMaterial);
  solid(5.1, .065, .04, -3.95, .034, -9.27, frameMaterial); solid(5.1, .065, .04, 3.95, .034, -9.27, frameMaterial);
  solid(.09, .08, 23.8, -6.39, 4.53, 2.5, recess); solid(.09, .08, 23.8, 6.39, 4.53, 2.5, recess);
  // Slim black tracks with individually aimed luminaires, rather than decorative beams.
  [-3.45, 3.45].forEach(x => solid(.045, .055, 21.6, x, 4.46, 1.8, frameMaterial));
  const centerTrack = solid(.045, .055, 21.6, 0, 4.46, 1.8, frameMaterial);
  centerTrack.visible = false;
  const bulb = new THREE.MeshBasicMaterial({ color: '#fff1d5', toneMapped: false });
  const trackLights = [], trackFixtures = [], rearFixtures = [];
  studio.positions.forEach(([x, z], i) => {
    const lampX = x < 0 ? -3.45 : 3.45, lampZ = z + (i > 5 ? -.65 : .8);
    const stem = solid(.025, .16, .025, lampX, 4.36, lampZ, frameMaterial);
    const arm = solid(1, .045, .045, lampX, 4.46, lampZ, frameMaterial);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .19, 24), frameMaterial);
    body.position.set(lampX, 4.22, lampZ); body.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(x - lampX, -3.1, z - lampZ).normalize()); architecture.add(body);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.061, 24), bulb); lens.position.set(lampX, 4.22, lampZ).add(new THREE.Vector3(x - lampX, -3.1, z - lampZ).normalize().multiplyScalar(.1)); lens.lookAt(x, 1.1, z); architecture.add(lens);
    const spot = new THREE.SpotLight('#ffffff', 75, 9, .42, .4, 2); spot.position.set(lampX, 4.15, lampZ); spot.target.position.set(x, 1.1, z);
    spot.name = `Exhibit ${String(i + 1).padStart(2, '0')} spotlight`; spot.userData.exhibitIndex = i;
    body.name = `Exhibit ${String(i + 1).padStart(2, '0')} light fixture`;
    lens.name = `Exhibit ${String(i + 1).padStart(2, '0')} light lens`;
    spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -.000025; spot.shadow.normalBias = .001; spot.shadow.camera.near = .12; spot.shadow.camera.far = 9; spot.shadow.focus = 1; spot.shadow.radius = 4; spot.shadow.intensity = 1;
    architecture.add(spot, spot.target);
    trackLights.push(spot);
    trackFixtures.push({ stem, arm, body, lens, spot });
    if (i > 5) rearFixtures.push(stem, arm, body, lens, spot, spot.target);
  });
  rearFixtures.forEach(object => { object.visible = false; });
  function aimExhibitLight(index, center, { frontOffset = .8, intensity = 75 } = {}) {
    const fixture = trackFixtures[index], { stem, arm, body, lens, spot } = fixture;
    fixture.lighting = { frontOffset, intensity }; fixture.center = center.clone();
    const [x, z] = studio.darkPositions[index], lampZ = z + frontOffset;
    const railX = [-3.45, 0, 3.45].reduce((nearest, rail) => Math.abs(rail-x)<Math.abs(nearest-x) ? rail : nearest);
    // Each fixture sits above its own plinth, on the entrance-facing side.
    // A short mounting arm connects it to the nearest continuous ceiling rail.
    arm.position.set((railX+x)/2, 4.46, lampZ); arm.scale.x = Math.abs(x-railX)+.045;
    stem.position.set(x, 4.36, lampZ); body.position.set(x, 4.22, lampZ);
    const direction = center.clone().sub(body.position).normalize();
    body.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0), direction);
    lens.position.copy(body.position).addScaledVector(direction, .1); lens.lookAt(center);
    // The actual light starts at the visible lens, along exactly the same axis.
    spot.position.copy(lens.position).addScaledVector(direction, .004);
    spot.target.position.copy(center); spot.intensity = intensity; spot.shadow.needsUpdate = true;
    renderer.shadowMap.needsUpdate = true;
  }
  // The luminous ceiling panels and their area lights share a position, size,
  // color and orientation, so the lighting agrees with visible emitters.
  const ceilingPanels = new THREE.Group(); ceilingPanels.name = 'Neutral ceiling lighting'; architecture.add(ceilingPanels); ceilingPanels.visible = false;
  const diffuser = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 3.4, roughness: .65 });
  [-5.5, .2, 6.0, 11.3].forEach(z => {
    const housing = new THREE.Mesh(new THREE.BoxGeometry(1.32, .045, 2.12), frameMaterial); housing.position.set(0, 4.565, z); ceilingPanels.add(housing);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 2.02), diffuser); panel.position.set(0, 4.539, z); panel.rotation.x = Math.PI / 2; ceilingPanels.add(panel);
    const light = new THREE.RectAreaLight('#ffffff', 3.4, 1.22, 2.02); light.position.set(0, 4.527, z); light.rotation.x = -Math.PI / 2; ceilingPanels.add(light);
  });
  // Wall washers sit above the display zone and illuminate the lettering and
  // entrance walls with the same neutral light as the exhibition fixtures.
  const wallWashers = new THREE.Group(); wallWashers.name = 'Wall illumination'; wallWashers.visible = false; architecture.add(wallWashers);
  const addWallWasher = (x, z, targetX, targetZ, intensity, targetY = 2.65) => {
    const position = new THREE.Vector3(x, 4.34, z), target = new THREE.Vector3(targetX, targetY, targetZ), direction = target.clone().sub(position).normalize();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, .17, 10), frameMaterial); stem.position.set(x, 4.49, z); wallWashers.add(stem);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .18, 20), frameMaterial); body.position.copy(position); body.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), direction); wallWashers.add(body);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(.054, 20), bulb); lens.position.copy(position).addScaledVector(direction, .095); lens.lookAt(target); wallWashers.add(lens);
    const light = new THREE.SpotLight('#ffffff', intensity, 6, 1.04, .85, 2); light.position.copy(position).addScaledVector(direction, .1); light.target.position.copy(target); wallWashers.add(light, light.target);
  };
  addWallWasher(-3.95, -8.15, -3.95, -9.27, 36, 2.65);
  addWallWasher(1.1, -8.15, 1.1, -9.27, 24, 2.35);
  addWallWasher(4.5, -8.15, 4.5, -9.27, 24, 2.35);
  addWallWasher(-4.15, 13.35, -4.15, 14.37, 24);
  addWallWasher(4.15, 13.35, 4.15, 14.37, 24);
  const sun = new THREE.DirectionalLight('#fff7e7', 1.7); sun.position.set(12, 7, 6); sun.target.position.set(-3, .1, -1);
  sun.name = 'Window sunlight';
  sun.castShadow = true; Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 1, far: 40 });
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.000035; sun.shadow.normalBias = .002; sun.shadow.radius = 6; sun.shadow.intensity = .8; architecture.add(sun, sun.target);
  const hemisphere = new THREE.HemisphereLight('#ecf3f8', '#bcc0b6', .58); architecture.add(hemisphere);
  const bounce = new THREE.DirectionalLight('#ece7db', .35); bounce.position.set(-5, 3, 6); architecture.add(bounce);
  // Lettering is printed directly on the plaster; transparent margins avoid billboard edges.
  const letteringMaterials = [];
  function lettering(lines, w, h, x, y, z, rotate = 0) {
    const t = textTexture(lines, { width: 1536, height: Math.round(1536 * h / w) });
    // Remove only the uniform background; alpha leaves the wall's light and grain visible.
    const c = t.image, ctx = c.getContext('2d'), data = ctx.getImageData(0, 0, c.width, c.height), rgb = data.data;
    for (let p = 0; p < rgb.length; p += 4) { const ink = 1 - Math.min(1, Math.max(0, (rgb[p] - 56) / (238 - 56))); rgb[p] = rgb[p + 1] = rgb[p + 2] = 255; rgb[p + 3] = Math.round(ink * 255); }
    ctx.putImageData(data, 0, 0); t.needsUpdate = true;
    const inkMaterial = new THREE.MeshStandardMaterial({ map: t, color: '#2d2d29', transparent: true, roughness: 1, depthWrite: false });
    letteringMaterials.push(inkMaterial);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), inkMaterial); mesh.position.set(x, y, z); mesh.rotation.y = rotate; architecture.add(mesh); return mesh;
  }
  const titleLines = [
    { text: 'STUDIO', size: 48, y: .16 },
    { text: 'SUPRA-Tex', size: 155, y: .51 },
    { text: '3D Generation with Super-Aligned Texture', size: 52, y: .68 },
    { text: 'what you see is what you get', size: 48, y: .85, font: 'Georgia', style: 'italic' }
  ];
  const mainLettering = lettering(titleLines, 4.3, 1.35, -3.6, 2.65, -9.275);
  mainLettering.name = 'Paper title';
  const collectionLettering = lettering([{ text: '01—06', size: 160, y: .48, font: 'Georgia' }, { text: 'STUDIO COLLECTION', size: 31, y: .72 }], 1.55, .8, 3.1, 2.33, -9.275);
  // Ceiling ventilation slots and small electrical details add scale without visual clutter.
  for (let i = 0; i < 9; i++) solid(1.0, .012, .018, -4.8, 4.59, -6.8 + i * .043, frameMaterial);
  [4.7, -5.4].forEach(z => { solid(.022, .12, .08, -6.44, .32, z, paleStone, .004); });

  const plinthMaterial = new THREE.MeshStandardMaterial({ color: '#e1ded5', roughness: .69, normalMap: plaster, normalScale: new THREE.Vector2(.025, .025) });
  // Charcoal surfaces, neutral luminaires and diffuse daylight panels.
  const themeMaterials = [
    [wall, '#e5e0d5', '#303332'],
    [recess, '#9a968b', '#191d1c'],
    [floor.material, '#c3c3bb', '#686b68'],
    [seam, '#4f514c', '#171b19'],
    [frameMaterial, '#222622', '#8e826a'],
    [paleStone, '#b7b3a8', '#777b72'],
    [brass, '#756148', '#c7b995'],
    [windowMat, '#e7e4dc', '#8e826a'],
    [ceiling.material, '#e2e0d9', '#242827'],
    [plinthMaterial, '#e1ded5', '#454844'],
    ...letteringMaterials.map(mat => [mat, '#2d2d29', '#d1b777'])
  ];
  function showWindows() {
    westWall.visible = eastWall.visible = false;
    westWindow.visible = eastWindow.visible = true;
    windowDaylight.visible = true;
    windowDaylight.children.forEach(light => { light.visible = true; });
    sun.visible = false;
    renderer.shadowMap.needsUpdate = true;
  }
  function applyTheme() {
    const dark = true, palette = 2;
    themeMaterials.forEach(([mat, light, dark]) => mat.color.set(palette === 2 ? dark : light));
    ceiling.material.emissive.set(dark ? '#242827' : '#d9dce1');
    ceiling.material.emissiveIntensity = dark ? 0 : .13;
    letteringMaterials.forEach(mat => { mat.metalness = dark ? .4 : 0; mat.roughness = dark ? .43 : 1; });
    collectionLettering.visible = !dark;
    closedBackWall.visible = dark; backSkirting.visible = dark; innerGlow.visible = !dark;
    mainLettering.visible = true;
    rearFixtures.forEach(object => { object.visible = dark; });
    centerTrack.visible = dark;
    // Every fixture follows its exhibit when changing the room arrangement.
    // The center row has its own rail in the eight-object exhibition.
    const positions = dark ? studio.darkPositions : studio.positions;
    trackFixtures.forEach((fixture, i) => {
      const [x, z] = positions[i];
      aimExhibitLight(i, fixture.center || new THREE.Vector3(x, studio.heights[i]+studio.exhibitHeights[i]/2, z), fixture.lighting);
    });
    renderer.shadowMap.needsUpdate = true;
    ceilingPanels.visible = false;
    wallWashers.visible = dark;
    entranceVestibule.visible = dark;
    bulb.color.set(dark ? '#ffffff' : '#fff1d5');
    trackLights.forEach(light => { light.color.set('#ffffff'); });
    sun.color.set(dark ? '#f4f7ff' : '#fff7e7'); sun.intensity = dark ? 1.9 : 1.7;
    hemisphere.intensity = dark ? .2 : .58;
    bounce.intensity = 0;
    innerGlow.color.set(dark ? '#ffffff' : '#fff1d9');
    showWindows();
  }
  return { architecture, reflection, floor, frostedPanels, frameMaterial, plinthMaterial, brass, solid, applyTheme, aimExhibitLight, trackFixtures,
    navigationBlockers: [], ready: Promise.all(materialLoads) };
}

export function createPlinth(x, z, width, top, material, group) {
  const toe = new THREE.Mesh(new RoundedBoxGeometry(width - .075, .04, width - .075, 2, .005), new THREE.MeshStandardMaterial({ color: '#3d3d37', roughness: .9 }));
  toe.position.set(x, .02, z); toe.castShadow = toe.receiveShadow = true; group.add(toe);
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(width, top - .025, width, 3, .012), material.clone());
  plinth.position.set(x, (top + .025) / 2, z); plinth.castShadow = plinth.receiveShadow = true; group.add(plinth); return plinth;
}
