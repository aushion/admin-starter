import { defineStore } from 'pinia'

type ThemeMode = 'light' | 'dark'

export const useAppStore = defineStore('app', {
  state: () => ({
    theme: (localStorage.getItem('theme') as ThemeMode) || 'light',
    sidebarCollapsed: false,
  }),
  actions: {
    setTheme(theme: ThemeMode) {
      this.theme = theme
      localStorage.setItem('theme', theme)
      document.documentElement.classList.toggle('dark', theme === 'dark')
    },
    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    },
    initTheme() {
      this.setTheme(this.theme)
    },
  },
})
