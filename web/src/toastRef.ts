/** Shared ref for the global toast function, used by MutationCache and ToastProvider */
type ToastFn = (message: string, type?: 'error' | 'success' | 'info') => void;

let toastRef: ToastFn | null = null;

export function setToastRef(fn: ToastFn | null) {
  toastRef = fn;
}

export function getToastRef(): ToastFn | null {
  return toastRef;
}
