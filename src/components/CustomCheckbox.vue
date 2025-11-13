<template>
  <div
    class="checkbox-container"
    @click="toggle"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <div
      class="custom-checkbox"
      :style="checkboxStyle"
    >
      <div
        class="checkmark"
        :style="checkmarkStyle"
      />
    </div>
    <span class="checkbox-label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  modelValue: boolean
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: '显示模型'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const isHovered = ref(false)

const checkboxStyle = computed(() => ({
  borderColor: isHovered.value || props.modelValue ? '#4CAF50' : '#666',
  background: props.modelValue ? 'rgba(76, 175, 80, 0.1)' : '#2a2a2a'
}))

const checkmarkStyle = computed(() => ({
  display: props.modelValue ? 'block' : 'none'
}))

const toggle = () => {
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped>
.checkbox-container {
  margin-top: 12px;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.custom-checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid #666;
  border-radius: 3px;
  margin-right: 8px;
  position: relative;
  background: #2a2a2a;
  transition: all 0.2s;
  flex-shrink: 0;
}

.checkmark {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  background: #4CAF50;
  border-radius: 2px;
}

.checkbox-label {
  color: #fff;
  font-size: 14px;
  user-select: none;
}
</style>

