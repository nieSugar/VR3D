<template>
  <div id="deBugUi" ref="container" />

  <div class="lut-shuzhi">
    <div class="flex">
      <div ref="shuzhiRef" class="mr-1" />
      <div ref="lutRef" />
    </div>
  </div>
  <div v-show="showValuePopover" :style="{ left: `${mouseLocation.x}px`, top: `${mouseLocation.y}px` }"
    class="value-popover">
    {{ mapNumber(pointValue) }}
  </div>
</template>

<script lang="ts" setup>
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';
import { Lut } from 'three/examples/jsm/math/Lut.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { onMounted, onUnmounted, ref, unref, watch } from 'vue';
interface KvType {
  [key: string]: any;
}

interface Task {
  name?: string;
  val?: Array<number>;
  max?: number;
  min?: number;
}

interface NewTask {
  name?: string;
  val?: Array<number>;
  max?: number;
  min?: number;
  key?: string;
  nameKey?: string;
  valIsArray?: boolean;
  unit?: string;
}


// 路由和响应式状态
const showValuePopover = ref(false);
const pointValue = ref(0);
const mouseLocation = { x: 0, y: 0 };

const newTaskValues: Array<{
  value: Array<NewTask>;
  name: string;
  nameKey: string;
  unit: string;
  valIsArray: boolean;
}> = [];

// let currentTime = '';
// let nodeDownloadUrl: string | undefined;
// let valDownloadUrl: string | undefined;
let stlFileUrl: string | undefined;
// let clipPath: string | undefined;

// 参数相关
const unit = ref();

// 任务列表相关
const currentTask = ref(0);
const tasks = ref<Array<Array<Array<Task>>>>([[]]);
const showTaskList = ref(false);
const taskContentRef = ref<HTMLDivElement>();

watch(
  () => currentTask.value,
  value => {
    const taskContent = taskContentRef.value;
    if (taskContent) {
      const additional = 3;
      if (value < additional) {
        taskContent.scrollTop = 0;
      } else if (value > unref(tasks).length - additional) {
        taskContent.scrollTop = taskContent.scrollHeight - taskContent.clientHeight;
      } else {
        taskContent.scrollTop =
          ((value - additional) / (unref(tasks).length - additional * 2)) * (taskContent.scrollHeight - taskContent.clientHeight);
      }
    }
  }
);

// 帧数进度条相关
// const sliderValue = ref(0);
const frameNumber = ref(0);
// let frameOptions: Array<string> = [];

// 3D 场景与渲染相关
const container = ref<HTMLDivElement>();
const lutRef = ref<HTMLDivElement>();
const shuzhiRef = ref<HTMLDivElement>();

let perpCamera: THREE.PerspectiveCamera;
let orthoCamera: THREE.OrthographicCamera;
let renderer: THREE.WebGLRenderer;

let planes: Array<THREE.Plane>;
let planeObjects: Array<THREE.Mesh>;
let planeHelpers: Array<THREE.PlaneHelper>;
let mesh: THREE.Mesh;
let meshClip: THREE.Mesh | null = null;
let scene: THREE.Scene;
let uiScene: THREE.Scene;
let controls: OrbitControls;
let label2dRenderer: CSS2DRenderer;

let lut: Lut = new Lut();

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
Object.entries(ColorMapKeywords).forEach(([name, colormap]) => {
  lut.addColorMap(name, colormap);
});

const params = {
  typenode: '',
  nameKey: '',
  timesnode: '',
  opacity: 1,
  frame: '',
  colorMap: 'rainbow',
  animate: false,
  planeX: { scope: 0, reversal: false, plan: false, maxValue: 0, newLen: 0, newMin: 0 },
  planeY: { scope: 0, reversal: false, plan: false, maxValue: 0, newLen: 0, newMin: 0 },
  planeZ: { scope: 0, reversal: false, plan: false, maxValue: 0, newLen: 0, newMin: 0 },
  nodes: {},
  nownode: [],
  rotate: false,
  wireframe: false,
  segmentation: false
};

const taskvals: Array<{
  name?: string;
  key?: string;
  times?: KvType;
  unit?: string;
}> = [];

let nodeParam: any;
let gui: GUI = new GUI();
let maxval: number;
let minval: number;
let colorMapController: any;

const uniforms = { iTime: { value: 0.0 } };
const mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let setValueTimeout: number;


function getValue() {
  window.addEventListener('mousemove', event => {
    if (stlFileUrl && params.opacity !== 0) {
      return;
    }

    clearTimeout(setValueTimeout ?? '');
    setValueTimeout = setTimeout(() => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      mouseLocation.x = event.clientX - 20;
      mouseLocation.y = event.clientY - 40;

      raycaster.setFromCamera(mouse, perpCamera);
      const intersectObjects = raycaster.intersectObject(mesh, false);

      if (intersectObjects && intersectObjects.length > 0) {
        const face = intersectObjects[0]?.face;
        const object = intersectObjects[0]?.object as THREE.Mesh;
        const pressure = object?.geometry?.attributes?.pressure?.array as Float32Array | undefined;
        const values = [pressure?.[face?.a ?? 0], pressure?.[face?.b ?? 0], pressure?.[face?.c ?? 0]].filter((v): v is number => v !== undefined);
        if (values.length > 0) {
          const avg = values.reduce((a, b) => a + b) / values.length;
          pointValue.value = avg;
          showValuePopover.value = true;
        } else {
          showValuePopover.value = false;
        }
      } else {
        showValuePopover.value = false;
      }
    }, 100);
    showValuePopover.value = false;
  });
}

const jsonstr = {
  metadata: { version: 4, type: 'BufferGeometry' },
  uuid: 'AF2ADB07-FBC5-4BAE-AD60-123456789ABC',
  type: 'BufferGeometry',
  data: {
    index: { type: 'Uint32Array', array: [] as number[] },
    attributes: {
      position: { itemSize: 3, type: 'Float32Array', array: [] as number[] },
      pressure: { itemSize: 1, type: 'Float32Array', array: [] as number[] }
    }
  }
};

async function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x263238);
  uiScene = new THREE.Scene();

  // 将自定义颜色映射添加到 lut
  Object.entries(ColorMapKeywords).forEach(([name, colormap]) => {
    lut.addColorMap(name, colormap);
  });

  const width = window.innerWidth;
  const height = window.innerHeight;

  perpCamera = new THREE.PerspectiveCamera(60, width / height, 0.01, 99999999);
  perpCamera.position.set(3.6103746175409768, 0.9974999792213456, 6.573527790490485);
  scene.add(perpCamera);

  orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2);
  orthoCamera.position.set(0.5, 0, 1);


  label2dRenderer = new CSS2DRenderer();
  label2dRenderer.setSize(window.innerWidth, window.innerHeight);
  label2dRenderer.domElement.style.position = 'absolute';
  label2dRenderer.domElement.style.top = '0';
  container.value?.appendChild(label2dRenderer.domElement);

  planes = [
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), 0),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)
  ];

  mesh = new THREE.Mesh(
    undefined,
    new THREE.MeshStandardMaterial({
      side: THREE.DoubleSide,
      metalness: 0,
      roughness: 0,
      vertexColors: true,
      // clipping: true,
      clippingPlanes: planes,
      // renderOrder: 0,
      // uniforms: { iTime: { value: 0.5 } }
    })
  );

  (mesh.material as THREE.MeshStandardMaterial).onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      'gl_FragColor = vec4( outgoingLight, diffuseColor.a );',
      `
        float oldcolor=smoothstep(0.,1.,vColor.r);
        diffuseColor.a=max(.2,oldcolor);
        gl_FragColor = vec4( outgoingLight, diffuseColor.a );
      `
    );
  };
  scene.add(mesh);

  planeHelpers = planes.map(p => new THREE.PlaneHelper(p, 20, 0xffffff));
  planeHelpers.forEach(ph => {
    ph.visible = false;
    scene.add(ph);
  });

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

  const light = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(light);

  const light2 = new THREE.DirectionalLight(0xffffff, 0.3);
  light2.position.set(5, 10, 7.5);
  scene.add(light2);

  const light3 = new THREE.DirectionalLight(0xffffff, 0.6);
  light3.position.set(0, 100, 0);
  scene.add(light3);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.autoClear = false;
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);
  container.value?.appendChild(renderer.domElement);
  renderer.localClippingEnabled = true;

  window.addEventListener('resize', onWindowResize, false);

  controls = new OrbitControls(perpCamera, label2dRenderer.domElement);
  controls.target.set(3.6103746175409768, 0.9974999792213453, 1.42597205139674);
  controls.update();

  // 加载节点数据和数值数据
  const [nodeResponse, valueResponse] = await Promise.all([
    fetch('/src/assets/objects/470/FNode.json').then(r => r.json()),
    fetch('/src/assets/objects/470/FValue.json').then(r => r.json())
  ])
  nodeParam = nodeResponse;

  if (stlFileUrl) {
    const loader = new STLLoader();
    loader.load(stlFileUrl, function (geometry) {
      const material = new THREE.MeshPhongMaterial({
        color: 0xed9d9d9,
        specular: 0x494949,
        // clipping: true,
        clippingPlanes: planes,
        shininess: 200
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.updateMatrixWorld();
      scene.add(mesh);
    });
  }

  taskvals.push(...valueResponse);
  mapTaskData();
  showTaskList.value = unref(tasks).length > 1;
  loadJson();
}

function loadJson() {
  loadModel((type: string[]) => {
    console.log(type, 'type');
    const bbox = new THREE.Box3().setFromObject(mesh);
    // if (gui != null) gui.destroy();
    // gui = new GUI();

    const planeX = gui.addFolder('X');
    planes[0].constant = bbox.max.x + bbox.max.x * 0.1 + 10;
    planeX
      .add(params.planeX, 'plan')
      .name('面板')
      .onChange(v => (planeHelpers[0].visible = v));
    planeX
      .add(params.planeX, 'scope')
      .name('范围')
      .setValue(bbox.max.x + bbox.max.x * 0.1)
      .min(bbox.min.x + bbox.min.x * 0.1)
      .max(bbox.max.x + bbox.max.x * 0.1)
      .onChange(d => (planes[0].constant = d));
    planeX.open();

    const planeY = gui.addFolder('Y');
    planes[1].constant = bbox.max.y + bbox.max.y * 0.1 + 10;
    planeY
      .add(params.planeY, 'plan')
      .name('面板')
      .onChange(v => (planeHelpers[1].visible = v));
    planeY
      .add(params.planeY, 'scope')
      .name('范围')
      .setValue(bbox.max.y + bbox.max.y * 0.1)
      .min(bbox.min.y + bbox.min.y * 0.1)
      .max(bbox.max.y + bbox.max.y * 0.1)
      .onChange(d => (planes[1].constant = d));
    planeY.open();

    const planeZ = gui.addFolder('Z');
    planes[2].constant = bbox.max.z + bbox.max.z * 0.1 + 10;
    planeZ
      .add(params.planeZ, 'plan')
      .name('面板')
      .onChange(v => (planeHelpers[2].visible = v));
    planeZ
      .add(params.planeZ, 'scope')
      .name('范围')
      .setValue(bbox.max.z + bbox.max.z * 0.1)
      .min(bbox.min.z + bbox.min.z * 0.1)
      .max(bbox.max.z + bbox.max.z * 0.1)
      .onChange(d => (planes[2].constant = d));
    planeZ.open();
    gui
      .add(params, 'animate')
      .name('动画')
      .setValue(false)
      .onChange(() => {
        playtimes();
      });
    gui
      .add(params, 'rotate')
      .name('自动旋转')
      .setValue(false)
      .onChange(() => {
        controls.autoRotate = params.rotate;
      });
    gui
      .add(params, 'wireframe')
      .name('线框')
      .setValue(false)
      .onChange(() => {
        mesh.material.wireframe = params.wireframe;
        mesh.material.needsUpdate = true;
      });
    gui
      .add(params, 'segmentation')
      .name('分割')
      .setValue(false)
      .onChange(() => {
        mesh.material.ribbon = params.segmentation;
        params.colorMap = 'grayscale';
        updateColors();
        mesh.material.needsUpdate = true;
        colorMapController?.updateDisplay();
      });

    colorMapController = gui
      .add(params, 'colorMap', [
        'water',
        'rainbow',
        'cooltowarm',
        'blackbody',
        'grayscale'
      ])
      .onChange(function () {
        updateColors();
      });
    gui
      .add(params, 'typenode', type)
      .setValue(type[0])
      .onChange(function () {
        params.nownode = [...params.nodes[params.typenode]];
        getFrameNumber();
        updateTimes();
      });
    updateTimes();
  });
}

function updateTimes() {
  newTaskValues.forEach(v => {
    if (v.name == params.typenode) {
      const val = v.value.find(s => s.key === params.frame);
      if (val && val.val) {
        const geometry = mesh!.geometry as THREE.BufferGeometry
        geometry.setAttribute('pressure', new THREE.Float32BufferAttribute(val.val, 1));
        // (mesh!.geometry as THREE.BufferGeometry).attributes.pressure!.array = val.val;
        maxval = getMaxOrMin(val.val, 'max');
        minval = getMaxOrMin(val.val, 'min');
        shuzhi(maxval, minval);
        updateColors();
      }
    }
  });
}

function updateColors() {
  lut.setColorMap(params.colorMap);
  lut.setMax(maxval);
  lut.setMin(minval);

  const geometry = mesh.geometry;
  const pressures = geometry.attributes.pressure;
  const colors = geometry.attributes.color;
  if (!pressures || !colors) {
    return;
  }

  for (let i = 0; i < pressures.array.length; i++) {
    const colorValue = pressures.array[i] ?? 0;
    const color = lut.getColor(colorValue);
    if (color === undefined) {
      console.log('Unable to determine color for value:', colorValue);
    } else {
      colors.setXYZ(i, color.r, color.g, color.b);
    }
  }
  colors.needsUpdate = true;

  if (meshClip) {
    const geometryClip = meshClip.geometry;
    const pressuresClip = geometryClip.attributes.pressure;
    const colorsClip = geometryClip.attributes.color;
    if (!pressuresClip || !colorsClip) {
      return;
    }

    for (let i = 0; i < pressuresClip.array.length; i++) {
      const colorValue = pressuresClip.array[i] ?? 0;
      const color = lut.getColor(colorValue);
      if (color === undefined) {
        console.log('Unable to determine color for value:', colorValue);
      } else {
        colorsClip.setXYZ(i, color.r, color.g, color.b);
      }
    }
    colorsClip.needsUpdate = true;
  }

  lutRef.value!.children?.item(0)?.remove();
  const lutCanvas = lut.createCanvas();
  lutCanvas.style.width = '1rem';
  lutCanvas.style.height = `${window.innerHeight < 415 ? window.innerHeight * 0.7 : 415}px`;
  lutRef.value!.appendChild(lutCanvas);
}

function loadModel(callback: (type: string[]) => void) {
  if (!newTaskValues || newTaskValues.length === 0) {
    return;
  }
  const taskValue = newTaskValues[0]!;
  const data = taskValue.value;
  unit.value = taskValue.unit;
  params.nameKey = taskValue.nameKey;
  const taskData = data[0]!;

  jsonstr.data.index.array = nodeParam.indexs as number[];
  jsonstr.data.attributes.position.array = nodeParam.nodes as number[];
  jsonstr.data.attributes.pressure.array = taskData.val || [];
  // currentTime = data[0]!.key ?? '';

  maxval = getMaxOrMin(taskData.val ?? [], 'max');
  minval = getMaxOrMin(taskData.val ?? [], 'min');
  shuzhi(maxval, minval);

  const loader = new THREE.BufferGeometryLoader();
  const geometry = loader.parse(jsonstr);

  const colors = [];
  const positionCount = geometry.attributes.position?.count ?? 0;
  for (let i = 0, n = positionCount; i < n; ++i) {
    colors.push(1, 1, 1);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  mesh.geometry = geometry;
  mesh.geometry.computeVertexNormals();
  applyBoxUV(mesh.geometry);
  focusObj(mesh);

  const type: string[] = [];
  newTaskValues.forEach(v => {
    type.push(v.name);
    if ((params.nodes as any)[v.name] == undefined) {
      (params.nodes as any)[v.name] = v.value;
    }
  });
  const firstType = type[0];
  params.nownode = firstType ? ((params.nodes as any)[firstType] ?? []) : [];
  // frameOptions = params.nownode.map(v => v.key ?? '');
  getFrameNumber();
  updateColors();
  callback(type);
}

function getFrameNumber() {
  frameNumber.value = params.nownode.length - 1;
}

function shuzhi(max: number, min: number) {
  const mrW = 100;
  const mrH = window.innerHeight < 415 ? window.innerHeight * 0.7 : 415;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: true });
  canvas.width = mrW;
  canvas.height = mrH + 40;
  canvas.style.color = '#ffffff';
  if (!ctx) {
    return;
  }
  ctx.beginPath();
  ctx.font = '12px bold';
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const isShowPoint = Math.max(...[Math.abs(max), Math.abs(min)]) >= 100;

  for (let i = 0; i <= 10; i++) {
    if (i == 0) {
      ctx.fillText(`${mapNumber(max, isShowPoint)}`, mrW, 7);
    } else if (i == 10) {
      ctx.fillText(`${mapNumber(min, isShowPoint)}`, mrW, mrH - 7);
    } else {
      ctx.fillText(`${mapNumber(max - ((max - min) / 10) * i, isShowPoint)}`, mrW, 7 + ((mrH - 14) / 10) * i);
    }
  }

  ctx.fillText(`${unit.value}`, mrW, mrH + 14);
  ctx.fillText(params.typenode, mrW, mrH + 32);
  ctx.closePath();

  shuzhiRef.value?.children.item(0)?.remove();
  shuzhiRef.value?.appendChild(canvas);
}

function mapNumber(value: number, isShowPoint?: boolean) {
  if (isShowPoint === undefined) {
    isShowPoint = value >= 100;
  }
  const length = (1 / value).toFixed().length;
  const cardinal = Math.pow(10, length);
  const val = Number(`${Number((value * cardinal).toFixed(2))}e-${length}`);
  if (isShowPoint) {
    return Math.floor(val);
  } else {
    return val.toFixed(2);
  }
}

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
  } else if (positionAttr) {
    for (let vi = 0; vi < positionAttr.array.length; vi += 9) {
      const vx0 = positionAttr.array[vi] ?? 0;
      const vy0 = positionAttr.array[vi + 1] ?? 0;
      const vz0 = positionAttr.array[vi + 2] ?? 0;

      const vx1 = positionAttr.array[vi + 3] ?? 0;
      const vy1 = positionAttr.array[vi + 4] ?? 0;
      const vz1 = positionAttr.array[vi + 5] ?? 0;

      const vx2 = positionAttr.array[vi + 6] ?? 0;
      const vy2 = positionAttr.array[vi + 7] ?? 0;
      const vz2 = positionAttr.array[vi + 8] ?? 0;

      const v0 = new THREE.Vector3(vx0, vy0, vz0);
      const v1 = new THREE.Vector3(vx1, vy1, vz1);
      const v2 = new THREE.Vector3(vx2, vy2, vz2);

      const uvs = makeUVs(v0, v1, v2);

      const idx0 = vi / 3;
      const idx1 = idx0 + 1;
      const idx2 = idx0 + 2;

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
  console.log(bufferGeometry, 'bufferGeometry');

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

function onWindowResize() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  perpCamera.aspect = width / height;
  perpCamera.updateProjectionMatrix();

  renderer.setSize(width, height);
}

function animate() {
  requestAnimationFrame(animate);

  if (params.rotate) {
    controls.update();
  }

  uniforms.iTime.value++;

  for (let i = 0; i < planeObjects.length; i++) {
    const plane = planes[i];
    const po = planeObjects[i];
    if (plane && po) {
      plane.coplanarPoint(po.position);
      po.lookAt(po.position.x - plane.normal.x, po.position.y - plane.normal.y, po.position.z - plane.normal.z);
    }
  }

  label2dRenderer.render(scene, perpCamera);
  renderer.clear();
  renderer.render(scene, perpCamera);
  renderer.render(uiScene, orthoCamera);
}

function chunkArray(arr: number[], chunkSize: number) {
  const chunks: number[][] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }
  return chunks;
}

function getMaxOrMin(data: Array<number>, type: 'max' | 'min') {
  const checkList = chunkArray(data, 2000);
  const numbers = [];
  for (const item of checkList) {
    const num = type === 'max' ? Math.max.apply(null, item) : Math.min.apply(null, item);
    numbers.push(num);
  }
  const val = type === 'max' ? Math.max.apply(null, numbers) : Math.min.apply(null, numbers);
  return val;
}

function focusObj(target: THREE.Object3D) {
  let distance: number;
  const delta = new THREE.Vector3();
  const box = new THREE.Box3();
  const center = new THREE.Vector3();
  const sphere = new THREE.Sphere();

  box.setFromObject(target);

  if (box.isEmpty() === false) {
    box.getCenter(center);
    distance = box.getBoundingSphere(sphere).radius;
  } else {
    center.setFromMatrixPosition(target.matrixWorld);
    distance = 0.1;
  }

  delta.set(0, 0, 1);
  delta.applyQuaternion(perpCamera.quaternion);
  delta.multiplyScalar(distance * 1.5);

  perpCamera.position.copy(center).add(delta);
  controls.target = center;
  controls.update();
}

function mapTaskData() {
  for (const task of taskvals) {
    const newTaskList = [];
    let name = '';
    let unit = '';
    let nameKey = '';
    let valIsArray = false;

    for (const key in task.times) {
      const newTask: NewTask = {};
      if (Object.prototype.hasOwnProperty.call(task.times, key)) {
        const val = task.times[key];
        name = newTask.name = task.name ?? '';
        unit = newTask.unit = task.unit ?? '';
        nameKey = newTask.nameKey = task.key ?? '';
        newTask.key = key;
        newTask.val = val;

        if (val && val.length > 0) {
          valIsArray = newTask.valIsArray = Array.isArray(val[0]);
        }

        if (valIsArray) {
          for (const [index, i] of (val as Array<Array<number>>).entries()) {
            const data = Math.hypot(i[0] ?? 0, i[1] ?? 0, i[2] ?? 0);
            val[index] = data;
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

  console.log(newTaskValues, 'newTaskValues');
}

onMounted(async () => {
  init();
  animate();
  getValue();
});

onUnmounted(() => {
  gui?.destroy();
});
</script>

<style lang="scss" scoped>
:deep(.el-step.is-vertical) {
  min-height: 4rem;
}

.task-content {
  position: absolute;
  top: 10%;
  left: 3%;
  padding-left: 0.5rem;
  text-align: center;
  width: 3.5%;
  padding-top: 10px;
  height: 80%;
  overflow: auto;

  &::-webkit-scrollbar-track {
    border-radius: 10px;
  }

  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background-color: rgba(0, 0, 0, 0.2);
    border-radius: 10px;
    transition: all 0.2s ease-in-out;
  }

  .task-item {
    width: 40px;
    height: 40px;
    border-radius: 90px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 1.1rem;
    background-color: #e4e3e3;
    border: 1px solid #ffffff;
  }

  .task-item-select {
    border-color: #409eff;
    background-color: #409eff;
  }
}

.slider {
  position: absolute;
  bottom: 5%;
  width: 100%;

  .slider-body {
    margin: 0 auto;
    display: flex;
    justify-content: space-evenly;
    align-items: center;
    width: 40%;

    .slider-content {
      width: 95%;
    }

    .slider-value {
      padding-left: 1rem;
      color: azure;
    }
  }
}

.value-popover {
  position: absolute;
  color: #ffffff;
  padding: 0.25rem;
  border: 1px solid #a3a3a3;
  border-radius: 7px;
}

.lut-shuzhi {
  position: absolute;
  top: 4%;
}
</style>
