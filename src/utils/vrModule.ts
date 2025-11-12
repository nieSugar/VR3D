import * as THREE from 'three';
import type { WebGLRenderer } from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import type GUI from 'lil-gui';

// ========== 类型定义 ==========
export interface VRController {
  controller: THREE.Group;
  controllerGrip: THREE.Group;
  line: THREE.Line;
}

export interface GamepadState {
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

// ========== VR 管理器类 ==========
export class VRManager {
  // 渲染器和场景
  private renderer: WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: any; // OrbitControls 类型
  private gui?: GUI;
  
  // VR 相关对象
  public vrPlayerRig: THREE.Group;
  public ground: THREE.Mesh;
  private controllerModelFactory: XRControllerModelFactory;
  public vrControllers: VRController[] = [];
  
  // 按键状态跟踪
  private prevButtonStates: Map<string, boolean[]> = new Map();
  
  // 游戏逻辑变量
  public grabbedObject: THREE.Object3D | null = null;
  public grabHand: 'vr-left' | 'vr-right' | 'desktop' | null = null;
  public verticalVelocity = 0;
  private readonly gravity = -0.008;
  private readonly jumpStrength = 0.15;
  public groundLevel = 0;
  
  // 按键名称映射（Quest 手柄）
  private readonly buttonNames = {
    0: 'Trigger',      // 0: 扳机
    1: 'Squeeze',      // 1: 侧键
    3: 'Thumbstick',   // 3: 摇杆按下
    4: 'X/A',          // 4: X键(左手) 或 A键(右手)
    5: 'Y/B',          // 5: Y键(左手) 或 B键(右手)
    12: 'Menu',        // 12: 菜单键
  };
  
  // 游戏逻辑回调
  private gameLogic: {
    handleSelectStart: (position: THREE.Vector3, direction: THREE.Vector3, hand: string) => void;
    handleSelectEnd: (hand: string) => void;
    handleGrabStart: (position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right', controller?: THREE.Group) => void;
    handleGrabEnd: (hand: string, controller?: THREE.Group) => void;
    handleMove: (delta: THREE.Vector2) => void;
    handleJump: () => void;
  };

  constructor(
    renderer: WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    controls: any,
    mesh: THREE.Mesh,
    gui?: GUI
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.controls = controls;
    this.gui = gui;
    this.controllerModelFactory = new XRControllerModelFactory();
    
    // 初始化 VR Player Rig
    this.vrPlayerRig = new THREE.Group();
    this.vrPlayerRig.name = 'VRPlayerRig';
    this.vrPlayerRig.position.set(0, 1.6, 0); // VR玩家眼睛高度约1.6米
    
    // 添加地面
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d2d44,
      roughness: 0.8,
      metalness: 0.2
    });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0;
    this.ground.receiveShadow = true;
    
    // 初始化游戏逻辑
    this.gameLogic = this.createGameLogic(mesh);
  }
  
  // 创建游戏逻辑
  private createGameLogic(mesh: THREE.Mesh) {
    return {
      handleSelectStart: (position: THREE.Vector3, direction: THREE.Vector3, hand: string) => {
        console.log(`[${hand}] 选择开始`);
        const raycaster = new THREE.Raycaster(position, direction);
        const intersections = raycaster.intersectObject(mesh, true);
        if (intersections.length > 0 && intersections[0]?.object) {
          const hitObject = intersections[0].object;
          console.log(`命中: ${hitObject.name || hitObject.type}`);
        }
      },

      handleSelectEnd: (hand: string) => {
        console.log(`[${hand}] 选择结束`);
      },

      handleGrabStart: (position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right', controller?: THREE.Group) => {
        console.log(`[${hand}] 抓取开始`);
        const raycaster = new THREE.Raycaster(position, direction);
        const intersections = raycaster.intersectObject(mesh, true);

        if (intersections.length > 0 && intersections[0]?.object) {
          this.grabbedObject = intersections[0].object;
          this.grabHand = controller ? `vr-${hand}` : 'desktop';
          console.log(`已抓取: ${this.grabbedObject.name || this.grabbedObject.type}`);

          if (controller) {
            controller.attach(this.grabbedObject);
          }
        }
      },

      handleGrabEnd: (hand: string, controller?: THREE.Group) => {
        console.log(`[${hand}] 抓取结束`);

        if (this.grabbedObject) {
          if (controller) {
            const attachedObject = controller.children.find(
              (child) => child.type === 'Mesh' && child.name !== 'line'
            );
            if (attachedObject) {
              this.scene.attach(attachedObject as THREE.Object3D);
            }
          }

          console.log('已释放物体');
          this.grabbedObject = null;
          this.grabHand = null;
        }
      },

      handleMove: (delta: THREE.Vector2) => {
        const speed = 0.05;
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.camera.quaternion);
        direction.y = 0;
        direction.normalize();

        const strafe = new THREE.Vector3(-direction.z, 0, direction.x);
        const target = this.camera.parent || this.camera;
        target.position.addScaledVector(direction, -delta.y * speed);
        target.position.addScaledVector(strafe, delta.x * speed);
      },

      handleJump: () => {
        const target = this.camera.parent || this.camera;
        if (target.position.y <= this.groundLevel) {
          this.verticalVelocity = this.jumpStrength;
          console.log('跳跃!');
        }
      },
    };
  }
  
  // 初始化 VR
  public initialize(container: HTMLDivElement): void {
    // 启用 XR
    this.renderer.xr.enabled = true;
    
    // 添加 VR 按钮
    container.appendChild(VRButton.createButton(this.renderer));
    
    // 添加 VR Player Rig 和地面到场景
    this.scene.add(this.vrPlayerRig);
    this.scene.add(this.ground);
    
    // 创建两个 VR 控制器
    this.vrControllers.push(this.createVRController(0));
    this.vrControllers.push(this.createVRController(1));
    
    // 监听 VR 会话变化
    this.setupVRSessionListeners();
  }
  
  // 创建 VR 控制器
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
  
  // VR 控制器事件处理
  private handleVRSelectStart(controller: THREE.Group, index: number): void {
    const hand = index === 0 ? 'left' : 'right';
    const pos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.quaternion);
    this.gameLogic.handleSelectStart(pos, dir, `vr-${hand}`);
  }

  private handleVRSelectEnd(_controller: THREE.Group, index: number): void {
    const hand = index === 0 ? 'left' : 'right';
    this.gameLogic.handleSelectEnd(`vr-${hand}`);
  }

  private handleVRSqueezeStart(controller: THREE.Group, index: number): void {
    const hand = index === 0 ? 'left' : 'right';
    const pos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.quaternion);
    this.gameLogic.handleGrabStart(pos, dir, hand, controller);
  }

  private handleVRSqueezeEnd(controller: THREE.Group, index: number): void {
    const hand = index === 0 ? 'left' : 'right';
    this.gameLogic.handleGrabEnd(hand, controller);
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
      axes: gamepad.axes,
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
  
  // 设置 VR 会话监听器
  private setupVRSessionListeners(): void {
    this.renderer.xr.addEventListener('sessionstart', () => {
      console.log('✓ 已进入 VR 模式');

      // 禁用 OrbitControls
      this.controls.enabled = false;

      // 隐藏 GUI（VR 模式下不需要）
      if (this.gui) {
        this.gui.hide();
      }

      // 进入 VR：将相机从场景移到 rig 中
      const worldPos = new THREE.Vector3();
      this.camera.getWorldPosition(worldPos);

      this.scene.remove(this.camera);
      this.vrPlayerRig.position.copy(worldPos);
      this.vrPlayerRig.add(this.camera);

      // 相机在 rig 内的局部位置归零（头显会控制相对位置）
      this.camera.position.set(0, 0, 0);

      // 将控制器移动到 VR Player Rig
      this.moveControllersToParent(this.vrPlayerRig);
      console.log('手柄已绑定到玩家');
    });

    this.renderer.xr.addEventListener('sessionend', () => {
      console.log('✓ 已切换到桌面模式');

      // 重新启用 OrbitControls
      this.controls.enabled = true;

      // 显示 GUI
      if (this.gui) {
        this.gui.show();
      }

      // 退出 VR：将相机从 rig 移回场景
      const worldPos = new THREE.Vector3();
      this.camera.getWorldPosition(worldPos);

      this.vrPlayerRig.remove(this.camera);
      this.scene.add(this.camera);
      this.camera.position.copy(worldPos);

      // 重置 rig 位置供下次使用
      this.vrPlayerRig.position.set(0, 1.6, 0);

      // 将控制器移回场景
      this.moveControllersToParent(this.scene);
    });
  }
  
  // 更新 VR 逻辑（在动画循环中调用）
  public update(): void {
    // 应用重力和垂直速度
    const target = this.camera.parent || this.camera;
    this.verticalVelocity += this.gravity;
    target.position.y += this.verticalVelocity;

    // 地面碰撞检测
    if (target.position.y < this.groundLevel) {
      target.position.y = this.groundLevel;
      this.verticalVelocity = 0;
    }

    // VR 模式：处理摇杆输入和按键
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
            console.log(`[${hand}] ${btnName} 按下 ${btnIndex}`);

            // A键跳跃（右手按钮4）
            if (hand === 'Right' && btnIndex === 4) {
              this.gameLogic.handleJump();
            }
          }
          // 释放事件
          else if (!isPressed && wasPressed) {
            const btnName = this.buttonNames[btnIndex as keyof typeof this.buttonNames] || `Button${btnIndex}`;
            console.log(`[${hand}] ${btnName} 释放 ${btnIndex}`);
          }
        });

        // 保存当前状态
        this.prevButtonStates.set(hand, gamepad.buttons.map(b => b.pressed));

        // 摇杆移动（右手）
        if (index === 1) {
          const deadzone = 0.15;
          if (Math.abs(gamepad.thumbstickX) > deadzone || Math.abs(gamepad.thumbstickY) > deadzone) {
            this.gameLogic.handleMove(new THREE.Vector2(gamepad.thumbstickX, gamepad.thumbstickY));
          }
        }
      }
    });
  }
}
