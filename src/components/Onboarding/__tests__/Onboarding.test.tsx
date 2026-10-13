import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Onboarding } from '../index'
import { saveOnboardingConfig, saveOnboardingCompleted } from '../../../lib/tauri'

const mockStore = {
  onboardingStep: 5,
  setOnboardingStep: vi.fn(),
  setOnboardingCompleted: vi.fn(),
  sttTestStatus: 'idle',
  llmTestStatus: 'idle',
  onboardingMode: 'cloud',
  setOnboardingMode: vi.fn(),
  updateConfig: vi.fn(),
  setConfig: vi.fn(),
  setSavedConfig: vi.fn(),
  config: {},
}

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../OnboardingLayout', () => ({
  OnboardingLayout: ({
    children,
    onBack,
    onNext,
  }: {
    children: React.ReactNode
    onBack: () => void
    onNext: () => void
  }) => (
    <div>
      <button type="button" onClick={onBack}>
        Back
      </button>
      <button type="button" onClick={onNext}>
        Next
      </button>
      {children}
    </div>
  ),
}))

vi.mock('../WelcomeStep', () => ({ WelcomeStep: () => <div>Welcome</div> }))
vi.mock('../AccountStep', () => ({ AccountStep: () => <div>Account</div> }))
vi.mock('../ModeSelectStep', () => ({ ModeSelectStep: () => <div>Mode</div> }))
vi.mock('../SttSetupStep', () => ({ SttSetupStep: () => <div>STT</div> }))
vi.mock('../LlmSetupStep', () => ({ LlmSetupStep: () => <div>LLM</div> }))
vi.mock('../PermissionsStep', () => ({ PermissionsStep: () => <div>Permissions</div> }))
vi.mock('../QuickTestStep', () => ({ QuickTestStep: () => <div>Quick Test</div> }))
vi.mock('../DoneStep', () => ({ DoneStep: () => <div>Done</div> }))

vi.mock('../../../stores/appStore', () => ({
  useAppStore: (selector: (state: typeof mockStore) => unknown) => selector(mockStore),
}))

vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'test-user' } }),
}))

vi.mock('../../../lib/tauri', () => ({
  saveOnboardingConfig: vi.fn().mockResolvedValue({}),
  saveOnboardingCompleted: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockStore.onboardingStep = 5
  mockStore.onboardingMode = 'cloud'
  mockStore.setOnboardingStep.mockReset()
})

afterEach(() => cleanup())

describe('Onboarding cloud navigation', () => {
  it('keeps onboarding open and reports a failed credential save', async () => {
    mockStore.onboardingStep = 7
    vi.mocked(saveOnboardingConfig).mockRejectedValueOnce(new Error('vault unavailable'))
    render(<Onboarding />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('common.saveFailed'))
    expect(saveOnboardingCompleted).not.toHaveBeenCalled()
    expect(mockStore.setOnboardingCompleted).not.toHaveBeenCalled()
  })
  it('replaces the onboarding draft with sanitized settings before entering the app', async () => {
    mockStore.onboardingStep = 7
    const saved = { ...mockStore.config, stt_api_key: '', stt_custom_api_key: '', llm_api_key: '' }
    vi.mocked(saveOnboardingConfig).mockResolvedValueOnce(
      saved as Awaited<ReturnType<typeof saveOnboardingConfig>>,
    )
    render(<Onboarding />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(mockStore.setOnboardingCompleted).toHaveBeenCalledWith(true))
    expect(saveOnboardingCompleted).toHaveBeenCalled()
    expect(mockStore.setConfig).toHaveBeenCalledWith(saved)
    expect(mockStore.setSavedConfig).toHaveBeenCalledWith(saved)
  })
  it('returns from Permissions to Mode Select because cloud skips provider setup', async () => {
    render(<Onboarding />)

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    await waitFor(() => expect(mockStore.setOnboardingStep).toHaveBeenCalledWith(2))
  })

  it('returns from Quick Test to Permissions', async () => {
    mockStore.onboardingStep = 6
    render(<Onboarding />)

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))

    await waitFor(() => expect(mockStore.setOnboardingStep).toHaveBeenCalledWith(5))
  })
})
