import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Snackbar } from '@telegram-apps/telegram-ui';
import { setToastRef } from '../toastRef.js';

type ToastType = 'error' | 'success' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Register with the global mutation cache error handler
  useEffect(() => {
    setToastRef(showToast);
    return () => setToastRef(null);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          onClose={() => removeToast(toast.id)}
          duration={4000}
          before={
            <span style={{ fontSize: '18px' }}>
              {toast.type === 'error' ? '\u26A0' : toast.type === 'success' ? '\u2713' : '\u2139'}
            </span>
          }
        >
          {toast.message}
        </Snackbar>
      ))}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
