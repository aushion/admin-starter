import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

import '@/styles/reset.css'
import 'uno.css'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// Element Plus 暗黑变量（官方暗黑方案的基础）
import 'element-plus/theme-chalk/dark/css-vars.css'

import '@/styles/theme.css'
import { permissionDirective } from './directives/permission'

const app = createApp(App)

app
  .use(createPinia())
  .use(router)
  .use(ElementPlus)

app.directive('permission', permissionDirective)

app.mount('#app')
