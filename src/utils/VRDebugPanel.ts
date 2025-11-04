import * as THREE from 'three'

export class VRDebugPanel {
  private scene: THREE.Scene
  private panel: THREE.Mesh
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private texture: THREE.CanvasTexture
  private logs: string[] = []
  private maxLogs = 15

  constructor(scene: THREE.Scene) {
    this.scene = scene

    // 创建 canvas 用于绘制文字
    this.canvas = document.createElement('canvas')
    this.canvas.width = 512
    this.canvas.height = 512
    this.context = this.canvas.getContext('2d')!

    // 创建纹理
    this.texture = new THREE.CanvasTexture(this.canvas)

    // 创建面板
    const geometry = new THREE.PlaneGeometry(0.5, 0.5)
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      side: THREE.DoubleSide,
      transparent: true,
    })
    this.panel = new THREE.Mesh(geometry, material)
    this.panel.position.set(0, 3, 1) // 放在眼前
    this.scene.add(this.panel)

    this.updateCanvas()

    // 拦截 console.log
    this.interceptConsole()
  }

  private interceptConsole() {
    const originalLog = console.log
    const originalError = console.error
    const originalWarn = console.warn

    console.log = (...args: any[]) => {
      originalLog.apply(console, args)
      this.addLog('LOG: ' + args.join(' '))
    }

    console.error = (...args: any[]) => {
      originalError.apply(console, args)
      this.addLog('ERROR: ' + args.join(' '))
    }

    console.warn = (...args: any[]) => {
      originalWarn.apply(console, args)
      this.addLog('WARN: ' + args.join(' '))
    }
  }

  public addLog(message: string) {
    this.logs.push(message)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }
    this.updateCanvas()
  }

  public log(message: string) {
    this.addLog('> ' + message)
  }

  private updateCanvas() {
    const ctx = this.context
    const width = this.canvas.width
    const height = this.canvas.height

    // 清空
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
    ctx.fillRect(0, 0, width, height)

    // 绘制标题
    ctx.fillStyle = '#00ff88'
    ctx.font = 'bold 24px monospace'
    ctx.fillText('VR Debug Panel', 10, 30)

    // 绘制日志
    ctx.fillStyle = '#ffffff'
    ctx.font = '16px monospace'
    
    const lineHeight = 28
    const startY = 70

    this.logs.forEach((log, i) => {
      const y = startY + i * lineHeight
      
      // 根据类型设置颜色
      if (log.startsWith('ERROR:')) {
        ctx.fillStyle = '#ff4444'
      } else if (log.startsWith('WARN:')) {
        ctx.fillStyle = '#ffaa00'
      } else if (log.startsWith('LOG:')) {
        ctx.fillStyle = '#00aaff'
      } else {
        ctx.fillStyle = '#ffffff'
      }

      // 文本过长时截断
      const maxChars = 45
      const text = log.length > maxChars ? log.substring(0, maxChars) + '...' : log
      ctx.fillText(text, 10, y)
    })

    // 更新纹理
    this.texture.needsUpdate = true
  }

  public setPosition(x: number, y: number, z: number) {
    this.panel.position.set(x, y, z)
  }

  public show() {
    this.panel.visible = true
  }

  public hide() {
    this.panel.visible = false
  }

  public toggle() {
    this.panel.visible = !this.panel.visible
  }

  public getPanel(): THREE.Mesh {
    return this.panel
  }

  public dispose() {
    this.scene.remove(this.panel)
    this.texture.dispose()
    if (this.panel.geometry) this.panel.geometry.dispose()
    if (this.panel.material) {
      if (Array.isArray(this.panel.material)) {
        this.panel.material.forEach(m => m.dispose())
      } else {
        this.panel.material.dispose()
      }
    }
  }
}

