<template>
  <div class="custom-component-wrapper">
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

      <div class="dropdown-wrapper" v-if="isOpen">
        <ul class="dropdown-list" ref="listRef" @scroll="onListScroll" @wheel.prevent="onListWheel">
          <li v-for="option in options" :key="option.value" class="dropdown-item"
            :class="{ selected: option.value === modelValue }"
            @click="(event: MouseEvent) => selectOption(event, option)" @mouseenter="hoveredValue = option.value"
            @mouseleave="hoveredValue = null">
            {{ option.label }}
          </li>
        </ul>
        <div class="scrollbar-container">
          <div class="scrollbar-track" @mousedown="onScrollbarMouseDown" @touchstart="onScrollbarTouchStart"
            @wheel.prevent="onScrollbarWheel">
            <div class="scrollbar-thumb" :style="thumbStyle"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick } from 'vue'

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
const listRef = ref<HTMLElement>()
const scrollTop = ref(0)

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

// 滚动条样式
const thumbStyle = computed(() => {
  if (!listRef.value || props.options.length <= 3) {
    return { height: '0%', top: '0%' }
  }

  const itemHeight = 34
  const visibleHeight = 3 * itemHeight
  const totalHeight = props.options.length * itemHeight
  const maxScroll = totalHeight - visibleHeight

  // 滑块高度：可视区域占总高度的比例
  const thumbHeight = (visibleHeight / totalHeight) * 100

  // 滑块位置：基于滚动比例（只使用响应式的 scrollTop.value）
  const scrollRatio = maxScroll > 0 ? scrollTop.value / maxScroll : 0
  const thumbTop = scrollRatio * (100 - thumbHeight)

  return {
    height: `${thumbHeight}%`,
    top: `${thumbTop}%`
  }
})

const toggleDropdown = async () => {
  isOpen.value = !isOpen.value

  if (isOpen.value) {
    await nextTick()
    // 滚动到选中项
    if (listRef.value) {
      const selectedIndex = props.options.findIndex(o => o.value === props.modelValue)
      if (selectedIndex !== -1) {
        const itemHeight = 34
        const visibleHeight = 3 * itemHeight
        const targetScroll = selectedIndex * itemHeight
        const maxScroll = props.options.length * itemHeight - visibleHeight

        // 居中显示选中项（如果可能的话）
        const centeredScroll = targetScroll - itemHeight
        listRef.value.scrollTop = Math.max(0, Math.min(centeredScroll, maxScroll))
        scrollTop.value = listRef.value.scrollTop
      }
    }
  }
}

const selectOption = (event: MouseEvent, option: SelectOption) => {
  event.stopPropagation()
  emit('update:modelValue', option.value)
  isOpen.value = false
}

// 列表滚动事件
const onListScroll = () => {
  if (listRef.value) {
    scrollTop.value = listRef.value.scrollTop
  }
}

// 根据 Y 坐标设置滚动位置（类似 CustomSlider 的 setValueFromX）
const setScrollFromY = (clientY: number) => {
  if (!listRef.value) return

  const track = listRef.value.parentElement?.querySelector('.scrollbar-track') as HTMLElement
  if (!track) return

  const rect = track.getBoundingClientRect()
  const itemHeight = 34
  const visibleHeight = 3 * itemHeight
  const totalHeight = props.options.length * itemHeight
  const maxScroll = totalHeight - visibleHeight

  // 鼠标位置在轨道中的比例
  const mouseRatio = (clientY - rect.top) / rect.height
  // 滑块高度占比
  const thumbHeight = (visibleHeight / totalHeight) * 100
  // 滑块可移动范围占比
  const availableTrackRatio = 1 - thumbHeight / 100
  // 从 thumbTop = scrollRatio * (100 - thumbHeight) 反推 scrollRatio
  const scrollRatio = Math.min(mouseRatio / availableTrackRatio, 1)

  listRef.value.scrollTop = Math.max(0, Math.min(scrollRatio * maxScroll, maxScroll))
  scrollTop.value = listRef.value.scrollTop  // 立即触发重绘
}

// 滚动条鼠标按下
const onScrollbarMouseDown = (e: MouseEvent) => {
  document.body.classList.add('lil-dragging', 'lil-vertical')
  setScrollFromY(e.clientY)

  const onMouseMove = (e: MouseEvent) => setScrollFromY(e.clientY)
  const onMouseUp = () => {
    document.body.classList.remove('lil-dragging', 'lil-vertical')
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

// 滚轮事件
const normalizeMouseWheel = (e: WheelEvent): number => {
  let { deltaX, deltaY } = e
  if (Math.floor(e.deltaY) !== e.deltaY && (e as any).wheelDelta) {
    deltaX = 0
    deltaY = -(e as any).wheelDelta / 120
  }
  return deltaX + deltaY
}

const onListWheel = (e: WheelEvent) => {
  if (!listRef.value) return
  const delta = normalizeMouseWheel(e) * 34 // 34px per item
  listRef.value.scrollTop = Math.max(0, listRef.value.scrollTop + delta)
  scrollTop.value = listRef.value.scrollTop  // 立即触发重绘
}

// 滚动条滚轮事件
const onScrollbarWheel = (e: WheelEvent) => {
  onListWheel(e)
}

// 触摸事件（类似 CustomSlider 的 onSliderTouchStart）
let testingForScroll = false
let prevTouchX = 0, prevTouchY = 0

const beginTouchDrag = (e: TouchEvent) => {
  if (!e.touches[0]) return
  e.preventDefault()
  document.body.classList.add('lil-dragging', 'lil-vertical')
  setScrollFromY(e.touches[0].clientY)
  testingForScroll = false
}

const onScrollbarTouchStart = (e: TouchEvent) => {
  if (e.touches.length > 1 || !e.touches[0]) return

  prevTouchX = e.touches[0].clientX
  prevTouchY = e.touches[0].clientY
  testingForScroll = true

  const onTouchMove = (e: TouchEvent) => {
    if (!e.touches[0]) return

    if (testingForScroll) {
      const dx = e.touches[0].clientX - prevTouchX
      const dy = e.touches[0].clientY - prevTouchY

      if (Math.abs(dy) > Math.abs(dx)) {
        beginTouchDrag(e)
      } else {
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', onTouchEnd)
      }
    } else {
      e.preventDefault()
      setScrollFromY(e.touches[0].clientY)
    }
  }

  const onTouchEnd = () => {
    document.body.classList.remove('lil-dragging', 'lil-vertical')
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
  }

  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
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

.custom-select {
  display: inline-flex;
  flex-direction: column;
  width: 120px;
  gap: 4px;
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

.dropdown-wrapper {
  background: var(--bg-dark);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  display: flex;
  gap: 4px;
}

.dropdown-list {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  max-height: 104px;
  /* 3个项目的高度: 34px * 3 + 2px 余量 */
  overflow-y: auto;
  scrollbar-width: none;
  /* Firefox */
  -ms-overflow-style: none;
  /* IE/Edge */
}

.dropdown-list::-webkit-scrollbar {
  display: none;
  /* Chrome/Safari/Opera */
}

.dropdown-item {
  padding: 8px 12px;
  cursor: pointer;
  color: var(--text-color);
  font-size: 14px;
  line-height: 18px;
  /* 确保总高度为 34px: 8 + 18 + 8 = 34 */
  transition: background 0.2s;
}

.dropdown-item.selected {
  background: var(--scrollbar-thumb);
}

.dropdown-item:hover {
  background: var(--bg-hover) !important;
}

.scrollbar-container {
  width: 20px;
  padding: 2px 2px 2px 0;
  display: flex;
  align-items: center;
}

.scrollbar-track {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--bg-medium);
  border-radius: 2px;
  cursor: ns-resize;
}

.scrollbar-track:hover {
  background: var(--bg-hover);
}

.scrollbar-thumb {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  background: var(--primary-color);
  border-radius: 2px;
  pointer-events: none;
}

/* 拖拽光标样式（与 CustomSlider 保持一致） */
:global(body.lil-dragging) {
  cursor: grabbing !important;
  user-select: none !important;
}

:global(body.lil-vertical) {
  cursor: ns-resize !important;
}

:global(body.lil-horizontal) {
  cursor: ew-resize !important;
}
</style>
