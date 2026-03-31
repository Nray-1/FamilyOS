import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function CreatePatient() {
  const { user, fetchProfile } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '', date_of_birth: '', primary_diagnosis: '', other_conditions: '',
    allergies: '', primary_doctor: '', doctor_phone: '', hospital: '', relationship: '', status: 'stable',
  })

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data: patient, error: patientError } = await supabase
        .from('patients').insert({ ...form, admin_id: user.id }).select().single()
      if (patientError) throw patientError
      await supabase.from('patient_members').insert({ patient_id: patient.id, user_id: user.id, role: 'admin', status: 'active' })
      await supabase.from('profiles').update({ active_patient_id: patient.id }).eq('id', user.id)
      await fetchProfile(user.id)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Failed to create patient profile.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-patient-page">
      <div className="create-patient-container">
        <div className="create-patient-header">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
            Fam<span style={{ color: 'var(--amber)' }}>ily</span>OS
          </div>
          <h1>Set up your loved one's profile</h1>
          <p>This information helps personalize the AI features. You can edit it anytime.</p>
        </div>
        {error && <div className="error-message">{error}</div>}
        <div className="card">
          <form onSubmit={handleSubmit}>
            <p className="card-title">👤 Patient Information</p>
            <div className="form-group">
              <label>Patient's full name *</label>
              <input name="name" value={form.name} onChange={handleChange} placeholder="Margaret Johnson" required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Date of birth</label>
                <input type="date" name="date_of_birth" value={form.date_of_birth} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Your relationship *</label>
                <select name="relationship" value={form.relationship} onChange={handleChange} required>
                  <option value="">Select...</option>
                  <option>Child</option><option>Spouse / Part
