export const logoutAndRedirect = async ({ authStore, router, to = '/login' }) => {
  authStore.logout()
  await router.push(to)
}
