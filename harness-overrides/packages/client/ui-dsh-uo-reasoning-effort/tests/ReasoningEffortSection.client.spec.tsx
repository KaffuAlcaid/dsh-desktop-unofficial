// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../src/client/index.ts'
import {
  developerRoleModeOf, ReasoningEffortSection, REASONING_PRESETS, requestField,
  withDeveloperRole, withReasoning,
} from '../src/client/ReasoningEffortSection.tsx'
import type { ReasoningEffortSectionProps } from '../src/client/ReasoningEffortSection.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t: ReasoningEffortSectionProps['t'] = (key, params) => {
  const template = en[key as keyof typeof en] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/gu, (match, name: string) =>
    name in params ? String(params[name]) : match)
}
const neverHook = (() => { throw new Error('component must not read global hooks') }) as never

function mount(
  model: Readonly<Record<string, unknown>>,
  onChange = vi.fn(),
  protocol = 'openai-completions',
) {
  render(
    <ReasoningEffortSection
      model={model}
      position={1}
      protocol={protocol}
      customProvider
      open
      disabled={false}
      onToggle={vi.fn()}
      onChange={onChange}
      t={t}
      useSessions={neverHook}
      useWorkspaces={neverHook}
    />,
  )
  return onChange
}

describe('ReasoningEffortSection', () => {
  it('offers six manual presets plus custom mode, with no Gemini adapter', () => {
    mount({ id: 'reasoner', reasoningEfforts: REASONING_PRESETS.openai.efforts })

    const preset = screen.getByLabelText<HTMLSelectElement>(`${en.preset} 1`)
    expect([...preset.options].map(option => option.textContent)).toEqual([
      en.presetOpenAI,
      en.presetAnthropic,
      en.presetXAI,
      en.presetKimi,
      en.presetGLM,
      en.presetDeepSeek,
    ])
    expect([...preset.options].some(option => option.textContent?.includes('Gemini'))).toBe(false)
    expect(screen.getByText(en.customMode)).toBeTruthy()
  })

  it('writes the selected preset through existing model fields and preserves unrelated fields', () => {
    const onChange = mount({
      id: 'reasoner',
      name: 'Reasoner',
      reasoningEfforts: REASONING_PRESETS.openai.efforts,
      compat: { futureFlag: 'keep' },
    })
    fireEvent.change(screen.getByLabelText(`${en.preset} 1`), { target: { value: 'deepseek' } })

    expect(onChange).toHaveBeenCalledWith({
      id: 'reasoner',
      name: 'Reasoner',
      reasoningEfforts: { off: null, low: 'low', high: 'high', max: 'max' },
      compat: { futureFlag: 'keep', thinkingFormat: 'deepseek', supportsReasoningEffort: true },
    })
  })

  it('keeps custom request dialects explicit and removes only owned compatibility fields on restore', () => {
    expect(requestField('openai-responses', 'openai')).toBe('reasoning.effort')
    expect(requestField('anthropic-messages', 'openai')).toBe('output_config.effort / thinking.budget_tokens')
    expect(withReasoning({
      id: 'm',
      reasoningEfforts: { high: 'high' },
      compat: {
        thinkingFormat: 'zai', supportsReasoningEffort: true, supportsDeveloperRole: false, futureFlag: 1,
      },
    }, undefined, 'openai-completions')).toEqual({
      id: 'm',
      compat: { futureFlag: 1 },
    })
  })

  it('writes an explicit system role for OpenAI Responses and restores automatic detection', () => {
    const model = {
      id: 'm',
      reasoningEfforts: REASONING_PRESETS.openai.efforts,
      compat: { futureFlag: 1 },
    }
    const onChange = mount(model, vi.fn(), 'openai-responses')

    fireEvent.change(screen.getByLabelText(`${en.systemPromptRole} 1`), { target: { value: 'system' } })
    expect(onChange).toHaveBeenCalledWith({
      ...model,
      compat: { futureFlag: 1, supportsDeveloperRole: false },
    })
    expect(developerRoleModeOf({ compat: { supportsDeveloperRole: true } })).toBe('developer')
    expect(withDeveloperRole({ compat: { supportsDeveloperRole: false, futureFlag: 1 } }, 'auto'))
      .toEqual({ compat: { futureFlag: 1 } })
  })
})
