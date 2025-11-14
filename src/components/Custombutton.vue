<template>
  <div class="button-item" @click="handleClick">
    <div class="button-background" :style="{ display: isSelected ? 'block' : 'none' }"></div>
    <span class="button-label">{{ label }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  value: string
  label: string
}

const props = withDefaults(defineProps<Props>(), {
  label: ''
})

const currentValue = defineModel<string>()

const isSelected = computed(() => currentValue.value === props.value)

const handleClick = () => {
  currentValue.value = props.value
}

</script>

<style scoped>
@import '@/styles/custom-components.css';

.buttons-wrapper {
  display: inline-flex;
  max-width: 100%;
}

.buttons-container {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 0;
  max-width: 100%;
}

/* 自定义滚动条样式 */
.buttons-container::-webkit-scrollbar {
  height: 6px;
}

.buttons-container::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
  border-radius: 3px;
}

.buttons-container::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 3px;
}

.buttons-container::-webkit-scrollbar-thumb:hover {
  background: var(--bg-hover);
}

.button-item {
  position: relative;
  padding: 4px;
  font-size: 14px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s;
  font-weight: 500;
  background: var(--bg-dark);
}

.button-background {
  width: 100%;
  height: 100%;
  display: block;
  position: absolute;
  left: 0;
  top: 0;
  background: var(--primary-color);
  text-align: center;
}

.button-label {
  position: relative;
  z-index: 1;
}
</style>
