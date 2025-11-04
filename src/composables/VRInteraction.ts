import * as THREE from "three";
import { useVRControllers } from "./useVRControllers";
import type {
  IInteractionController,
  InteractionHandler,
  InteractionEvent,
} from "./useInteraction";

/**
 * VR 模式的交互控制器
 */
export class VRInteraction implements IInteractionController {
  private interactables: THREE.Object3D[] = [];
  private grabbedObjects: Map<number, THREE.Object3D> = new Map();
  private hoveredObjects: Map<number, THREE.Object3D> = new Map();
  private controllers: ReturnType<typeof useVRControllers>;
  private handler: InteractionHandler;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    handler: InteractionHandler
  ) {
    this.handler = handler;
    this.controllers = useVRControllers(renderer, scene, {
      onSelectStart: (controller, index) => {
        const intersections = this.controllers.getIntersections(
          index,
          this.interactables
        );
        const hitObject = intersections[0]?.object;

        const event: InteractionEvent = {
          type: "select",
          object: hitObject,
          point: intersections[0]?.point,
          controller,
          index,
        };

        this.handler.onSelect?.(event);
      },

      onSqueezeStart: (controller, index) => {
        const intersections = this.controllers.getIntersections(
          index,
          this.interactables
        );
        const hitObject = intersections[0]?.object;

        if (hitObject) {
          // 附加到控制器
          controller.attach(hitObject);
          this.grabbedObjects.set(index, hitObject);

          const event: InteractionEvent = {
            type: "grab",
            object: hitObject,
            point: intersections[0]?.point,
            controller,
            index,
          };

          this.handler.onGrab?.(event);
        }
      },

      onSqueezeEnd: (controller, index) => {
        const grabbedObject = this.grabbedObjects.get(index);

        if (grabbedObject) {
          // 从控制器分离
          const scene = grabbedObject.parent?.parent;
          if (scene) {
            scene.attach(grabbedObject);
          }

          const event: InteractionEvent = {
            type: "release",
            object: grabbedObject,
            controller,
            index,
          };

          this.handler.onRelease?.(event);
          this.grabbedObjects.delete(index);
        }
      },
    });
  }

  update(): void {
    // 检测悬停
    for (let i = 0; i < 2; i++) {
      const intersections = this.controllers.getIntersections(
        i,
        this.interactables
      );
      const hitObject = intersections[0]?.object;
      const previousHovered = this.hoveredObjects.get(i);

      // 悬停状态变化
      if (hitObject !== previousHovered) {
        if (hitObject) {
          this.hoveredObjects.set(i, hitObject);
          const event: InteractionEvent = {
            type: "hover",
            object: hitObject,
            point: intersections[0]?.point,
            index: i,
          };
          this.handler.onHover?.(event);
        } else {
          this.hoveredObjects.delete(i);
          const event: InteractionEvent = {
            type: "hover",
            object: undefined,
            index: i,
          };
          this.handler.onHover?.(event);
        }
      }
    }
  }

  setInteractables(objects: THREE.Object3D[]): void {
    this.interactables = objects;
  }

  dispose(): void {
    this.grabbedObjects.clear();
    this.hoveredObjects.clear();
  }

  getControllers() {
    return this.controllers;
  }
}
