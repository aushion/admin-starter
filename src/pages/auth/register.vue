<template>
  <div class="min-h-screen flex items-center justify-center bg-[var(--app-bg)]">
    <div class="w-[400px]">
      <!-- Logo / Title -->
      <div class="text-center mb-8">
        <div
          class="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[var(--el-color-primary)] mb-4"
        >
          <i class="i-carbon-user-follow text-white text-2xl" />
        </div>
        <h1 class="text-2xl font-bold text-[var(--app-text)]">创建账号</h1>
        <p class="text-sm text-[var(--el-text-color-secondary)] mt-1">填写信息完成注册</p>
      </div>

      <!-- Form Card -->
      <el-card shadow="never" class="!border-[var(--el-border-color)] !bg-[var(--el-bg-color)]">
        <el-form ref="formRef" :model="form" :rules="rules" size="large" label-position="top">
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="form.username"
              placeholder="请输入用户名"
              :prefix-icon="UserIcon"
              clearable
            />
          </el-form-item>

          <el-form-item label="邮箱" prop="email">
            <el-input
              v-model="form.email"
              placeholder="请输入邮箱地址"
              :prefix-icon="EmailIcon"
              clearable
            />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码（至少6位）"
              :prefix-icon="LockIcon"
              show-password
              clearable
            />
          </el-form-item>

          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input
              v-model="form.confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              :prefix-icon="LockIcon"
              show-password
              clearable
            />
          </el-form-item>

          <el-form-item prop="agree">
            <el-checkbox v-model="form.agree">
              我已阅读并同意
              <el-link type="primary" :underline="false">用户协议</el-link>
              与
              <el-link type="primary" :underline="false">隐私政策</el-link>
            </el-checkbox>
          </el-form-item>

          <el-button type="primary" class="w-full" :loading="loading" @click="handleRegister">
            注 册
          </el-button>

          <div class="text-center mt-4 text-sm text-[var(--el-text-color-secondary)]">
            已有账号？
            <el-link type="primary" :underline="false" @click="$router.push('/login')">
              立即登录
            </el-link>
          </div>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, markRaw } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { User, Lock, Message } from '@element-plus/icons-vue'

defineOptions({ name: 'RegisterPage' })

const UserIcon = markRaw(User)
const LockIcon = markRaw(Lock)
const EmailIcon = markRaw(Message)

const router = useRouter()
const formRef = ref()
const loading = ref(false)

const form = ref({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  agree: false,
})

const validateConfirmPassword = (_: unknown, value: string, callback: (e?: Error) => void) => {
  if (value !== form.value.password) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const validateAgree = (_: unknown, value: boolean, callback: (e?: Error) => void) => {
  if (!value) {
    callback(new Error('请阅读并同意用户协议'))
  } else {
    callback()
  }
}

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱地址', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少6位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
  agree: [{ validator: validateAgree, trigger: 'change' }],
}

async function handleRegister() {
  await formRef.value?.validate()
  loading.value = true
  try {
    // TODO: 接入注册接口
    await new Promise((resolve) => setTimeout(resolve, 800))
    ElMessage.success('注册成功，请登录')
    router.push('/login')
  } finally {
    loading.value = false
  }
}
</script>
