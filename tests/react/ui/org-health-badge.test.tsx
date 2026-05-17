/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OrgHealthBadge } from '../../../src/react/ui/org-health-badge'

describe('OrgHealthBadge', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn()
  })

  it('shows loading state initially', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))

    render(<OrgHealthBadge orgSlug="gym_iron" />)
    expect(screen.getByText('Pagos...')).toBeDefined()
  })

  it('shows healthy badge when health check passes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({ status: 'healthy', checks: {} }),
    } as Response)

    render(<OrgHealthBadge orgSlug="gym_iron" />)
    await waitFor(() => {
      expect(screen.getByText('Pagos ✓')).toBeDefined()
    })
  })

  it('shows unhealthy badge when health check fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({
        status: 'unhealthy',
        checks: { checkout: { status: 'fail', message: 'OAuth not connected' } },
      }),
    } as Response)

    render(<OrgHealthBadge orgSlug="gym_iron" />)
    await waitFor(() => {
      expect(screen.getByText('Pagos ✗')).toBeDefined()
    })
  })

  it('shows error badge on fetch failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

    render(<OrgHealthBadge orgSlug="gym_iron" />)
    await waitFor(() => {
      expect(screen.getByText('Pagos ✗')).toBeDefined()
    })
  })

  it('displays individual checks when expanded', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: () => Promise.resolve({
        status: 'unhealthy',
        checks: {
          manual_transfer: { status: 'pass', message: 'OK' },
          checkout: { status: 'fail', message: 'OAuth not connected' },
        },
      }),
    } as Response)

    render(<OrgHealthBadge orgSlug="gym_iron" />)
    await waitFor(() => {
      expect(screen.getByText('Pagos ✗')).toBeDefined()
    })
  })
})
