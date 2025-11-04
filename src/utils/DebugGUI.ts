import GUI from 'lil-gui'
import * as THREE from 'three'
import { VRDebugPanel } from './VRDebugPanel'

export class DebugGUI {
  private gui: GUI;
  private panelFolder: GUI;
  private cameraFolder: GUI;
  private debugPanel: VRDebugPanel;
  private camera: THREE.PerspectiveCamera;

  constructor(
    debugPanel: VRDebugPanel,
    camera: THREE.PerspectiveCamera
  ) {
    this.debugPanel = debugPanel
    this.camera = camera

    this.gui = new GUI({ title: '调试面板' })

    // 面板位置控制
    this.panelFolder = this.gui.addFolder('调试面板位置')
    this.setupPanelControls()

    // 摄像头位置控制
    this.cameraFolder = this.gui.addFolder('摄像头位置')
    this.setupCameraControls()

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

    // 预设位置
    const presets = {
      前方: () => {
        panel.position.set(0, 1.6, -2)
        panel.rotation.set(0, 0, 0)
        this.updatePanelGUI()
      },
      左侧: () => {
        panel.position.set(-2, 1.6, 0)
        panel.rotation.set(0, Math.PI / 2, 0)
        this.updatePanelGUI()
      },
      右侧: () => {
        panel.position.set(2, 1.6, 0)
        panel.rotation.set(0, -Math.PI / 2, 0)
        this.updatePanelGUI()
      },
      上方: () => {
        panel.position.set(0, 2.5, 0)
        panel.rotation.set(-Math.PI / 2, 0, 0)
        this.updatePanelGUI()
      },
    }

    this.panelFolder.add(presets, '前方')
    this.panelFolder.add(presets, '左侧')
    this.panelFolder.add(presets, '右侧')
    this.panelFolder.add(presets, '上方')
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

    // 预设位置
    const presets = {
      默认: () => {
        const target = getActualCamera()
        target.position.set(0, 1.6, 3)
        this.camera.rotation.set(0, 0, 0)
        this.updateCameraGUI()
      },
      俯视: () => {
        const target = getActualCamera()
        target.position.set(0, 5, 0)
        this.camera.rotation.set(-Math.PI / 2, 0, 0)
        this.updateCameraGUI()
      },
      远景: () => {
        const target = getActualCamera()
        target.position.set(0, 2, 8)
        this.camera.rotation.set(0, 0, 0)
        this.updateCameraGUI()
      },
    }

    this.cameraFolder.add(presets, '默认')
    this.cameraFolder.add(presets, '俯视')
    this.cameraFolder.add(presets, '远景')
  }

  private updatePanel() {
    // 可以在这里添加额外的更新逻辑
  }

  private updatePanelGUI() {
    // 更新GUI显示的值
    this.gui.controllersRecursive().forEach(controller => controller.updateDisplay())
  }

  private updateCameraGUI() {
    // 更新GUI显示的值
    this.gui.controllersRecursive().forEach(controller => controller.updateDisplay())
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

  public destroy() {
    this.gui.destroy()
  }
}

