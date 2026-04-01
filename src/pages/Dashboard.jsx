import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import UpdateFeed from './UpdateFeed'
import Vault from './Vault'

export default function Dashboard() {
  const { user, profile, signOut } = useAuth()
  const [patient, setPatient] = useState(null)
  const [members, setMembers] = useState([])
  const [recentPosts, setRecentPosts] = useState([])
  const [activeSection, setActiveSection] = useState('home')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('inner_circle')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [showEditPatient, setShowEditPatient] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [editLoading, setEditLoading] = useState(false)
  const [editMsg, setEditMsg] = useState('')

  // Determine role - admins created the patient, others are members
  const userRole = profile?.system_role || 'admin' // fallback to admin for existing users

  const isAdmin = userRole === 'admin'
  const isInnerCircle = userRole === 'inner_circle'
  const isCommunity = userRole === 'community'

  useEffect(() => {
    if (profile?.active_patient_id) {
      fetchPatient(profile.active_patient_id)
      fetchMembers(profile.active_patient_id)
      fetchRecentPosts(profile.active_patient_id)
    }
  }, [profile])

  const fetchPatient = async (id) => {
    const { data } = await supabase.from('patients').select('*').eq('id', id).single()
    setPatient(data)
    if (data) setEditForm({
      name: data.name || '',
      date_of_birth: data.date_of_birth || '',
      primary_diagnosis: data.primary_diagnosis || '',
      other_conditions: data.other_conditions || '',
      allergies: data.allergies || '',
      primary_doctor: data.primary_doctor || '',
      doctor_phone: data.doctor_phone || '',
      hospital: data.hospital || '',
      status: data.status || 'stable',
    })
  }

  const savePatient = async () => {
    setEditLoading(true)
    setEditMsg('')
    try {
      await supabase.from('patients').update(editForm).eq('id', patient.id)
      await fetchPatient(patient.id)
      setEditMsg('Saved!')
      setTimeout(() => { setShowEditPatient(false); setEditMsg('') }, 1000)
    } catch {
      setEditMsg('Failed to save.')
    } finally {
      setEditLoading(false)
    }
  }

  const fetchMembers = async (id) => {
    const { data } = await supabase.from('patient_members').select('*, profiles(full_name, email)').eq('patient_id', id)
    setMembers(data || [])
  }

  const fetchRecentPosts = async (id) => {
    const { data } = await supabase
      .from('updates')
      .select('*, profiles(full_name)')
      .eq('patient_id', id)
      .order('created_at', { ascending: false })
      .limit(3)
    setRecentPosts(data || [])
  }

  const sendInvite = async (e) => {
    e.preventDefault()
    setInviteLoading(true)
    setInviteMsg('')
    try {
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
      await supabase.from('invites').insert({
        patient_id: patient.id,
        invited_by: user.id,
        email: inviteEmail,
        role: inviteRole,
        token,
        status: 'pending'
      })
      setInviteMsg('Invite sent to ' + inviteEmail)
      setInviteEmail('')
    } catch {
      setInviteMsg('Failed to send invite.')
    } finally {
      setInviteLoading(false)
    }
  }

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'

  const formatDate = (dateStr) => {
    const d = new Date(dateStr)
    const now = new Date()
    const diff = now - d
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago'
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const moodColors = {
    great: '#68D391', good: '#63B3ED', stable: '#D4956A', tough: '#FC8181', critical: '#B794F4'
  }
  const moodLabels = {
    great: 'Doing great', good: 'Doing well', stable: 'Stable', tough: 'Tough day', critical: 'Needs prayer'
  }

  // Nav items filtered by role
  const allNavItems = [
    { id: 'home',      label: 'Dashboard',       emoji: '🏠', roles: ['admin', 'inner_circle', 'community'] },
    { id: 'updates',   label: 'Update Feed',      emoji: '📢', roles: ['admin', 'inner_circle', 'community'] },
    { id: 'vault',     label: 'The Vault',        emoji: '🔒', roles: ['admin', 'inner_circle'] },
    { id: 'care',      label: 'Care Planner',     emoji: '📅', roles: ['admin', 'inner_circle'] },
    { id: 'wellness',  label: 'Wellness & Diet',  emoji: '🥗', roles: ['admin', 'inner_circle'] },
    { id: 'trials',    label: 'Clinical Trials',  emoji: '🔬', roles: ['admin', 'inner_circle'] },
    { id: 'support',   label: 'Support Board',    emoji: '❤️', roles: ['admin', 'inner_circle', 'community'] },
    { id: 'media',     label: 'Memory Wall',      emoji: '📸', roles: ['admin', 'inner_circle', 'community'] },
    { id: 'documents', label: 'Document Planner', emoji: '📄', roles: ['admin'] },
    { id: 'team',      label: 'Care Team',        emoji: '👥', roles: ['admin'] },
  ]

  const navItems = allNavItems.filter(item => item.roles.includes(userRole))

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">FamilyOS</div>
        </div>
        {patient && (
          <div className="sidebar-patient">
            <div className="patient-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="patient-name">{patient.name}</div>
                {isAdmin && (
                  <button
                    onClick={() => setShowEditPatient(true)}
                    title="Edit patient"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '2px 4px', borderRadius: 4, color: 'rgba(255,255,255,0.4)',
                      display: 'flex', alignItems: 'center', transition: 'color 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.9)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                )}
              </div>
              <div className="patient-status">
                <div className="status-dot" style={{ background: patient.status === 'critical' ? '#FC8181' : '#68D391' }} />
                {patient.status}
              </div>
            </div>
          </div>
        )}
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button
              key={item.id}
              className={'nav-item' + (activeSection === item.id ? ' active' : '')}
              onClick={() => setActiveSection(item.id)}
            >
              <span>{item.emoji}</span> {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{getInitials(profile?.full_name || '')}</div>
            <div>
              <div className="user-name">{profile?.full_name || 'User'}</div>
              <div className="user-role" style={{ textTransform: 'capitalize' }}>
                {userRole.replace('_', ' ')}
              </div>
            </div>
          </div>
          <button className="nav-item" onClick={signOut} style={{ color: 'rgba(255,255,255,0.5)' }}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">

        {/* ── HOME ── */}
        {activeSection === 'home' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">
                {patient ? patient.name + ' Care Hub' : 'Your Care Hub'}
              </h1>
              <p className="page-subtitle">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Role-based welcome banner */}
            {isCommunity && (
              <div style={{
                background: 'linear-gradient(135deg, var(--sage-light), var(--amber-light))',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                padding: '20px 24px', marginBottom: 28,
                display: 'flex', alignItems: 'center', gap: 16
              }}>
                <span style={{ fontSize: '2rem' }}>❤️</span>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--navy)', marginBottom: 4 }}>
                    Thank you for being part of {patient?.name}'s community
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--slate)' }}>
                    You can view updates, leave messages of support, and sign up to help on the Support Board.
                  </div>
                </div>
              </div>
            )}

            <div className="dashboard-grid">
              <div className="stat-card">
                <div className="stat-icon green">👥</div>
                <div>
                  <div className="stat-value">{members.length}</div>
                  <div className="stat-label">Care Team Members</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon amber">📅</div>
                <div>
                  <div className="stat-value">0</div>
                  <div className="stat-label">Upcoming Appointments</div>
                </div>
              </div>
              {!isCommunity && (
                <div className="stat-card">
                  <div className="stat-icon blue">📄</div>
                  <div>
                    <div className="stat-value">0</div>
                    <div className="stat-label">Documents in Vault</div>
                  </div>
                </div>
              )}
              <div className="stat-card">
                <div className="stat-icon purple">📢</div>
                <div>
                  <div className="stat-value">{recentPosts.length}</div>
                  <div className="stat-label">Recent Updates</div>
                </div>
              </div>
            </div>

            {/* Patient overview - hidden from community */}
            {patient && !isCommunity && (
              <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-title">Patient Overview</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                  {[
                    { label: 'Diagnosis', value: patient.primary_diagnosis || 'Not specified' },
                    { label: 'Other Conditions', value: patient.other_conditions || 'None listed' },
                    { label: 'Allergies', value: patient.allergies || 'None listed' },
                    { label: 'Doctor', value: patient.primary_doctor || 'Not specified' },
                    { label: 'Hospital', value: patient.hospital || 'Not specified' },
                    { label: 'Status', value: patient.status },
                  ].map(item => (
                    <div key={item.label} style={{
                      padding: '12px 16px', background: 'var(--cream)',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-light)', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent updates preview */}
            {recentPosts.length > 0 && (
              <div className="card">
                <div className="card-title" style={{ justifyContent: 'space-between' }}>
                  <span>Recent Updates</span>
                  <button
                    onClick={() => setActiveSection('updates')}
                    style={{
                      background: 'none', border: 'none', color: 'var(--sage-dark)',
                      fontSize: '0.85rem', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 500
                    }}
                  >
                    View all →
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {recentPosts.map(post => (
                    <div key={post.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '14px 16px', background: 'var(--cream)',
                      borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                      cursor: 'pointer'
                    }}
                      onClick={() => setActiveSection('updates')}
                    >
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%', marginTop: 6, flexShrink: 0,
                        background: moodColors[post.mood] || moodColors.stable
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--slate)', lineHeight: 1.5, marginBottom: 4 }}>
                          {post.content.length > 120 ? post.content.slice(0, 120) + '...' : post.content}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-light)' }}>
                          {post.profiles?.full_name} · {formatDate(post.created_at)} · {moodLabels[post.mood] || 'Stable'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentPosts.length === 0 && (
              <div className="card">
                <div className="empty-state">
                  <p style={{ fontSize: '2.5rem', marginBottom: 12 }}>📢</p>
                  <h3>No updates yet</h3>
                  <p style={{ marginBottom: 16 }}>
                    {isAdmin
                      ? 'Post your first update to keep your care team informed.'
                      : 'Check back soon for updates from the care team.'}
                  </p>
                  {isAdmin && (
                    <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => setActiveSection('updates')}>
                      Post First Update
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── UPDATE FEED ── */}
        {activeSection === 'updates' && patient && (
          <UpdateFeed patient={patient} />
        )}

        {/* ── VAULT ── */}
        {activeSection === 'vault' && patient && (
          <Vault patient={patient} />
        )}

        {/* ── CARE TEAM (admin only) ── */}
        {activeSection === 'team' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Care Team</h1>
              <p className="page-subtitle">Manage who has access</p>
            </div>
            <div className="invite-grid">
              <div className="card">
                <div className="card-title">Invite Someone</div>
                {inviteMsg && <div className="success-message">{inviteMsg}</div>}
                <form onSubmit={sendInvite}>
                  <div className="form-group">
                    <label>Email address</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="sister@example.com"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Access level</label>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                      <option value="inner_circle">Inner Circle — sees medical updates</option>
                      <option value="community">Community — sees updates only</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={inviteLoading}>
                    {inviteLoading ? 'Sending...' : 'Send invite'}
                  </button>
                </form>
              </div>
              <div className="card">
                <div className="card-title">Current Members ({members.length})</div>
                <div className="member-list">
                  {members.length === 0 ? (
                    <p style={{ color: 'var(--slate-light)' }}>No members yet.</p>
                  ) : members.map(m => (
                    <div className="member-item" key={m.id}>
                      <div className="member-avatar">{getInitials(m.profiles?.full_name || '')}</div>
                      <div style={{ flex: 1 }}>
                        <div className="member-name">{m.profiles?.full_name || 'Pending'}</div>
                        <div className="member-email">{m.profiles?.email}</div>
                      </div>
                      <span className={'role-badge ' + m.role}>{m.role.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── COMING SOON for everything else ── */}
        {!['home', 'updates', 'team', 'vault'].includes(activeSection) && (
          <div>
            <div className="page-header">
              <h1 className="page-title">{navItems.find(n => n.id === activeSection)?.label}</h1>
              <p className="page-subtitle">Coming soon</p>
            </div>
            <div className="card">
              <div className="empty-state">
                <p style={{ fontSize: '3rem', marginBottom: 16 }}>🚧</p>
                <h3>Coming soon</h3>
                <p>This feature is being built.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Edit Patient Modal */}
      {showEditPatient && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
        }} onClick={e => { if (e.target === e.currentTarget) setShowEditPatient(false) }}>
          <div style={{
            background: 'white', borderRadius: 'var(--radius)', padding: 32,
            width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--navy)' }}>Edit Patient Profile</h2>
              <button onClick={() => setShowEditPatient(false)} style={{
                background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--slate-light)'
              }}>×</button>
            </div>

            {editMsg && <div className={editMsg === 'Saved!' ? 'success-message' : 'error-message'}>{editMsg}</div>}

            {[
              { label: 'Full name', key: 'name' },
              { label: 'Primary diagnosis', key: 'primary_diagnosis' },
              { label: 'Other conditions', key: 'other_conditions' },
              { label: 'Allergies', key: 'allergies' },
              { label: 'Primary doctor', key: 'primary_doctor' },
              { label: 'Doctor phone', key: 'doctor_phone' },
              { label: 'Hospital / care facility', key: 'hospital' },
            ].map(field => (
              <div className="form-group" key={field.key}>
                <label>{field.label}</label>
                <input
                  value={editForm[field.key] || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                />
              </div>
            ))}

            <div className="form-group">
              <label>Current status</label>
              <select value={editForm.status || 'stable'} onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}>
                <option value="stable">Stable</option>
                <option value="critical">Critical</option>
                <option value="recovering">Recovering</option>
                <option value="hospice">Hospice</option>
                <option value="healthy">Healthy</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setShowEditPatient(false)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={savePatient} disabled={editLoading} style={{ flex: 1 }}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
