import { HTMLMesh } from "three/examples/jsm/interactive/HTMLMesh.js";
import { InteractiveGroup } from "three/examples/jsm/interactive/InteractiveGroup.js";
import { createApp, h, ref } from "vue";
import CustomCheckbox from "../components/CustomCheckbox.vue";
import CustomSelect, {
  type SelectOption,
} from "../components/CustomSelect.vue";
import CustomSlider from "../components/CustomSlider.vue";

/**
 * 创建材质选择器和checkbox的自定义UI
 */
export function createMaterialSelectUI(
  parameters: any,
  onMaterialChange: () => void,
  onModelVisibilityChange: () => void,
  onRadiusChange: () => void,
  container: HTMLElement,
  group: InteractiveGroup
): { materialSelectMesh: HTMLMesh; customSelectDiv: HTMLDivElement } {
  // 创建容器
  const customSelectDiv = document.createElement("div");
  customSelectDiv.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: transparent;
    height: 500px;
    z-index: 100;
    overflow: visible;
  `;

  const childDiv = document.createElement("div");
  childDiv.style.cssText = `
    background: rgba(30, 30, 30, 0.95);
    border: 2px solid #666;
    border-radius: 8px;
    padding: 15px;
    font-family: Arial, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
    z-index: 100;
    backdrop-filter: blur(10px);
    overflow: visible;
  `;
  const checkboxVal = ref(parameters.showModel);
  const checkboxContainer = document.createElement("div");
  // 挂载CustomCheckbox组件
  const checkboxApp = createApp({
    setup() {
      return () =>
        h(CustomCheckbox, {
          modelValue: checkboxVal.value as boolean,
          label: "显示模型",
          "onUpdate:modelValue": (value: boolean) => {
            console.log(1, value, "modelValue");
            checkboxVal.value = value;
            parameters.showModel = value;
            onModelVisibilityChange();
          },
        });
    },
  });
  checkboxApp.mount(checkboxContainer);

  const materials: SelectOption[] = [
    { value: "glass", label: "玻璃" },
    { value: "metal", label: "金属" },
    { value: "plastic", label: "塑料" },
    { value: "wireframe", label: "线框" },
    { value: "normal", label: "法线" },
  ];

  // 创建select容器并挂载Vue组件
  const selectContainer = document.createElement("div");
  const materialValue = ref(parameters.materialType);
  const selectApp = createApp({
    setup() {
      return () =>
        h(CustomSelect, {
          modelValue: materialValue.value as string,
          options: materials,
          label: "材质类型:",
          "onUpdate:modelValue": (value: string) => {
            materialValue.value = value;
            parameters.materialType = value;
            onMaterialChange();
          },
        });
    },
  });
  selectApp.mount(selectContainer);

  // 创建slider容器
  const sliderContainer = document.createElement("div");
  const radiusValue = ref(parameters.radius);
  const sliderApp = createApp({
    setup() {
      return () =>
        h(CustomSlider, {
          modelValue: radiusValue.value,
          title: "半径",
          min: 0,
          max: 1,
          step: 0.01,
          "onUpdate:modelValue": (value: number) => {
            console.log(value, "value");
            radiusValue.value = value;
            parameters.radius = value;
            onRadiusChange();
          },
        });
    },
  });
  sliderApp.mount(sliderContainer);

  childDiv.appendChild(selectContainer);
  childDiv.appendChild(checkboxContainer);
  childDiv.appendChild(sliderContainer);

  customSelectDiv.appendChild(childDiv);
  container.appendChild(customSelectDiv);

  // 创建VR场景中的HTMLMesh
  const materialSelectMesh = new HTMLMesh(customSelectDiv);
  materialSelectMesh.position.x = 0.75;
  materialSelectMesh.position.y = 1.5;
  materialSelectMesh.position.z = -0.5;
  materialSelectMesh.rotation.y = -Math.PI / 4;
  materialSelectMesh.scale.setScalar(2);
  group.add(materialSelectMesh);

  return { materialSelectMesh, customSelectDiv };
}
