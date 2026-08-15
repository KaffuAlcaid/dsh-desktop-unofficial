// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '../src/client/index.ts'
import {
  automaticInputOf, inputModeOf, ModelInputSection, withInputMode,
} from '../src/client/ModelInputSection.tsx'
import type { ModelInputSectionProps } from '../src/client/ModelInputSection.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t: ModelInputSectionProps['t'] = key => en[key as keyof typeof en] ?? key
const neverHook = (() => { throw new Error('component must not read global hooks') }) as never

const openAIEfforts = {
  off: 'none', minimal: 'minimal', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max',
}

function section(model: Readonly<Record<string, unknown>>, onChange = vi.fn(), disabled = false) {
  return (
    <ModelInputSection
      model={model}
      position={1}
      open
      disabled={disabled}
      onToggle={vi.fn()}
      onChange={onChange}
      t={t}
      useSessions={neverHook}
      useWorkspaces={neverHook}
    />
  )
}

function mount(
  model: Readonly<Record<string, unknown>>,
  onChange = vi.fn(),
  disabled = false,
) {
  render(section(model, onChange, disabled))
  return onChange
}

describe('ModelInputSection', () => {
  it('keeps an absent declaration automatic until the user chooses a mode', () => {
    const onChange = mount({ id: 'gpt-5.5', name: 'GPT-5.5' })
    expect(screen.getByRole('button', { name: en.automatic }).getAttribute('aria-pressed')).toBe('true')
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: en.textAndImages }))
    expect(onChange).toHaveBeenCalledWith({
      id: 'gpt-5.5',
      name: 'GPT-5.5',
      input: ['text', 'image'],
    })
  })

  it('writes text-only and restores inheritance without touching unrelated fields', () => {
    expect(withInputMode({ id: 'm', input: ['text', 'image'], future: 1 }, 'text')).toEqual({
      id: 'm', input: ['text'], future: 1,
    })
    expect(withInputMode({ id: 'm', input: ['text'], future: 1 }, 'automatic')).toEqual({
      id: 'm', future: 1,
    })
  })

  it('materializes automatic input from the selected reasoning preset', () => {
    const model = { id: 'gpt-5.5', reasoningEfforts: openAIEfforts }
    const onChange = mount(model)

    expect(automaticInputOf(model)).toEqual(['text', 'image'])
    expect(onChange).toHaveBeenCalledWith({
      ...model,
      input: ['text', 'image'],
    })

    expect(automaticInputOf({
      id: 'glm', reasoningEfforts: { off: null, high: 'high', max: 'max' },
    })).toEqual(['text'])
  })

  it('keeps automatic input in sync when the reasoning preset changes', () => {
    const onChange = vi.fn()
    const view = render(section({
      id: 'model', reasoningEfforts: openAIEfforts, input: ['text', 'image'],
    }, onChange))

    view.rerender(section({
      id: 'model',
      reasoningEfforts: { off: null, low: 'low', high: 'high', max: 'max' },
      input: ['text', 'image'],
    }, onChange))

    expect(onChange).toHaveBeenCalledWith({
      id: 'model',
      reasoningEfforts: { off: null, low: 'low', high: 'high', max: 'max' },
      input: ['text'],
    })
  })

  it('keeps a manual input override when the reasoning preset changes', () => {
    const onChange = vi.fn()
    const view = render(section({
      id: 'model', reasoningEfforts: openAIEfforts, input: ['text', 'image'],
    }, onChange))
    fireEvent.click(screen.getByRole('button', { name: en.textOnly }))
    onChange.mockClear()

    view.rerender(section({
      id: 'model',
      reasoningEfforts: { off: null, low: 'low', high: 'high', max: 'max' },
      input: ['text'],
    }, onChange))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('preserves unknown future modalities until the user explicitly replaces them', () => {
    const model = { id: 'future', input: ['text', 'image', 'audio'], future: true }
    const onChange = mount(model)
    expect(inputModeOf(model)).toBe('custom')
    expect(screen.getByText(en.keepExisting)).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: en.automatic }))
    expect(onChange).toHaveBeenCalledWith({ id: 'future', future: true })
  })

  it('does not mutate a disabled model', () => {
    const onChange = mount({ id: 'm', reasoningEfforts: openAIEfforts }, vi.fn(), true)
    fireEvent.click(screen.getByRole('button', { name: en.textAndImages }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
