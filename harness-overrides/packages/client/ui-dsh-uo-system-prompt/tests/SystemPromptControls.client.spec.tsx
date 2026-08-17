// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SystemPromptCreate, SystemPromptEdit } from '../src/client/SystemPromptControls.tsx'
import type { SystemPromptCreateProps, SystemPromptEditProps } from '../src/client/SystemPromptControls.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en): string => en[key]

describe('system-prompt preset controls', () => {
  it('creates from the owner slot and refreshes the roster', async () => {
    const createPreset = vi.fn(() => Promise.resolve({ ok: true as const }))
    const refresh = vi.fn(() => Promise.resolve())
    render(<SystemPromptCreate {...({
      authorable: true,
      presetIds: ['standard'],
      refresh,
      createPreset,
      t,
    } as unknown as SystemPromptCreateProps)} />)

    fireEvent.click(screen.getByRole('button', { name: en.create }))
    fireEvent.change(screen.getByLabelText(en.identifier), { target: { value: 'mine' } })
    fireEvent.change(screen.getByLabelText(en.name), { target: { value: 'My agent' } })
    fireEvent.change(screen.getByLabelText(en.prompt), { target: { value: 'Be concise.' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))

    await waitFor(() => {
      expect(createPreset).toHaveBeenCalledWith('mine', 'My agent', 'Be concise.')
      expect(refresh).toHaveBeenCalledTimes(1)
    })
  })

  it('keeps a partially created preset and points back to its card', async () => {
    const refresh = vi.fn(() => Promise.resolve())
    render(<SystemPromptCreate {...({
      authorable: true,
      presetIds: [],
      refresh,
      createPreset: () => Promise.resolve({ ok: false as const, created: true, message: 'write failed' }),
      t,
    } as unknown as SystemPromptCreateProps)} />)

    fireEvent.click(screen.getByRole('button', { name: en.create }))
    fireEvent.change(screen.getByLabelText(en.identifier), { target: { value: 'mine' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))

    expect((await screen.findByRole('alert')).textContent).toContain(en.createdButPromptFailed)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('loads and updates one user preset from its pencil action', async () => {
    const savePrompt = vi.fn(() => Promise.resolve({ ok: true as const }))
    render(<SystemPromptEdit {...({
      agentPreset: 'mine',
      title: 'My agent',
      readPrompt: () => Promise.resolve({ ok: true as const, text: 'Old prompt.' }),
      savePrompt,
      t,
    } as unknown as SystemPromptEditProps)} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.edit}: My agent` }))
    const editor = await screen.findByLabelText(en.prompt)
    expect((editor as HTMLTextAreaElement).value).toBe('Old prompt.')
    fireEvent.change(editor, { target: { value: 'New prompt.' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))

    await waitFor(() => { expect(savePrompt).toHaveBeenCalledWith('mine', 'New prompt.') })
  })

  it('allows another save after a write failure', async () => {
    const savePrompt = vi.fn()
      .mockResolvedValueOnce({ ok: false as const, message: 'write failed' })
      .mockResolvedValueOnce({ ok: true as const })
    render(<SystemPromptEdit {...({
      agentPreset: 'mine',
      title: 'My agent',
      readPrompt: () => Promise.resolve({ ok: true as const, text: 'Old prompt.' }),
      savePrompt,
      t,
    } as unknown as SystemPromptEditProps)} />)

    fireEvent.click(screen.getByRole('button', { name: `${en.edit}: My agent` }))
    const editor = await screen.findByLabelText(en.prompt)
    fireEvent.click(screen.getByRole('button', { name: en.save }))

    expect((await screen.findByRole('alert')).textContent).toContain(en.saveFailed)
    expect((screen.getByRole('button', { name: en.save }) as HTMLButtonElement).disabled).toBe(false)
    fireEvent.change(editor, { target: { value: 'Retry prompt.' } })
    fireEvent.click(screen.getByRole('button', { name: en.save }))

    await waitFor(() => { expect(savePrompt).toHaveBeenLastCalledWith('mine', 'Retry prompt.') })
    expect(savePrompt).toHaveBeenCalledTimes(2)
  })
})
