<template>
  <div class="min-h-screen flex items-center justify-center bg-[var(--app-bg)]">
    <div class="w-[400px]">
      <!-- Logo / Title -->
      <div class="text-center mb-8">
        <div
          class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--el-color-primary)] mb-4"
        >
          <i class="i-carbon-user-avatar-filled text-white text-2xl" />
        </div>
        <h1 class="text-2xl font-bold text-[var(--app-text)]">欢迎回来</h1>
        <p class="text-sm text-[var(--el-text-color-secondary)] mt-1">登录您的账号以继续</p>
      </div>

      <!-- Form Card -->
      <el-card shadow="never" class="!border-[var(--el-border-color)] !bg-[var(--el-bg-color)]">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          size="large"
          label-position="top"
          @keyup.enter="handleLogin"
        >
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              :prefix-icon="UserIcon"
              clearable
            />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
              :prefix-icon="LockIcon"
              show-password
              clearable
            />
          </el-form-item>

          <div class="flex items-center justify-between mb-4">
            <el-checkbox v-model="rememberMe">记住我</el-checkbox>
            <el-link type="primary" :underline="false">忘记密码？</el-link>
          </div>

          <el-button type="primary" class="w-full" :loading="loading" @click="handleLogin">
            登 录
          </el-button>

          <div class="text-center mt-4 text-sm text-[var(--el-text-color-secondary)]">
            还没有账号？
            <el-link type="primary" :underline="false" @click="$router.push('/register')">
              立即注册
            </el-link>
          </div>

          <!-- 快捷登录按钮 -->
          <el-divider content-position="center">
            <span class="text-xs text-[var(--el-text-color-placeholder)]">快捷登录</span>
          </el-divider>
          <div class="flex gap-2">
            <el-button class="flex-1" size="small" @click="quickLogin('admin', 'admin123')">
              管理员
            </el-button>
            <el-button class="flex-1" size="small" @click="quickLogin('ops', 'ops123')">
              运营
            </el-button>
            <el-button class="flex-1" size="small" @click="quickLogin('viewer', 'viewer123')">
              访客
            </el-button>
          </div>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, markRaw } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { loginApi } from '@/api/auth'
import { useAuth } from '@/composables/useAuth'
import { usePermissionStore } from '@/store/permission'

defineOptions({ name: 'LoginPage' })

const UserIcon = markRaw(User)
const LockIcon = markRaw(Lock)

const router = useRouter()
const route = useRoute()
const { setToken } = useAuth()
const permission = usePermissionStore()

const formRef = ref()
const loading = ref(false)
const rememberMe = ref(false)

const form = ref({
  username: '',
  password: '',
})

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function doLogin(username: string, password: string) {
  const res = await loginApi(username, password)
  setToken(res.token)
  // 重置权限状态，让路由守卫重新拉取
  permission.resetPermission()
  ElMessage.success('登录成功')
  const redirect = (route.query.redirect as string) || '/'
  router.replace(redirect)
}

async function handleLogin() {
  await formRef.value?.validate()
  loading.value = true
  try {
    await doLogin(form.value.username, form.value.password)
  } catch {
    ElMessage.error('用户名或密码错误')
  } finally {
    loading.value = false
  }
}

function quickLogin(username: string, password: string) {
  form.value.username = username
  form.value.password = password
  loading.value = true
  doLogin(username, password)
    .catch(() => {
      ElMessage.error('登录失败')
    })
    .finally(() => {
      loading.value = false
    })
}
</script>
