import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js'
import { InteractiveGroup } from 'three/examples/jsm/interactive/InteractiveGroup.js'
import { createApp, reactive } from 'vue'
import LilGuiSlider from '../components/CustomSlider.vue'

interface SliderConfig {
  title?: string
  value: number
  min?: number
  max?: number
  step?: number
  width?: number
  onChange?: (value: number) => void
}

interface SliderPanelConfig {
  sliders: SliderConfig[]
  panelWidth?: number
  title?: string
}

/**
 * 创建单个 slider HTMLMesh
 */
export function createSliderMesh(config: SliderConfig): HTMLMesh {
  const container = document.createElement('div')
  container.style.background = 'transparent'
  
  const state = reactive({
    value: config.value
  })

  const app = createApp(LilGuiSlider, {
    title: config.title || 'Value',
    modelValue: state.value,
    min: config.min ?? 0,
    max: config.max ?? 1,
    step: config.step ?? 0.01,
    width: config.width ?? 300,
    'onUpdate:modelValue': (newValue: number) => {
      state.value = newValue
    },
    onChange: (newValue: number) => {
      config.onChange?.(newValue)
    }
  })

  app.mount(container)

  const mesh = new HTMLMesh(container)
  return mesh
}

/**
 * 创建 slider 面板 - 包含多个 slider
 */
export function createSliderPanel(config: SliderPanelConfig): {
  container: HTMLDivElement
  mesh: HTMLMesh
  updateValue: (index: number, value: number) => void
} {
  const panelWidth = config.panelWidth ?? 320
  const container = document.createElement('div')
  
  // 设置面板样式
  container.style.cssText = `
    background: #1a1a1a;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    width: ${panelWidth}px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  `

  // 添加标题
  if (config.title) {
    const titleDiv = document.createElement('div')
    titleDiv.style.cssText = `
      color: #ebebeb;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #2a2a2a;
    `
    titleDiv.textContent = config.title
    container.appendChild(titleDiv)
  }

  const sliderApps: any[] = []
  const sliderStates: any[] = []

  // 创建每个 slider
  config.sliders.forEach((sliderConfig, index) => {
    const sliderContainer = document.createElement('div')
    sliderContainer.style.marginBottom = index < config.sliders.length - 1 ? '8px' : '0'

    const state = reactive({
      value: sliderConfig.value
    })
    sliderStates.push(state)

    const app = createApp(LilGuiSlider, {
      title: sliderConfig.title || `Value ${index + 1}`,
      modelValue: state.value,
      min: sliderConfig.min ?? 0,
      max: sliderConfig.max ?? 1,
      step: sliderConfig.step ?? 0.01,
      width: panelWidth - 24, // 减去 padding
      'onUpdate:modelValue': (newValue: number) => {
        state.value = newValue
      },
      onChange: (newValue: number) => {
        sliderConfig.onChange?.(newValue)
      }
    })

    app.mount(sliderContainer)
    sliderApps.push(app)
    container.appendChild(sliderContainer)
  })

  const mesh = new HTMLMesh(container)

  // 提供更新值的方法
  const updateValue = (index: number, value: number) => {
    if (index >= 0 && index < sliderStates.length) {
      sliderStates[index].value = value
    }
  }

  return { container, mesh, updateValue }
}

/**
 * 快速创建带预设位置的 slider 面板
 */
export function createVRSliderPanel(
  config: SliderPanelConfig,
  group: InteractiveGroup,
  position = { x: -0.75, y: 1.5, z: -0.5 },
  rotation = { y: Math.PI / 4 },
  scale = 2
) {
  const { mesh, updateValue } = createSliderPanel(config)

  mesh.position.set(position.x, position.y, position.z)
  mesh.rotation.y = rotation.y
  mesh.scale.setScalar(scale)

  group.add(mesh)

  return { mesh, updateValue }
}

/**
 * 创建 lil-gui 风格的简单 HTML slider（不使用 Vue）
 */
export function createSimpleSlider(config: SliderConfig): {
  element: HTMLDivElement
  setValue: (value: number) => void
  getValue: () => number
} {
  const container = document.createElement('div')
  container.className = 'lil-gui-slider-simple'
  container.style.cssText = `
    background: #1f1f1f;
    border-radius: 4px;
    padding: 8px 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: #ebebeb;
    width: ${config.width ?? 300}px;
  `

  // Header
  const header = document.createElement('div')
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  `

  const title = document.createElement('span')
  title.style.cssText = `
    font-size: 11px;
    font-weight: 500;
    color: #ebebeb;
  `
  title.textContent = config.title || 'Value'

  const valueInput = document.createElement('input')
  valueInput.type = 'number'
  valueInput.value = config.value.toString()
  valueInput.step = (config.step ?? 0.01).toString()
  valueInput.style.cssText = `
    background: #2a2a2a;
    border: none;
    color: #ebebeb;
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 11px;
    width: 60px;
    text-align: right;
    outline: none;
  `

  header.appendChild(title)
  header.appendChild(valueInput)

  // Track container
  const trackContainer = document.createElement('div')
  trackContainer.style.cssText = `
    position: relative;
    height: 20px;
    display: flex;
    align-items: center;
  `

  const fill = document.createElement('div')
  fill.style.cssText = `
    position: absolute;
    left: 0;
    height: 4px;
    background: linear-gradient(90deg, #00aaff, #0088cc);
    border-radius: 2px;
    pointer-events: none;
    z-index: 1;
  `

  const slider = document.createElement('input')
  slider.type = 'range'
  slider.min = (config.min ?? 0).toString()
  slider.max = (config.max ?? 1).toString()
  slider.step = (config.step ?? 0.01).toString()
  slider.value = config.value.toString()
  slider.style.cssText = `
    width: 100%;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: #4a4a4a;
    outline: none;
    border-radius: 2px;
    cursor: pointer;
    position: relative;
    z-index: 2;
  `

  // 添加 slider thumb 样式
  const style = document.createElement('style')
  style.textContent = `
    .lil-gui-slider-simple input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 12px;
      height: 12px;
      background: #ebebeb;
      border-radius: 50%;
      cursor: pointer;
    }
    .lil-gui-slider-simple input[type="range"]::-moz-range-thumb {
      width: 12px;
      height: 12px;
      background: #ebebeb;
      border: none;
      border-radius: 50%;
      cursor: pointer;
    }
  `
  document.head.appendChild(style)

  trackContainer.appendChild(fill)
  trackContainer.appendChild(slider)

  container.appendChild(header)
  container.appendChild(trackContainer)

  // 更新填充条
  const updateFill = (value: number) => {
    const min = config.min ?? 0
    const max = config.max ?? 1
    const percentage = ((value - min) / (max - min)) * 100
    fill.style.width = `${percentage}%`
  }

  // 事件处理
  const handleChange = (value: number) => {
    valueInput.value = value.toFixed(2)
    updateFill(value)
    config.onChange?.(value)
  }

  slider.addEventListener('input', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value)
    handleChange(value)
  })

  valueInput.addEventListener('input', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value)
    slider.value = value.toString()
    handleChange(value)
  })

  updateFill(config.value)

  return {
    element: container,
    setValue: (value: number) => {
      slider.value = value.toString()
      handleChange(value)
    },
    getValue: () => parseFloat(slider.value)
  }
}

