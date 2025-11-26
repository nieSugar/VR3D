import { onMounted, onUnmounted, shallowRef, type Ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export function useThreeBase(containerRef: Ref<HTMLElement | null>) {
  // 使用 shallowRef 避免 Vue 深度代理 Three.js 对象
  const scene = shallowRef<THREE.Scene>()
  const camera = shallowRef<THREE.PerspectiveCamera>()
  const renderer = shallowRef<THREE.WebGLRenderer>()
  const controls = shallowRef<OrbitControls>()
  const clock = new THREE.Clock()
  
  // 动画循环回调集合
  const loopCallbacks = new Set<(delta: number, now: number) => void>()

  function init() {
    if (!containerRef.value) return

    // 1. 场景
    const _scene = new THREE.Scene()
    _scene.background = new THREE.Color(0x1a1a2e)
    scene.value = _scene

    // 2. 渲染器
    const { clientWidth, clientHeight } = containerRef.value
    const _renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      logarithmicDepthBuffer: true 
    })
    _renderer.setSize(clientWidth, clientHeight)
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    _renderer.shadowMap.enabled = true
    _renderer.shadowMap.type = THREE.PCFSoftShadowMap
    _renderer.localClippingEnabled = true // 启用本地裁剪
    _renderer.autoClear = false // 用于 stencil buffer
    _renderer.toneMapping = THREE.NeutralToneMapping
    _renderer.toneMappingExposure = 1
    _renderer.xr.enabled = true // 开启 VR
    containerRef.value.appendChild(_renderer.domElement)
    renderer.value = _renderer

    // 3. 相机
    const aspect = clientWidth / clientHeight
    const _camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 999999999)
    _camera.position.set(0, 1.6, 0)
    _scene.add(_camera)
    camera.value = _camera

    // 4. 控制器
    const _controls = new OrbitControls(_camera, _renderer.domElement)
    _controls.enableDamping = true
    _controls.dampingFactor = 0.05
    _controls.screenSpacePanning = false
    _controls.minDistance = 0.5
    _controls.maxDistance = 50
    _controls.maxPolarAngle = Math.PI
    _controls.target.set(0, 1.6, 0)
    controls.value = _controls
    
    // 5. 事件监听
    window.addEventListener('resize', handleResize)
    
    // 6. 启动循环
    startLoop()
  }

  function handleResize() {
    if (!containerRef.value || !camera.value || !renderer.value) return
    const { clientWidth, clientHeight } = containerRef.value
    camera.value.aspect = clientWidth / clientHeight
    camera.value.updateProjectionMatrix()
    renderer.value.setSize(clientWidth, clientHeight)
    renderer.value.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  }

  function startLoop() {
    renderer.value?.setAnimationLoop((time: number) => {
      const delta = clock.getDelta()
      
      controls.value?.update()
      
      // 执行注册的回调
      loopCallbacks.forEach(cb => cb(delta, time))

      if (renderer.value && scene.value && camera.value) {
        renderer.value.clear()
        renderer.value.render(scene.value, camera.value)
      }
    })
  }

  function addLoopCallback(cb: (delta: number, now: number) => void) {
    loopCallbacks.add(cb)
  }

  function removeLoopCallback(cb: (delta: number, now: number) => void) {
    loopCallbacks.delete(cb)
  }

  function dispose() {
    renderer.value?.setAnimationLoop(null)
    window.removeEventListener('resize', handleResize)
    
    if (renderer.value) {
      renderer.value.dispose()
      if (containerRef.value && renderer.value.domElement.parentElement === containerRef.value) {
        containerRef.value.removeChild(renderer.value.domElement)
      }
    }
    
    if (controls.value) {
      controls.value.dispose()
    }
    
    loopCallbacks.clear()
  }

  onMounted(init)
  onUnmounted(dispose)

  return {
    scene,
    camera,
    renderer,
    controls,
    clock,
    addLoopCallback,
    removeLoopCallback
  }
}

