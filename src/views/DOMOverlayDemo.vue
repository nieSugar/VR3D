<template>
  <div ref="containerRef" class="vr-container"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { Container, reversePainterSortStable } from '@pmndrs/uikit'
import { signal } from '@preact/signals-core'
import { TextMesh } from '../utils/TextMesh'

const containerRef = ref<HTMLDivElement | null>(null)

let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let cube: THREE.Mesh

onMounted(() => {
  if (!containerRef.value) return

  // 初始化场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)

  // 初始化相机
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.set(0, 1.6, 3)

  // 初始化渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.xr.enabled = true
  containerRef.value.appendChild(renderer.domElement)

  // 添加 VR 按钮
  const vrButton = VRButton.createButton(renderer)
  document.body.appendChild(vrButton)

  // 初始化控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true

  // 添加光源
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 10, 5)
  scene.add(directionalLight)

  // 创建正方体
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshStandardMaterial({
    color: 0x00d4ff,
    roughness: 0.4,
    metalness: 0.6
  })
  cube = new THREE.Mesh(geometry, material)
  cube.position.set(2, 1.6, -2)
  scene.add(cube)

  // 添加地面
  const groundGeometry = new THREE.PlaneGeometry(10, 10)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x16213e,
    roughness: 0.8
  })
  const ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  scene.add(ground)

  // 启用透明排序
  renderer.localClippingEnabled = true
  renderer.setTransparentSort(reversePainterSortStable)

  // 创建 UI 面板背景（使用 @pmndrs/uikit Container）
  const panel = new Container({
    padding: 32,
    gap: 16,
    borderRadius: 16,
    backgroundColor: '#0f3460',
    opacity: 0.95,
    width: 600,
    height: 400,
    positionType: 'relative'
  })
  
  panel.position.set(0, 1.6, -1.5)
  scene.add(panel)
  
  // 创建文本（使用自定义字体）
  const title = new TextMesh('欢迎来到 VR 世界', 80, { 
    color: '#00d4ff' 
  })
  title.position.set(0, 1.72, -1.49)
  scene.add(title)
  
  const description = new TextMesh('这是一个使用 @pmndrs/uikit 创建的三维界面', 40, { 
    color: '#e94560',
    maxWidth: 500
  })
  description.position.set(0, 1.64, -1.49)
  scene.add(description)
  
  const info = new TextMesh('正方体位置: (2, 1.6, -2)', 35, { 
    color: '#ffffff' 
  })
  info.position.set(0, 1.57, -1.49)
  scene.add(info)
  
  // 按钮背景
  const buttonBg = new Container({
    padding: 16,
    paddingX: 32,
    borderRadius: 8,
    backgroundColor: '#e94560',
    cursor: 'pointer',
    width: 220,
    height: 60,
    hover: { backgroundColor: '#ff6b9d' }
  })
  buttonBg.position.set(0, 1.48, -1.49)
  scene.add(buttonBg)
  
  // 按钮文字
  const isRotating = signal(false)
  const buttonText = new TextMesh('点击旋转正方体', 35, { 
    color: '#ffffff' 
  })
  buttonText.position.set(0, 1.48, -1.48)
  scene.add(buttonText)
  
  // 按钮交互
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  
  const onMouseClick = (event: MouseEvent) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
    
    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObject(buttonBg, true)
    
    if (intersects.length > 0) {
      isRotating.value = !isRotating.value
      buttonText.text = isRotating.value ? '停止旋转' : '点击旋转正方体'
    }
  }
  
  window.addEventListener('click', onMouseClick)

  // 动画循环
  let lastTime = performance.now()
  renderer.setAnimationLoop((time: number) => {
    const delta = time - lastTime
    lastTime = time
    
    controls.update()
    
    // 更新 UI
    panel.update(delta)
    buttonBg.update(delta)
    
    // 旋转正方体
    if (isRotating.value) {
      cube.rotation.x += 0.01
      cube.rotation.y += 0.01
    }
    
    renderer.render(scene, camera)
  })

  // 处理窗口大小变化
  const handleResize = () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  }
  window.addEventListener('resize', handleResize)

  // 清理函数
  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
    window.removeEventListener('click', onMouseClick)
    renderer.setAnimationLoop(null)
    controls.dispose()
    renderer.dispose()
    
    // 清理文本
    title.dispose()
    description.dispose()
    info.dispose()
    buttonText.dispose()
    
    if (containerRef.value) {
      containerRef.value.removeChild(renderer.domElement)
    }
    document.body.removeChild(vrButton)
  })
})
</script>

<style scoped>
.vr-container {
  width: 100vw;
  height: 100vh;
  position: fixed;
  top: 0;
  left: 0;
  overflow: hidden;
}
</style>

