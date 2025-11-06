import * as THREE from 'three'

/**
 * 创建带有中文文字的 3D 网格
 */
export class TextMesh extends THREE.Mesh {
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private texture: THREE.CanvasTexture
  private _text: string = ''
  private _fontSize: number = 64
  private _color: string = '#ffffff'
  private _maxWidth?: number
  private _lineHeight: number = 1.2

  constructor(text: string = '', fontSize: number = 64, options?: {
    color?: string
    maxWidth?: number
    lineHeight?: number
    fontFamily?: string
  }) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    
    const texture = new THREE.CanvasTexture(canvas)
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false
    })
    
    const geometry = new THREE.PlaneGeometry(1, 1)
    super(geometry, material)
    
    this.canvas = canvas
    this.context = context
    this.texture = texture
    
    this._text = text
    this._fontSize = fontSize
    this._color = options?.color || '#ffffff'
    this._maxWidth = options?.maxWidth
    this._lineHeight = options?.lineHeight || 1.2
    
    this.updateTexture(options?.fontFamily || 'Noto Sans SC')
  }

  private updateTexture(fontFamily: string) {
    const ctx = this.context
    const fontSize = this._fontSize
    
    // 设置字体
    ctx.font = `${fontSize}px "${fontFamily}"`
    
    // 处理文字换行
    const lines = this.wrapText(this._text, this._maxWidth)
    
    // 测量文字尺寸
    const lineHeight = fontSize * this._lineHeight
    const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width))
    const textHeight = lines.length * lineHeight
    
    // 设置 canvas 尺寸（使用 2 的幂次方以获得更好的性能）
    const padding = fontSize * 0.2
    this.canvas.width = Math.pow(2, Math.ceil(Math.log2(maxWidth + padding * 2)))
    this.canvas.height = Math.pow(2, Math.ceil(Math.log2(textHeight + padding * 2)))
    
    // 清空画布
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    
    // 重新设置字体（canvas 尺寸改变后会重置）
    ctx.font = `${fontSize}px "${fontFamily}"`
    ctx.fillStyle = this._color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    
    // 绘制文字
    const startX = this.canvas.width / 2
    const startY = (this.canvas.height - textHeight) / 2
    
    lines.forEach((line, index) => {
      ctx.fillText(line, startX, startY + index * lineHeight)
    })
    
    // 更新纹理
    this.texture.needsUpdate = true
    
    // 更新几何体尺寸以匹配文字宽高比
    const aspect = maxWidth / textHeight
    const scale = 0.001 // 控制整体大小
    this.scale.set(maxWidth * scale, textHeight * scale, 1)
  }

  private wrapText(text: string, maxWidth?: number): string[] {
    if (!maxWidth) {
      return text.split('\n')
    }

    const lines: string[] = []
    const paragraphs = text.split('\n')
    
    paragraphs.forEach(paragraph => {
      let currentLine = ''
      const chars = paragraph.split('')
      
      chars.forEach(char => {
        const testLine = currentLine + char
        const metrics = this.context.measureText(testLine)
        
        if (metrics.width > maxWidth && currentLine !== '') {
          lines.push(currentLine)
          currentLine = char
        } else {
          currentLine = testLine
        }
      })
      
      if (currentLine) {
        lines.push(currentLine)
      }
    })
    
    return lines
  }

  get text(): string {
    return this._text
  }

  set text(value: string) {
    if (this._text !== value) {
      this._text = value
      this.updateTexture('Noto Sans SC')
    }
  }

  get fontSize(): number {
    return this._fontSize
  }

  set fontSize(value: number) {
    if (this._fontSize !== value) {
      this._fontSize = value
      this.updateTexture('Noto Sans SC')
    }
  }

  get color(): string {
    return this._color
  }

  set color(value: string) {
    if (this._color !== value) {
      this._color = value
      this.updateTexture('Noto Sans SC')
    }
  }

  get maxWidth(): number | undefined {
    return this._maxWidth
  }

  set maxWidth(value: number | undefined) {
    if (this._maxWidth !== value) {
      this._maxWidth = value
      this.updateTexture('Noto Sans SC')
    }
  }

  dispose() {
    this.geometry.dispose()
    ;(this.material as THREE.Material).dispose()
    this.texture.dispose()
  }
}

