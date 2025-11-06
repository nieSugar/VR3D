import GUI from 'lil-gui'
import * as THREE from 'three'
import { VRDebugPanel } from './VRDebugPanel'
import { VRDebugGUI } from './VRDebugGUI'

export class DebugGUI {
  private gui: GUI;
  private panelFolder: GUI;
  private cameraFolder: GUI;
  private vrGuiFolder?: GUI;
  private debugPanel: VRDebugPanel;
  private camera: THREE.PerspectiveCamera;
  private vrDebugGUI?: VRDebugGUI;

  constructor(
    debugPanel: VRDebugPanel,
    camera: THREE.PerspectiveCamera,
    vrDebugGUI?: VRDebugGUI
  ) {
    this.debugPanel = debugPanel
    this.camera = camera
    this.vrDebugGUI = vrDebugGUI

    this.gui = new GUI({ title: '调试面板' })

    // 面板位置控制
    this.panelFolder = this.gui.addFolder('调试面板位置')
    this.setupPanelControls()

    // 摄像头位置控制
    this.cameraFolder = this.gui.addFolder('摄像头位置')
    this.setupCameraControls()

    // VR GUI控制
    if (this.vrDebugGUI) {
      this.vrGuiFolder = this.gui.addFolder('VR 3D GUI')
      this.setupVRGuiControls()
    }

    // 默认展开
    this.panelFolder.open()
    this.cameraFolder.open()
  }

  private setupPanelControls() {
    const panel = this.debugPanel.getPanel()
    
    // 位置控制
    this.panelFolder
      .add(panel.position, 'x', -5, 5, 0.1)
      .name('X 位置')
      .onChange(() => this.updatePanel())

    this.panelFolder
      .add(panel.position, 'y', 0, 3, 0.1)
      .name('Y 位置')
      .onChange(() => this.updatePanel())

    this.panelFolder
      .add(panel.position, 'z', -5, 5, 0.1)
      .name('Z 位置')
      .onChange(() => this.updatePanel())

    // 旋转控制
    const rotation = {
      x: THREE.MathUtils.radToDeg(panel.rotation.x),
      y: THREE.MathUtils.radToDeg(panel.rotation.y),
      z: THREE.MathUtils.radToDeg(panel.rotation.z),
    }

    this.panelFolder
      .add(rotation, 'x', -180, 180, 1)
      .name('X 旋转 (度)')
      .onChange((value: number) => {
        panel.rotation.x = THREE.MathUtils.degToRad(value)
      })

    this.panelFolder
      .add(rotation, 'y', -180, 180, 1)
      .name('Y 旋转 (度)')
      .onChange((value: number) => {
        panel.rotation.y = THREE.MathUtils.degToRad(value)
      })

    this.panelFolder
      .add(rotation, 'z', -180, 180, 1)
      .name('Z 旋转 (度)')
      .onChange((value: number) => {
        panel.rotation.z = THREE.MathUtils.degToRad(value)
      })

    // 缩放控制
    const scale = { value: panel.scale.x }
    this.panelFolder
      .add(scale, 'value', 0.1, 3, 0.1)
      .name('缩放')
      .onChange((value: number) => {
        panel.scale.setScalar(value)
      })
  }

  private setupCameraControls() {
    // 获取实际的相机（可能在rig中）
    const getActualCamera = () => {
      return this.camera.parent?.name === 'VRPlayerRig' 
        ? this.camera.parent 
        : this.camera
    }

    // 位置控制
    const position = { x: 0, y: 1.6, z: 3 }
    
    this.cameraFolder
      .add(position, 'x', -10, 10, 0.1)
      .name('X 位置')
      .onChange((value: number) => {
        getActualCamera().position.x = value
      })

    this.cameraFolder
      .add(position, 'y', 0, 5, 0.1)
      .name('Y 位置')
      .onChange((value: number) => {
        getActualCamera().position.y = value
      })

    this.cameraFolder
      .add(position, 'z', -10, 10, 0.1)
      .name('Z 位置')
      .onChange((value: number) => {
        getActualCamera().position.z = value
      })

    // 旋转控制
    const rotation = { x: 0, y: 0, z: 0 }

    this.cameraFolder
      .add(rotation, 'x', -180, 180, 1)
      .name('X 旋转 (度)')
      .onChange((value: number) => {
        this.camera.rotation.x = THREE.MathUtils.degToRad(value)
      })

    this.cameraFolder
      .add(rotation, 'y', -180, 180, 1)
      .name('Y 旋转 (度)')
      .onChange((value: number) => {
        this.camera.rotation.y = THREE.MathUtils.degToRad(value)
      })

    this.cameraFolder
      .add(rotation, 'z', -180, 180, 1)
      .name('Z 旋转 (度)')
      .onChange((value: number) => {
        this.camera.rotation.z = THREE.MathUtils.degToRad(value)
      })

    // 视野控制
    this.cameraFolder
      .add(this.camera, 'fov', 30, 120, 1)
      .name('视野角度')
      .onChange(() => {
        this.camera.updateProjectionMatrix()
      })
  }

  private setupVRGuiControls() {
    if (!this.vrDebugGUI || !this.vrGuiFolder) return

    // 显示/隐藏控制
    const visibility = {
      visible: true,
      toggle: () => {
        this.vrDebugGUI?.toggle()
        visibility.visible = !visibility.visible
      }
    }

    this.vrGuiFolder
      .add(visibility, 'visible')
      .name('显示')
      .onChange((value: boolean) => {
        if (value) {
          this.vrDebugGUI?.show()
        } else {
          this.vrDebugGUI?.hide()
        }
      })

    this.vrGuiFolder.add(visibility, 'toggle').name('切换显示 (G键)')

    const panel = this.vrDebugGUI?.getPanel();
    if (!panel) return;
    // 位置控制（相对于摄像头）
    const position = {
      x: panel.position.x,
      y: panel.position.y,
      z: panel.position.z
    }

    this.vrGuiFolder
      .add(position, 'x', -10, 10, 0.1)
      .name('X 位置（相对摄像头）')
      .onChange((value: number) => {
        this.vrDebugGUI?.setPosition(value, position.y, position.z)
      })

    this.vrGuiFolder
      .add(position, 'y', -10, 10, 0.1)
      .name('Y 位置（相对摄像头）')
      .onChange((value: number) => {
        this.vrDebugGUI?.setPosition(position.x, value, position.z)
      })

    this.vrGuiFolder
      .add(position, 'z', -10, 10, 0.1)
      .name('Z 位置（相对摄像头）')
      .onChange((value: number) => {
        this.vrDebugGUI?.setPosition(position.x, position.y, value)
      })

    // 默认打开
    this.vrGuiFolder.open()
  }

  private updatePanel() {
    // 可以在这里添加额外的更新逻辑
  }

  public show() {
    this.gui.show()
  }

  public hide() {
    this.gui.hide()
  }

  public toggle() {
    if (this.gui._hidden) {
      this.gui.show()
    } else {
      this.gui.hide()
    }
  }

  public setVRDebugGUI(vrDebugGUI: VRDebugGUI) {
    this.vrDebugGUI = vrDebugGUI
    
    // 如果VR GUI文件夹已存在，先销毁
    if (this.vrGuiFolder) {
      this.vrGuiFolder.destroy()
    }
    
    // 创建新的VR GUI控制
    this.vrGuiFolder = this.gui.addFolder('VR 3D GUI')
    this.setupVRGuiControls()
  }

  public destroy() {
    this.gui.destroy()
  }
}

