<template>
  <div>
    <div class="buttons-wrapper custom-component-wrapper">
      <label v-if="label" class="custom-label">
        {{ label }}
      </label>
      <div ref="containerRef" class="buttons-container" >
        <template v-for="option in options" :key="option.value">
          <CustomButton v-model="modelValue" :value="option.value" :label="option.label">
          </CustomButton>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import CustomButton from './Custombutton.vue'

export interface ButtonOption {
  value: string
  label: string
}

interface Props {
  label?: string
  options: ButtonOption[]
}

withDefaults(defineProps<Props>(), {
  label: ''
})

const modelValue = defineModel<string>()
const containerRef = ref<HTMLDivElement>()
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
  padding: 6px 16px;
  font-size: 14px;
  border: 1px solid;
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.2s;
  font-weight: 500;

  background-color: var(--scrollbar-thumb);
  border-color: var(--bg-dark);
  color: var(--text-muted);
}

.button-item.selected {
  background: var(--primary-color);
  color: var(--text-color);
  border-color: var(--primary-color);
}
</style>
