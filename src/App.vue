<script setup lang="ts">
import Navigation from './components/Navigation.vue'
</script>

<template>
  <div id="app">
    <Navigation />
    <router-view />
  </div>
</template>

<style scoped>
#app {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
