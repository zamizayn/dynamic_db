import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database, Server, User, Lock, CheckCircle,
  Trash2, Loader2, ArrowRight, Activity
} from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { fetchWithAuth } from '../../utils/api';

export default function ConnectDB() {
  const [formData, setFormData] = useState(() => {
    try {
      const cached = localStorage.getItem('lastDbConfig');
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          type: parsed.type || 'mysql',
          host: parsed.host || 'localhost',
          port: String(parsed.port || '3306'),
          database: parsed.database || '',
          username: parsed.username || 'root',
          password: '',
          saveConnection: true
        };
      }
    } catch (e) { }
    return {
      type: 'mysql',
      host: 'localhost',
      port: '3306',
      database: '',
      username: 'root',
      password: '',
      saveConnection: true
    };
  });

  const [savedConnections, setSavedConnections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [connectingId, setConnectingId] = useState(null);
  const [error, setError] = useState('');

  const { connectDb } = useContext(AuthContext);
  const navigate = useNavigate();

  // Load persistent configurations on mount
  const loadSavedConnections = async () => {
    try {
      const res = await fetchWithAuth('/connections');
      if (res.success) {
        setSavedConnections(res.connections);
      }
    } catch (e) {
      console.error('Failed to load saved connections:', e);
    }
  };

  useEffect(() => {
    loadSavedConnections();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        port: parseInt(formData.port)
      };

      const data = await fetchWithAuth('/connect', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (data.success) {
        try {
          localStorage.setItem('lastDbConfig', JSON.stringify({
            type: formData.type,
            host: formData.host,
            port: formData.port,
            database: formData.database,
            username: formData.username
          }));
        } catch (err) { }

        connectDb(data.sessionId);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Direct login trigger using a saved credentials profile
  const handleSavedConnect = async (id) => {
    setError('');
    setConnectingId(id);
    try {
      const data = await fetchWithAuth(`/connections/connect/${id}`, {
        method: 'POST'
      });
      if (data.success) {
        connectDb(data.sessionId);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to the saved database');
    } finally {
      setConnectingId(null);
    }
  };

  // Permanently delete a saved credentials profile
  const handleSavedDelete = async (e, id) => {
    e.stopPropagation(); // prevent card connect trigger
    if (!confirm('Are you sure you want to delete this saved connection profile?')) return;

    try {
      const res = await fetchWithAuth(`/connections/${id}`, {
        method: 'DELETE'
      });
      if (res.success) {
        setSavedConnections(prev => prev.filter(c => c.id !== id));
      }
    } catch (err) {
      setError(err.message || 'Failed to delete saved connection profile');
    }
  };

  // Auto-adjust port default values when switching database types
  useEffect(() => {
    if (formData.type === 'mysql' && formData.port === '5432') {
      setFormData(prev => ({ ...prev, port: '3306' }));
    } else if (formData.type === 'postgres' && formData.port === '3306') {
      setFormData(prev => ({ ...prev, port: '5432' }));
    }
  }, [formData.type]);

  const hasSaved = savedConnections.length > 0;

  return (
    <div className="center-screen fade-in" style={{ padding: '24px' }}>
      <div
        className="glass-panel"
        style={{
          maxWidth: hasSaved ? '1000px' : '500px',
          width: '100%',
          padding: '40px',
          display: 'grid',
          gridTemplateColumns: hasSaved ? '1.1fr 1fr' : '1fr',
          gap: '48px',
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Left Panel: Saved Databases Hub */}
        {hasSaved && (
          <div style={{ textAlign: 'left', borderRight: '1px solid rgba(255, 255, 255, 0.08)', paddingRight: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(59, 130, 246, 0.15))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <Activity size={18} color="var(--accent-purple)" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>Saved Connections</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Launch an active dashboard instantly</p>
              </div>
            </div>

            <div style={{
              marginTop: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxHeight: '380px',
              overflowY: 'auto',
              paddingRight: '8px'
            }}>
              {savedConnections.map((conn) => {
                const isPg = conn.type === 'postgres' || conn.type === 'pg';
                const accentColor = isPg ? '#c084fc' : '#38bdf8';
                const glowStyle = isPg
                  ? 'rgba(168, 85, 247, 0.1)'
                  : 'rgba(56, 189, 248, 0.1)';

                const isConnecting = connectingId === conn.id;

                return (
                  <div
                    key={conn.id}
                    onClick={() => !isConnecting && handleSavedConnect(conn.id)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid rgba(255, 255, 255, 0.08)`,
                      borderRadius: '12px',
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: isConnecting ? 'not-allowed' : 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = accentColor;
                      e.currentTarget.style.boxShadow = `0 4px 20px ${glowStyle}`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', overflow: 'hidden' }}>
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        background: isPg ? 'rgba(168, 85, 247, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${accentColor}33`,
                        flexShrink: 0
                      }}>
                        <Database size={20} color={accentColor} />
                      </div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{conn.database}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {conn.username}@{conn.host}:{conn.port}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {isConnecting ? (
                        <Loader2 size={16} className="spin" color={accentColor} />
                      ) : (
                        <>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: accentColor,
                            textTransform: 'uppercase',
                            background: isPg ? 'rgba(168, 85, 247, 0.08)' : 'rgba(56, 189, 248, 0.08)',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            border: `1px solid ${accentColor}1a`
                          }}>
                            {isPg ? 'PostgreSQL' : 'MySQL'}
                          </span>

                          <button
                            onClick={(e) => handleSavedDelete(e, conn.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              padding: '6px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#ef4444';
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-secondary)';
                              e.currentTarget.style.background = 'transparent';
                            }}
                            title="Delete connection profile"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Right Panel: Connect New Database Form */}
        <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {hasSaved ? 'New Connection' : 'Connect Database'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '32px' }}>
            Configure and link a database cluster
          </p>

          {error && <div className="toast error" style={{ marginBottom: '24px' }}>{error}</div>}

          <form onSubmit={handleConnect}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

              <div className="form-group">
                <label className="form-label">Database Type</label>
                <select name="type" className="form-input" value={formData.type} onChange={handleChange}>
                  <option value="mysql" style={{ background: '#111222' }}>MySQL</option>
                  <option value="postgres" style={{ background: '#111222' }}>PostgreSQL</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Database Name</label>
                <input
                  type="text"
                  name="database"
                  className="form-input"
                  placeholder="e.g. sales_db"
                  value={formData.database}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Host</label>
                <div style={{ position: 'relative' }}>
                  <Server size={16} color="var(--text-secondary)" style={{ position: 'absolute', top: '15px', left: '12px' }} />
                  <input
                    type="text"
                    name="host"
                    className="form-input"
                    style={{ width: '100%', paddingLeft: '36px' }}
                    value={formData.host}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Port</label>
                <input
                  type="number"
                  name="port"
                  className="form-input"
                  value={formData.port}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Username</label>
                <div style={{ position: 'relative' }}>
                  <User size={16} color="var(--text-secondary)" style={{ position: 'absolute', top: '15px', left: '12px' }} />
                  <input
                    type="text"
                    name="username"
                    className="form-input"
                    style={{ width: '100%', paddingLeft: '36px' }}
                    value={formData.username}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={16} color="var(--text-secondary)" style={{ position: 'absolute', top: '15px', left: '12px' }} />
                  <input
                    type="password"
                    name="password"
                    className="form-input"
                    placeholder="••••••••"
                    style={{ width: '100%', paddingLeft: '36px' }}
                    value={formData.password}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            {/* Premium Save connection Switch/Checkbox */}
            <div style={{
              marginTop: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(255,255,255,0.01)',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.04)'
            }}>
              <input
                type="checkbox"
                name="saveConnection"
                id="saveConnection"
                style={{
                  width: '16px',
                  height: '16px',
                  accentColor: 'var(--accent-purple)',
                  cursor: 'pointer'
                }}
                checked={formData.saveConnection}
                onChange={handleChange}
              />
              <label
                htmlFor="saveConnection"
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                Save this database connection for future sessions
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '24px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <span>Connect to Database</span>
                  <CheckCircle size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
