<template>
  <button class="deleteButton">
    <TrashIcon />

    <span class="tooltip">Delete</span>
  </button>
</template>

<script setup>
// eslint-disable-next-line semi
import TrashIcon from '@/components/icons/TrashIcon.vue';
</script>

<style scoped>
.deleteButton {
  width: 40px;
  height: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background-color: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
  background-color: rgba(0, 0, 0, 0.616);
  border: 2px solid #ccc;
}
.deleteButton svg {
  width: 60%;
}
.deleteButton:hover {
  background-color: rgb(237, 56, 56);
  overflow: visible;
}
.bin path {
  transition: all 0.2s;
}
.deleteButton:hover .bin path {
  fill: #fff;
}
.deleteButton:active {
  transform: scale(0.98);
}
.tooltip {
  --tooltip-color: rgb(41, 41, 41);
  position: absolute;
  top: -40px;
  background-color: var(--tooltip-color);
  color: white;
  border-radius: 5px;
  font-size: 12px;
  padding: 8px 12px;
  font-weight: 600;
  box-shadow: 0px 10px 10px rgba(0, 0, 0, 0.105);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.5s;
}
.tooltip::before {
  position: absolute;
  width: 10px;
  height: 10px;
  transform: rotate(45deg);
  content: "";
  background-color: var(--tooltip-color);
  bottom: -10%;
}
.deleteButton:hover .tooltip {
  opacity: 1;
}
</style>
