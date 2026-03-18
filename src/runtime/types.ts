/**
 * Shared types for runtime providers.
 */

export interface RuntimeConfig {
  maxTurns: number
  timeoutSec: number
  workingDir?: string
  allowedTools?: string
  mode: string
  provider: string
  model?: string
  apiKey?: string
}

export interface DispatchResult {
  result: string
}

export interface RuntimeCallbacks {
  onStart: (assignmentId: string) => void | Promise<void>
  onComplete: (assignmentId: string, result: string) => void | Promise<void>
  onError: (assignmentId: string, error: string) => void | Promise<void>
  onOutput?: (assignmentId: string, chunk: string) => void | Promise<void>
}

export interface Assignment {
  id: string
  taskTitle: string
  taskBrief: string
}

export interface RuntimeProvider {
  name: string
  dispatch(
    agentId: string,
    agentName: string,
    agentRole: string,
    systemPrompt: string,
    assignment: Assignment,
    config: RuntimeConfig,
    callbacks: RuntimeCallbacks,
  ): boolean
  cancel(agentId: string): string | null
  isAvailable(): boolean
}
