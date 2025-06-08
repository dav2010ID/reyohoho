<template>
  <div class="lava-container">
    <div class="blob-wrap">
      <div class="blob"></div>
      <div class="blob"></div>
      <div class="blob"></div>
      <div class="blob"></div>
      <div class="blob"></div>
    </div>
  </div>
</template>

<style scoped>
.lava-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: -1;
  overflow: hidden;
  background: #000;
}

.blob-wrap {
  filter: blur(40px);
  height: 100%;
  width: 100%;
}

@keyframes move {
  0% {
    transform: translate(0, 0);
  }
  25% {
    transform: translate(60vw, 30vh);
  }
  50% {
    transform: translate(20vw, 70vh);
  }
  75% {
    transform: translate(70vw, 10vh);
  }
  100% {
    transform: translate(0, 0);
  }
}

.blob {
  position: absolute;
  border-radius: 50%;
  opacity: 0.7;
  background: var(--accent-color);
  animation: move 20s infinite;
}

.blob:nth-child(1) {
  width: 20vw;
  height: 20vw;
  top: 5vh;
  left: 5vw;
}

.blob:nth-child(2) {
  width: 25vw;
  height: 25vw;
  top: 40vh;
  left: 60vw;
  animation-delay: -4s;
  background: var(--accent-hover);
}

.blob:nth-child(3) {
  width: 15vw;
  height: 15vw;
  top: 70vh;
  left: 20vw;
  animation-delay: -8s;
  background: var(--accent-transparent);
}

.blob:nth-child(4) {
  width: 30vw;
  height: 30vw;
  top: 20vh;
  left: 30vw;
  animation-delay: -12s;
}

.blob:nth-child(5) {
  width: 22vw;
  height: 22vw;
  top: 60vh;
  left: 80vw;
  animation-delay: -16s;
  background: var(--accent-hover);
}
</style>
