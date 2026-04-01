import { useState } from 'react'

const DOCUMENTS = [
  {
    id: 'dnr',
    title: 'Do Not Resuscitate (DNR)',
    emoji: '🏥',
    description: 'A medical order that instructs healthcare providers not to perform CPR if the patient\'s heart stops or they stop breathing.',
    why: 'Without a DNR, medical staff are legally required to attempt resuscitation, even if it goes against your loved one\'s wishes.',
    howToGet: 'Talk to the primary doctor — they can issue one. It must be signed by a physician and kept accessible at home and at the hospital.',
    urgency: 'high',
  },
  {
    id: 'advance_directive',
    title: 'Advance Directive / Living Will',
    emoji: '📋',
    description: 'A legal document where your loved one states their wishes for medical treatment if they become unable to communicate.',
    why: 'It removes the burden of impossible decisions from your family during the most stressful moments.',
    howToGet: 'Download your state\'s form at CaringInfo.org (free). Have it signed, witnessed, and give copies to the doctor and hospital.',
    urgency: 'high',
  },
  {
    id: 'poa',
    title: 'Power of Attorney (POA)',
    emoji: '⚖️',
    description: 'A legal document giving someone authority to make financial and/or medical decisions on behalf of your loved one.',
    why: 'Without POA, family members may be unable to access bank accounts, pay bills, or make legal decisions — even in emergencies.',
    howToGet: 'A local attorney can prepare this for $150–$500. Some legal aid organizations offer it free for low-income families. It must be notarized.',
    urgency: 'high',
  },
  {
    id: 'will',
    title: 'Will & Testament',
    emoji: '📜',
    description: 'A legal document specifying how your loved one\'s assets and belongings should be distributed after death.',
    why: 'Without a will, the state decides who gets what — which can cause family conflict and delays of 1–2 years.',
    howToGet: 'An estate attorney can prepare a simple will for $300–$1,000. Online services like Trust & Will or LegalZoom offer lower-cost options.',
    urgency: 'medium',
  },
  {
    id: 'insurance',
    title: 'Insurance Policies',
    emoji: '🛡️',
    description: 'Documentation of all health, life, and supplemental insurance policies including policy numbers and contact information.',
    why: 'Families often lose thousands in unclaimed benefits simply because they cannot find policy information after a loved one passes.',
    howToGet: 'Gather all insurance cards, policy documents, and billing statements. Upload them to The Vault in CaringCircle.',
    urgency: 'medium',
  },
  {
    id: 'financial',
    title: 'Financial Account Information',
    emoji: '🏦',
    description: 'A secure record of bank accounts, investment accounts, retirement accounts, and any debts or loans.',
    why: 'An estimated $58 billion in unclaimed financial assets exist in the U.S. — mostly because families did not know accounts existed.',
    howToGet: 'Create a secure document listing all accounts, institutions, and approximate balances. Store in The Vault. Do NOT include passwords.',
    urgency: 'medium',
  },
  {
    id: 'beneficiaries',
    title: 'Beneficiary Designations',
    emoji: '👨‍👩‍👧',
    description: 'The named individuals who will receive assets from life insurance, retirement accounts, and other financial instruments.',
    why: 'Beneficiary designations override what is written in a will — outdated designations frequently cause assets to go to the wrong person.',
    howToGet: 'Contact each financial institution and insurance company to review and update beneficiary designations.',
    urgency: 'medium',
  },
  {
    id: 'funeral',
    title: 'Funeral & End-of-Life Wishes',
    emoji: '🕊️',
    description: 'Documentation of your loved one\'s preferences for burial vs. cremation, funeral arrangements, and any pre-paid plans.',
    why: 'Making these decisions in advance prevents families from spending thousands more than necessary under emotional duress.',
    howToGet: 'Have a direct conversation with your loved one and write their wishes down. Some families use a funeral home for pre-planning.',
    urgency: 'low',
  },
]

export default function DocumentPlanner({ patient }) {
  const [checklist, setChecklist] = useState(() => {
    try {
      const saved = localStorage.getItem(`doc_checklist_${patient?.id}`)
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [expandedDoc, setExpandedDoc] = useState(null)
  const [aiResponse, setAiResponse] = useState({})
  const [aiLoading, setAiLoading] = useState({})
  const [question, setQuestion] = useState({})
  const [activeFilter, setActiveFilter] = useState('all')

  const toggleItem = (id, status) => {
    const updated = { ...checklist, [id]: status }
    setChecklist(updated)
    try { localStorage.setItem(`doc_checklist_${patient?.id}`, JSON.stringify(updated)) } catch {}
  }

  const askAI = async (doc) => {
    const q = question[doc.id]
    if (!q?.trim()) return
    setAiLoading(prev => ({ ...prev, [doc.id]: true }))
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are a compassionate advisor helping a family caregiver navigate important legal and medical documents for their loved one named ${patient?.name}.
Be warm, clear, and practical. Avoid overwhelming legal jargon. Always remind them to consult an attorney or doctor for their specific situation.
Keep responses concise — 2-4 paragraphs maximum.`,
          messages: [{ role: 'user', content: `About the ${doc.title}: ${q}` }]
        })
      })
      const data = await response.json()
      setAiResponse(prev => ({ ...prev, [doc.id]: data.content?.[0]?.text || 'Unable to get a response.' }))
      setQuestion(prev => ({ ...prev, [doc.id]: '' }))
    } catch {
      setAiResponse(prev => ({ ...prev, [doc.id]: 'Unable to connect. Please try again.' }))
    } finally {
      setAiLoading(prev => ({ ...prev, [doc.id]: false }))
    }
  }

  const completedCount = Object.values(checklist).filter(v => v === 'done').length
  const totalCount = DOCUMENTS.length
  const progressPct = Math.round((completedCount / totalCount) * 100)

  const urgencyColor = { high: '#FC8181', medium: '#D4956A', low: '#68D391' }
  const urgencyLabel = { high: 'High Priority', medium: 'Medium Priority', low: 'Lower Priority' }

  const filtered = activeFilter === 'all' ? DOCUMENTS
    : activeFilter === 'done' ? DOCUMENTS.filter(d => checklist[d.id] === 'done')
    : activeFilter === 'missing' ? DOCUMENTS.filter(d => checklist[d.id] !== 'done')
    : DOCUMENTS.filter(d => d.urgency === activeFilter)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Document Planner</h1>
        <p className="page-subtitle">Make sure {patient?.name}'s family has everything in place</p>
      </div>

      {/* Progress card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 4 }}>Preparation Progress</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--slate-light)' }}>
              {completedCount} of {totalCount} documents confirmed
            </div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: progressPct === 100 ? 'var(--sage-dark)' : 'var(--navy)', fontFamily: 'var(--font-display)' }}>
            {progressPct}%
          </div>
        </div>
        <div style={{ height: 10, background: 'var(--cream)', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{
            height: '100%', borderRadius: 10,
            background: progressPct === 100 ? 'var(--sage)' : 'linear-gradient(90deg, var(--sage), var(--amber))',
            width: `${progressPct}%`, transition: 'width 0.5s ease'
          }} />
        </div>
        {progressPct === 100 && (
          <div style={{ marginTop: 12, color: 'var(--sage-dark)', fontWeight: 600, fontSize: '0.875rem' }}>
            Your family is fully prepared. Well done.
          </div>
        )}
        {completedCount === 0 && (
          <div style={{ marginTop: 12, color: 'var(--slate-light)', fontSize: '0.875rem' }}>
            Start by reviewing each document below and marking what you have in place.
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div style={{
        background: 'var(--amber-light)', border: '1px solid var(--amber)',
        borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 24,
        fontSize: '0.82rem', color: 'var(--slate)'
      }}>
        This planner is for organizational purposes only and does not constitute legal or medical advice. Always consult a licensed attorney or physician for your specific situation.
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { id: 'all', label: 'All Documents' },
          { id: 'missing', label: `Still Needed (${DOCUMENTS.filter(d => checklist[d.id] !== 'done').length})` },
          { id: 'high', label: 'High Priority' },
          { id: 'medium', label: 'Medium Priority' },
          { id: 'done', label: `Confirmed (${completedCount})` },
        ].map(f => (
          <button key={f.id} onClick={() => setActiveFilter(f.id)} style={{
            padding: '8px 16px', borderRadius: 20, border: '1.5px solid',
            borderColor: activeFilter === f.id ? 'var(--sage)' : 'var(--border)',
            background: activeFilter === f.id ? 'var(--sage-light)' : 'white',
            color: activeFilter === f.id ? 'var(--sage-dark)' : 'var(--slate)',
            fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)'
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Document cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(doc => {
          const status = checklist[doc.id]
          const isDone = status === 'done'
          const isExpanded = expandedDoc === doc.id

          return (
            <div key={doc.id} className="card" style={{
              padding: 0, overflow: 'hidden',
              opacity: isDone ? 0.85 : 1,
              border: isDone ? '1px solid var(--sage)' : '1px solid var(--border)'
            }}>
              <div style={{ height: 3, background: isDone ? 'var(--sage)' : urgencyColor[doc.urgency] }} />
              <div style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                      background: isDone ? 'var(--sage-light)' : 'var(--cream)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isDone ? '1.1rem' : '1.3rem',
                      border: '1px solid var(--border)', color: isDone ? 'var(--sage-dark)' : 'inherit'
                    }}>
                      {isDone ? '✓' : doc.emoji}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{doc.title}</div>
                        {!isDone && (
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                            background: urgencyColor[doc.urgency] + '22',
                            color: urgencyColor[doc.urgency],
                            border: `1px solid ${urgencyColor[doc.urgency]}44`
                          }}>
                            {urgencyLabel[doc.urgency]}
                          </span>
                        )}
                        {isDone && (
                          <span style={{
                            fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                            background: 'var(--sage-light)', color: 'var(--sage-dark)',
                            border: '1px solid var(--sage)'
                          }}>
                            Confirmed
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--slate)', lineHeight: 1.5 }}>{doc.description}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 16, flexShrink: 0 }}>
                    <button onClick={() => setExpandedDoc(isExpanded ? null : doc.id)} className="btn btn-secondary btn-sm">
                      {isExpanded ? 'Less' : 'Learn more'}
                    </button>
                    {!isDone ? (
                      <button className="btn btn-primary btn-sm" onClick={() => toggleItem(doc.id, 'done')}>
                        Mark Done
                      </button>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={() => toggleItem(doc.id, 'no')}>
                        Undo
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                      <div style={{ background: '#FFF5F5', borderRadius: 'var(--radius-sm)', padding: '14px 16px', border: '1px solid #FED7D7' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#C53030', marginBottom: 6 }}>Why This Matters</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--slate)', lineHeight: 1.6 }}>{doc.why}</div>
                      </div>
                      <div style={{ background: 'var(--sage-light)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', border: '1px solid var(--sage)' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--sage-dark)', marginBottom: 6 }}>How To Get It</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--slate)', lineHeight: 1.6 }}>{doc.howToGet}</div>
                      </div>
                    </div>

                    <div style={{ background: 'var(--cream)', borderRadius: 'var(--radius-sm)', padding: '16px', border: '1px solid var(--border)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy)', marginBottom: 10 }}>
                        Ask AI a question about this document
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <input
                          value={question[doc.id] || ''}
                          onChange={e => setQuestion(prev => ({ ...prev, [doc.id]: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && askAI(doc)}
                          placeholder={`e.g. "Does ${patient?.name} need this if they already have an advance directive?"`}
                          style={{
                            flex: 1, padding: '10px 14px', border: '1.5px solid var(--border)',
                            borderRadius: 8, fontFamily: 'var(--font-body)', fontSize: '0.875rem',
                            color: 'var(--navy)', background: 'white', outline: 'none'
                          }}
                          onFocus={e => e.target.style.borderColor = 'var(--sage)'}
                          onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => askAI(doc)}
                          disabled={aiLoading[doc.id] || !question[doc.id]?.trim()}
                        >
                          {aiLoading[doc.id] ? '...' : 'Ask'}
                        </button>
                      </div>
                      {aiLoading[doc.id] && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                          <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                          <span style={{ fontSize: '0.82rem', color: 'var(--slate-light)' }}>Getting answer...</span>
                        </div>
                      )}
                      {aiResponse[doc.id] && !aiLoading[doc.id] && (
                        <div style={{
                          marginTop: 14, padding: '14px 16px',
                          background: 'white', borderRadius: 8,
                          border: '1px solid var(--border)',
                          fontSize: '0.875rem', color: 'var(--slate)', lineHeight: 1.7,
                          whiteSpace: 'pre-wrap'
                        }}>
                          {aiResponse[doc.id]}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
