import * as THREE from 'three';
import Stats from 'stats.js';
import { GUI } from 'lil-gui';
import {
  KMAX_THREE_STEREO_VERSION,
  KStereoEffect,
  KStylusRaycaster,
  WSTrackClient,
  createKmaxFrustumProvider,
} from '@kmax/three-stereo';

console.info('@kmax/three-stereo version', KMAX_THREE_STEREO_VERSION);

const scene = new THREE.Scene();

scene.background = new THREE.Color(0xf0f0f0);
scene.fog = new THREE.Fog(0xf0f0f0, 0.1, 5);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true; //阴影
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const cubeSize = 0.1;
const geometry = new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize);
const sGeometry = new THREE.SphereGeometry(cubeSize / 10, 32, 16);
const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });

const textureLoader = new THREE.TextureLoader();
const KmaxLogo = textureLoader.load("./logo.png");
const logoMat = new THREE.MeshPhongMaterial({ map: KmaxLogo });
// 自发光
// const logoMat = new THREE.MeshPhongMaterial({map: KmaxLogo, emissive: 0x00ff00, emissiveMap: KmaxLogo});

const cubes = [];
const cubeEdge = 11;
const offset = new THREE.Vector3(0, 0, -0.1);
const gap = 1.0 / (cubeEdge - 1);
function createCube(id, geometry, mat) {
  const cube = new THREE.Mesh(geometry, mat);
  // const cube = new THREE.Mesh(geometry, logoMat);
  cube.castShadow = true;
  cube.receiveShadow = true;
  cube.userData.phase = Math.random() * Math.PI;
  cube.userData.id = id;
  const layer = id / cubeEdge;
  cube.position.set(Math.sin(id), Math.sin(id + cube.userData.phase), Math.cos(id)).multiplyScalar(gap * layer).add(offset);
  scene.add(cube);
  return cube;
}
const logoCube = createCube(-1, geometry, logoMat);
logoCube.userData.isLogo = true;
logoCube.position.set(0, 0, 0).add(offset);
cubes.push(logoCube);
for (let i = 0; i < cubeEdge; i++) {
  for (let k = 0; k < cubeEdge; k++) {
    const id = i * cubeEdge + k;
    // const id1 = id % 2 == 1;
    const material = new THREE.MeshPhongMaterial({ color: Math.random() * 0xffffff });
    const cube = createCube(id, sGeometry, material);
    cube.userData.isLogo = false;
    cube.scale.multiplyScalar(Math.random() * 0.8 + 0.2);
    cubes.push(cube);
  }
}

// 射线
const kStylus = new KStylusRaycaster(scene);
// 事件
// kStylus.addEventListener('press', (e)=> {});

// 灯光
const light = new THREE.DirectionalLight(0xffffff, 0.5);
light.position.set(-2, 2, 1);
light.castShadow = true;
scene.add(light);
light.shadow.mapSize.width = 2048;
light.shadow.mapSize.height = 2048;
light.shadow.camera.near = 0.1; // default
light.shadow.camera.far = 10; // default
light.shadow.camera.left = -1;
light.shadow.camera.right = 1;
light.shadow.camera.top = 1;
light.shadow.camera.bottom = -1;
// const lightHelper = new THREE.DirectionalLightHelper(light, 0.1);
// scene.add(lightHelper);
const alight = new THREE.AmbientLight(0x404040); // 柔和的白光
scene.add(alight);

// 地面
const planeGeometry = new THREE.PlaneGeometry(20, 20, 32, 32);
planeGeometry.rotateX(-Math.PI / 2);
const planeMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff })
const plane = new THREE.Mesh(planeGeometry, planeMaterial);
plane.receiveShadow = true;
plane.position.set(0, -0.2, 0);
scene.add(plane);

// FPS
let stats = new Stats();
document.body.appendChild(stats.dom);
let kmaxTrackingAvailable = false;
// UI
const API = {
  fullscreen: false,
  enterFullscreen: function () {
    renderer.domElement.requestFullscreen();
    if (kmaxTrackingAvailable) wst.setDisplayMode(1, 1);
    API.fullscreen = true;
  },
  exitFullscreen: function () {
    if (document.fullscreenElement) document.exitFullscreen();
    if (kmaxTrackingAvailable) wst.setDisplayMode(0, 0);
    API.fullscreen = false;
  }
}
let gui = new GUI();
gui.add(API, 'enterFullscreen');
gui.add(API, 'exitFullscreen');

camera.position.set(0, 0, 0.5);
let effect = new KStereoEffect(renderer);
effect.setSize(window.innerWidth, window.innerHeight);
let applyKmaxFrustum = null;
createKmaxFrustumProvider()
  .then((provider) => {
    applyKmaxFrustum = provider;
    effect.setFrustumProvider(provider);
  })
  .catch((error) => {
    console.error('Failed to initialize Kmax stereo frustum provider.', error);
  });

let trackData = null;

function animate() {
  const time = performance.now() / 10000;
  cubes.forEach(cube => {
    if (cube.userData.isLogo) return;
    if (cube == kStylus.dragObject) return;
    const id = cube.userData.id;
    const layer = id / cubeEdge / 4;
    cube.position.set(Math.sin(id + time), Math.sin(id + cube.userData.phase + time) * 0.18, Math.cos(id + time))
      .multiplyScalar(gap * layer).add(offset);
  });
}

function render() {
  requestAnimationFrame(render);

  animate();
  // 追踪
  if (trackData != null) {
    const eye = trackData.eye;
    const pos = eye.pos;
    camera.position.set(pos.x, pos.y, -pos.z);
    // 射线
    kStylus.updatePose(trackData.pen);
    kStylus.processKey(trackData.penKey, kStylus.intersectObjects(cubes));
  } else {
    kStylus.updatePose(null);
  }

  // 更新相机矩阵
  if (applyKmaxFrustum) applyKmaxFrustum(camera);
  // 全屏时以立体格式渲染
  if (API.fullscreen)
    effect.render(scene, camera);
  else
    renderer.render(scene, camera);
  stats.update();
}

function onWindowResize() {
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // renderer.setSize( window.innerWidth, window.innerHeight );
  effect.setSize(window.innerWidth, window.innerHeight);
}
render();
window.addEventListener('resize', onWindowResize);

const wst = new WSTrackClient({
  onStatusChange(status) {
    kmaxTrackingAvailable = status === 'connected';
    if (!kmaxTrackingAvailable) trackData = null;
  },
});
wst.onData = (data) => {
  trackData = data;
}
function fullscreenchanged(event) {
  // 如果有元素处于全屏模式，则 document.fullscreenElement 将指向该元素。如果没有元素处于全屏模式，则该属性的值为 null。
  if (document.fullscreenElement) {
    console.log(
      `Element: ${document.fullscreenElement.id} entered fullscreen mode.`,
    );
  } else {
    console.log("Leaving fullscreen mode.");
    API.exitFullscreen();
  }
}
document.addEventListener("fullscreenchange", fullscreenchanged);
