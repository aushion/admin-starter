import { computed, ref } from 'vue'

type Token = string

const _token = ref<Token | null>(localStorage.getItem('token'))

export function useAuth() {
  const token = computed(() => _token.value)

  function setToken(t: Token | null) {
    _token.value = t
    if (t) localStorage.setItem('token', t)
    else localStorage.removeItem('token')
  }

  function logout() {
    setToken(null)
    // 这里不要直接跳转，避免循环依赖 router
    // 由调用方决定：router.push('/login') 等
  }

  return { token, setToken, logout }
}
