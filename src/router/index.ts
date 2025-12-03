import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "Home",
    component: () => import("../views/Home.vue"),
    meta: { title: "首页" },
  },
  {
    path: "/vr-scene",
    name: "VRScene",
    component: () => import("../views/VRScenePage.vue"),
    meta: { title: "VR 场景" },
  },
  {
    path: "/dom-overlay",
    name: "DOMOverlay",
    component: () => import("../views/DOMOverlayDemo.vue"),
    meta: { title: "DOM Overlay 演示" },
  },
  {
    path: "/model-viewer",
    name: "ModelViewer",
    component: () => import("../views/Model/index.vue"),
    meta: { title: "模型文件" },
  },
  {
    path: "/old-model",
    name: "OldModel",
    component: () => import("../views/oldModel.vue"),
    meta: { title: "旧模型" },
  },
  {
    path: "/new-model",
    name: "NewModel",
    component: () => import("../views/newModel.vue"),
    meta: { title: "新模型" },
  },
  {
    path: "/dom",
    name: "dom",
    component: () => import("../views/dom.vue"),
    meta: { title: "dom" },
  },
  {
    path: "/vr-sandbox",
    name: "VRSandbox",
    component: () => import("../views/VRSandbox.vue"),
    meta: { title: "VR Sandbox" },
  },
  {
    path: "/digitalbacon-ui",
    name: "Digitalbacon-ui",
    component: () => import("../views/digitalbacon-ui.vue"),
    meta: { title: "digitalbacon-ui" },
  },
  {
    path: "/clipping-demo",
    name: "ClippingDemo",
    component: () => import("../views/ClippingDemo.vue"),
    meta: { title: "Clipping Planes 演示" },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 路由守卫 - 更新页面标题
router.beforeEach((to, _from, next) => {
  document.title = `${to.meta.title || "VR3D"} - VR3D`;
  next();
});

export default router;
