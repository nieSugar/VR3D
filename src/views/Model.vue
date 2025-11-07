<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import * as THREE from 'three'
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { VRDebugPanel } from '../utils/VRDebugPanel'
import GUI from 'lil-gui'
import { Lut } from 'three/examples/jsm/math/Lut.js'


const container = ref<HTMLDivElement | null>(null);
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let vrPlayerRig: THREE.Group;
let ground: THREE.Mesh;

let debugPanel: VRDebugPanel;
let caeMesh: THREE.Mesh | null = null;
let caeModelCenter = new THREE.Vector3(0, 0, 0); // CAE 模型中心位置
let caeViewDistance = 5; // 观看 CAE 模型的合适距离
let gui: GUI | null = null;

let lut = new Lut();

// 自定义颜色映射
const ColorMapKeywords = {
  rainbow: [
    [0.0, 0x00008f],
    [0.05, 0x00008f],
    [0.1, 0x0000c4],
    [0.15, 0x0000f9],
    [0.2, 0x002fff],
    [0.25, 0x0064ff],
    [0.3, 0x0099ff],
    [0.35, 0x00ceff],
    [0.4, 0x03fffc],
    [0.45, 0x38ffc7],
    [0.5, 0x6dff92],
    [0.55, 0xa2ff5d],
    [0.6, 0xd7ff28],
    [0.65, 0xfff200],
    [0.7, 0xffbe00],
    [0.75, 0xff8900],
    [0.8, 0xff5400],
    [0.85, 0xff1f00],
    [0.9, 0xe90000],
    [0.95, 0xb40000],
    [1.0, 0x800000]
  ],
  cooltowarm: [
    [0.0, 0x3c4ec2],
    [0.2, 0x9bbcff],
    [0.5, 0xdcdcdc],
    [0.8, 0xf6a385],
    [1.0, 0xb40426]
  ],
  blackbody: [
    [0.0, 0x000000],
    [0.2, 0x780000],
    [0.5, 0xe63200],
    [0.8, 0xffff00],
    [1.0, 0xffffff]
  ],
  grayscale: [
    [0.0, 0x000000],
    [1.0, 0xffffff]
  ],
  water: [
    [0.0, 0xffffff],
    [1.0, 0x0066ff]
  ],
  water2: [
    [0.0, 0xffffff],
    [0.2, 0xbfbfff],
    [0.5, 0x7f7fff],
    [0.8, 0x4040ff],
    [1.0, 0x0000ff]
  ],
  wite: [
    [0.0, 0xffffff],
    [0.2, 0xbfbfbf],
    [0.5, 0x7f7f7f],
    [0.8, 0x404040],
    [1.0, 0x000000]
  ]
};

// 将自定义颜色映射添加到 lut
Object.entries(ColorMapKeywords).forEach(([name, colormap]) => {
  lut.addColorMap(name, colormap);
});

// GUI 参数
const guiParams = {
  // CAE 模型控制
  caeModel: {
    visible: true,
    wireframe: false,
    opacity: 1.0,
    color: '#4ecdc4',
    metalness: 0.3,
    roughness: 0.5,
  },
  // 场景控制
  scene: {
    backgroundColor: '#1a1a2e',
    autoRotate: false,
    rotationSpeed: 1.0,
  },
  // 测试物体控制
  testObjects: {
    visible: true,
    animate: true,
  }
}

// 动画时钟（用于物体动画）
const clock = new THREE.Clock()

function initSceneAndLightAndGround() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)
  scene.fog = new THREE.Fog(0x1a1a2e, 5, 20)

  // 添加环境光和方向光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 10, 5)
  directionalLight.castShadow = true
  directionalLight.shadow.mapSize.width = 2048
  directionalLight.shadow.mapSize.height = 2048
  scene.add(directionalLight)


  // 添加地面
  const groundGeometry = new THREE.PlaneGeometry(20, 20)
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x2d2d44,
    roughness: 0.8,
    metalness: 0.2
  })
  ground = new THREE.Mesh(groundGeometry, groundMaterial)
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
}

function initCamera() {
  if (!container?.value) return
  const aspect = container.value.clientWidth / container.value.clientHeight
  camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000)
  camera.position.set(0, 1.6, 3)
  scene.add(camera)
}

function initRenderer() {
  if (!container?.value) return
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true; // 启用本地裁剪
  container.value.appendChild(renderer.domElement);
  // 启用 VR
  renderer.xr.enabled = true;
  const vrButton = VRButton.createButton(renderer)
  container.value.appendChild(vrButton)
}

function initControls() {
  if (!camera || !renderer) return
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 1;
  controls.maxDistance = 100;
  controls.maxPolarAngle = Math.PI / 1.5;
  // 初始目标指向场景中心，CAE 模型加载后会更新
  controls.target.set(0, 0, 0);
}

function initVRPlayerRig() {
  vrPlayerRig = new THREE.Group()
  vrPlayerRig.name = 'VRPlayerRig'
  // 初始位置稍微远一点，面向场景中心
  vrPlayerRig.position.set(3, 1.6, 3)
  scene.add(vrPlayerRig)
}

function initDebugPanel() {
  debugPanel = new VRDebugPanel(scene)
  debugPanel.log('模型场景已启动')
  debugPanel.log('桌面模式: 鼠标旋转视角 / WASD移动 / 空格跳跃 / 左键选择 / 右键抓取')
  debugPanel.log('VR 模式: 扳机选择 / 侧键抓取 / 摇杆移动 / A键跳跃')
}

function initGUI() {
  gui = new GUI({ title: 'CAE 模型控制' })

  // CAE 模型控制文件夹
  const caeFolder = gui.addFolder('CAE 模型')

  caeFolder.add(guiParams.caeModel, 'visible').name('显示').onChange((value: boolean) => {
    if (caeMesh) {
      caeMesh.visible = value
      debugPanel.log(`CAE 模型: ${value ? '显示' : '隐藏'}`)
    }
  })

  caeFolder.add(guiParams.caeModel, 'wireframe').name('线框模式').onChange((value: boolean) => {
    if (caeMesh && caeMesh.material) {
      (caeMesh.material as THREE.MeshStandardMaterial).wireframe = value
      debugPanel.log(`线框模式: ${value ? '开启' : '关闭'}`)
    }
  })

  caeFolder.add(guiParams.caeModel, 'opacity', 0, 1, 0.1).name('透明度').onChange((value: number) => {
    if (caeMesh && caeMesh.material) {
      const material = caeMesh.material as THREE.MeshStandardMaterial
      material.opacity = value
      material.transparent = value < 1
      debugPanel.log(`透明度: ${(value * 100).toFixed(0)}%`)
    }
  })

  caeFolder.add(guiParams.caeModel, 'metalness', 0, 1, 0.1).name('金属度').onChange((value: number) => {
    if (caeMesh && caeMesh.material) {
      (caeMesh.material as THREE.MeshStandardMaterial).metalness = value
    }
  })

  caeFolder.add(guiParams.caeModel, 'roughness', 0, 1, 0.1).name('粗糙度').onChange((value: number) => {
    if (caeMesh && caeMesh.material) {
      (caeMesh.material as THREE.MeshStandardMaterial).roughness = value
    }
  })

  caeFolder.open()

  // 场景控制文件夹
  const sceneFolder = gui.addFolder('场景控制')

  sceneFolder.addColor(guiParams.scene, 'backgroundColor').name('背景色').onChange((value: string) => {
    scene.background = new THREE.Color(value)
  })

  sceneFolder.add(guiParams.scene, 'autoRotate').name('自动旋转').onChange((value: boolean) => {
    controls.autoRotate = value
    debugPanel.log(`自动旋转: ${value ? '开启' : '关闭'}`)
  })

  sceneFolder.add(guiParams.scene, 'rotationSpeed', 0.1, 5, 0.1).name('旋转速度').onChange((value: number) => {
    controls.autoRotateSpeed = value
  })

  sceneFolder.open()

  // 测试物体控制
  const testFolder = gui.addFolder('测试物体')

  testFolder.add(guiParams.testObjects, 'visible').name('显示').onChange((value: boolean) => {
    interactableObjects.forEach(obj => {
      if (obj !== caeMesh) {
        obj.visible = value
      }
    })
    debugPanel.log(`测试物体: ${value ? '显示' : '隐藏'}`)
  })

  testFolder.add(guiParams.testObjects, 'animate').name('动画').onChange((value: boolean) => {
    debugPanel.log(`测试物体动画: ${value ? '开启' : '关闭'}`)
  })

  testFolder.close()

  // 添加重置按钮
  gui.add({
    resetCamera: () => {
      if (caeMesh) {
        camera.position.set(
          caeViewDistance * 0.7,
          caeViewDistance * 0.5,
          caeViewDistance * 0.7
        )
        camera.lookAt(caeModelCenter)
        controls.target.copy(caeModelCenter)
        controls.update()
        debugPanel.log('相机已重置')
      }
    }
  }, 'resetCamera').name('重置相机')

  // 添加模型信息显示
  const infoFolder = gui.addFolder('模型信息')
  infoFolder.close()

  debugPanel.log('✓ GUI 控制面板已加载')
}

// 更新 GUI 中的模型信息
function updateGUIModelInfo(name: string, vertices: number, faces: number, size: THREE.Vector3) {
  if (!gui) return

  const infoFolder = gui.folders.find(f => f._title === '模型信息')
  if (!infoFolder) return

  // 清除旧的控制器
  infoFolder.controllers.forEach(c => c.destroy())

  // 添加只读信息
  const info = {
    name: name,
    vertices: vertices.toLocaleString(),
    faces: faces.toLocaleString(),
    sizeX: size.x.toFixed(2),
    sizeY: size.y.toFixed(2),
    sizeZ: size.z.toFixed(2),
  }

  infoFolder.add(info, 'name').name('模型名称').disable()
  infoFolder.add(info, 'vertices').name('顶点数').disable()
  infoFolder.add(info, 'faces').name('面数').disable()
  infoFolder.add(info, 'sizeX').name('尺寸 X').disable()
  infoFolder.add(info, 'sizeY').name('尺寸 Y').disable()
  infoFolder.add(info, 'sizeZ').name('尺寸 Z').disable()
}

const interactableObjects: THREE.Object3D[] = []

function initObject() {
  // 暂时隐藏测试物体，让 CAE 模型成为焦点

  // 添加立方体
  const cubeGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
  const cubeMaterial = new THREE.MeshStandardMaterial({
    color: 0xff6b6b,
    roughness: 0.5,
    metalness: 0.3
  })
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial)
  cube.position.set(-2, 0.25, -3)
  cube.castShadow = true
  cube.name = 'Cube'
  scene.add(cube)
  interactableObjects.push(cube)

  // 添加球体
  const sphereGeometry = new THREE.SphereGeometry(0.3, 32, 32)
  const sphereMaterial = new THREE.MeshStandardMaterial({
    color: 0x4ecdc4,
    roughness: 0.3,
    metalness: 0.7
  })
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial)
  sphere.position.set(0, 0.3, -3)
  sphere.castShadow = true
  sphere.name = 'Sphere'
  scene.add(sphere)
  interactableObjects.push(sphere)

  // 添加圆环
  const torusGeometry = new THREE.TorusGeometry(0.3, 0.1, 16, 100)
  const torusMaterial = new THREE.MeshStandardMaterial({
    color: 0xffe66d,
    roughness: 0.4,
    metalness: 0.6
  })
  const torus = new THREE.Mesh(torusGeometry, torusMaterial)
  torus.position.set(2, 0.3, -3)
  torus.castShadow = true
  torus.name = 'Torus'
  scene.add(torus)
  interactableObjects.push(torus)

  // 添加圆锥
  const coneGeometry = new THREE.ConeGeometry(0.25, 0.6, 32)
  const coneMaterial = new THREE.MeshStandardMaterial({
    color: 0xa8e6cf,
    roughness: 0.5,
    metalness: 0.4
  })
  const cone = new THREE.Mesh(coneGeometry, coneMaterial)
  cone.position.set(-1, 0.3, -2)
  cone.castShadow = true
  cone.name = 'Cone'
  scene.add(cone)
  interactableObjects.push(cone)

  // 添加圆柱
  const cylinderGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.6, 32)
  const cylinderMaterial = new THREE.MeshStandardMaterial({
    color: 0xdda15e,
    roughness: 0.6,
    metalness: 0.3
  })
  const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial)
  cylinder.position.set(1, 0.3, -2)
  cylinder.castShadow = true
  cylinder.name = 'Cylinder'
  scene.add(cylinder)
  interactableObjects.push(cylinder)
}


interface Task {
  name?: string;
  val?: Array<number>;
  max?: number;
  min?: number;
  key?: string;
  nameKey?: string;
  valIsArray?: boolean;
  unit?: string;
}

const newTaskValues: Array<{
  value: Array<Task>;
  name: string;
  nameKey: string;
  unit: string;
  valIsArray: boolean;
}> = [];

// 加载 CAE 模型数据
async function loadCAEModel() {
  try {
    debugPanel.log('开始加载 CAE 模型...')

    // 加载节点数据和数值数据
    const [nodeResponse, valueResponse] = await Promise.all([
      fetch('/src/assets/objects/470/FNode.json').then(r => r.json()),
      fetch('/src/assets/objects/470/FValue.json').then(r => r.json())
    ])

    const nodeData = nodeResponse;
    const valueData: Array<{
      name: string;
      key: string;
      times: Record<string, Array<number>>;
      unit: string;
    }> = valueResponse;

    mapTaskData(valueData, newTaskValues);

    // 创建几何体
    const geometry = new THREE.BufferGeometry();

    // 设置顶点位置
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(nodeData.nodes, 3))

    // 设置索引
    geometry.setIndex(new THREE.Uint32BufferAttribute(nodeData.indexs, 1))

    const colors = [];
    for (let i = 0, n = geometry.attributes.position?.count || 0; i < n; ++i) {
      colors.push(1, 1, 1);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const data = newTaskValues[0]?.value || [];
    // 设置压力属性（用于后续处理）
    geometry.setAttribute('pressure', new THREE.Float32BufferAttribute(data[0]?.val || [], 1))

    // 计算法线
    geometry.computeVertexNormals()


    const pressures = geometry.attributes.pressure;
    const newColors = geometry.attributes.color || new THREE.Float32BufferAttribute([], 3);

    lut.setColorMap('water');
    // 遍历所有顶点，根据压力值设置颜色
    for (let i = 0; i < pressures!.array.length; i++) {
      const colorValue = pressures?.array[i];
      const color = lut.getColor(colorValue || 0);

      if (color === undefined) {
        console.log('Unable to determine color for value:', colorValue);
      } else {
        newColors.setXYZ(i, color.r, color.g, color.b);
      }
    }

    newColors.needsUpdate = true;


    const planes = [
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), // X 轴平面
      new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), // Y 轴平面
      new THREE.Plane(new THREE.Vector3(0, 0, -1), 0) // Z 轴平面
    ];
    // 创建材质（简单的标准材质）
    const material = new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide, // 双面渲染
      metalness: 0, // 金属度
      roughness: 0, // 粗糙度
      vertexColors: true, // 使用顶点颜色
      // clipping: true, // 启用裁剪
      // clippingPlanes: planes, // 裁剪平面数组
      // renderOrder: 0, // 渲染顺序
      // uniforms: {
      //   iTime: { value: 0.5 }
      // }
    })

    // 创建网格
    caeMesh = new THREE.Mesh(geometry, material)
    caeMesh.castShadow = true
    caeMesh.receiveShadow = true
    caeMesh.name = 'CAE_Model'

    // 计算包围盒并调整位置
    geometry.computeBoundingBox()
    const bbox = geometry.boundingBox!
    const center = new THREE.Vector3()
    bbox.getCenter(center)

    // 根据模型大小调整缩放
    const size = new THREE.Vector3()
    bbox.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = 2 / maxDim // 缩放到合适大小
    caeMesh.scale.setScalar(scale)

    // 将模型放到场景中心 (0, 0, 0)，并将其几何中心对齐到世界坐标原点
    caeMesh.position.set(-center.x * scale, -center.y * scale, -center.z * scale)

    scene.add(caeMesh)
    interactableObjects.push(caeMesh)

    // 计算缩放后的包围盒大小
    const scaledSize = size.multiplyScalar(scale)
    const distance = Math.max(scaledSize.x, scaledSize.y, scaledSize.z) * 2

    // 保存模型信息供 VR 模式使用
    caeModelCenter.set(0, 0, 0) // 模型中心在世界坐标原点
    caeViewDistance = distance

    // 调整地面位置到模型下方
    const modelBottom = bbox.min.y * scale - center.y * scale
    ground.position.y = modelBottom - 0.1 // 稍微留一点间隙

    // 更新 VR 地面高度（玩家站在地面上，眼睛高度 1.6m）
    groundLevel = ground.position.y + 1.6

    // 调整相机位置以观看整个模型
    camera.position.set(distance * 0.7, distance * 0.5, distance * 0.7)
    camera.lookAt(caeModelCenter)

    // 更新控制器目标到模型中心
    controls.target.copy(caeModelCenter)
    controls.update()

    debugPanel.log(`✓ CAE 模型加载成功 (${valueData[0].name})`)
    debugPanel.log(`模型尺寸: ${scaledSize.x.toFixed(2)} x ${scaledSize.y.toFixed(2)} x ${scaledSize.z.toFixed(2)}`)
    debugPanel.log('桌面: 鼠标拖动旋转查看 / VR: 点击"Enter VR"按钮进入')

    // 更新 GUI 标题和模型信息
    if (gui && geometry.attributes.position) {
      gui.title(`CAE 模型控制 - ${valueData[0].name}`)

      const vertexCount = geometry.attributes.position.count
      const faceCount = geometry.index ? geometry.index.count / 3 : vertexCount / 3
      updateGUIModelInfo(valueData[0].name, vertexCount, faceCount, scaledSize)
    }

  } catch (error) {
    console.error('加载 CAE 模型失败:', error)
    debugPanel.log('✗ CAE 模型加载失败')
  }
}

let highlightedObject: THREE.Object3D | null = null;

const originalMaterials = new Map<THREE.Object3D, THREE.Material>();

function highlightObject(obj: THREE.Object3D | null) {
  // 恢复之前高亮的对象
  if (highlightedObject && originalMaterials.has(highlightedObject)) {
    const mesh = highlightedObject as THREE.Mesh
    const originalMat = originalMaterials.get(highlightedObject)!
    mesh.material = originalMat
  }

  highlightedObject = obj

  // 高亮新对象
  if (obj) {
    const mesh = obj as THREE.Mesh
    if (!originalMaterials.has(obj) && mesh.material) {
      if (Array.isArray(mesh.material)) {
        if (mesh.material[0]) {
          originalMaterials.set(obj, mesh.material[0])
        }
      } else {
        originalMaterials.set(obj, mesh.material)
      }
    }
    mesh.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffff00,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.7
    })
  }
}

function handleResize() {
  if (!container.value) return
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}




let grabbedObject: THREE.Object3D | null = null
let grabHand: 'vr-left' | 'vr-right' | 'desktop' | null = null

// 跳跃相关状态
let verticalVelocity = 0
const gravity = -0.008
const jumpStrength = 0.15
let groundLevel = 0.6 // VR 眼睛高度，会在模型加载后更新

const gameLogic = {
  // 选择开始
  handleSelectStart: (position: THREE.Vector3, direction: THREE.Vector3, hand: string) => {
    debugPanel.log(`[${hand}] 选择开始`)
    // 射线检测
    const raycaster = new THREE.Raycaster(position, direction)
    const intersections = raycaster.intersectObjects(interactableObjects, true)
    if (intersections.length > 0 && intersections[0]?.object) {
      const hitObject = intersections[0].object
      debugPanel.log(`命中: ${hitObject.name || hitObject.type}`)
      highlightObject(hitObject)
    }
  },

  // 选择结束
  handleSelectEnd: (hand: string) => {
    debugPanel.log(`[${hand}] 选择结束`)
    highlightObject(null)
  },

  // 抓取开始
  handleGrabStart: (position: THREE.Vector3, direction: THREE.Vector3, hand: 'left' | 'right', controller?: THREE.Group) => {
    debugPanel.log(`[${hand}] 抓取开始`)

    const raycaster = new THREE.Raycaster(position, direction)
    const intersections = raycaster.intersectObjects(interactableObjects, true)

    if (intersections.length > 0 && intersections[0]?.object) {
      grabbedObject = intersections[0].object
      grabHand = controller ? `vr-${hand}` : 'desktop'

      debugPanel.log(`已抓取: ${grabbedObject.name || grabbedObject.type}`)

      // VR 模式：附加到控制器
      if (controller) {
        controller.attach(grabbedObject)
      }
    }
  },

  // 抓取结束
  handleGrabEnd: (hand: string, controller?: THREE.Group) => {
    debugPanel.log(`[${hand}] 抓取结束`)

    if (grabbedObject) {
      // VR 模式：从控制器分离
      if (controller) {
        const attachedObject = controller.children.find(
          (child) => child.type === 'Mesh' && child.name !== 'line'
        )
        if (attachedObject) {
          scene.attach(attachedObject as THREE.Object3D)
        }
      }

      debugPanel.log('已释放物体')
      grabbedObject = null
      grabHand = null
    }
  },

  // 移动（桌面：移动相机；VR：移动玩家容器）
  handleMove: (delta: THREE.Vector2) => {
    const speed = 0.05

    // 计算前进方向（基于相机朝向，忽略 Y 轴）
    const direction = new THREE.Vector3(0, 0, -1)
    direction.applyQuaternion(camera.quaternion)
    direction.y = 0
    direction.normalize()

    // 计算侧向（前进方向的垂直向量）
    const strafe = new THREE.Vector3(-direction.z, 0, direction.x)

    // VR 模式下相机在 rig 中，移动 rig；桌面模式移动相机
    const target = camera.parent || camera
    target.position.addScaledVector(direction, -delta.y * speed) // 前后
    target.position.addScaledVector(strafe, delta.x * speed)    // 左右
  },

  // 跳跃
  handleJump: () => {
    const target = camera.parent || camera
    // 只有在地面上才能跳
    if (target.position.y <= groundLevel) {
      verticalVelocity = jumpStrength
      debugPanel.log('跳跃!')
    }
  },
}

//#region vr 操作

const controllerModelFactory = new XRControllerModelFactory()
const vrControllers: Array<{
  controller: THREE.Group
  controllerGrip: THREE.Group
  line: THREE.Line
}> = []

function createVRController(index: number) {
  const controller = renderer.xr.getController(index)

  // 创建控制器射线
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1),
  ])
  const material = new THREE.LineBasicMaterial({ color: 0x00ffff })
  const line = new THREE.Line(geometry, material)
  line.name = 'line'
  line.scale.z = 5
  controller.add(line)
  scene.add(controller)

  // 控制器模型
  const controllerGrip = renderer.xr.getControllerGrip(index)
  const model = controllerModelFactory.createControllerModel(controllerGrip)
  controllerGrip.add(model)
  scene.add(controllerGrip)

  // 绑定控制器事件
  controller.addEventListener('selectstart', () => {
    handleVRSelectStart(controller, index)
  })
  controller.addEventListener('selectend', () => {
    handleVRSelectEnd(controller, index)
  })
  controller.addEventListener('squeezestart', () => {
    handleVRSqueezeStart(controller, index)
  })
  controller.addEventListener('squeezeend', () => {
    handleVRSqueezeEnd(controller, index)
  })

  return { controller, controllerGrip, line }
}


// 获取控制器游戏手柄状态
function getGamepadState(index: number) {
  const session = renderer.xr.getSession()
  if (!session) return null
  const inputSource = session.inputSources[index]
  if (!inputSource?.gamepad) return null
  const gamepad = inputSource.gamepad
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
  }
}

// 将控制器移动到新父对象
function moveControllersToParent(parent: THREE.Object3D) {
  vrControllers.forEach(({ controller, controllerGrip }) => {
    if (controller.parent) controller.parent.remove(controller)
    if (controllerGrip.parent) controllerGrip.parent.remove(controllerGrip)
    parent.add(controller)
    parent.add(controllerGrip)
  })
}

// VR 控制器事件处理函数
function handleVRSelectStart(controller: THREE.Group, index: number) {
  const hand = index === 0 ? 'left' : 'right'
  const pos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld)
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.quaternion)
  gameLogic.handleSelectStart(pos, dir, `vr-${hand}`)
}

function handleVRSelectEnd(_controller: THREE.Group, index: number) {
  const hand = index === 0 ? 'left' : 'right'
  gameLogic.handleSelectEnd(`vr-${hand}`)
}

function handleVRSqueezeStart(controller: THREE.Group, index: number) {
  const hand = index === 0 ? 'left' : 'right'
  const pos = new THREE.Vector3().setFromMatrixPosition(controller.matrixWorld)
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.quaternion)
  gameLogic.handleGrabStart(pos, dir, hand, controller)
}

function handleVRSqueezeEnd(controller: THREE.Group, index: number) {
  const hand = index === 0 ? 'left' : 'right'
  gameLogic.handleGrabEnd(hand, controller)
}
//#endregion

const isVRMode = ref(false)

// 按键状态跟踪
const prevButtonStates: Map<string, boolean[]> = new Map()

// 按键名称映射（Quest 手柄）
const buttonNames = {
  0: 'Trigger',      // 0: 扳机
  1: 'Squeeze',      // 1: 侧键
  3: 'Thumbstick',   // 3: 摇杆按下
  4: 'X/A',          // 4: X键(左手) 或 A键(右手)
  5: 'Y/B',          // 5: Y键(左手) 或 B键(右手)
  12: 'Menu',        // 12: 菜单键
}

function animationLoop() {
  const deltaTime = clock.getDelta()
  const elapsedTime = clock.getElapsedTime()

  // 更新 OrbitControls
  if (controls.enabled) {
    controls.update()
  }

  // 让物体自动旋转（除非被抓取或是 CAE 模型）
  if (guiParams.testObjects.animate) {
    interactableObjects.forEach((obj, index) => {
      if (obj !== grabbedObject && obj !== caeMesh) {
        obj.rotation.y += deltaTime * 0.5
        obj.rotation.x += deltaTime * 0.2
        // 添加上下浮动效果
        obj.position.y = 0.3 + Math.sin(elapsedTime + index * 1.2) * 0.1
      }
    })
  }

  // 应用重力和垂直速度
  const target = camera.parent || camera
  verticalVelocity += gravity
  target.position.y += verticalVelocity

  // 地面碰撞检测
  if (target.position.y < groundLevel) {
    target.position.y = groundLevel
    verticalVelocity = 0
  }

  // VR 模式：处理摇杆输入和GUI交互
  // 监听左右手柄按键
  [0, 1].forEach(index => {
    const hand = index === 0 ? 'Left' : 'Right'
    const gamepad = getGamepadState(index)

    if (gamepad) {
      const prevState = prevButtonStates.get(hand) || []

      // 检测每个按键变化
      gamepad.buttons.forEach((button, btnIndex) => {
        const wasPressed = prevState[btnIndex] || false
        const isPressed = button.pressed

        // 按下事件
        if (isPressed && !wasPressed) {
          const btnName = buttonNames[btnIndex as keyof typeof buttonNames] || `Button${btnIndex}`
          debugPanel.log(`[${hand}] ${btnName} 按下 ${btnIndex}`)

          // A键跳跃（右手按钮4）
          if (hand === 'Right' && btnIndex === 4) {
            gameLogic.handleJump()
          }
        }
        // 释放事件
        else if (!isPressed && wasPressed) {
          const btnName = buttonNames[btnIndex as keyof typeof buttonNames] || `Button${btnIndex}`
          debugPanel.log(`[${hand}] ${btnName} 释放 ${btnIndex}`)
        }
      })

      // 保存当前状态
      prevButtonStates.set(hand, gamepad.buttons.map(b => b.pressed))

      // 摇杆移动（右手）
      if (index === 1) {
        const deadzone = 0.15
        if (Math.abs(gamepad.thumbstickX) > deadzone || Math.abs(gamepad.thumbstickY) > deadzone) {
          gameLogic.handleMove(new THREE.Vector2(gamepad.thumbstickX, gamepad.thumbstickY))
        }
      }
    }
  })

  // 渲染场景
  renderer.render(scene, camera)
}

// 清理函数
function animationCleanup() {
  // 停止动画循环
  renderer.setAnimationLoop(null)

  // 移除事件监听
  window.removeEventListener('resize', handleResize)

  // 清理几何体和材质
  interactableObjects.forEach(obj => {
    const mesh = obj as THREE.Mesh
    mesh.geometry.dispose()
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(m => m.dispose())
    } else {
      mesh.material.dispose()
    }
  })

  // 清理原始材质
  originalMaterials.forEach(material => {
    if (Array.isArray(material)) {
      material.forEach(m => m.dispose())
    } else {
      material.dispose()
    }
  })

  // 清理地面
  ground.geometry.dispose()
  if (Array.isArray(ground.material)) {
    ground.material.forEach(m => m.dispose())
  } else {
    ground.material.dispose()
  }

  // 清理 CAE 模型
  if (caeMesh) {
    caeMesh.geometry.dispose()
    if (Array.isArray(caeMesh.material)) {
      caeMesh.material.forEach(m => m.dispose())
    } else {
      caeMesh.material.dispose()
    }
  }

  // 清理控制器
  if (controls) {
    controls.dispose()
  }

  // 清理 GUI
  if (gui) {
    gui.destroy()
  }

  // 清理渲染器
  if (renderer && container.value) {
    renderer.dispose()
    container.value.removeChild(renderer.domElement)
    // 移除 VR 按钮
    const vrButton = container.value.querySelector('button')
    if (vrButton) {
      container.value.removeChild(vrButton)
    }
  }
}

function mapTaskData(taskvals: Array<{
  name?: string;
  key?: string;
  times?: Record<string, Array<number>>;
  unit?: string;
}>, newTaskValues: Array<{
  value: Array<Task>;
  name: string;
  nameKey: string;
  unit: string;
  valIsArray: boolean;
}>) {
  for (const task of taskvals) {
    const newTaskList = [];
    let name = '';
    let unit = '';
    let nameKey = '';
    let valIsArray = false;

    // 遍历每个时间步
    for (const key in task.times) {
      const newTask: Task = {};
      if (Object.prototype.hasOwnProperty.call(task.times, key)) {
        const val = task.times[key];
        name = newTask.name = task.name || '';
        unit = newTask.unit = task.unit || '';
        nameKey = newTask.nameKey = task.key || '';
        newTask.key = key;
        newTask.val = val || [];

        // 检查数据是否为向量数组（如速度[vx, vy, vz]）
        if (val && val.length > 0) {
          valIsArray = newTask.valIsArray = Array.isArray(val[0]);
        }

        // 如果是向量数据，计算其模长  eslint-disable-next-line
        if (valIsArray) {
          for (const [index, i] of (val as unknown as Array<Array<number>>).entries()) {
            // 计算三维向量的模: sqrt(x² + y² + z²)
            const data = Math.hypot(i[0] || 0, i[1] || 0, i[2] || 0);
            val![index] = data;
          }
        }
      }
      newTaskList.push(newTask);
    }

    newTaskValues.push({
      name,
      unit,
      nameKey,
      value: newTaskList,
      valIsArray
    });
  }
}


onMounted(() => {
  if (!container.value) return

  // ========== Three.js 初始化 ==========
  initSceneAndLightAndGround();
  initCamera();
  initRenderer();
  initControls();
  initVRPlayerRig();
  initObject();
  initDebugPanel();
  initGUI();

  // 加载 CAE 模型
  loadCAEModel();

  window.addEventListener('resize', handleResize)

  // 创建两个控制器
  vrControllers.push(createVRController(0))
  vrControllers.push(createVRController(1))

  // 监听 VR 会话变化
  renderer.xr.addEventListener('sessionstart', () => {
    isVRMode.value = true
    debugPanel.log('✓ 已进入 VR 模式')
    debugPanel.log('控制器已就绪')

    // 禁用 OrbitControls
    controls.enabled = false

    // 隐藏 GUI（VR 模式下不需要）
    if (gui) {
      gui.hide()
    }

    // 进入 VR：将相机从场景移到 rig 中
    const worldPos = new THREE.Vector3()
    camera.getWorldPosition(worldPos)

    scene.remove(camera)

    // 如果 CAE 模型已加载，将 VR 玩家定位到合适的观看位置
    if (caeMesh) {
      // 计算从模型中心向外看的位置（与桌面相机类似的角度）
      const viewPos = new THREE.Vector3(
        caeModelCenter.x + caeViewDistance * 0.7,
        caeModelCenter.y + caeViewDistance * 0.3, // VR 中稍微低一点，更自然
        caeModelCenter.z + caeViewDistance * 0.7
      )

      // 但要确保玩家站在地面上
      viewPos.y = Math.max(viewPos.y, groundLevel)

      vrPlayerRig.position.copy(viewPos)
      debugPanel.log(`VR 玩家位置: ${viewPos.x.toFixed(1)}, ${viewPos.y.toFixed(1)}, ${viewPos.z.toFixed(1)}`)
    } else {
      vrPlayerRig.position.copy(worldPos)
    }

    vrPlayerRig.add(camera)

    // 相机在 rig 内的局部位置归零（头显会控制相对位置）
    camera.position.set(0, 0, 0)

    // 将控制器移动到 VR Player Rig
    moveControllersToParent(vrPlayerRig)
    debugPanel.log('手柄已绑定到玩家')
  })

  renderer.xr.addEventListener('sessionend', () => {
    isVRMode.value = false
    debugPanel.log('✓ 已切换到桌面模式')

    // 重新启用 OrbitControls
    controls.enabled = true

    // 显示 GUI
    if (gui) {
      gui.show()
    }

    // 退出 VR：将相机从 rig 移回场景
    const worldPos = new THREE.Vector3()
    camera.getWorldPosition(worldPos)

    vrPlayerRig.remove(camera)
    scene.add(camera)
    camera.position.copy(worldPos)

    // 重置 rig 位置供下次使用
    vrPlayerRig.position.set(0, 0, 0)

    // 将控制器移回场景
    moveControllersToParent(scene)
  })

  // 主动画循环
  renderer.setAnimationLoop(animationLoop)
})

// 组件卸载时的清理
onUnmounted(() => {
  if (animationCleanup) {
    animationCleanup()
  }
})
</script>

<template>
  <div ref="container" class="model-container"></div>
</template>

<style scoped>
.model-container {
  width: 100%;
  height: 100%;
}
</style>
