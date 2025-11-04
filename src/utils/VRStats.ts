import * as THREE from 'three'

export class VRStats {
  private scene: THREE.Scene
  private panel: THREE.Mesh
  private canvas: HTMLCanvasElement
  private context: CanvasRenderingContext2D
  private texture: THREE.CanvasTexture
  private stats: Map<string, string> = new Map()

  constructor(scene: THREE.Scene) {
    this.scene = scene

    this.canvas = document.createElement('canvas')
    this.canvas.width = 512
    this.canvas.height = 512
    this.context = this.canvas.getContext('2d')!

    this.texture = new THREE.CanvasTexture(this.canvas)

    const geometry = new THREE.PlaneGeometry(0.4, 0.4)
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      side: THREE.DoubleSide,
      transparent: true,
    })
    this.panel = new THREE.Mesh(geometry, material)
    this.panel.position.set(0.6, 1.6, -1.5) // 放在右侧
    this.scene.add(this.panel)

    this.updateCanvas()
  }

  public set(key: string, value: string | number) {
    this.stats.set(key, String(value))
    this.updateCanvas()
  }

  public remove(key: string) {
    this.stats.delete(key)
    this.updateCanvas()
  }

  public clear() {
    this.stats.clear()
    this.updateCanvas()
  }

  private updateCanvas() {
    const ctx = this.context
    const width = this.canvas.width
    const height = this.canvas.height

    // 清空
    ctx.fillStyle = 'rgba(0, 20, 40, 0.85)'
    ctx.fillRect(0, 0, width, height)

    // 标题
    ctx.fillStyle = '#00ddff'
    ctx.font = 'bold 22px monospace'
    ctx.fillText('Stats', 10, 30)

    // 统计信息
    ctx.font = '18px monospace'
    
    let y = 70
    const lineHeight = 30

    this.stats.forEach((value, key) => {
      ctx.fillStyle = '#aaaaaa'
      ctx.fillText(key + ':', 10, y)
      
      ctx.fillStyle = '#ffffff'
      ctx.fillText(value, 200, y)
      
      y += lineHeight
    })

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

