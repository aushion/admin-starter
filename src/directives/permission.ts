import type { Directive, DirectiveBinding } from 'vue'
import { usePermissionStore, type PermissionCode } from '@/store/permission'

type BindingValue =
  | PermissionCode
  | PermissionCode[]
  | { value: PermissionCode | PermissionCode[]; mode?: 'hide' | 'disable' }

function normalize(binding: DirectiveBinding<BindingValue>) {
  const raw = binding.value

  if (typeof raw === 'string' || Array.isArray(raw)) {
    return { value: raw, mode: binding.modifiers.disable ? 'disable' : 'hide' as const }
  }

  const value = raw?.value ?? []
  const mode = raw?.mode === 'disable' || binding.modifiers.disable ? 'disable' : 'hide'

  return { value, mode }
}

function toArray(input?: PermissionCode | PermissionCode[]) {
  if (!input) return [] as PermissionCode[]
  return Array.isArray(input) ? input : [input]
}

function apply(el: HTMLElement, binding: DirectiveBinding<BindingValue>) {
  const store = usePermissionStore()
  const { value, mode } = normalize(binding)
  const perms = toArray(value)
  const allowed = store.hasPermission(perms)

  if (allowed) {
    if (mode === 'disable') {
      el.removeAttribute('disabled')
      el.classList.remove('is-disabled')
    }
    return
  }

  if (mode === 'disable') {
    el.setAttribute('disabled', 'true')
    el.classList.add('is-disabled')
    return
  }

  const parent = el.parentNode
  if (parent) {
    parent.removeChild(el)
  }
}

export const permissionDirective: Directive<HTMLElement, BindingValue> = {
  mounted(el, binding) {
    apply(el, binding)
  },
  updated(el, binding) {
    apply(el, binding)
  },
}
