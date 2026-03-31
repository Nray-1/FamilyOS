import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AcceptInvite() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [invite, setInvite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { fetchInvite() }, [token])

  const fetchInvite = async () => {
    const { data, error } = await supabase
      .from('invites').select('*, patients(name)').eq('token', token).eq('status', 'pending').single()
    if (error || !data) setError('This invite link is invalid or has already been used.')
    else setInvite(data)
    setLoading(false)
  }

  const handleAccept = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email: invite.email, password })
      if (signUpError) throw signUpError
      const userId = data.user.id
      await supabase.from('profiles').insert({ id: userId, full_name: fullName, email: invite.email, active_patient_id: invite.patient_id })
      await supabase.from('patient_members').insert({ patient_id: invite.patient_id, user_id: userId, role: invite.role, status: 'active', invited_by: invite.invited_by })
      await supabase.from('invites').update({ status: 'accepted' }).eq('token', token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally { setSubmitting(false) }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div className="create-patient-page">
      <div className="create-patient-container" style={{ maxWidth: 480 }}>
        <div className="create-patient-header">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
            Fam<span style={{ color: 'var(--amber)' }}>ily</span>OS
          </div>
          {invite ? (
            <>
              <h1>You've been invited</h1>
              <p>You're joining as <strong>{invite.role.replace('_', ' ')}</strong> for <strong>{invite.patients?.na
