import * as THREE from 'three'

export interface InteractionEvent {
  type: 'select' | 'grab' | 'release' | 'hover'
  object?: THREE.Object3D
  point?: THREE.Vector3
  controller?: THREE.Group
  index?: number
}

export interface InteractionHandler {
  onSelect?: (event: InteractionEvent) => void
  onGrab?: (event: InteractionEvent) => void
  onRelease?: (event: InteractionEvent) => void
  onHover?: (event: InteractionEvent) => void
}

/**
 * 统一的交互接口
 * VR 和非 VR 都遵循这个接口
 */
export interface IInteractionController {
  update(): void
  setInteractables(objects: THREE.Object3D[]): void
  dispose(): void
}

