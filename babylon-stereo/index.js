import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import '@babylonjs/core/Shaders/shadowMap.fragment.js';
import '@babylonjs/core/Shaders/shadowMap.vertex.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import {
  KMAX_BABYLON_STEREO_VERSION,
  KBabylonStereoEffect,
  KBabylonStylusRaycaster,
  WSTrackClient,
  createBabylonKmaxFrustumProvider,
} from '@kmax/babylon-stereo';

console.info('@kmax/babylon-stereo version', KMAX_BABYLON_STEREO_VERSION);
import './style.css';

const canvas = document.querySelector('#renderCanvas');
const fpsCounter = document.querySelector('#fpsCounter');
const statusText = document.querySelector('#status');
const fullscreenButton = document.querySelector('#fullscreenButton');

const engine = new Engine(canvas, true);
const scene = new Scene(engine);
scene.clearColor = new Color4(0.94, 0.95, 0.93, 1);

const camera = new FreeCamera('main-camera', new Vector3(0, 0, -0.5), scene);
camera.setTarget(Vector3.Zero());
camera.minZ = 0.1;
camera.maxZ = 1000;
// camera.attachControl(canvas, true);

const hemiLight = new HemisphericLight('hemi-light', new Vector3(0, 1, 0), scene);
hemiLight.intensity = 0.55;

const keyLight = new DirectionalLight('key-light', new Vector3(2, -2, 1), scene);
keyLight.position = new Vector3(-2, 2, -1);
keyLight.intensity = 0.5;

const shadowGenerator = new ShadowGenerator(1024, keyLight);

const baseMaterial = new StandardMaterial('base-material', scene);
baseMaterial.diffuseColor = new Color3(0.22, 0.72, 0.48);

const accentMaterial = new StandardMaterial('accent-material', scene);
accentMaterial.diffuseColor = new Color3(0.08, 0.16, 0.22);

const floorMaterial = new StandardMaterial('floor-material', scene);
floorMaterial.diffuseColor = new Color3(0.86, 0.88, 0.84);

const floor = CreateGround('floor', { width: 4, height: 4 }, scene);
floor.position.y = -0.22;
floor.material = floorMaterial;
floor.receiveShadows = true;

const meshes = [];
const cubeSize = 0.1;
const sphereDiameter = (cubeSize / 10) * 2;
const cubeEdge = 11;
const gap = 1 / (cubeEdge - 1);
const offset = new Vector3(0, 0, 0.1);
const animatedMeshes = [];

for (let i = 0; i < cubeEdge; i += 1) {
  for (let k = 0; k < cubeEdge; k += 1) {
    const id = i * cubeEdge + k;
    const mesh = CreateSphere(`point-${id}`, { diameter: sphereDiameter, segments: 16 }, scene);
    const material = new StandardMaterial(`point-material-${id}`, scene);
    material.diffuseColor = Color3.FromHSV((id * 23) % 360, 0.58, 0.9);
    mesh.material = material;
    mesh.metadata = {
      id,
      phase: Math.random() * Math.PI,
    };
    const layer = gap * (id / cubeEdge / 4);
    mesh.position.set(
      Math.sin(id) * layer + offset.x,
      Math.sin(id + mesh.metadata.phase) * layer + offset.y,
      -Math.cos(id) * layer + offset.z,
    );
    mesh.scaling.scaleInPlace(Math.random() * 0.8 + 0.2);
    shadowGenerator.addShadowCaster(mesh);
    meshes.push(mesh);
    animatedMeshes.push(mesh);
  }
}

const anchor = CreateBox('kmax-anchor', { size: 0.1 }, scene);
anchor.position = offset.clone();
anchor.material = accentMaterial;
shadowGenerator.addShadowCaster(anchor);
meshes.push(anchor);

const stylus = new KBabylonStylusRaycaster(scene);
const effect = new KBabylonStereoEffect(engine);
let trackData = null;
let fullscreen = false;
let sdkReady = false;
let trackingStatus = 'connecting';
let applyKmaxFrustum = null;
let lastFpsUpdate = 0;

function updateStatusText() {
  if (!sdkReady) {
    statusText.textContent = '正在初始化 SDK';
    return;
  }

  if (trackingStatus === 'connected') {
    statusText.textContent = 'SDK 已初始化，已连接追踪服务';
    return;
  }

  if (trackingStatus === 'connecting') {
    statusText.textContent = 'SDK 已初始化，正在连接追踪服务';
    return;
  }

  statusText.textContent = 'SDK 已初始化，未检测到追踪服务';
}

updateStatusText();

createBabylonKmaxFrustumProvider()
  .then((provider) => {
    applyKmaxFrustum = provider;
    effect.setFrustumProvider(provider);
    sdkReady = true;
    updateStatusText();
  })
  .catch((error) => {
    statusText.textContent = 'SDK 初始化失败';
    console.error('Kmax Babylon SDK 初始化失败。', error);
  });

const wst = new WSTrackClient({
  onStatusChange(status) {
    trackingStatus = status;
    if (status !== 'connected') trackData = null;
    updateStatusText();
  },
});
wst.onData = (data) => {
  trackData = data;
};

fullscreenButton.addEventListener('click', () => {
  canvas.requestFullscreen();
  fullscreen = true;
  if (wst.status === 'connected') wst.setDisplayMode(1, 1);
});

document.addEventListener('fullscreenchange', () => {
  fullscreen = Boolean(document.fullscreenElement);
  if (!fullscreen && wst.status === 'connected') {
    wst.setDisplayMode(0, 0);
  }
});

window.addEventListener('resize', () => {
  effect.setSize();
});

function animateScene() {
  const time = performance.now() / 10000;
  animatedMeshes.forEach((mesh) => {
    if (mesh === stylus.dragObject) return;
    const id = mesh.metadata.id;
    const layer = gap * (id / cubeEdge / 4);
    mesh.position.set(
      Math.sin(id + time) * layer + offset.x,
      Math.sin(id + mesh.metadata.phase + time) * 0.18 * layer + offset.y,
      -Math.cos(id + time) * layer + offset.z,
    );
  });
}

function updateFpsCounter() {
  const now = performance.now();
  if (now - lastFpsUpdate < 250) return;
  lastFpsUpdate = now;
  fpsCounter.textContent = `FPS ${engine.getFps().toFixed(1)}`;
}

engine.runRenderLoop(() => {
  animateScene();

  if (trackData) {
    const pos = trackData.eye.pos;
    camera.position.set(pos.x, pos.y, pos.z);
    stylus.updatePose(trackData.pen);
    stylus.processKey(trackData.penKey, stylus.intersectObjects(meshes));
  } else {
    stylus.updatePose(null);
  }

  if (applyKmaxFrustum) applyKmaxFrustum(camera);

  if (fullscreen) {
    effect.render(scene, camera);
  } else {
    scene.render();
  }

  updateFpsCounter();
});

