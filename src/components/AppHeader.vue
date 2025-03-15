<template>
  <div class="header">
    <HeaderSearch />
  </div>
</template>

<script setup>
import HeaderSearch from './HeaderSearch.vue'
</script>

<style scoped>
.header {
  width: calc(100vw - 80px);
  min-width: 371px;
  background: rgb(23, 23, 23);

  @media screen and (max-width: 600px) {
    width: auto;
  }
}
</style>
