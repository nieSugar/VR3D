import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import * as THREE from 'three'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'

export interface ThreeContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  container: Ref<HTMLDivElement | null>
}

export function useThree(enableVR: boolean = true) {
  const container = ref<HTMLDivElement | null>(null)
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera
  let renderer: THREE.WebGLRenderer
  let animationId: number

  const init = () => {
    if (!container.value) return

    // 创建场景
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)

    // 创建相机
    const aspect = container.value.clientWidth / container.value.clientHeight
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
    camera.position.set(0, 1.6, 3) // VR 中的标准眼睛高度

    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(container.value.clientWidth, container.value.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.value.appendChild(renderer.domElement)

    // 启用 VR
    if (enableVR) {
      renderer.xr.enabled = true
      const vrButton = VRButton.createButton(renderer)
      container.value.appendChild(vrButton)
    }

    // 处理窗口大小调整
    window.addEventListener('resize', handleResize)
  }

  const handleResize = () => {
    if (!container.value) return

    const width = container.value.clientWidth
    const height = container.value.clientHeight

    camera.aspect = width / height
    camera.updateProjectionMatrix()

    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  }

  const animate = (updateFn?: () => void) => {
    if (enableVR) {
      // VR 模式使用 setAnimationLoop
      renderer.setAnimationLoop(() => {
        if (updateFn) {
          updateFn()
        }
        renderer.render(scene, camera)
      })
    } else {
      // 非 VR 模式使用 requestAnimationFrame
      const loop = () => {
        animationId = requestAnimationFrame(loop)

        if (updateFn) {
          updateFn()
        }

        renderer.render(scene, camera)
      }
      loop()
    }
  }

  const cleanup = () => {
    if (enableVR && renderer) {
      renderer.setAnimationLoop(null)
    } else if (animationId) {
      cancelAnimationFrame(animationId)
    }
    window.removeEventListener('resize', handleResize)
    if (renderer) {
      renderer.dispose()
      container.value?.removeChild(renderer.domElement)
    }
  }

  onMounted(() => {
    init()
  })

  onUnmounted(() => {
    cleanup()
  })

  const getContext = (): ThreeContext => ({
    scene,
    camera,
    renderer,
    container,
  })

  return {
    container,
    getContext,
    animate,
  }
}

