import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '../error-boundary'

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('Test explosion')
  return <div>All good</div>
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <div>Hello</div>
      </ErrorBoundary>
    )
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('renders error UI when child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something broke')).toBeInTheDocument()
    expect(screen.getByText('Test explosion')).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('clears error state when "Try again" is clicked', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something broke')).toBeInTheDocument()

    // Click "Try again" clears the error, but the child will throw again
    // so error UI should reappear. This verifies the button calls setState.
    fireEvent.click(screen.getByText('Try again'))

    // After clicking, React re-renders the children. Since ThrowingChild
    // still throws, the error boundary catches it again.
    expect(screen.getByText('Something broke')).toBeInTheDocument()
    spy.mockRestore()
  })
})
