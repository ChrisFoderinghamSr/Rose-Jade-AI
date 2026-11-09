'use client'
import { useEffect, useRef, useState, type FormEvent } from 'react'
type Row = Record<string, any>
const tabs = [
  ['Conversation', '✧'],
  ['Memory', '◈'],
  ['Workbench', '▦'],
  ['Create', '↗'],
  ['Decision lab', '◇'],
  ['Privacy & profile', '◎'],
  ['Plans & connections', '⊞'],
]
const kinds = ['task', 'email', 'event', 'portfolio', 'livechat', 'form']
const title = (s: string) => s.slice(0, 1).toUpperCase() + s.slice(1)
function Field({
  label,
  name,
  type = 'text',
  value = '',
  required = true,
  options,
}: {
  label: string
  name: string
  type?: string
  value?: string
  required?: boolean
  options?: string[]
}) {
  return (
    <label>
      {label}
      {options ? (
        <select name={name} defaultValue={value} aria-label={label}>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          name={name}
          defaultValue={value}
          required={required}
          rows={4}
          maxLength={100000}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          maxLength={type === 'password' ? 128 : 5000}
        />
      )}
    </label>
  )
}
function Portrait({ small = false }: { small?: boolean }) {
  return (
    <img
      className={small ? 'avatar' : 'portrait'}
      src="/rose-jade.png"
      alt="Rose Jade, a fictional AI assistant character"
    />
  )
}
function Brand() {
  return (
    <a className="brand" href="/">
      <span className="brand-mark">
        rj<span>✧</span>
      </span>
      <span>
        rose jade<sup>™</sup>
        <small>YOUR PERSONAL AI COMPANION</small>
      </span>
    </a>
  )
}
export default function Studio() {
  const [data, setData] = useState<Row | null>(null),
    [pub, setPub] = useState<Row | null>(null),
    [loading, setLoading] = useState(true),
    [tab, setTab] = useState('Conversation'),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [provider, setProvider] = useState('demo'),
    [prompt, setPrompt] = useState(''),
    [thread, setThread] = useState(''),
    [kind, setKind] = useState('task'),
    [editing, setEditing] = useState<Row | null>(null),
    [signup, setSignup] = useState(false),
    [decision, setDecision] = useState(''),
    [listening, setListening] = useState(false),
    [speak, setSpeak] = useState(false),
    [publicReply, setPublicReply] = useState('')
  const recognition = useRef<any>(null),
    bottom = useRef<HTMLDivElement>(null)
  async function load() {
    const me = await (await fetch('/api/auth/me')).json()
    if (me.user) {
      const r = await fetch('/api/state', { cache: 'no-store' })
      const b = await r.json()
      if (!r.ok) throw Error(b.error)
      setData(b)
    } else setData(null)
    setPub(await (await fetch('/api/public')).json())
  }
  useEffect(() => {
    load()
      .catch((e) => setMessage(e.message))
      .finally(() => setLoading(false))
    return () => recognition.current?.abort()
  }, [])
  useEffect(() => {
    if (data?.messages.length)
      bottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [data?.messages.length])
  async function run(endpoint: string, payload?: unknown, method = 'POST') {
    setBusy(true)
    try {
      const r = await fetch('/api/' + endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: payload === undefined ? undefined : JSON.stringify(payload),
      })
      const b = await r.json()
      if (r.status === 401 && data) {
        setData(null)
        throw Error(b.error)
      }
      if (!r.ok) throw Error(b.error)
      if (endpoint.startsWith('auth/')) {
        await load()
        window.scrollTo(0, 0)
      } else if (data) await load()
      setMessage(b.message || 'Saved in your workspace.')
      return b
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'The request failed.')
      return null
    } finally {
      setBusy(false)
    }
  }
  async function form(
    e: FormEvent<HTMLFormElement>,
    endpoint: string,
    transform?: (v: Row) => Row,
    method = 'POST',
  ) {
    e.preventDefault()
    const el = e.currentTarget
    const v = Object.fromEntries(new FormData(el))
    const result = await run(endpoint, transform ? transform(v) : v, method)
    if (result) el.reset()
    return result
  }
  async function chat(e: FormEvent) {
    e.preventDefault()
    if (!prompt.trim()) return
    const b = await run('chat', { prompt, provider, threadId: thread || undefined })
    if (b) {
      setThread(b.threadId)
      setPrompt('')
      if (speak && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(b.content)
        window.speechSynthesis.speak(utterance)
      }
    }
  }
  function dictate() {
    if (listening) {
      recognition.current?.stop()
      setListening(false)
      return
    }
    if (!data?.profile.voiceConsent) {
      setMessage(
        'First enable voice-input consent in Privacy & profile. Your browser may send audio to its speech service.',
      )
      return
    }
    const Constructor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Constructor) {
      setMessage('Voice recognition is unavailable in this browser. Typed chat works everywhere.')
      return
    }
    const r = new Constructor()
    recognition.current = r
    r.lang = 'en-US'
    r.interimResults = false
    r.onresult = (e: any) => setPrompt((p) => (p ? p + ' ' : '') + e.results[0][0].transcript)
    r.onend = () => setListening(false)
    r.onerror = () => {
      setListening(false)
      setMessage('Voice input stopped. Check your browser microphone permission or use typed chat.')
    }
    r.start()
    setListening(true)
  }
  function changeTab(name: string) {
    setTab(name)
    setMessage('')
    setEditing(null)
  }
  if (loading)
    return (
      <main className="loading">
        <Brand />
        <p>Opening your workspace…</p>
      </main>
    )
  if (!data)
    return (
      <main className="landing">
        <header>
          <Brand />
          <div className="landing-nav">
            <a href="#plans">Membership</a>
            <a href="#access">
              Sign in <span>↗</span>
            </a>
          </div>
        </header>
        <section className="landing-hero">
          <div>
            <span className="eyebrow">PERSONAL BY DESIGN. THOUGHTFUL BY NATURE.</span>
            <h1>
              A little more clarity.
              <br />A little less on
              <br />
              your shoulders.
            </h1>
            <p>
              Meet Rose Jade. Your AI companion for the plans, projects and everyday details that
              make life yours.
            </p>
            <a className="button primary" href="#access">
              Find your flow <span>↗</span>
            </a>
            <div className="trust-note">◈ Your memory. Your choices. Your control.</div>
          </div>
          <div className="landing-portrait">
            <Portrait />
            <div className="portrait-caption">
              <span className="online-dot" /> Meet Rose Jade{' '}
              <small>AI assistant · fictional digital character</small>
            </div>
          </div>
        </section>
        <div className="feature-strip">
          <span>✧ Conversations that connect</span>
          <span>◈ Memory you approve</span>
          <span>↗ Ideas into useful files</span>
        </div>
        <section className="access-grid" id="access">
          <div>
            <span className="eyebrow">A SPACE THAT IS TRULY YOURS</span>
            <h2>{pub?.open ? 'Start with a conversation.' : 'Private access continues.'}</h2>
            <p>
              Sign in for your own conversations, reviewed memory, planning tools and files. Each
              account has a separate private workspace.
            </p>
            <div className="notice">
              {pub?.open
                ? 'Temporary public preview ends ' +
                  new Date(pub.until).toLocaleDateString() +
                  '. Public chat is a limited demonstration.'
                : 'Temporary public preview and registration are closed.'}
            </div>
            {pub?.open && (
              <form
                onSubmit={async (e) => {
                  const r = await form(e, 'public/demo')
                  if (r) setPublicReply(r.content)
                }}
              >
                <Field
                  label="Try the public preview"
                  name="prompt"
                  value="What can Rose Jade help me do?"
                />
                <button className="button outline" disabled={busy}>
                  Try limited demo
                </button>
                {publicReply && <p className="demo-answer">{publicReply}</p>}
              </form>
            )}
          </div>
          <div className="panel auth-card">
            <h2>{signup ? 'Make room for you.' : 'Welcome back.'}</h2>
            <p>
              {signup
                ? 'Create your private Rose Jade workspace.'
                : 'Sign in to your personal workspace.'}
            </p>
            <form onSubmit={(e) => form(e, signup ? 'auth/signup' : 'auth/login')}>
              <Field label="Email address" name="email" type="email" />
              <Field label="Password" name="password" type="password" />
              <small>
                {signup
                  ? 'Use at least 14 characters. Paid plans are optional and configured separately.'
                  : 'Local owner: run npm.cmd run accounts in the repository to view generated access.'}
              </small>
              <button className="button primary" disabled={busy}>
                {busy ? 'Opening…' : signup ? 'Create workspace' : 'Sign in'} <span>↗</span>
              </button>
            </form>
            {pub?.open && (
              <button className="text-button" onClick={() => setSignup(!signup)}>
                {signup ? 'Already have access? Sign in' : 'New here? Create an account'}
              </button>
            )}
            <div role="alert" className="feedback">
              {message}
            </div>
          </div>
        </section>
        <section className="plans-public" id="plans">
          <span className="eyebrow">A COMPANION AT YOUR PACE</span>
          <h2>Simple monthly options.</h2>
          <PlanCards
            plans={pub?.plans || []}
            ready={pub?.billingReady}
            onChoose={() => {
              document.getElementById('access')?.scrollIntoView()
              setSignup(true)
            }}
          />
          <p className="fine">
            {pub?.billingReady
              ? 'Checkout opens with the payment provider after sign-in.'
              : 'Billing preview · no subscriptions or payments are currently created.'}
          </p>
        </section>
        <Footer />
      </main>
    )
  const profile = data.profile
  const messages = data.messages.filter((m: Row) => m.thread_id === thread)
  const pending = data.memories.filter((m: Row) => m.status === 'Pending').length
  const records = data.records.filter((r: Row) => r.kind === kind)
  return (
    <div className="studio">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-label">YOUR PERSONAL SPACE</div>
        <nav aria-label="Workspace navigation">
          {tabs.map(([name, icon]) => (
            <button
              key={name}
              aria-current={tab === name ? 'page' : undefined}
              onClick={() => changeTab(name)}
            >
              <span>{icon}</span>
              {name}
              {name === 'Memory' && pending > 0 && <b className="counter">{pending}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>◈</span>
          <b>Built around you.</b>
          <p>
            Helpful by design.
            <br />
            Always in your control.
          </p>
        </div>
        <div className="account">
          <span>{(profile.name || data.user.email).slice(0, 1).toUpperCase()}</span>
          <div>
            <b>{profile.name || 'Your workspace'}</b>
            <small>
              {data.user.role === 'Owner' ? 'Owner access' : title(data.user.plan) + ' plan'}
            </small>
          </div>
        </div>
      </aside>
      <section className="main-area">
        <header className="topbar">
          <span>
            <span className="online-dot" /> Your private workspace
          </span>
          <div>
            <span className="provider-badge">
              {provider === 'demo'
                ? 'Local demo'
                : provider === 'ollama'
                  ? 'Local model'
                  : 'Cloud AI'}
            </span>
            <button onClick={() => run('auth/logout', {})}>Sign out ↗</button>
          </div>
        </header>
        <main className="workspace">
          <div className="page-heading">
            <div>
              <span className="eyebrow">ROSE JADE AI™</span>
              <h1>{tab === 'Conversation' ? 'A moment for you.' : tab}</h1>
              <p>
                {tab === 'Conversation'
                  ? 'What would make today feel a little lighter?'
                  : 'Your life, thoughtfully organized.'}
              </p>
            </div>
            {tab !== 'Privacy & profile' && (
              <label className="model-picker">
                AI provider
                <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                  <option value="demo">Local demo · no model</option>
                  <option value="ollama">
                    Local model · {data.providers.ollama.ready ? 'configured' : 'setup needed'}
                  </option>
                  <option value="openai">
                    Cloud AI · {data.providers.openai.ready ? 'configured' : 'setup needed'}
                  </option>
                </select>
              </label>
            )}
          </div>
          {message && (
            <div className="feedback" role="status" aria-live="polite">
              {message}
            </div>
          )}
          {tab === 'Conversation' && (
            <div className="conversation-grid">
              <div className="chat-card">
                <div className="companion-header">
                  <Portrait />
                  <div>
                    <span className="eyebrow">YOUR AI COMPANION</span>
                    <h2>Hi, I’m Rose Jade.</h2>
                    <p>
                      Here to help you think clearly,
                      <br />
                      create freely, and move forward.
                    </p>
                    <span className="soft-tag">✧ Fictional AI character · not a human</span>
                  </div>
                </div>
                <div className="chat-toolbar">
                  <b>{thread ? 'Our conversation' : 'A fresh conversation'}</b>
                  <button
                    className="text-button"
                    onClick={() => {
                      setThread('')
                      setPrompt('')
                    }}
                  >
                    ＋ New chat
                  </button>
                </div>
                <div className="chat-messages">
                  {!messages.length && (
                    <div className="chat-empty">
                      <span>✧</span>
                      <h3>Let’s start wherever you are.</h3>
                      <p>A plan to make, an idea to explore, or simply something on your mind.</p>
                      <div className="prompt-grid">
                        {[
                          'Help me organize my week',
                          'Remember that I prefer concise answers',
                          'Help me compare my options',
                          'Help me create a project report',
                        ].map((p) => (
                          <button key={p} onClick={() => setPrompt(p)}>
                            {p}
                            <span>↗</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((m: Row) => (
                    <article className={'bubble ' + m.role} key={m.id}>
                      {m.role === 'assistant' && <Portrait small />}
                      <div>
                        <small>
                          {m.role === 'assistant' ? 'Rose Jade · ' + m.provider : 'You'}
                        </small>
                        <p>{m.content}</p>
                      </div>
                    </article>
                  ))}
                  {busy && <p className="thinking">✧ Working on your request…</p>}
                  <div ref={bottom} />
                </div>
                <div className="composer-person">
                  <Portrait small />
                  <span>
                    Ready when you are.
                    <small>
                      {listening
                        ? 'Listening after your request…'
                        : 'Your words set the direction.'}
                    </small>
                  </span>
                  <label className="speak-toggle">
                    <input
                      type="checkbox"
                      checked={speak}
                      onChange={(e) => setSpeak(e.target.checked)}
                    />
                    Read replies aloud
                  </label>
                </div>
                <form className="composer" onSubmit={chat}>
                  <textarea
                    aria-label="Message Rose Jade"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Tell me what’s on your mind…"
                    maxLength={12000}
                    rows={2}
                  />
                  <div>
                    <button
                      type="button"
                      className={listening ? 'mic active' : 'mic'}
                      aria-label={listening ? 'Stop voice input' : 'Start voice input'}
                      onClick={dictate}
                    >
                      {listening ? '■' : '♩'}
                    </button>
                    <small>Review important details before acting.</small>
                    <button
                      className="send"
                      aria-label="Send message"
                      disabled={busy || !prompt.trim()}
                    >
                      ↑
                    </button>
                  </div>
                </form>
                <p className="chat-foot">
                  {provider === 'demo'
                    ? 'Demo replies use transparent templates. Configure a model for open-ended AI.'
                    : 'AI can make mistakes. Confirm facts and review drafts.'}
                </p>
              </div>
              <aside className="context-rail">
                <div className="panel">
                  <span className="eyebrow">A LITTLE CONTEXT</span>
                  <h3>Your space, at a glance.</h3>
                  <div className="rail-metric">
                    <span>Approved memories</span>
                    <b>{data.memories.filter((m: Row) => m.status === 'Approved').length}</b>
                  </div>
                  <div className="rail-metric">
                    <span>Open tasks</span>
                    <b>
                      {
                        data.records.filter((r: Row) => r.kind === 'task' && r.status !== 'Done')
                          .length
                      }
                    </b>
                  </div>
                  <div className="rail-metric">
                    <span>Created files</span>
                    <b>{data.artifacts.length}</b>
                  </div>
                  {pending > 0 && (
                    <button className="button outline" onClick={() => changeTab('Memory')}>
                      {pending} memories to review →
                    </button>
                  )}
                </div>
                <div className="panel threads">
                  <span className="eyebrow">PICK UP A THREAD</span>
                  {data.threads.slice(0, 8).map((t: Row) => (
                    <button
                      key={t.id}
                      className={thread === t.id ? 'selected' : ''}
                      onClick={() => setThread(t.id)}
                    >
                      <span>◌</span>
                      {t.title}
                    </button>
                  ))}
                  {!data.threads.length && <p>Your conversations will appear here.</p>}
                </div>
                <div className="gentle-note">
                  “Support that grows
                  <br />
                  with your understanding
                  <br />
                  of yourself.”
                  <small>
                    Memory is reviewed by you.
                    <br />
                    No silent personality profiling.
                  </small>
                </div>
              </aside>
            </div>
          )}
          {tab === 'Memory' && (
            <div className="two-col">
              <section className="panel">
                <span className="eyebrow">YOU CHOOSE WHAT STAYS</span>
                <h2>Little details. Better context.</h2>
                <p>
                  Say “remember that…” in chat or add a note here. Memories stay Pending until you
                  approve them. Nothing here retrains model weights.
                </p>
                <form onSubmit={(e) => form(e, 'memories')}>
                  <Field label="A detail worth remembering" name="content" type="textarea" />
                  <Field
                    label="Category"
                    name="category"
                    options={['Preference', 'Goal', 'Routine', 'Context']}
                  />
                  <button className="button primary" disabled={busy}>
                    Propose memory ＋
                  </button>
                </form>
              </section>
              <section className="panel">
                <h2>Your memory library</h2>
                {data.memories.map((m: Row) => (
                  <MemoryCard
                    key={m.id}
                    memory={m}
                    busy={busy}
                    save={(v: Row) => run('memories', v, 'PATCH')}
                    remove={() => run('memories', { id: m.id }, 'DELETE')}
                  />
                ))}
                {!data.memories.length && (
                  <p className="empty">Nothing saved yet. You decide what Rose Jade remembers.</p>
                )}
              </section>
            </div>
          )}
          {tab === 'Workbench' && (
            <>
              <div className="kind-tabs">
                {kinds.map((k) => (
                  <button
                    key={k}
                    aria-pressed={kind === k}
                    onClick={() => {
                      setKind(k)
                      setEditing(null)
                    }}
                  >
                    {k === 'livechat' ? 'Live-chat notes' : title(k) + 's'}
                  </button>
                ))}
              </div>
              <div className="two-col">
                <section className="panel">
                  <h2>
                    {editing ? 'Edit' : 'Add'} {kind === 'livechat' ? 'live-chat notes' : kind}
                  </h2>
                  <p>
                    {kind === 'email'
                      ? data.connections.email
                      : kind === 'event'
                        ? data.connections.calendar
                        : kind === 'livechat'
                          ? data.connections.livechat
                          : 'Private by default. Review before sharing.'}
                  </p>
                  <form
                    key={editing?.id || kind}
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const el = e.currentTarget,
                        v = Object.fromEntries(new FormData(el))
                      const fields: Row = { ...v }
                      if (kind === 'event') {
                        fields.start = new Date(String(v.start)).toISOString()
                        fields.end = new Date(String(v.end)).toISOString()
                      }
                      if (kind === 'portfolio') fields.published = v.published === 'yes'
                      const result = await run(
                        'records',
                        {
                          id: editing?.id,
                          revision: editing?.revision,
                          kind,
                          title: v.title,
                          fields,
                          status: v.status,
                        },
                        editing ? 'PATCH' : 'POST',
                      )
                      if (result) {
                        setEditing(null)
                        el.reset()
                      }
                    }}
                  >
                    <Field label="Title" name="title" value={editing?.title} />
                    {kind === 'task' && (
                      <>
                        <Field
                          label="Due date"
                          name="due"
                          type="date"
                          required={false}
                          value={editing?.fields.due}
                        />
                        <Field
                          label="Priority"
                          name="priority"
                          options={['Normal', 'High', 'Low']}
                          value={editing?.fields.priority}
                        />
                      </>
                    )}
                    {kind === 'email' && (
                      <>
                        <Field label="To" name="to" type="email" value={editing?.fields.to} />
                        <Field label="Subject" name="subject" value={editing?.fields.subject} />
                        <Field
                          label="Message"
                          name="body"
                          type="textarea"
                          value={editing?.fields.body}
                        />
                      </>
                    )}
                    {kind === 'event' && (
                      <>
                        <Field
                          label="Starts (your browser local time)"
                          name="start"
                          type="datetime-local"
                        />
                        <Field
                          label="Ends (your browser local time)"
                          name="end"
                          type="datetime-local"
                        />
                        <Field
                          label="Location"
                          name="location"
                          required={false}
                          value={editing?.fields.location}
                        />
                      </>
                    )}
                    {kind === 'portfolio' && (
                      <>
                        <Field
                          label="Project summary"
                          name="summary"
                          type="textarea"
                          value={editing?.fields.summary}
                        />
                        <Field
                          label="Project link (HTTPS)"
                          name="url"
                          type="url"
                          required={false}
                          value={editing?.fields.url}
                        />
                        <Field
                          label="Public portfolio widget"
                          name="published"
                          options={['no', 'yes']}
                          value={editing?.fields.published ? 'yes' : 'no'}
                        />
                        <p className="fine">
                          “yes” explicitly publishes this title, summary and link in the public
                          widget while public access is open.
                        </p>
                      </>
                    )}
                    {kind === 'livechat' && (
                      <>
                        <Field
                          label="Channel / source"
                          name="channel"
                          value={editing?.fields.channel}
                        />
                        <Field
                          label="Conversation notes / transcript"
                          name="transcript"
                          type="textarea"
                          value={editing?.fields.transcript}
                        />
                      </>
                    )}
                    {kind === 'form' && (
                      <Field
                        label="Questions (one per line, up to 10)"
                        name="questions"
                        type="textarea"
                        value={editing?.fields.questions?.join('\n')}
                      />
                    )}
                    <Field
                      label="Notes"
                      name="detail"
                      type="textarea"
                      required={false}
                      value={editing?.fields.detail}
                    />
                    <Field
                      label="Status"
                      name="status"
                      options={
                        kind === 'task'
                          ? ['Draft', 'To do', 'In progress', 'Done']
                          : ['Draft', 'Reviewed', 'Archived']
                      }
                      value={editing?.status}
                    />
                    <div className="actions">
                      <button className="button primary" disabled={busy}>
                        Save {kind}
                      </button>
                      {editing && (
                        <button
                          className="button outline"
                          type="button"
                          onClick={() => setEditing(null)}
                        >
                          Cancel edit
                        </button>
                      )}
                    </div>
                  </form>
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Your {kind === 'livechat' ? 'live-chat notes' : kind + 's'}</h2>
                    {kind === 'event' && (
                      <a className="text-link" href="/api/calendar/export">
                        Export ICS ↓
                      </a>
                    )}
                  </div>
                  {records.map((r: Row) => (
                    <article className="record-card" key={r.id}>
                      <span className="soft-tag">{r.status}</span>
                      <h3>{r.title}</h3>
                      {Object.entries(r.fields)
                        .filter(([key]) => !['published'].includes(key))
                        .map(([key, value]) => (
                          <p className="record-field" key={key}>
                            <b>{title(key)}:</b>{' '}
                            {Array.isArray(value) ? value.join(' · ') : String(value)}
                          </p>
                        ))}
                      <div className="actions">
                        <button className="text-button" onClick={() => setEditing(r)}>
                          Edit
                        </button>
                        <button
                          className="text-button danger"
                          onClick={() => run('records', { id: r.id }, 'DELETE')}
                        >
                          Delete
                        </button>
                        {kind === 'email' && (
                          <a className="text-link" href={'/api/email/' + r.id + '/export'}>
                            Download .eml ↓
                          </a>
                        )}
                      </div>
                      {kind === 'email' && r.status === 'Reviewed' && (
                        <details className="send-review">
                          <summary>Review external send</summary>
                          <p>
                            To: {r.fields.to}
                            <br />
                            Subject: {r.fields.subject}
                          </p>
                          <p className="preserve">{r.fields.body}</p>
                          <button
                            className="button outline"
                            disabled={busy}
                            onClick={() =>
                              run('email/send', { id: r.id, revision: r.revision, confirm: true })
                            }
                          >
                            Confirm sending this exact draft
                          </button>
                          <p className="fine">
                            Requires owner access, SMTP configuration and an allowlisted recipient.
                            No send occurs in capture mode.
                          </p>
                        </details>
                      )}
                      {kind === 'form' && (
                        <details>
                          <summary>Fill this private form</summary>
                          <form
                            onSubmit={(e) =>
                              form(e, 'forms/submit', (v) => ({
                                id: r.id,
                                answers: r.fields.questions.map(
                                  (_: string, i: number) => v['answer' + i],
                                ),
                              }))
                            }
                          >
                            {r.fields.questions.map((q: string, i: number) => (
                              <Field key={i} label={q} name={'answer' + i} />
                            ))}
                            <button className="button outline" disabled={busy}>
                              Save response
                            </button>
                          </form>
                          <p className="fine">
                            {data.submissions.filter((s: Row) => s.form_id === r.id).length} private
                            responses stored. Export all workspace data in Privacy & profile to
                            retrieve them.
                          </p>
                        </details>
                      )}
                    </article>
                  ))}
                  {!records.length && <p className="empty">A clear space for your next {kind}.</p>}
                </section>
              </div>
            </>
          )}
          {tab === 'Create' && (
            <div className="two-col">
              <section className="panel">
                <span className="eyebrow">FROM IDEA TO SOMETHING USEFUL</span>
                <h2>Make room for your ideas.</h2>
                <p>
                  Create editable documents, reports, data files and code. Generated code downloads
                  as text and is never executed automatically.
                </p>
                <form onSubmit={(e) => form(e, 'artifacts', (v) => ({ ...v, provider }))}>
                  <Field label="File title" name="title" />
                  <Field
                    label="Format"
                    name="format"
                    options={['md', 'txt', 'docx', 'pdf', 'csv', 'json', 'html', 'py', 'js', 'ts']}
                  />
                  <Field
                    label="Instructions for Rose Jade"
                    name="prompt"
                    type="textarea"
                    required={false}
                  />
                  <Field
                    label="Or paste exact content to save"
                    name="content"
                    type="textarea"
                    required={false}
                  />
                  <button className="button primary" disabled={busy}>
                    Create file ↗
                  </button>
                </form>
                <p className="fine">
                  Local demo creates a clearly labeled planning template. Configured models support
                  open-ended drafting. PDF uses a basic Latin-1 font; DOCX/text retain Unicode.
                </p>
              </section>
              <section className="panel">
                <h2>Your creations</h2>
                {data.artifacts.map((a: Row) => (
                  <article className="record-card" key={a.id}>
                    <span className="soft-tag">
                      {a.format.toUpperCase()} · {a.provider}
                    </span>
                    <h3>{a.title}</h3>
                    <div className="actions">
                      <a className="text-link" href={'/api/artifacts/' + a.id}>
                        Download ↓
                      </a>
                      <a className="text-link" href={'/api/artifacts/' + a.id + '?format=docx'}>
                        Word
                      </a>
                      <a className="text-link" href={'/api/artifacts/' + a.id + '?format=pdf'}>
                        PDF
                      </a>
                      <a className="text-link" href={'/api/artifacts/' + a.id + '?format=txt'}>
                        Text
                      </a>
                    </div>
                  </article>
                ))}
                {!data.artifacts.length && (
                  <p className="empty">Your first useful file starts here.</p>
                )}
              </section>
            </div>
          )}
          {tab === 'Decision lab' && (
            <div className="two-col">
              <section className="panel">
                <span className="eyebrow">POSSIBILITIES, WITH PERSPECTIVE</span>
                <h2>Find a thoughtful next step.</h2>
                <p>
                  Compare outcomes, constraints, privacy and rights. Rose Jade does not guarantee
                  outcomes or establish current law without verified research.
                </p>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const v = Object.fromEntries(new FormData(e.currentTarget))
                    const b = await run('decisions', { ...v, provider })
                    if (b) setDecision(b.content)
                  }}
                >
                  <Field label="What are you deciding?" name="question" type="textarea" />
                  <Field label="Options to compare" name="options" type="textarea" />
                  <Field
                    label="Constraints, priorities and jurisdiction"
                    name="constraints"
                    type="textarea"
                  />
                  <button className="button primary" disabled={busy}>
                    Explore my options ◇
                  </button>
                </form>
              </section>
              <section className="panel">
                <h2>A clearer view</h2>
                {decision ? (
                  <p className="preserve">{decision}</p>
                ) : (
                  <p className="empty">
                    Your comparison will appear here. Verify important facts and legal questions
                    with qualified sources.
                  </p>
                )}
              </section>
            </div>
          )}
          {tab === 'Privacy & profile' && (
            <div className="two-col">
              <section className="panel">
                <span className="eyebrow">YOUR LIFE. YOUR SETTINGS.</span>
                <h2>How should I support you?</h2>
                <form
                  onSubmit={(e) =>
                    form(
                      e,
                      'profile',
                      (v) => ({
                        ...v,
                        memoryEnabled: v.memoryEnabled === 'on',
                        cloudConsent: v.cloudConsent === 'on',
                        voiceConsent: v.voiceConsent === 'on',
                        retentionDays: Number(v.retentionDays),
                      }),
                      'PATCH',
                    )
                  }
                >
                  <Field label="Preferred name" name="name" required={false} value={profile.name} />
                  <Field label="Timezone (IANA)" name="timezone" value={profile.timezone} />
                  <Field
                    label="Goals and priorities"
                    name="goals"
                    type="textarea"
                    required={false}
                    value={profile.goals}
                  />
                  <Field
                    label="Conversation style"
                    name="tone"
                    options={[
                      'Warm and practical',
                      'Concise and direct',
                      'Detailed and thoughtful',
                    ]}
                    value={profile.tone}
                  />
                  <Field
                    label="Conversation retention (days)"
                    name="retentionDays"
                    options={['7', '30', '90']}
                    value={String(profile.retentionDays)}
                  />
                  <label className="check-label">
                    <input
                      name="memoryEnabled"
                      type="checkbox"
                      defaultChecked={profile.memoryEnabled}
                    />
                    <span>
                      Use approved memory and propose new notes from explicit remember cues.
                    </span>
                  </label>
                  <label className="check-label">
                    <input
                      name="cloudConsent"
                      type="checkbox"
                      defaultChecked={profile.cloudConsent}
                    />
                    <span>
                      I allow my prompt, recent conversation, profile name/goals/style and memories
                      individually marked for cloud use to be sent to the configured cloud AI
                      provider.
                    </span>
                  </label>
                  <label className="check-label">
                    <input
                      name="voiceConsent"
                      type="checkbox"
                      defaultChecked={profile.voiceConsent}
                    />
                    <span>
                      I understand voice input uses my browser’s speech service, which may send
                      audio to its provider. Listening starts only when I click the microphone.
                    </span>
                  </label>
                  <button className="button primary" disabled={busy}>
                    Save my preferences
                  </button>
                </form>
              </section>
              <section className="panel">
                <h2>Privacy, in your hands.</h2>
                <p>
                  Private account data is isolated on the server. Export your workspace, clear
                  conversations, or erase saved workspace data. Login and subscription records
                  remain after workspace erasure.
                </p>
                <a className="button outline" href="/api/privacy/export">
                  Export my private data ↓
                </a>
                <form className="danger-zone" onSubmit={(e) => form(e, 'privacy/clear')}>
                  <Field label="Type DELETE HISTORY to clear conversations" name="confirm" />
                  <button className="button outline" disabled={busy}>
                    Clear conversation history
                  </button>
                </form>
                <form className="danger-zone" onSubmit={(e) => form(e, 'privacy/erase')}>
                  <Field
                    label="Type ERASE WORKSPACE to erase saved workspace data"
                    name="confirm"
                  />
                  <button className="button outline" disabled={busy}>
                    Erase workspace data
                  </button>
                </form>
                <details>
                  <summary>Change password</summary>
                  <form onSubmit={(e) => form(e, 'auth/password')}>
                    <Field label="Current password" name="current" type="password" />
                    <Field label="New password (14+ characters)" name="password" type="password" />
                    <button className="button outline" disabled={busy}>
                      Change and sign out
                    </button>
                  </form>
                </details>
              </section>
            </div>
          )}
          {tab === 'Plans & connections' && (
            <>
              <div className="notice">
                {data.billingReady
                  ? 'PayPal handles subscription approval. Returning from PayPal never activates a plan by itself; verified subscription events do.'
                  : 'Subscription preview: no card is collected, no charge is made and no paid entitlement is granted.'}
              </div>
              <PlanCards
                plans={data.plans}
                ready={data.billingReady}
                onChoose={async (plan: string) => {
                  const r = await run('billing/checkout', { plan })
                  if (r?.url) window.location.assign(r.url)
                }}
              />
              {data.user.plan !== 'free' && (
                <details className="notice">
                  <summary>Manage PayPal subscription</summary>
                  <p>
                    Cancellation ends paid app access immediately. Your private workspace remains on
                    free access.
                  </p>
                  <button
                    className="button outline"
                    disabled={busy}
                    onClick={() => run('billing/cancel', { confirm: true })}
                  >
                    Confirm cancellation with PayPal
                  </button>
                </details>
              )}
              <div className="two-col spaced">
                <section className="panel">
                  <h2>Local & cloud AI</h2>
                  <p>
                    Local model: {data.providers.ollama.label}
                    <br />
                    Cloud model: {data.providers.openai.label}
                  </p>
                  <p>
                    Set provider configuration on the server. API keys are never entered into this
                    browser or sent with exported workspace data. No model weights are bundled.
                  </p>
                  <h3>Connected workflows</h3>
                  <p>
                    Email: {data.connections.email}
                    <br />
                    Calendar: {data.connections.calendar}
                    <br />
                    Live chat: {data.connections.livechat}
                  </p>
                </section>
                <section className="panel">
                  <h2>Your portfolio, with Rose Jade.</h2>
                  <p>
                    Publish selected portfolio entries in Workbench, then use the read-only widget.
                    It exposes no private chat or memory. External frames must be explicitly
                    allowlisted on the server.
                  </p>
                  <pre className="code">
                    {
                      '<iframe src="https://RoseJade.chrisfoderingham.com/embed" title="Rose Jade portfolio" loading="lazy" width="100%" height="560"></iframe>'
                    }
                  </pre>
                  <a className="text-link" href="/embed" target="_blank" rel="noreferrer">
                    Preview public portfolio widget ↗
                  </a>
                  <p className="fine">
                    The hostname is a deployment target. DNS, hosting, HTTPS and provider
                    configuration are separate from committing code.
                  </p>
                </section>
              </div>
            </>
          )}
          <Footer />
        </main>
      </section>
    </div>
  )
}
function MemoryCard({
  memory,
  busy,
  save,
  remove,
}: {
  memory: Row
  busy: boolean
  save: (v: Row) => unknown
  remove: () => unknown
}) {
  const [edit, setEdit] = useState(false)
  return (
    <article className="memory-card">
      <span className="soft-tag">
        {memory.status} · {memory.category}
      </span>
      <p>{memory.content}</p>
      <small>Source: {memory.source}</small>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const v = Object.fromEntries(new FormData(e.currentTarget))
          save({
            id: memory.id,
            content: v.content || memory.content,
            status: v.status,
            cloud: v.cloud === 'on',
          })
          setEdit(false)
        }}
      >
        {edit && (
          <Field label="Edit memory" name="content" type="textarea" value={memory.content} />
        )}
        <Field
          label="Memory status"
          name="status"
          options={['Pending', 'Approved', 'Rejected']}
          value={memory.status}
        />
        <label className="check-label">
          <input type="checkbox" name="cloud" defaultChecked={!!memory.cloud} />
          <span>Allow this memory in cloud AI context</span>
        </label>
        <div className="actions">
          <button className="button outline" disabled={busy}>
            Save review
          </button>
          <button type="button" className="text-button" onClick={() => setEdit(!edit)}>
            Edit
          </button>
          <button type="button" className="text-button danger" onClick={() => remove()}>
            Forget
          </button>
        </div>
      </form>
    </article>
  )
}
function PlanCards({
  plans,
  ready,
  onChoose,
}: {
  plans: Row[]
  ready: boolean
  onChoose: (id: string) => unknown
}) {
  return (
    <div className="plan-grid">
      {plans.map((p, i) => (
        <article className={'plan-card ' + (i === 1 ? 'featured' : '')} key={p.id}>
          {i === 1 && <span className="plan-recommend">ROOM FOR THE EVERYDAY</span>}
          <span className="eyebrow">{p.name}</span>
          <h3>
            {'$'}
            {p.price}
            <small>/ month</small>
          </h3>
          <p>Private chat, reviewed memory, planning tools and file creation.</p>
          <ul>
            <li>Local-model access</li>
            <li>{p.allowance} cloud AI requests / calendar month</li>
            <li>Document & portfolio workspace</li>
          </ul>
          <button
            className={'button ' + (i === 1 ? 'primary' : 'outline')}
            onClick={() => onChoose(p.id)}
          >
            {ready ? 'Continue with PayPal' : 'Preview ' + p.name} ↗
          </button>
          <small className="fine">
            Cloud requests require a configured provider and data consent. Billing allowance uses a
            calendar-month key.
          </small>
        </article>
      ))}
    </div>
  )
}
function Footer() {
  return (
    <footer className="footer">
      <span>
        © {new Date().getFullYear()} Christian Foderingham. Rose Jade AI™. All rights reserved.
      </span>
      <span>AI support, with human agency.</span>
    </footer>
  )
}
