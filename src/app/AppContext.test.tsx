import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AppProvider, useApp } from './AppContext'
import { createEmptyData } from '../domain/defaults'

vi.mock('../storage/database', () => ({
  loadAppData: vi.fn(async () => createEmptyData()),
  saveAppData: vi.fn(async () => undefined),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function Controls() {
  const { ready, updateData } = useApp()
  return (
    <button
      disabled={!ready}
      onClick={() =>
        updateData((data) => ({
          ...data,
          settings: { ...data.settings, appearance: 'light' },
        }))
      }
    >
      Use light appearance
    </button>
  )
}

it('follows system appearance changes and stops following after an explicit choice', async () => {
  const media = new EventTarget() as EventTarget & { matches: boolean }
  media.matches = false
  const remove = vi.spyOn(media, 'removeEventListener')
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  )
  render(
    <AppProvider>
      <Controls />
    </AppProvider>,
  )
  await waitFor(() => expect(screen.getByRole('button')).toBeEnabled())
  expect(document.documentElement.dataset.theme).toBe('light')
  act(() => {
    media.matches = true
    media.dispatchEvent(new Event('change'))
  })
  expect(document.documentElement.dataset.theme).toBe('dark')
  act(() => screen.getByRole('button').click())
  expect(remove).toHaveBeenCalledWith('change', expect.any(Function))
  act(() => media.dispatchEvent(new Event('change')))
  expect(document.documentElement.dataset.theme).toBe('light')
})
