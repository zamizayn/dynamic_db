import { useState, useEffect, useCallback } from 'react';
import { createContext, useContext } from 'react';

const ToastContext = createContext();

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'error', duration = 4000) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              padding: '12px 20px',
              borderRadius: '10px',
              background: toast.type === 'error'
                ? 'rgba(239, 68, 68, 0.95)'
                : toast.type === 'success'
                  ? 'rgba(16, 185, 129, 0.95)'
                  : 'rgba(99, 102, 241, 0.95)',
              color: 'white',
              fontSize: '0.9rem',
              fontWeight: 500,
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              backdropFilter: 'blur(12px)',
              animation: 'slideIn 0.3s ease',
              maxWidth: '400px',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
