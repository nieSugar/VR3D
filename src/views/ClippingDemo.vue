<template>
  <div class="clipping-demo">
    <div ref="container" class="canvas-container"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import GUI from 'lil-gui'

const container = ref<HTMLDivElement | null>(null)

let camera: THREE.PerspectiveCamera
let scene: THREE.Scene
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let stats: Stats
let object: THREE.Group
let material: THREE.MeshPhongMaterial
let animationId: number
let gui: GUI

// X/Y/Z 三个方向的剖切平面（实际用于剖切，会跟随物体旋转）
let planeX: THREE.Plane
let planeY: THREE.Plane
let planeZ: THREE.Plane

// 局部坐标系的原始平面（不变，用于计算）
let localPlaneX: THREE.Plane
let localPlaneY: THREE.Plane
let localPlaneZ: THREE.Plane

// 剖切平面辅助器
let helperX: THREE.PlaneHelper
let helperY: THREE.PlaneHelper
let helperZ: THREE.PlaneHelper

// GUI 参数
const params = {
  alphaToCoverage: true,
  clipShadows: true,
  showHelpers: true,
  autoRotate: false,
  rotateSpeed: 1,
  // X 轴
  planeX: {
    enabled: false,
    constant: 0,
    negate: false
  },
  // Y 轴
  planeY: {
    enabled: false,
    constant: 0,
    negate: false
  },
  // Z 轴
  planeZ: {
    enabled: false,
    constant: 0,
    negate: false
  }
}

function init() {
  if (!container.value) return

  // Camera
  camera = new THREE.PerspectiveCamera(36, container.value.clientWidth / container.value.clientHeight, 0.25, 16)
  camera.position.set(0, 1.3, 3)

  // Scene
  scene = new THREE.Scene()

  // Lights
  scene.add(new THREE.AmbientLight(0xcccccc))

  const spotLight = new THREE.SpotLight(0xffffff, 60)
  spotLight.angle = Math.PI / 5
  spotLight.penumbra = 0.2
  spotLight.position.set(2, 3, 3)
  spotLight.castShadow = true
  spotLight.shadow.camera.near = 3
  spotLight.shadow.camera.far = 10
  spotLight.shadow.mapSize.width = 1024
  spotLight.shadow.mapSize.height = 1024
  scene.add(spotLight)

  const dirLight = new THREE.DirectionalLight(0x55505a, 3)
  dirLight.position.set(0, 3, 0)
  dirLight.castShadow = true
  dirLight.shadow.camera.near = 1
  dirLight.shadow.camera.far = 10
  dirLight.shadow.camera.right = 1
  dirLight.shadow.camera.left = -1
  dirLight.shadow.camera.top = 1
  dirLight.shadow.camera.bottom = -1
  dirLight.shadow.mapSize.width = 1024
  dirLight.shadow.mapSize.height = 1024
  scene.add(dirLight)

  // 局部坐标系的原始平面（用于计算旋转后的法线）
  localPlaneX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), params.planeX.constant)
  localPlaneY = new THREE.Plane(new THREE.Vector3(0, -1, 0), params.planeY.constant)
  localPlaneZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), params.planeZ.constant)

  // 实际用于剖切的平面（会跟随物体旋转）
  planeX = new THREE.Plane(new THREE.Vector3(-1, 0, 0), params.planeX.constant)
  planeY = new THREE.Plane(new THREE.Vector3(0, -1, 0), params.planeY.constant)
  planeZ = new THREE.Plane(new THREE.Vector3(0, 0, -1), params.planeZ.constant)

  // 剖切平面辅助器 (PlaneHelper)
  helperX = new THREE.PlaneHelper(planeX, 2, 0xff5252)
  helperY = new THREE.PlaneHelper(planeY, 2, 0x69f069)
  helperZ = new THREE.PlaneHelper(planeZ, 2, 0x5282ff)
  helperX.visible = false
  helperY.visible = false
  helperZ.visible = false
  scene.add(helperX)
  scene.add(helperY)
  scene.add(helperZ)

  // Material with clipping
  material = new THREE.MeshPhongMaterial({
    color: 0x80ee10,
    shininess: 100,
    side: THREE.DoubleSide,
    clippingPlanes: [],
    clipShadows: params.clipShadows,
    alphaToCoverage: params.alphaToCoverage
  })

  // Geometry - Box
  const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8)
  object = new THREE.Group()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = true
  object.add(mesh)
  scene.add(object)
  object.position.y = 0.8

  // Ground
  const groundMaterial = new THREE.MeshPhongMaterial({
    color: 0xa0adaf,
    shininess: 150,
    alphaToCoverage: params.alphaToCoverage
  })
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 9, 1, 1),
    groundMaterial
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  renderer.shadowMap.enabled = true
  renderer.localClippingEnabled = true
  container.value.appendChild(renderer.domElement)

  // Stats
  stats = new Stats()
  container.value.appendChild(stats.dom)
  stats.dom.style.position = 'absolute'
  stats.dom.style.top = '0'
  stats.dom.style.left = '0'

  // Controls
  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 1, 0)
  controls.update()

  // 初始化 GUI
  initGUI()

  // 更新剖切平面
  updateClippingPlanes()

  window.addEventListener('resize', onWindowResize)
  animate()
}

function initGUI() {
  gui = new GUI({ title: '剖切平面演示' })

  // 全局设置
  gui.add(params, 'alphaToCoverage').name('透明度覆盖').onChange((value: boolean) => {
    material.alphaToCoverage = value
    material.needsUpdate = true
    const ground = scene.children.find(c => c instanceof THREE.Mesh && (c as THREE.Mesh).geometry instanceof THREE.PlaneGeometry) as THREE.Mesh | undefined
    if (ground && ground.material instanceof THREE.MeshPhongMaterial) {
      ground.material.alphaToCoverage = value
      ground.material.needsUpdate = true
    }
  })
  gui.add(params, 'clipShadows').name('剖切阴影').onChange((value: boolean) => {
    material.clipShadows = value
  })
  gui.add(params, 'showHelpers').name('显示辅助器').onChange(() => updateHelpers())

  // 旋转控制
  const rotateFolder = gui.addFolder('旋转控制')
  rotateFolder.add(params, 'autoRotate').name('自动旋转')
  rotateFolder.add(params, 'rotateSpeed', 0.1, 5, 0.1).name('速度')

  // X 轴剖切
  const folderX = gui.addFolder('X 轴剖切')
  folderX.add(params.planeX, 'enabled').name('启用').onChange(() => updateClippingPlanes())
  folderX.add(params.planeX, 'negate').name('反向').onChange(() => updateClippingPlanes())
  folderX.add(params.planeX, 'constant', -2, 2, 0.01).name('位置').onChange(() => updateClippingPlanes())

  // Y 轴剖切
  const folderY = gui.addFolder('Y 轴剖切')
  folderY.add(params.planeY, 'enabled').name('启用').onChange(() => updateClippingPlanes())
  folderY.add(params.planeY, 'negate').name('反向').onChange(() => updateClippingPlanes())
  folderY.add(params.planeY, 'constant', -2, 2, 0.01).name('位置').onChange(() => updateClippingPlanes())

  // Z 轴剖切
  const folderZ = gui.addFolder('Z 轴剖切')
  folderZ.add(params.planeZ, 'enabled').name('启用').onChange(() => updateClippingPlanes())
  folderZ.add(params.planeZ, 'negate').name('反向').onChange(() => updateClippingPlanes())
  folderZ.add(params.planeZ, 'constant', -2, 2, 0.01).name('位置').onChange(() => updateClippingPlanes())
}

function onWindowResize() {
  if (!container.value) return
  camera.aspect = container.value.clientWidth / container.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
}

function animate() {
  animationId = requestAnimationFrame(animate)

  // 自动旋转
  if (params.autoRotate) {
    object.rotation.y += 0.01 * params.rotateSpeed
  }

  // 更新剖切平面法线（跟随物体旋转）
  updatePlaneNormals()

  stats.begin()
  renderer.render(scene, camera)
  stats.end()
}

// 更新剖切平面法线（跟随物体旋转）
function updatePlaneNormals() {
  if (!object) return

  // X 轴平面
  if (params.planeX.enabled) {
    const worldPlane = localPlaneX.clone()
    worldPlane.applyMatrix4(object.matrixWorld)
    planeX.normal.copy(worldPlane.normal)
  }

  // Y 轴平面
  if (params.planeY.enabled) {
    const worldPlane = localPlaneY.clone()
    worldPlane.applyMatrix4(object.matrixWorld)
    planeY.normal.copy(worldPlane.normal)
  }

  // Z 轴平面
  if (params.planeZ.enabled) {
    const worldPlane = localPlaneZ.clone()
    worldPlane.applyMatrix4(object.matrixWorld)
    planeZ.normal.copy(worldPlane.normal)
  }
}

// 更新剖切平面
function updateClippingPlanes() {
  if (!material) return

  const planes: THREE.Plane[] = []

  if (params.planeX.enabled) {
    // 更新局部平面（原始方向）
    localPlaneX.normal.set(params.planeX.negate ? 1 : -1, 0, 0)
    localPlaneX.constant = params.planeX.constant
    // 复制到实际剖切平面
    planeX.normal.copy(localPlaneX.normal)
    planeX.constant = params.planeX.constant
    planes.push(planeX)
  }

  if (params.planeY.enabled) {
    localPlaneY.normal.set(0, params.planeY.negate ? 1 : -1, 0)
    localPlaneY.constant = params.planeY.constant
    planeY.normal.copy(localPlaneY.normal)
    planeY.constant = params.planeY.constant
    planes.push(planeY)
  }

  if (params.planeZ.enabled) {
    localPlaneZ.normal.set(0, 0, params.planeZ.negate ? 1 : -1)
    localPlaneZ.constant = params.planeZ.constant
    planeZ.normal.copy(localPlaneZ.normal)
    planeZ.constant = params.planeZ.constant
    planes.push(planeZ)
  }

  material.clippingPlanes = planes

  // 更新辅助器
  updateHelpers()
}

// 更新辅助器
function updateHelpers() {
  if (!helperX) return

  helperX.visible = true;
  helperY.visible = true;
  helperZ.visible = true;
}

onMounted(() => {
  init()
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  if (animationId) cancelAnimationFrame(animationId)
  if (renderer) {
    renderer.dispose()
    renderer.domElement.remove()
  }
  if (stats?.dom) stats.dom.remove()
  if (gui) gui.destroy()
})
</script>

<style scoped>
.clipping-demo {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
  background: #1a1a2e;
}

.canvas-container {
  width: 100%;
  height: 100%;
}
</style>
