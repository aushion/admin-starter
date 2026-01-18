import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

import 'uno.css'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// Element Plus 暗黑变量（官方暗黑方案的基础）
import 'element-plus/theme-chalk/dark/css-vars.css'

import '@/styles/theme.css'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(ElementPlus)
  .mount('#app')
