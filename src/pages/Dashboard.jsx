import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const { user, profile, signOut } = useAuth()
  const [patient, setPatient] = useState(null)
  const [members, setMembers] = useState([])
  const [activeSection, setActiveSection] = useState('home')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('inner_circle')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)

  useEffect(() => {
    if (profile?.active_patient_id) {
      fetchPatient(profile.active_patient_id)
      fetchMembers(profile.active_patient_id)
    }
  }, [profile])

  const fetchPatient = async (id) => {
    const { data } = await supabase.from('patients').select('*').eq('id', id).single()
    setPatient(data)
  }

  const fetchMembers = async (id) => {
    const { data } = await supabase.from('patient_members').select('*, profiles(full_name, email)').eq('patient_id', id)
    setMembers(data || [])
  }

  const sendInvite = async (e) => {
    e.preventDefault()
    setInviteLoading(true)
    setInviteMsg('')
    try {
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36)
      await supabase.from('invites').insert({ patient_id: patient.id, invited_by: user.id, email: inviteEmail, role: inviteRole, token, status: 'pending' })
      setInviteMsg(`✓ Invite sent to ${inviteEmail}`)
      setInviteEmail('')
    } catch { setInviteMsg('Failed to send invite.') }
    finally { setInviteLoading(false) }
  }

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : '?'

  const navItems = [
    { id: 'home', label: 'Dashboard', emoji: '🏠' },
    { id: 'updates', label: 'Update Feed', emoji: '📢' },
    { id: 'vault', label: 'The Vault', emoji: '🔒' },
    { id: 'care', label: 'Care Planner', emoji: '📅' },
    { id: 'wellness', label: 'Wellness & Diet', emoji: '🥗' },
    { id: 'trials', label: 'Clinical Trials', emoji: '🔬' },
    { id: 'support', label: 'Support Board', emoji: '❤️' },
    { id: 'media', label: 'Memory Wall', emoji: '📸' },
    { id: 'documents', label: 'Document Planner', emoji: '📄' },
    { id: 'team', label: 'Care Team', emoji: '👥' },
  ]

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">Fam<span>ily</span>OS</div>
        </div>
        {patient && (
          <div className="sidebar-patient">
            <div className="patient-card">
              <div className="patient-name">{patient.name}</div>
              <div className="patient-status">
                <div className="status-dot" style={{ background: patient.status === 'critical' ? '#FC8181' : '#68D391' }} />
                {patient.status?.charAt(0).toUpperCase() + patient.status?.slice(1)}
              </div>
            </div>
          </div>
        )}
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <button key={item.id} className={`nav-item ${activeSection === item.id ? 'active' : ''}`} onClick={() => setActiveSection(item.id)}>
              <span>{item.emoji}</span> {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{getInitials(profile?.full_name || '')}</div>
            <div>
              <div className="user-name">{profile?.full_name || 'User'}</div>
              <div className="user-role">Admin</div>
            </div>
          </div>
          <button className="nav-item" onClick={signOut} style={{ color: 'rgba(255,255,255,0.5)' }}>
            🚪 Sign out
          </button>
        </div>
      </aside>

      <main className="main-content">
        {activeSection === 'home' && (
          <>
            <div className="page-header">
              <h1 className="page-title">{patient ? `${patient.name}'s Care Hub` : 'Your Care Hub'}</h1>
              <p className="page-subtitle">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="dashboard-grid">
              {[
                { label: 'Care Team Members', value: members.length, emoji: '👥' },
                { label: 'Upcoming Appointments', value: 0, emoji: '📅' },
                { label: 'Documents in Vault', value: 0, emoji: '📄' },
                { label: 'Support Requests', value: 0, emoji: '❤️' },
              ].map(stat => (
                <div className="stat-card" key={stat.label}>
                  <div className="stat-icon green" style={{ fontSize: '1.5rem' }}>{stat.emoji}</div>
                  <div>
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-label">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
            {patient && (
              <div className="card">
                <div className="card-title">🏥 Patient Overview</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                  {[
                    { label: 'Primary Diagnosis', value: patient.primary_diagnosis || 'Not specified' },
                    { label: 'Other Conditions', value: patient.other_conditions || 'None listed' },
                    { label: 'Allergies', value: patient.allergies || 'None listed' },
                    { label: 'Primary Doctor', value: patient.primary_doctor || 'Not specified' },
                    { label: 'Hospital', value: patient.hospital || 'Not specified' },
                    { label: 'Status', value: patient.status?.charAt(0).toUpperCase() + patient.status?.slice(1) },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '12px 16px', background: 'var(--cream)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-light)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--navy)' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeSection === 'team' && (
          <>
            <div className="page-header">
              <h1 className="page-title">Care Team</h1>
              <p className="page-subtitle">Manage who has access and what they can see</p>
            </div>
            <div className="invite-grid">
              <div className="card">
                <div className="card-title">➕ Invite Someone</div>
                {inviteMsg && <div className={inviteMsg.startsWith('✓') ? 'success-message' : 'error-message'}>{inviteMsg}</div>}
                <form onSubmit={sendInvite}>
                  <div className="form-group">
                    <label>Their email address</label>
                    <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="sister@example.com" required />
                  </div>
                  <div className="form-group">
                    <label>Their access level</label>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                      <option value="inner_circle">Inner Circle — sees medical updates & shared documents</option>
                      <option value="community">Community — sees updates & support board only</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={inviteLoading}>
                    {inviteLoading ? 'Sending...' : '📨 Send invite'}
                  </button>
                </form>
              </div>
              <div className="card">
                <div className="card-title">👥 Current Members ({members.length})</div>
                <div className="member-list">
                  {members.length === 0 ? (
                    <div className="empty-state"><p>No members yet. Invite family and friends to get started.</p></div>
                  ) : members.map(m => (
                    <div className="member-item" key={m.id}>
                      <div className="member-avatar">{getInitials(m.profiles?.full_name || '')}</div>
                      <div style={{ flex: 1 }}>
                        <div className="member-name">{m.profiles?.full_name || 'Pending'}</div>
                        <div className="member-email">{m.profiles?.email || m.email}</div>
                      </div>
                      <span className={`role-badge ${m.role}`}>{m.role.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {!['home', 'team'].includes(activeSection) && (
          <>
            <div className="page-header">
              <h1 className="page-title">{navItems.find(n => n.id === activeSection)?.label}</h1>
              <p className="page-subtitle">This section is coming soon — being built now</p>
            </div>
            <div className="card">
              <div className="empty-state">
                <p style={{ fontSize: '3rem', marginBottom: 16 }}>🚧</p>
                <h3>Coming soon</h3>
                <p>This feature is actively being built. Check back soon!</p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
