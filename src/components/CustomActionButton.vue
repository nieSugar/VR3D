<template>
  <button class="action-button" @click="handleClick">
    <span class="button-label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  label: string
}

defineProps<Props>()
const emit = defineEmits<{
  click: []
}>()

const handleClick = () => {
  emit('click')
}
</script>

<style scoped>
.action-button {
  width: 100%;
  padding: 6px 12px;
  margin-top: 3px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #4ecdc4 0%, #44a6a0 100%);
  border: 1px solid rgba(78, 205, 196, 0.5);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  box-shadow: 0 2px 8px rgba(78, 205, 196, 0.2);
  user-select: none;
}

.button-label {
  display: block;
  text-align: center;
}
</style>

