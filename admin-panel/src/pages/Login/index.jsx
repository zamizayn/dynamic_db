import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Key, ArrowRight } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { fetchWithAuth } from '../../utils/api';

export default function Login() {
  const [apiKey, setApiKey] = useState('admin_key_123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await fetchWithAuth('/auth/token', {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
      });

      if (data.success) {
        login(data.token);
        navigate('/connect');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="center-screen fade-in">
      <div className="glass-panel auth-card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '16px', borderRadius: '50%' }}>
            <Database size={48} color="var(--accent-primary)" />
          </div>
        </div>
        
        <h1 style={{ marginBottom: '8px' }}>DynamicDB</h1>
        <p style={{ marginBottom: '32px' }}>Enter your API Key to access the panel</p>

        {error && <div className="toast error">{error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ textAlign: 'left' }}>
            <label className="form-label">API Key</label>
            <div style={{ position: 'relative' }}>
              <Key size={18} color="var(--text-secondary)" style={{ position: 'absolute', top: '14px', left: '12px' }} />
              <input
                type="password"
                className="form-input"
                style={{ width: '100%', paddingLeft: '40px' }}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="admin_key_123"
                required
              />
            </div>
          </div>
          
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} disabled={loading}>
            {loading ? 'Authenticating...' : 'Authenticate'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
}
