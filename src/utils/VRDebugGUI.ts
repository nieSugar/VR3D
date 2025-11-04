import * as THREE from "three";
import { VRDebugPanel } from "./VRDebugPanel";

interface Button3D {
  mesh: THREE.Mesh;
  label: string;
  action: () => void;
  hoverColor: number;
  normalColor: number;
}

interface Slider3D {
  group: THREE.Group;
  handle: THREE.Mesh;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  isDragging: boolean;
}

export class VRDebugGUI {
  private scene: THREE.Scene;
  private panel: THREE.Group;
  private buttons: Button3D[] = [];
  private sliders: Slider3D[] = [];
  private currentPage: "main" | "panel" | "camera" = "main";
  private debugPanel: VRDebugPanel;
  private camera: THREE.PerspectiveCamera;

  // 拖拽状态
  private draggedSlider: Slider3D | null = null;

  constructor(
    scene: THREE.Scene,
    debugPanel: VRDebugPanel,
    camera: THREE.PerspectiveCamera
  ) {
    this.scene = scene;
    this.debugPanel = debugPanel;
    this.camera = camera;

    this.panel = new THREE.Group();
    this.panel.position.set(-1.5, 3, -1); // 左前方
    this.scene.add(this.panel);

    this.createMainMenu();
  }

  private createMainMenu() {
    this.clearPanel();
    this.currentPage = "main";

    // 背景板
    const bg = this.createBackground(0.6, 0.6);
    this.panel.add(bg);

    // 标题
    const title = this.createText("VR 调试菜单", 0.05);
    title.position.set(0, 0.25, 0.05);
    this.panel.add(title);

    // 按钮
    const panelBtn = this.createButton("调试面板位置", 0, 0.1, () =>
      this.createPanelMenu()
    );
    const cameraBtn = this.createButton("摄像头控制", 0, -0.05, () =>
      this.createCameraMenu()
    );

    this.panel.add(panelBtn.mesh, cameraBtn.mesh);
    this.buttons.push(panelBtn, cameraBtn);
  }

  private createPanelMenu() {
    this.clearPanel();
    this.currentPage = "panel";

    const bg = this.createBackground(0.7, 1.0);
    this.panel.add(bg);

    const title = this.createText("调试面板位置", 0.04);
    title.position.set(0, 0.45, 0.05);
    this.panel.add(title);

    const debugMesh = this.debugPanel.getPanel();

    // 位置滑块
    const xSlider = this.createSlider(
      "X 位置",
      debugMesh.position.x,
      -5,
      5,
      0,
      0.3,
      (v) => {
        debugMesh.position.x = v;
      }
    );
    const ySlider = this.createSlider(
      "Y 位置",
      debugMesh.position.y,
      0,
      3,
      0,
      0.15,
      (v) => {
        debugMesh.position.y = v;
      }
    );
    const zSlider = this.createSlider(
      "Z 位置",
      debugMesh.position.z,
      -5,
      5,
      0,
      0,
      (v) => {
        debugMesh.position.z = v;
      }
    );

    this.panel.add(xSlider.group, ySlider.group, zSlider.group);
    this.sliders.push(xSlider, ySlider, zSlider);

    // 预设按钮
    const preset1 = this.createButton(
      "前方",
      -0.25,
      -0.2,
      () => {
        debugMesh.position.set(0, 1.6, -2);
        debugMesh.rotation.set(0, 0, 0);
        this.createPanelMenu(); // 刷新
      },
      0.15,
      0.08
    );

    const preset2 = this.createButton(
      "左侧",
      0.05,
      -0.2,
      () => {
        debugMesh.position.set(-2, 1.6, 0);
        debugMesh.rotation.set(0, Math.PI / 2, 0);
        this.createPanelMenu();
      },
      0.15,
      0.08
    );

    const preset3 = this.createButton(
      "右侧",
      -0.25,
      -0.32,
      () => {
        debugMesh.position.set(2, 1.6, 0);
        debugMesh.rotation.set(0, -Math.PI / 2, 0);
        this.createPanelMenu();
      },
      0.15,
      0.08
    );

    const preset4 = this.createButton(
      "上方",
      0.05,
      -0.32,
      () => {
        debugMesh.position.set(0, 2.5, 0);
        debugMesh.rotation.set(-Math.PI / 2, 0, 0);
        this.createPanelMenu();
      },
      0.15,
      0.08
    );

    this.panel.add(preset1.mesh, preset2.mesh, preset3.mesh, preset4.mesh);
    this.buttons.push(preset1, preset2, preset3, preset4);

    // 返回按钮
    const backBtn = this.createButton(
      "← 返回",
      0,
      -0.43,
      () => this.createMainMenu(),
      0.3,
      0.08
    );
    this.panel.add(backBtn.mesh);
    this.buttons.push(backBtn);
  }

  private createCameraMenu() {
    this.clearPanel();
    this.currentPage = "camera";

    const bg = this.createBackground(0.7, 1.0);
    this.panel.add(bg);

    const title = this.createText("摄像头控制", 0.04);
    title.position.set(0, 0.45, 0.05);
    this.panel.add(title);

    const getTarget = () => {
      return this.camera.parent?.name === "VRPlayerRig"
        ? this.camera.parent
        : this.camera;
    };

    const target = getTarget();

    // 位置滑块
    const xSlider = this.createSlider(
      "X 位置",
      target.position.x,
      -10,
      10,
      0,
      0.3,
      (v) => {
        getTarget().position.x = v;
      }
    );
    const ySlider = this.createSlider(
      "Y 位置",
      target.position.y,
      0,
      5,
      0,
      0.15,
      (v) => {
        getTarget().position.y = v;
      }
    );
    const zSlider = this.createSlider(
      "Z 位置",
      target.position.z,
      -10,
      10,
      0,
      0,
      (v) => {
        getTarget().position.z = v;
      }
    );

    this.panel.add(xSlider.group, ySlider.group, zSlider.group);
    this.sliders.push(xSlider, ySlider, zSlider);

    // 预设按钮
    const preset1 = this.createButton(
      "默认",
      -0.25,
      -0.2,
      () => {
        const t = getTarget();
        t.position.set(0, 1.6, 3);
        this.camera.rotation.set(0, 0, 0);
        this.createCameraMenu();
      },
      0.15,
      0.08
    );

    const preset2 = this.createButton(
      "俯视",
      0.05,
      -0.2,
      () => {
        const t = getTarget();
        t.position.set(0, 5, 0);
        this.camera.rotation.set(-Math.PI / 2, 0, 0);
        this.createCameraMenu();
      },
      0.15,
      0.08
    );

    const preset3 = this.createButton(
      "远景",
      -0.25,
      -0.32,
      () => {
        const t = getTarget();
        t.position.set(0, 2, 8);
        this.camera.rotation.set(0, 0, 0);
        this.createCameraMenu();
      },
      0.15,
      0.08
    );

    this.panel.add(preset1.mesh, preset2.mesh, preset3.mesh);
    this.buttons.push(preset1, preset2, preset3);

    // 返回按钮
    const backBtn = this.createButton(
      "← 返回",
      0,
      -0.43,
      () => this.createMainMenu(),
      0.3,
      0.08
    );
    this.panel.add(backBtn.mesh);
    this.buttons.push(backBtn);
  }

  private createBackground(width: number, height: number): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x1a1a1a,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
    return new THREE.Mesh(geo, mat);
  }

  private createText(text: string, size: number): THREE.Mesh {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${size * 1000}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const geo = new THREE.PlaneGeometry(0.5, 0.125);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(geo, mat);
  }

  private createButton(
    label: string,
    x: number,
    y: number,
    action: () => void,
    width = 0.3,
    height = 0.08
  ): Button3D {
    const geo = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3366cc,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, 0.02);
    mesh.userData.interactive = true;
    mesh.userData.type = "button";

    // 文字
    const text = this.createText(label, 0.03);
    text.position.set(x, y, 0.03);
    this.panel.add(text);

    return {
      mesh,
      label,
      action,
      normalColor: 0x3366cc,
      hoverColor: 0x5588ee,
    };
  }

  private createSlider(
    label: string,
    value: number,
    min: number,
    max: number,
    x: number,
    y: number,
    onChange: (value: number) => void
  ): Slider3D {
    const group = new THREE.Group();
    group.position.set(x, y, 0.02);

    // 标签
    const labelMesh = this.createText(label, 0.025);
    labelMesh.position.set(-0.15, 0.05, 0);
    group.add(labelMesh);

    // 轨道
    const trackGeo = new THREE.PlaneGeometry(0.4, 0.02);
    const trackMat = new THREE.MeshBasicMaterial({ color: 0x444444 });
    const track = new THREE.Mesh(trackGeo, trackMat);
    track.position.set(0.1, 0, 0);
    group.add(track);

    // 滑块手柄
    const handleGeo = new THREE.PlaneGeometry(0.03, 0.06);
    const handleMat = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
    const handle = new THREE.Mesh(handleGeo, handleMat);

    // 计算初始位置
    const normalized = (value - min) / (max - min);
    handle.position.set(-0.1 + normalized * 0.4, 0, 0.01);
    group.add(handle);

    handle.userData.interactive = true;
    handle.userData.type = "slider";

    // 值显示
    const valueMesh = this.createText(value.toFixed(1), 0.02);
    valueMesh.position.set(0.1, -0.05, 0);
    group.add(valueMesh);

    return {
      group,
      handle,
      label,
      value,
      min,
      max,
      onChange,
      isDragging: false,
    };
  }

  // 处理VR控制器交互
  public handleControllerSelect(controller: THREE.Group) {
    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    // 检查按钮
    for (const button of this.buttons) {
      const intersects = raycaster.intersectObject(button.mesh);
      if (intersects.length > 0) {
        button.action();
        return;
      }
    }

    // 检查滑块
    for (const slider of this.sliders) {
      const intersects = raycaster.intersectObject(slider.handle);
      if (intersects.length > 0) {
        slider.isDragging = true;
        this.draggedSlider = slider;
        return;
      }
    }
  }

  public handleControllerRelease() {
    if (this.draggedSlider) {
      this.draggedSlider.isDragging = false;
      this.draggedSlider = null;
    }
  }

  public handleControllerMove(controller: THREE.Group) {
    if (!this.draggedSlider) return;

    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    // 与滑块平面相交
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    plane.applyMatrix4(this.draggedSlider.group.matrixWorld);

    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);

    if (intersection) {
      // 转换到滑块局部坐标
      this.draggedSlider.group.worldToLocal(intersection);

      // 限制在轨道范围内
      const x = THREE.MathUtils.clamp(intersection.x, -0.1, 0.3);
      this.draggedSlider.handle.position.x = x;

      // 计算值
      const normalized = (x + 0.1) / 0.4;
      const value =
        this.draggedSlider.min +
        normalized * (this.draggedSlider.max - this.draggedSlider.min);
      this.draggedSlider.value = value;
      this.draggedSlider.onChange(value);

      // 更新值显示
      const valueMesh = this.draggedSlider.group.children.find(
        (c) => c.position.y === -0.05
      ) as THREE.Mesh;
      if (valueMesh) {
        this.draggedSlider.group.remove(valueMesh);
        const newValue = this.createText(value.toFixed(1), 0.02);
        newValue.position.set(0.1, -0.05, 0);
        this.draggedSlider.group.add(newValue);
      }
    }
  }

  // 高亮悬停的按钮
  public handleControllerHover(controller: THREE.Group) {
    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);

    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    // 重置所有按钮颜色
    for (const button of this.buttons) {
      (button.mesh.material as THREE.MeshBasicMaterial).color.setHex(
        button.normalColor
      );
    }

    // 检查悬停
    for (const button of this.buttons) {
      const intersects = raycaster.intersectObject(button.mesh);
      if (intersects.length > 0) {
        (button.mesh.material as THREE.MeshBasicMaterial).color.setHex(
          button.hoverColor
        );
      }
    }
  }

  private clearPanel() {
    // 递归清理所有子元素
    const disposeNode = (node: THREE.Object3D) => {
      if (node instanceof THREE.Mesh) {
        node.geometry?.dispose();
        if (node.material) {
          if (Array.isArray(node.material)) {
            node.material.forEach((m) => m.dispose());
          } else {
            node.material.dispose();
          }
        }
      }
      // 递归清理子节点
      [...node.children].forEach((child) => disposeNode(child));
    };

    [...this.panel.children].forEach((child) => {
      disposeNode(child);
      this.panel.remove(child);
    });

    this.buttons = [];
    this.sliders = [];
  }

  public show() {
    this.panel.visible = true;
  }

  public hide() {
    this.panel.visible = false;
  }

  public toggle() {
    this.panel.visible = !this.panel.visible;
  }

  public setPosition(x: number, y: number, z: number) {
    this.panel.position.set(x, y, z);
  }

  public getCurrentPage() {
    return this.currentPage;
  }

  public dispose() {
    this.clearPanel();
    this.scene.remove(this.panel);
  }
}
