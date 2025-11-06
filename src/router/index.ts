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
