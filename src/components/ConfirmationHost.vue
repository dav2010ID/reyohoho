<template>
  <BaseModal
    :is-open="!!activeConfirmation"
    :message="activeConfirmation?.message || ''"
    @confirm="settleConfirmation(true)"
    @close="settleConfirmation(false)"
  />
</template>
<script setup>
import BaseModal from './BaseModal.vue'
import { activeConfirmation, settleConfirmation } from '@/composables/useConfirmation'
</script>
