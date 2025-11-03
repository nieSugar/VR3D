import * as THREE from 'three'

export class BasicScene {
  private scene: THREE.Scene
  private cube: THREE.Mesh
  private ambientLight: THREE.AmbientLight
  private directionalLight: THREE.DirectionalLight
  private floor: THREE.Mesh
  private interactables: THREE.Object3D[] = []

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.cube = this.createCube()
    this.floor = this.createFloor()
    this.ambientLight = this.createAmbientLight()
    this.directionalLight = this.createDirectionalLight()

    this.setupScene()
  }

  private createCube(): THREE.Mesh {
    const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff88,
      metalness: 0.5,
      roughness: 0.5,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(0, 1.6, -2) // 放在眼前位置
    return mesh
  }

  private createFloor(): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(10, 10)
    const material = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.8,
      metalness: 0.2,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.rotation.x = -Math.PI / 2 // 旋转为水平
    mesh.position.y = 0
    return mesh
  }

  private createAmbientLight(): THREE.AmbientLight {
    return new THREE.AmbientLight(0xffffff, 0.5)
  }

  private createDirectionalLight(): THREE.DirectionalLight {
    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(5, 5, 5)
    light.castShadow = true
    return light
  }

  private setupScene(): void {
    this.scene.add(this.cube)
    this.scene.add(this.floor)
    this.scene.add(this.ambientLight)
    this.scene.add(this.directionalLight)

    // 添加网格辅助线以增强空间感
    const gridHelper = new THREE.GridHelper(10, 10, 0x444444, 0x222222)
    gridHelper.position.y = 0.01
    this.scene.add(gridHelper)

    // 标记可交互对象
    this.interactables.push(this.cube)
  }

  public update(): void {
    // 旋转动画
    this.cube.rotation.x += 0.01
    this.cube.rotation.y += 0.01
  }

  public getCube(): THREE.Mesh {
    return this.cube
  }

  public getScene(): THREE.Scene {
    return this.scene
  }

  public getInteractables(): THREE.Object3D[] {
    return this.interactables
  }

  // 高亮选中的对象
  public highlightObject(object: THREE.Object3D | null): void {
    // 重置所有对象颜色
    if (this.cube.material instanceof THREE.MeshStandardMaterial) {
      this.cube.material.emissive.setHex(0x000000)
    }

    // 高亮选中的对象
    if (object && object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) {
      object.material.emissive.setHex(0x555555)
    }
  }
}

