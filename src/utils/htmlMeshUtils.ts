import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js'
import { InteractiveGroup } from 'three/examples/jsm/interactive/InteractiveGroup.js'
import Stats from 'three/examples/jsm/libs/stats.module.js'

/**
 * 创建Stats的HTMLMesh
 */
export function createStatsMesh(group: InteractiveGroup): { stats: Stats, statsMesh: HTMLMesh } {
  const stats = new Stats()
  stats.dom.style.width = '80px'
  stats.dom.style.height = '48px'
  document.body.appendChild(stats.dom)

  const statsMesh = new HTMLMesh(stats.dom)
  statsMesh.position.x = -0.75
  statsMesh.position.y = 1.5
  statsMesh.position.z = -0.5
  statsMesh.rotation.y = Math.PI / 4
  statsMesh.scale.setScalar(2)
  group.add(statsMesh)

  return { stats, statsMesh }
}

/**
 * 创建材质选择器和checkbox的自定义UI
 */
export function createMaterialSelectUI(
  parameters: any,
  onMaterialChange: () => void,
  onModelVisibilityChange: () => void,
  container: HTMLElement,
  group: InteractiveGroup
): { materialSelectMesh: HTMLMesh, customSelectDiv: HTMLDivElement } {
  
  // 创建显示模型伪checkbox
  const checkboxContainer = document.createElement('div')
  checkboxContainer.style.cssText = `
    margin-top: 12px;
    display: flex;
    align-items: center;
    cursor: pointer;
  `

  // 伪checkbox外框
  const customCheckbox = document.createElement('div')
  customCheckbox.style.cssText = `
    width: 18px;
    height: 18px;
    border: 2px solid #666;
    border-radius: 3px;
    margin-right: 8px;
    position: relative;
    background: #2a2a2a;
    transition: all 0.2s;
    flex-shrink: 0;
  `

  // 伪checkbox勾选标记
  const checkmark = document.createElement('div')
  checkmark.style.cssText = `
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    background: #4CAF50;
    border-radius: 2px;
    display: ${parameters.showModel ? 'block' : 'none'};
  `

  customCheckbox.appendChild(checkmark)

  const checkboxLabel = document.createElement('span')
  checkboxLabel.textContent = '显示模型'
  checkboxLabel.style.cssText = `
    color: #fff;
    font-size: 14px;
    user-select: none;
  `

  checkboxContainer.appendChild(customCheckbox)
  checkboxContainer.appendChild(checkboxLabel)

  const materials = [
    { value: 'glass', label: '玻璃' },
    { value: 'metal', label: '金属' },
    { value: 'plastic', label: '塑料' },
    { value: 'wireframe', label: '线框' },
    { value: 'normal', label: '法线' }
  ]

  // 创建伪select组件（使用ul、li）
  const customSelectDiv = document.createElement('div')
  customSelectDiv.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: rgba(30, 30, 30, 0.95);
    border: 2px solid #666;
    border-radius: 8px;
    padding: 15px;
    font-family: Arial, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    z-index: 100;
    backdrop-filter: blur(10px);
    overflow: visible;
  `

  const label = document.createElement('label')
  label.textContent = '材质类型: '
  label.style.cssText = `
    color: #fff;
    font-size: 16px;
    font-weight: bold;
    margin-right: 10px;
  `

  // 自定义select容器
  const customSelect = document.createElement('div')
  customSelect.style.cssText = `
    display: inline-block;
    position: relative;
    width: 120px;
  `

  // 当前选中项显示框
  const currentValue = document.createElement('div')
  const currentMaterial = materials.find(m => m.value === parameters.materialType)
  currentValue.textContent = currentMaterial?.label || '玻璃'
  currentValue.style.cssText = `
    padding: 8px 30px 8px 12px;
    font-size: 14px;
    border: 1px solid #666;
    border-radius: 4px;
    background: #2a2a2a;
    color: #fff;
    cursor: pointer;
    user-select: none;
    position: relative;
  `

  // 上下箭头容器
  const arrowContainer = document.createElement('div')
  arrowContainer.style.cssText = `
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 1px;
    pointer-events: none;
  `

  // 向上箭头
  const arrowUp = document.createElement('span')
  arrowUp.textContent = '▲'
  arrowUp.style.cssText = `
    font-size: 8px;
    color: #999;
    line-height: 1;
  `

  // 向下箭头
  const arrowDown = document.createElement('span')
  arrowDown.textContent = '▼'
  arrowDown.style.cssText = `
    font-size: 8px;
    color: #999;
    line-height: 1;
  `

  arrowContainer.appendChild(arrowUp)
  arrowContainer.appendChild(arrowDown)
  currentValue.appendChild(arrowContainer)

  // 下拉列表（ul）
  const dropdownList = document.createElement('ul')
  dropdownList.style.cssText = `
    list-style: none;
    margin: 0;
    padding: 0;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #2a2a2a;
    border: 1px solid #666;
    border-radius: 4px;
    margin-top: 4px;
    max-height: 200px;
    overflow-y: auto;
    display: none;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    z-index: 10000;
  `

  // 存储materialSelectMesh引用以便在回调中使用
  let materialSelectMesh: HTMLMesh | null = null

  // 更新纹理的辅助函数
  const updateMeshTexture = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (materialSelectMesh && materialSelectMesh.material && materialSelectMesh.material.map) {
          materialSelectMesh.material.map.needsUpdate = true
        }
      })
    })
  }

  // 点击整个容器切换状态
  checkboxContainer.addEventListener('click', () => {
    parameters.showModel = !parameters.showModel
    
    // 更新UI
    checkmark.style.display = parameters.showModel ? 'block' : 'none'
    customCheckbox.style.borderColor = parameters.showModel ? '#4CAF50' : '#666'
    customCheckbox.style.background = parameters.showModel ? 'rgba(76, 175, 80, 0.1)' : '#2a2a2a'
    
    onModelVisibilityChange()
    // updateMeshTexture()
  })

  // hover效果
  checkboxContainer.addEventListener('mouseenter', () => {
    customCheckbox.style.borderColor = '#4CAF50'
  })

  checkboxContainer.addEventListener('mouseleave', () => {
    customCheckbox.style.borderColor = parameters.showModel ? '#4CAF50' : '#666'
  })

  // 创建选项列表
  materials.forEach(material => {
    const li = document.createElement('li')
    li.textContent = material.label
    li.dataset.value = material.value
    li.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      color: #fff;
      font-size: 14px;
      transition: background 0.2s;
    `

    // 高亮当前选中项
    if (material.value === parameters.materialType) {
      li.style.background = '#444'
    }

    // hover效果
    li.addEventListener('mouseenter', () => {
      li.style.background = '#555'
    })

    li.addEventListener('mouseleave', () => {
      if (material.value !== parameters.materialType) {
        li.style.background = 'transparent'
      } else {
        li.style.background = '#444'
      }
    })

    // 点击选择
    li.addEventListener('click', () => {
      parameters.materialType = material.value
      const textNode = currentValue.childNodes[0]
      if (textNode) {
        textNode.textContent = material.label
      }
      onMaterialChange()

      // 更新所有li的背景
      dropdownList.querySelectorAll('li').forEach(item => {
        const itemValue = (item as HTMLElement).dataset.value
        if (itemValue === material.value) {
          (item as HTMLElement).style.background = '#444'
        } else {
          (item as HTMLElement).style.background = 'transparent'
        }
      })

      // 关闭下拉列表
      dropdownList.style.display = 'none'
      arrowUp.style.color = '#999'
      arrowDown.style.color = '#999'
      isOpen = false

      // updateMeshTexture()
    })

    dropdownList.appendChild(li)
  })

  // hover效果 - 鼠标悬停时箭头变亮
  currentValue.addEventListener('mouseenter', () => {
    if (!isOpen) {
      arrowUp.style.color = '#ccc'
      arrowDown.style.color = '#ccc'
    }
  })

  currentValue.addEventListener('mouseleave', () => {
    if (!isOpen) {
      arrowUp.style.color = '#999'
      arrowDown.style.color = '#999'
    }
  })

  // 切换下拉列表显示/隐藏
  let isOpen = false
  currentValue.addEventListener('click', (e) => {
    e.stopPropagation()
    isOpen = !isOpen
    dropdownList.style.display = isOpen ? 'block' : 'none'
    
    // 切换箭头高亮状态
    if (isOpen) {
      arrowUp.style.color = '#999'
      arrowDown.style.color = '#4CAF50'
    } else {
      arrowUp.style.color = '#999'
      arrowDown.style.color = '#999'
    }

    // updateMeshTexture()
  })

  // 点击外部关闭下拉列表
  document.addEventListener('click', () => {
    if (isOpen) {
      dropdownList.style.display = 'none'
      arrowUp.style.color = '#999'
      arrowDown.style.color = '#999'
      isOpen = false

      // updateMeshTexture()
    }
  })

  customSelect.appendChild(currentValue)
  customSelect.appendChild(dropdownList)
  customSelectDiv.appendChild(label)
  customSelectDiv.appendChild(customSelect)
  customSelectDiv.appendChild(checkboxContainer)

  container.appendChild(customSelectDiv)

  // 创建VR场景中的HTMLMesh
  materialSelectMesh = new HTMLMesh(customSelectDiv)
  materialSelectMesh.position.x = 0.75
  materialSelectMesh.position.y = 1.5
  materialSelectMesh.position.z = -0.5
  materialSelectMesh.rotation.y = -Math.PI / 4
  materialSelectMesh.scale.setScalar(2)
  group.add(materialSelectMesh)

  return { materialSelectMesh, customSelectDiv }
}

