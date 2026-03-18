import { useState, useEffect, useCallback } from 'react'

interface IntegrationConfig {
  name: string
  config: Record<string, unknown>
  enabled: boolean
}

function useIntegration(name: string) {
  const [data, setData] = useState<IntegrationConfig | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/office/integrations/${name}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [name])

  const save = useCallback(async (updates: Partial<IntegrationConfig>) => {
    setSaving(true)
    try {
      await fetch(`/api/office/integrations/${name}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      setData(prev => prev ? { ...prev, ...updates } : prev)
    } finally {
      setSaving(false)
    }
  }, [name])

  const test = useCallback(async () => {
    const res = await fetch(`/api/office/integrations/${name}/test`, { method: 'POST' })
    return res.ok
  }, [name])

  return { data, saving, save, test }
}

export function SlackSettings() {
  const { data, saving, save, test } = useIntegration('slack')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [testResult, setTestResult] = useState<boolean | null>(null)

  useEffect(() => {
    if (data?.config) setWebhookUrl(String(data.config.webhookUrl || ''))
  }, [data])

  return (
    <div className="integration-settings">
      <h4>Slack</h4>
      <label>Webhook URL
        <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://hooks.slack.com/services/..." />
      </label>
      <div className="integration-actions">
        <button disabled={saving} onClick={() => save({ config: { webhookUrl }, enabled: !!webhookUrl })}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button disabled={!webhookUrl} onClick={async () => { setTestResult(await test()) }}>
          Test
        </button>
        {testResult !== null && <span>{testResult ? 'OK' : 'Failed'}</span>}
      </div>
    </div>
  )
}

export function GitHubSettings() {
  const { data, saving, save } = useIntegration('github')
  const [token, setToken] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [repo, setRepo] = useState('')

  useEffect(() => {
    if (data?.config) {
      setToken(String(data.config.token || ''))
      setWebhookSecret(String(data.config.webhookSecret || ''))
      setRepo(String(data.config.repo || ''))
    }
  }, [data])

  return (
    <div className="integration-settings">
      <h4>GitHub</h4>
      <label>Personal Access Token
        <input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder="ghp_..." />
      </label>
      <label>Webhook Secret
        <input type="password" value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} placeholder="Optional HMAC secret" />
      </label>
      <label>Repository
        <input type="text" value={repo} onChange={e => setRepo(e.target.value)} placeholder="owner/repo" />
      </label>
      <p className="integration-info">Inbound webhook URL: <code>/api/integrations/github</code></p>
      <button disabled={saving} onClick={() => save({ config: { token, webhookSecret, repo }, enabled: !!token })}>
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}

export function LinearSettings() {
  const { data, saving, save } = useIntegration('linear')
  const [apiKey, setApiKey] = useState('')
  const [webhookSecret, setWebhookSecret] = useState('')
  const [teamId, setTeamId] = useState('')

  useEffect(() => {
    if (data?.config) {
      setApiKey(String(data.config.apiKey || ''))
      setWebhookSecret(String(data.config.webhookSecret || ''))
      setTeamId(String(data.config.teamId || ''))
    }
  }, [data])

  return (
    <div className="integration-settings">
      <h4>Linear</h4>
      <label>API Key
        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="lin_api_..." />
      </label>
      <label>Webhook Secret
        <input type="password" value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} />
      </label>
      <label>Team ID
        <input type="text" value={teamId} onChange={e => setTeamId(e.target.value)} />
      </label>
      <p className="integration-info">Inbound webhook URL: <code>/api/integrations/linear</code></p>
      <button disabled={saving} onClick={() => save({ config: { apiKey, webhookSecret, teamId }, enabled: !!apiKey })}>
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}

export function TelegramSettings() {
  const { data, saving, save } = useIntegration('telegram')
  const [botToken, setBotToken] = useState('')
  const [allowedUsers, setAllowedUsers] = useState('')

  useEffect(() => {
    if (data?.config) {
      setBotToken(String(data.config.botToken || ''))
      setAllowedUsers(String(data.config.allowedUsers || ''))
    }
  }, [data])

  return (
    <div className="integration-settings">
      <h4>Telegram</h4>
      <label>Bot Token
        <input type="password" value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="123456:ABC-..." />
      </label>
      <label>Allowed Users (comma-separated IDs)
        <input type="text" value={allowedUsers} onChange={e => setAllowedUsers(e.target.value)} placeholder="12345,67890" />
      </label>
      <p className="integration-info">Status: {data?.enabled ? 'Active' : 'Inactive'}</p>
      <button disabled={saving} onClick={() => save({ config: { botToken, allowedUsers }, enabled: !!botToken })}>
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
