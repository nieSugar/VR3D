<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()


const goToRouter = (path: string) => {
  router.push(path)
}

</script>

<template>
  <div class="home">
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
      </div>
    </div>
  </div>
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
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
}

.feature-card {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 1rem;
  padding: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: transform 0.3s ease;
  cursor: pointer;
}

.feature-card:hover {
  transform: translateY(-5px);
  background: rgba(255, 255, 255, 0.15);
}

.feature-card h3 {
  font-size: 1.5rem;
}
</style>
