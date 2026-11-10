import { onBeforeUnmount, shallowRef } from 'vue'

export const activeConfirmation = shallowRef(null)
export const settleConfirmation = (accepted) => {
  const current = activeConfirmation.value
  activeConfirmation.value = null
  current?.resolve(accepted)
}

export function useConfirmation() {
  const owner = {}
  onBeforeUnmount(() => {
    if (activeConfirmation.value?.owner === owner) settleConfirmation(false)
  })
  return (message) => {
    settleConfirmation(false)
    return new Promise(resolve => { activeConfirmation.value = { message, resolve, owner } })
  }
}
