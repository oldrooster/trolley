import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Loader, Users, Plus, Pencil, Trash2, X } from 'lucide-react'
import { api } from '../lib/api'
import type { FamilyMember, AgeGroup } from '../lib/types'

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
          <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200">AI Provider</h2>
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
                  ${isActive ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-800 dark:text-brand-200' : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:border-stone-300 dark:hover:border-stone-600'}
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
            <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3 text-xs text-stone-500 dark:text-stone-400 space-y-1">
              <p className="font-medium text-stone-600 dark:text-stone-300">Setup steps:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Create a GCP project and enable the Vertex AI API</li>
                <li>Create a service account with <code className="bg-white dark:bg-stone-700 px-1 py-0.5 rounded">Vertex AI User</code> role</li>
                <li>Download the JSON key and mount it in your Docker container</li>
                <li>Set the path below to where it's mounted (e.g. <code className="bg-white dark:bg-stone-700 px-1 py-0.5 rounded">/run/secrets/gcp.json</code>)</li>
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
            <div className="bg-stone-50 dark:bg-stone-800 rounded-xl p-3 text-xs text-stone-500 dark:text-stone-400">
              <p className="font-medium text-stone-600 dark:text-stone-300 mb-1">Setup:</p>
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
        <h3 className="text-xs font-semibold text-stone-700 dark:text-stone-300">docker-compose.yml — environment variables</h3>
        <pre className="text-xs text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800 rounded-lg p-3 overflow-x-auto whitespace-pre">{`environment:
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

      <FamilySection />
    </div>
  )
}


// ── Family section ────────────────────────────────────────────────────────────

const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  kid: 'Kid',
  teen: 'Teen',
  adult: 'Adult',
}

const AGE_GROUP_COLORS: Record<AgeGroup, string> = {
  kid: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',
  teen: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-700',
  adult: 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-700',
}

const DEFAULT_EMOJIS: Record<AgeGroup, string> = { kid: '🧒', teen: '👦', adult: '🧑' }

function FamilySection() {
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [editing, setEditing] = useState<FamilyMember | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    api.family.list().then(d => setMembers(d as FamilyMember[])).catch(console.error)
  }, [])

  async function handleSave(data: { name: string; age_group: AgeGroup; emoji: string }) {
    if (editing) {
      const updated = await api.family.update(editing.id, data) as FamilyMember
      setMembers(prev => prev.map(m => m.id === editing.id ? updated : m))
    } else {
      const created = await api.family.create(data) as FamilyMember
      setMembers(prev => [...prev, created])
    }
    setShowForm(false)
    setEditing(null)
  }

  async function handleDelete(id: number) {
    await api.family.delete(id)
    setMembers(prev => prev.filter(m => m.id !== id))
  }

  function openEdit(m: FamilyMember) {
    setEditing(m)
    setShowForm(true)
  }

  function openAdd() {
    setEditing(null)
    setShowForm(true)
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-500" />
          <h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200">Family members</h2>
        </div>
        <button onClick={openAdd} className="btn-ghost flex items-center gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {members.length === 0 && !showForm && (
        <p className="text-xs text-stone-400 text-center py-3">
          No family members yet. Add them to assign meals and set recipe difficulty.
        </p>
      )}

      {members.length > 0 && (
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 py-2 group">
              <span className="text-xl w-8 text-center">{m.emoji || DEFAULT_EMOJIS[m.age_group as AgeGroup]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{m.name}</p>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${AGE_GROUP_COLORS[m.age_group as AgeGroup]}`}>
                {AGE_GROUP_LABELS[m.age_group as AgeGroup]}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors">
                  <Pencil className="w-3.5 h-3.5 text-stone-400" />
                </button>
                <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <MemberForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      )}
    </div>
  )
}


// ── Member add/edit form ──────────────────────────────────────────────────────

function MemberForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: FamilyMember | null
  onSave: (data: { name: string; age_group: AgeGroup; emoji: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(initial?.age_group as AgeGroup ?? 'adult')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), age_group: ageGroup, emoji: emoji.trim() || DEFAULT_EMOJIS[ageGroup] })
    } finally {
      setSaving(false)
    }
  }

  const EMOJI_SUGGESTIONS: Record<AgeGroup, string[]> = {
    kid:   ['🧒', '👧', '👦', '🧒‍♂️', '🧒‍♀️', '🐣'],
    teen:  ['👦', '👧', '🧑', '🧑‍🎤', '🧑‍💻', '🙋'],
    adult: ['🧑', '👨', '👩', '🧔', '👴', '👵'],
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-stone-100 dark:border-stone-800 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wide">
          {initial ? 'Edit member' : 'New member'}
        </p>
        <button type="button" onClick={onCancel} className="p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-700">
          <X className="w-3.5 h-3.5 text-stone-400" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label block mb-1">Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sophie" autoFocus />
        </div>
        <div>
          <label className="label block mb-1">Age group</label>
          <select className="input" value={ageGroup} onChange={e => setAgeGroup(e.target.value as AgeGroup)}>
            <option value="kid">Kid</option>
            <option value="teen">Teen</option>
            <option value="adult">Adult</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label block mb-1.5">Emoji</label>
        <div className="flex gap-2 flex-wrap">
          {EMOJI_SUGGESTIONS[ageGroup].map(e => (
            <button
              key={e}
              type="button"
              onClick={() => setEmoji(e)}
              className={`text-xl w-9 h-9 rounded-lg border transition-colors ${
                (emoji || DEFAULT_EMOJIS[ageGroup]) === e
                  ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20'
                  : 'border-stone-200 dark:border-stone-700 hover:border-brand-300'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 text-sm">Cancel</button>
        <button type="submit" disabled={saving || !name.trim()} className="btn-primary flex-1 text-sm">
          {saving ? 'Saving…' : (initial ? 'Save' : 'Add member')}
        </button>
      </div>
    </form>
  )
}
