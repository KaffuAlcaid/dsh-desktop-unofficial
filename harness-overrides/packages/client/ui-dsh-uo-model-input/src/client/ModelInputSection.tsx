import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  IconChevronDownOutline14, IconChevronRightOutline14,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-settings-models/client'
import type { ModelInputKey } from './locales.ts'
import css from './ModelInputSection.module.css'

export type ModelInputMode = 'automatic' | 'text' | 'image' | 'custom'

type InputPresetId = 'openai' | 'anthropic' | 'xai' | 'kimi' | 'glm' | 'deepseek'
type ReasoningLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
type ReasoningEfforts = Partial<Record<ReasoningLevel, string | null>>

const REASONING_LEVELS: readonly ReasoningLevel[] = [
  'off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max',
]

/** Signatures written by the reasoning plugin's manually selected presets. */
const PRESET_EFFORTS: Readonly<Record<InputPresetId, ReasoningEfforts>> = {
  openai: {
    off: 'none', minimal: 'minimal', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max',
  },
  anthropic: { off: null, low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
  xai: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh' },
  kimi: { low: 'low', high: 'high', max: 'max' },
  glm: { off: null, high: 'high', max: 'max' },
  deepseek: { off: null, low: 'low', high: 'high', max: 'max' },
}

/** Conservative input defaults attached to the six reasoning presets. */
const PRESET_INPUTS: Readonly<Record<InputPresetId, readonly string[]>> = {
  openai: ['text', 'image'],
  anthropic: ['text', 'image'],
  xai: ['text', 'image'],
  kimi: ['text', 'image'],
  glm: ['text'],
  deepseek: ['text'],
}

const PRESET_IDS = Object.keys(PRESET_EFFORTS) as InputPresetId[]

export type ModelInputSectionProps =
  & PropsRuntime<'settings.models.model.input'>
  & PropsLocale<'dsh-uo.model-input'>

function reasoningEffortsOf(model: Readonly<Record<string, unknown>>): ReasoningEfforts | undefined {
  const value = model['reasoningEfforts']
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const source = value as Record<string, unknown>
  return Object.fromEntries(REASONING_LEVELS.flatMap((level) => {
    const wire = source[level]
    return typeof wire === 'string' || wire === null ? [[level, wire]] : []
  })) as ReasoningEfforts
}

function sameEfforts(left: ReasoningEfforts, right: ReasoningEfforts): boolean {
  return REASONING_LEVELS.every(level => left[level] === right[level])
}

function presetOf(model: Readonly<Record<string, unknown>>): InputPresetId | undefined {
  const efforts = reasoningEffortsOf(model)
  if (efforts === undefined) return undefined
  return PRESET_IDS.find(id => sameEfforts(efforts, PRESET_EFFORTS[id]))
}

function sameInput(left: unknown, right: readonly string[]): boolean {
  return Array.isArray(left)
    && left.length === right.length
    && right.every(modality => left.includes(modality))
}

/** Resolve the input declaration managed by the selected reasoning preset. */
export function automaticInputOf(model: Readonly<Record<string, unknown>>): readonly string[] | undefined {
  const preset = presetOf(model)
  return preset === undefined ? undefined : PRESET_INPUTS[preset]
}

/** Resolve the practical mode without rewriting unknown future modalities. */
export function inputModeOf(model: Readonly<Record<string, unknown>>): ModelInputMode {
  const value = model['input']
  if (value === undefined || Array.isArray(value) && value.length === 0) return 'automatic'
  const automatic = automaticInputOf(model)
  if (automatic !== undefined && sameInput(value, automatic)) return 'automatic'
  if (!Array.isArray(value) || !value.every(entry => typeof entry === 'string')) return 'custom'
  const unique = new Set(value)
  if (unique.size === 1 && unique.has('text')) return 'text'
  if (unique.size === 2 && unique.has('text') && unique.has('image')) return 'image'
  return 'custom'
}

/** Replace only the input declaration while preserving the complete model record. */
export function withInputMode(
  model: Readonly<Record<string, unknown>>,
  mode: Exclude<ModelInputMode, 'custom'>,
): Record<string, unknown> {
  const next = { ...model }
  if (mode === 'automatic') {
    const automatic = automaticInputOf(model)
    if (automatic === undefined) Reflect.deleteProperty(next, 'input')
    else next['input'] = [...automatic]
  } else next['input'] = mode === 'text' ? ['text'] : ['text', 'image']
  return next
}

const MODES: readonly Exclude<ModelInputMode, 'custom'>[] = ['automatic', 'text', 'image']

function labelOf(mode: ModelInputMode): ModelInputKey {
  switch (mode) {
    case 'automatic': return 'automatic'
    case 'text': return 'textOnly'
    case 'image': return 'textAndImages'
    case 'custom': return 'keepExisting'
  }
}

/** Per-model input-capability fold contributed to the official Models row. */
export function ModelInputSection(props: ModelInputSectionProps): ReactNode {
  const [mode, setMode] = useState<ModelInputMode>(() => inputModeOf(props.model))
  const automatic = automaticInputOf(props.model)

  useEffect(() => {
    if (mode !== 'automatic' || props.disabled) return
    if (automatic === undefined) {
      if (!Object.hasOwn(props.model, 'input')) return
    } else if (sameInput(props.model['input'], automatic)) return
    props.onChange(withInputMode(props.model, 'automatic'))
  }, [automatic, mode, props.disabled, props.model, props.onChange])

  return (
    <section className={css.modelFold}>
      <button
        type="button"
        className={css.modelFoldToggle}
        aria-expanded={props.open}
        onClick={props.onToggle}
      >
        {props.open ? <IconChevronDownOutline14 /> : <IconChevronRightOutline14 />}
        <span>{props.t('title')}</span>
        <span className={css.modelFoldMeta}>{props.t(labelOf(mode))}</span>
      </button>
      {props.open
        ? (
          <div className={css.modelFoldBody}>
            <div
              className={css.inputModes}
              role="group"
              aria-label={`${props.t('title')} ${props.position}`}
            >
              {MODES.map(choice => (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={mode === choice}
                  disabled={props.disabled}
                  onClick={() => {
                    setMode(choice)
                    props.onChange(withInputMode(props.model, choice))
                  }}
                >
                  {props.t(labelOf(choice))}
                </button>
              ))}
            </div>
          </div>
        )
        : null}
    </section>
  )
}
