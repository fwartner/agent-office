import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { App } from '../App'
import { OfficeProvider } from '../office-provider'
import type { AssignmentRecord } from '../world'

const TEST_AGENTS = [
  {
    id: 'forge', name: 'Forge', role: 'Full-stack builder', team: 'Build',
    roomId: 'shipyard', presence: 'active', focus: 'Building things',
    criticalTask: true, collaborationMode: 'Collaborative'
  },
]

function makeSnapshot(overrides: { assignments?: Partial<AssignmentRecord>[] } = {}) {
  return {
    agents: TEST_AGENTS,
    rooms: [
      { id: 'shipyard', name: 'Shipyard', team: 'Build', purpose: 'Engineering', agents: ['forge'], zone: { x: 2, y: 33, w: 58, h: 30 } },
    ],
    agentSeats: { forge: { xPct: 35, yPct: 45 } },
    workdayPolicy: { timezone: 'Europe/Berlin', days: 'Monday-Friday', hours: '09:00-17:00', pauseRule: 'Pause rule', sharedPlaceRule: 'Shared rule' },
    activity: [],
    assignments: overrides.assignments ?? [],
    source: 'file',
    lastUpdatedAt: new Date().toISOString(),
  }
}

function mockFetch(snapshot: ReturnType<typeof makeSnapshot>) {
  vi.stubGlobal('fetch', vi.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(snapshot),
    })
  ))
}

function renderApp() {
  return render(
    <OfficeProvider>
      <App />
    </OfficeProvider>
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('AssignmentRecord result fields', () => {
  it('result fields are optional and work correctly', () => {
    const base: AssignmentRecord = {
      id: 'a-1', targetAgentId: 'forge', taskTitle: 'Test', taskBrief: '',
      priority: 'medium', status: 'active', routingTarget: 'agent_runtime',
      createdAt: new Date().toISOString(),
    }
    expect(base.result).toBeUndefined()
    expect(base.resultSavedAt).toBeUndefined()
    expect(base.resultAction).toBeUndefined()

    const withResult: AssignmentRecord = {
      ...base,
      status: 'done',
      result: 'Task completed successfully',
      resultAction: 'visible',
    }
    expect(withResult.result).toBe('Task completed successfully')
    expect(withResult.resultAction).toBe('visible')
  })

  it('resultAction can be saved or dismissed', () => {
    const assignment: AssignmentRecord = {
      id: 'a-2', targetAgentId: 'forge', taskTitle: 'Test', taskBrief: '',
      priority: 'high', status: 'done', routingTarget: 'agent_runtime',
      createdAt: new Date().toISOString(),
      result: 'Done',
      resultAction: 'saved',
      resultSavedAt: new Date().toISOString(),
    }
    expect(assignment.resultAction).toBe('saved')
    expect(assignment.resultSavedAt).toBeDefined()
  })
})

describe('Complete button visibility', () => {
  it('shows Complete button for active tasks in Tasks tab', async () => {
    const snapshot = makeSnapshot({
      assignments: [{
        id: 'assignment-1', targetAgentId: 'forge', taskTitle: 'Build feature',
        taskBrief: 'Build it', priority: 'medium', status: 'active',
        routingTarget: 'agent_runtime', createdAt: new Date().toISOString(),
      }],
    })
    mockFetch(snapshot)
    renderApp()

    // Switch to Tasks tab
    const tasksTab = await screen.findByRole('tab', { name: /^tasks/i })
    fireEvent.click(tasksTab)

    const completeBtn = await screen.findByText('Complete')
    expect(completeBtn).toBeDefined()
  })

  it('does NOT show Complete button for queued tasks', async () => {
    const snapshot = makeSnapshot({
      assignments: [{
        id: 'assignment-2', targetAgentId: 'forge', taskTitle: 'Queued task',
        taskBrief: '', priority: 'low', status: 'queued',
        routingTarget: 'agent_runtime', createdAt: new Date().toISOString(),
      }],
    })
    mockFetch(snapshot)
    renderApp()

    const tasksTab = await screen.findByRole('tab', { name: /^tasks/i })
    fireEvent.click(tasksTab)

    await screen.findByText('Queued task')
    const buttons = screen.queryAllByText('Complete')
    expect(buttons.length).toBe(0)
  })
})

describe('Task result display', () => {
  it('shows result text for done tasks', async () => {
    const snapshot = makeSnapshot({
      assignments: [{
        id: 'assignment-3', targetAgentId: 'forge', taskTitle: 'Completed task',
        taskBrief: '', priority: 'high', status: 'done',
        routingTarget: 'agent_runtime', createdAt: new Date().toISOString(),
        result: 'Here is the final output',
        resultAction: 'visible',
      }],
    })
    mockFetch(snapshot)
    renderApp()

    const tasksTab = await screen.findByRole('tab', { name: /^tasks/i })
    fireEvent.click(tasksTab)

    const resultText = await screen.findByText('Here is the final output')
    expect(resultText).toBeDefined()
  })

  it('shows auto-saved indicator for results (no Save/Dismiss buttons)', async () => {
    const snapshot = makeSnapshot({
      assignments: [{
        id: 'assignment-4', targetAgentId: 'forge', taskTitle: 'Task with result',
        taskBrief: '', priority: 'medium', status: 'done',
        routingTarget: 'agent_runtime', createdAt: new Date().toISOString(),
        result: 'Some result text',
        resultAction: 'visible',
      }],
    })
    mockFetch(snapshot)
    renderApp()

    const tasksTab = await screen.findByRole('tab', { name: /^tasks/i })
    fireEvent.click(tasksTab)

    await screen.findByText('Some result text')
    // Save/Dismiss buttons should not exist (results are auto-saved)
    const saveButtons = screen.queryAllByText('Save locally')
    const dismissButtons = screen.queryAllByText('Dismiss')
    expect(saveButtons.length).toBe(0)
    expect(dismissButtons.length).toBe(0)
  })

  it('always shows result even with dismissed status (auto-save overrides dismiss)', async () => {
    const snapshot = makeSnapshot({
      assignments: [{
        id: 'assignment-5', targetAgentId: 'forge', taskTitle: 'Dismissed task',
        taskBrief: '', priority: 'low', status: 'done',
        routingTarget: 'agent_runtime', createdAt: new Date().toISOString(),
        result: 'This result was dismissed',
        resultAction: 'dismissed',
      }],
    })
    mockFetch(snapshot)
    renderApp()

    const tasksTab = await screen.findByRole('tab', { name: /^tasks/i })
    fireEvent.click(tasksTab)

    await screen.findByText('Dismissed task')
    // Result should still show since we no longer hide dismissed results
    const resultTexts = screen.queryAllByText('This result was dismissed')
    expect(resultTexts.length).toBe(1)
  })
})

describe('Result badge', () => {
  it('shows badge count for pending results', async () => {
    const snapshot = makeSnapshot({
      assignments: [
        {
          id: 'a-1', targetAgentId: 'forge', taskTitle: 'Task 1',
          taskBrief: '', priority: 'medium', status: 'done',
          routingTarget: 'agent_runtime', createdAt: new Date().toISOString(),
          result: 'Result 1', resultAction: 'visible',
        },
        {
          id: 'a-2', targetAgentId: 'forge', taskTitle: 'Task 2',
          taskBrief: '', priority: 'high', status: 'done',
          routingTarget: 'agent_runtime', createdAt: new Date().toISOString(),
          result: 'Result 2', resultAction: 'visible',
        },
        {
          id: 'a-3', targetAgentId: 'forge', taskTitle: 'Task 3',
          taskBrief: '', priority: 'low', status: 'done',
          routingTarget: 'agent_runtime', createdAt: new Date().toISOString(),
          result: 'Result 3', resultAction: 'saved',
        },
      ],
    })
    mockFetch(snapshot)
    renderApp()

    // Badge should show 2 (two visible, one saved)
    const badge = await screen.findByText('2')
    expect(badge.className).toContain('result-badge')
  })
})
