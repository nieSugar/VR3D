<template>
  <div class="background-color-selector">
    <!-- 2D UI 控制面板（用于调试） -->
    <div v-if="!isInVR" class="debug-panel">
      <h3>背景色选择器（调试模式）</h3>
      <div class="color-preview" :style="{ backgroundColor: currentColor }"></div>
      <p>当前颜色: {{ currentColor }}</p>
      <button @click="enterVR">进入VR模式</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted } from 'vue';
import * as THREE from 'three';
import * as DigitalBaconUI from 'digitalbacon-ui';

// Type definitions
interface ColorOption {
  label: string;
  value: string;
  rgb: { r: number; g: number; b: number };
}

// State
const currentColor = ref<string>('#87CEEB'); // 默认天蓝色
const isInVR = ref<boolean>(false);
const scene = shallowRef<THREE.Scene | null>(null); // 使用 shallowRef 避免深度响应式
const renderer = shallowRef<THREE.WebGLRenderer | null>(null);
const camera = shallowRef<THREE.PerspectiveCamera | null>(null);
const container = shallowRef<HTMLElement | null>(null);

// 预设的颜色选项
const colorOptions: ColorOption[] = [
  { label: '天蓝色', value: '#87CEEB', rgb: { r: 0.529, g: 0.808, b: 0.922 } },
  { label: '日落橙', value: '#FF7F50', rgb: { r: 1.0, g: 0.498, b: 0.314 } },
  { label: '深夜蓝', value: '#191970', rgb: { r: 0.098, g: 0.098, b: 0.439 } },
  { label: '森林绿', value: '#228B22', rgb: { r: 0.133, g: 0.545, b: 0.133 } },
  { label: '紫罗兰', value: '#8B008B', rgb: { r: 0.545, g: 0.0, b: 0.545 } },
  { label: '珊瑚粉', value: '#FF6B9D', rgb: { r: 1.0, g: 0.42, b: 0.616 } },
  { label: '月光银', value: '#C0C0C0', rgb: { r: 0.753, g: 0.753, b: 0.753 } },
  { label: '深空黑', value: '#0C0C0C', rgb: { r: 0.047, g: 0.047, b: 0.047 } },
];

// 初始化Three.js场景
const initThreeScene = async () => {
  // 创建容器
  container.value = document.getElementById('threejs-container') || document.body;
  
  // 创建场景
  scene.value = new THREE.Scene();
  scene.value.background = new THREE.Color(currentColor.value);

  // 创建相机
  camera.value = new THREE.PerspectiveCamera(
    90,
    container.value.clientWidth / container.value.clientHeight,
    0.1,
    1000
  );
  camera.value.position.set(0, 1.7, 3);

  // 创建渲染器
  renderer.value = new THREE.WebGLRenderer({ antialias: true });
  renderer.value.setSize(container.value.clientWidth, container.value.clientHeight);
  renderer.value.xr.enabled = true; // 启用WebXR
  container.value.appendChild(renderer.value.domElement);

  // 添加灯光
  const ambientLight = new THREE.AmbientLight(0x404040, 1);
  scene.value.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 10, 5);
  scene.value.add(directionalLight);

  // 添加一些基础的3D对象用于参考
  const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(0, 1.5, -2);
  scene.value.add(cube);

  // 启用XR控制器管理
  DigitalBaconUI.InputHandler.enableXRControllerManagement(scene.value);
  
  // 初始化DigitalBaconUI
  await DigitalBaconUI.init(container.value, renderer.value, scene.value, camera.value);
  
  // 创建UI面板
  createUIPanel();

  // 动画循环
  renderer.value.setAnimationLoop((time, frame) => {
    // 更新DigitalBaconUI
    DigitalBaconUI.update(frame);
    
    // 旋转立方体
    if (cube) {
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
    }
    
    // 渲染场景
    renderer.value!.render(scene.value!, camera.value!);
  });
};

// 创建UI面板
const createUIPanel = () => {
  if (!scene.value) return;
  
  // 创建主容器Body
  const body = new DigitalBaconUI.Body({
    borderRadius: 0.02,
    borderWidth: 0.005,
    height: 0.5,
    width: 0.6,
    justifyContent: 'start',
    alignItems: 'stretch',
    padding: 0.02,
    materialColor: 0x1a1a1a,
    opacity: 0.9,
    overflow: 'scroll',
  });

  // 创建标题文本
  const titleText = new DigitalBaconUI.Text('场景背景色设置', {
    color: 0xffffff,
    fontSize: 0.04,
    fontWeight: 'bold',
    marginBottom: 0.02,
  });
  body.add(titleText);

  // 创建说明文本
  const instructionText = new DigitalBaconUI.Text('请选择场景背景颜色:', {
    color: 0xcccccc,
    fontSize: 0.025,
    marginBottom: 0.015,
  });
  body.add(instructionText);

  // 创建选项容器
  const optionsContainer = new DigitalBaconUI.Div({
    height: 'auto',
    width: '100%',
    flexDirection: 'column',
    gap: 0.01,
  });

  // 为每个颜色选项创建按钮
  colorOptions.forEach((option) => {
    // 创建选项行容器
    const optionRow = new DigitalBaconUI.Div({
      height: 0.06,
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0.015,
      padding: 0.01,
      borderRadius: 0.01,
      materialColor: currentColor.value === option.value ? 0x2a4a2a : 0x2a2a2a,
      backgroundVisible: true,
    });

    // 创建颜色预览块
    const colorPreview = new DigitalBaconUI.Div({
      height: 0.04,
      width: 0.04,
      borderRadius: 0.005,
      materialColor: new THREE.Color(option.value).getHex(),
      backgroundVisible: true,
      borderWidth: 0.002,
      borderColor: 0xffffff,
    });
    optionRow.add(colorPreview);

    // 创建可点击的 Div 作为按钮
    const optionButton = new DigitalBaconUI.Div({
      height: 0.04,
      width: 'auto',
      flexGrow: 1,
      justifyContent: 'start',
      paddingLeft: 0.01,
      backgroundVisible: true,
      materialColor: 0x333333,
      borderRadius: 0.005,
    });

    const buttonText = new DigitalBaconUI.Text(option.label, {
      color: currentColor.value === option.value ? 0x66ff66 : 0xffffff,
      fontSize: 0.025,
    });

    optionButton.add(buttonText);

    // 添加点击事件
    optionButton.onClick = () => {
      handleColorChange(option.value);
      // 更新UI状态
      updateUISelection(optionsContainer, option.value);
    };

    optionRow.add(optionButton);

    // 如果是当前选中的颜色，添加选中标记
    if (currentColor.value === option.value) {
      const checkmark = new DigitalBaconUI.Text('✓', {
        color: 0x66ff66,
        fontSize: 0.03,
        marginLeft: 'auto',
        marginRight: 0.01,
      });
      optionRow.add(checkmark);
    }

    optionsContainer.add(optionRow);
  });

  body.add(optionsContainer);

  // 添加当前颜色显示
  const currentColorDisplay = new DigitalBaconUI.Div({
    height: 0.08,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0.02,
    marginTop: 0.02,
    padding: 0.015,
    borderRadius: 0.01,
    borderWidth: 0.002,
    borderColor: 0x666666,
    backgroundVisible: true,
    materialColor: 0x1f1f1f,
  });

  const currentColorLabel = new DigitalBaconUI.Text('当前颜色:', {
    color: 0xaaaaaa,
    fontSize: 0.022,
  });
  currentColorDisplay.add(currentColorLabel);

  const currentColorValue = new DigitalBaconUI.Text(currentColor.value, {
    color: 0xffffff,
    fontSize: 0.025,
    fontFamily: 'monospace',
    id: 'currentColorValue', // 添加ID以便后续更新
  });
  currentColorDisplay.add(currentColorValue);

  body.add(currentColorDisplay);

  // 设置面板位置
  body.position.set(-1, 1.7, -2);
  
  // 将面板添加到场景
  scene.value.add(body);
};

// 更新UI选择状态
const updateUISelection = (container: any, selectedValue: string) => {
  // 这里可以实现更新UI选中状态的逻辑
  // 由于DigitalBaconUI的限制，可能需要重新创建面板
  console.log('Selected color:', selectedValue);
};

// 处理颜色变化
const handleColorChange = (color: string) => {
  currentColor.value = color;
  
  if (scene.value) {
    // 使用动画过渡更新背景色
    const targetColor = new THREE.Color(color);
    const startColor = scene.value.background as THREE.Color;
    
    // 简单的颜色过渡动画
    let progress = 0;
    const animateColor = () => {
      progress += 0.05;
      if (progress <= 1) {
        const r = startColor.r + (targetColor.r - startColor.r) * progress;
        const g = startColor.g + (targetColor.g - startColor.g) * progress;
        const b = startColor.b + (targetColor.b - startColor.b) * progress;
        scene.value!.background = new THREE.Color(r, g, b);
        requestAnimationFrame(animateColor);
      } else {
        scene.value!.background = targetColor;
      }
    };
    animateColor();
    
    // 输出日志
    const colorOption = colorOptions.find(opt => opt.value === color);
    if (colorOption) {
      console.log(`背景色已更改为: ${colorOption.label} (${color})`);
    }
  }
};

// 进入VR模式
const enterVR = async () => {
  if (renderer.value && 'xr' in navigator) {
    try {
      // @ts-ignore
      const session = await navigator.xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      });
      
      renderer.value.xr.setSession(session);
      isInVR.value = true;
      
      session.addEventListener('end', () => {
        isInVR.value = false;
      });
    } catch (error) {
      console.error('无法进入VR模式:', error);
      alert('VR模式不可用，请确保您的设备支持WebXR');
    }
  } else {
    alert('您的浏览器不支持WebXR');
  }
};

// 处理窗口大小变化
const handleResize = () => {
  if (camera.value && renderer.value && container.value) {
    camera.value.aspect = container.value.clientWidth / container.value.clientHeight;
    camera.value.updateProjectionMatrix();
    renderer.value.setSize(container.value.clientWidth, container.value.clientHeight);
  }
};

// 生命周期钩子
onMounted(() => {
  initThreeScene();
  window.addEventListener('resize', handleResize);
  
  // 检查是否已在VR模式
  if ('xr' in navigator) {
    // @ts-ignore
    navigator.xr.isSessionSupported('immersive-vr').then((supported: boolean) => {
      if (supported) {
        console.log('VR supported');
      }
    });
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  
  // 清理Three.js资源
  if (renderer.value) {
    renderer.value.dispose();
    if (container.value && renderer.value.domElement.parentNode === container.value) {
      container.value.removeChild(renderer.value.domElement);
    }
  }
});
</script>

<style scoped>
.background-color-selector {
  position: relative;
  width: 100%;
  height: 100vh;
}

#threejs-container {
  width: 100%;
  height: 100vh;
  position: absolute;
  top: 0;
  left: 0;
}

.debug-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 255, 255, 0.95);
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  min-width: 250px;
}

.debug-panel h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 18px;
}

.color-preview {
  width: 100%;
  height: 60px;
  border-radius: 5px;
  margin-bottom: 10px;
  border: 2px solid #ddd;
}

.debug-panel p {
  margin: 10px 0;
  color: #666;
  font-size: 14px;
  font-family: 'Courier New', monospace;
}

.debug-panel button {
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.3s ease;
}

.debug-panel button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.debug-panel button:active {
  transform: translateY(0);
}

.debug-panel button:disabled {
  background: #cccccc;
  cursor: not-allowed;
}
</style>
