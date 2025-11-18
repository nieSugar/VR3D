<template>
  <div class="select-wrapper custom-component-wrapper">
    <label v-if="label" class="custom-label">
      {{ label }}
    </label>

    <div class="custom-select" ref="selectRef">
      <div class="current-value" :style="currentValueStyle" @click.stop="toggleDropdown" @mouseenter="isHovered = true"
        @mouseleave="isHovered = false">
        {{ currentLabel }}
        <div class="arrow-container">
          <span class="arrow-up" :style="{ color: arrowUpColor }">▲</span>
          <span class="arrow-down" :style="{ color: arrowDownColor }">▼</span>
        </div>
      </div>

      <ul class="dropdown-list" :style="{ display: isOpen ? 'block' : 'none' }">
        <li v-for="option in options" :key="option.value" class="dropdown-item"
          :class="{ selected: option.value === modelValue }" @click="(event: MouseEvent) => selectOption(event, option)"
          @mouseenter="hoveredValue = option.value" @mouseleave="hoveredValue = null">
          {{ option.label }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

export interface SelectOption {
  value: string
  label: string
}

interface Props {
  modelValue: string
  options: SelectOption[]
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  label: ''
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const isOpen = ref(false)
const isHovered = ref(false)
const hoveredValue = ref<string | null>(null)
const selectRef = ref<HTMLElement>()

const currentLabel = computed(() => {
  const option = props.options.find(o => o.value === props.modelValue)
  return option?.label || props.options[0]?.label || ''
})

const currentValueStyle = computed(() => ({
  borderColor: isHovered.value || isOpen.value ? 'var(--primary-color)' : 'var(--border-color)'
}))

const arrowUpColor = computed(() => {
  if (isOpen.value) return '#999'
  if (isHovered.value) return '#ccc'
  return '#999'
})

const arrowDownColor = computed(() => {
  if (isOpen.value) return 'var(--primary-color)'
  if (isHovered.value) return '#ccc'
  return '#999'
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const selectOption = (event: MouseEvent, option: SelectOption) => {
  event.stopPropagation()
  emit('update:modelValue', option.value)
  isOpen.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (selectRef.value && !selectRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
@import '@/styles/custom-components.css';

.select-wrapper {
  display: inline-flex;
}

.custom-select {
  display: inline-block;
  position: relative;
  width: 120px;
}

.current-value {
  padding: 6px 30px 6px 12px;
  font-size: 14px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-dark);
  color: var(--text-color);
  cursor: pointer;
  user-select: none;
  position: relative;
  transition: border-color 0.2s;
}

.arrow-container {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 1px;
  pointer-events: none;
}

.arrow-up,
.arrow-down {
  font-size: 8px;
  line-height: 1;
  transition: color 0.2s;
}

.dropdown-list {
  list-style: none;
  margin: 0;
  padding: 0;
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--bg-dark);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 10000;
}

.dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  color: var(--text-color);
  font-size: 14px;
  transition: background 0.2s;
}

.dropdown-item.selected {
  background: var(--scrollbar-thumb);
}

.dropdown-item:hover {
  background: var(--bg-hover) !important;
}
</style>
