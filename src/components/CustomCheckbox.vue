<template>
  <div>
    <div class="checkbox-container custom-component-wrapper" @click="(e: Event) => { e.stopPropagation(); toggle() }">
      <label class="custom-label">{{ label }}</label>
      <div class="custom-checkbox" ref="checkboxRef" :style="checkboxStyle" @mouseenter="isHovered = true"
        @mouseleave="isHovered = false">
        <div class="checkmark" :style="checkmarkStyle" />
      </div>
    </div>
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
const checkboxRef = ref<HTMLDivElement>()

const checkboxStyle = computed(() => ({
  // borderColor: isHovered.value || props.modelValue ? 'var(--primary-color)' : 'var(--border-color)',
  // background: props.modelValue ? 'var(--primary-alpha)' : 'var(--bg-dark)'
}))

const checkmarkStyle = computed(() => ({
  display: props.modelValue ? 'block' : 'none'
}))

// watch(() => props.modelValue, (newVal) => {
//   if (checkboxRef.value) {
//     checkboxRef.value.style.borderColor = newVal ? 'var(--primary-color)' : 'var(--border-color)'
//   }
// })

const toggle = () => {
  emit('update:modelValue', !props.modelValue)
}
</script>

<style scoped>
@import '@/styles/custom-components.css';

.checkbox-container {
  display: inline-flex;
  cursor: pointer;
}

.custom-checkbox {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-color);
  border-radius: 3px;
  position: relative;
  background: var(--bg-dark);
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
  background: var(--primary-color);
  border-radius: 2px;
}
</style>
