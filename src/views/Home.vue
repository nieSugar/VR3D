<script setup lang="ts">
import { useRouter } from 'vue-router'

import Model from './Model.vue'

const router = useRouter()


const goToRouter = (path: string) => {
  router.push(path)
}

</script>

<template>
  <Model />
  <!-- <div class="home">
    <div class="hero">
      <div class="features">
        <div class="feature-card" @click="goToRouter('/vr-scene')">
          <h3>🎮 主场景</h3>
        </div>
        <div class="feature-card" @click="goToRouter('/dom-overlay')">
          <h3>🤪 演示场景</h3>
        </div>
        <div class="feature-card" @click="goToRouter('/model-viewer')">
          <h3>🤖 模型场景</h3>
        </div>
        <div class="feature-card" @click="goToRouter('/old-model')">
          <h3>🥺 旧场景</h3>
        </div>
        <div class="feature-card" @click="goToRouter('/new-model')">
          <h3>😁 新场景</h3>
        </div>
        <div class="feature-card" @click="goToRouter('/dom')">
          <h3>🥺 dom覆盖</h3>
        </div>
        <div class="feature-card" @click="goToRouter('/vr-sandbox')">
          <h3>🌟 VR 沙盒</h3>
        </div>
        <div class="feature-card" @click="goToRouter('/digitalbacon-ui')">
          <h3>🌟 digitalbacon-ui</h3>
        </div>
      </div>
    </div>
  </div> -->
</template>

<style scoped>
.home {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.hero {
  text-align: center;
  max-width: 1200px;
  padding: 2rem;
}

.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .features {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .features {
    grid-template-columns: 1fr;
  }
}

.feature-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 1rem;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: transform 0.3s ease;
  cursor: pointer;
}

.feature-card:hover {
  transform: translateY(-5px);
  background: rgba(255, 255, 255, 0.15);
}

.feature-card h3 {
  font-size: 1.2rem;
  margin: 0;
}
</style>
