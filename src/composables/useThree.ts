import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import * as THREE from 'three'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface ThreeContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  container: Ref<HTMLDivElement | null>
  controls?: OrbitControls
}

export function useThree(enableVR: boolean = true, enableOrbitControls: boolean = true) {
  const container = ref<HTMLDivElement | null>(null)
  let scene: THREE.Scene
  let camera: THREE.PerspectiveCamera
  let renderer: THREE.WebGLRenderer
  let controls: OrbitControls | undefined
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

    // 创建 OrbitControls（桌面模式）
    if (enableOrbitControls) {
      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.05
      controls.screenSpacePanning = false
      controls.minDistance = 1
      controls.maxDistance = 100
      controls.maxPolarAngle = Math.PI / 1.5
      controls.target.set(0, 3, 1.6)
    }

    // 启用 VR
    if (enableVR) {
      renderer.xr.enabled = true
      
      // 创建 VR 玩家容器（用于传送移动）
      const vrPlayerRig = new THREE.Group()
      vrPlayerRig.name = 'VRPlayerRig'
      vrPlayerRig.position.set(0, 0, 0)
      scene.add(vrPlayerRig)
      
      // 监听 VR 会话，动态切换相机父对象
      renderer.xr.addEventListener('sessionstart', () => {
        console.log('进入 VR 模式 - 切换到 Player Rig')
        
        // 禁用 OrbitControls
        if (controls) {
          controls.enabled = false
        }
        
        // 进入 VR：将相机从场景移到 rig 中
        // rig 保持在相机当前的世界位置
        const worldPos = new THREE.Vector3()
        camera.getWorldPosition(worldPos)
        
        scene.remove(camera)
        vrPlayerRig.position.copy(worldPos)
        vrPlayerRig.add(camera)
        
        // 相机在 rig 内的局部位置归零（头显会控制相对位置）
        camera.position.set(0, 0, 0)
      })
      
      renderer.xr.addEventListener('sessionend', () => {
        console.log('退出 VR 模式 - 切换回场景')
        
        // 重新启用 OrbitControls
        if (controls) {
          controls.enabled = true
        }
        
        // 退出 VR：将相机从 rig 移回场景
        // 保持世界位置
        const worldPos = new THREE.Vector3()
        camera.getWorldPosition(worldPos)
        
        vrPlayerRig.remove(camera)
        scene.add(camera)
        camera.position.copy(worldPos)
        
        // 重置 rig 位置供下次使用
        vrPlayerRig.position.set(0, 0, 0)
      })
      
      const vrButton = VRButton.createButton(renderer)
      container.value.appendChild(vrButton)
      
      // 初始相机添加到场景（桌面模式）
      scene.add(camera)
    } else {
      // 非 VR 模式：相机直接添加到场景
      scene.add(camera)
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
        if (controls && controls.enabled) {
          controls.update()
        }
        
        if (updateFn) {
          updateFn()
        }
        renderer.render(scene, camera)
      })
    } else {
      // 非 VR 模式使用 requestAnimationFrame
      const loop = () => {
        animationId = requestAnimationFrame(loop)

        if (controls && controls.enabled) {
          controls.update()
        }

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
    if (controls) {
      controls.dispose()
    }
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
    controls,
  })

  return {
    container,
    getContext,
    animate,
  }
}

