import { defineConfig, presetWind3, presetIcons } from 'unocss'
// import presetIcons from '@unocss/preset-icons'
// import type { IconifyJSON } from '@iconify/types'
// import carbonJson from '@iconify-json/carbon/icons.json'

export default defineConfig({

  safelist: [
    // /^i-carbon-/,
    'i-carbon-dashboard',
    'i-carbon-chart-bar',
    'i-carbon-map',
    'i-carbon-earth',
    'i-carbon-flow',
    'i-carbon-network-3',
    'i-carbon-document-export',
  ],

  presets: [
    presetWind3(),
    presetIcons({
      prefix: 'i-', //
      collections: {
        // ✅ 用 loader 函数返回 IconifyJSON（兼容新版类型）
        carbon: () => import('@iconify-json/carbon/icons.json').then(i => i.default as any),
      },
    }),
  ],

})
