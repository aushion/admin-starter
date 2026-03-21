import { reactive, watch, type WatchStopHandle } from 'vue'
import type { ProFormItem, ProFormOption, ProFormModel } from './types'

type GetValueByPath = (obj: Record<string, any>, path: string) => any
type UpdateField = (field: string, value: any) => void

function shallowArrayEqual(a: any[], b: any[]) {
  if (a === b) return true
  if (!Array.isArray(a) || !Array.isArray(b)) return false
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function optionValue(opt: any) {
  return opt?.value
}

/** ✅ 默认兜底转换：尽量适配常见后端结构 */
function fallbackTransform(raw: any): ProFormOption[] {
  if (!raw) return []

  // 1) 已经是数组
  if (Array.isArray(raw)) {
    return raw.map((x: any) => ({
      label: x?.label ?? x?.text ?? x?.name ?? String(x?.value ?? x?.id ?? x?.key ?? ''),
      value: x?.value ?? x?.id ?? x?.key ?? x?.code,
      children: Array.isArray(x?.children) ? fallbackTransform(x.children) : x?.children,
      disabled: x?.disabled,
    })) as any
  }

  // 2) 常见：{ data/list/records/rows/result/items: [] }
  const list = raw?.data ?? raw?.list ?? raw?.records ?? raw?.rows ?? raw?.result ?? raw?.items
  if (Array.isArray(list)) return fallbackTransform(list)

  // 3) 对象映射：{ "1":"启用","0":"禁用" }
  if (typeof raw === 'object') {
    return Object.keys(raw).map((k) => ({
      value: k,
      label: typeof raw[k] === 'string' ? raw[k] : (raw[k]?.label ?? raw[k]?.text ?? String(k)),
      children: Array.isArray(raw[k]?.children) ? fallbackTransform(raw[k].children) : undefined,
      disabled: raw[k]?.disabled,
    }))
  }

  return []
}

export function useRemoteOptions(params: {
  schema: () => ProFormItem[]
  model: ProFormModel
  getValueByPath: GetValueByPath
  updateField: UpdateField
  isInitializing: () => boolean
}) {
  const { schema, model, getValueByPath, updateField, isInitializing } = params

  const optionsMap = reactive<Record<string, ProFormOption[]>>({})
  const loadingMap = reactive<Record<string, boolean>>({})
  const reqSeq = reactive<Record<string, number>>({})
  const cache = reactive<Record<string, ProFormOption[]>>({})
  const depStops: WatchStopHandle[] = []

  function cacheKey(field: string, depsVals: any[]) {
    return `${field}::${JSON.stringify(depsVals)}`
  }

  function valueExistsInOptions(value: any, opts: ProFormOption[]) {
    const set = new Set(opts.map(optionValue))
    return set.has(value)
  }

  async function load(item: ProFormItem, depsVals: any[] = []) {
    if (!item.request || !item.field) return

    const field = item.field
    const ck = cacheKey(field, depsVals)

    // ✅ 缓存命中
    if (cache[ck]) {
      optionsMap[field] = cache[ck]
      return
    }

    // ✅ 并发保护
    const seq = (reqSeq[field] = (reqSeq[field] || 0) + 1)
    loadingMap[field] = true

    try {
      const raw = await item.request({ model })
      if (reqSeq[field] !== seq) return

      const transformed =
        typeof item.transformOptions === 'function'
          ? item.transformOptions(raw, { model, item })
          : fallbackTransform(raw)

      const finalOpts = Array.isArray(transformed) ? transformed : []

      optionsMap[field] = finalOpts
      cache[ck] = finalOpts
    } catch (e) {
      console.error(`[ProForm] request options failed: ${field}`, e)
    } finally {
      if (reqSeq[field] === seq) loadingMap[field] = false
    }
  }

  function setup() {
    // ✅ 避免 schema 变化导致重复 watch 叠加
    depStops.splice(0).forEach((s) => s())

    const items = schema() ?? []
    for (const item of items) {
      if (!item?.request || !item.field) continue

      const deps = item.dependencies ?? []
      const depsVals = deps.map((d) => getValueByPath(model as any, d))

      // 首次加载
      if (!optionsMap[item.field]) void load(item, depsVals)

      if (!deps.length) continue

      const stop = watch(
        () => deps.map((d) => getValueByPath(model as any, d)),
        async (newVals, oldVals) => {
          if (shallowArrayEqual(newVals as any[], oldVals as any[])) return

          // 依赖变化：先拉新 options
          await load(item, newVals as any[])

          // 清空策略：默认 true，可配置
          const clearCfg = item.clearOnDependenciesChange
          const shouldClear =
            typeof clearCfg === 'function' ? !!clearCfg({ model }) : clearCfg !== false

          if (!shouldClear) return
          if (isInitializing()) return

          // ✅ 体验优化：旧值仍在新 options 中则不清空
          const curVal = getValueByPath(model as any, item.field)
          const opts = optionsMap[item.field] ?? []
          if (curVal !== undefined && valueExistsInOptions(curVal, opts)) return

          updateField(item.field, undefined)
        },
        { deep: false },
      )

      depStops.push(stop)
    }
  }

  watch(schema, setup, { immediate: true, deep: true })

  return { optionsMap, loadingMap, load }
}
