import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { App } from '../App'
import { OfficeProvider } from '../office-provider'

const TEST_AGENTS = [
  {
    id: 'forge', name: 'Forge', role: 'Full-stack builder', team: 'Build',
    roomId: 'shipyard', presence: 'active', focus: 'Building things',
    criticalTask: true, collaborationMode: 'Collaborative'
  },
]

const TEST_SNAPSHOT = {
  agents: TEST_AGENTS,
  rooms: [
    { id: 'planning-studio', name: 'Planning Studio', team: 'Product + UX', purpose: 'Coordination', agents: [], zone: { x: 25, y: 3, w: 50, h: 27 } },
    { id: 'shipyard', name: 'Shipyard', team: 'Build', purpose: 'Engineering', agents: ['forge'], zone: { x: 2, y: 33, w: 58, h: 30 } },
    { id: 'systems-bay', name: 'Systems Bay', team: 'Platform', purpose: 'Architecture', agents: [], zone: { x: 62, y: 33, w: 36, h: 22 } },
    { id: 'commons', name: 'Commons', team: 'Shared Office', purpose: 'Shared space', agents: [], zone: { x: 2, y: 68, w: 58, h: 30 } },
    { id: 'signal-room', name: 'Signal Room', team: 'Ops', purpose: 'Operations', agents: [], zone: { x: 62, y: 60, w: 36, h: 38 } },
  ],
  agentSeats: { forge: { xPct: 35, yPct: 45 } },
  workdayPolicy: { timezone: 'Europe/Berlin', days: 'Monday-Friday', hours: '09:00-17:00', pauseRule: 'Pause rule', sharedPlaceRule: 'Shared rule' },
  activity: [],
  assignments: [],
  source: 'file',
  lastUpdatedAt: new Date().toISOString(),
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    if (typeof url === 'string' && url.includes('/api/office/snapshot')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(TEST_SNAPSHOT),
      })
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({}),
    })
  }))
})

async function renderAppAndSelectAgent() {
  let result: ReturnType<typeof render>
  await act(async () => {
    result = render(
      <OfficeProvider>
        <App />
      </OfficeProvider>
    )
  })
  // Wait for poll to complete and select Forge
  await act(async () => {
    await new Promise(r => setTimeout(r, 50))
  })
  // Click Forge in the left sidebar tree
  const forgeButtons = screen.getAllByText('Forge')
  const treeButton = forgeButtons.find(el => el.closest('.tree-agent-row'))
  if (treeButton) {
    const row = treeButton.closest('.tree-agent-row') as HTMLElement
    fireEvent.click(row)
  }
  return result!
}

describe('Agent CRUD - Create', () => {
  it('create form renders with all fields', async () => {
    await renderAppAndSelectAgent()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByText('+ Agent'))

    expect(screen.getByPlaceholderText('Agent ID (lowercase, hyphens)')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Role')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Team')).toBeInTheDocument()
    expect(screen.getByText('Create agent')).toBeInTheDocument()
  })

  it('create form has required fields', async () => {
    await renderAppAndSelectAgent()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByText('+ Agent'))

    const idInput = screen.getByPlaceholderText('Agent ID (lowercase, hyphens)')
    expect(idInput).toHaveAttribute('required')
    expect(idInput).toHaveAttribute('aria-required', 'true')

    const nameInput = screen.getByPlaceholderText('Name')
    expect(nameInput).toHaveAttribute('required')
  })

  it('agent ID input has pattern for lowercase+hyphens', async () => {
    await renderAppAndSelectAgent()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByText('+ Agent'))

    const idInput = screen.getByPlaceholderText('Agent ID (lowercase, hyphens)')
    expect(idInput).toHaveAttribute('pattern', '[a-z0-9-]+')
  })
})

describe('Agent CRUD - Edit', () => {
  it('edit form pre-fills agent data', async () => {
    await renderAppAndSelectAgent()
    fireEvent.click(screen.getByText('Edit'))

    expect(screen.getByText('Edit Forge')).toBeInTheDocument()
    expect(screen.getByText('Save changes')).toBeInTheDocument()

    const nameInput = screen.getByPlaceholderText('Name') as HTMLInputElement
    expect(nameInput.value).toBe('Forge')

    const roleInput = screen.getByPlaceholderText('Role') as HTMLInputElement
    expect(roleInput.value).toBe('Full-stack builder')
  })

  it('edit form does not show ID field', async () => {
    await renderAppAndSelectAgent()
    fireEvent.click(screen.getByText('Edit'))

    expect(screen.queryByPlaceholderText('Agent ID (lowercase, hyphens)')).not.toBeInTheDocument()
  })

  it('edit form close button returns to detail card', async () => {
    await renderAppAndSelectAgent()
    fireEvent.click(screen.getByText('Edit'))
    expect(screen.getByText('Save changes')).toBeInTheDocument()

    const closeButtons = screen.getAllByLabelText('Close')
    fireEvent.click(closeButtons[closeButtons.length - 1])

    expect(screen.getByText('Edit')).toBeInTheDocument()
  })
})

describe('Agent CRUD - Delete', () => {
  it('delete shows confirmation prompt', async () => {
    await renderAppAndSelectAgent()
    fireEvent.click(screen.getByText('Delete'))

    expect(screen.getByText('Delete?')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  it('No button cancels deletion', async () => {
    await renderAppAndSelectAgent()
    fireEvent.click(screen.getByText('Delete'))
    fireEvent.click(screen.getByText('No'))

    expect(screen.queryByText('Delete?')).not.toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })
})

describe('Agent ID validation', () => {
  const AGENT_ID_RE = /^[a-z0-9-]+$/

  it('accepts lowercase alphanumeric with hyphens', () => {
    expect(AGENT_ID_RE.test('my-agent')).toBe(true)
    expect(AGENT_ID_RE.test('agent1')).toBe(true)
    expect(AGENT_ID_RE.test('a-b-c-123')).toBe(true)
  })

  it('rejects uppercase', () => {
    expect(AGENT_ID_RE.test('MyAgent')).toBe(false)
  })

  it('rejects spaces', () => {
    expect(AGENT_ID_RE.test('my agent')).toBe(false)
  })

  it('rejects special characters', () => {
    expect(AGENT_ID_RE.test('agent@1')).toBe(false)
    expect(AGENT_ID_RE.test('agent_1')).toBe(false)
    expect(AGENT_ID_RE.test('agent.1')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(AGENT_ID_RE.test('')).toBe(false)
  })
})
