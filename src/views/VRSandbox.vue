<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js'
import { InteractiveGroup } from 'three/examples/jsm/interactive/InteractiveGroup.js'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { GUI } from 'lil-gui'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import hdrTexture from '../assets/moonless_golf_1k.hdr'
import { createMaterialSelectUI } from '../utils/htmlMeshUtils'
import CustomCheckbox from '../components/CustomCheckbox.vue'
import CustomSelect, { type SelectOption } from '../components/CustomSelect.vue'
import CustomSlider from '../components/CustomSlider.vue'
import CustomButtons from '../components/CustomButtons.vue'

const container = ref<HTMLDivElement | null>(null)
const bodyRef = ref<HTMLElement | null>(null)

let camera: THREE.PerspectiveCamera
let scene: THREE.Scene
let renderer: THREE.WebGLRenderer
let reflector: Reflector

const stats = new Stats()
stats.dom.style.width = '80px'
stats.dom.style.height = '48px'
document.body.appendChild(stats.dom)

let animationId: number | null = null
let gui: GUI | null = null
let materialSelectMesh: HTMLMesh | null = null
let bodyMesh: HTMLMesh | null = null
let guiMesh: HTMLMesh | null = null
let torus: THREE.Mesh | null = null
let domObserver: MutationObserver | null = null

const parameters = reactive({
  radius: 0.6,
  tube: 0.2,
  tubularSegments: 150,
  radialSegments: 20,
  p: 2,
  q: 3,
  thickness: 0.5,
  showModel: true,  // 添加模型显示控制参数
  materialType: 'glass',  // 材质类型
  preset: 'custom',  // 预设形状
  colorScheme: 'environment',  // 颜色方案
  animationSpeed: 1.0  // 动画速度
})

const materials: SelectOption[] = [
  { value: "glass", label: "玻璃" },
  { value: "metal", label: "金属" },
  { value: "plastic", label: "塑料" },
  { value: "wireframe", label: "线框" },
  { value: "normal", label: "法线" },
  { value: "normal1", label: "法线1" },
  { value: "normal2", label: "法线2" },
];

watch(() => parameters.showModel, () => {
  onModelVisibilityChange();
})

watch(() => parameters.materialType, () => {
  onMaterialChange();
})

function init() {
  if (!container.value) return

  scene = new THREE.Scene()

  // 加载 HDR 环境贴图
  new HDRLoader()
    .load(hdrTexture, function (texture) {
      texture.mapping = THREE.EquirectangularReflectionMapping
      scene.background = texture
      scene.environment = texture
    })

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 10)
  camera.position.set(0, 1.6, 1.5)

  // 创建圆环结
  const torusGeometry = new THREE.TorusKnotGeometry(
    parameters.radius,
    parameters.tube,
    parameters.tubularSegments,
    parameters.radialSegments,
    parameters.p,
    parameters.q
  )
  const torusMaterial = new THREE.MeshPhysicalMaterial({
    transmission: 1.0,
    roughness: 0,
    metalness: 0.25,
    thickness: parameters.thickness,
    side: THREE.DoubleSide
  })
  torus = new THREE.Mesh(torusGeometry, torusMaterial)
  torus.name = 'torus'
  torus.position.y = 1.5
  torus.position.z = -2
  torus.visible = parameters.showModel
  scene.add(torus)

  // 创建圆柱体
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 0.1, 50)
  const cylinderMaterial = new THREE.MeshStandardMaterial()
  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
  cylinder.position.z = -2
  scene.add(cylinder)

  // 创建反射器
  reflector = new Reflector(new THREE.PlaneGeometry(2, 2), {
    textureWidth: window.innerWidth,
    textureHeight: window.innerHeight
  })
  reflector.position.x = 1
  reflector.position.y = 1.5
  reflector.position.z = -3
  reflector.rotation.y = -Math.PI / 4
  scene.add(reflector)

  // 创建边框
  const frameGeometry = new THREE.BoxGeometry(2.1, 2.1, 0.1)
  const frameMaterial = new THREE.MeshPhongMaterial()
  const frame = new THREE.Mesh(frameGeometry, frameMaterial)
  frame.position.z = -0.07
  reflector.add(frame)

  // 设置渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.autoClear = false
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setAnimationLoop(animate)
  renderer.xr.enabled = true
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1
  container.value.appendChild(renderer.domElement)

  // 添加 VR 按钮
  const vrButton = VRButton.createButton(renderer)
  document.body.appendChild(vrButton)

  // VR 控制器设置
  const geometry = new THREE.BufferGeometry()
  geometry.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -5)])

  const controller1 = renderer.xr.getController(0)
  controller1.add(new THREE.Line(geometry))
  scene.add(controller1)

  const controller2 = renderer.xr.getController(1)
  controller2.add(new THREE.Line(geometry))
  scene.add(controller2)

  // 控制器模型
  const controllerModelFactory = new XRControllerModelFactory()

  const controllerGrip1 = renderer.xr.getControllerGrip(0)
  controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1))
  scene.add(controllerGrip1)

  const controllerGrip2 = renderer.xr.getControllerGrip(1)
  controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2))
  scene.add(controllerGrip2)



  gui = new GUI({ width: 350 })

  // 基础控制
  const basicFolder = gui.addFolder('基础控制')
  basicFolder.add(parameters, 'showModel').name('显示模型').onChange(onModelVisibilityChange)
  basicFolder.add(parameters, 'animationSpeed', 0, 3, 0.1).name('动画速度')
  basicFolder.open()

  // 材质和颜色
  const appearanceFolder = gui.addFolder('外观')
  appearanceFolder.add(parameters, 'materialType', {
    '玻璃': 'glass',
    '金属': 'metal',
    '塑料': 'plastic',
    '线框': 'wireframe',
    '法线': 'normal'
  }).name('材质类型').onChange(onMaterialChange)

  appearanceFolder.add(parameters, 'colorScheme', {
    '环境色': 'environment',
    '红色': 'red',
    '蓝色': 'blue',
    '绿色': 'green',
    '金色': 'gold',
    '紫色': 'purple'
  }).name('颜色方案').onChange(onColorSchemeChange)

  appearanceFolder.add(parameters, 'thickness', 0, 1).name('厚度').onChange(onThicknessChange)
  appearanceFolder.open()

  // 预设形状
  const presetsFolder = gui.addFolder('预设形状')
  presetsFolder.add(parameters, 'preset', {
    '自定义': 'custom',
    '圆环': 'torus',
    '三叶结': 'trefoil',
    '8字结': 'figure8',
    '五叶结': 'cinquefoil',
    '奶奶结': 'granny'
  }).name('选择预设').onChange(onPresetChange)
  presetsFolder.open()

  // 几何参数
  const geometryFolder = gui.addFolder('几何参数')
  geometryFolder.add(parameters, 'radius', 0.0, 1.0).name('半径').onChange(onChange)
  geometryFolder.add(parameters, 'tube', 0.0, 1.0).name('管径').onChange(onChange)
  geometryFolder.add(parameters, 'tubularSegments', 10, 150, 1).name('管段数').onChange(onChange)
  geometryFolder.add(parameters, 'radialSegments', 2, 20, 1).name('径向段数').onChange(onChange)
  geometryFolder.add(parameters, 'p', 1, 10, 1).name('P值').onChange(onChange)
  geometryFolder.add(parameters, 'q', 0, 10, 1).name('Q值').onChange(onChange)
  geometryFolder.open()

  // 交互组
  const group = new InteractiveGroup()
  group.listenToPointerEvents(renderer, camera)
  group.listenToXRControllerEvents(controller1)
  group.listenToXRControllerEvents(controller2)
  scene.add(group)

  // console.log(bodyRef.value, 'bodyRef');

  bodyMesh = new HTMLMesh(bodyRef.value!)
  bodyMesh.position.x = 0.75;
  bodyMesh.position.y = 1.5;
  bodyMesh.position.z = -0.5;
  bodyMesh.rotation.y = -Math.PI / 4;
  bodyMesh.scale.setScalar(2);
  group.add(bodyMesh)

  // 设置 MutationObserver 监听 DOM 变化
  domObserver = new MutationObserver(() => {
    if (bodyMesh && bodyMesh.material && bodyMesh.material.map) {
      bodyMesh.material.map.needsUpdate = true;
    }
  });
  
  if (bodyRef.value) {
    domObserver.observe(bodyRef.value, {
      attributes: true,
      childList: true,
      subtree: true,
      characterData: true
    });
  }


  // GUI 网格
  // const guiMesh = new HTMLMesh(gui.domElement)
  // guiMesh.position.x = -0.75
  // guiMesh.position.y = 1.5
  // guiMesh.position.z = -0.5
  // guiMesh.rotation.y = Math.PI / 4
  // guiMesh.scale.setScalar(2)
  // group.add(guiMesh)


  // 创建材质选择器和checkbox UI
  // const materialUIResult = createMaterialSelectUI(
  //   parameters,
  //   onMaterialChange,
  //   onModelVisibilityChange,
  //   onChange,
  //   container.value,
  //   group
  // )
  // materialSelectMesh = materialUIResult.materialSelectMesh

  window.addEventListener('resize', onWindowResize)
}


// GUI 设置
function onChange() {
  if (torus) {
    torus.geometry.dispose()
    torus.geometry = new THREE.TorusKnotGeometry(
      parameters.radius,
      parameters.tube,
      parameters.tubularSegments,
      parameters.radialSegments,
      parameters.p,
      parameters.q
    )
  }
}

function onThicknessChange() {
  if (torus) {
    ; (torus.material as THREE.MeshPhysicalMaterial).thickness = parameters.thickness
  }
}

function onModelVisibilityChange() {
  console.log(parameters.showModel, 'parameters.showModel');

  if (torus) {
    torus.visible = parameters.showModel;
  }
}

// 材质类型切换
function onMaterialChange() {
  if (!torus) return

  const oldMaterial = torus.material as THREE.Material
  oldMaterial.dispose()

  switch (parameters.materialType) {
    case 'glass':
      torus.material = new THREE.MeshPhysicalMaterial({
        transmission: 1.0,
        roughness: 0,
        metalness: 0.25,
        thickness: parameters.thickness,
        side: THREE.DoubleSide
      })
      break
    case 'metal':
      torus.material = new THREE.MeshStandardMaterial({
        metalness: 1.0,
        roughness: 0.2,
        envMapIntensity: 1.0,
        side: THREE.DoubleSide
      })
      break
    case 'plastic':
      torus.material = new THREE.MeshPhongMaterial({
        shininess: 100,
        specular: 0x222222,
        side: THREE.DoubleSide
      })
      break
    case 'wireframe':
      torus.material = new THREE.MeshBasicMaterial({
        wireframe: true,
        color: 0x00ff00
      })
      break
    case 'normal':
      torus.material = new THREE.MeshNormalMaterial({
        side: THREE.DoubleSide
      })
      break
  }
}

// 预设形状切换
function onPresetChange() {
  switch (parameters.preset) {
    case 'torus':
      parameters.p = 1
      parameters.q = 0
      parameters.radius = 0.7
      parameters.tube = 0.3
      break
    case 'trefoil':
      parameters.p = 2
      parameters.q = 3
      parameters.radius = 0.6
      parameters.tube = 0.2
      break
    case 'figure8':
      parameters.p = 3
      parameters.q = 2
      parameters.radius = 0.65
      parameters.tube = 0.15
      break
    case 'cinquefoil':
      parameters.p = 2
      parameters.q = 5
      parameters.radius = 0.6
      parameters.tube = 0.1
      break
    case 'granny':
      parameters.p = 3
      parameters.q = 4
      parameters.radius = 0.5
      parameters.tube = 0.15
      break
    case 'custom':
      // 保持当前参数不变
      break
  }

  if (parameters.preset !== 'custom') {
    onChange()
    // 更新GUI显示
    if (gui && gui.controllers) {
      gui.controllers.forEach((controller: any) => {
        controller.updateDisplay()
      })
    }
  }
}

// 颜色方案切换
function onColorSchemeChange() {
  if (!torus) return

  const material = torus.material as any

  switch (parameters.colorScheme) {
    case 'environment':
      // 使用环境贴图颜色
      if (material.color) material.color = new THREE.Color(0xffffff)
      break
    case 'red':
      if (material.color) material.color = new THREE.Color(0xff0000)
      break
    case 'blue':
      if (material.color) material.color = new THREE.Color(0x0066ff)
      break
    case 'green':
      if (material.color) material.color = new THREE.Color(0x00ff00)
      break
    case 'gold':
      if (material.color) material.color = new THREE.Color(0xffd700)
      break
    case 'purple':
      if (material.color) material.color = new THREE.Color(0x9b59b6)
      break
  }
}


function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

function animate() {
  const time = performance.now() * 0.0002 * parameters.animationSpeed

  if (torus && torus.visible) {
    torus.rotation.x = time * 0.4
    torus.rotation.y = time
  }

  stats.update()
  renderer.render(scene, camera)
}

function cleanup() {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }

  // 断开 MutationObserver
  if (domObserver) {
    domObserver.disconnect()
    domObserver = null
  }

  // 清理 VR 按钮
  const vrButton = document.querySelector('.webxr-button')
  if (vrButton) {
    vrButton.remove()
  }

  // 清理 GUI
  const guiElement = document.querySelector('.lil-gui')
  if (guiElement) {
    guiElement.remove()
  }

  // 清理材质选择器
  if (materialSelectMesh && materialSelectMesh.material.map) {
    const img = materialSelectMesh.material.map.image as HTMLElement
    if (img && img.parentElement) {
      img.parentElement.remove()
    }
  }

  // 清理渲染器
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer.setAnimationLoop(null)
  }

  // 移除事件监听
  window.removeEventListener('resize', onWindowResize)
}

onMounted(() => {
  init()
})

onUnmounted(() => {
  cleanup()
})
</script>

<template>
  <div ref="container" class="vr-sandbox-container">

    <div ref="bodyRef" class="gui-container">
      <CustomButtons v-model="parameters.materialType" label="材质类型" :options="materials" />
      <CustomSelect v-model="parameters.materialType" label="材质类型" :options="materials" />
      <CustomCheckbox v-model="parameters.showModel" label="显示模型" />
      <CustomSlider v-model="parameters.animationSpeed" :min="0" :max="3" :step="0.1" />
    </div>
  </div>
</template>

<style scoped>
.vr-sandbox-container {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.gui-container {
  height: 30rem;
  background-color: rgba(30, 30, 30, 0.95);
  position: fixed;
  top: 50px;
  left: 0px;
  cursor: pointer;
  opacity: 0.9;
  z-index: 10000;
}
</style>
