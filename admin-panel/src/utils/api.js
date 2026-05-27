const API_URL = import.meta.env.VITE_API_URL || '/api';

export const fetchWithAuth = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    if (data.message && (data.message.toLowerCase().includes('session id') || data.message.toLowerCase().includes('expired session') || data.message.toLowerCase().includes('invalid session'))) {
      localStorage.removeItem('sessionId');
      window.location.href = '/connect';
    }
    throw new Error(data.message || 'Something went wrong');
  }

  return data;
};
