import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const TABS = [
  { id: 'appointments', label: 'Appointments', emoji: '📅' },
  { id: 'medications',  label: 'Medications',  emoji: '💊' },
  { id: 'tasks',        label: 'Tasks',         emoji: '✅' },
  { id: 'nutrition',    label: 'Nutrition AI',  emoji: '🥗' },
  { id: 'trials',       label: 'Clinical Trials', emoji: '🔬' },
]

export default function CarePlanner({ patient }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('appointments')

  // Appointments
  const [appointments, setAppointments] = useState([])
  const [showApptModal, setShowApptModal] = useState(false)
  const [apptForm, setApptForm] = useState({ title: '', doctor: '', location: '', date: '', time: '', notes: '', assigned_to: '' })
  const [apptLoading, setApptLoading] = useState(false)
  const [showAIQuestions, setShowAIQuestions] = useState(null)
  const [aiQuestions, setAiQuestions] = useState('')
  const [aiQLoading, setAiQLoading] = useState(false)

  // Medications
  const [medications, setMedications] = useState([])
  const [showMedModal, setShowMedModal] = useState(false)
  const [medForm, setMedForm] = useState({ name: '', dosage: '', frequency: '', prescriber: '', refill_date: '', notes: '' })
  const [medLoading, setMedLoading] = useState(false)

  // Tasks
  const [tasks, setTasks] = useState([])
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [taskForm, setTaskForm] = useState({ title: '', assigned_to: '', due_date: '', notes: '' })
  const [taskLoading, setTaskLoading] = useState(false)

  // Nutrition AI
  const [nutritionPlan, setNutritionPlan] = useState('')
  const [nutritionLoading, setNutritionLoading] = useState(false)
  const [nutritionGenerated, setNutritionGenerated] = useState(false)

  // Clinical Trials
  const [trials, setTrials] = useState([])
  const [trialsLoading, setTrialsLoading] = useState(false)
  const [trialsSearched, setTrialsSearched] = useState(false)

  useEffect(() => {
    if (patient?.id) {
      fetchAppointments()
      fetchMedications()
      fetchTasks()
    }
  }, [patient])

  // ── APPOINTMENTS ──
  const fetchAppointments = async () => {
    const { data } = await supabase.from('appointments').select('*').eq('patient_id', patient.id).order('date', { ascending: true })
    setAppointments(data || [])
  }

  const saveAppointment = async () => {
    if (!apptForm.title || !apptForm.date) return
    setApptLoading(true)
    try {
      await supabase.from('appointments').insert({ ...apptForm, patient_id: patient.id, created_by: user.id })
      setApptForm({ title: '', doctor: '', location: '', date: '', time: '', notes: '', assigned_to: '' })
      await fetchAppointments()
      setShowApptModal(false)
    } finally { setApptLoading(false) }
  }

  const deleteAppointment = async (id) => {
    await supabase.from('appointments').delete().eq('id', id)
    await fetchAppointments()
  }

  const generatePreApptQuestions = async (appt) => {
    setShowAIQuestions(appt.id)
    setAiQuestions('')
    setAiQLoading(true)
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: `You are a helpful medical assistant helping a family caregiver prepare for a doctor's appointment. 
Patient: ${patient.name}, Diagnosis: ${patient.primary_diagnosis || 'not specified'}, Other conditions: ${patient.other_conditions || 'none'}.
Generate the top 8-10 most important questions to ask at this appointment. Be specific, practical, and compassionate.
Format as a numbered list. No preamble.`,
          messages: [{ role: 'user', content: `Generate questions for this appointment: ${appt.title} with ${appt.doctor || 'the doctor'}.` }]
        })
      })
      const data = await response.json()
      setAiQuestions(data.content?.[0]?.text || 'Unable to generate questions.')
    } catch { setAiQuestions('Unable to connect. Please try again.') }
    finally { setAiQLoading(false) }
  }

  // ── MEDICATIONS ──
  const fetchMedications = async () => {
    const { data } = await supabase.from('medications').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false })
    setMedications(data || [])
  }

  const saveMedication = async () => {
    if (!medForm.name || !medForm.dosage) return
    setMedLoading(true)
    try {
      await supabase.from('medications').insert({ ...medForm, patient_id: patient.id, created_by: user.id })
      setMedForm({ name: '', dosage: '', frequency: '', prescriber: '', refill_date: '', notes: '' })
      await fetchMedications()
      setShowMedModal(false)
    } finally { setMedLoading(false) }
  }

  const deleteMedication = async (id) => {
    await supabase.from('medications').delete().eq('id', id)
    await fetchMedications()
  }

  // ── TASKS ──
  const fetchTasks = async () => {
    const { data } = await supabase.from('care_tasks').select('*').eq('patient_id', patient.id).order('created_at', { ascending: false })
    setTasks(data || [])
  }

  const saveTask = async () => {
    if (!taskForm.title) return
    setTaskLoading(true)
    try {
      await supabase.from('care_tasks').insert({ ...taskForm, patient_id: patient.id, created_by: user.id, status: 'pending' })
      setTaskForm({ title: '', assigned_to: '', due_date: '', notes: '' })
      await fetchTasks()
      setShowTaskModal(false)
    } finally { setTaskLoading(false) }
  }

  const toggleTask = async (task) => {
    await supabase.from('care_tasks').update({ status: task.status === 'done' ? 'pending' : 'done' }).eq('id', task.id)
    await fetchTasks()
  }

  const deleteTask = async (id) => {
    await supabase.from('care_tasks').delete().eq('id', id)
    await fetchTasks()
  }

  // ── NUTRITION AI ──
  const generateNutritionPlan = async () => {
    setNutritionLoading(true)
    setNutritionPlan('')
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1500,
          system: `You are a compassionate nutritionist helping a family caregiver support their loved one's health through diet.
Always remind them to consult their doctor before making dietary changes.
Be warm, practical, and specific. Avoid overwhelming jargon.`,
          messages: [{
            role: 'user',
            content: `Create a personalized nutrition and diet guide for ${patient.name}.
Diagnosis: ${patient.primary_diagnosis || 'not specified'}
Other conditions: ${patient.other_conditions || 'none'}
Allergies: ${patient.allergies || 'none known'}

Please include:
1. Foods that support their condition and why
2. Foods to avoid and why
3. Sample meal ideas for breakfast, lunch, and dinner
4. Hydration recommendations
5. Any supplements commonly recommended (note: doctor approval needed)
6. Practical tips for the caregiver

Format with clear section headers.`
          }]
        })
      })
      const data = await response.json()
      setNutritionPlan(data.content?.[0]?.text || 'Unable to generate plan.')
      setNutritionGenerated(true)
    } catch { setNutritionPlan('Unable to connect. Please try again.') }
    finally { setNutritionLoading(false) }
  }

  // ── CLINICAL TRIALS ──
  const searchClinicalTrials = async () => {
    if (!patient.primary_diagnosis) return
    setTrialsLoading(true)
    setTrials([])
    try {
      const condition = encodeURIComponent(patient.primary_diagnosis)
      const res = await fetch(`https://clinicaltrials.gov/api/v2/studies?query.cond=${condition}&filter.overallStatus=RECRUITING&pageSize=10&fields=NCTId,BriefTitle,OverallStatus,Phase,LocationFacility,LocationCity,LocationState,EligibilityCriteria,BriefSummary,StartDate`)
      const data = await res.json()
      setTrials(data.studies || [])
      setTrialsSearched(true)
    } catch {
      setTrialsSearched(true)
    } finally { setTrialsLoading(false) }
  }

  const formatDate = (d) => {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const upcomingAppts = appointments.filter(a => new Date(a.date) >= new Date())
  const pastAppts = appointments.filter(a => new Date(a.date) < new Date())

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Care Planner</h1>
        <p className="page-subtitle">Everything you need to manage {patient?.name}'s care</p>
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

      {/* ── APPOINTMENTS ── */}
      {activeTab === 'appointments' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowApptModal(true)}>+ Add Appointment</button>
          </div>

          {upcomingAppts.length === 0 && pastAppts.length === 0 ? (
            <div className="card"><div className="empty-state">
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>📅</p>
              <h3>No appointments yet</h3>
              <p style={{ marginBottom: 16 }}>Track upcoming doctor visits, tests, and procedures.</p>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowApptModal(true)}>Add First Appointment</button>
            </div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {upcomingAppts.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--slate-light)', marginBottom: 12 }}>Upcoming</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {upcomingAppts.map(appt => (
                      <div key={appt.id} className="card" style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                              <span style={{ fontSize: '1.2rem' }}>📅</span>
                              <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '1rem' }}>{appt.title}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--slate-light)', marginBottom: appt.notes ? 10 : 0 }}>
                              {appt.doctor && <span>👨‍⚕️ {appt.doctor}</span>}
                              {appt.date && <span>🗓 {formatDate(appt.date)}{appt.time ? ' at ' + appt.time : ''}</span>}
                              {appt.location && <span>📍 {appt.location}</span>}
                              {appt.assigned_to && <span>👤 {appt.assigned_to}</span>}
                            </div>
                            {appt.notes && <div style={{ fontSize: '0.85rem', color: 'var(--slate)', marginTop: 8 }}>{appt.notes}</div>}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginLeft: 16, flexShrink: 0 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => generatePreApptQuestions(appt)}>
                              ✨ AI Questions
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteAppointment(appt.id)}>Delete</button>
                          </div>
                        </div>
                        {showAIQuestions === appt.id && (
                          <div style={{ marginTop: 16, padding: '16px', background: 'var(--sage-light)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--sage)' }}>
                            <div style={{ fontWeight: 600, color: 'var(--sage-dark)', marginBottom: 10, fontSize: '0.9rem' }}>✨ AI-Generated Questions to Ask</div>
                            {aiQLoading ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                                <span style={{ fontSize: '0.85rem', color: 'var(--slate)' }}>Generating questions...</span>
                              </div>
                            ) : (
                              <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem', color: 'var(--slate)', lineHeight: 1.7 }}>{aiQuestions}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {pastAppts.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--slate-light)', marginBottom: 12 }}>Past</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pastAppts.map(appt => (
                      <div key={appt.id} style={{ padding: '14px 20px', background: 'white', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', opacity: 0.7, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--slate)', fontSize: '0.9rem' }}>{appt.title}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--slate-light)' }}>{formatDate(appt.date)}{appt.doctor ? ' · ' + appt.doctor : ''}</div>
                        </div>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteAppointment(appt.id)}>Delete</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MEDICATIONS ── */}
      {activeTab === 'medications' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowMedModal(true)}>+ Add Medication</button>
          </div>
          {medications.length === 0 ? (
            <div className="card"><div className="empty-state">
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>💊</p>
              <h3>No medications tracked</h3>
              <p style={{ marginBottom: 16 }}>Track dosages, schedules, and refill dates.</p>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowMedModal(true)}>Add First Medication</button>
            </div></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {medications.map(med => (
                <div key={med.id} className="card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 40, height: 40, background: 'var(--amber-light)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}>💊</div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{med.name}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--sage-dark)', fontWeight: 500 }}>{med.dosage}</div>
                      </div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => deleteMedication(med.id)}>×</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.82rem', color: 'var(--slate-light)' }}>
                    {med.frequency && <span>🕐 {med.frequency}</span>}
                    {med.prescriber && <span>👨‍⚕️ {med.prescriber}</span>}
                    {med.refill_date && <span>🔄 Refill by {formatDate(med.refill_date)}</span>}
                    {med.notes && <div style={{ marginTop: 6, color: 'var(--slate)', fontStyle: 'italic' }}>{med.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TASKS ── */}
      {activeTab === 'tasks' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowTaskModal(true)}>+ Add Task</button>
          </div>
          {tasks.length === 0 ? (
            <div className="card"><div className="empty-state">
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>✅</p>
              <h3>No tasks yet</h3>
              <p style={{ marginBottom: 16 }}>Assign tasks to care team members — pick up prescriptions, drive to appointments, cook dinner.</p>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setShowTaskModal(true)}>Add First Task</button>
            </div></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tasks.map(task => (
                <div key={task.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 20px', background: 'white',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                  opacity: task.status === 'done' ? 0.6 : 1
                }}>
                  <button onClick={() => toggleTask(task)} style={{
                    width: 24, height: 24, borderRadius: 6, border: '2px solid',
                    borderColor: task.status === 'done' ? 'var(--sage)' : 'var(--border)',
                    background: task.status === 'done' ? 'var(--sage)' : 'white',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: 'white', fontSize: '0.8rem'
                  }}>
                    {task.status === 'done' ? '✓' : ''}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, color: 'var(--navy)', textDecoration: task.status === 'done' ? 'line-through' : 'none', fontSize: '0.95rem' }}>{task.title}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--slate-light)', display: 'flex', gap: 12, marginTop: 2 }}>
                      {task.assigned_to && <span>👤 {task.assigned_to}</span>}
                      {task.due_date && <span>📅 Due {formatDate(task.due_date)}</span>}
                    </div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteTask(task.id)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── NUTRITION AI ── */}
      {activeTab === 'nutrition' && (
        <div>
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 4 }}>AI Nutrition & Diet Guide</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--slate-light)' }}>
                  Personalized for {patient?.name} based on their diagnosis, conditions, and allergies
                </div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={generateNutritionPlan} disabled={nutritionLoading}>
                {nutritionLoading ? 'Generating...' : nutritionGenerated ? '🔄 Regenerate' : '✨ Generate Plan'}
              </button>
            </div>
          </div>

          {!nutritionGenerated && !nutritionLoading && (
            <div className="card"><div className="empty-state">
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>🥗</p>
              <h3>Generate a nutrition plan</h3>
              <p style={{ marginBottom: 16 }}>AI will create a personalized diet guide based on {patient?.name}'s specific diagnosis, conditions, and allergies.</p>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={generateNutritionPlan}>Generate Plan</button>
            </div></div>
          )}

          {nutritionLoading && (
            <div className="card"><div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <p style={{ color: 'var(--slate-light)' }}>Creating personalized nutrition plan...</p>
            </div></div>
          )}

          {nutritionPlan && !nutritionLoading && (
            <div className="card">
              <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', marginBottom: 20, fontSize: '0.82rem', color: 'var(--slate)' }}>
                ⚠️ This is AI-generated guidance only. Always consult your doctor or a registered dietitian before making dietary changes.
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, color: 'var(--slate)', fontSize: '0.9rem' }}>
                {nutritionPlan}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── CLINICAL TRIALS ── */}
      {activeTab === 'trials' && (
        <div>
          {!patient?.primary_diagnosis ? (
            <div className="card"><div className="empty-state">
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>🔬</p>
              <h3>No diagnosis on file</h3>
              <p>Add a primary diagnosis to {patient?.name}'s profile to search for clinical trials.</p>
            </div></div>
          ) : (
            <div>
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 4 }}>Clinical Trials Finder</div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--slate-light)' }}>
                      Searching for recruiting trials matching: <strong>{patient.primary_diagnosis}</strong>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={searchClinicalTrials} disabled={trialsLoading}>
                    {trialsLoading ? 'Searching...' : trialsSearched ? '🔄 Search Again' : '🔬 Search Trials'}
                  </button>
                </div>
              </div>

              {!trialsSearched && !trialsLoading && (
                <div className="card"><div className="empty-state">
                  <p style={{ fontSize: '3rem', marginBottom: 12 }}>🔬</p>
                  <h3>Search for clinical trials</h3>
                  <p style={{ marginBottom: 16 }}>Find currently recruiting trials that may match {patient?.name}'s condition. Data from ClinicalTrials.gov.</p>
                  <button className="btn btn-primary" style={{ width: 'auto' }} onClick={searchClinicalTrials}>Search Now</button>
                </div></div>
              )}

              {trialsLoading && (
                <div className="card"><div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div className="spinner" style={{ margin: '0 auto 16px' }} />
                  <p style={{ color: 'var(--slate-light)' }}>Searching ClinicalTrials.gov...</p>
                </div></div>
              )}

              {trialsSearched && !trialsLoading && trials.length === 0 && (
                <div className="card"><div className="empty-state">
                  <p style={{ fontSize: '3rem', marginBottom: 12 }}>🔍</p>
                  <h3>No trials found</h3>
                  <p>No currently recruiting trials found for "{patient?.primary_diagnosis}". Try searching with different terms or check back later.</p>
                </div></div>
              )}

              {trials.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ fontSize: '0.85rem', color: 'var(--slate-light)' }}>Found {trials.length} recruiting trials. Data from ClinicalTrials.gov.</div>
                  {trials.map((trial, i) => {
                    const s = trial.protocolSection || {}
                    const id = s.identificationModule || {}
                    const status = s.statusModule || {}
                    const desc = s.descriptionModule || {}
                    const eligibility = s.eligibilityModule || {}
                    const locations = s.contactsLocationsModule?.locations || []
                    return (
                      <div key={i} className="card" style={{ padding: '20px 24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div style={{ fontWeight: 600, color: 'var(--navy)', fontSize: '0.95rem', flex: 1, marginRight: 12 }}>
                            {id.briefTitle || 'Untitled Trial'}
                          </div>
                          <div style={{
                            background: 'var(--sage-light)', color: 'var(--sage-dark)',
                            padding: '3px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, flexShrink: 0
                          }}>
                            Recruiting
                          </div>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--slate-light)', marginBottom: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          <span>🔬 {id.nctId}</span>
                          {status.phases && <span>Phase {status.phases.join(', ')}</span>}
                          {locations.length > 0 && <span>📍 {locations[0].city}, {locations[0].state}</span>}
                        </div>
                        {desc.briefSummary && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--slate)', lineHeight: 1.6, marginBottom: 12 }}>
                            {desc.briefSummary.length > 300 ? desc.briefSummary.slice(0, 300) + '...' : desc.briefSummary}
                          </div>
                        )}
                        <a
                          href={`https://clinicaltrials.gov/study/${id.nctId}`}
                          target="_blank" rel="noopener noreferrer"
                          className="btn btn-secondary btn-sm"
                          style={{ textDecoration: 'none', display: 'inline-flex' }}
                        >
                          View Full Trial →
                        </a>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ADD APPOINTMENT MODAL ── */}
      {showApptModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowApptModal(false) }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>Add Appointment</h2>
              <button onClick={() => setShowApptModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>
            {[
              { label: 'Appointment title *', key: 'title', placeholder: 'e.g. Oncology Follow-up' },
              { label: 'Doctor / specialist', key: 'doctor', placeholder: 'Dr. Sarah Williams' },
              { label: 'Location', key: 'location', placeholder: 'Baptist Health, 3rd Floor' },
              { label: 'Who is taking them', key: 'assigned_to', placeholder: 'e.g. Michael (son)' },
            ].map(f => (
              <div className="form-group" key={f.key}>
                <label>{f.label}</label>
                <input value={apptForm[f.key]} onChange={e => setApptForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
              </div>
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Date *</label>
                <input type="date" value={apptForm.date} onChange={e => setApptForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Time</label>
                <input type="time" value={apptForm.time} onChange={e => setApptForm(p => ({ ...p, time: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={apptForm.notes} onChange={e => setApptForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Bring insurance card, fast beforehand, etc." />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowApptModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveAppointment} disabled={apptLoading || !apptForm.title || !apptForm.date} style={{ flex: 1 }}>
                {apptLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD MEDICATION MODAL ── */}
      {showMedModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowMedModal(false) }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>Add Medication</h2>
              <button onClick={() => setShowMedModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>
            {[
              { label: 'Medication name *', key: 'name', placeholder: 'e.g. Metformin' },
              { label: 'Dosage *', key: 'dosage', placeholder: 'e.g. 500mg' },
              { label: 'Frequency', key: 'frequency', placeholder: 'e.g. Twice daily with food' },
              { label: 'Prescribing doctor', key: 'prescriber', placeholder: 'Dr. Williams' },
            ].map(f => (
              <div className="form-group" key={f.key}>
                <label>{f.label}</label>
                <input value={medForm[f.key]} onChange={e => setMedForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} />
              </div>
            ))}
            <div className="form-group">
              <label>Refill date</label>
              <input type="date" value={medForm.refill_date} onChange={e => setMedForm(p => ({ ...p, refill_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={medForm.notes} onChange={e => setMedForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Side effects to watch, special instructions..." />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowMedModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveMedication} disabled={medLoading || !medForm.name || !medForm.dosage} style={{ flex: 1 }}>
                {medLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADD TASK MODAL ── */}
      {showTaskModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowTaskModal(false) }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius)', padding: 32, width: '100%', maxWidth: 500, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--navy)' }}>Add Task</h2>
              <button onClick={() => setShowTaskModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)' }}>×</button>
            </div>
            <div className="form-group">
              <label>Task *</label>
              <input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Pick up prescriptions from CVS" />
            </div>
            <div className="form-group">
              <label>Assign to</label>
              <input value={taskForm.assigned_to} onChange={e => setTaskForm(p => ({ ...p, assigned_to: e.target.value }))} placeholder="e.g. Sarah (daughter)" />
            </div>
            <div className="form-group">
              <label>Due date</label>
              <input type="date" value={taskForm.due_date} onChange={e => setTaskForm(p => ({ ...p, due_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={taskForm.notes} onChange={e => setTaskForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Any extra details..." />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowTaskModal(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={saveTask} disabled={taskLoading || !taskForm.title} style={{ flex: 1 }}>
                {taskLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
