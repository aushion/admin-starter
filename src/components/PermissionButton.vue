<template>
  <el-tooltip
    v-if="!hidden"
    :content="!allowed ? disabledTip : ''"
    :disabled="allowed || !disabledTip"
    placement="top"
  >
    <el-button v-bind="$attrs" :disabled="!allowed || $attrs.disabled" @click="handleClick">
      <slot />
    </el-button>
  </el-tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { usePermission } from '@/composables/usePermission'
import type { PermissionCode } from '@/store/permission'

defineOptions({ name: 'PermissionButton', inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** 所需权限编码 */
    permission: PermissionCode | PermissionCode[]
    /** 无权限时的行为：disable（禁用）或 hide（隐藏） */
    mode?: 'disable' | 'hide'
    /** 禁用时的提示文字 */
    disabledTip?: string
  }>(),
  {
    mode: 'disable',
    disabledTip: '暂无操作权限',
  },
)

const emit = defineEmits<{ click: [e: MouseEvent] }>()

const { hasPermission } = usePermission()

const allowed = computed(() => hasPermission(props.permission))
const hidden = computed(() => !allowed.value && props.mode === 'hide')

function handleClick(e: MouseEvent) {
  if (allowed.value) emit('click', e)
}
</script>
