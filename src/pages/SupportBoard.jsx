import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const TABS = [
  { id: 'needs',   label: 'Needs Board',      emoji: '🙋' },
  { id: 'meals',   label: 'Meal Train',        emoji: '🍲' },
  { id: 'visits',  label: 'Visit Scheduler',   emoji: '🏠' },
  { id: 'prayer',  label: 'Prayer Wall',       emoji: '🙏' },
]

export default function SupportBoard({ patient, userRole }) {
  const { user, profile } = useAuth()
  const [activeTab, setActiveTab] = useState('needs')
  const isAdmin = userRole === 'admin'

  // Needs Board
  const [needs, setNeeds] = useState([])
  const [showNeedModal, setShowNeedModal] = useState(false)
  const [needForm, setNeedForm] = useState({ title: '', description: '', due_date: '' })
  const [needLoading, setNeedLoading] = useState(false)

  // Meal Train
  const [meals, setMeals] = useState([])
  const [showMealModal, setShowMealModal] = useState(false)
  const [mealForm, setMealForm] = useState({ date: '', meal_description: '', claimed_by_name: '' })
  const [mealLoading, setMealLoading] = useState(false)

  // Visits
  const [visits, setVisits] = useState([])
  const [showVisitModal, setShowVisitModal] = useState(false)
  const [visitForm, setVisitForm] = useState({ requested_by_name: '', preferred_date: '', preferred_time: '', message: '' })
  const [visitLoading, setVisitLoading] = useState(false)

  // Prayer Wall
  const [prayers, setPrayers] = useState([])
  const [showPrayerModal, setShowPrayerModal] = useState(false)
  const [prayerForm, setPrayerForm] = useState({ author_name: '', message: '' })
  const [prayerLoading, setPrayerLoading] = useState(false)

  useEffect(() => {
    if (patient?.id) {
      fetchNeeds()
      fetchMeals()
      fetchVisits()
      fetchPrayers()
    }
  }, [patient])

  // ── NEEDS ──
  const fetchNeeds = async () => {
    const { data } = await supabase.from('support_needs').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false })
    setNeeds(data || [])
  }

  const saveNeed = async () => {
    if (!needForm.title) return
    setNeedLoading(true)
    try {
      await supabase.from('support_needs').insert({ ...needForm, patient_id: patient.id, created_by: user.id, status: 'open' })
      setNeedForm({ title: '', description: '', due_date: '' })
      await fetchNeeds()
      setShowNeedModal(false)
    } finally { setNeedLoading(false) }
  }

  const claimNeed = async (need) => {
    const name = prompt('Your name:')
    if (!name) return
    await supabase.from('support_needs').update({ status: 'claimed', claimed_by_name: name, claimed_at: new Date().toISOString() }).eq('id', need.id)
    await fetchNeeds()
  }

  const deleteNeed = async (id) => {
    await supabase.from('support_needs').delete().eq('id', id)
    await fetchNeeds()
  }

  // ── MEALS ──
  const fetchMeals = async () => {
    const { data } = await supabase.from('meal_train').select('*').eq('patient_id', patient.id).order('date', { ascending: true })
    setMeals(data || [])
  }

  const saveMealSlot = async () => {
    if (!mealForm.date) return
    setMealLoading(true)
    try {
      await supabase.from('meal_train').insert({ ...mealForm, patient_id: patient.id, created_by: user.id, status: mealForm.claimed_by_name ? 'claimed' : 'open' })
      setMealForm({ date: '', meal_description: '', claimed_by_name: '' })
      await fetchMeals()
      setShowMealModal(false)
    } finally { setMealLoading(false) }
  }

  const claimMeal = async (meal) => {
    const name = prompt('Your name:')
    if (!name) return
    const desc = prompt('What will you bring? (optional):') || ''
    await supabase.from('meal_train').update({ status: 'claimed', claimed_by_name: name, meal_description: desc || meal.meal_description }).eq('id', meal.id)
    await fetchMeals()
  }

  const deleteMeal = async (id) => {
    await supabase.from('meal_train').delete().eq('id', id)
    await fetchMeals()
  }

  // ── VISITS ──
  const fetchVisits = async () => {
    const { data } = await supabase.from('visit_requests').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false })
    setVisits(data || [])
  }

  const saveVisit = async () => {
    if (!visitForm.requested_by_name || !visitForm.preferred_date) return
    setVisitLoading(true)
    try {
      await supabase.from('visit_requests').insert({ ...visitForm, patient_id: patient.id, status: 'pending' })
      setVisitForm({ requested_by_name: '', preferred_date: '', preferred_time: '', message: '' })
      await fetchVisits()
      setShowVisitModal(false)
    } finally { setVisitLoading(false) }
  }

  const approveVisit = async (id, approve) => {
    await supabase.from('visit_requests').update({ status: approve ? 'approved' : 'declined' }).eq('id', id)
    await fetchVisits()
  }

  const deleteVisit = async (id) => {
    await supabase.from('visit_requests').delete().eq('id', id)
    await fetchVisits()
  }

  // ── PRAYERS ──
  const fetchPrayers = async () => {
    const { data } = await supabase.from('prayer_wall').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false })
    setPrayers(data || [])
  }

  const savePrayer = async () => {
    if (!prayerForm.message) return
    setPrayerLoading(true)
    try {
      await supabase.from('prayer_wall').insert({
        ...prayerForm,
        patient_id: patient.id,
        author_name: prayerForm.author_name || profile?.full_name || 'Anonymous'
      })
      setPrayerForm({ author_name: '', message: '' })
      await fetchPrayers()
      setShowPrayerModal(false)
    } finally { setPrayerLoading(false) }
  }

  const deletePrayer = async (id) => {
    await supabase.from('prayer_wall').delete().eq('id', id)
    await fetchPrayers()
  }

  const formatDate = (d) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const formatTimeAgo = (d) => {
    const diff = new Date() - new Date(d)
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
    return Math.floor(diff / 86400000) + 'd ago'
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Support Board</h1>
        <p className="page-subtitle">How {patient?.name}'s community can help</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '10px 18px', borderRadius: 20, border: '1.5px solid',
            borderColor: activeTab === tab.id ? 'var(--sage)' : 'var(--border)',
            background: activeTab === tab.id ? 'var(--sage-light)' : 'white',
            color: activeTab === tab.id ? 'var(--sage-dark)' : 'var(--slate)',
            fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font-body)',
            display: 'flex', alignItems: 'center', gap: 6
          }}>
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* ── NEEDS BOARD ── */}
      {activeTab === 'needs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--slate-light)' }}>
              {isAdmin ? 'Post specific requests for help. Community members can claim them.' : 'See what help is needed and claim a task.'}
            </div>
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => setShowNeedModal(true)}>+ Post a Need</button>}
          </div>

          {needs.length === 0 ? (
            <div className="card"><div className="empty-state">
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>🙋</p>
              <h3>No needs posted yet</h3>
              <p style={{ marginBottom: 16 }}>{isAdmin ? 'Post specific requests so your community knows exactly how to help.' : 'Check back soon — the admin will post ways you can help.'}</p>
              {isAdmin && <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowNeedModal(true)}>Post First Need</button>}
            </div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {needs.map(need => (
                <div key={need.id} className="card" style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem' }}>{need.title}</div>
                        <span style={{
                          padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                          background: need.status === 'claimed' ? 'var(--sage-light)' : 'var(--amber-light)',
                          color: need.status === 'claimed' ? 'var(--sage-dark)' : 'var(--amber)'
                        }}>
                          {need.status === 'claimed' ? '✓ Claimed' : 'Open'}
                        </span>
                      </div>
                      {need.description && <div style={{ fontSize: '0.875rem', color: 'var(--slate)', marginBottom: 6 }}>{need.description}</div>}
                      <div style={{ fontSize: '0.78rem', color: 'var(--slate-light)', display: 'flex', gap: 12 }}>
                        {need.due_date && <span>📅 Needed by {formatDate(need.due_date)}</span>}
                        {need.claimed_by_name && <span>✋ Claimed by {need.claimed_by_name}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 16, flexShrink: 0 }}>
                      {need.status === 'open' && !isAdmin && (
                        <button className="btn btn-primary btn-sm" onClick={() => claimNeed(need)}>I'll help!</button>
                      )}
                      {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => deleteNeed(need.id)}>×</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MEAL TRAIN ── */}
      {activeTab === 'meals' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--slate-light)' }}>
              {isAdmin ? 'Add meal dates. Community can sign up to bring food.' : 'Sign up to bring a meal on an open date.'}
            </div>
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={() => setShowMealModal(true)}>+ Add Meal Date</button>}
          </div>

          {meals.length === 0 ? (
            <div className="card"><div className="empty-state">
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>🍲</p>
              <h3>No meal dates yet</h3>
              <p style={{ marginBottom: 16 }}>{isAdmin ? 'Add dates when meals would be helpful and let your community sign up.' : 'No meal dates posted yet. Check back soon.'}</p>
              {isAdmin && <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowMealModal(true)}>Add First Date</button>}
            </div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {meals.map(meal => (
                <div key={meal.id} className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{
                      fontSize: '1.1rem', fontWeight: 700, color: 'var(--navy)',
                      fontFamily: 'var(--font-display)'
                    }}>
                      {formatDate(meal.date)}
                    </div>
                    <span style={{
                      padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                      background: meal.status === 'claimed' ? 'var(--sage-light)' : 'var(--amber-light)',
                      color: meal.status === 'claimed' ? 'var(--sage-dark)' : 'var(--amber)'
                    }}>
                      {meal.status === 'claimed' ? '✓ Covered' : 'Open'}
                    </span>
                  </div>
                  {meal.meal_description && (
                    <div style={{ fontSize: '0.875rem', color: 'var(--slate)', marginBottom: 8 }}>🍽 {meal.meal_description}</div>
                  )}
                  {meal.claimed_by_name && (
                    <div style={{ fontSize: '0.82rem', color: 'var(--sage-dark)', marginBottom: 8 }}>👤 {meal.claimed_by_name}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    {meal.status === 'open' && !isAdmin && (
                      <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => claimMeal(meal)}>Sign up to bring food</button>
                    )}
                    {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => deleteMeal(meal.id)}>Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── VISIT SCHEDULER ── */}
      {activeTab === 'visits' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--slate-light)' }}>
              {isAdmin ? 'Review and approve visit requests.' : 'Request a time to visit. Admin will approve.'}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowVisitModal(true)}>+ Schedule a Visit</button>
          </div>

          {visits.length === 0 ? (
            <div className="card"><div className="empty-state">
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>🏠</p>
              <h3>No visit requests yet</h3>
              <p style={{ marginBottom: 16 }}>{isAdmin ? 'Community members can request visits here.' : 'Request a time to visit — the admin will approve it.'}</p>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowVisitModal(true)}>Schedule a Visit</button>
            </div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {visits.map(visit => (
                <div key={visit.id} className="card" style={{ padding: '20px 24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{visit.requested_by_name}</div>
                        <span style={{
                          padding: '2px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                          background: visit.status === 'approved' ? 'var(--sage-light)' : visit.status === 'declined' ? '#FFF5F5' : 'var(--amber-light)',
                          color: visit.status === 'approved' ? 'var(--sage-dark)' : visit.status === 'declined' ? '#C53030' : 'var(--amber)'
                        }}>
                          {visit.status === 'approved' ? '✓ Approved' : visit.status === 'declined' ? '✗ Declined' : 'Pending'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--slate-light)', display: 'flex', gap: 12, marginBottom: visit.message ? 8 : 0 }}>
                        <span>📅 {formatDate(visit.preferred_date)}{visit.preferred_time ? ' at ' + visit.preferred_time : ''}</span>
                      </div>
                      {visit.message && <div style={{ fontSize: '0.875rem', color: 'var(--slate)', fontStyle: 'italic' }}>"{visit.message}"</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 16, flexShrink: 0 }}>
                      {isAdmin && visit.status === 'pending' && (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => approveVisit(visit.id, true)}>Approve</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => approveVisit(visit.id, false)}>Decline</button>
                        </>
                      )}
                      {isAdmin && <button className="btn btn-danger btn-sm" onClick={() => deleteVisit(visit.id)}>×</button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── PRAYER WALL ── */}
      {activeTab === 'prayer' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--slate-light)' }}>
              Leave a message of love, prayer, or encouragement for {patient?.name} and their family.
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowPrayerModal(true)}>+ Leave a Message</button>
          </div>

          {prayers.length === 0 ? (
            <div className="card"><div className="empty-state">
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>🙏</p>
              <h3>Be the first to leave a message</h3>
              <p style={{ marginBottom: 16 }}>Share a prayer, encouraging word, or message of love for {patient?.name}.</p>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowPrayerModal(true)}>Leave a Message</button>
            </div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {prayers.map(prayer => (
                <div key={prayer.id} style={{
                  background: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                  padding: '20px 24px', boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ fontSize: '1.5rem', marginBottom: 10 }}>🙏</div>
                  <div style={{ fontSize: '0.925rem', color: 'var(--slate)', lineHeight: 1.7, marginBottom: 14, fontStyle: 'italic' }}>
                    "{prayer.message}"
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--navy)' }}>{prayer.author_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-light)' }}>{formatTimeAgo(prayer.created_at)}</div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => deletePrayer(prayer.id)} style={{ background: 'none', border: 'none', color: 'var(--slate-light)', cursor: 'pointer', fontSize: '1rem' }}>×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── POST NEED MODAL ── */}
      {showNeedModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowNeedModal(false) }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>Post a Need</h2>
              <button onClick={() => setShowNeedModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>
            <div className="form-group">
              <label>What do you need? *</label>
              <input value={needForm.title} onChange={e => setNeedForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Someone to take out the trash Tuesday" />
            </div>
            <div className="form-group">
              <label>More details (optional)</label>
              <textarea value={needForm.description} onChange={e => setNeedForm(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Any extra details..." />
            </div>
            <div className="form-group">
              <label>Needed by (optional)</label>
              <input type="date" value={needForm.due_date} onChange={e => setNeedForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowNeedModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveNeed} disabled={needLoading || !needForm.title} style={{ flex: 1 }}>
                {needLoading ? 'Posting...' : 'Post Need'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD MEAL MODAL ── */}
      {showMealModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowMealModal(false) }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>Add Meal Date</h2>
              <button onClick={() => setShowMealModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>
            <div className="form-group">
              <label>Date *</label>
              <input type="date" value={mealForm.date} onChange={e => setMealForm(p => ({ ...p, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Meal preference (optional)</label>
              <input value={mealForm.meal_description} onChange={e => setMealForm(p => ({ ...p, meal_description: e.target.value }))} placeholder="e.g. No pork, loves Italian" />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowMealModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveMealSlot} disabled={mealLoading || !mealForm.date} style={{ flex: 1 }}>
                {mealLoading ? 'Saving...' : 'Add Date'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REQUEST VISIT MODAL ── */}
      {showVisitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowVisitModal(false) }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>Request a Visit</h2>
              <button onClick={() => setShowVisitModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>
            <div className="form-group">
              <label>Your name *</label>
              <input value={visitForm.requested_by_name} onChange={e => setVisitForm(p => ({ ...p, requested_by_name: e.target.value }))} placeholder="Your full name" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Preferred date *</label>
                <input type="date" value={visitForm.preferred_date} onChange={e => setVisitForm(p => ({ ...p, preferred_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Preferred time</label>
                <input type="time" value={visitForm.preferred_time} onChange={e => setVisitForm(p => ({ ...p, preferred_time: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Message (optional)</label>
              <textarea value={visitForm.message} onChange={e => setVisitForm(p => ({ ...p, message: e.target.value }))} rows={2} placeholder="Anything you'd like the family to know..." />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowVisitModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveVisit} disabled={visitLoading || !visitForm.requested_by_name || !visitForm.preferred_date} style={{ flex: 1 }}>
                {visitLoading ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LEAVE PRAYER MODAL ── */}
      {showPrayerModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowPrayerModal(false) }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>Leave a Message</h2>
              <button onClick={() => setShowPrayerModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>
            <div className="form-group">
              <label>Your name</label>
              <input value={prayerForm.author_name} onChange={e => setPrayerForm(p => ({ ...p, author_name: e.target.value }))} placeholder="Your name (or leave blank for anonymous)" />
            </div>
            <div className="form-group">
              <label>Your message *</label>
              <textarea value={prayerForm.message} onChange={e => setPrayerForm(p => ({ ...p, message: e.target.value }))} rows={4} placeholder="Share a prayer, encouraging word, or message of love..." />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowPrayerModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={savePrayer} disabled={prayerLoading || !prayerForm.message} style={{ flex: 1 }}>
                {prayerLoading ? 'Posting...' : 'Post Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
