<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import * as THREE from 'three'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { VRDebugPanel } from '../utils/VRDebugPanel'
import { DebugGUI } from '../utils/DebugGUI'
import { VRDebugGUI } from '../utils/VRDebugGUI'

const container = ref<HTMLDivElement | null>(null);
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let vrPlayerRig: THREE.Group;
let ground: THREE.Mesh;

let debugGUI: DebugGUI;
let vrDebugGUI: VRDebugGUI;
let debugPanel: VRDebugPanel;


// 动画时钟（用于物体动画）
const clock = new THREE.Clock()

function initSceneAndLightAndGround() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)
  scene.fog = new THREE.Fog(0x1a1a2e, 5, 20)

  // 添加环境光和方向光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 10, 5)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  scene.add(directionalLight)


  // 添加地面
  const groundGeometry = new THREE.PlaneGeometry(20, 20)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x2d2d44,
    roughness: 0.8,
    metalness: 0.2
  })
  ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
}

function initCamera() {
  if (!container?.value) return
  const aspect = container.value.clientWidth / container.value.clientHeight
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
  camera.position.set(0, 1.6, 3)
  scene.add(camera)
}

function initRenderer() {
  if (!container?.value) return
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.value.appendChild(renderer.domElement);
  // 启用 VR
  renderer.xr.enabled = true;
  const vrButton = VRButton.createButton(renderer)
  container.value.appendChild(vrButton)

  // 创建两个控制器
  vrControllers.push(createVRController(0))
  vrControllers.push(createVRController(1))
}

function initControls() {
  if (!camera || !renderer) return
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 1;
  controls.maxDistance = 100;
  controls.maxPolarAngle = Math.PI / 1.5;
  controls.target.set(0, 1.6, 0);
}

function initVRPlayerRig() {
  vrPlayerRig = new THREE.Group()
  vrPlayerRig.name = 'VRPlayerRig'
  vrPlayerRig.position.set(0, 0, 0)
  scene.add(vrPlayerRig)
}

function initDebugGUI() {

  // 创建调试面板
  debugPanel = new VRDebugPanel(scene)
  debugPanel.log('模型场景已启动')
  debugPanel.log('桌面模式: 鼠标旋转视角 / WASD移动 / 空格跳跃 / 左键选择 / 右键抓取')
  debugPanel.log('VR 模式: 扳机选择 / 侧键抓取 / 摇杆移动 / A键跳跃')

  // 创建调试GUI（桌面模式）
  debugGUI = new DebugGUI(debugPanel, camera)
  debugPanel.log('GUI调试面板已启动 (按 H 键切换显示)')

  // 创建VR 3D GUI（VR模式）
  vrDebugGUI = new VRDebugGUI(scene, debugPanel, camera)
  debugPanel.log('VR 3D GUI已就绪 (按 G 键切换显示)')

  // 将VR GUI添加到调试面板中进行控制
  debugGUI.setVRDebugGUI(vrDebugGUI)
}

const interactableObjects: THREE.Object3D[] = []

function initObject() {
  // 添加立方体
  const cubeGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
  const cubeMaterial = new THREE.MeshStandardMaterial({
    color: 0xff6b6b,
    roughness: 0.5,
    metalness: 0.3
  })
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial)
  cube.position.set(-2, 0.25, -3)
  cube.castShadow = true
  cube.name = 'Cube'
  scene.add(cube)
  interactableObjects.push(cube)

  // 添加球体
  const sphereGeometry = new THREE.SphereGeometry(0.3, 32, 32)
  const sphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x4ecdc4,
    roughness: 0.3,
    metalness: 0.7
  })
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
  sphere.position.set(0, 0.3, -3)
  sphere.castShadow = true
  sphere.name = 'Sphere'
  scene.add(sphere)
  interactableObjects.push(sphere)

  // 添加圆环
  const torusGeometry = new THREE.TorusGeometry(0.3, 0.1, 16, 100)
  const torusMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe66d,
    roughness: 0.4,
    metalness: 0.6
  })
  const torus = new THREE.Mesh(torusGeometry, torusMaterial)
  torus.position.set(2, 0.3, -3)
  torus.castShadow = true
  torus.name = 'Torus'
  scene.add(torus)
  interactableObjects.push(torus)

  // 添加圆锥
  const coneGeometry = new THREE.ConeGeometry(0.25, 0.6, 32)
  const coneMaterial = new THREE.MeshStandardMaterial({
    color: 0xa8e6cf,
    roughness: 0.5,
    metalness: 0.4
  })
  const cone = new THREE.Mesh(coneGeometry, coneMaterial)
  cone.position.set(-1, 0.3, -2)
  cone.castShadow = true
  cone.name = 'Cone'
  scene.add(cone)
  interactableObjects.push(cone)

  // 添加圆柱
  const cylinderGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 32)
  const cylinderMaterial = new THREE.MeshStandardMaterial({
    color: 0xdda15e,
    roughness: 0.6,
    metalness: 0.3
  })
  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
  cylinder.position.set(1, 0.3, -2)
  cylinder.castShadow = true
  cylinder.name = 'Cylinder'
  scene.add(cylinder)
  interactableObjects.push(cylinder)
}

let highlightedObject: THREE.Object3D | null = null;

const originalMaterials = new Map<THREE.Object3D, THREE.Material>();

function highlightObject(obj: THREE.Object3D | null) {
  // 恢复之前高亮的对象
  if (highlightedObject && originalMaterials.has(highlightedObject)) {
    const mesh = highlightedObject as THREE.Mesh
    const originalMat = originalMaterials.get(highlightedObject)!
    mesh.material = originalMat
  }

  highlightedObject = obj

  // 高亮新对象
  if (obj) {
    const mesh = obj as THREE.Mesh
    if (!originalMaterials.has(obj) && mesh.material) {
      if (Array.isArray(mesh.material)) {
        if (mesh.material[0]) {
          originalMaterials.set(obj, mesh.material[0])
        }
      } else {
        originalMaterials.set(obj, mesh.material)
      }
    }
    mesh.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffff00,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.7
    })
  }
}

function handleResize() {
  if (!container.value) return
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}




let grabbedObject: THREE.Object3D | null = null
let grabHand: 'vr-left' | 'vr-right' | 'desktop' | null = null

// 跳跃相关状态
let verticalVelocity = 0
const gravity = -0.008
const jumpStrength = 0.15
const groundLevel = 1.6 // VR 眼睛高度

const gameLogic = {
  // 选择开始
  handleSelectStart: (position: THREE.Vector3, direction: THREE.Vector3, hand: string) => {
    debugPanel.log(`[${hand}] 选择开始`)
    // 射线检测
    const raycaster = new THREE.Raycaster(position, direction)
    const intersections = raycaster.intersectObjects(interactableObjects, true)
    if (intersections.length > 0 && intersections[0]?.object) {
      const hitObject = intersections[0].object
      debugPanel.log(`命中: ${hitObject.name || hitObject.type}`)
      highlightObject(hitObject)
    }
  },

  // 选择结束
  handleSelectEnd: (hand: string) => {
    debugPanel.log(`[${hand}] 选择结束`)
    highlightObject(null)
  },

  // 抓取开始
  handleGrabStart: (position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right', controller?: THREE.Group) => {
    debugPanel.log(`[${hand}] 抓取开始`)

    const raycaster = new THREE.Raycaster(position, direction)
    const intersections = raycaster.intersectObjects(interactableObjects, true)

    if (intersections.length > 0 && intersections[0]?.object) {
      grabbedObject = intersections[0].object
      grabHand = controller ? `vr-${hand}` : 'desktop'

      debugPanel.log(`已抓取: ${grabbedObject.name || grabbedObject.type}`)

      // VR 模式：附加到控制器
      if (controller) {
        controller.attach(grabbedObject)
      }
    }
  },

  // 抓取结束
  handleGrabEnd: (hand: string, controller?: THREE.Group) => {
    debugPanel.log(`[${hand}] 抓取结束`)

    if (grabbedObject) {
      // VR 模式：从控制器分离
      if (controller) {
        const attachedObject = controller.children.find(
          (child) => child.type === 'Mesh' && child.name !== 'line'
        )
        if (attachedObject) {
          scene.attach(attachedObject as THREE.Object3D)
        }
      }

      debugPanel.log('已释放物体')
      grabbedObject = null
      grabHand = null
    }
  },

  // 移动（桌面：移动相机；VR：移动玩家容器）
  handleMove: (delta: THREE.Vector2) => {
    const speed = 0.05

    // 计算前进方向（基于相机朝向，忽略 Y 轴）
    const direction = new THREE.Vector3(0, 0, -1)
    direction.applyQuaternion(camera.quaternion)
    direction.y = 0
    direction.normalize()

    // 计算侧向（前进方向的垂直向量）
    const strafe = new THREE.Vector3(-direction.z, 0, direction.x)

    // VR 模式下相机在 rig 中，移动 rig；桌面模式移动相机
    const target = camera.parent || camera
    target.position.addScaledVector(direction, -delta.y * speed) // 前后
    target.position.addScaledVector(strafe, delta.x * speed)    // 左右
  },

  // 跳跃
  handleJump: () => {
    const target = camera.parent || camera
    // 只有在地面上才能跳
    if (target.position.y <= groundLevel) {
      verticalVelocity = jumpStrength
      debugPanel.log('跳跃!')
    }
  },
}

//#region vr 操作

const controllerModelFactory = new XRControllerModelFactory()
const vrControllers: Array<{
  controller: THREE.Group
  controllerGrip: THREE.Group
  line: THREE.Line
}> = []

function createVRController(index: number) {
  const controller = renderer.xr.getController(index)

  // 创建控制器射线
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ])
  const material = new THREE.LineBasicMaterial({ color: 0x00ffff })
  const line = new THREE.Line(geometry, material)
  line.name = 'line'
  line.scale.z = 5
  controller.add(line)
  scene.add(controller)

  // 控制器模型
  const controllerGrip = renderer.xr.getControllerGrip(index)
  const model = controllerModelFactory.createControllerModel(controllerGrip)
  controllerGrip.add(model)
  scene.add(controllerGrip)

  // 绑定控制器事件
  controller.addEventListener('selectstart', () => {
    handleVRSelectStart(controller, index)
  })
  controller.addEventListener('selectend', () => {
    handleVRSelectEnd(controller, index)
  })
  controller.addEventListener('squeezestart', () => {
    handleVRSqueezeStart(controller, index)
  })
  controller.addEventListener('squeezeend', () => {
    handleVRSqueezeEnd(controller, index)
  })

  return { controller, controllerGrip, line }
}


// 获取控制器游戏手柄状态
function getGamepadState(index: number) {
  const session = renderer.xr.getSession()
  if (!session) return null
  const inputSource = session.inputSources[index]
  if (!inputSource?.gamepad) return null
  const gamepad = inputSource.gamepad
  return {
    buttons: gamepad.buttons.map(button => ({
      pressed: button.pressed,
      touched: button.touched,
      value: button.value,
    })),
    axes: gamepad.axes,
    trigger: gamepad.buttons[0]?.value || 0,
    squeeze: gamepad.buttons[1]?.value || 0,
    thumbstickX: gamepad.axes[2] || 0,
    thumbstickY: gamepad.axes[3] || 0,
    touchpadX: gamepad.axes[0] || 0,
    touchpadY: gamepad.axes[1] || 0,
  }
}

// 将控制器移动到新父对象
function moveControllersToParent(parent: THREE.Object3D) {
  vrControllers.forEach(({ controller, controllerGrip }) => {
    if (controller.parent) controller.parent.remove(controller)
    if (controllerGrip.parent) controllerGrip.parent.remove(controllerGrip)
    parent.add(controller)
    parent.add(controllerGrip)
  })
}

// VR 控制器事件处理函数
function handleVRSelectStart(controller: THREE.Group, index: number) {
  // 先尝试与VR GUI交互
  vrDebugGUI.handleControllerSelect(controller)

  // 如果没有交互到GUI，继续游戏逻辑
  const hand = index === 0 ? 'left' : 'right'
  const pos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld)
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.quaternion)
  gameLogic.handleSelectStart(pos, dir, `vr-${hand}`)
}

function handleVRSelectEnd(_controller: THREE.Group, index: number) {
  // 释放VR GUI拖拽
  vrDebugGUI.handleControllerRelease()

  const hand = index === 0 ? 'left' : 'right'
  gameLogic.handleSelectEnd(`vr-${hand}`)
}

function handleVRSqueezeStart(controller: THREE.Group, index: number) {
  const hand = index === 0 ? 'left' : 'right'
  const pos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld)
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.quaternion)
  gameLogic.handleGrabStart(pos, dir, hand, controller)
}

function handleVRSqueezeEnd(controller: THREE.Group, index: number) {
  const hand = index === 0 ? 'left' : 'right'
  gameLogic.handleGrabEnd(hand, controller)
}
//#endregion


//#region 键盘操作

// ========== 输入控制器设置 ==========

const isVRMode = ref(false)
const inputState = {
  cursorPosition: new THREE.Vector3(),
  cursorDirection: new THREE.Vector3(),
  moveInput: new THREE.Vector2(),
}

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
const keysPressed = new Set<string>()

// 鼠标移动
function onMouseMove(event: MouseEvent) {
  if (isVRMode.value) return
  const rect = renderer.domElement.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(mouse, camera)
  inputState.cursorPosition.copy(raycaster.ray.origin)
  inputState.cursorDirection.copy(raycaster.ray.direction)
}

// ========== 桌面输入事件处理 ==========

let isMouseSelecting = false
let isMouseGrabbing = false

function onMouseDown(event: MouseEvent) {
  if (isVRMode.value) return
  if (event.button === 0) { // 左键 = Select
    isMouseSelecting = true
    gameLogic.handleSelectStart(
      inputState.cursorPosition.clone(),
      inputState.cursorDirection.clone(),
      'desktop'
    )
  } else if (event.button === 2) { // 右键 = Grab
    isMouseGrabbing = true
    gameLogic.handleGrabStart(
      inputState.cursorPosition.clone(),
      inputState.cursorDirection.clone(),
      'right'
    )
  }
}

function onMouseUp(event: MouseEvent) {
  if (isVRMode.value) return
  if (event.button === 0) {
    isMouseSelecting = false
    gameLogic.handleSelectEnd('desktop')
  } else if (event.button === 2) {
    isMouseGrabbing = false
    gameLogic.handleGrabEnd('desktop')
  }
}

function onKeyDown(event: KeyboardEvent) {
  if (isVRMode.value) return
  const key = event.key.toLowerCase()
  if (key === ' ' && !keysPressed.has(' ')) {
    gameLogic.handleJump()
  }
  keysPressed.add(key)
}

function onKeyUp(event: KeyboardEvent) {
  if (isVRMode.value) return
  keysPressed.delete(event.key.toLowerCase())
}

function onContextMenu(event: Event) {
  event.preventDefault()
}

// 更新桌面移动输入
function updateDesktopInput() {
  if (isVRMode.value) return
  const moveX = (keysPressed.has('d') ? 1 : 0) + (keysPressed.has('a') ? -1 : 0)
  const moveY = (keysPressed.has('w') ? 1 : 0) + (keysPressed.has('s') ? -1 : 0)
  if (moveX !== 0 || moveY !== 0) {
    inputState.moveInput.set(moveX, moveY)
    gameLogic.handleMove(inputState.moveInput)
  }
}
window.addEventListener('keydown', onKeyDown)
window.addEventListener('keyup', onKeyUp)

// 添加键盘快捷键切换GUI
function handleKeyPress(e: KeyboardEvent) {
  if (e.key === 'h' || e.key === 'H') {
    debugGUI.toggle()
  } else if (e.key === 'g' || e.key === 'G') {
    vrDebugGUI.toggle()
  }
}
//#endregion


// 按键状态跟踪
const prevButtonStates: Map<string, boolean[]> = new Map()

// 按键名称映射（Quest 手柄）
const buttonNames = {
  0: 'Trigger',      // 0: 扳机
  1: 'Squeeze',      // 1: 侧键
  3: 'Thumbstick',   // 3: 摇杆按下
  4: 'X/A',          // 4: X键(左手) 或 A键(右手)
  5: 'Y/B',          // 5: Y键(左手) 或 B键(右手)
  12: 'Menu',        // 12: 菜单键
}

function animationLoop() {
  const deltaTime = clock.getDelta()
  const elapsedTime = clock.getElapsedTime()

  // 更新 OrbitControls
  if (controls.enabled) {
    controls.update()
  }

  // 应用重力和垂直速度
  const target = camera.parent || camera
  verticalVelocity += gravity
  target.position.y += verticalVelocity

  // 地面碰撞检测
  if (target.position.y < groundLevel) {
    target.position.y = groundLevel
    verticalVelocity = 0
  }

  // 桌面模式：处理键盘输入
  if (!isVRMode.value) {
    updateDesktopInput()

    // 桌面模式：移动抓取的物体
    if (grabbedObject && grabHand === 'desktop') {
      const pos = inputState.cursorPosition
      const dir = inputState.cursorDirection.clone()
      // 将物体放在射线前方固定距离
      grabbedObject.position.copy(pos).add(dir.multiplyScalar(2))
    }
  }
  // VR 模式：处理摇杆输入和GUI交互
  else {
    // 监听左右手柄按键
    ;[0, 1].forEach(index => {
      const hand = index === 0 ? 'Left' : 'Right'
      const gamepad = getGamepadState(index)

      if (gamepad) {
        const prevState = prevButtonStates.get(hand) || []

        // 检测每个按键变化
        gamepad.buttons.forEach((button, btnIndex) => {
          const wasPressed = prevState[btnIndex] || false
          const isPressed = button.pressed

          // 按下事件
          if (isPressed && !wasPressed) {
            const btnName = buttonNames[btnIndex as keyof typeof buttonNames] || `Button${btnIndex}`
            debugPanel.log(`[${hand}] ${btnName} 按下 ${btnIndex}`)

            // A键跳跃（右手按钮4）
            if (hand === 'Right' && btnIndex === 4) {
              gameLogic.handleJump()
            }
          }
          // 释放事件
          else if (!isPressed && wasPressed) {
            const btnName = buttonNames[btnIndex as keyof typeof buttonNames] || `Button${btnIndex}`
            debugPanel.log(`[${hand}] ${btnName} 释放 ${btnIndex}`)
          }
        })

        // 保存当前状态
        prevButtonStates.set(hand, gamepad.buttons.map(b => b.pressed))

        // 摇杆移动（右手）
        if (index === 1) {
          const deadzone = 0.15
          if (Math.abs(gamepad.thumbstickX) > deadzone || Math.abs(gamepad.thumbstickY) > deadzone) {
            gameLogic.handleMove(new THREE.Vector2(gamepad.thumbstickX, gamepad.thumbstickY))
          }
        }
      }
    })

    // VR GUI交互：悬停高亮和拖拽更新
    vrControllers.forEach(({ controller }) => {
      vrDebugGUI.handleControllerHover(controller)
      vrDebugGUI.handleControllerMove(controller)
    })
  }

  // 渲染场景
  renderer.render(scene, camera)
}


// 清理函数
function animationCleanup() {
  // 停止动画循环
  renderer.setAnimationLoop(null)

  // 移除事件监听
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('keydown', handleKeyPress)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  renderer.domElement.removeEventListener('mousemove', onMouseMove)
  renderer.domElement.removeEventListener('mousedown', onMouseDown)
  renderer.domElement.removeEventListener('mouseup', onMouseUp)
  renderer.domElement.removeEventListener('contextmenu', onContextMenu)

  // 清理调试工具
  debugGUI.destroy()
  vrDebugGUI.dispose()

  // 清理几何体和材质
  interactableObjects.forEach(obj => {
    const mesh = obj as THREE.Mesh
    mesh.geometry.dispose()
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(m => m.dispose())
    } else {
      mesh.material.dispose()
    }
  })

  // 清理原始材质
  originalMaterials.forEach(material => {
    if (Array.isArray(material)) {
      material.forEach(m => m.dispose())
    } else {
      material.dispose()
    }
  })

  // 清理地面
  ground.geometry.dispose()
  if (Array.isArray(ground.material)) {
    ground.material.forEach(m => m.dispose())
  } else {
    ground.material.dispose()
  }

  // 清理控制器
  if (controls) {
    controls.dispose()
  }

  // 清理渲染器
  if (renderer && container.value) {
    renderer.dispose()
    container.value.removeChild(renderer.domElement)
    // 移除 VR 按钮
    const vrButton = container.value.querySelector('button')
    if (vrButton) {
      container.value.removeChild(vrButton)
    }
  }
}


onMounted(() => {
  if (!container.value) return

  // ========== Three.js 初始化 ==========
  initSceneAndLightAndGround();
  initCamera();
  initRenderer();
  initControls();
  initVRPlayerRig();
  initObject();
  initDebugGUI();



  // 监听桌面输入
  renderer.domElement.addEventListener('mousemove', onMouseMove)
  renderer.domElement.addEventListener('mousedown', onMouseDown)
  renderer.domElement.addEventListener('mouseup', onMouseUp)
  renderer.domElement.addEventListener('contextmenu', onContextMenu)

  window.addEventListener('resize', handleResize)
  window.addEventListener('keydown', handleKeyPress)

  // ========== VR 控制器设置 ==========




  // ========== VR 会话监听 ==========

  // 监听 VR 会话变化
  renderer.xr.addEventListener('sessionstart', () => {
    isVRMode.value = true
    debugPanel.log('✓ 已进入 VR 模式')
    debugPanel.log('控制器已就绪')

    // 禁用 OrbitControls
    controls.enabled = false

    // 进入 VR：将相机从场景移到 rig 中
    const worldPos = new THREE.Vector3()
    camera.getWorldPosition(worldPos)

    scene.remove(camera)
    vrPlayerRig.position.copy(worldPos)
    vrPlayerRig.add(camera)

    // 相机在 rig 内的局部位置归零（头显会控制相对位置）
    camera.position.set(0, 0, 0)

    // 将控制器移动到 VR Player Rig
    moveControllersToParent(vrPlayerRig)
    debugPanel.log('手柄已绑定到玩家')

    // 将VR GUI面板也移动到 VR Player Rig
    const vrGuiPanel = vrDebugGUI.getPanel()
    if (vrGuiPanel.parent === camera) {
      vrPlayerRig.add(vrGuiPanel)
      debugPanel.log('VR GUI已绑定到玩家')
    }
  })

  renderer.xr.addEventListener('sessionend', () => {
    isVRMode.value = false
    debugPanel.log('✓ 已切换到桌面模式')

    // 重新启用 OrbitControls
    controls.enabled = true

    // 退出 VR：将相机从 rig 移回场景
    const worldPos = new THREE.Vector3()
    camera.getWorldPosition(worldPos)

    vrPlayerRig.remove(camera)
    scene.add(camera)
    camera.position.copy(worldPos)

    // 重置 rig 位置供下次使用
    vrPlayerRig.position.set(0, 0, 0)

    // 将控制器移回场景
    moveControllersToParent(scene)

    // 将VR GUI面板移回camera
    const vrGuiPanel = vrDebugGUI.getPanel()
    if (vrGuiPanel.parent && vrGuiPanel.parent !== camera) {
      camera.add(vrGuiPanel)
      debugPanel.log('VR GUI已移回摄像头')
    }
  })

  // 主动画循环
  renderer.setAnimationLoop(animationLoop)
})

// 组件卸载时的清理
onUnmounted(() => {
  if (animationCleanup) {
    animationCleanup()
  }
})
</script>

<template>
  <div ref="container" class="model-container"></div>
</template>

<style scoped>
.model-container {
  width: 100%;
  height: 100%;
}
</style>
