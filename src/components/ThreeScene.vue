<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { useThree } from '../composables/useThree'
import { useVRControllers } from '../composables/useVRControllers'
import { useInputController } from '../composables/useInputController'
import { BasicScene } from '../scenes/BasicScene'
import { VRDebugPanel } from '../utils/VRDebugPanel'
import { DebugGUI } from '../utils/DebugGUI'
import { VRDebugGUI } from '../utils/VRDebugGUI'

const { container, getContext, animate } = useThree()

onMounted(() => {
  const { scene, renderer, camera } = getContext()
  const basicScene = new BasicScene(scene)


  // 创建调试面板
  const debugPanel = new VRDebugPanel(scene)
  debugPanel.log('应用已启动')
  debugPanel.log('桌面模式: 鼠标旋转视角 / WASD移动 / 空格跳跃 / 左键选择 / 右键抓取')
  debugPanel.log('VR 模式: 扳机选择 / 侧键抓取 / 摇杆移动')

  // 创建调试GUI（桌面模式）
  const debugGUI = new DebugGUI(debugPanel, camera)
  debugPanel.log('GUI调试面板已启动 (按 H 键切换显示)')

  // 创建VR 3D GUI（VR模式）
  const vrDebugGUI = new VRDebugGUI(scene, debugPanel, camera)
  // vrDebugGUI.hide() // 默认隐藏
  debugPanel.log('VR 3D GUI已就绪 (按 G 键切换显示)')
  
  // 将VR GUI添加到调试面板中进行控制
  debugGUI.setVRDebugGUI(vrDebugGUI)

  // 添加键盘快捷键切换GUI
  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'h' || e.key === 'H') {
      debugGUI.toggle()
    } else if (e.key === 'g' || e.key === 'G') {
      vrDebugGUI.toggle()
    }
  }
  window.addEventListener('keydown', handleKeyPress)

  // 统一的游戏逻辑
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
      const intersections = raycaster.intersectObjects(basicScene.getInteractables(), true)

      if (intersections.length > 0 && intersections[0]?.object) {
        const hitObject = intersections[0].object
        debugPanel.log(`命中: ${hitObject.type}`)
        basicScene.highlightObject(hitObject)
      }
    },

    // 选择结束
    handleSelectEnd: (hand: string) => {
      debugPanel.log(`[${hand}] 选择结束`)
      basicScene.highlightObject(null)
    },

    // 抓取开始
    handleGrabStart: (position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right', controller?: THREE.Group) => {
      debugPanel.log(`[${hand}] 抓取开始`)

      const raycaster = new THREE.Raycaster(position, direction)
      const intersections = raycaster.intersectObjects(basicScene.getInteractables(), true)

      if (intersections.length > 0 && intersections[0]?.object) {
        grabbedObject = intersections[0].object
        grabHand = controller ? `vr-${hand}` : 'desktop'

        debugPanel.log('已抓取物体')

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

  // 统一输入控制器
  const inputController = useInputController(
    camera,
    renderer,
    renderer.domElement,
    {
      onSelectStart: (pos, dir, hand) => gameLogic.handleSelectStart(pos, dir, hand),
      onSelectEnd: (_pos, _dir, hand) => gameLogic.handleSelectEnd(hand),
      onGrabStart: (pos, dir, hand) => gameLogic.handleGrabStart(pos, dir, hand),
      onGrabEnd: (_pos, _dir, hand) => gameLogic.handleGrabEnd(hand),
      onMove: (delta) => gameLogic.handleMove(delta),
      onJump: () => gameLogic.handleJump(),
    },
    {
      enableKeyboardMove: true, // 启用 WASD 移动（配合 OrbitControls 使用）
    }
  )

  // 设置 VR 控制器（桥接到统一输入）
  const { getGamepadState, moveControllersToParent, controllers } = useVRControllers(renderer, scene, {
    onSelectStart: (controller, index) => {
      // 先尝试与VR GUI交互
      vrDebugGUI.handleControllerSelect(controller)

      // 如果没有交互到GUI，继续游戏逻辑
      const hand = index === 0 ? 'left' : 'right'
      const pos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld)
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.quaternion)
      gameLogic.handleSelectStart(pos, dir, `vr-${hand}`)
    },

    onSelectEnd: (_controller, index) => {
      // 释放VR GUI拖拽
      vrDebugGUI.handleControllerRelease()

      const hand = index === 0 ? 'left' : 'right'
      gameLogic.handleSelectEnd(`vr-${hand}`)
    },

    onSqueezeStart: (controller, index) => {
      const hand = index === 0 ? 'left' : 'right'
      const pos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld)
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.quaternion)
      gameLogic.handleGrabStart(pos, dir, hand, controller)
    },

    onSqueezeEnd: (controller, index) => {
      const hand = index === 0 ? 'left' : 'right'
      gameLogic.handleGrabEnd(hand, controller)
    },
  })

  // 监听 VR 会话变化
  renderer.xr.addEventListener('sessionstart', () => {
    debugPanel.log('✓ 已进入 VR 模式')
    debugPanel.log('控制器已就绪')

    // 将控制器移动到 VR Player Rig
    const rig = scene.getObjectByName('VRPlayerRig')
    if (rig) {
      moveControllersToParent(rig)
      debugPanel.log('手柄已绑定到玩家')
      
      // 将VR GUI面板也移动到 VR Player Rig（从camera移到rig，这样能正确跟随头显）
      const vrGuiPanel = vrDebugGUI.getPanel()
      if (vrGuiPanel.parent === camera) {
        rig.add(vrGuiPanel)
        debugPanel.log('VR GUI已绑定到玩家')
      }
    }
  })

  renderer.xr.addEventListener('sessionend', () => {
    debugPanel.log('✓ 已切换到桌面模式')

    // 将控制器移回场景
    moveControllersToParent(scene)
    
    // 将VR GUI面板移回camera
    const vrGuiPanel = vrDebugGUI.getPanel()
    if (vrGuiPanel.parent && vrGuiPanel.parent !== camera) {
      camera.add(vrGuiPanel)
      debugPanel.log('VR GUI已移回摄像头')
    }
  })

  // 按键状态跟踪
  const prevButtonStates: Map<string, boolean[]> = new Map()
  
  // 按键名称映射（Quest 手柄）
  const buttonNames = {
    0: 'Trigger',      // 0: 扳机
    1: 'Squeeze',      // 1: 侧键
    3: 'Thumbstick',   // 3: 摇杆按下
    4: 'X/A',          // 4: X键(左手) 或 A键(右手)
    5: 'Y/B',          // 5: Y键(左手) 或 B键(右手)
    12: 'Menu',         // 12: 菜单键
  }

  // 主循环
  animate(() => {
    basicScene.update()

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
    if (!inputController.isVRMode.value) {
      inputController.updateDesktopInput()

      // 桌面模式：移动抓取的物体
      if (grabbedObject && grabHand === 'desktop') {
        const pos = inputController.state.cursorPosition
        const dir = inputController.state.cursorDirection
        // 将物体放在射线前方固定距离
        grabbedObject.position.copy(pos).add(dir.multiplyScalar(2))
      }
    }
    // VR 模式：处理摇杆输入和GUI交互
    else {
      // 监听左右手柄按键
      [0, 1].forEach(index => {
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
              inputController.triggerVRMove(
                new THREE.Vector2(gamepad.thumbstickX, gamepad.thumbstickY)
              )
            }
          }
        }
      })

      // VR GUI交互：悬停高亮和拖拽更新
      controllers.forEach(({ controller }) => {
        vrDebugGUI.handleControllerHover(controller)
        vrDebugGUI.handleControllerMove(controller)
      })
    }
  })

  // 清理
  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyPress)
    debugGUI.destroy()
    vrDebugGUI.dispose()
    inputController.cleanup()
  })
})
</script>

<template>
  <div ref="container" class="three-container"></div>
</template>

<style scoped>
.three-container {
  width: 100%;
  height: 100%;
}
</style>
