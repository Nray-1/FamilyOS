import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="brand-logo">Fam<span>ily</span>OS</div>
        <p className="brand-tagline">
          The all-in-one platform for families navigating care together. Stay informed, stay organized, stay connected.
        </p>
        <div className="brand-features">
          {['Private document vault for critical paperwork','Real-time updates for family & friends','AI-powered care planning & guidance','Clinical trials finder & lab trend tracking'].map(f => (
            <div className="brand-feature" key={f}>
              <div className="brand-feature-dot" />
              {f}
            </div>
          ))}
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-form-container">
          <h1>Welcome back</h1>
          <p className="auth-subtitle">Sign in to your family's care hub</p>

          {error && <div className="error-message">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="auth-footer">
            Don't have an account? <Link to="/register">Create one free</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
