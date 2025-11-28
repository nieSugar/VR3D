<script setup lang="ts">
import CustomCheckbox from '../../components/CustomCheckbox.vue'
import CustomSelectV2, { type SelectOption } from '../../components/CustomSelectV2.vue'
import CustomSlider from '../../components/CustomSlider.vue'
import CustomActionButton from '../../components/CustomActionButton.vue'

interface GuiParams {
  caeModel: {
    visible: boolean
    wireframe: boolean
    opacity: number
    metalness: number
    roughness: number
    colorMap: string
  }
  rotation: {
    upDown: boolean
    leftRight: boolean
    speed: number
  }
  planeX: { scope: number; plan: boolean }
  planeY: { scope: number; plan: boolean }
  planeZ: { scope: number; plan: boolean }
  modelName: string
  typenode: string
  frame: string
  animate: boolean
}

interface PanelOptions {
  modelNameOptions: SelectOption[]
  typeNodeOptions: SelectOption[]
  frameOptions: SelectOption[]
  colorMapOptions: SelectOption[]
  planeRanges: {
    x: { min: number; max: number }
    y: { min: number; max: number }
    z: { min: number; max: number }
  }
}

defineProps<{
  params: GuiParams
  options: PanelOptions
  onResetModel?: () => void
}>()

const emit = defineEmits<{
  resetModel: []
}>()
</script>

<template>
  <div class="gui-content">
    <div class="gui-title">CAE 模型控制</div>

    <div class="gui-section">
      <CustomCheckbox v-model="params.caeModel.visible" label="显示" />
      <CustomCheckbox v-model="params.caeModel.wireframe" label="线框模式" />
      <CustomSelectV2 v-model="params.modelName" label="模型" :options="options.modelNameOptions" />
      <CustomSlider v-model="params.caeModel.opacity" label="透明度" :min="0" :max="1" :step="0.1" :decimals="1" />
      <CustomSlider v-model="params.caeModel.metalness" label="金属度" :min="0" :max="1" :step="0.1" :decimals="1" />
      <CustomSlider v-model="params.caeModel.roughness" label="粗糙度" :min="0" :max="1" :step="0.1" :decimals="1" />
      <CustomSelectV2 v-model="params.typenode" label="数据类型" :options="options.typeNodeOptions" />
      <CustomSelectV2 v-if="options.frameOptions.length > 0" v-model="params.frame" label="时间帧"
        :options="options.frameOptions" />

      <CustomSelectV2 v-model="params.caeModel.colorMap" label="颜色映射" :options="options.colorMapOptions" />
      <CustomCheckbox v-model="params.animate" label="动画播放" />

      <div class="section-title">旋转控制</div>
      <CustomCheckbox v-model="params.rotation.upDown" label="上下旋转" />
      <CustomCheckbox v-model="params.rotation.leftRight" label="左右旋转" />
      <CustomSlider v-model="params.rotation.speed" label="旋转速度" :min="0.1" :max="5" :step="0.1" :decimals="1" />
      <CustomActionButton label="重置模型位置" @click="emit('resetModel')" />

      <!-- 裁剪平面 -->
      <div class="section-title">剖切控制</div>
      <CustomSlider v-model="params.planeX.scope" label="X轴剖切" :min="options.planeRanges.x.min" :max="options.planeRanges.x.max"
        :step="0.01" :decimals="2" />
      <CustomSlider v-model="params.planeY.scope" label="Y轴剖切" :min="options.planeRanges.y.min" :max="options.planeRanges.y.max"
        :step="0.01" :decimals="2" />
      <CustomSlider v-model="params.planeZ.scope" label="Z轴剖切" :min="options.planeRanges.z.min" :max="options.planeRanges.z.max"
        :step="0.01" :decimals="2" />
    </div>
  </div>
</template>

<style scoped>
.gui-title {
  font-size: 18px;
  font-weight: bold;
  color: #4ecdc4;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid rgba(78, 205, 196, 0.3);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #64b5f6;
  margin: 16px 0 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
