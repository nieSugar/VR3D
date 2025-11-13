<template>
  <div class="lil-gui-slider">
    <div class="slider-header">
      <span class="slider-title">{{ title }}</span>
      <div class="slider-container">
        <div v-if="min !== undefined && max !== undefined" class="slider-track-container" ref="sliderRef">
          <div class="slider-track" @mousedown="onSliderMouseDown" @touchstart="onSliderTouchStart"
            @wheel.prevent="onSliderWheel">
            <div class="slider-fill" :style="fillStyle"></div>
          </div>
        </div>
        <input ref="inputRef" type="text" :value="displayValue" @input="onInput" @keydown="onKeyDown"
          @wheel.prevent="onInputWheel" @mousedown="onInputMouseDown" @focus="onFocus" @blur="onBlur"
          class="slider-value" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

interface Props {
  title?: string
  modelValue: number
  min?: number
  max?: number
  step?: number
  width?: number
  decimals?: number
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Value',
  step: 1,
  width: 300
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
  'change': [value: number]
  'finishChange': [value: number]
}>()

const inputRef = ref<HTMLInputElement>()
const sliderRef = ref<HTMLElement>()
const currentValue = ref(props.modelValue)
const inputFocused = ref(false)
const changed = ref(false)
const inputDisplayValue = ref(String(props.modelValue))

// 显示值（支持小数位数控制）
const displayValue = computed(() => {
  if (inputFocused.value) {
    return inputDisplayValue.value
  }
  return props.decimals !== undefined
    ? currentValue.value.toFixed(props.decimals)
    : String(currentValue.value)
})

// 填充条样式
const fillStyle = computed(() => {
  if (props.min === undefined || props.max === undefined) {
    return { width: '0%' }
  }
  let percent = (currentValue.value - props.min) / (props.max - props.min)
  percent = Math.max(0, Math.min(percent, 1))
  return { width: `${percent * 100}%` }
})

// Snap 值到 step
const snap = (value: number): number => {
  let offset = props.min || 0
  value -= offset
  value = Math.round(value / props.step) * props.step
  value += offset
  return parseFloat(value.toPrecision(15))
}

// 限制值
const clamp = (value: number): number => {
  if (props.min !== undefined && value < props.min) value = props.min
  if (props.max !== undefined && value > props.max) value = props.max
  return value
}

// 设置值
const setValue = (value: number) => {
  if (currentValue.value !== value) {
    currentValue.value = value
    emit('update:modelValue', value)
    emit('change', value)
    changed.value = true
  }
}

// Snap + Clamp + Set
const snapClampSetValue = (value: number) => {
  setValue(clamp(snap(value)))
}

// 完成变化回调
const callOnFinishChange = () => {
  if (changed.value) {
    emit('finishChange', currentValue.value)
    changed.value = false
  }
}

// 输入框事件
const onInput = (e: Event) => {
  const target = e.target as HTMLInputElement
  inputDisplayValue.value = target.value
  const value = parseFloat(target.value)
  if (!isNaN(value)) {
    setValue(clamp(snap(value)))
  }
}

const onFocus = () => {
  inputFocused.value = true
  inputDisplayValue.value = String(currentValue.value)
}

const onBlur = () => {
  inputFocused.value = false
  callOnFinishChange()
}

// 键盘事件
const arrowKeyMultiplier = (e: KeyboardEvent): number => {
  let mult = 1
  if (e.shiftKey) mult *= 10
  else if (e.altKey) mult /= 10
  return mult
}

const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    inputRef.value?.blur()
  }
  if (e.code === 'ArrowUp') {
    e.preventDefault()
    const value = parseFloat(inputDisplayValue.value)
    const baseValue = isNaN(value) ? currentValue.value : value
    snapClampSetValue(baseValue + props.step * arrowKeyMultiplier(e))
    inputDisplayValue.value = String(currentValue.value)
  }
  if (e.code === 'ArrowDown') {
    e.preventDefault()
    const value = parseFloat(inputDisplayValue.value)
    const baseValue = isNaN(value) ? currentValue.value : value
    snapClampSetValue(baseValue - props.step * arrowKeyMultiplier(e))
    inputDisplayValue.value = String(currentValue.value)
  }
}

// 滚轮事件
const normalizeMouseWheel = (e: WheelEvent): number => {
  let { deltaX, deltaY } = e
  if (Math.floor(e.deltaY) !== e.deltaY && (e as any).wheelDelta) {
    deltaX = 0
    deltaY = -(e as any).wheelDelta / 120
  }
  return deltaX + -deltaY
}

const onInputWheel = (e: WheelEvent) => {
  if (inputFocused.value) {
    const delta = normalizeMouseWheel(e) * props.step
    snapClampSetValue(currentValue.value + delta)
    inputDisplayValue.value = String(currentValue.value)
  }
}

// 垂直拖拽输入框
let testingForVerticalDrag = false
let initClientX = 0, initClientY = 0, prevClientY = 0
let initValue = 0, dragDelta = 0
const DRAG_THRESH = 5

const onInputMouseDown = (e: MouseEvent) => {
  initClientX = e.clientX
  initClientY = prevClientY = e.clientY
  testingForVerticalDrag = true
  initValue = currentValue.value
  dragDelta = 0

  window.addEventListener('mousemove', onInputMouseMove)
  window.addEventListener('mouseup', onInputMouseUp)
}

const onInputMouseMove = (e: MouseEvent) => {
  if (testingForVerticalDrag) {
    const dx = e.clientX - initClientX
    const dy = e.clientY - initClientY

    if (Math.abs(dy) > DRAG_THRESH) {
      e.preventDefault()
      inputRef.value?.blur()
      testingForVerticalDrag = false
      document.body.classList.add('lil-dragging', 'lil-vertical')
    } else if (Math.abs(dx) > DRAG_THRESH) {
      onInputMouseUp()
    }
  }

  if (!testingForVerticalDrag) {
    const dy = e.clientY - prevClientY
    const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
    dragDelta -= dy * props.step * mult
    
    if (props.max !== undefined && initValue + dragDelta > props.max) {
      dragDelta = props.max - initValue
    } else if (props.min !== undefined && initValue + dragDelta < props.min) {
      dragDelta = props.min - initValue
    }
    
    snapClampSetValue(initValue + dragDelta)
  }

  prevClientY = e.clientY
}

const onInputMouseUp = () => {
  document.body.classList.remove('lil-dragging', 'lil-vertical')
  callOnFinishChange()
  window.removeEventListener('mousemove', onInputMouseMove)
  window.removeEventListener('mouseup', onInputMouseUp)
}

// 滑块拖拽
const setValueFromX = (clientX: number) => {
  if (!sliderRef.value || props.min === undefined || props.max === undefined) return
  const rect = sliderRef.value.getBoundingClientRect()
  const value = ((clientX - rect.left) / rect.width) * (props.max - props.min) + props.min
  snapClampSetValue(value)
}

const onSliderMouseDown = (e: MouseEvent) => {
  document.body.classList.add('lil-dragging', 'lil-horizontal')
  setValueFromX(e.clientX)

  const onMouseMove = (e: MouseEvent) => setValueFromX(e.clientX)
  const onMouseUp = () => {
    document.body.classList.remove('lil-dragging', 'lil-horizontal')
    callOnFinishChange()
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

// 触摸事件
let testingForScroll = false
let prevTouchX = 0, prevTouchY = 0

const beginTouchDrag = (e: TouchEvent) => {
  if (!e.touches[0]) return
  e.preventDefault()
  document.body.classList.add('lil-dragging', 'lil-horizontal')
  setValueFromX(e.touches[0].clientX)
  testingForScroll = false
}

const onSliderTouchStart = (e: TouchEvent) => {
  if (e.touches.length > 1 || !e.touches[0]) return

  prevTouchX = e.touches[0].clientX
  prevTouchY = e.touches[0].clientY
  testingForScroll = true

  const onTouchMove = (e: TouchEvent) => {
    if (!e.touches[0]) return

    if (testingForScroll) {
      const dx = e.touches[0].clientX - prevTouchX
      const dy = e.touches[0].clientY - prevTouchY

      if (Math.abs(dx) > Math.abs(dy)) {
        beginTouchDrag(e)
      } else {
        window.removeEventListener('touchmove', onTouchMove)
        window.removeEventListener('touchend', onTouchEnd)
      }
    } else {
      e.preventDefault()
      setValueFromX(e.touches[0].clientX)
    }
  }

  const onTouchEnd = () => {
    document.body.classList.remove('lil-dragging', 'lil-horizontal')
    callOnFinishChange()
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
  }

  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
}

// 滑块滚轮
let wheelFinishChangeTimeout: number
const onSliderWheel = (e: WheelEvent) => {
  const delta = normalizeMouseWheel(e) * props.step
  snapClampSetValue(currentValue.value + delta)

  clearTimeout(wheelFinishChangeTimeout)
  wheelFinishChangeTimeout = setTimeout(callOnFinishChange, 400)
}

// 监听外部值变化
watch(() => props.modelValue, (newVal) => {
  currentValue.value = newVal
  if (!inputFocused.value) {
    inputDisplayValue.value = String(newVal)
  }
})

// 清理
onUnmounted(() => {
  window.removeEventListener('mousemove', onInputMouseMove)
  window.removeEventListener('mouseup', onInputMouseUp)
})
</script>

<style scoped>
.lil-gui-slider {
  background: #1f1f1f;
  padding: 8px 12px;
  user-select: none;
  width: 100%;
  width: 300px
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.slider-title {
  font-size: 11px;
  font-weight: 500;
  color: #ebebeb;
  text-transform: none;
  width: 50px;
}

.slider-container {
  display: flex;
  width: 100%;
}

.slider-value {
  background: #4a4a4a;
  margin-left: 4px;
  border: none;
  color: #2cc9ff;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 11px;
  width: 60px;
  text-align: left;
  outline: none;
  transition: background 0.15s ease;
  cursor: ns-resize;
}

.slider-value:hover {
  background: #333;
}

.slider-value:focus {
  background: #3a3a3a;
  color: #fff;
  cursor: text;
}

.slider-track-container {
  position: relative;
  height: 20px;
  flex: 1;
  display: flex;
  align-items: center;
}

.slider-track {
  position: relative;
  width: 100%;
  height: 100%;
  background: #4a4a4a;
  border-radius: 2px;
  cursor: ew-resize;
}

.slider-track:hover {
  background: #555;
}

.slider-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  border-right: 2px solid #2cc9ff;
}

/* 拖拽光标样式 */
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
