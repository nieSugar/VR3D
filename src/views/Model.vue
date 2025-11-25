<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRManager } from '../utils/VRManager'
import { Lut } from 'three/examples/jsm/math/Lut.js'
import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js'
import { InteractiveGroup } from 'three/examples/jsm/interactive/InteractiveGroup.js'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import CustomCheckbox from '../components/CustomCheckbox.vue'
import CustomSelectV2, { type SelectOption } from '../components/CustomSelectV2.vue'
import CustomSlider from '../components/CustomSlider.vue'
import { Reflector } from 'three/examples/jsm/objects/Reflector.js'

// -----------------------------------------------------------------------------
// 类型定义
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// DOM/Overlay 引用 & 状态
// -----------------------------------------------------------------------------
const container = ref<HTMLDivElement | null>(null)
const lutRef = ref<HTMLDivElement | null>(null)
const shuzhiRef = ref<HTMLDivElement | null>(null)
const guiPanelRef = ref<HTMLElement | null>(null) // GUI 面板引用
const lutBodyRef = ref<HTMLDivElement | null>(null) // Lut 面板引用（3D VR 版本）
const lutRef2D = ref<HTMLDivElement | null>(null) // Lut 2D 显示引用
const shuzhiRef2D = ref<HTMLDivElement | null>(null) // 数值 2D 显示引用
const showValuePopover = ref(false)
const pointValue = ref(0)
const mouseLocation = reactive({ x: 0, y: 0 })

// -----------------------------------------------------------------------------
// Three.js 核心状态
// -----------------------------------------------------------------------------
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let controls: OrbitControls
let vrManager: VRManager

let interactiveGroup: InteractiveGroup | null = null // 交互组
let guiMesh: HTMLMesh | null = null // GUI HTMLMesh
let lutMesh: HTMLMesh | null = null // Lut HTMLMesh
let domObserver: MutationObserver | null = null // DOM 观察器
let controller1: THREE.Group | null = null // VR 控制器1
let controller2: THREE.Group | null = null // VR 控制器2
let caeMesh: THREE.Mesh | null = null
let caePivot: THREE.Group | null = null
let caeModelCenter = new THREE.Vector3(0, 0, 0) // CAE 模型中心位置
let caeViewDistance = 5 // 观看 CAE 模型的合适距离
let baseSceneModel: THREE.Group | null = null // 基础场景模型
let sceneBoundaryBox: THREE.Box3Helper | null = null // 场景边界盒子

// 切面相关变量
let meshClip: THREE.Mesh | null = null // 切面网格
let modelOffsetY = 0 // 模型 Y 轴偏移量，用于切面计算
let getClipFrameTimeout: number | undefined // 切面请求防抖定时器
const clipUrl: string | undefined = '/api/Clip' // 切面数据请求 URL
const clipPath: string | undefined = '' // 切面数据文件路径

let lut = new Lut()
let planes: THREE.Plane[] = []
let planeHelpers: THREE.PlaneHelper[] = []
let planeObjects: THREE.Mesh[] = []
let maxval = 1
let minval = 0

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let setValueTimeout: number
const animationStepSeconds = 0.5 // 数据帧切换间隔（秒）
let animationElapsed = 0
let animationFrameIndex = 0
let isDataAnimationPlaying = false

// -----------------------------------------------------------------------------
// 颜色映射定义
// -----------------------------------------------------------------------------
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

// 选项列表
const colorMapOptions: SelectOption[] = [
  { value: 'water', label: '水色' },
  { value: 'rainbow', label: '彩虹' },
  { value: 'cooltowarm', label: '冷暖' },
  { value: 'blackbody', label: '黑体' },
  { value: 'grayscale', label: '灰度' },
  { value: 'wite', label: '白黑' }
];

// 数据类型选项（动态生成）
const typeNodeOptions = ref<SelectOption[]>([]);

const modelNameOptions = ['re10', 're100', 're10000', 'comsol'].map(s => ({ value: `${s}Json`, label: s }));

// 时间帧选项（动态生成）
const frameOptions = ref<SelectOption[]>([]);

// 数据缓存与交互对象
const newTaskValues: Array<{
  value: Array<Task>;
  name: string;
  nameKey: string;
  unit: string;
  valIsArray: boolean;
}> = [];

const interactableObjects: THREE.Object3D[] = [];

// 裁剪面滑块范围
const planeRanges = ref({
  x: { min: -10, max: 10 },
  y: { min: -10, max: 10 },
  z: { min: -10, max: 10 }
});

// GUI 显示状态
const isVRMode = ref(false);
const showGUI2D = ref(true); // 控制 2D GUI 面板显示（桌面模式下默认显示）
const showGUI3D = ref(true); // 控制 3D GUI 面板显示（默认显示）

// 运行时辅助状态
const originalMaterials = new Map<THREE.Object3D, THREE.Material>();

// GUI 参数
const guiParams = reactive({
  // CAE 模型控制
  caeModel: {
    visible: true,
    wireframe: false,
    opacity: 1.0,
    color: '#4ecdc4',
    metalness: 0.3,
    roughness: 0.5,
    colorMap: 'rainbow',
  },
  // 场景控制
  scene: {
    backgroundColor: '#1a1a2e',
  },
  // 旋转控制
  rotation: {
    upDown: false,        // 上下旋转开关
    leftRight: false,     // 左右旋转开关
    speed: 1.0,           // 旋转速度（统一控制）
  },
  // 裁剪平面
  planeX: { scope: 0, plan: false },
  planeY: { scope: 0, plan: false },
  planeZ: { scope: 0, plan: false },
  modelName: 'comsolJson',
  // 时间帧控制
  currentFrame: 0,
  frames: [] as string[],
  // 数据类型和时间帧
  typenode: '',
  frame: '',
  animate: false,
  nodes: {} as Record<string, Array<Task>>,
  nownode: [] as Array<Task>,
});

setupCaeModelWatchers()
setupAnimationWatchers()
setupPlaneWatchers()
setupDataWatchers()
registerLifecycleHooks()

function setupCaeModelWatchers() {
  watch(() => guiParams.caeModel.visible, (value: boolean) => {
    if (caeMesh) {
      caeMesh.visible = value
    }
  })

  watch(() => guiParams.caeModel.wireframe, (value: boolean) => {
    if (caeMesh && caeMesh.material) {
      (caeMesh.material as THREE.MeshStandardMaterial).wireframe = value
    }
  })

  watch(() => guiParams.caeModel.opacity, (value: number) => {
    if (caeMesh && caeMesh.material) {
      const material = caeMesh.material as THREE.MeshStandardMaterial
      material.opacity = value
      material.transparent = value < 1
    }
  })

  watch(() => guiParams.caeModel.metalness, (value: number) => {
    if (caeMesh && caeMesh.material) {
      (caeMesh.material as THREE.MeshStandardMaterial).metalness = value
    }
  })

  watch(() => guiParams.caeModel.roughness, (value: number) => {
    if (caeMesh && caeMesh.material) {
      (caeMesh.material as THREE.MeshStandardMaterial).roughness = value
    }
  })

  watch(() => guiParams.caeModel.colorMap, () => {
    updateColors()
  })

  watch(() => guiParams.modelName, () => {
    if (caeMesh) {
      scene.remove(caeMesh);
      caeMesh = null;
      loadCAEModel();
    }
  });
}

function setupAnimationWatchers() {
  watch(() => guiParams.animate, (value: boolean) => {
    if (value) {
      playAnimation()
    } else {
      stopAnimation()
    }
  })
}

function setupPlaneWatchers() {
  watch(() => guiParams.planeX.scope, (d: number) => {
    if (planes[0]) planes[0].constant = d
    planeChange('x')
  })
  watch(() => guiParams.planeX.plan, (v: boolean) => {
    if (planeHelpers[0]) planeHelpers[0].visible = v
  })

  watch(() => guiParams.planeY.scope, (d: number) => {
    if (planes[1]) planes[1].constant = d
    planeChange('y')
  })
  watch(() => guiParams.planeY.plan, (v: boolean) => {
    if (planeHelpers[1]) planeHelpers[1].visible = v
  })

  watch(() => guiParams.planeZ.scope, (d: number) => {
    if (planes[2]) planes[2].constant = d
    planeChange('z')
  })
  watch(() => guiParams.planeZ.plan, (v: boolean) => {
    if (planeHelpers[2]) planeHelpers[2].visible = v
  })
}

function setupDataWatchers() {
  watch(() => guiParams.typenode, (newType) => {
    guiParams.nownode = guiParams.nodes[newType] || []
    if (guiParams.nownode.length > 0) {
      guiParams.frame = guiParams.nownode[0]?.key || ''
      updateTimes()
      updateFrameOptions()
    } else {
      guiParams.frame = ''
      frameOptions.value = []
    }
  })

  watch(() => guiParams.frame, () => {
    updateTimes()
  })
}

// ----------------------------------------------------------------------------- 
// Three.js 初始化帮助方法
// -----------------------------------------------------------------------------

// 动画时钟（用于物体动画）
const clock = new THREE.Clock()

function initSceneAndLight() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)
  // scene.fog = new THREE.Fog(0x1a1a2e, 5, 20) // 去掉雾效果

  // 添加环境光和方向光 - 室内光照
  // const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  // scene.add(ambientLight)

  // const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
  // directionalLight.position.set(5, 10, 5)
  // directionalLight.castShadow = true
  // directionalLight.shadow.mapSize.width = 2048
  // directionalLight.shadow.mapSize.height = 2048
  // scene.add(directionalLight)

  // // 添加点光源模拟室内灯光
  // const pointLight = new THREE.PointLight(0xffffff, 0.4)
  // pointLight.position.set(0, 5, 0)
  // scene.add(pointLight)

  // 初始化裁剪平面
  planes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), // X 轴平面
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), // Y 轴平面
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)  // Z 轴平面
  ];

  // 添加平面辅助器
  // planeHelpers = planes.map(p => new THREE.PlaneHelper(p, 20, 0xffffff));
  // planeHelpers.forEach(ph => {
  //   ph.visible = false;
  //   scene.add(ph);
  // });

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
    // scene.add(poGroup);
  }

  // // 去掉地面 - 使用室内场景
  // const groundGeometry = new THREE.PlaneGeometry(20, 20)
  // const groundMaterial = new THREE.MeshStandardMaterial({
  //   color: 0x2d2d44,
  //   roughness: 0.8,
  //   metalness: 0.2
  // })
  // ground = new THREE.Mesh(groundGeometry, groundMaterial)
  // ground.rotation.x = -Math.PI / 2
  // ground.receiveShadow = true
  // scene.add(ground)
}

function initCamera() {
  if (!container?.value) return
  const aspect = container.value.clientWidth / container.value.clientHeight
  camera = new THREE.PerspectiveCamera(60, aspect, 1, 999999999)
  camera.position.set(0, 1.6, 0) // 相机在场景中心，等待模型加载后会调整到房间内部
  scene.add(camera)
}

function initRenderer() {
  if (!container?.value) return
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    logarithmicDepthBuffer: true
  })
  renderer.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true; // 启用本地裁剪
  renderer.autoClear = false; // 用于 stencil buffer

  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1;
  container.value.appendChild(renderer.domElement);

}

function initControls() {
  if (!camera || !renderer) return
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.screenSpacePanning = false;
  controls.minDistance = 0.5; // 更近的最小距离，适合室内
  controls.maxDistance = 50; // 减小最大距离，适合室内场景
  controls.maxPolarAngle = Math.PI; // 允许相机看到天花板
  // 初始目标指向场景中心，场景模型加载后会更新
  controls.target.set(0, 1.6, 0); // 初始看向眼睛高度
}

// 初始化 VR 交互组件
function initVRInteraction() {
  if (!renderer || !camera) return

  // 创建交互组
  interactiveGroup = new InteractiveGroup()
  interactiveGroup.listenToPointerEvents(renderer, camera)
  scene.add(interactiveGroup)

  // 创建 VR 控制器
  const geometry = new THREE.BufferGeometry()
  geometry.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)])
  const material = new THREE.LineBasicMaterial({ color: 0xffffff })

  controller1 = renderer.xr.getController(0)
  controller1.add(new THREE.Line(geometry, material))
  scene.add(controller1)

  controller2 = renderer.xr.getController(1)
  controller2.add(new THREE.Line(geometry.clone(), material.clone()))
  scene.add(controller2)

  // 为交互组添加控制器监听
  interactiveGroup.listenToXRControllerEvents(controller1 as any)
  interactiveGroup.listenToXRControllerEvents(controller2 as any)

  // 添加控制器模型
  const controllerModelFactory = new XRControllerModelFactory()

  const controllerGrip1 = renderer.xr.getControllerGrip(0)
  controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1))
  scene.add(controllerGrip1)

  const controllerGrip2 = renderer.xr.getControllerGrip(1)
  controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2))
  scene.add(controllerGrip2)

  // 创建 GUI HTMLMesh（延迟创建以确保DOM已准备好）
  setTimeout(() => {
    if (guiPanelRef.value && interactiveGroup) {
      guiMesh = new HTMLMesh(guiPanelRef.value)
      // 临时位置，等模型加载后会更新为相对于模型的位置
      guiMesh.position.set(-1.0, 1.5, -2.0)
      guiMesh.quaternion.identity()
      guiMesh.scale.setScalar(2.5)
      guiMesh.name = 'GUI_Mesh';
      interactiveGroup.add(guiMesh)

      // 设置 MutationObserver 监听 DOM 变化
      domObserver = new MutationObserver(() => {
        if (guiMesh && guiMesh.material && guiMesh.material.map) {
          guiMesh.material.map.needsUpdate = true
        }
      })

      domObserver.observe(guiPanelRef.value, {
        attributes: true,
        childList: true,
        subtree: true,
        characterData: true
      })
    }
    if (lutBodyRef.value && interactiveGroup) {
      lutMesh = new HTMLMesh(lutBodyRef.value);
      // 临时位置，等模型加载后会更新为相对于模型的位置
      lutMesh.position.set(-3.0, 1.5, -2.0);
      lutMesh.quaternion.identity();
      lutMesh.scale.setScalar(3);
      lutMesh.name = 'LUT_Mesh';
      interactiveGroup.add(lutMesh)
    }
  }, 100) // 延迟100ms确保DOM已完全渲染
}

async function initRenderPipeline() {
  initSceneAndLight();
  initCamera();
  initRenderer();
  initControls();
  initVRInteraction();
}

// 更新面板位置，使其相对于 caeModel 定位
function updateVRUIPanels() {
  if (!caePivot || !caeModelCenter) return
  if (!guiMesh && !lutMesh) return

  // GUI面板固定在caemodel左侧
  if (guiMesh) {
    guiMesh.position.set(
      caeModelCenter.x - 3,  // 左侧
      caeModelCenter.y,       // 与模型同高
      caeModelCenter.z
    )
    guiMesh.quaternion.identity()
  }

  // LUT面板固定在caemodel右侧
  if (lutMesh) {
    lutMesh.position.set(
      caeModelCenter.x + 3,  // 右侧
      caeModelCenter.y - 0.5,
      caeModelCenter.z
    )
    lutMesh.quaternion.identity()
  }
}

async function preloadSceneAssets() {
  await loadBaseScene();
  await loadHDR();
  await loadCAEModel();
}

// -----------------------------------------------------------------------------
// 资源加载 & 数据准备
// -----------------------------------------------------------------------------

// 加载 CAE 模型数据
async function loadCAEModel() {
  try {

    // 加载节点数据和数值数据
    const [nodeResponse, valueResponse] = await Promise.all([
      fetch(`/assets/objects/${guiParams.modelName}/FNode.json`).then(r => r.json()),
      fetch(`/assets/objects/${guiParams.modelName}/FValue.json`).then(r => r.json())
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

    // 计算包围盒
    geometry.computeBoundingBox()
    const bbox = geometry.boundingBox!

    // Y 轴偏移，让模型底部在 y在0 的基础上加
    const offsetY = -bbox.min.y
    modelOffsetY = offsetY // 保存偏移量供切面计算使用
    const positionAttr = geometry.attributes.position
    if (positionAttr) {
      const positions = positionAttr.array as Float32Array
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] = (positions[i] ?? 0) + offsetY
      }
      positionAttr.needsUpdate = true
    }

    // 重新计算包围盒（因为位置已改变）
    geometry.computeBoundingBox()

    const colors = [];
    for (let i = 0, n = geometry.attributes.position?.count || 0; i < n; ++i) {
      colors.push(1, 1, 1);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const data = newTaskValues[0]?.value || [];
    // 设置压力属性
    geometry.setAttribute('pressure', new THREE.Float32BufferAttribute(data[0]?.val || [], 1))

    // 计算法线
    geometry.computeVertexNormals()

    // 应用 UV 映射
    applyBoxUV(geometry)

    // 创建材质
    const material = new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      metalness: 0,
      roughness: 0,
      vertexColors: true,
      clippingPlanes: planes,
    })

    // 创建网格
    caeMesh = new THREE.Mesh(geometry, material)
    caeMesh.castShadow = true
    caeMesh.receiveShadow = true
    caeMesh.name = 'CAE_Model'


    scene.add(caeMesh)
    interactableObjects.push(caeMesh)
    alignCaeModelToBaseScene()

    // 计算最大最小值用于颜色映射
    const pressureArray = data[0]?.val || []
    maxval = Math.max(...pressureArray)
    minval = Math.min(...pressureArray)

    // 更新颜色
    updateColors()
    updateLutDisplay()

    // 使用 focusObj 自动调整相机（聚焦到 pivot 组）
    if (caePivot) {
      focusObj(caePivot)
    } else {
      focusObj(caeMesh)
    }

    // 更新裁剪平面范围（使用变换后的包围盒）
    updateClippingPlaneRanges()

    // 设置类型节点数据和选项
    setupTypeNodeOptions()

    // 更新面板位置，使其相对于模型定位
    updateVRUIPanels()

  } catch (error) {
    console.error('加载 CAE 模型失败:', error)
  }
}

async function loadHDR() {

  const loader = new HDRLoader();
  const env = await loader.loadAsync('/assets/hdr/empty_play_room_2k.hdr');
  const bg = await loader.loadAsync('/assets/hdr/bambanani_sunset_2k.hdr');

  env.mapping = THREE.EquirectangularReflectionMapping;
  bg.mapping = THREE.EquirectangularReflectionMapping;

  // 预滤波后再用作环境
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromEquirectangular(env);
  scene.environment = envRT.texture;
  scene.background = bg;
  pmrem.dispose();
  env.dispose();

  scene.environmentIntensity = 0.5;
  scene.environmentRotation.y = 60 * THREE.MathUtils.DEG2RAD;
  scene.backgroundBlurriness = 0;


  scene.backgroundBlurriness = 0;
  scene.backgroundIntensity = 0.5;
  scene.backgroundRotation.y = 60 * THREE.MathUtils.DEG2RAD;
}


// 加载基础场景 GLB 模型
async function loadBaseScene() {
  try {
    const loader = new GLTFLoader()
    // 加载 tjdx.glb 模型
    const gltf = await loader.loadAsync('/assets/models/tjdx.glb')

    baseSceneModel = gltf.scene;
    baseSceneModel.name = 'Base-Scene';

    // 调整模型大小和位置（根据需要）
    baseSceneModel.scale.set(2, 2, 2)
    baseSceneModel.position.set(0, 0, 0)

    // 设置模型材质属性
    baseSceneModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true

        // 如果材质是 MeshStandardMaterial，可以调整属性
        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.roughness = 0.7
          child.material.metalness = 0.3
        }
      }
    })
    // floorPost();

    // 添加到场景
    scene.add(baseSceneModel)

    // 计算边界并创建边界框
    const bbox = new THREE.Box3().setFromObject(baseSceneModel)
    const center = bbox.getCenter(new THREE.Vector3())
    const size = bbox.getSize(new THREE.Vector3())

    // 创建可视化边界框（调试用，可以设置为不可见）
    sceneBoundaryBox = new THREE.Box3Helper(bbox, 0x00ff00)
    sceneBoundaryBox.visible = true // 默认不显示边界框
    scene.add(sceneBoundaryBox)

    // 创建不可见的碰撞边界
    const boundaryGeometry = new THREE.BoxGeometry(size.x * 1.1, size.y * 1.1, size.z * 1.1)
    const boundaryMaterial = new THREE.MeshBasicMaterial({
      visible: false,
      wireframe: true
    })
    const boundaryMesh = new THREE.Mesh(boundaryGeometry, boundaryMaterial)
    boundaryMesh.position.copy(center)
    boundaryMesh.name = 'sceneBoundary'
    scene.add(boundaryMesh)

    // 更新相机位置到房间内部
    // 假设房间中心稍微偏上一点作为眼睛高度
    camera.position.set(center.x, center.y + 1.6, center.z)
    controls.target.set(center.x, center.y + 1.6, center.z - 2) // 看向前方
    controls.update()

    // TODO: 设置边界
    // if (vrManager) {
    //   vrManager.setBoundary({
    //     minX: bbox.min.x,
    //     maxX: bbox.max.x,
    //     minZ: bbox.min.z,
    //     maxZ: bbox.max.z
    //   })
    // }

  } catch (error) {
    console.error('加载基础场景失败:', error)
  }
}

// 将 CAE 模型中心对齐到基础场景中心，并按场景大小缩放
function alignCaeModelToBaseScene() {
  if (!caeMesh) return

  const caeBox = new THREE.Box3().setFromObject(caeMesh)
  // 固定 1x1x1 的参考尺寸
  const targetSize = new THREE.Vector3(4, 4, 4)
  const caeSize = caeBox.getSize(new THREE.Vector3())

  // 留出一定余量，取最小轴的比例，避免撑满整个场景
  const safeCaeSize = new THREE.Vector3(
    Math.max(caeSize.x, 0.001),
    Math.max(caeSize.y, 0.001),
    Math.max(caeSize.z, 0.001),
  )
  const scaleX = targetSize.x / safeCaeSize.x
  const scaleY = targetSize.y / safeCaeSize.y
  const scaleZ = targetSize.z / safeCaeSize.z
  const fitScale = Math.min(scaleX, scaleY, scaleZ)
  if (Number.isFinite(fitScale) && fitScale > 0) {
    caeMesh.scale.setScalar(fitScale);
    caeMesh.updateMatrixWorld(true)
  }

  // 缩放后计算几何中心
  caeMesh.updateMatrixWorld(true)
  const scaledBox = new THREE.Box3().setFromObject(caeMesh)
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3())

  // 目标显示位置
  const targetCenter = new THREE.Vector3(scaledCenter.x - 1.5, scaledCenter.y + 1.5, scaledCenter.z)

  // 创建 pivot 组，放在目标中心位置
  if (!caePivot) {
    caePivot = new THREE.Group()
    scene.add(caePivot)
  }
  caePivot.position.copy(targetCenter)

  // 将 caeMesh 从场景中移除，添加到 caePivot 中
  scene.remove(caeMesh)

  // 调整 caeMesh 在 pivot 局部坐标系中的位置
  // 使得模型的几何中心正好在 pivot 的原点 (0,0,0)
  // 偏移量 = 模型当前位置 - 几何中心
  const localOffset = caeMesh.position.clone().sub(scaledCenter)
  caeMesh.position.copy(localOffset)

  caePivot.add(caeMesh)
  caePivot.updateMatrixWorld(true)

  // 记录中心点供后续使用
  caeModelCenter.copy(targetCenter)
}

// -----------------------------------------------------------------------------
// 视角聚焦 & 剖切设置
// -----------------------------------------------------------------------------

function focusObj(target: THREE.Object3D) {
  let distance: number
  const delta = new THREE.Vector3()
  const box = new THREE.Box3()
  const center = new THREE.Vector3()
  const sphere = new THREE.Sphere()

  box.setFromObject(target)

  if (box.isEmpty() === false) {
    box.getCenter(center)
    distance = box.getBoundingSphere(sphere).radius
  } else {
    center.setFromMatrixPosition(target.matrixWorld)
    distance = 0.1
  }

  // 保存模型信息供 VR 模式使用
  caeModelCenter.copy(center)
  caeViewDistance = distance * 2

  delta.set(0, 0, 1)
  delta.applyQuaternion(camera.quaternion)
  delta.multiplyScalar(distance * 1.5)

  camera.position.copy(center).add(delta)
  controls.target.copy(center)
  controls.update()
}

// 设置类型节点选择器选项
function setupTypeNodeOptions() {
  // 构建类型列表和节点数据
  const types: SelectOption[] = []
  newTaskValues.forEach(v => {
    types.push({ value: v.name, label: v.name })
    if (!guiParams.nodes[v.name]) {
      guiParams.nodes[v.name] = v.value
    }
  })

  if (types.length === 0) return

  typeNodeOptions.value = types

  // 设置初始类型
  guiParams.typenode = types[0]?.value || ''
  guiParams.nownode = guiParams.nodes[guiParams.typenode] || []

  // 设置初始帧
  if (guiParams.nownode.length > 0) {
    guiParams.frame = guiParams.nownode[0]?.key || ''
  }

  // 更新帧选择器选项
  updateFrameOptions()
}

// 更新帧选择器选项
function updateFrameOptions() {
  if (guiParams.nownode.length > 0) {
    frameOptions.value = guiParams.nownode.map(n => ({
      value: n.key || '',
      label: n.key || ''
    }))
  } else {
    frameOptions.value = []
  }
}

// 更新裁剪平面范围 
function updateClippingPlaneRanges() {
  if (!caeMesh) return

  // 从对象获取包围盒（已经是变换后的世界坐标）
  const bbox = new THREE.Box3().setFromObject(caeMesh)

  // 更新剖切平面的大小
  const size = new THREE.Vector3()
  bbox.getSize(size)
  const maxSize = Math.max(size.x, size.y, size.z) * 2

  planeObjects.forEach((po) => {
    const geometry = new THREE.PlaneGeometry(maxSize, maxSize)
    po.geometry.dispose()
    po.geometry = geometry
  })

  planeHelpers.forEach((ph) => {
    ph.size = maxSize
  })

  // 使用 bbox.min/max 加上 10% 边距
  const minX = bbox.min.x + bbox.min.x * 0.1
  const maxX = bbox.max.x + bbox.max.x * 0.1
  const minY = bbox.min.y - bbox.min.y * 0.1
  const maxY = bbox.max.y + bbox.max.y * 0.1
  const minZ = bbox.min.z + bbox.min.z * 0.1
  const maxZ = bbox.max.z + bbox.max.z * 0.1

  planeRanges.value = {
    x: { min: minX, max: maxX },
    y: { min: minY, max: maxY },
    z: { min: minZ, max: maxZ }
  }

  // 设置初始值（禁用裁剪） - 参考 oldModel
  if (planes[0]) {
    guiParams.planeX.scope = maxX
    planes[0].constant = maxX
  }
  if (planes[1]) {
    guiParams.planeY.scope = maxY
    planes[1].constant = maxY
  }
  if (planes[2]) {
    guiParams.planeZ.scope = maxZ
    planes[2].constant = maxZ
  }
}

// -----------------------------------------------------------------------------
// 颜色映射 & LUT 更新
// -----------------------------------------------------------------------------

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

  // 更新切面网格颜色
  if (meshClip) {
    const geometryClip = meshClip.geometry
    const pressuresClip = geometryClip.attributes.pressure
    const colorsClip = geometryClip.attributes.color
    if (pressuresClip && colorsClip) {
      for (let i = 0; i < pressuresClip.array.length; i++) {
        const colorValue = pressuresClip.array[i] ?? 0
        const color = lut.getColor(colorValue)
        if (color) {
          colorsClip.setXYZ(i, color.r, color.g, color.b)
        }
      }
      colorsClip.needsUpdate = true
    }
  }

  // 更新 LUT 显示
  updateLutDisplay()
}

// 更新 LUT 颜色条显示
function updateLutDisplay() {
  // 更新 3D 版本（VR 模式）
  if (lutRef.value && shuzhiRef.value) {
    updateLutDisplayForRefs(lutRef.value, shuzhiRef.value)
  }

  // 更新 2D 版本（桌面模式）
  if (lutRef2D.value && shuzhiRef2D.value) {
    updateLutDisplayForRefs(lutRef2D.value, shuzhiRef2D.value)
  }
}

// 实际更新 LUT 显示的函数
function updateLutDisplayForRefs(lutContainer: HTMLDivElement, shuzhiContainer: HTMLDivElement) {
  // 清除旧的显示
  while (lutContainer.firstChild) {
    lutContainer.removeChild(lutContainer.firstChild)
  }
  while (shuzhiContainer.firstChild) {
    shuzhiContainer.removeChild(shuzhiContainer.firstChild)
  }

  // 创建 LUT 颜色条
  const lutCanvas = lut.createCanvas()
  lutCanvas.style.width = '1rem'
  lutCanvas.style.height = `${Math.min(window.innerHeight * 0.7, 415)}px`
  lutContainer.appendChild(lutCanvas)

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
  const { unit = '', name = '' } = newTaskValues.find(s => s.name === guiParams.typenode) || {};
  ctx.fillText(unit, mrW, mrH + 14)
  ctx.fillText(name, mrW, mrH + 32)

  shuzhiContainer.appendChild(canvas)
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

// -----------------------------------------------------------------------------
// 动画/交互行为
// -----------------------------------------------------------------------------

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
  if (!guiParams.nownode || guiParams.nownode.length === 0) {
    isDataAnimationPlaying = false;
    return;
  }

  isDataAnimationPlaying = true;
  animationElapsed = 0;
  const currentIndex = guiParams.nownode.findIndex(item => item.key === guiParams.frame);
  animationFrameIndex = currentIndex >= 0 ? currentIndex : 0;

  const frameData = guiParams.nownode[animationFrameIndex];
  if (frameData?.key) {
    guiParams.frame = frameData.key;
    updateTimes();
  }
}

// 停止动画
function stopAnimation() {
  isDataAnimationPlaying = false;
  animationElapsed = 0;
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

function handleResize() {
  if (!container.value) return
  const width = container.value.clientWidth;
  const height = container.value.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}
function animationLoop() {
  const delta = clock.getDelta();

  if (isDataAnimationPlaying && guiParams.animate && guiParams.nownode.length > 0) {
    animationElapsed += delta;
    if (animationElapsed >= animationStepSeconds) {
      animationElapsed = 0;
      animationFrameIndex = (animationFrameIndex + 1) % guiParams.nownode.length;
      const frameData = guiParams.nownode[animationFrameIndex];
      if (frameData?.key) {
        guiParams.frame = frameData.key;
        updateTimes();
      }
    }
  }

  // CAE模型旋转控制（以中心点为基点）
  if (caePivot) {
    // 上下旋转（绕X轴）
    if (guiParams.rotation.upDown) {
      caePivot.rotateX(delta * guiParams.rotation.speed * 0.5)
    }
    // 左右旋转（绕Y轴）
    if (guiParams.rotation.leftRight) {
      caePivot.rotateY(delta * guiParams.rotation.speed * 0.5)
    }
  }

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

  // 更新 VR 状态
  if (vrManager) {
    vrManager.update()
  }


  // 渲染场景
  renderer.clear();
  renderer.render(scene, camera)
}

// 清理函数
function animationCleanup() {
  // 停止动画循环
  renderer.setAnimationLoop(null)

  // 断开 MutationObserver
  if (domObserver) {
    domObserver.disconnect()
    domObserver = null
  }

  // 清理 GUI HTMLMesh
  if (guiMesh) {
    if (guiMesh.material.map) {
      const img = guiMesh.material.map.image as HTMLElement
      if (img && img.parentElement) {
        img.parentElement.remove()
      }
    }
    guiMesh.material.dispose()
    guiMesh.geometry.dispose()
  }
  if (lutMesh) {
    if (lutMesh.material.map) {
      const img = lutMesh.material.map.image as HTMLElement
      if (img && img.parentElement) {
        img.parentElement.remove()
      }
    }
    lutMesh.material.dispose()
    lutMesh.geometry.dispose()
  }

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

  // // 清理地面 - 已移除地面
  // ground.geometry.dispose()
  // if (Array.isArray(ground.material)) {
  //   ground.material.forEach(m => m.dispose())
  // } else {
  //   ground.material.dispose()
  // }

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

/**
 * 切面位置变化处理函数
 * @param type - 切面类型（X/Y/Z 轴）
 */
function planeChange(type: 'x' | 'y' | 'z') {
  // 移除旧的切面网格
  if (meshClip) {
    if (caePivot) {
      caePivot.remove(meshClip)
    } else {
      scene.remove(meshClip)
    }
    meshClip = null
  }

  // 如果配置了切面数据 URL，请求新的切面数据
  if (clipUrl) {
    getClipFrame(type)
  }
}

/**
 * 从服务器获取切面数据并渲染切面网格
 * @param type - 切面类型（X/Y/Z 轴）
 */
function getClipFrame(type: 'x' | 'y' | 'z') {
  if (getClipFrameTimeout) {
    clearTimeout(getClipFrameTimeout)
    getClipFrameTimeout = undefined
  }

  getClipFrameTimeout = setTimeout(async () => {
    if (!caeMesh || !caePivot) {
      console.warn('CAE 模型或 Pivot 未初始化')
      return
    }

    // 获取世界坐标系中的切面点
    const worldPoint = new THREE.Vector3()
    if (type === 'x') {
      worldPoint.set(planes[0]?.constant ?? 0, 0, 0)
    } else if (type === 'y') {
      worldPoint.set(0, planes[1]?.constant ?? 0, 0)
    } else {
      worldPoint.set(0, 0, planes[2]?.constant ?? 0)
    }

    // 将世界坐标转换回原始模型的局部坐标（未经变换的坐标）
    // 1. 减去 pivot 的世界位置
    worldPoint.sub(caePivot.position)

    // 2. 减去 caeMesh 在 pivot 中的局部偏移
    worldPoint.sub(caeMesh.position)

    // 3. 除以缩放比例
    const scale = caeMesh.scale.x // 使用 uniform scale
    worldPoint.divideScalar(scale)

    // 4. 减去 Y 轴偏移量，转换回服务器数据的原始坐标系
    worldPoint.y -= modelOffsetY

    // 确定切面方向索引
    let xyz: number
    if (type === 'x') {
      xyz = 0
    } else if (type === 'y') {
      xyz = 1
    } else {
      xyz = 2
    }

    const point: [number, number, number] = [worldPoint.x, worldPoint.y, worldPoint.z]
    console.log('世界坐标切面点:', type === 'x' ? planes[0]?.constant : type === 'y' ? planes[1]?.constant : planes[2]?.constant)
    console.log('转换后的原始坐标切面点:', point)

    try {
      // 获取当前选中的帧 key
      const currentFrame = guiParams.frame || guiParams.nownode[0]?.key

      // 构建查询参数，Point 参数需要重复三次
      const searchParams = new URLSearchParams()
      // searchParams.append('path', clipPath || '')
      searchParams.append('path', guiParams.modelName || '')
      searchParams.append('type', guiParams.typenode)
      searchParams.append('frame', currentFrame || '')
      point.forEach(p => searchParams.append('Point', p.toString()))
      searchParams.append('xyz', xyz.toString())

      // 向服务器请求切面数据
      const response = await fetch(`${clipUrl}?${searchParams.toString()}`)

      const data: {
        clipnode: { indexs: number[]; nodes: number[] };
        clipvalue: number[];
      } = await response.json()

      // 移除旧的切面网格
      if (meshClip) {
        if (caePivot) {
          caePivot.remove(meshClip)
        } else {
          scene.remove(meshClip)
        }
        meshClip = null
      }

      // 创建新的切面网格
      meshClip = new THREE.Mesh(
        undefined,
        new THREE.MeshStandardMaterial({
          side: THREE.DoubleSide,
          metalness: 0,
          roughness: 0,
          vertexColors: true,
        })
      )
      meshClip.name = 'clipMesh'
      meshClip.renderOrder = 0

        // 自定义着色器，根据顶点颜色调整透明度
        ; (meshClip.material as THREE.MeshStandardMaterial).onBeforeCompile = shader => {
          shader.fragmentShader = shader.fragmentShader.replace(
            'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
            `
            float oldcolor=smoothstep(0.,1.,vColor.r);
            diffuseColor.a=max(.2,oldcolor);
            gl_FragColor = vec4( outgoingLight, diffuseColor.a );
          `
          )
        }

      // 填充切面几何体数据
      const clipJsonStr = {
        metadata: { version: 4, type: 'BufferGeometry' },
        uuid: 'CLIP-' + Date.now(),
        type: 'BufferGeometry',
        data: {
          index: { type: 'Uint32Array', array: data.clipnode.indexs },
          attributes: {
            position: { itemSize: 3, type: 'Float32Array', array: data.clipnode.nodes },
            pressure: { itemSize: 1, type: 'Float32Array', array: data.clipvalue }
          }
        }
      }

      // 创建几何体
      const loader = new THREE.BufferGeometryLoader()
      const geometry = loader.parse(clipJsonStr)

      // 应用 Y 轴偏移，与主模型保持一致
      const clipPositionAttr = geometry.attributes.position
      if (clipPositionAttr) {
        const clipPositions = clipPositionAttr.array as Float32Array
        for (let i = 1; i < clipPositions.length; i += 3) {
          clipPositions[i] = (clipPositions[i] ?? 0) + modelOffsetY
        }
        clipPositionAttr.needsUpdate = true
      }

      // 初始化顶点颜色
      const colors = []
      const positionCount = geometry.attributes.position?.count ?? 0
      for (let i = 0; i < positionCount; i++) {
        colors.push(1, 1, 1)
      }
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

      // 设置几何体并计算法线
      meshClip.geometry = geometry
      if (meshClip.geometry) {
        meshClip.geometry.computeBoundingSphere();
        meshClip.geometry.computeVertexNormals()
      }

      // 将切面网格添加到 caePivot，使其继承相同的变换（缩放和位置）
      // 同时设置与 caeMesh 相同的局部位置和缩放
      if (caePivot && caeMesh) {
        meshClip.position.copy(caeMesh.position) // 复制 caeMesh 在 pivot 中的局部位置
        meshClip.scale.copy(caeMesh.scale) // 复制缩放
        caePivot.add(meshClip)
      } else {
        scene.add(meshClip)
      }

      updateColors()

      console.log('切面网格创建成功，已添加到', caePivot ? 'caePivot' : 'scene')
    } catch (error) {
      console.error('获取切面数据失败:', error)
    }
  }, 500)
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

function floorPost() {
  const floor = baseSceneModel?.children.find(child => child.name === '地板');
  if (!floor) return;
  const color = '#777777';
  const opacity = 0.1;
  const clipBias = 0.0001;

  const newgeo = floor.geometry.clone() as THREE.BufferGeometry;
  newgeo.rotateX(Math.PI / 2)
  const groundReflector = new Reflector(newgeo, {
    clipBias: clipBias,
    textureWidth: window.innerWidth * window.devicePixelRatio,
    textureHeight: window.innerHeight * window.devicePixelRatio,
    color: new THREE.Color(color).getHex(),
    // opacity: opacity
  });

  (groundReflector.material as THREE.MeshStandardMaterial).transparent = true
  groundReflector.position.x = floor.position.x;
  groundReflector.position.z = floor.position.z;
  groundReflector.position.y = floor.position.y + 0.01;
  groundReflector.scale.x = floor.scale.x;
  groundReflector.scale.z = floor.scale.y;
  groundReflector.scale.y = floor.scale.z;
  groundReflector.rotateX(-Math.PI / 2);
  scene.add(groundReflector);

}


function registerLifecycleHooks() {
  onMounted(async () => {
    if (!container.value) return

    // ========== Three.js 初始化 ==========
    await initRenderPipeline(); // 初始化 VR 交互
    // 初始化 VR 管理器
    vrManager = new VRManager({
      renderer,
      scene,
      camera,
      controls,
      framebufferScale: 1.5,
      playerHeight: 2,
      mesh: caeMesh || undefined,
      testObjects: interactableObjects as THREE.Mesh[],
      caeModelCenter,
      caeViewDistance,
      onSessionStart: () => {
        isVRMode.value = true
        showGUI2D.value = false // VR 模式下隐藏 2D GUI
        showGUI3D.value = true // VR 模式下确保显示 3D GUI
        // 确保 3D GUI 可见
        if (guiMesh) {
          guiMesh.visible = true
          if (guiMesh.material.map) {
            guiMesh.material.map.needsUpdate = true
          }
        }
        if (lutMesh) {
          lutMesh.visible = true
          if (lutMesh.material.map) {
            lutMesh.material.map.needsUpdate = true
          }
        }
      },
      onSessionEnd: () => {
        isVRMode.value = false
        showGUI2D.value = true // 返回桌面模式，显示 2D GUI
        showGUI3D.value = true // 保持 3D GUI 显示
        // 确保 3D GUI 可见
        if (guiMesh) {
          guiMesh.visible = true
          if (guiMesh.material.map) {
            guiMesh.material.map.needsUpdate = true
          }
        }
        if (lutMesh) {
          lutMesh.visible = true
          if (lutMesh.material.map) {
            lutMesh.material.map.needsUpdate = true
          }
        }
      }
    })
    vrManager.init(container.value)

    // 加载基础场景与 CAE 模型
    await preloadSceneAssets();

    // 初始化鼠标悬停数值显示
    initMouseValueDisplay();

    window.addEventListener('resize', handleResize)

    // 主动画循环
    renderer.setAnimationLoop(animationLoop)
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
}
</script>

<template>
  <div class="model-root">
    <div ref="container" class="model-container"></div>

    <!-- 桌面模式 UI（2D GUI + LUT） -->
    <div v-show="showGUI2D && !isVRMode" class="desktop-ui">
      <div class="gui-panel">
        <!-- CAE 模型控制 -->
        <div class="gui-section">
          <CustomCheckbox v-model="guiParams.caeModel.visible" label="显示" />
          <CustomCheckbox v-model="guiParams.caeModel.wireframe" label="线框模式" />
          <CustomSelectV2 v-model="guiParams.modelName" label="模型" :options="modelNameOptions" />
          <CustomSlider v-model="guiParams.caeModel.opacity" label="透明度" :min="0" :max="1" :step="0.1" :decimals="1" />
          <CustomSlider v-model="guiParams.caeModel.metalness" label="金属度" :min="0" :max="1" :step="0.1"
            :decimals="1" />
          <CustomSlider v-model="guiParams.caeModel.roughness" label="粗糙度" :min="0" :max="1" :step="0.1"
            :decimals="1" />
          <CustomSelectV2 v-model="guiParams.typenode" label="数据类型" :options="typeNodeOptions" />
          <CustomSelectV2 v-if="frameOptions.length > 0" v-model="guiParams.frame" label="时间帧"
            :options="frameOptions" />

          <CustomSelectV2 v-model="guiParams.caeModel.colorMap" label="颜色映射" :options="colorMapOptions" />
          <CustomCheckbox v-model="guiParams.animate" label="动画播放" />

          <!-- 旋转控制 -->
          <CustomCheckbox v-model="guiParams.rotation.upDown" label="上下旋转" />
          <CustomCheckbox v-model="guiParams.rotation.leftRight" label="左右旋转" />
          <CustomSlider v-model="guiParams.rotation.speed" label="旋转速度" :min="0.1" :max="5" :step="0.1" :decimals="1" />

          <CustomSlider v-model="guiParams.planeX.scope" label="X轴剖切" :min="planeRanges.x.min" :max="planeRanges.x.max"
            :step="0.01" :decimals="2" />
          <CustomSlider v-model="guiParams.planeY.scope" label="Y轴剖切" :min="planeRanges.y.min" :max="planeRanges.y.max"
            :step="0.01" :decimals="2" />
          <CustomSlider v-model="guiParams.planeZ.scope" label="Z轴剖切" :min="planeRanges.z.min" :max="planeRanges.z.max"
            :step="0.01" :decimals="2" />
        </div>
      </div>

      <div class="lut-panel-2d">
        <div class="flex-2d">
          <div ref="shuzhiRef2D" class="mr-1" />
          <div ref="lutRef2D" />
        </div>
      </div>
    </div>

    <!-- VR 模式使用的 3D GUI HTMLMesh -->
    <div v-show="showGUI3D" class="vr-overlays">
      <div ref="guiPanelRef" class="gui-panel-3d">
        <div class="gui-title">CAE 模型控制</div>

        <!-- CAE 模型控制 -->
        <CustomCheckbox v-model="guiParams.caeModel.visible" label="显示" />
        <CustomCheckbox v-model="guiParams.caeModel.wireframe" label="线框模式" />
        <CustomSelectV2 v-model="guiParams.modelName" label="模型" :options="modelNameOptions" />
        <CustomSlider v-model="guiParams.caeModel.opacity" label="透明度" :min="0" :max="1" :step="0.1" :decimals="1" />
        <CustomSlider v-model="guiParams.caeModel.metalness" label="金属度" :min="0" :max="1" :step="0.1" :decimals="1" />
        <CustomSlider v-model="guiParams.caeModel.roughness" label="粗糙度" :min="0" :max="1" :step="0.1" :decimals="1" />
        <CustomSelectV2 v-model="guiParams.typenode" label="数据类型" :options="typeNodeOptions" />
        <CustomSelectV2 v-if="frameOptions.length > 0" v-model="guiParams.frame" label="时间帧" :options="frameOptions" />
        <CustomSelectV2 v-model="guiParams.caeModel.colorMap" label="颜色映射" :options="colorMapOptions" />
        <CustomCheckbox v-model="guiParams.animate" label="动画播放" />

        <!-- 旋转控制 -->
        <CustomCheckbox v-model="guiParams.rotation.upDown" label="上下旋转" />
        <CustomCheckbox v-model="guiParams.rotation.leftRight" label="左右旋转" />
        <CustomSlider v-model="guiParams.rotation.speed" label="旋转速度" :min="0.1" :max="5" :step="0.1" :decimals="1" />

        <!-- 裁剪平面 -->
        <CustomSlider v-model="guiParams.planeX.scope" label="X轴剖切" :min="planeRanges.x.min" :max="planeRanges.x.max"
          :step="0.01" :decimals="2" />
        <CustomSlider v-model="guiParams.planeY.scope" label="Y轴剖切" :min="planeRanges.y.min" :max="planeRanges.y.max"
          :step="0.01" :decimals="2" />
        <CustomSlider v-model="guiParams.planeZ.scope" label="Z轴剖切" :min="planeRanges.z.min" :max="planeRanges.z.max"
          :step="0.01" :decimals="2" />
      </div>

      <!-- LUT 颜色条和数值显示 (3D HTMLMesh) -->
      <div class="lut-shuzhi" ref="lutBodyRef">
        <div class="flex">
          <div ref="shuzhiRef" class="mr-1" />
          <div ref="lutRef" />
        </div>
      </div>
    </div>

    <!-- 鼠标悬停数值显示 -->
    <!-- <div v-show="showValuePopover" :style="{ left: `${mouseLocation.x}px`, top: `${mouseLocation.y}px` }"
      class="value-popover">
      {{ formatNumber(pointValue) }}
    </div> -->
  </div>
</template>

<style scoped>
.model-root {
  width: 100%;
  height: 100%;
  position: relative;
}

.model-container {
  width: 100%;
  height: 100%;
}

.desktop-ui,
.vr-overlays {
  position: fixed;
  inset: 0;
  pointer-events: none;
}

.desktop-ui>*,
.vr-overlays>* {
  pointer-events: auto;
}

/* HTMLMesh 3D GUI 面板样式 */
.gui-panel-3d {
  width: 350px;
  height: 700px;
  background: linear-gradient(135deg, rgba(30, 30, 30, 0.98) 0%, rgba(20, 20, 20, 0.95) 100%);
  padding: 20px;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  overflow-y: auto;
  overflow-x: hidden;
  position: absolute;
  /* HTMLMesh 需要这个元素在文档流之外 */
  left: -9999px;
  top: -9999px;
  border: 2px solid rgba(100, 200, 255, 0.3);
}

/* 3D GUI 面板的标题和内容样式调整 */
.gui-panel-3d .gui-title {
  font-size: 18px;
  font-weight: bold;
  color: #4ecdc4;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid rgba(78, 205, 196, 0.3);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.gui-panel-3d .section-title {
  font-size: 14px;
  font-weight: 600;
  color: #64b5f6;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.gui-panel-3d .gui-section {
  background-color: rgba(255, 255, 255, 0.03);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.gui-panel {
  position: fixed;
  top: 50px;
  left: 20px;
  width: 300px;
  max-height: 80vh;
  overflow-y: auto;
  background-color: rgba(30, 30, 30, 0.95);
  padding: 16px;
  border-radius: 8px;
  z-index: 1000;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}

/* 2D LUT 面板（桌面模式）*/
.lut-panel-2d {
  position: fixed;
  top: 50px;
  right: 20px;
  width: 180px;
  padding: 16px;
  border-radius: 8px;
  z-index: 1000;
  cursor: pointer;
}

.flex-2d {
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.gui-title {
  font-size: 16px;
  font-weight: bold;
  color: #fff;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.gui-section {
  margin-bottom: 20px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #aaa;
  margin-bottom: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.gui-panel :deep(.custom-component-wrapper) {
  margin-bottom: 8px;
}

.lut-shuzhi {
  width: 180px;
  height: 800px;
  background: linear-gradient(135deg, rgba(30, 30, 30, 0.98) 0%, rgba(20, 20, 20, 0.95) 100%);
  padding: 20px;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  overflow-y: auto;
  overflow-x: hidden;
  position: absolute;
  /* HTMLMesh 需要这个元素在文档流之外 */
  left: -9999px;
  top: -9999px;
  color: #fff;
}


.flex {
  display: flex;
  align-items: flex-start;
  justify-content: center;
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

/* 滚动条样式 */
.gui-panel::-webkit-scrollbar {
  width: 8px;
}

.gui-panel::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.gui-panel::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

.gui-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* 3D GUI 面板滚动条样式 */
.gui-panel-3d::-webkit-scrollbar {
  width: 6px;
}

.gui-panel-3d::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 3px;
}

.gui-panel-3d::-webkit-scrollbar-thumb {
  background: rgba(78, 205, 196, 0.4);
  border-radius: 3px;
}

.gui-panel-3d::-webkit-scrollbar-thumb:hover {
  background: rgba(78, 205, 196, 0.6);
}

/* GUI 控制按钮组 */
.gui-controls {
  position: fixed;
  top: 10px;
  left: 20px;
  display: flex;
  gap: 10px;
  z-index: 1001;
}

/* GUI 切换按钮样式 */
.gui-toggle-btn {
  padding: 10px 16px;
  background-color: rgba(30, 30, 30, 0.9);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.gui-toggle-btn:hover {
  background-color: rgba(50, 50, 50, 0.95);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-1px);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.gui-toggle-btn:active {
  transform: translateY(0);
  background-color: rgba(70, 70, 70, 0.95);
}
</style>
