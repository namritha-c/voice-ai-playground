import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

interface Toast { id: number; kind: 'err' | 'info'; msg: string }
interface Api { error: (m: string) => void; info: (m: string) => void }

const Ctx = createContext<Api>({ error: () => undefined, info: () => undefined });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef(0);
  const show = useCallback((kind: Toast['kind'], msg: string) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), kind, msg });
    timer.current = window.setTimeout(() => setToast(null), kind === 'err' ? 7000 : 2200);
  }, []);
  const api = useMemo(() => ({ error: (m: string) => show('err', m), info: (m: string) => show('info', m) }), [show]);
  return (
    <Ctx.Provider value={api}>
      {children}
      {toast && (
        <div key={toast.id} role={toast.kind === 'err' ? 'alert' : 'status'} className={`toast${toast.kind === 'err' ? ' err' : ''}`} onClick={() => setToast(null)}>
          {toast.kind === 'err' && <span className="k">ERROR</span>}
          <span>{toast.msg}</span>
        </div>
      )}
    </Ctx.Provider>
  );
}
