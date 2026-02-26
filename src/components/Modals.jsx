import { useState, useEffect } from 'react';
import Icon from './Icon';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

export function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', variant = 'danger', onConfirm, onCancel }) {
  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onCancel?.(); };
    if (open) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[9998] animate-in fade-in duration-200" onClick={onCancel} aria-hidden="true" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-sm rounded-2xl border border-border-color bg-bg-main shadow-xl p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold uppercase tracking-widest text-text-primary mb-2">{title}</h3>
        <p className="text-text-secondary text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant={variant} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </>
  );
}

export function RenameModal({ open, currentName, onConfirm, onCancel }) {
  const [value, setValue] = useState(currentName || '');

  useEffect(() => {
    if (open) setValue(currentName || '');
  }, [open, currentName]);

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === 'Escape') onCancel?.(); };
    if (open) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onCancel]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value?.trim()) onConfirm(value.trim());
    else onCancel?.();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[9998] animate-in fade-in duration-200" onClick={onCancel} aria-hidden="true" />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[9999] w-full max-w-sm rounded-2xl border border-border-color bg-bg-main shadow-xl p-6 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold uppercase tracking-widest text-text-primary mb-2">Rename habit</h3>
        <form onSubmit={handleSubmit}>
          <Input
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder="Habit name"
            className="mb-4"
            autoFocus
          />
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" variant="primary">Save</Button>
          </div>
        </form>
      </div>
    </>
  );
}
