import * as THREE from "three";
import { XRControllerModelFactory } from "three/examples/jsm/webxr/XRControllerModelFactory.js";

export interface VRController {
  controller: THREE.Group;
  controllerGrip: THREE.Group;
  line: THREE.Line;
}

export interface VRControllersOptions {
  onSelectStart?: (controller: THREE.Group, index: number) => void;
  onSelectEnd?: (controller: THREE.Group, index: number) => void;
  onSqueezeStart?: (controller: THREE.Group, index: number) => void;
  onSqueezeEnd?: (controller: THREE.Group, index: number) => void;
}

export function useVRControllers(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  options: VRControllersOptions = {}
) {
  const controllers: VRController[] = [];
  const controllerModelFactory = new XRControllerModelFactory();
  
  // 查找 VR Player Rig（如果存在）
  const getControllerParent = () => {
    const rig = scene.getObjectByName('VRPlayerRig')
    return rig || scene
  }

  function createController(index: number): VRController {
    // 控制器（用于交互）
    const controller = renderer.xr.getController(index);

    // 选择事件（扳机键）
    controller.addEventListener("selectstart", () => {
      options.onSelectStart?.(controller, index);
    });
    controller.addEventListener("selectend", () => {
      options.onSelectEnd?.(controller, index);
    });

    // 抓取事件（侧键）
    controller.addEventListener("squeezestart", () => {
      options.onSqueezeStart?.(controller, index);
    });
    controller.addEventListener("squeezeend", () => {
      options.onSqueezeEnd?.(controller, index);
    });

    // 创建控制器射线
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const material = new THREE.LineBasicMaterial({ color: 0x00ffff });
    const line = new THREE.Line(geometry, material);
    line.name = "line";
    line.scale.z = 5;
    controller.add(line);

    // 添加到 VR Rig（如果存在）或场景
    const parent = getControllerParent()
    parent.add(controller);

    // 控制器模型（用于显示手柄）
    const controllerGrip = renderer.xr.getControllerGrip(index);
    const model = controllerModelFactory.createControllerModel(controllerGrip);
    controllerGrip.add(model);
    parent.add(controllerGrip);

    return {
      controller,
      controllerGrip,
      line,
    };
  }

  // 创建两个控制器（左右手）0通常是右手，1通常是左手
  controllers.push(createController(0));
  controllers.push(createController(1));

  // 获取控制器的游戏手柄输入状态
  function getGamepadState(index: number) {
    const session = renderer.xr.getSession();
    if (!session) return null;

    const inputSource = session.inputSources[index];
    if (!inputSource?.gamepad) return null;

    const gamepad = inputSource.gamepad;

    return {
      // 按钮状态
      buttons: gamepad.buttons.map((button) => ({
        pressed: button.pressed,
        touched: button.touched,
        value: button.value,
      })),
      // 摇杆/触摸板状态
      axes: gamepad.axes,
      // 常用按钮快捷方式
      trigger: gamepad.buttons[0]?.value || 0, // 扳机
      squeeze: gamepad.buttons[1]?.value || 0, // 侧键
      thumbstickX: gamepad.axes[2] || 0, // 摇杆 X
      thumbstickY: gamepad.axes[3] || 0, // 摇杆 Y
      touchpadX: gamepad.axes[0] || 0, // 触摸板 X
      touchpadY: gamepad.axes[1] || 0, // 触摸板 Y
    };
  }

  // 检测控制器射线与物体的交互
  const raycaster = new THREE.Raycaster();
  const tempMatrix = new THREE.Matrix4();

  function getIntersections(
    controllerIndex: number,
    objects: THREE.Object3D[]
  ) {
    const controller = controllers[controllerIndex]?.controller;
    if (!controller) return [];

    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    return raycaster.intersectObjects(objects, true);
  }

  // 提供方法将控制器移动到新的父对象
  function moveControllersToParent(parent: THREE.Object3D) {
    controllers.forEach(({ controller, controllerGrip }) => {
      if (controller.parent) controller.parent.remove(controller)
      if (controllerGrip.parent) controllerGrip.parent.remove(controllerGrip)
      parent.add(controller)
      parent.add(controllerGrip)
    })
  }

  return {
    controllers,
    getGamepadState,
    getIntersections,
    moveControllersToParent,
  };
}
