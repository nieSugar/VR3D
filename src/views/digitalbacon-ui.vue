<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
// @ts-ignore
import * as DigitalBaconUI from 'digitalbacon-ui'
import * as THREE from 'three'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import Stats from 'three/examples/jsm/libs/stats.module.js'

// Refs
const container = ref<HTMLDivElement | null>(null)

// Three.js 实例
let scene: THREE.Scene
let ambientLight: THREE.AmbientLight
let pointLight: THREE.PointLight
let renderer: THREE.WebGLRenderer
let camera: THREE.PerspectiveCamera
let clock: THREE.Clock
let stats: any
let sceneBackground: THREE.CubeTexture | null = null

// DigitalBacon-UI 元素
let body: any

async function init() {
  if (!container.value) return

  // Three.js 场景设置
  scene = new THREE.Scene()
  ambientLight = new THREE.AmbientLight(0x404040, 1)
  pointLight = new THREE.PointLight(0xffffff, 100)
  pointLight.position.set(2.5, 5, 5)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  camera = new THREE.PerspectiveCamera(
    90,
    container.value.clientWidth / container.value.clientHeight,
    0.1,
    1000
  )
  clock = new THREE.Clock()

  // Stats 设置
  stats = new Stats()
  stats.showPanel(0)
  stats.dom.style.top = ''
  stats.dom.style.left = ''
  stats.dom.style.position = 'absolute'
  container.value.insertBefore(stats.dom, container.value.firstChild)

  renderer.setSize(container.value.clientWidth, container.value.clientHeight)
  container.value.appendChild(renderer.domElement)

  scene.add(camera)
  scene.add(ambientLight)
  scene.add(pointLight)
  camera.position.y = 1.7

  sceneBackground = new THREE.CubeTextureLoader()
    .setPath('/assets/images/skyboxes/blue_sky/')
    .load(['skybox_right.jpg', 'skybox_left.jpg', 'skybox_up.jpg',
      'skybox_down.jpg', 'skybox_front.jpg', 'skybox_back.jpg']);
  scene.background = sceneBackground;


  // 设置 XR 支持
  renderer.xr.enabled = true
  
  const vrButton = VRButton.createButton(renderer)
  document.body.appendChild(vrButton)
  vrButton.addEventListener('click', () => {
    if (sceneBackground) scene.background = sceneBackground
  })
  
  // XR 会话开始时初始化控制器
  renderer.xr.addEventListener('sessionstart', () => {
    console.log('XR Session Started')
    // 启用 XR 控制器管理
    DigitalBaconUI.InputHandler.enableXRControllerManagement(scene)
    
    // 手动添加控制器到场景（如果需要）
    const controller1 = renderer.xr.getController(0)
    const controller2 = renderer.xr.getController(1)
    scene.add(controller1)
    scene.add(controller2)
    
    // 添加控制器连接事件监听
    controller1.addEventListener('connected', (event: any) => {
      console.log('Controller 1 connected:', event.data)
    })
    
    controller2.addEventListener('connected', (event: any) => {
      console.log('Controller 2 connected:', event.data)
    })
  })
  
  // XR 会话结束时清理
  renderer.xr.addEventListener('sessionend', () => {
    console.log('XR Session Ended')
  })

  // DigitalBacon-UI 初始化
  await DigitalBaconUI.init(container.value, renderer, scene, camera)

  // 创建 UI 界面
  body = new DigitalBaconUI.Body({
    borderRadius: 0.05,
    borderWidth: 0.001,
    glassmorphism: true,
    justifyContent: 'start',
    materialColor: '#dddddd',
    width: 1.5,
  })

  const row1 = new DigitalBaconUI.Span({
    borderTopLeftRadius: 0.05,
    borderTopRightRadius: 0.05,
    padding: 0.1,
    height: 0.4,
    width: '100%',
  })

  const row2 = new DigitalBaconUI.Div({
    height: '25%',
    width: '100%',
    justifyContent: 'center',
  })

  const text = new DigitalBaconUI.Text('Select components allow you to create\ndrop-down lists', {
    fontSize: 0.07,
    color: '#ffffff',
  })

  const select = new DigitalBaconUI.Select()
  select.maxDisplayOptions = 5.5
  select.addOptions('black', 'blue', 'green', 'orange', 'purple', 'red', 'white', 'yellow')
  select.onChange = (value: string) => text._text.color = value

  body.position.set(0, 1.7, -1)
  scene.add(body)
  body.add(row1)
  body.add(row2)
  row1.add(text)
  row2.add(select)

  // 启动渲染循环
  renderer.setAnimationLoop((_time: number, frame: XRFrame | null) => {
    stats.begin()
    
    // 确保传递 XR 帧给 DigitalBaconUI
    if (frame) {
      // 在 XR 模式下
      DigitalBaconUI.update(frame)
    } else {
      // 非 XR 模式下
      DigitalBaconUI.update()
    }
    
    renderer.render(scene, camera)
    stats.end()
  })

  // 处理窗口大小变化
  handleResize()
  window.addEventListener('resize', handleResize)
}

function handleResize() {
  if (!container.value) return

  camera.aspect = container.value.clientWidth / container.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(container.value.clientWidth, container.value.clientHeight)

  // 移动端响应式调整
  if (camera.aspect < 0.8) {
    camera.position.z = (0.8 - camera.aspect) * 3
  } else {
    camera.position.z = 0
  }
}

function cleanup() {
  // 停止动画循环
  if (renderer) {
    renderer.setAnimationLoop(null)
  }

  // 移除事件监听器
  window.removeEventListener('resize', handleResize)

  // 移除 Stats
  if (stats && stats.dom && container.value) {
    container.value.removeChild(stats.dom)
  }

  // 清理 Three.js 资源
  if (renderer) {
    renderer.dispose()
    if (container.value && renderer.domElement) {
      container.value.removeChild(renderer.domElement)
    }
  }

  // 清理 DigitalBacon-UI
  if (body) {
    scene.remove(body)
  }

  // 清理场景
  if (scene) {
    scene.clear()
  }
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
  </div>
</template>

<style scoped>
.vr-sandbox-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
</style>
