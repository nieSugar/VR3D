<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRManager } from '../../utils/VRManager'
import { Lut } from 'three/examples/jsm/math/Lut.js'
import { HTMLMesh } from 'three/examples/jsm/interactive/HTMLMesh.js'
import { InteractiveGroup } from 'three/examples/jsm/interactive/InteractiveGroup.js'
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { TransparentReflector } from '../../utils/TransparentReflector'

import { useThreeBase } from './useThreeBase'
import SettingsPanel from './SettingsPanel.vue'
import { formatNumber, applyBoxUV } from './math'
import type { SelectOption } from '../../components/CustomSelectV2.vue'

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
const loadingPanelRef = ref<HTMLElement | null>(null) // VR Loading 面板引用
const lutRef2D = ref<HTMLDivElement | null>(null) // Lut 2D 显示引用
const shuzhiRef2D = ref<HTMLDivElement | null>(null) // 数值 2D 显示引用
const showValuePopover = ref(false)
const pointValue = ref(0)
const mouseLocation = reactive({ x: 0, y: 0 })
const isLoading = ref(false) // Loading 状态
const loadingProgress = ref(0) // Loading 进度
const loadingText = ref('加载中...') // Loading 文本

// -----------------------------------------------------------------------------
// Three.js 核心状态 (使用 useThreeBase)
// -----------------------------------------------------------------------------
const { scene, camera, renderer, controls, addLoopCallback, removeLoopCallback } = useThreeBase(container)

// 其他 Three.js 对象 (普通变量，不需要响应式)
let vrManager: VRManager | null = null
let interactiveGroup: InteractiveGroup | null = null
let guiMesh: HTMLMesh | null = null
let lutMesh: HTMLMesh | null = null
let loadingMesh: HTMLMesh | null = null // VR Loading面板
let caeMesh: THREE.Mesh | null = null
let caePivot: THREE.Group | null = null
let baseSceneModel: THREE.Group | null = null
let meshClip: THREE.Mesh | null = null

let domObserver: MutationObserver | null = null
let controller1: THREE.Group | null = null
let controller2: THREE.Group | null = null

let caeModelCenter = new THREE.Vector3(0, 0, 0) // CAE 模型中心位置
let caeViewDistance = 5 // 观看 CAE 模型的合适距离
let modelOffsetY = 0 // 模型 Y 轴偏移量，用于切面计算
let getClipFrameTimeout: number | undefined
const clipUrl: string | undefined = '/api/Clip' // 切面数据请求 URL
// const clipPath: string | undefined = ''

// 保存模型初始状态
let initialModelPosition = new THREE.Vector3()
let initialModelRotation = new THREE.Euler()
let initialModelScale = new THREE.Vector3()

let lut = new Lut()
let localPlanes: THREE.Plane[] = [] // 局部空间裁剪平面
let newPlanes: THREE.Plane[] = [] // 世界空间裁剪平面
let planeHelpers: THREE.PlaneHelper[] = []
let maxval = 1
let minval = 0

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2()
let setValueTimeout: number
const animationStepSeconds = 0.2 // 数据帧切换间隔（秒）
let animationElapsed = 0
let animationFrameIndex = 0
let isDataAnimationPlaying = false

// -----------------------------------------------------------------------------
// 颜色映射定义
// -----------------------------------------------------------------------------
const ColorMapKeywords = {
  rainbow: [
    [0.0, 0x00008f], [0.05, 0x00008f], [0.1, 0x0000c4], [0.15, 0x0000f9], [0.2, 0x002fff],
    [0.25, 0x0064ff], [0.3, 0x0099ff], [0.35, 0x00ceff], [0.4, 0x03fffc], [0.45, 0x38ffc7],
    [0.5, 0x6dff92], [0.55, 0xa2ff5d], [0.6, 0xd7ff28], [0.65, 0xfff200], [0.7, 0xffbe00],
    [0.75, 0xff8900], [0.8, 0xff5400], [0.85, 0xff1f00], [0.9, 0xe90000], [0.95, 0xb40000],
    [1.0, 0x800000]
  ],
  cooltowarm: [[0.0, 0x3c4ec2], [0.2, 0x9bbcff], [0.5, 0xdcdcdc], [0.8, 0xf6a385], [1.0, 0xb40426]],
  blackbody: [[0.0, 0x000000], [0.2, 0x780000], [0.5, 0xe63200], [0.8, 0xffff00], [1.0, 0xffffff]],
  grayscale: [[0.0, 0x000000], [1.0, 0xffffff]],
  water: [[0.0, 0xffffff], [1.0, 0x0066ff]],
  water2: [[0.0, 0xffffff], [0.2, 0xbfbfff], [0.5, 0x7f7fff], [0.8, 0x4040ff], [1.0, 0x0000ff]],
  wite: [[0.0, 0xffffff], [0.2, 0xbfbfbf], [0.5, 0x7f7f7f], [0.8, 0x404040], [1.0, 0x000000]]
};

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

// 动态生成选项
const typeNodeOptions = ref<SelectOption[]>([]);
const modelNameOptions = ['re10', 're100', 're10000', 'comsol'].map(s => ({ value: `${s}Json`, label: s }));
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
const showGUI2D = ref(true);
const showGUI3D = ref(true);

// 运行时辅助状态
const originalMaterials = new Map<THREE.Object3D, THREE.Material>();

// GUI 参数
const guiParams = reactive({
  caeModel: {
    visible: true,
    wireframe: false,
    opacity: 1.0,
    color: '#4ecdc4',
    metalness: 0.3,
    roughness: 0.5,
    colorMap: 'rainbow',
  },
  scene: {
    backgroundColor: '#1a1a2e',
  },
  rotation: {
    upDown: false,
    leftRight: false,
    speed: 1.0,
  },
  planeX: { scope: 0, plan: false },
  planeY: { scope: 0, plan: false },
  planeZ: { scope: 0, plan: false },
  modelName: 're10Json',
  currentFrame: 0,
  frames: [] as string[],
  typenode: '',
  frame: '',
  animate: false,
  nodes: {} as Record<string, Array<Task>>,
  nownode: [] as Array<Task>,
});

// 监听器设置
setupCaeModelWatchers()
setupAnimationWatchers()
setupPlaneWatchers()
setupDataWatchers()
setupLoadingWatcher()

// Watchers
function setupCaeModelWatchers() {
  watch(() => guiParams.caeModel.visible, (value: boolean) => {
    if (caeMesh) caeMesh.visible = value
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

  watch(() => guiParams.modelName, async () => {
    // 开启loading
    isLoading.value = true;
    loadingText.value = '切换模型中...';
    loadingProgress.value = 20;

    // 清理切面网格
    if (meshClip) {
      if (meshClip.geometry) meshClip.geometry.dispose();
      if (meshClip.material) {
        if (Array.isArray(meshClip.material)) meshClip.material.forEach(m => m.dispose());
        else meshClip.material.dispose();
      }
      if (caePivot) caePivot.remove(meshClip);
      else scene.value?.remove(meshClip);
      meshClip = null;
    }

    // 删除旧模型并清理资源
    if (caeMesh) {
      if (caeMesh.geometry) caeMesh.geometry.dispose();
      if (caeMesh.material) {
        if (Array.isArray(caeMesh.material)) caeMesh.material.forEach(m => m.dispose());
        else caeMesh.material.dispose();
      }
      scene.value?.remove(caeMesh);
      caeMesh = null;
    }

    if (caePivot) {
      scene.value?.remove(caePivot);
      caePivot = null;
    }

    loadingProgress.value = 50;

    // 重置线框模式
    guiParams.caeModel.wireframe = false;

    guiParams.planeX.scope = 0;
    guiParams.planeY.scope = 0;
    guiParams.planeZ.scope = 0;
    guiParams.planeX.plan = false;
    guiParams.planeY.plan = false;
    guiParams.planeZ.plan = false;

    if (localPlanes[0]) localPlanes[0].constant = newPlanes[0]!.constant = 0;
    if (localPlanes[1]) localPlanes[1].constant = newPlanes[1]!.constant = 0;
    if (localPlanes[2]) localPlanes[2].constant = newPlanes[2]!.constant = 0;

    newTaskValues.length = 0;
    guiParams.nodes = {};
    guiParams.nownode = [];
    guiParams.typenode = '';
    guiParams.frame = '';
    typeNodeOptions.value = [];
    frameOptions.value = [];

    loadingText.value = '加载新模型...';
    loadingProgress.value = 70;

    try {
      await loadCAEModel();
      loadingProgress.value = 100;

      setTimeout(() => {
        isLoading.value = false;
      }, 300);
    } catch (error) {
      console.error('切换模型失败:', error);
      isLoading.value = false;
    }
  });
}

function setupAnimationWatchers() {
  watch(() => guiParams.animate, (value: boolean) => {
    if (value) playAnimation()
    else stopAnimation()
  })
}

function setupPlaneWatchers() {
  let isResetting = false

  watch(() => guiParams.planeX.scope, (d: number) => {
    if (localPlanes[0]) localPlanes[0].constant = newPlanes[0]!.constant = d

    if (isResetting) return
    isResetting = true
    if (guiParams.planeY.scope !== planeRanges.value.y.max) guiParams.planeY.scope = planeRanges.value.y.max
    if (guiParams.planeZ.scope !== planeRanges.value.z.max) guiParams.planeZ.scope = planeRanges.value.z.max
    isResetting = false

    planeChange('x')
  })
  watch(() => guiParams.planeX.plan, (v: boolean) => {
    if (planeHelpers[0]) planeHelpers[0].visible = v
  })

  watch(() => guiParams.planeY.scope, (d: number) => {
    if (localPlanes[1]) localPlanes[1].constant = newPlanes[1]!.constant = d

    if (isResetting) return
    isResetting = true
    if (guiParams.planeX.scope !== planeRanges.value.x.max) guiParams.planeX.scope = planeRanges.value.x.max
    if (guiParams.planeZ.scope !== planeRanges.value.z.max) guiParams.planeZ.scope = planeRanges.value.z.max
    isResetting = false

    planeChange('y')
  })
  watch(() => guiParams.planeY.plan, (v: boolean) => {
    if (planeHelpers[1]) planeHelpers[1].visible = v
  })

  watch(() => guiParams.planeZ.scope, (d: number) => {
    if (localPlanes[2]) localPlanes[2].constant = newPlanes[2]!.constant = d

    if (isResetting) return
    isResetting = true
    if (guiParams.planeX.scope !== planeRanges.value.x.max) guiParams.planeX.scope = planeRanges.value.x.max
    if (guiParams.planeY.scope !== planeRanges.value.y.max) guiParams.planeY.scope = planeRanges.value.y.max
    isResetting = false

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

function setupLoadingWatcher() {
  // 监听loading状态，控制VR中的loading mesh显示/隐藏
  watch(() => isLoading.value, (loading) => {
    if (loadingMesh) {
      loadingMesh.visible = loading;
      // 更新loading mesh材质贴图
      if (loadingMesh.material && loadingMesh.material.map) {
        loadingMesh.material.map.needsUpdate = true;
      }
    }
  })

  // 监听loading进度和文本变化，更新VR loading mesh
  watch([() => loadingProgress.value, () => loadingText.value], () => {
    if (loadingMesh && loadingMesh.material && loadingMesh.material.map) {
      loadingMesh.material.map.needsUpdate = true;
    }
  })
}

// 初始化逻辑
function initPlanes() {
  // localPlanes: 局部坐标系的原始平面
  localPlanes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)
  ];

  newPlanes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)
  ];
}

// 初始化 VR 交互组件
function initVRInteraction() {
  if (!renderer.value || !camera.value || !scene.value) return

  // 创建交互组
  interactiveGroup = new InteractiveGroup()
  interactiveGroup.listenToPointerEvents(renderer.value, camera.value)
  scene.value.add(interactiveGroup)

  // 创建 VR 控制器
  const geometry = new THREE.BufferGeometry()
  geometry.setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)])
  const material = new THREE.LineBasicMaterial({ color: 0xffffff })

  controller1 = renderer.value.xr.getController(0)
  controller1.add(new THREE.Line(geometry, material))
  scene.value.add(controller1)

  controller2 = renderer.value.xr.getController(1)
  controller2.add(new THREE.Line(geometry.clone(), material.clone()))
  scene.value.add(controller2)

  // 为交互组添加控制器监听
  interactiveGroup.listenToXRControllerEvents(controller1 as any)
  interactiveGroup.listenToXRControllerEvents(controller2 as any)

  // 添加控制器模型
  const controllerModelFactory = new XRControllerModelFactory()

  const controllerGrip1 = renderer.value.xr.getControllerGrip(0)
  controllerGrip1.add(controllerModelFactory.createControllerModel(controllerGrip1))
  scene.value.add(controllerGrip1)

  const controllerGrip2 = renderer.value.xr.getControllerGrip(1)
  controllerGrip2.add(controllerModelFactory.createControllerModel(controllerGrip2))
  scene.value.add(controllerGrip2)

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

    // 创建 VR Loading HTMLMesh
    if (loadingPanelRef.value && interactiveGroup) {
      loadingMesh = new HTMLMesh(loadingPanelRef.value);
      loadingMesh.position.set(0, 1.6, -1.5);
      loadingMesh.quaternion.identity();
      loadingMesh.scale.setScalar(2);
      loadingMesh.name = 'Loading_Mesh';
      loadingMesh.visible = false; // 默认隐藏
      interactiveGroup.add(loadingMesh);
    }
  }, 100)
}


// 更新面板位置
function updateVRUIPanels() {
  if (!caePivot || !caeModelCenter) return
  if (!guiMesh && !lutMesh) return

  if (guiMesh) {
    guiMesh.position.set(
      caeModelCenter.x - 3,
      caeModelCenter.y,
      caeModelCenter.z
    )
    guiMesh.quaternion.identity()
  }

  if (lutMesh) {
    lutMesh.position.set(
      caeModelCenter.x + 3,
      caeModelCenter.y - 0.5,
      caeModelCenter.z
    )
    lutMesh.quaternion.identity()
  }
}

async function preloadSceneAssets() {
  isLoading.value = true;
  loadingProgress.value = 0;

  try {
    loadingText.value = '加载基础场景...';
    await loadBaseScene();
    loadingProgress.value = 33;

    loadingText.value = '加载环境贴图...';
    await loadHDR();
    loadingProgress.value = 66;

    loadingText.value = '加载CAE模型...';
    await loadCAEModel();
    loadingProgress.value = 100;

    // 短暂延迟后隐藏loading
    setTimeout(() => {
      isLoading.value = false;
    }, 300);
  } catch (error) {
    console.error('加载资源失败:', error);
    isLoading.value = false;
  }
}

async function loadCAEModel() {
  try {
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

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(nodeData.nodes, 3))
    geometry.setIndex(new THREE.Uint32BufferAttribute(nodeData.indexs, 1))

    geometry.computeBoundingBox()
    const bbox = geometry.boundingBox!
    const offsetY = -bbox.min.y
    modelOffsetY = offsetY
    const positionAttr = geometry.attributes.position
    if (positionAttr) {
      const positions = positionAttr.array as Float32Array
      for (let i = 1; i < positions.length; i += 3) {
        positions[i] = (positions[i] ?? 0) + offsetY
      }
      positionAttr.needsUpdate = true
    }

    geometry.computeBoundingBox()

    const colors = [];
    for (let i = 0, n = geometry.attributes.position?.count || 0; i < n; ++i) {
      colors.push(1, 1, 1);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const data = newTaskValues[0]?.value || [];
    geometry.setAttribute('pressure', new THREE.Float32BufferAttribute(data[0]?.val || [], 1))

    geometry.computeVertexNormals()
    applyBoxUV(geometry)

    const material = new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      metalness: 0,
      roughness: 0,
      vertexColors: true,
      clippingPlanes: newPlanes,  // 使用世界空间裁剪平面（跟随物体旋转）
      clipShadows: true,
    })

    caeMesh = new THREE.Mesh(geometry, material)
    caeMesh.castShadow = true
    caeMesh.receiveShadow = true
    caeMesh.name = 'CAE_Model'

    scene.value?.add(caeMesh)
    interactableObjects.push(caeMesh)
    alignCaeModelToBaseScene()

    const pressureArray = data[0]?.val || []
    maxval = Math.max(...pressureArray)
    minval = Math.min(...pressureArray)

    updateColors()
    updateLutDisplay()

    if (caePivot) focusObj(caePivot)
    else focusObj(caeMesh!)

    updateClippingPlaneRanges()
    setupTypeNodeOptions()
    updateVRUIPanels()

  } catch (error) {
    console.error('加载 CAE 模型失败:', error)
  }
}

async function loadHDR() {
  if (!renderer.value || !scene.value) return
  const loader = new HDRLoader();
  const env = await loader.loadAsync('/assets/hdr/empty_play_room_2k.hdr');
  const bg = await loader.loadAsync('/assets/hdr/bambanani_sunset_2k.hdr');

  env.mapping = THREE.EquirectangularReflectionMapping;
  bg.mapping = THREE.EquirectangularReflectionMapping;

  const pmrem = new THREE.PMREMGenerator(renderer.value);
  const envRT = pmrem.fromEquirectangular(env);
  scene.value.environment = envRT.texture;
  scene.value.background = bg;
  pmrem.dispose();
  env.dispose();

  scene.value.environmentIntensity = 0.5;
  scene.value.environmentRotation.y = 60 * THREE.MathUtils.DEG2RAD;
  scene.value.backgroundBlurriness = 0;
  scene.value.backgroundIntensity = 0.5;
  scene.value.backgroundRotation.y = 60 * THREE.MathUtils.DEG2RAD;
}

async function loadBaseScene() {
  try {
    const loader = new GLTFLoader()
    const gltf = await loader.loadAsync('/assets/models/tjdx.glb')

    baseSceneModel = gltf.scene;
    baseSceneModel.name = 'Base-Scene';
    baseSceneModel.scale.set(2, 2, 2)
    baseSceneModel.position.set(0, 0, 0)

    baseSceneModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true
        child.receiveShadow = true
        if (child.material instanceof THREE.MeshStandardMaterial) {
          child.material.roughness = 0.7
          child.material.metalness = 0.3
        }
      }
    })

    scene.value?.add(baseSceneModel)
    floorPost();

    const bbox = new THREE.Box3().setFromObject(baseSceneModel)
    const center = bbox.getCenter(new THREE.Vector3())
    const size = bbox.getSize(new THREE.Vector3())

    const boundaryGeometry = new THREE.BoxGeometry(size.x * 1.1, size.y * 1.1, size.z * 1.1)
    const boundaryMaterial = new THREE.MeshBasicMaterial({ visible: false, wireframe: true })
    const boundaryMesh = new THREE.Mesh(boundaryGeometry, boundaryMaterial)
    boundaryMesh.position.copy(center)
    boundaryMesh.name = 'sceneBoundary'
    scene.value?.add(boundaryMesh)

    if (camera.value && controls.value) {
      camera.value.position.set(center.x, center.y + 1.6, center.z)
      controls.value.target.set(center.x, center.y + 1.6, center.z - 2)
      controls.value.update()
    }

    if (vrManager) {
      const sizeX = size.x;
      const sizeZ = size.z;
      const marginX = sizeX * 0.1;
      const marginZ = sizeZ * 0.1;

      vrManager.setBoundary({
        minX: bbox.min.x + marginX,
        maxX: bbox.max.x - marginX,
        minZ: bbox.min.z + marginZ,
        maxZ: bbox.max.z - marginZ
      })
    }

  } catch (error) {
    console.error('加载基础场景失败:', error)
  }
}

function alignCaeModelToBaseScene() {
  if (!caeMesh || !scene.value) return

  const caeBox = new THREE.Box3().setFromObject(caeMesh)
  const targetSize = new THREE.Vector3(4, 4, 4)
  const caeSize = caeBox.getSize(new THREE.Vector3())

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

  caeMesh.updateMatrixWorld(true)
  const scaledBox = new THREE.Box3().setFromObject(caeMesh)
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3())

  const targetCenter = new THREE.Vector3(scaledCenter.x - 1.5, scaledCenter.y + 1.5, scaledCenter.z)

  if (!caePivot) {
    caePivot = new THREE.Group()
    caePivot.name = "Cae_Pivot";
    scene.value.add(caePivot)
  }
  caePivot.position.copy(targetCenter)
  scene.value.remove(caeMesh)

  const localOffset = caeMesh.position.clone().sub(scaledCenter)
  caeMesh.position.copy(localOffset)


  caePivot.add(caeMesh)
  caePivot.updateMatrixWorld(true)

  caeModelCenter.copy(targetCenter)

  // 保存初始状态
  initialModelPosition.copy(caePivot.position)
  initialModelRotation.copy(caePivot.rotation)
  initialModelScale.copy(caePivot.scale)

  // 更新裁剪平面的中心点为 targetCenter
  if (localPlanes[0]) localPlanes[0].constant = newPlanes[0]!.constant = targetCenter.x
  if (localPlanes[1]) localPlanes[1].constant = newPlanes[1]!.constant = targetCenter.y
  if (localPlanes[2]) localPlanes[2].constant = newPlanes[2]!.constant = targetCenter.z
}

function focusObj(target: THREE.Object3D) {
  if (!camera.value || !controls.value) return
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

  caeModelCenter.copy(center)
  caeViewDistance = distance * 2

  delta.set(0, 0, 1)
  delta.applyQuaternion(camera.value.quaternion)
  delta.multiplyScalar(distance * 1.5)

  camera.value.position.copy(center).add(delta)
  controls.value.target.copy(center)
  controls.value.update()
}

function setupTypeNodeOptions() {
  const types: SelectOption[] = []
  newTaskValues.forEach(v => {
    types.push({ value: v.name, label: v.name, nameKey: v.nameKey })
    if (!guiParams.nodes[v.name]) {
      guiParams.nodes[v.name] = v.value
    }
  })

  if (types.length === 0) return
  typeNodeOptions.value = types
  guiParams.typenode = types[0]?.value || ''
  guiParams.nownode = guiParams.nodes[guiParams.typenode] || []
  if (guiParams.nownode.length > 0) {
    guiParams.frame = guiParams.nownode[0]?.key || ''
  }
  updateFrameOptions()
}

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

function updateClippingPlaneRanges() {
  if (!caeMesh) return
  const bbox = new THREE.Box3().setFromObject(caeMesh)
  const size = new THREE.Vector3()
  bbox.getSize(size)
  const maxSize = Math.max(size.x, size.y, size.z) * 2

  planeHelpers.forEach((ph) => {
    ph.size = maxSize
  })

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

  if (localPlanes[0]) {
    guiParams.planeX.scope = maxX
    localPlanes[0].constant = newPlanes[0]!.constant = maxX
  }
  if (localPlanes[1]) {
    guiParams.planeY.scope = maxY
    localPlanes[1].constant = newPlanes[1]!.constant = maxY
  }
  if (localPlanes[2]) {
    guiParams.planeZ.scope = maxZ
    localPlanes[2].constant = newPlanes[2]!.constant = maxZ
  }
}

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
  updateLutDisplay()
}

function updateLutDisplay() {
  if (lutRef.value && shuzhiRef.value) {
    updateLutDisplayForRefs(lutRef.value, shuzhiRef.value)
  }
  if (lutRef2D.value && shuzhiRef2D.value) {
    updateLutDisplayForRefs(lutRef2D.value, shuzhiRef2D.value)
  }
}

function updateLutDisplayForRefs(lutContainer: HTMLDivElement, shuzhiContainer: HTMLDivElement) {
  while (lutContainer.firstChild) lutContainer.removeChild(lutContainer.firstChild)
  while (shuzhiContainer.firstChild) shuzhiContainer.removeChild(shuzhiContainer.firstChild)

  const lutCanvas = lut.createCanvas()
  lutCanvas.style.width = '1rem'
  lutCanvas.style.height = `${Math.min(window.innerHeight * 0.7, 415)}px`
  lutContainer.appendChild(lutCanvas)

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

  for (let i = 0; i <= 10; i++) {
    const value = maxval - ((maxval - minval) / 10) * i
    const y = 7 + ((mrH - 14) / 10) * i
    ctx.fillText(formatNumber(value, isShowPoint), mrW, y)
  }

  const { unit = '', name = '' } = newTaskValues.find(s => s.name === guiParams.typenode) || {};
  ctx.fillText(unit, mrW, mrH + 14)
  ctx.fillText(name, mrW, mrH + 32)
  shuzhiContainer.appendChild(canvas)
}

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

function stopAnimation() {
  isDataAnimationPlaying = false;
  animationElapsed = 0;
}

function initMouseValueDisplay() {
  window.addEventListener('mousemove', (event) => {
    if (!caeMesh || guiParams.caeModel.opacity === 0 || !camera.value) {
      showValuePopover.value = false
      return
    }

    clearTimeout(setValueTimeout)
    setValueTimeout = setTimeout(() => {
      if (!camera.value) return
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
      mouseLocation.x = event.clientX + 20
      mouseLocation.y = event.clientY + 20

      raycaster.setFromCamera(mouse, camera.value)
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

function onLoop(delta: number, _time: number) {
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

  if (caePivot) {
    if (guiParams.rotation.upDown) caePivot.rotateX(delta * guiParams.rotation.speed * 0.5)
    if (guiParams.rotation.leftRight) caePivot.rotateY(delta * guiParams.rotation.speed * 0.5)
  }

  // 更新剖切平面（跟随物体旋转和平移）
  const targetMesh = caePivot || caeMesh;
  if (targetMesh && localPlanes.length === 3 && newPlanes.length === 3) {
    targetMesh.updateMatrixWorld(true);
    for (let i = 0; i < 3; i++) {
      const worldPlane = localPlanes[i]!.clone();
      worldPlane.applyMatrix4(targetMesh.matrixWorld);
      newPlanes[i]!.normal.copy(worldPlane.normal);
      let constant = worldPlane.constant;
      if (i === 0) {
        constant -= targetMesh.position.x;
      } else if (i === 1) {
        constant -= targetMesh.position.y;
      } else if (i === 2) {
        constant += targetMesh.position.z;
      }
      newPlanes[i]!.constant = constant;
    }
  }

  if (vrManager) {
    vrManager.update()
  }
}

function planeChange(type: 'x' | 'y' | 'z') {
  if (meshClip) {
    if (caePivot) caePivot.remove(meshClip)
    else scene.value?.remove(meshClip)
    meshClip = null
  }
  if (clipUrl) getClipFrame(type)
}

function getClipFrame(type: 'x' | 'y' | 'z') {
  if (getClipFrameTimeout) {
    clearTimeout(getClipFrameTimeout)
    getClipFrameTimeout = undefined
  }

  getClipFrameTimeout = setTimeout(async () => {
    if (!caeMesh || !caePivot) return

    const worldPoint = new THREE.Vector3()
    if (type === 'x') worldPoint.set(localPlanes[0]?.constant ?? 0, 0, 0)
    else if (type === 'y') worldPoint.set(0, localPlanes[1]?.constant ?? 0, 0)
    else worldPoint.set(0, 0, localPlanes[2]?.constant ?? 0)

    worldPoint.sub(caePivot!.position)
    worldPoint.sub(caeMesh!.position)
    const scale = caeMesh!.scale.x
    worldPoint.divideScalar(scale)
    worldPoint.y -= modelOffsetY

    let xyz: number
    if (type === 'x') xyz = 0
    else if (type === 'y') xyz = 1
    else xyz = 2

    const point: [number, number, number] = [worldPoint.x, worldPoint.y, worldPoint.z]
    try {
      const currentFrame = guiParams.frame || guiParams.nownode[0]?.key
      const nameKey = typeNodeOptions.value.find(t => t.value === guiParams.typenode)?.nameKey
      const searchParams = new URLSearchParams()
      searchParams.append('path', guiParams.modelName || '')
      searchParams.append('type', nameKey || '')
      searchParams.append('frame', currentFrame || '')
      point.forEach(p => searchParams.append('Point', p.toString()))
      searchParams.append('xyz', xyz.toString())

      const response = await fetch(`${clipUrl}?${searchParams.toString()}`)
      const data = await response.json()

      if (meshClip) {
        if (caePivot) caePivot.remove(meshClip)
        else scene.value?.remove(meshClip)
        meshClip = null
      }

      const mat = new THREE.MeshStandardMaterial({
        side: THREE.DoubleSide,
        metalness: 0,
        roughness: 0,
        vertexColors: true,
      });

      mat.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace(
          'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
          `
          float oldcolor=smoothstep(0.,1.,vColor.r);
          diffuseColor.a=max(.2,oldcolor);
          gl_FragColor = vec4( outgoingLight, diffuseColor.a );
        `
        )
      }

      meshClip = new THREE.Mesh(undefined, mat)
      meshClip.name = 'clipMesh'
      meshClip.renderOrder = 0

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

      const loader = new THREE.BufferGeometryLoader()
      const geometry = loader.parse(clipJsonStr)

      const clipPositionAttr = geometry.attributes.position
      if (clipPositionAttr) {
        const clipPositions = clipPositionAttr.array as Float32Array
        for (let i = 1; i < clipPositions.length; i += 3) {
          clipPositions[i] = (clipPositions[i] ?? 0) + modelOffsetY
        }
        clipPositionAttr.needsUpdate = true
      }

      const colors = []
      const positionCount = geometry.attributes.position?.count ?? 0
      for (let i = 0; i < positionCount; i++) colors.push(1, 1, 1)
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

      meshClip.geometry = geometry
      if (meshClip.geometry) {
        meshClip.geometry.computeBoundingSphere();
        meshClip.geometry.computeVertexNormals()
      }

      if (caePivot && caeMesh) {
        meshClip.position.copy(caeMesh.position)
        meshClip.scale.copy(caeMesh.scale)
        caePivot.add(meshClip)
      } else {
        scene.value?.add(meshClip)
      }
      updateColors()
    } catch (error) {
      console.error('获取切面数据失败:', error)
    }
  }, 500)
}

function mapTaskData(taskvals: any[], newTaskValues: any[]) {
  for (const task of taskvals) {
    const newTaskList = [];
    let name = '';
    let unit = '';
    let nameKey = '';
    let valIsArray = false;

    for (const key in task.times) {
      const newTask: Task = {};
      if (Object.prototype.hasOwnProperty.call(task.times, key)) {
        const val = task.times[key];
        name = newTask.name = task.name || task.key || '';
        unit = newTask.unit = task.unit || '';
        nameKey = newTask.nameKey = task.key || '';
        newTask.key = key;
        newTask.val = val || [];

        if (val && val.length > 0) {
          valIsArray = newTask.valIsArray = Array.isArray(val[0]);
        }

        if (valIsArray) {
          for (const [index, i] of (val as unknown as Array<Array<number>>).entries()) {
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

// 重置模型位置
function resetModelPosition() {
  if (!caePivot) return

  // 停止旋转动画
  guiParams.rotation.upDown = false
  guiParams.rotation.leftRight = false

  // 重置位置、旋转和缩放
  caePivot.position.copy(initialModelPosition)
  caePivot.rotation.copy(initialModelRotation)
  caePivot.scale.copy(initialModelScale)
  
  // 更新矩阵
  caePivot.updateMatrixWorld(true)

  // 重置相机视角
  if (caePivot) {
    focusObj(caePivot)
  }
}

function floorPost() {
  if (!baseSceneModel) return
  const floor = baseSceneModel.children.find(child => child.name === '地板001');
  if (!floor) return;

  baseSceneModel.updateMatrixWorld(true);

  const floorBBox = new THREE.Box3().setFromObject(floor);
  const floorBBoxHelper = new THREE.Box3Helper(floorBBox, 0x00ff00);
  scene.value?.add(floorBBoxHelper);

  const color = '#777777';
  const opacity = 0.1;
  const clipBias = 0.0001;

  const worldPos = new THREE.Vector3();
  floor.getWorldPosition(worldPos);
  const worldScale = new THREE.Vector3();
  floor.getWorldScale(worldScale);

  const newgeo = (floor as THREE.Mesh).geometry.clone() as THREE.BufferGeometry;
  newgeo.rotateX(Math.PI / 2);

  const groundReflector = new TransparentReflector(newgeo, {
    clipBias: clipBias,
    textureWidth: window.innerWidth * window.devicePixelRatio,
    textureHeight: window.innerHeight * window.devicePixelRatio,
    color: new THREE.Color(color).getHex(),
    opacity: opacity
  });

  (groundReflector.material as THREE.ShaderMaterial).transparent = true;

  groundReflector.position.x = worldPos.x;
  groundReflector.position.z = worldPos.z;
  groundReflector.position.y = worldPos.y + 0.01;
  groundReflector.scale.x = worldScale.x;
  groundReflector.scale.z = worldScale.y;
  groundReflector.scale.y = worldScale.z;

  groundReflector.rotateX(-Math.PI / 2);
  scene.value?.add(groundReflector);
}

onMounted(async () => {
  if (!container.value) return

  // 初始化 Planes
  initPlanes()

  // 初始化 VR 交互
  initVRInteraction()

  vrManager = new VRManager({
    renderer: renderer.value!,
    scene: scene.value!,
    camera: camera.value!,
    controls: controls.value!,
    framebufferScale: 4,
    playerHeight: 1.5,
    mesh: caeMesh || undefined,
    testObjects: interactableObjects as THREE.Mesh[],
    caeModelCenter,
    caeViewDistance,
    onSessionStart: () => {
      isVRMode.value = true
      showGUI2D.value = false
      showGUI3D.value = true
      if (guiMesh) {
        guiMesh.visible = true
        if (guiMesh.material.map) guiMesh.material.map.needsUpdate = true
      }
      if (lutMesh) {
        lutMesh.visible = true
        if (lutMesh.material.map) lutMesh.material.map.needsUpdate = true
      }
    },
    onSessionEnd: () => {
      isVRMode.value = false
      showGUI2D.value = true
      showGUI3D.value = true
      if (guiMesh) {
        guiMesh.visible = true
        if (guiMesh.material.map) guiMesh.material.map.needsUpdate = true
      }
      if (lutMesh) {
        lutMesh.visible = true
        if (lutMesh.material.map) lutMesh.material.map.needsUpdate = true
      }
    }
  })
  vrManager.init(container.value)

  await preloadSceneAssets();
  initMouseValueDisplay();

  // 注册动画循环回调
  addLoopCallback(onLoop);
})

onUnmounted(() => {
  removeLoopCallback(onLoop)
  if (domObserver) {
    domObserver.disconnect()
    domObserver = null
  }
  if (guiMesh) {
    if (guiMesh.material.map) {
      const img = guiMesh.material.map.image as HTMLElement
      if (img && img.parentElement) img.parentElement.remove()
    }
    guiMesh.material.dispose()
    guiMesh.geometry.dispose()
  }
  if (lutMesh) {
    if (lutMesh.material.map) {
      const img = lutMesh.material.map.image as HTMLElement
      if (img && img.parentElement) img.parentElement.remove()
    }
    lutMesh.material.dispose()
    lutMesh.geometry.dispose()
  }
  if (loadingMesh) {
    if (loadingMesh.material.map) {
      const img = loadingMesh.material.map.image as HTMLElement
      if (img && img.parentElement) img.parentElement.remove()
    }
    loadingMesh.material.dispose()
    loadingMesh.geometry.dispose()
  }
  interactableObjects.forEach(obj => {
    const mesh = obj as THREE.Mesh
    mesh.geometry.dispose()
    if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose())
    else mesh.material.dispose()
  })
  originalMaterials.forEach(material => {
    if (Array.isArray(material)) material.forEach(m => m.dispose())
    else material.dispose()
  })
  if (caeMesh) {
    caeMesh.geometry.dispose()
    if (Array.isArray(caeMesh.material)) caeMesh.material.forEach(m => m.dispose())
    else caeMesh.material.dispose()
  }
  if (vrManager) vrManager.dispose()
})

</script>

<template>
  <div class="model-root">
    <div ref="container" class="model-container"></div>

    <!-- Loading 遮罩 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">{{ loadingText }}</div>
        <div class="loading-progress-bar">
          <div class="loading-progress-fill" :style="{ width: loadingProgress + '%' }"></div>
        </div>
        <div class="loading-percentage">{{ loadingProgress }}%</div>
      </div>
    </div>

    <div v-show="showGUI2D && !isVRMode" class="desktop-ui">
      <div class="gui-panel">
        <SettingsPanel :params="guiParams" :options="{
          modelNameOptions,
          typeNodeOptions,
          frameOptions,
          colorMapOptions,
          planeRanges
        }" @reset-model="resetModelPosition" />
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
        <SettingsPanel :params="guiParams" :options="{
          modelNameOptions,
          typeNodeOptions,
          frameOptions,
          colorMapOptions,
          planeRanges
        }" @reset-model="resetModelPosition" />
      </div>

      <!-- LUT 颜色条和数值显示 (3D HTMLMesh) -->
      <div class="lut-shuzhi" ref="lutBodyRef">
        <div class="flex">
          <div ref="shuzhiRef" class="mr-1" />
          <div ref="lutRef" />
        </div>
      </div>

      <!-- VR Loading 面板 (3D HTMLMesh) -->
      <div ref="loadingPanelRef" class="vr-loading-panel">
        <div class="vr-loading-content">
          <div class="vr-loading-spinner"></div>
          <div class="vr-loading-text">{{ loadingText }}</div>
          <div class="vr-loading-progress-bar">
            <div class="vr-loading-progress-fill" :style="{ width: loadingProgress + '%' }"></div>
          </div>
          <div class="vr-loading-percentage">{{ loadingProgress }}%</div>
        </div>
      </div>
    </div>
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
  height: 730px;
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

.gui-panel {
  position: fixed;
  top: 50px;
  left: 20px;
  width: 300px;
  max-height: 81vh;
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

/* Loading 样式 */
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(8px);
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.loading-spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(78, 205, 196, 0.2);
  border-top-color: rgba(78, 205, 196, 1);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: #fff;
  font-size: 18px;
  font-weight: 500;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.loading-progress-bar {
  width: 300px;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.loading-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ecdc4 0%, #44a6a0 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
  box-shadow: 0 0 10px rgba(78, 205, 196, 0.5);
}

.loading-percentage {
  color: rgba(78, 205, 196, 1);
  font-size: 16px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

/* VR Loading 面板样式 */
.vr-loading-panel {
  width: 500px;
  height: 400px;
  background: linear-gradient(135deg, rgba(30, 30, 30, 0.98) 0%, rgba(20, 20, 20, 0.95) 100%);
  padding: 40px;
  border-radius: 16px;
  border: 2px solid rgba(78, 205, 196, 0.5);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
  position: absolute;
  left: -9999px;
  top: -9999px;
  cursor: pointer;
}

.vr-loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 30px;
  height: 100%;
}

.vr-loading-spinner {
  width: 80px;
  height: 80px;
  border: 6px solid rgba(78, 205, 196, 0.2);
  border-top-color: rgba(78, 205, 196, 1);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.vr-loading-text {
  color: #fff;
  font-size: 28px;
  font-weight: 600;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
  text-align: center;
}

.vr-loading-progress-bar {
  width: 100%;
  height: 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  overflow: hidden;
}

.vr-loading-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4ecdc4 0%, #44a6a0 100%);
  border-radius: 6px;
  transition: width 0.3s ease;
  box-shadow: 0 0 15px rgba(78, 205, 196, 0.8);
}

.vr-loading-percentage {
  color: rgba(78, 205, 196, 1);
  font-size: 32px;
  font-weight: 700;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}
</style>
