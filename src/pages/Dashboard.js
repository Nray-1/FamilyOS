import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Home, FileText, Calendar, Users, Heart, Image,
  ClipboardList, LogOut, Plus, Send, X, ChevronRight,
  Activity, Bell, Shield, Stethoscope
} from 'lucide-react';

const ROLE_LABELS = { admin: 'Admin', inner_circle: 'Inner Circle', community: 'Community' };

export default function Dashboard() {
  const { user, profile, signOut } = useAuth();
  const [patient, setPatient] = useState(null);
  const [members, setMembers] = useState([]);
  const [activeSection, setActiveSection] = useState('home');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('inner_circle');
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  const isAdmin = profile?.role === 'admin' || true; // will refine with real roles

  useEffect(() => {
    if (profile?.active_patient_id) {
      fetchPatient(profile.active_patient_id);
      fetchMembers(profile.active_patient_id);
    }
  }, [profile]);

  const fetchPatient = async (patientId) => {
    const { data } = await supabase.from('patients').select('*').eq('id', patientId).single();
    setPatient(data);
  };

  const fetchMembers = async (patientId) => {
    const { data } = await supabase
      .from('patient_members')
      .select('*, profiles(full_name, email)')
      .eq('patient_id', patientId);
    setMembers(data || []);
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteMsg('');
    try {
      const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
      await supabase.from('invites').insert({
        patient_id: patient.id,
        invited_by: user.id,
        email: inviteEmail,
        role: inviteRole,
        token,
        status: 'pending',
      });
      setInviteMsg(`✓ Invite sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch {
      setInviteMsg('Failed to send invite. Please try again.');
    } finally {
      setInviteLoading(false);
    }
  };

  const navItems = [
    { id: 'home', label: 'Dashboard', icon: Home, roles: ['admin', 'inner_circle', 'community'] },
    { id: 'updates', label: 'Update Feed', icon: Bell, roles: ['admin', 'inner_circle', 'community'] },
    { id: 'vault', label: 'The Vault', icon: Shield, roles: ['admin', 'inner_circle'] },
    { id: 'care', label: 'Care Planner', icon: Calendar, roles: ['admin', 'inner_circle'] },
    { id: 'wellness', label: 'Wellness & Diet', icon: Activity, roles: ['admin', 'inner_circle'] },
    { id: 'trials', label: 'Clinical Trials', icon: Stethoscope, roles: ['admin', 'inner_circle'] },
    { id: 'support', label: 'Support Board', icon: Heart, roles: ['admin', 'inner_circle', 'community'] },
    { id: 'media', label: 'Memory Wall', icon: Image, roles: ['admin', 'inner_circle', 'community'] },
    { id: 'documents', label: 'Document Planner', icon: FileText, roles: ['admin'] },
    { id: 'team', label: 'Care Team', icon: Users, roles: ['admin'] },
  ];

  const getInitials = (name) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2) : '?';
  const getRoleBadgeClass = (role) => `role-badge ${role}`;

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">Fam<span>ily</span>OS</div>
        </div>

        {patient && (
          <div className="sidebar-patient">
            <div className="patient-card">
              <div className="patient-name">{patient.name}</div>
              <div className="patient-status">
                <div className="status-dot" style={{ background: patient.status === 'critical' ? '#FC8181' : patient.status === 'stable' ? '#68D391' : '#F6AD55' }} />
                {patient.status?.charAt(0).toUpperCase() + patient.status?.slice(1)}
              </div>
            </div>
          </div>
        )}

        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {navItems.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeSection === item.id ? 'active' : ''}`}
              onClick={() => setActiveSection(item.id)}
            >
              <item.icon size={18} />
              {item.label}
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
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {activeSection === 'home' && (
          <>
            <div className="page-header">
              <h1 className="page-title">
                {patient ? `${patient.name}'s Care Hub` : 'Your Care Hub'}
              </h1>
              <p className="page-subtitle">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Stats */}
            <div className="dashboard-grid">
              {[
                { icon: Users, label: 'Care Team Members', value: members.length, color: 'green' },
                { icon: Calendar, label: 'Upcoming Appointments', value: 0, color: 'amber' },
                { icon: FileText, label: 'Documents in Vault', value: 0, color: 'blue' },
                { icon: Heart, label: 'Support Requests', value: 0, color: 'purple' },
              ].map(stat => (
                <div className="stat-card" key={stat.label}>
                  <div className={`stat-icon ${stat.color}`}>
                    <stat.icon size={22} />
                  </div>
                  <div>
                    <div className="stat-value">{stat.value}</div>
                    <div className="stat-label">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-title">⚡ Quick Actions</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {[
                  { label: 'Post an Update', icon: Bell, section: 'updates' },
                  { label: 'Add Document', icon: Shield, section: 'vault' },
                  { label: 'Schedule Appointment', icon: Calendar, section: 'care' },
                  { label: 'Post a Need', icon: Heart, section: 'support' },
                  { label: 'Invite Someone', icon: Users, section: 'team' },
                ].map(action => (
                  <button
                    key={action.label}
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveSection(action.section)}
                  >
                    <action.icon size={15} />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Patient Info Summary */}
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

        {/* Care Team / Invite Section */}
        {activeSection === 'team' && (
          <>
            <div className="page-header">
              <h1 className="page-title">Care Team</h1>
              <p className="page-subtitle">Manage who has access and what they can see</p>
            </div>

            <div className="invite-grid">
              {/* Invite Form */}
              <div className="card">
                <div className="card-title"><Plus size={18} /> Invite Someone</div>
                {inviteMsg && (
                  <div className={inviteMsg.startsWith('✓') ? 'success-message' : 'error-message'}>
                    {inviteMsg}
                  </div>
                )}
                <form onSubmit={sendInvite}>
                  <div className="form-group">
                    <label>Their email address</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="sister@example.com"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Their access level</label>
                    <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                      <option value="inner_circle">Inner Circle — sees medical updates & documents you share</option>
                      <option value="community">Community — sees updates & support board only</option>
                    </select>
                  </div>

                  <div style={{ background: 'var(--cream)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', marginBottom: 16, fontSize: '0.85rem', color: 'var(--slate)' }}>
                    {inviteRole === 'inner_circle'
                      ? '🔒 Inner Circle members can view updates, shared documents, appointments, and the care planner. You control exactly what they see.'
                      : '👥 Community members can view your updates, the memory wall, and the support board. They cannot access any medical or private information.'}
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={inviteLoading}>
                    <Send size={16} />
                    {inviteLoading ? 'Sending...' : 'Send invite'}
                  </button>
                </form>
              </div>

              {/* Current Members */}
              <div className="card">
                <div className="card-title"><Users size={18} /> Current Members ({members.length})</div>
                <div className="member-list">
                  {members.length === 0 ? (
                    <div className="empty-state">
                      <Users />
                      <h3>No members yet</h3>
                      <p>Invite family and friends to get started</p>
                    </div>
                  ) : members.map(m => (
                    <div className="member-item" key={m.id}>
                      <div className="member-avatar">{getInitials(m.profiles?.full_name || m.email || '')}</div>
                      <div style={{ flex: 1 }}>
                        <div className="member-name">{m.profiles?.full_name || 'Pending'}</div>
                        <div className="member-email">{m.profiles?.email || m.email}</div>
                      </div>
                      <span className={getRoleBadgeClass(m.role)}>{ROLE_LABELS[m.role]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Coming Soon Sections */}
        {['updates','vault','care','wellness','trials','support','media','documents'].includes(activeSection) && (
          <>
            <div className="page-header">
              <h1 className="page-title">
                {navItems.find(n => n.id === activeSection)?.label}
              </h1>
              <p className="page-subtitle">This section is being built — coming in Phase {
                activeSection === 'updates' ? 2 :
                activeSection === 'vault' ? 3 :
                activeSection === 'care' ? 4 :
                activeSection === 'wellness' ? 4 :
                activeSection === 'trials' ? 4 :
                activeSection === 'support' ? 5 :
                activeSection === 'media' ? 6 : 7
              }</p>
            </div>
            <div className="card">
              <div className="empty-state">
                <ChevronRight size={48} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.3 }} />
                <h3>Coming soon</h3>
                <p>This feature is actively being built. Check back soon!</p>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
