/** Simplified Chinese dictionary. */
export const zh = {
  'title': '输入能力',
  'automatic': '自动',
  'textOnly': '仅文本',
  'textAndImages': '文本与图片',
  'keepExisting': '保留现有配置',
} satisfies Record<string, string>

/** Model-input locale key union. */
export type ModelInputKey = keyof typeof zh

/** English dictionary. */
export const en = {
  'title': 'Input capability',
  'automatic': 'Automatic',
  'textOnly': 'Text only',
  'textAndImages': 'Text and images',
  'keepExisting': 'Keep existing config',
} satisfies Record<ModelInputKey, string>
