import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmDialog from '../components/dialogs/ConfirmDialog';
import PromptDialog from '../components/dialogs/PromptDialog';
import AlertDialog from '../components/dialogs/AlertDialog';

interface DialogTextOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmState extends DialogTextOptions {
  message: string;
}

interface PromptState extends DialogTextOptions {
  message: string;
  defaultValue: string;
}

interface AlertState {
  title?: string;
  message: string;
  okText?: string;
}

interface DialogsContextValue {
  /** Drop-in replacement for window.confirm(): resolves true/false. */
  confirmAsync: (message: string, options?: DialogTextOptions) => Promise<boolean>;
  /** Drop-in replacement for window.prompt(): resolves the entered string, or null if cancelled. */
  promptAsync: (message: string, defaultValue?: string, options?: DialogTextOptions) => Promise<string | null>;
  /** Drop-in replacement for window.alert() for long-form content that needs a deliberate dismiss. */
  alertAsync: (message: string, options?: { title?: string; okText?: string }) => Promise<void>;
}

const DialogsContext = createContext<DialogsContextValue | null>(null);

export function DialogsProvider({ children }: { children: React.ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const [alertState, setAlertState] = useState<AlertState | null>(null);

  const confirmResolver = useRef<((value: boolean) => void) | null>(null);
  const promptResolver = useRef<((value: string | null) => void) | null>(null);
  const alertResolver = useRef<(() => void) | null>(null);

  const confirmAsync = useCallback((message: string, options?: DialogTextOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
      setConfirmState({ message, ...options });
    });
  }, []);

  const promptAsync = useCallback((message: string, defaultValue = '', options?: DialogTextOptions) => {
    return new Promise<string | null>((resolve) => {
      promptResolver.current = resolve;
      setPromptState({ message, defaultValue, ...options });
    });
  }, []);

  const alertAsync = useCallback((message: string, options?: { title?: string; okText?: string }) => {
    return new Promise<void>((resolve) => {
      alertResolver.current = resolve;
      setAlertState({ message, ...options });
    });
  }, []);

  const resolveConfirm = (value: boolean) => {
    confirmResolver.current?.(value);
    confirmResolver.current = null;
    setConfirmState(null);
  };

  const resolvePrompt = (value: string | null) => {
    promptResolver.current?.(value);
    promptResolver.current = null;
    setPromptState(null);
  };

  const resolveAlert = () => {
    alertResolver.current?.();
    alertResolver.current = null;
    setAlertState(null);
  };

  return (
    <DialogsContext.Provider value={{ confirmAsync, promptAsync, alertAsync }}>
      {children}
      <ConfirmDialog
        open={!!confirmState}
        message={confirmState?.message ?? ''}
        title={confirmState?.title}
        confirmText={confirmState?.confirmText}
        cancelText={confirmState?.cancelText}
        onConfirm={() => resolveConfirm(true)}
        onCancel={() => resolveConfirm(false)}
      />
      <PromptDialog
        open={!!promptState}
        message={promptState?.message ?? ''}
        defaultValue={promptState?.defaultValue ?? ''}
        title={promptState?.title}
        confirmText={promptState?.confirmText}
        cancelText={promptState?.cancelText}
        onSubmit={resolvePrompt}
        onCancel={() => resolvePrompt(null)}
      />
      <AlertDialog
        open={!!alertState}
        message={alertState?.message ?? ''}
        title={alertState?.title}
        okText={alertState?.okText}
        onClose={resolveAlert}
      />
    </DialogsContext.Provider>
  );
}

export function useDialogs(): DialogsContextValue {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error('useDialogs must be used within a DialogsProvider');
  return ctx;
}
