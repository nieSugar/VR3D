<template>
  <div class="container">
    <!-- 3D 场景容器 -->
    <div ref="sceneContainer" class="scene-container"></div>
    
    <!-- DOM Overlay 层 -->
    <div ref="overlay" class="overlay-content" :class="{ 'vr-active': isVRActive }">
      <!-- 状态面板 -->
      <div class="status-panel">
        <h3>VR 状态</h3>
        <p>模式: {{ isVRActive ? 'VR 模式' : '桌面模式' }}</p>
        <p>立方体旋转: {{ cubeRotation.toFixed(2) }}°</p>
        <p>颜色: {{ currentColor }}</p>
        <div v-if="isVRActive" class="controller-info">
          <p>位置: {{ playerPosition }}</p>
          <p>方向: {{ playerRotation }}</p>
        </div>
      </div>

      <!-- 控制按钮 -->
      <div class="control-buttons">
        <button @click="toggleRotation" class="control-btn">
          {{ isRotating ? '停止旋转' : '开始旋转' }}
        </button>
        <button @click="changeColor('red')" class="control-btn color-red">红色</button>
        <button @click="changeColor('blue')" class="control-btn color-blue">蓝色</button>
        <button @click="changeColor('green')" class="control-btn color-green">绿色</button>
        <button @click="resetScene" class="control-btn">重置场景</button>
      </div>

      <!-- 信息面板 -->
      <div class="info-panel">
        <h3>DOM Overlay 示例</h3>
        <p>这是一个 WebXR DOM Overlay 的演示</p>
        <p>HTML 元素可以在 VR 中显示并交互</p>
        
        <div v-if="isVRActive" class="vr-controls">
          <h4>VR 控制器操作：</h4>
          <ul>
            <li>右摇杆：移动位置</li>
            <li>左摇杆：旋转视角</li>
            <li>扳机键：开始/停止旋转</li>
            <li>A/X 按钮：切换颜色</li>
            <li>B/Y 按钮：重置场景</li>
          </ul>
        </div>
        
        <div class="stats">
          <div>FPS: {{ fps }}</div>
          <div>时间: {{ elapsedTime.toFixed(1) }}s</div>
        </div>
      </div>

      <!-- 退出 VR 按钮（仅在 VR 模式显示） -->
      <button v-if="isVRActive" @click="exitVR" class="exit-vr-btn">
        退出 VR
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// 响应式状态
const sceneContainer = ref<HTMLDivElement>()
const overlay = ref<HTMLDivElement>()
const isVRActive = ref(false)
const isRotating = ref(false)
const cubeRotation = ref(0)
const currentColor = ref('青色')
const fps = ref(60)
const elapsedTime = ref(0)
const playerPosition = ref('(0, 0, 3)')
const playerRotation = ref('0°')

// Three.js 对象
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let cube: THREE.Mesh
let vrButton: HTMLElement
let animationId: number | undefined
let startTime = Date.now()
let frameCount = 0
let fpsUpdateTime = 0

// VR 控制器相关
let controllers: THREE.Group[] = []
let controllerGrips: THREE.Group[] = []
let dolly: THREE.Group // 用于移动的容器
let prevGamepadStates = new Map<number, any>()

// 颜色映射
const colorMap: { [key: string]: number } = {
  red: 0xff0000,
  blue: 0x0000ff,
  green: 0x00ff00,
  cyan: 0x00ffff
}

// 初始化场景
const initScene = () => {
  if (!sceneContainer.value) return

  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x202020)

  // 创建相机
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  )
  camera.position.set(0, 1.6, 3)
  
  // 创建 dolly（用于 VR 移动）
  dolly = new THREE.Group()
  dolly.position.set(0, 0, 3)
  dolly.add(camera)
  scene.add(dolly)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true
  })
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.xr.enabled = true
  sceneContainer.value.appendChild(renderer.domElement)

  // 创建轨道控制器（桌面模式）
  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 1, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.update()

  // 添加灯光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 5, 5)
  directionalLight.castShadow = true
  scene.add(directionalLight)

  // 创建立方体
  const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
  const material = new THREE.MeshStandardMaterial({
    color: 0x00ffff,
    metalness: 0.4,
    roughness: 0.3
  })
  cube = new THREE.Mesh(geometry, material)
  cube.position.set(0, 1.5, 0)
  scene.add(cube)

  // 创建地板
  const floorGeometry = new THREE.PlaneGeometry(10, 10)
  const floorMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x404040,
    roughness: 0.8
  })
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0
  floor.receiveShadow = true
  scene.add(floor)

  // 添加网格辅助线
  const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222)
  scene.add(gridHelper)

  // 添加一些装饰性的球体
  const sphereGeometry = new THREE.SphereGeometry(0.2, 32, 32)
  const sphereMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff6b6b,
    emissive: 0xff6b6b,
    emissiveIntensity: 0.2
  })
  
  for (let i = 0; i < 5; i++) {
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial.clone())
    const angle = (i / 5) * Math.PI * 2
    sphere.position.set(
      Math.cos(angle) * 2,
      0.5 + Math.sin(i) * 0.3,
      Math.sin(angle) * 2
    )
    scene.add(sphere)
  }
}

// 初始化 VR 控制器
const initControllers = () => {
  // 创建两个控制器（左右手）
  for (let i = 0; i < 2; i++) {
    // 控制器本身
    const controller = renderer.xr.getController(i)
    controller.addEventListener('connected', (event) => {
      const data = event.data
      console.log(`控制器 ${i} 已连接:`, data.handedness)
      
      // 添加射线指示器
      const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -1)
      ])
      const material = new THREE.LineBasicMaterial({
        color: i === 0 ? 0xff0000 : 0x0000ff,
        linewidth: 2
      })
      const line = new THREE.Line(geometry, material)
      line.scale.z = 5
      controller.add(line)
    })
    
    controller.addEventListener('disconnected', () => {
      console.log(`控制器 ${i} 已断开`)
      // 移除射线
      while (controller.children.length > 0) {
        const child = controller.children[0]
        if (child) {
          controller.remove(child)
        }
      }
    })
    
    // 添加选择事件（扳机键）
    controller.addEventListener('selectstart', () => {
      console.log(`控制器 ${i} 选择开始`)
      toggleRotation()
    })
    
    controllers.push(controller)
    if (dolly) {
      dolly.add(controller)
    }
    
    // 控制器模型握把
    const controllerGrip = renderer.xr.getControllerGrip(i)
    controllerGrips.push(controllerGrip)
    if (dolly) {
      dolly.add(controllerGrip)
    }
  }
}

// 设置 WebXR
const setupWebXR = async () => {
  if (!overlay.value) return

  // 初始化控制器
  initControllers()

  // 检查 DOM Overlay 支持
  if ('xr' in navigator) {
    try {
      // 检查是否支持 immersive-vr 和 dom-overlay
      const isSupported = await (navigator as any).xr.isSessionSupported('immersive-vr')
      
      if (isSupported) {
        // 创建 VR 按钮
        vrButton = document.createElement('button')
        vrButton.className = 'vr-button'
        vrButton.textContent = '进入 VR'
        vrButton.onclick = startXRSession
        document.body.appendChild(vrButton)
      } else {
        console.log('WebXR 不支持 immersive-vr')
        showNotSupported()
      }
    } catch (error) {
      console.error('WebXR 检测错误:', error)
      showNotSupported()
    }
  } else {
    console.log('WebXR 不可用')
    showNotSupported()
  }
}

// 显示不支持提示
const showNotSupported = () => {
  const notice = document.createElement('div')
  notice.className = 'vr-button not-supported'
  notice.textContent = 'WebXR 不支持'
  document.body.appendChild(notice)
}

// 启动 XR 会话
const startXRSession = async () => {
  if (!overlay.value) return

  try {
    // 请求 XR 会话，启用 DOM Overlay
    const sessionInit = {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: overlay.value }
    }

    const session = await (navigator as any).xr.requestSession('immersive-vr', sessionInit)
    
    // 设置会话
    renderer.xr.setSession(session)
    
    // 监听会话结束
    session.addEventListener('end', onXRSessionEnd)
    
    // 更新状态
    isVRActive.value = true
    vrButton.style.display = 'none'
    
    // 如果支持 DOM Overlay
    if (session.domOverlayState) {
      console.log('DOM Overlay 类型:', session.domOverlayState.type)
    }
    
    // 禁用桌面控制器
    controls.enabled = false
    
  } catch (error) {
    console.error('无法启动 XR 会话:', error)
  }
}

// XR 会话结束
const onXRSessionEnd = () => {
  isVRActive.value = false
  vrButton.style.display = 'block'
  controls.enabled = true
}

// 退出 VR
const exitVR = async () => {
  const session = renderer.xr.getSession()
  if (session) {
    await session.end()
  }
}

// 切换旋转
const toggleRotation = () => {
  isRotating.value = !isRotating.value
}

// 改变颜色
const changeColor = (color: string) => {
  if (cube) {
    const material = cube.material as THREE.MeshStandardMaterial
    const colorHex = colorMap[color]
    if (colorHex !== undefined) {
      material.color.setHex(colorHex)
      currentColor.value = color === 'red' ? '红色' : 
                          color === 'blue' ? '蓝色' : 
                          color === 'green' ? '绿色' : '青色'
    }
  }
}

// 重置场景
const resetScene = () => {
  isRotating.value = false
  cubeRotation.value = 0
  changeColor('cyan')
  currentColor.value = '青色'
  if (cube) {
    cube.rotation.set(0, 0, 0)
    cube.position.set(0, 1.5, 0)
  }
  // 重置 dolly 位置
  if (dolly) {
    dolly.position.set(0, 0, 3)
    dolly.rotation.set(0, 0, 0)
  }
}

// 处理控制器输入
const handleControllerInput = () => {
  const session = renderer.xr.getSession()
  if (!session) return
  
  // 遍历所有输入源
  for (let i = 0; i < session.inputSources.length; i++) {
    const inputSource = session.inputSources[i]
    if (!inputSource) continue
    
    const gamepad = inputSource.gamepad
    if (!gamepad) continue
    
    // 获取之前的状态
    const prevState = prevGamepadStates.get(i) || {}
    const currentState = {
      buttons: gamepad.buttons.map(b => ({
        pressed: b.pressed,
        touched: b.touched,
        value: b.value
      })),
      axes: [...gamepad.axes]
    }
    
    // 检测按钮事件
    currentState.buttons.forEach((button, index) => {
      const prevButton = prevState.buttons?.[index]
      
      // A/X 按钮（索引 4）- 改变颜色
      if (index === 4 && button.pressed && !prevButton?.pressed) {
        const colors: string[] = ['red', 'blue', 'green', 'cyan']
        const currentColorKey = currentColor.value === '红色' ? 'red' :
                               currentColor.value === '蓝色' ? 'blue' :
                               currentColor.value === '绿色' ? 'green' : 'cyan'
        const currentIndex = colors.indexOf(currentColorKey)
        const nextIndex = (currentIndex + 1) % colors.length
        const nextColor = colors[nextIndex] ?? 'cyan'
        changeColor(nextColor)
      }
      
      // B/Y 按钮（索引 5）- 重置场景
      if (index === 5 && button.pressed && !prevButton?.pressed) {
        resetScene()
      }
    })
    
    // 处理摇杆移动（通常 axes[2] 和 axes[3] 是右摇杆）
    if (gamepad.axes.length >= 4) {
      const deadzone = 0.15
      const axisX = gamepad.axes[2] ?? 0
      const axisZ = gamepad.axes[3] ?? 0
      const moveX = Math.abs(axisX) > deadzone ? axisX : 0
      const moveZ = Math.abs(axisZ) > deadzone ? axisZ : 0
      
      if (moveX !== 0 || moveZ !== 0) {
        // 移动速度
        const speed = 0.05
        
        // 获取相机的前向方向（不包括 Y 轴）
        const cameraDirection = new THREE.Vector3()
        camera.getWorldDirection(cameraDirection)
        cameraDirection.y = 0
        cameraDirection.normalize()
        
        // 计算右向方向
        const rightDirection = new THREE.Vector3()
        rightDirection.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0))
        
        // 应用移动
        dolly.position.addScaledVector(rightDirection, moveX * speed)
        dolly.position.addScaledVector(cameraDirection, -moveZ * speed)
        
        // 更新位置显示
        playerPosition.value = `(${dolly.position.x.toFixed(1)}, ${dolly.position.y.toFixed(1)}, ${dolly.position.z.toFixed(1)})`
      }
    }
    
    // 处理左摇杆旋转（可选 - axes[0] 和 axes[1] 是左摇杆）
    if (gamepad.axes.length >= 2) {
      const deadzone = 0.15
      const axisRotate = gamepad.axes[0] ?? 0
      const rotateX = Math.abs(axisRotate) > deadzone ? axisRotate : 0
      
      if (rotateX !== 0) {
        // 旋转速度
        const rotateSpeed = 0.02
        dolly.rotation.y -= rotateX * rotateSpeed
        
        // 更新旋转显示
        const degrees = THREE.MathUtils.radToDeg(dolly.rotation.y)
        playerRotation.value = `${degrees.toFixed(0)}°`
      }
    }
    
    // 保存当前状态
    prevGamepadStates.set(i, currentState)
  }
}

// 动画循环
const animate = () => {
  animationId = requestAnimationFrame(animate)
  
  const currentTime = performance.now()
  
  // 更新 FPS
  frameCount++
  if (currentTime - fpsUpdateTime >= 1000) {
    fps.value = Math.round(frameCount * 1000 / (currentTime - fpsUpdateTime))
    frameCount = 0
    fpsUpdateTime = currentTime
  }
  
  // 更新经过时间
  elapsedTime.value = (Date.now() - startTime) / 1000
  
  // 旋转立方体
  if (isRotating.value && cube) {
    cube.rotation.x += 0.01
    cube.rotation.y += 0.01
    cubeRotation.value = (cubeRotation.value + 1) % 360
  }
  
  // VR 模式下处理控制器输入
  if (isVRActive.value) {
    handleControllerInput()
  }
  
  // 更新控制器
  if (controls.enabled) {
    controls.update()
  }
  
  // 渲染场景
  renderer.render(scene, camera)
}

// 处理窗口大小变化
const handleResize = () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

// 生命周期
onMounted(async () => {
  initScene()
  await setupWebXR()
  
  // 设置渲染循环
  renderer.setAnimationLoop(animate)
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  // 清理资源
  window.removeEventListener('resize', handleResize)
  
  if (animationId !== undefined) {
    cancelAnimationFrame(animationId)
  }
  
  renderer.setAnimationLoop(null)
  renderer.dispose()
  controls.dispose()
  
  // 移除 VR 按钮
  if (vrButton && vrButton.parentNode) {
    vrButton.parentNode.removeChild(vrButton)
  }
  
  // 清理场景
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      if (child.material instanceof THREE.Material) {
        child.material.dispose()
      }
    }
  })
})
</script>

<style scoped>
.container {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.scene-container {
  width: 100%;
  height: 100%;
}

/* DOM Overlay 层样式 */
.overlay-content {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 100;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
  box-sizing: border-box;
}

.overlay-content > * {
  pointer-events: auto;
}

/* VR 模式下的特殊样式 */
.overlay-content.vr-active {
  background: transparent;
}

/* 状态面板 */
.status-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px 20px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
  min-width: 200px;
}

.status-panel h3 {
  margin: 0 0 10px 0;
  color: #00ffff;
  font-size: 18px;
}

.status-panel p {
  margin: 5px 0;
  font-size: 14px;
  color: #ffffff;
}

/* 控制按钮 */
.control-buttons {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 10px;
  padding: 15px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 15px;
  backdrop-filter: blur(10px);
}

.control-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s ease;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.control-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
}

.control-btn:active {
  transform: translateY(0);
}

.control-btn.color-red {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.control-btn.color-blue {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.control-btn.color-green {
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

/* 信息面板 */
.info-panel {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px 20px;
  border-radius: 10px;
  backdrop-filter: blur(10px);
  max-width: 300px;
}

.info-panel h3 {
  margin: 0 0 10px 0;
  color: #00ffff;
  font-size: 18px;
}

.info-panel p {
  margin: 5px 0;
  font-size: 14px;
  line-height: 1.5;
}

.stats {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  display: flex;
  gap: 20px;
  font-size: 12px;
  color: #00ffff;
}

/* 控制器信息 */
.controller-info {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.controller-info p {
  margin: 3px 0;
  font-size: 13px;
  color: #4facfe;
  font-family: monospace;
}

/* VR 控制说明 */
.vr-controls {
  margin-top: 15px;
  padding: 10px;
  background: rgba(79, 172, 254, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(79, 172, 254, 0.3);
}

.vr-controls h4 {
  margin: 0 0 8px 0;
  color: #4facfe;
  font-size: 14px;
}

.vr-controls ul {
  margin: 0;
  padding-left: 20px;
  list-style-type: none;
}

.vr-controls li {
  margin: 4px 0;
  font-size: 12px;
  color: #ffffff;
  position: relative;
}

.vr-controls li::before {
  content: '▸';
  position: absolute;
  left: -15px;
  color: #4facfe;
}

/* 退出 VR 按钮 */
.exit-vr-btn {
  position: absolute;
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
  padding: 15px 30px;
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: white;
  border: none;
  border-radius: 25px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(250, 112, 154, 0.4);
  transition: all 0.3s ease;
}

.exit-vr-btn:hover {
  transform: translateY(-50%) scale(1.05);
  box-shadow: 0 6px 20px rgba(250, 112, 154, 0.6);
}

/* VR 按钮（由 JS 创建） */
:global(.vr-button) {
  position: fixed;
  bottom: 20px;
  right: 20px;
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 25px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  z-index: 999;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  transition: all 0.3s ease;
}

:global(.vr-button:hover) {
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
}

:global(.vr-button.not-supported) {
  background: linear-gradient(135deg, #868686 0%, #4a4a4a 100%);
  cursor: not-allowed;
  opacity: 0.7;
}
</style>
