import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import { api } from '../lib/api'

type Provider = 'vertex' | 'gemini' | 'openai' | 'anthropic'

interface SettingsData {
  ai_provider: string
  vertex_project_id: string
  vertex_location: string
  vertex_credentials_path: string
  gemini_api_key: string
  openai_api_key: string
  anthropic_api_key: string
}

const PROVIDERS: { value: Provider; label: string; badge?: string }[] = [
  { value: 'vertex',    label: 'Vertex AI (Google)',   badge: 'Recommended' },
  { value: 'gemini',    label: 'Gemini API (Google)',  badge: 'Simpler setup' },
  { value: 'openai',    label: 'OpenAI',               badge: 'Coming soon' },
  { value: 'anthropic', label: 'Anthropic',            badge: 'Coming soon' },
]

export default function Settings() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [form, setForm] = useState<Partial<SettingsData>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  useEffect(() => {
    api.settings.get().then(data => {
      const s = data as SettingsData
      setSettings(s)
      setForm({ ai_provider: s.ai_provider, vertex_project_id: s.vertex_project_id,
                vertex_location: s.vertex_location, vertex_credentials_path: s.vertex_credentials_path })
    }).catch(console.error)
  }, [])

  function set(field: keyof SettingsData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
    setTestResult(null)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const updated = await api.settings.update(form) as SettingsData
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    // Save first, then test
    setSaving(true)
    try {
      await api.settings.update(form)
    } finally {
      setSaving(false)
    }
    setTesting(true)
    setTestResult(null)
    try {
      const result = await api.settings.test() as { ok: boolean; message: string }
      setTestResult(result)
    } catch {
      setTestResult({ ok: false, message: 'Request failed — is the backend running?' })
    } finally {
      setTesting(false)
    }
  }

  const provider = (form.ai_provider ?? settings?.ai_provider ?? 'vertex') as Provider

  if (!settings) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="page-header">Settings</h1>

      {/* Provider selection */}
      <div className="card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-stone-800">AI Provider</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Powers recipe parsing, receipt extraction, and image generation.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {PROVIDERS.map(p => {
            const isActive = provider === p.value
            const isDisabled = p.value === 'openai' || p.value === 'anthropic'
            return (
              <button
                key={p.value}
                onClick={() => !isDisabled && set('ai_provider', p.value)}
                disabled={isDisabled}
                className={`relative text-left px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all
                  ${isActive ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'}
                  ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {p.label}
                {p.badge && (
                  <span className={`block text-[10px] font-normal mt-0.5 ${isActive ? 'text-brand-500' : 'text-stone-400'}`}>
                    {p.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Vertex AI fields */}
        {provider === 'vertex' && (
          <div className="space-y-3 pt-1">
            <div className="bg-stone-50 rounded-xl p-3 text-xs text-stone-500 space-y-1">
              <p className="font-medium text-stone-600">Setup steps:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Create a GCP project and enable the Vertex AI API</li>
                <li>Create a service account with <code className="bg-white px-1 py-0.5 rounded">Vertex AI User</code> role</li>
                <li>Download the JSON key and mount it in your Docker container</li>
                <li>Set the path below to where it's mounted (e.g. <code className="bg-white px-1 py-0.5 rounded">/run/secrets/gcp.json</code>)</li>
              </ol>
            </div>
            <div>
              <label className="label block mb-1">GCP Project ID <span className="text-red-400">*</span></label>
              <input className="input" value={form.vertex_project_id ?? ''} onChange={e => set('vertex_project_id', e.target.value)} placeholder="my-gcp-project-123" />
            </div>
            <div>
              <label className="label block mb-1">Region</label>
              <select className="input" value={form.vertex_location ?? 'us-central1'} onChange={e => set('vertex_location', e.target.value)}>
                <option value="global">global</option>
                <option value="us-central1">us-central1 (Iowa)</option>
                <option value="us-east1">us-east1 (South Carolina)</option>
                <option value="europe-west1">europe-west1 (Belgium)</option>
                <option value="asia-southeast1">asia-southeast1 (Singapore)</option>
                <option value="australia-southeast1">australia-southeast1 (Sydney)</option>
              </select>
            </div>
            <div>
              <label className="label block mb-1">Service account key path</label>
              <input
                className="input"
                value={form.vertex_credentials_path ?? ''}
                onChange={e => set('vertex_credentials_path', e.target.value)}
                placeholder="/run/secrets/gcp.json"
              />
              <p className="text-xs text-stone-400 mt-1">
                Path inside the container where your JSON key is mounted. Leave blank to use Application Default Credentials.
              </p>
            </div>
          </div>
        )}

        {/* Gemini API key fields */}
        {provider === 'gemini' && (
          <div className="space-y-3 pt-1">
            <div className="bg-stone-50 rounded-xl p-3 text-xs text-stone-500">
              <p className="font-medium text-stone-600 mb-1">Setup:</p>
              <p>Get a free API key from <span className="text-brand-600">Google AI Studio</span>. Supports all Gemini models. Note: image generation requires Vertex AI.</p>
            </div>
            <div>
              <label className="label block mb-1">Gemini API Key <span className="text-red-400">*</span></label>
              <input
                className="input font-mono"
                type="password"
                placeholder={settings.gemini_api_key || 'AIza…'}
                onChange={e => set('gemini_api_key', e.target.value)}
              />
              {settings.gemini_api_key && (
                <p className="text-xs text-stone-400 mt-1">Key is saved. Enter a new value to replace it.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Test + Save */}
      <div className="flex items-center gap-3">
        <button onClick={handleTest} disabled={testing || saving} className="btn-secondary flex items-center gap-2">
          {testing ? <Loader className="w-4 h-4 animate-spin" /> : null}
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : null}
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`flex items-start gap-3 p-4 rounded-xl border ${
          testResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          {testResult.ok
            ? <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
            : <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          }
          <p className={`text-sm ${testResult.ok ? 'text-green-700' : 'text-red-700'}`}>
            {testResult.message}
          </p>
        </div>
      )}

      {/* Docker compose hint */}
      <div className="card p-4 space-y-2">
        <h3 className="text-xs font-semibold text-stone-700">docker-compose.yml — environment variables</h3>
        <pre className="text-xs text-stone-500 bg-stone-50 rounded-lg p-3 overflow-x-auto whitespace-pre">{`environment:
  AI_PROVIDER: ${provider}
${provider === 'vertex' ? `  VERTEX_PROJECT_ID: your-project-id
  VERTEX_LOCATION: us-central1
  GOOGLE_APPLICATION_CREDENTIALS: /run/secrets/gcp.json
volumes:
  - /host/path/to/gcp.json:/run/secrets/gcp.json:ro` :
provider === 'gemini' ? `  GEMINI_API_KEY: your-api-key` : ''}`}
        </pre>
        <p className="text-xs text-stone-400">
          Environment variables are used as defaults. Values saved above take priority.
        </p>
      </div>
    </div>
  )
}
