'use client';
import { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle } from '@phosphor-icons/react';

let toastId = 0;
let addToastFn = null;

export function toast(msg, type = 'info') {
  if (addToastFn) addToastFn(msg, type);
}

export default function ToastContainer() {
  const [items, setItems] = useState([]);

  const add = useCallback((msg, type) => {
    const id = ++toastId;
    setItems(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setItems(prev => prev.filter(i => i.id !== id)), 3500);
  }, []);

  useEffect(() => { addToastFn = add; return () => { addToastFn = null; }; }, [add]);

  if (!items.length) return null;
  return (
    <div className="toast-container">
      {items.map(i => (
        <div key={i.id} className={`toast toast-${i.type}`} onClick={() => setItems(prev => prev.filter(x => x.id !== i.id))}>
          {i.type === 'info' ? <CheckCircle size={14} weight="fill" /> : <XCircle size={14} weight="fill" />}
          {i.msg}
        </div>
      ))}
    </div>
  );
}
