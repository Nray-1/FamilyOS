import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function CreatePatient() {
  const { user, fetchProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    date_of_birth: '',
    primary_diagnosis: '',
    other_conditions: '',
    allergies: '',
    primary_doctor: '',
    doctor_phone: '',
    hospital: '',
    relationship: '',
    status: 'stable',
  });

  const handleChange = e => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Create patient
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert({ ...form, admin_id: user.id })
        .select()
        .single();

      if (patientError) throw patientError;

      // Create admin membership
      await supabase.from('patient_members').insert({
        patient_id: patient.id,
        user_id: user.id,
        role: 'admin',
        status: 'active',
      });

      // Update profile with active patient
      await supabase.from('profiles').update({ active_patient_id: patient.id }).eq('id', user.id);
      await fetchProfile(user.id);

      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to create patient profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-patient-page">
      <div className="create-patient-container">
        <div className="create-patient-header">
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
            Fam<span style={{ color: 'var(--amber)' }}>ily</span>OS
          </div>
          <h1>Set up your loved one's profile</h1>
          <p>This information helps personalize the AI features. You can always edit it later.</p>
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
                <label>Your relationship to patient *</label>
                <select name="relationship" value={form.relationship} onChange={handleChange} required>
                  <option value="">Select...</option>
                  <option>Child</option>
                  <option>Spouse / Partner</option>
                  <option>Parent</option>
                  <option>Sibling</option>
                  <option>Friend</option>
                  <option>Other</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Current status</label>
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="stable">Stable</option>
                <option value="critical">Critical</option>
                <option value="recovering">Recovering</option>
                <option value="hospice">Hospice / End of Life</option>
                <option value="healthy">Healthy (general care planning)</option>
              </select>
            </div>

            <div className="divider" />
            <p className="card-title">🏥 Medical Information</p>

            <div className="form-group">
              <label>Primary diagnosis (if any)</label>
              <input name="primary_diagnosis" value={form.primary_diagnosis} onChange={handleChange} placeholder="e.g. Stage 3 Breast Cancer, Alzheimer's, Parkinson's..." />
            </div>

            <div className="form-group">
              <label>Other health conditions</label>
              <input name="other_conditions" value={form.other_conditions} onChange={handleChange} placeholder="e.g. Type 2 Diabetes, Hypertension..." />
            </div>

            <div className="form-group">
              <label>Allergies (food, medication, environmental)</label>
              <input name="allergies" value={form.allergies} onChange={handleChange} placeholder="e.g. Penicillin, Shellfish, Pollen..." />
            </div>

            <div className="divider" />
            <p className="card-title">👨‍⚕️ Care Team</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label>Primary doctor / specialist</label>
                <input name="primary_doctor" value={form.primary_doctor} onChange={handleChange} placeholder="Dr. Sarah Williams" />
              </div>
              <div className="form-group">
                <label>Doctor's phone number</label>
                <input name="doctor_phone" value={form.doctor_phone} onChange={handleChange} placeholder="(305) 555-0100" />
              </div>
            </div>

            <div className="form-group">
              <label>Primary hospital / care facility</label>
              <input name="hospital" value={form.hospital} onChange={handleChange} placeholder="Baptist Health South Florida" />
            </div>

            <button type="submit" className="btn btn-primary btn-lg" style={{ marginTop: 8 }} disabled={loading}>
              {loading ? 'Setting up...' : 'Create profile & go to dashboard →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
