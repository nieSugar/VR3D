import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { VRDebugPanel } from './VRDebugPanel';

// VR控制器接口定义
interface VRController {
  controller: THREE.Group;
  controllerGrip: THREE.Group;
  line: THREE.Line;
}

// 游戏手柄状态接口
interface GamepadState {
  buttons: Array<{
    pressed: boolean;
    touched: boolean;
    value: number;
  }>;
  axes: number[];
  trigger: number;
  squeeze: number;
  thumbstickX: number;
  thumbstickY: number;
  touchpadX: number;
  touchpadY: number;
}

  // 游戏逻辑回调接口
interface GameLogicCallbacks {
  handleSelectStart?: (position: THREE.Vector3, direction: THREE.Vector3, hand: string) => void;
  handleSelectEnd?: (hand: string) => void;
  handleGrabStart?: (position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right', controller?: THREE.Group, grabbedObject?: THREE.Object3D | null) => THREE.Object3D | null;
  handleGrabEnd?: (hand: string, controller?: THREE.Group, grabbedObject?: THREE.Object3D | null) => void;
  handleJump?: () => void;
  handleMove?: (delta: THREE.Vector2) => void;
}

// VR 边界接口
interface VRBoundary {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

// VR管理器配置接口
interface VRManagerConfig {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  framebufferScale?: number;
  playerHeight?: number;
  controls?: OrbitControls;
  gui?: GUI;
  mesh?: THREE.Mesh;
  debugPanel?: VRDebugPanel;
  testObjects?: THREE.Mesh[];
  caeModelCenter?: THREE.Vector3;
  caeViewDistance?: number;
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
  gameLogic?: GameLogicCallbacks;
}

// VR管理器类
export class VRManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls?: OrbitControls;
  private gui?: GUI;
  private mesh?: THREE.Mesh;
  private debugPanel?: VRDebugPanel;
  private testObjects?: THREE.Mesh[];
  private caeModelCenter: THREE.Vector3;
  private caeViewDistance: number;
  private playerHeight: number;
  private boundary: VRBoundary | null = null;
  public isMovementEnabled: boolean = true; // 控制是否允许移动

  // VR相关变量
  private vrPlayerRig: THREE.Group;
  private ground: THREE.Mesh | null = null;
  private controllerModelFactory: XRControllerModelFactory;
  private vrControllers: VRController[] = [];
  private prevButtonStates: Map<string, boolean[]> = new Map();
  
  // 游戏逻辑变量
  private verticalVelocity = 0;
  private readonly gravity = -0.02;
  private readonly jumpStrength = 0.25;
  private readonly groundLevel = 0;

  // 按键名称映射（Quest手柄）
  private readonly buttonNames = {
    0: 'Trigger',      // 扳机
    1: 'Squeeze',      // 侧键
    3: 'Thumbstick',   // 摇杆按下
    4: 'X/A',          // X键(左手) 或 A键(右手)
    5: 'Y/B',          // Y键(左手) 或 B键(右手)
    12: 'Menu',        // 菜单键
  };

  // 用户自定义回调
  private onSessionStart?: () => void;
  private onSessionEnd?: () => void;

  constructor(config: VRManagerConfig) {
    this.renderer = config.renderer;
    this.scene = config.scene;
    this.camera = config.camera;
    this.controls = config.controls;
    this.gui = config.gui;
    this.mesh = config.mesh;
    this.debugPanel = config.debugPanel;
    this.testObjects = config.testObjects;
    this.caeModelCenter = config.caeModelCenter || new THREE.Vector3(0, 0, 0);
    this.caeViewDistance = config.caeViewDistance || 5;
    this.playerHeight = config.playerHeight ?? 1.6;
    this.onSessionStart = config.onSessionStart;
    this.onSessionEnd = config.onSessionEnd;

    this.controllerModelFactory = new XRControllerModelFactory();
    
    // 初始化VR Player Rig
    this.vrPlayerRig = new THREE.Group();
    this.vrPlayerRig.name = 'VRPlayerRig';
    this.vrPlayerRig.position.set(3, this.getMinHeight(true), 3); // 初始位置稍微远一点，面向场景中心
    this.scene.add(this.vrPlayerRig);

    // 启用VR
    this.renderer.xr.enabled = true;
    if (config.framebufferScale) {
      this.renderer.xr.setFramebufferScaleFactor(Math.max(1, config.framebufferScale));
    }
  }

  // 更新模型引用和相关参数
  public updateMesh(mesh: THREE.Mesh): void {
    this.mesh = mesh;
  }

  // 更新模型中心和观察距离
  public updateModelParams(center: THREE.Vector3, viewDistance: number): void {
    this.caeModelCenter.copy(center);
    this.caeViewDistance = viewDistance;
  }

  // 初始化VR系统
  public init(container: HTMLElement): void {
    // 添加VR按钮
    container.appendChild(VRButton.createButton(this.renderer));

    // 创建地面
    // this.createGround();

    // 创建VR控制器
    this.vrControllers.push(this.createVRController(0));
    this.vrControllers.push(this.createVRController(1));

    // 监听VR会话变化
    this.setupVRSessionListeners();
  }

  // 创建地面
  private createGround(): void {
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d2d44,
      roughness: 0.8,
      metalness: 0.2
    });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.name = 'Vr-Manager-Ground';
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
  }

  // 创建VR控制器
  private createVRController(index: number): VRController {
    const controller = this.renderer.xr.getController(index);

    // 创建控制器射线
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const material = new THREE.LineBasicMaterial({ color: 0x00ffff });
    const line = new THREE.Line(geometry, material);
    line.name = 'line';
    line.scale.z = 5;
    controller.add(line);
    this.scene.add(controller);

    // 控制器模型
    const controllerGrip = this.renderer.xr.getControllerGrip(index);
    const model = this.controllerModelFactory.createControllerModel(controllerGrip);
    controllerGrip.add(model);
    this.scene.add(controllerGrip);

    // 绑定控制器事件
    controller.addEventListener('selectstart', () => {
      this.handleVRSelectStart(controller, index);
    });
    controller.addEventListener('selectend', () => {
      this.handleVRSelectEnd(controller, index);
    });
    controller.addEventListener('squeezestart', () => {
      this.handleVRSqueezeStart(controller, index);
    });
    controller.addEventListener('squeezeend', () => {
      this.handleVRSqueezeEnd(controller, index);
    });
    
    return { controller, controllerGrip, line };
  }

  // 获取控制器游戏手柄状态
  private getGamepadState(index: number): GamepadState | null {
    const session = this.renderer.xr.getSession();
    if (!session) return null;
    const inputSource = session.inputSources[index];
    if (!inputSource?.gamepad) return null;
    const gamepad = inputSource.gamepad;
    
    return {
      buttons: gamepad.buttons.map(button => ({
        pressed: button.pressed,
        touched: button.touched,
        value: button.value,
      })),
      axes: Array.from(gamepad.axes),
      trigger: gamepad.buttons[0]?.value || 0,
      squeeze: gamepad.buttons[1]?.value || 0,
      thumbstickX: gamepad.axes[2] || 0,
      thumbstickY: gamepad.axes[3] || 0,
      touchpadX: gamepad.axes[0] || 0,
      touchpadY: gamepad.axes[1] || 0,
    };
  }

  // 将控制器移动到新父对象
  private moveControllersToParent(parent: THREE.Object3D): void {
    this.vrControllers.forEach(({ controller, controllerGrip }) => {
      if (controller.parent) controller.parent.remove(controller);
      if (controllerGrip.parent) controllerGrip.parent.remove(controllerGrip);
      parent.add(controller);
      parent.add(controllerGrip);
    });
  }

  // 获取当前最低高度（VR 模式下使用玩家高度）
  private getMinHeight(isVR: boolean = this.renderer.xr.isPresenting): number {
    return isVR ? Math.max(this.groundLevel, this.playerHeight) : this.groundLevel;
  }

  // VR控制器事件处理
  private handleVRSelectStart(controller: THREE.Group, index: number): void {
    const hand = index === 0 ? 'left' : 'right';
    const pos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.quaternion);
    this.handleSelectStart(pos, dir, `vr-${hand}`);
  }

  private handleVRSelectEnd(_controller: THREE.Group, index: number): void {
    const hand = index === 0 ? 'left' : 'right';
    this.handleSelectEnd(`vr-${hand}`);
  }

  private handleVRSqueezeStart(_controller: THREE.Group, _index: number): void {
    // const hand = index === 0 ? 'left' : 'right';
    // const pos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    // const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.quaternion);
    // this.handleGrabStart(pos, dir, hand as 'left' | 'right', controller);
  }

  private handleVRSqueezeEnd(_controller: THREE.Group, _index: number): void {
    // const hand = index === 0 ? 'left' : 'right';
    // this.handleGrabEnd(hand, controller);
  }

  // 游戏逻辑处理
  private handleSelectStart(position: THREE.Vector3, direction: THREE.Vector3, hand: string): void {
    this.log(`[${hand}] 选择开始`);
    
    // 首先检查是否有测试物体
    const raycaster = new THREE.Raycaster(position, direction);
    
    if (this.testObjects) {
      const intersections = raycaster.intersectObjects(this.testObjects, false);
      if (intersections.length > 0 && intersections[0]?.object) {
        const hitObject = intersections[0].object;
        this.log(`命中测试物体: ${hitObject.name || hitObject.type}`);
        return;
      }
    }
    
    // 然后检查 CAE 模型
    if (this.mesh) {
      const intersections = raycaster.intersectObject(this.mesh, true);
      if (intersections.length > 0 && intersections[0]?.object) {
        const hitObject = intersections[0].object;
        this.log(`命中: ${hitObject.name || hitObject.type}`);
      }
    }
  }

  private handleSelectEnd(hand: string): void {
    this.log(`[${hand}] 选择结束`);
  }

  private handleMove(delta: THREE.Vector2, controllerIndex: number = 0): void {
    const speed = 0.15;
    const direction = new THREE.Vector3();
    
    // 优先使用左手控制器的朝向（Controller-Directed，更直观）
    const leftController = this.vrControllers[controllerIndex]?.controller;
    if (leftController) {
      // 获取控制器的前方方向（局部 -Z 轴在世界坐标中的方向）
      direction.set(0, 0, -1);
      leftController.getWorldDirection(direction);
    } else {
      // 回退到头部朝向
      this.camera.getWorldDirection(direction);
    }
    
    // 强制水平移动
    direction.y = 0;
    
    // 防止零向量（比如控制器正好垂直指向上/下）
    if (direction.lengthSq() < 0.0001) {
      // 使用相机朝向作为后备
      this.camera.getWorldDirection(direction);
      direction.y = 0;
      if (direction.lengthSq() < 0.0001) {
        direction.set(0, 0, -1);
      }
    }
    
    direction.normalize();

    // 右方向：在 XZ 平面上，direction 逆时针旋转 90° 得到左边，(-dz, dx) 实际是右边
    const strafe = new THREE.Vector3(-direction.z, 0, direction.x);
    const target = this.camera.parent || this.camera;
    
    // 向前推摇杆(Y=-1) → 向 direction 反方向移动（控制器指向的方向）
    target.position.addScaledVector(direction, delta.y * speed);
    target.position.addScaledVector(strafe, -delta.x * speed);

    // 边界检查
    if (this.boundary) {
      target.position.x = Math.max(this.boundary.minX, Math.min(this.boundary.maxX, target.position.x));
      target.position.z = Math.max(this.boundary.minZ, Math.min(this.boundary.maxZ, target.position.z));
    }
  }

  private handleJump(): void {
    const target = this.camera.parent || this.camera;
    const minHeight = this.getMinHeight();
    if (target.position.y <= minHeight) {
      this.verticalVelocity = this.jumpStrength;
      this.log('跳跃!');
    }
  }

  // 日志记录方法
  private log(message: string): void {
    if (this.debugPanel) {
      this.debugPanel.log(message);
    } else {
      console.log(message);
    }
  }

  // 设置VR会话监听器
  private setupVRSessionListeners(): void {
    this.renderer.xr.addEventListener('sessionstart', () => {
      this.log('✓ 已进入 VR 模式');

      // 禁用 OrbitControls
      if (this.controls) {
        this.controls.enabled = false;
      }

      // 隐藏 GUI（VR模式下不需要）
      if (this.gui) {
        this.gui.hide();
      }

      // 隐藏 debugPanel（如果存在）
      if (this.debugPanel) {
        this.debugPanel.hide();
      }

      // 进入VR：将相机从场景移到rig中
      const worldPos = new THREE.Vector3();
      this.camera.getWorldPosition(worldPos);

      this.scene.remove(this.camera);
      
      // 计算合适的观看位置
      if (this.mesh) {
        // 让玩家站在CAE模型前合适的距离
        const viewPos = this.caeModelCenter.clone();
        viewPos.z += this.caeViewDistance;
        const minVRHeight = this.getMinHeight(true);
        viewPos.y = Math.max(viewPos.y, minVRHeight);
        this.vrPlayerRig.position.copy(viewPos);
        this.log(`VR 玩家位置: ${viewPos.x.toFixed(1)}, ${viewPos.y.toFixed(1)}, ${viewPos.z.toFixed(1)}`);
      } else {
        const minVRHeight = this.getMinHeight(true);
        this.vrPlayerRig.position.set(worldPos.x, Math.max(worldPos.y, minVRHeight), worldPos.z);
      }
      
      this.vrPlayerRig.add(this.camera);

      // 相机在rig内的局部位置归零（头显会控制相对位置）
      this.camera.position.set(0, 0, 0);

      // 将控制器移动到VR Player Rig
      this.moveControllersToParent(this.vrPlayerRig);
      this.log('手柄已绑定到玩家');

      // 调用用户自定义回调
      this.onSessionStart?.();
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      this.log('✓ 已切换到桌面模式');

      // 重新启用 OrbitControls
      if (this.controls) {
        this.controls.enabled = true;
      }

      // 显示 GUI
      if (this.gui) {
        this.gui.show();
      }

      // 显示 debugPanel（如果存在）
      if (this.debugPanel) {
        this.debugPanel.show();
      }

      // 退出VR：将相机从rig移回场景
      const worldPos = new THREE.Vector3();
      this.camera.getWorldPosition(worldPos);

      this.vrPlayerRig.remove(this.camera);
      this.scene.add(this.camera);
      this.camera.position.copy(worldPos);

      // 重置rig位置供下次使用
      this.vrPlayerRig.position.set(0, 0, 0);

      // 将控制器移回场景
      this.moveControllersToParent(this.scene);

      // 调用用户自定义回调
      this.onSessionEnd?.();
    });
  }

  // 更新VR状态（在动画循环中调用）
  public update(): void {
    // 应用重力和垂直速度
    const target = this.camera.parent || this.camera;
    const minHeight = this.getMinHeight();
    this.verticalVelocity += this.gravity;
    target.position.y += this.verticalVelocity;

    // 地面碰撞检测
    if (target.position.y < minHeight) {
      target.position.y = minHeight;
      this.verticalVelocity = 0;
    }

    // VR模式：处理摇杆输入和按键
    [0, 1].forEach(index => {
      const hand = index === 0 ? 'Left' : 'Right';
      const gamepad = this.getGamepadState(index);

      if (gamepad) {
        const prevState = this.prevButtonStates.get(hand) || [];

        // 检测每个按键变化
        gamepad.buttons.forEach((button, btnIndex) => {
          const wasPressed = prevState[btnIndex] || false;
          const isPressed = button.pressed;

        // 按下事件
        if (isPressed && !wasPressed) {
          const btnName = this.buttonNames[btnIndex as keyof typeof this.buttonNames] || `Button${btnIndex}`;
          this.log(`[${hand}] ${btnName} 按下 ${btnIndex}`);

          // A键跳跃（右手按钮4）
          if (hand === 'Right' && btnIndex === 4) {
            this.handleJump();
          }
        }
        // 释放事件
        else if (!isPressed && wasPressed) {
          const btnName = this.buttonNames[btnIndex as keyof typeof this.buttonNames] || `Button${btnIndex}`;
          this.log(`[${hand}] ${btnName} 释放 ${btnIndex}`);
        }
        });

        // 保存当前状态
        this.prevButtonStates.set(hand, gamepad.buttons.map(b => b.pressed));

        // 摇杆移动 - 左右手摇杆都可以移动，方向由对应控制器朝向决定
        if (this.isMovementEnabled) {
          const deadzone = 0.2;
          // 应用死区并归一化
          let x = Math.abs(gamepad.thumbstickX) > deadzone ? gamepad.thumbstickX : 0;
          let y = Math.abs(gamepad.thumbstickY) > deadzone ? gamepad.thumbstickY : 0;
          
          if (x !== 0 || y !== 0) {
            const delta = new THREE.Vector2(x, y);
            // 归一化防止对角线移动过快，但保留摇杆推动幅度
            const length = delta.length();
            if (length > 1) {
              delta.divideScalar(length);
            }
            this.handleMove(delta, index);
          }
        }
      }
    });
  }

  // 更新网格对象（用于射线检测）
  public setMesh(mesh: THREE.Mesh): void {
    this.mesh = mesh;
  }

  // 更新控制器（用于切换VR模式时禁用/启用）
  public setControls(controls: OrbitControls): void {
    this.controls = controls;
  }

  // 更新GUI（用于切换VR模式时隐藏/显示）
  public setGUI(gui: GUI): void {
    this.gui = gui;
  }

  // 更新debugPanel
  public setDebugPanel(debugPanel: VRDebugPanel): void {
    this.debugPanel = debugPanel;
  }

  // 设置测试物体
  public setTestObjects(testObjects: THREE.Mesh[]): void {
    this.testObjects = testObjects;
  }

  // 设置CAE模型中心和观看距离
  public setCaeModelInfo(center: THREE.Vector3, distance: number): void {
    this.caeModelCenter = center;
    this.caeViewDistance = distance;
  }

  // 设置 VR 玩家基准高度
  public setPlayerHeight(height: number): void {
    this.playerHeight = Math.max(height, 0);
    if (this.renderer.xr.isPresenting) {
      const target = this.camera.parent || this.camera;
      const minHeight = this.getMinHeight(true);
      target.position.y = Math.max(target.position.y, minHeight);
    }
  }

  // 设置移动边界
  public setBoundary(boundary: VRBoundary): void {
    this.boundary = boundary;
    this.log(`边界已设置: X[${boundary.minX.toFixed(1)}, ${boundary.maxX.toFixed(1)}], Z[${boundary.minZ.toFixed(1)}, ${boundary.maxZ.toFixed(1)}]`);
  }

  // 清理资源
  public dispose(): void {
    // 移除事件监听器
    this.renderer.xr.removeEventListener('sessionstart', () => {});
    this.renderer.xr.removeEventListener('sessionend', () => {});

    // 清理控制器
    this.vrControllers.forEach(({ controller, controllerGrip }) => {
      this.scene.remove(controller);
      this.scene.remove(controllerGrip);
    });

    // 清理地面
    if (this.ground) {
      this.scene.remove(this.ground);
    }

    // 清理VR Player Rig
    this.scene.remove(this.vrPlayerRig);
  }
}

// 导出VRButton供外部使用
export { VRButton };
