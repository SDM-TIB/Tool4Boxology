import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Snackbar, Alert, type AlertColor } from '@mui/material';

interface ToastState {
  id: number;
  message: string;
  severity: AlertColor;
}

interface ToastContextValue {
  /** Drop-in replacement for window.alert() for short, transient notices. */
  showToast: (message: string, severity?: AlertColor) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, severity: AlertColor = 'info') => {
    toastIdCounter += 1;
    setToast({ id: toastIdCounter, message, severity });
  }, []);

  const handleClose = useCallback((_event: unknown, reason?: string) => {
    if (reason === 'clickaway') return;
    setToast(null);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        key={toast?.id}
        open={!!toast}
        autoHideDuration={4000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert onClose={() => setToast(null)} severity={toast.severity} variant="filled" sx={{ whiteSpace: 'pre-line' }}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
