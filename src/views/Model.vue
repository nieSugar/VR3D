<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VRDebugPanel } from '../utils/VRDebugPanel'
import { VRManager } from '../utils/VRManager'
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { Lut } from 'three/examples/jsm/math/Lut.js'
import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js'
import { InteractiveGroup } from 'three/examples/jsm/interactive/InteractiveGroup.js'


const container = ref<HTMLDivElement | null>(null);
const lutRef = ref<HTMLDivElement | null>(null);
const shuzhiRef = ref<HTMLDivElement | null>(null);
const showValuePopover = ref(false);
const pointValue = ref(0);
const mouseLocation = { x: 0, y: 0 };
const selectedColorMap = ref('water');

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;

let controls: OrbitControls;
let ground: THREE.Mesh;

let debugPanel: VRDebugPanel;
let vrManager: VRManager;
let caeMesh: THREE.Mesh | null = null;
let caeModelCenter = new THREE.Vector3(0, 0, 0); // CAE 模型中心位置
let caeViewDistance = 5; // 观看 CAE 模型的合适距离
let gui: GUI | null = null;
let interactiveGroup: InteractiveGroup | null = null;

let lut = new Lut();
let planes: THREE.Plane[] = [];
let planeHelpers: THREE.PlaneHelper[] = [];
let planeObjects: THREE.Mesh[] = [];
let maxval: number = 1;
let minval: number = 0;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let setValueTimeout: number;
let animationFrameId: number | null = null;
let colorMapController: any;

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
    colorMap: 'water',
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
  },
  // 裁剪平面
  planeX: { scope: 0, plan: false },
  planeY: { scope: 0, plan: false },
  planeZ: { scope: 0, plan: false },
  // 时间帧控制
  currentFrame: 0,
  frames: [] as string[],
  // 数据类型和时间帧
  typenode: '',
  frame: '',
  animate: false,
  segmentation: false,
  nodes: {} as Record<string, Array<Task>>,
  nownode: [] as Array<Task>,
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

  // 初始化裁剪平面
  planes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), // X 轴平面
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), // Y 轴平面
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)  // Z 轴平面
  ];

  // 添加平面辅助器
  planeHelpers = planes.map(p => new THREE.PlaneHelper(p, 20, 0xffffff));
  planeHelpers.forEach(ph => {
    ph.visible = false;
    scene.add(ph);
  });

  // 添加剖切平面对象（使用 stencil buffer）
  planeObjects = [];
  const planeGeom = new THREE.PlaneGeometry(4, 4);
  for (let i = 0; i < 3; i++) {
    const poGroup = new THREE.Group();
    const plane = planes[i];
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0xe91e63,
      metalness: 0.1,
      roughness: 0.75,
      clippingPlanes: planes.filter(p => p !== plane),
      stencilWrite: true,
      stencilRef: 0,
      stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.ReplaceStencilOp,
      stencilZFail: THREE.ReplaceStencilOp,
      stencilZPass: THREE.ReplaceStencilOp
    });
    planeMat.visible = false;
    const po = new THREE.Mesh(planeGeom, planeMat);
    po.onAfterRender = function (renderer) {
      renderer.clearStencil();
    };
    po.renderOrder = i + 1.1;
    poGroup.add(po);
    planeObjects.push(po);
    scene.add(poGroup);
  }

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
  renderer.autoClear = false; // 用于 stencil buffer
  container.value.appendChild(renderer.domElement);

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

  // 裁剪平面控制（加载模型后会更新范围）
  const planeXFolder = gui.addFolder('X 轴裁剪')
  planeXFolder.add(guiParams.planeX, 'plan').name('显示面板').onChange((v: boolean) => {
    if (planeHelpers[0]) planeHelpers[0].visible = v
  })
  planeXFolder.add(guiParams.planeX, 'scope', -10, 10, 0.01).name('裁剪位置').onChange((d: number) => {
    if (planes[0]) planes[0].constant = d
  })
  planeXFolder.close()

  const planeYFolder = gui.addFolder('Y 轴裁剪')
  planeYFolder.add(guiParams.planeY, 'plan').name('显示面板').onChange((v: boolean) => {
    if (planeHelpers[1]) planeHelpers[1].visible = v
  })
  planeYFolder.add(guiParams.planeY, 'scope', -10, 10, 0.01).name('裁剪位置').onChange((d: number) => {
    if (planes[1]) planes[1].constant = d
  })
  planeYFolder.close()

  const planeZFolder = gui.addFolder('Z 轴裁剪')
  planeZFolder.add(guiParams.planeZ, 'plan').name('显示面板').onChange((v: boolean) => {
    if (planeHelpers[2]) planeHelpers[2].visible = v
  })
  planeZFolder.add(guiParams.planeZ, 'scope', -10, 10, 0.01).name('裁剪位置').onChange((d: number) => {
    if (planes[2]) planes[2].constant = d
  })
  planeZFolder.close()

  // 动画和特效控制
  gui.add(guiParams, 'animate').name('动画播放').onChange((value: boolean) => {
    if (value) {
      playAnimation()
    } else {
      stopAnimation()
    }
    debugPanel.log(`动画: ${value ? '播放' : '停止'}`)
  })

  gui.add(guiParams.scene, 'autoRotate').name('自动旋转').onChange((value: boolean) => {
    controls.autoRotate = value
    debugPanel.log(`自动旋转: ${value ? '开启' : '关闭'}`)
  })

  gui.add(guiParams, 'segmentation').name('分割模式').onChange((value: boolean) => {
    if (caeMesh && caeMesh.material) {
      (caeMesh.material as any).ribbon = value
      guiParams.caeModel.colorMap = 'grayscale'
      updateColors()
      if (colorMapController) {
        colorMapController.updateDisplay()
      }
      debugPanel.log(`分割模式: ${value ? '开启' : '关闭'}`)
    }
  })

  // 颜色映射选择
  colorMapController = gui.add(guiParams.caeModel, 'colorMap', [
    'water',
    'water2',
    'rainbow',
    'cooltowarm',
    'blackbody',
    'grayscale',
    'wite'
  ]).name('颜色映射').onChange(() => {
    updateColors()
    debugPanel.log(`颜色映射: ${guiParams.caeModel.colorMap}`)
  })

  // 场景控制文件夹
  const sceneFolder = gui.addFolder('场景控制')

  sceneFolder.addColor(guiParams.scene, 'backgroundColor').name('背景色').onChange((value: string) => {
    scene.background = new THREE.Color(value)
  })

  sceneFolder.add(guiParams.scene, 'rotationSpeed', 0.1, 5, 0.1).name('旋转速度').onChange((value: number) => {
    controls.autoRotateSpeed = value
  })

  sceneFolder.close()

  // // 测试物体控制
  // const testFolder = gui.addFolder('测试物体')

  // testFolder.add(guiParams.testObjects, 'visible').name('显示').onChange((value: boolean) => {
  //   interactableObjects.forEach(obj => {
  //     if (obj !== caeMesh) {
  //       obj.visible = value
  //     }
  //   })
  //   debugPanel.log(`测试物体: ${value ? '显示' : '隐藏'}`)
  // })

  // testFolder.add(guiParams.testObjects, 'animate').name('动画').onChange((value: boolean) => {
  //   debugPanel.log(`测试物体动画: ${value ? '开启' : '关闭'}`)
  // })

  // testFolder.close()

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

// 初始化CSS3D GUI - 使用lil-gui的domElement
function initCSS3DGUI() {
  if (!gui || !gui.domElement) {
    console.error('GUI 未初始化');
    return;
  }

  // 隐藏原始DOM元素
  gui.domElement.style.visibility = 'hidden';

  // 创建 InteractiveGroup
  interactiveGroup = new InteractiveGroup();
  interactiveGroup.listenToPointerEvents(renderer, camera);

  // 如果VR管理器存在，监听VR控制器事件
  if (vrManager) {
    const controller1 = renderer.xr.getController(0);
    const controller2 = renderer.xr.getController(1);
    if (controller1) interactiveGroup.listenToXRControllerEvents(controller1);
    if (controller2) interactiveGroup.listenToXRControllerEvents(controller2);
  }

  scene.add(interactiveGroup);

  // 创建 HTMLMesh
  const htmlMesh = new HTMLMesh(gui.domElement);

  // 设置位置和缩放 - 参考示例代码的配置
  htmlMesh.position.set(-0.75, 1.5, -0.5);
  htmlMesh.rotation.y = Math.PI / 4;
  htmlMesh.scale.setScalar(2);

  interactiveGroup.add(htmlMesh);

  console.log('HTMLMesh 已通过 InteractiveGroup 创建并添加到场景');
  debugPanel.log('✓ lil-gui 已加载到3D场景中（支持交互）');
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

    // 应用 UV 映射
    applyBoxUV(geometry)

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


    // 创建材质（简单的标准材质）
    const material = new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide, // 双面渲染
      metalness: 0, // 金属度
      roughness: 0, // 粗糙度
      vertexColors: true, // 使用顶点颜色
      clippingPlanes: planes, // 裁剪平面数组
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

    // 计算模型底部位置（变换后的最低点）
    const modelBottom = bbox.min.y * scale

    // 设置地面在 y=0 位置（标准地面高度）
    ground.position.y = 0

    // 将模型放置在地面上方
    // X和Z方向居中，Y方向让底部贴着地面
    caeMesh.position.set(
      -center.x * scale,                    // X轴居中
      -modelBottom + 0.01,                  // Y轴：让底部离地面0.01单位（避免z-fighting）
      -center.z * scale                     // Z轴居中
    )

    scene.add(caeMesh)
    interactableObjects.push(caeMesh)

    // 更新裁剪平面范围
    updateClippingPlaneRanges(bbox, scale, center)

    // 计算缩放后的包围盒大小
    const scaledSize = size.multiplyScalar(scale)
    const distance = Math.max(scaledSize.x, scaledSize.y, scaledSize.z) * 2

    // 保存模型信息供 VR 模式使用
    // 模型中心在地面上方（计算实际的模型中心位置）
    caeModelCenter.set(0, (bbox.max.y - bbox.min.y) * scale / 2 + 0.01, 0)
    caeViewDistance = distance

    // 更新 VR 地面高度（玩家站在地面上，眼睛高度 1.6m）
    groundLevel = ground.position.y + 1.6

    // 调整相机位置以观看整个模型
    camera.position.set(distance * 0.7, distance * 0.5, distance * 0.7)
    camera.lookAt(caeModelCenter)

    // 更新控制器目标到模型中心
    controls.target.copy(caeModelCenter)
    controls.update()

    // 计算最大最小值用于颜色映射
    const pressureArray = data[0]?.val || []
    maxval = Math.max(...pressureArray)
    minval = Math.min(...pressureArray)

    // 更新颜色和 LUT 显示
    updateColors()
    updateLutDisplay()

    const modelName = valueData[0]?.name || 'Unknown'
    debugPanel.log(`✓ CAE 模型加载成功 (${modelName})`)
    debugPanel.log(`模型尺寸: ${scaledSize.x.toFixed(2)} x ${scaledSize.y.toFixed(2)} x ${scaledSize.z.toFixed(2)}`)
    debugPanel.log(`数值范围: ${minval.toFixed(2)} ~ ${maxval.toFixed(2)}`)
    debugPanel.log('桌面: 鼠标拖动旋转查看 / VR: 点击"Enter VR"按钮进入')

    // 更新 GUI 标题和模型信息
    if (gui && geometry.attributes.position) {
      gui.title(`CAE 模型控制 - ${modelName}`)

      const vertexCount = geometry.attributes.position.count
      const faceCount = geometry.index ? geometry.index.count / 3 : vertexCount / 3
      updateGUIModelInfo(modelName, vertexCount, faceCount, scaledSize)

      // 设置类型节点数据
      setupTypeNodeGUI()
    }

  } catch (error) {
    console.error('加载 CAE 模型失败:', error)
    debugPanel.log('✗ CAE 模型加载失败')
  }
}

// 设置类型节点选择器
let frameController: any = null

function setupTypeNodeGUI() {
  if (!gui) return

  // 构建类型列表和节点数据
  const types: string[] = []
  newTaskValues.forEach(v => {
    types.push(v.name)
    if (!guiParams.nodes[v.name]) {
      guiParams.nodes[v.name] = v.value
    }
  })

  if (types.length === 0) return

  // 设置初始类型
  guiParams.typenode = types[0] || ''
  guiParams.nownode = guiParams.nodes[guiParams.typenode] || []

  // 设置初始帧
  if (guiParams.nownode.length > 0) {
    guiParams.frame = guiParams.nownode[0]?.key || ''
  }

  // 添加类型选择器到 GUI
  gui.add(guiParams, 'typenode', types)
    .name('数据类型')
    .onChange(() => {
      guiParams.nownode = guiParams.nodes[guiParams.typenode] || []
      if (guiParams.nownode.length > 0) {
        guiParams.frame = guiParams.nownode[0]?.key || ''
        updateTimes()

        // 更新帧选择器
        updateFrameController()
      }
      debugPanel.log(`数据类型: ${guiParams.typenode}`)
    })

  // 添加帧选择器
  updateFrameController()
}

// 更新帧选择控制器
function updateFrameController() {
  if (!gui) return

  // 移除旧的帧控制器
  if (frameController) {
    frameController.destroy()
    frameController = null
  }

  // 添加新的帧选择器
  if (guiParams.nownode.length > 0) {
    const frameKeys = guiParams.nownode.map(n => n.key || '')
    frameController = gui.add(guiParams, 'frame', frameKeys)
      .name('时间帧')
      .onChange(() => {
        updateTimes()
        debugPanel.log(`时间帧: ${guiParams.frame}`)
      })
  }
}

// 更新裁剪平面范围
function updateClippingPlaneRanges(bbox: THREE.Box3, scale: number, center: THREE.Vector3) {
  if (!gui) return

  // 计算变换后的包围盒
  // 模型现在底部在 y=0，X和Z居中
  const modelBottom = bbox.min.y * scale
  const transformedMin = new THREE.Vector3(
    bbox.min.x * scale - center.x * scale,
    -modelBottom + 0.01,
    bbox.min.z * scale - center.z * scale
  )
  const transformedMax = new THREE.Vector3(
    bbox.max.x * scale - center.x * scale,
    bbox.max.y * scale - modelBottom + 0.01,
    bbox.max.z * scale - center.z * scale
  )

  // 更新剖切平面的大小，确保能覆盖整个模型
  const size = new THREE.Vector3()
  new THREE.Box3(transformedMin, transformedMax).getSize(size)
  const maxSize = Math.max(size.x, size.y, size.z) * 2 // 放大一些确保覆盖

  planeObjects.forEach((po) => {
    const geometry = new THREE.PlaneGeometry(maxSize, maxSize)
    po.geometry.dispose()
    po.geometry = geometry
  })

  // 更新 planeHelper 的大小
  planeHelpers.forEach((ph) => {
    ph.size = maxSize
  })

  // 添加一些边距
  const margin = 0.1
  const minX = transformedMin.x + transformedMin.x * margin
  const maxX = transformedMax.x + transformedMax.x * margin
  const minY = transformedMin.y + transformedMin.y * margin
  const maxY = transformedMax.y + transformedMax.y * margin
  const minZ = transformedMin.z + transformedMin.z * margin
  const maxZ = transformedMax.z + transformedMax.z * margin

  // 找到 X/Y/Z 裁剪文件夹并更新
  const planeXFolder = gui.folders.find(f => f._title === 'X 轴裁剪')
  const planeYFolder = gui.folders.find(f => f._title === 'Y 轴裁剪')
  const planeZFolder = gui.folders.find(f => f._title === 'Z 轴裁剪')

  if (planeXFolder) {
    const controller = planeXFolder.controllers.find(c => c.property === 'scope')
    if (controller && planes[0]) {
      // 法线是 (-1,0,0)，所以 constant 越大，剪掉的越少
      controller.min(minX).max(maxX)
      guiParams.planeX.scope = maxX + 10
      planes[0].constant = maxX + 10
      controller.updateDisplay()
    }
  }

  if (planeYFolder) {
    const controller = planeYFolder.controllers.find(c => c.property === 'scope')
    if (controller && planes[1]) {
      // 法线是 (0,-1,0)，所以 constant 越大，剪掉的越少
      controller.min(minY).max(maxY)
      guiParams.planeY.scope = maxY + 10
      planes[1].constant = maxY + 10
      controller.updateDisplay()
    }
  }

  if (planeZFolder) {
    const controller = planeZFolder.controllers.find(c => c.property === 'scope')
    if (controller && planes[2]) {
      // 法线是 (0,0,-1)，所以 constant 越大，剪掉的越少
      controller.min(minZ).max(maxZ)
      guiParams.planeZ.scope = maxZ + 10
      planes[2].constant = maxZ + 10
      controller.updateDisplay()
    }
  }
}

// 更新颜色
function updateColors() {
  if (!caeMesh) return

  lut.setColorMap(guiParams.caeModel.colorMap)
  lut.setMax(maxval)
  lut.setMin(minval)

  const geometry = caeMesh.geometry
  const pressures = geometry.attributes.pressure
  const colors = geometry.attributes.color

  if (!pressures || !colors) return

  for (let i = 0; i < pressures.array.length; i++) {
    const colorValue = pressures.array[i] ?? 0
    const color = lut.getColor(colorValue)
    if (color) {
      colors.setXYZ(i, color.r, color.g, color.b)
    }
  }
  colors.needsUpdate = true

  // 更新 LUT 显示
  updateLutDisplay()
}

// 处理颜色映射切换
function handleColorMapChange() {
  guiParams.caeModel.colorMap = selectedColorMap.value
  updateColors()
}

// 更新 LUT 颜色条显示
function updateLutDisplay() {
  if (!lutRef.value || !shuzhiRef.value) return

  // 清除旧的显示
  while (lutRef.value.firstChild) {
    lutRef.value.removeChild(lutRef.value.firstChild)
  }
  while (shuzhiRef.value.firstChild) {
    shuzhiRef.value.removeChild(shuzhiRef.value.firstChild)
  }

  // 创建 LUT 颜色条
  const lutCanvas = lut.createCanvas()
  lutCanvas.style.width = '1rem'
  lutCanvas.style.height = `${Math.min(window.innerHeight * 0.7, 415)}px`
  lutRef.value.appendChild(lutCanvas)

  // 创建数值标签
  const mrW = 100
  const mrH = Math.min(window.innerHeight * 0.7, 415)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = mrW
  canvas.height = mrH + 40
  ctx.font = '12px bold'
  ctx.strokeStyle = '#ffffff'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'

  const isShowPoint = Math.max(Math.abs(maxval), Math.abs(minval)) >= 100

  // 绘制数值刻度
  for (let i = 0; i <= 10; i++) {
    const value = maxval - ((maxval - minval) / 10) * i
    const y = 7 + ((mrH - 14) / 10) * i
    ctx.fillText(formatNumber(value, isShowPoint), mrW, y)
  }

  // 绘制单位和类型
  const unit = newTaskValues[0]?.unit || ''
  const name = newTaskValues[0]?.name || ''
  ctx.fillText(unit, mrW, mrH + 14)
  ctx.fillText(name, mrW, mrH + 32)

  shuzhiRef.value.appendChild(canvas)
}

// 格式化数字显示
function formatNumber(value: number, isShowPoint?: boolean): string {
  if (isShowPoint === undefined) {
    isShowPoint = Math.abs(value) >= 100
  }

  if (Math.abs(value) < 0.01 && value !== 0) {
    return value.toExponential(2)
  }

  if (isShowPoint) {
    return Math.floor(value).toString()
  } else {
    return value.toFixed(2)
  }
}

// UV 映射函数
function _applyBoxUV(geom: THREE.BufferGeometry, transformMatrix: THREE.Matrix4, bbox: THREE.Box3, bbox_max_size: number) {
  const coords: number[] = [];
  const positionAttr = geom.attributes.position;
  if (!positionAttr) {
    return;
  }
  coords.length = (2 * positionAttr.array.length) / 3;

  if (geom.attributes.uv === undefined) {
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(coords, 2));
  }

  const makeUVs = function (v0: THREE.Vector3, v1: THREE.Vector3, v2: THREE.Vector3) {
    v0.applyMatrix4(transformMatrix);
    v1.applyMatrix4(transformMatrix);
    v2.applyMatrix4(transformMatrix);

    const n = new THREE.Vector3();
    n.crossVectors(v1.clone().sub(v0), v1.clone().sub(v2)).normalize();
    n.x = Math.abs(n.x);
    n.y = Math.abs(n.y);
    n.z = Math.abs(n.z);

    const uv0 = new THREE.Vector2();
    const uv1 = new THREE.Vector2();
    const uv2 = new THREE.Vector2();

    if (n.y > n.x && n.y > n.z) {
      uv0.x = (v0.x - bbox.min.x) / bbox_max_size;
      uv0.y = (bbox.max.z - v0.z) / bbox_max_size;
      uv1.x = (v1.x - bbox.min.x) / bbox_max_size;
      uv1.y = (bbox.max.z - v1.z) / bbox_max_size;
      uv2.x = (v2.x - bbox.min.x) / bbox_max_size;
      uv2.y = (bbox.max.z - v2.z) / bbox_max_size;
    } else if (n.x > n.y && n.x > n.z) {
      uv0.x = (v0.z - bbox.min.z) / bbox_max_size;
      uv0.y = (v0.y - bbox.min.y) / bbox_max_size;
      uv1.x = (v1.z - bbox.min.z) / bbox_max_size;
      uv1.y = (v1.y - bbox.min.y) / bbox_max_size;
      uv2.x = (v2.z - bbox.min.z) / bbox_max_size;
      uv2.y = (v2.y - bbox.min.y) / bbox_max_size;
    } else if (n.z > n.y && n.z > n.x) {
      uv0.x = (v0.x - bbox.min.x) / bbox_max_size;
      uv0.y = (v0.y - bbox.min.y) / bbox_max_size;
      uv1.x = (v1.x - bbox.min.x) / bbox_max_size;
      uv1.y = (v1.y - bbox.min.y) / bbox_max_size;
      uv2.x = (v2.x - bbox.min.x) / bbox_max_size;
      uv2.y = (v2.y - bbox.min.y) / bbox_max_size;
    }

    return { uv0: uv0, uv1: uv1, uv2: uv2 };
  };

  if (geom.index && positionAttr) {
    for (let vi = 0; vi < geom.index.array.length; vi += 3) {
      const idx0 = geom.index.array[vi] ?? 0;
      const idx1 = geom.index.array[vi + 1] ?? 0;
      const idx2 = geom.index.array[vi + 2] ?? 0;

      const vx0 = positionAttr.array[3 * idx0] ?? 0;
      const vy0 = positionAttr.array[3 * idx0 + 1] ?? 0;
      const vz0 = positionAttr.array[3 * idx0 + 2] ?? 0;

      const vx1 = positionAttr.array[3 * idx1] ?? 0;
      const vy1 = positionAttr.array[3 * idx1 + 1] ?? 0;
      const vz1 = positionAttr.array[3 * idx1 + 2] ?? 0;

      const vx2 = positionAttr.array[3 * idx2] ?? 0;
      const vy2 = positionAttr.array[3 * idx2 + 1] ?? 0;
      const vz2 = positionAttr.array[3 * idx2 + 2] ?? 0;

      const v0 = new THREE.Vector3(vx0, vy0, vz0);
      const v1 = new THREE.Vector3(vx1, vy1, vz1);
      const v2 = new THREE.Vector3(vx2, vy2, vz2);

      const uvs = makeUVs(v0, v1, v2);

      coords[2 * idx0] = uvs.uv0.x;
      coords[2 * idx0 + 1] = uvs.uv0.y;
      coords[2 * idx1] = uvs.uv1.x;
      coords[2 * idx1 + 1] = uvs.uv1.y;
      coords[2 * idx2] = uvs.uv2.x;
      coords[2 * idx2 + 1] = uvs.uv2.y;
    }
  }

  const uvAttr = geom.attributes.uv;
  if (uvAttr) {
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(coords, 2));
  }
}

function applyBoxUV(bufferGeometry: THREE.BufferGeometry, transformMatrix: THREE.Matrix4 | undefined = undefined, boxSize: number | undefined = undefined) {
  if (transformMatrix === undefined) {
    transformMatrix = new THREE.Matrix4();
  }

  if (boxSize === undefined) {
    const geom = bufferGeometry;
    geom.computeBoundingBox();
    const bbox = geom.boundingBox;

    if (!bbox) {
      return;
    }

    const bbox_size_x = bbox.max.x - bbox.min.x;
    const bbox_size_z = bbox.max.z - bbox.min.z;
    const bbox_size_y = bbox.max.y - bbox.min.y;

    boxSize = Math.max(bbox_size_x, bbox_size_y, bbox_size_z);
  }

  const uvBbox = new THREE.Box3(
    new THREE.Vector3(-boxSize / 2, -boxSize / 2, -boxSize / 2),
    new THREE.Vector3(boxSize / 2, boxSize / 2, boxSize / 2)
  );

  _applyBoxUV(bufferGeometry, transformMatrix, uvBbox, boxSize);
}

// 更新时间帧数据
function updateTimes() {
  newTaskValues.forEach(v => {
    if (v.name === guiParams.typenode) {
      const val = v.value.find(s => s.key === guiParams.frame);
      if (val && val.val && caeMesh) {
        const geometry = caeMesh.geometry as THREE.BufferGeometry
        geometry.setAttribute('pressure', new THREE.Float32BufferAttribute(val.val, 1));

        const pressureArray = val.val;
        maxval = Math.max(...pressureArray);
        minval = Math.min(...pressureArray);

        updateColors();
        updateLutDisplay();
      }
    }
  });
}

// 动画播放
function playAnimation() {
  if (!guiParams.nownode || guiParams.nownode.length === 0) return;

  let currentFrameIndex = 0;

  const animate = () => {
    if (!guiParams.animate) return;

    const frameData = guiParams.nownode[currentFrameIndex];
    if (frameData && frameData.key) {
      guiParams.frame = frameData.key;
      updateTimes();

      currentFrameIndex = (currentFrameIndex + 1) % guiParams.nownode.length;

      animationFrameId = window.setTimeout(() => {
        requestAnimationFrame(animate);
      }, 100); // 每100ms切换一帧
    }
  };

  animate();
}

// 停止动画
function stopAnimation() {
  if (animationFrameId !== null) {
    clearTimeout(animationFrameId);
    animationFrameId = null;
  }
}

// 鼠标悬停显示数值
function initMouseValueDisplay() {
  window.addEventListener('mousemove', (event) => {
    if (!caeMesh || guiParams.caeModel.opacity === 0) {
      showValuePopover.value = false
      return
    }

    clearTimeout(setValueTimeout)
    setValueTimeout = setTimeout(() => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
      mouseLocation.x = event.clientX + 20
      mouseLocation.y = event.clientY + 20

      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObject(caeMesh!)

      if (intersects.length > 0 && intersects[0]) {
        const face = intersects[0].face
        const object = intersects[0].object as THREE.Mesh
        const pressure = object.geometry.attributes.pressure

        if (face && pressure) {
          const values = [
            pressure.array[face.a],
            pressure.array[face.b],
            pressure.array[face.c]
          ].filter((v): v is number => v !== undefined)

          if (values.length > 0) {
            pointValue.value = values.reduce((a, b) => a + b) / values.length
            showValuePopover.value = true
            return
          }
        }
      }

      showValuePopover.value = false
    }, 100)
  })
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

  // 更新 CSS3D 渲染器
  // HTMLMesh 不需要单独调整renderer大小
}




// 游戏逻辑状态 - 由VR管理器内部管理
let groundLevel = 0.6 // VR 眼睛高度，会在模型加载后更新
let grabbedObject: THREE.Object3D | null = null // 当前被抓取的物体

const isVRMode = ref(false)

function animationLoop() {
  const deltaTime = clock.getDelta()
  const elapsedTime = clock.getElapsedTime()

  // 更新 OrbitControls
  if (controls.enabled) {
    controls.update()
  }

  // 更新剖切平面位置和朝向
  for (let i = 0; i < planeObjects.length; i++) {
    const plane = planes[i];
    const po = planeObjects[i];
    if (plane && po) {
      plane.coplanarPoint(po.position);
      po.lookAt(
        po.position.x - plane.normal.x,
        po.position.y - plane.normal.y,
        po.position.z - plane.normal.z
      );
    }
  }

  // 让物体自动旋转（除非被抓取或是 CAE 模型）
  if (guiParams.testObjects.animate) {
    interactableObjects.forEach((obj, index) => {
      // 获取VR管理器中的被抓取物体状态
      const vrGrabbedObject = vrManager ? vrManager.getGrabbedObject() : null
      if (obj !== vrGrabbedObject && obj !== grabbedObject && obj !== caeMesh) {
        obj.rotation.y += deltaTime * 0.5
        obj.rotation.x += deltaTime * 0.2
        // 添加上下浮动效果
        obj.position.y = 0.3 + Math.sin(elapsedTime + index * 1.2) * 0.1
      }
    })
  }

  // 更新 VR 状态
  if (vrManager) {
    vrManager.update()
    // 同步VR管理器中的抓取状态
    grabbedObject = vrManager.getGrabbedObject()
  }

  // 渲染场景
  renderer.clear();
  renderer.render(scene, camera)

  // 更新HTMLMesh材质贴图（如果GUI包含Canvas元素）
  // Canvas元素不会触发DOM更新，所以需要手动更新纹理
  if (interactiveGroup) {
    interactiveGroup.children.forEach((child: any) => {
      if (child instanceof HTMLMesh && child.material?.map) {
        // 对于CanvasTexture，调用其update方法
        if ('update' in child.material.map) {
          (child.material.map as any).update();
        }
      }
    });
  }
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
  // initObject();
  initDebugPanel();
  initGUI();

  // 初始化 VR 管理器
  vrManager = new VRManager({
    renderer,
    scene,
    camera,
    controls,
    gui: gui || undefined,
    mesh: caeMesh || undefined,
    debugPanel,
    testObjects: interactableObjects as THREE.Mesh[],
    caeModelCenter,
    caeViewDistance,
    onSessionStart: () => {
      isVRMode.value = true
      debugPanel.hide()
    },
    onSessionEnd: () => {
      isVRMode.value = false
      debugPanel.show()
    }
  })
  vrManager.init(container.value)

  // 加载 CAE 模型
  loadCAEModel();

  // 初始化鼠标悬停数值显示
  initMouseValueDisplay();

  window.addEventListener('resize', handleResize)

  // 主动画循环
  renderer.setAnimationLoop(animationLoop)

  // 等待 GUI 初始化后再创建 HTMLMesh
  setTimeout(() => {
    initCSS3DGUI();
  }, 1000);
})

// 组件卸载时的清理
onUnmounted(() => {
  if (animationCleanup) {
    animationCleanup()
  }
  if (vrManager) {
    vrManager.dispose()
  }
})
</script>

<template>
  <div ref="container" class="model-container"></div>

  <!-- 颜色映射选择 -->
  <div class="color-map-selector">
    <select v-model="selectedColorMap" @change="handleColorMapChange">
      <option value="rainbow">彩虹</option>
      <option value="cooltowarm">冷暖</option>
      <option value="blackbody">黑体</option>
      <option value="grayscale">灰度</option>
      <option value="water">水色</option>
      <option value="water2">水色2</option>
    </select>
  </div>

  <!-- LUT 颜色条和数值显示 -->
  <div class="lut-shuzhi">
    <div class="flex">
      <div ref="shuzhiRef" class="mr-1" />
      <div ref="lutRef" />
    </div>
  </div>

  <!-- 鼠标悬停数值显示 -->
  <div v-show="showValuePopover" :style="{ left: `${mouseLocation.x}px`, top: `${mouseLocation.y}px` }"
    class="value-popover">
    {{ formatNumber(pointValue) }}
  </div>
</template>

<style scoped>
.model-container {
  width: 100%;
  height: 100%;
}

.color-map-selector {
  position: absolute;
  top: 2%;
  left: 2%;
  z-index: 100;
}

.color-map-selector select {
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  outline: none;
}

.color-map-selector select:hover {
  border-color: #999;
}

.lut-shuzhi {
  position: absolute;
  top: 4%;
  right: 2%;
  pointer-events: none;
}

.flex {
  display: flex;
  align-items: flex-start;
}

.mr-1 {
  margin-right: 0.5rem;
}

.value-popover {
  position: absolute;
  color: #ffffff;
  background-color: rgba(0, 0, 0, 0.7);
  padding: 0.5rem;
  border: 1px solid #a3a3a3;
  border-radius: 7px;
  pointer-events: none;
  font-size: 12px;
  z-index: 1000;
}
</style>
