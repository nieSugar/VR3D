<script setup lang="ts">
import { onMounted } from 'vue'
import { useThree } from '../composables/useThree'
import { useVRControllers } from '../composables/useVRControllers'
import { BasicScene } from '../scenes/BasicScene'
import type * as THREE from 'three'

const { container, getContext, animate } = useThree()

onMounted(() => {
  const { scene, renderer } = getContext()
  const basicScene = new BasicScene(scene)

  // 设置 VR 控制器
  const { controllers, getIntersections, getGamepadState } = useVRControllers(renderer, scene, {
    // 扳机按下（选择开始）
    onSelectStart: (controller, index) => {
      console.log(`控制器 ${index} 扳机按下`)
      
      // 检测射线碰撞
      const intersections = getIntersections(index, basicScene.getInteractables())
      if (intersections.length > 0) {
        const hitObject = intersections[0].object
        console.log('命中物体:', hitObject.name || hitObject.type)
        basicScene.highlightObject(hitObject)
      }
    },

    // 扳机释放（选择结束）
    onSelectEnd: (controller, index) => {
      console.log(`控制器 ${index} 扳机释放`)
      basicScene.highlightObject(null)
    },

    // 侧键按下（抓取开始）
    onSqueezeStart: (controller, index) => {
      console.log(`控制器 ${index} 侧键按下`)
      
      const intersections = getIntersections(index, basicScene.getInteractables())
      if (intersections.length > 0) {
        const hitObject = intersections[0].object
        // 将物体附加到控制器上
        controller.attach(hitObject)
      }
    },

    // 侧键释放（抓取结束）
    onSqueezeEnd: (controller, index) => {
      console.log(`控制器 ${index} 侧键释放`)
      
      // 释放物体
      const attachedObject = controller.children.find(
        (child) => child.type === 'Mesh' && child.name !== 'line'
      )
      if (attachedObject) {
        scene.attach(attachedObject as THREE.Object3D)
      }
    },
  })

  animate(() => {
    basicScene.update()

    // 获取控制器输入状态（可用于更复杂的交互）
    const leftGamepad = getGamepadState(0)
    const rightGamepad = getGamepadState(1)

    // 示例：使用摇杆移动物体
    if (rightGamepad) {
      const cube = basicScene.getCube()
      if (Math.abs(rightGamepad.thumbstickX) > 0.1 || Math.abs(rightGamepad.thumbstickY) > 0.1) {
        cube.position.x += rightGamepad.thumbstickX * 0.01
        cube.position.z -= rightGamepad.thumbstickY * 0.01
      }
    }
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

