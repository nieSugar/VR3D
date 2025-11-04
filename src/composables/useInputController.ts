import * as THREE from 'three'
import { ref } from 'vue'

// 统一的输入事件接口
export interface InputEvents {
  onSelect?: (position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right') => void
  onSelectStart?: (position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right') => void
  onSelectEnd?: (position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right') => void
  onGrab?: (position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right') => void
  onGrabStart?: (position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right') => void
  onGrabEnd?: (position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right') => void
  onMove?: (delta: THREE.Vector2) => void
  onJump?: () => void
}

// 输入状态
export interface InputState {
  isSelecting: boolean
  isGrabbing: boolean
  cursorPosition: THREE.Vector3
  cursorDirection: THREE.Vector3
  moveInput: THREE.Vector2
}

export interface InputControllerOptions {
  enableKeyboardMove?: boolean
}

export function useInputController(
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer,
  canvas: HTMLCanvasElement,
  events: InputEvents = {},
  options: InputControllerOptions = {}
) {
  const { enableKeyboardMove = true } = options
  const isVRMode = ref(false)
  const state: InputState = {
    isSelecting: false,
    isGrabbing: false,
    cursorPosition: new THREE.Vector3(),
    cursorDirection: new THREE.Vector3(),
    moveInput: new THREE.Vector2(),
  }

  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  const keysPressed = new Set<string>()

  // ========== 桌面模式输入 ==========
  
  function onMouseMove(event: MouseEvent) {
    if (isVRMode.value) return

    // 归一化鼠标坐标
    const rect = canvas.getBoundingClientRect()
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    // 更新射线
    raycaster.setFromCamera(mouse, camera)
    state.cursorPosition.copy(raycaster.ray.origin)
    state.cursorDirection.copy(raycaster.ray.direction)
  }

  function onMouseDown(event: MouseEvent) {
    if (isVRMode.value) return

    if (event.button === 0) { // 左键 = Select
      state.isSelecting = true
      events.onSelectStart?.(
        state.cursorPosition.clone(),
        state.cursorDirection.clone(),
        'right'
      )
    } else if (event.button === 2) { // 右键 = Grab
      state.isGrabbing = true
      events.onGrabStart?.(
        state.cursorPosition.clone(),
        state.cursorDirection.clone(),
        'right'
      )
    }
  }

  function onMouseUp(event: MouseEvent) {
    if (isVRMode.value) return

    if (event.button === 0) {
      state.isSelecting = false
      events.onSelectEnd?.(
        state.cursorPosition.clone(),
        state.cursorDirection.clone(),
        'right'
      )
    } else if (event.button === 2) {
      state.isGrabbing = false
      events.onGrabEnd?.(
        state.cursorPosition.clone(),
        state.cursorDirection.clone(),
        'right'
      )
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (isVRMode.value) return
    const key = event.key.toLowerCase()
    
    // 空格键触发跳跃（只触发一次）
    if (key === ' ' && !keysPressed.has(' ')) {
      events.onJump?.()
    }
    
    keysPressed.add(key)
  }

  function onKeyUp(event: KeyboardEvent) {
    if (isVRMode.value) return
    keysPressed.delete(event.key.toLowerCase())
  }

  function onContextMenu(event: Event) {
    event.preventDefault() // 阻止右键菜单
  }

  // 更新移动输入（WASD：W前 S后 A左 D右）
  function updateDesktopInput() {
    if (isVRMode.value || !enableKeyboardMove) return

    const moveX = (keysPressed.has('d') ? 1 : 0) + (keysPressed.has('a') ? -1 : 0)
    const moveY = (keysPressed.has('w') ? 1 : 0) + (keysPressed.has('s') ? -1 : 0)

    if (moveX !== 0 || moveY !== 0) {
      state.moveInput.set(moveX, moveY)
      events.onMove?.(state.moveInput)
    } else {
      state.moveInput.set(0, 0)
    }
  }

  // 监听桌面输入
  function setupDesktopInput() {
    canvas.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('mouseup', onMouseUp)
    canvas.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
  }

  function cleanupDesktopInput() {
    canvas.removeEventListener('mousemove', onMouseMove)
    canvas.removeEventListener('mousedown', onMouseDown)
    canvas.removeEventListener('mouseup', onMouseUp)
    canvas.removeEventListener('contextmenu', onContextMenu)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
  }

  // ========== VR 模式输入 ==========

  // VR 模式会通过外部调用这些方法
  function triggerVRSelect(position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right') {
    if (!isVRMode.value) return
    events.onSelectStart?.(position, direction, hand)
  }

  function triggerVRSelectEnd(position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right') {
    if (!isVRMode.value) return
    events.onSelectEnd?.(position, direction, hand)
  }

  function triggerVRGrab(position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right') {
    if (!isVRMode.value) return
    events.onGrabStart?.(position, direction, hand)
  }

  function triggerVRGrabEnd(position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right') {
    if (!isVRMode.value) return
    events.onGrabEnd?.(position, direction, hand)
  }

  function triggerVRMove(delta: THREE.Vector2) {
    if (!isVRMode.value) return
    state.moveInput.copy(delta)
    events.onMove?.(delta)
  }

  // ========== 模式切换 ==========

  function onVRSessionStart() {
    isVRMode.value = true
    console.log('切换到 VR 输入模式')
  }

  function onVRSessionEnd() {
    isVRMode.value = false
    console.log('切换到桌面输入模式')
  }

  // 监听 VR 会话变化
  renderer.xr.addEventListener('sessionstart', onVRSessionStart)
  renderer.xr.addEventListener('sessionend', onVRSessionEnd)

  // 初始化桌面输入
  setupDesktopInput()

  // ========== 返回接口 ==========

  return {
    isVRMode,
    state,
    raycaster,
    
    // 桌面模式
    updateDesktopInput,
    
    // VR 模式（供 VR 控制器调用）
    triggerVRSelect,
    triggerVRSelectEnd,
    triggerVRGrab,
    triggerVRGrabEnd,
    triggerVRMove,
    
    // 清理
    cleanup: () => {
      cleanupDesktopInput()
      renderer.xr.removeEventListener('sessionstart', onVRSessionStart)
      renderer.xr.removeEventListener('sessionend', onVRSessionEnd)
    },
  }
}

