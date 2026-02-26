import Icon from './Icon';

export default function AurisChat({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-200" onClick={onClose} aria-hidden="true" />

      {/* Desktop: slide-in panel from right */}
      <div className="hidden md:flex fixed top-0 right-0 bottom-0 w-full max-w-md bg-bg-main border-l border-border-color shadow-xl z-50 flex-col animate-in slide-in-from-right">
        <div className="flex items-center justify-between p-4 border-b border-border-color shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center">
              <Icon name="brain" size={18} className="text-accent" />
            </div>
            <div>
              <h2 className="font-bold text-text-primary">Auris AI</h2>
              <p className="text-[10px] text-text-secondary uppercase tracking-wider">Coming soon</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          <div className="rounded-2xl border border-border-color bg-bg-main/80 p-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-text-secondary mb-2">
              Status
            </p>
            <p className="text-sm font-semibold text-text-primary">Coming soon.</p>
            <p className="text-xs text-text-secondary mt-2 leading-relaxed">
              Auris AI will be available from this panel when it&apos;s ready.
            </p>
          </div>

          <div className="rounded-2xl border border-border-color bg-bg-main/80 p-4">
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-text-secondary mb-2">
              Planned
            </p>
            <ul className="text-xs text-text-secondary space-y-2 list-disc list-inside">
              <li>Habit pattern insights</li>
              <li>Personalized streak coaching</li>
              <li>Weekly summaries</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Mobile: centered compact popup */}
      <div className="md:hidden fixed inset-0 z-50 flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-bg-main border border-border-color rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-4 border-b border-border-color">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                <Icon name="brain" size={16} className="text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Auris AI</h2>
                <p className="text-[9px] text-text-secondary uppercase tracking-wider">Coming soon</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary">
              <Icon name="x" size={14} />
            </button>
          </div>
          <div className="p-4 space-y-3">
            <div className="rounded-xl border border-border-color bg-bg-main/80 p-3">
              <p className="text-[9px] font-mono uppercase tracking-[0.28em] text-text-secondary mb-1">Status</p>
              <p className="text-sm font-semibold text-text-primary">Coming soon.</p>
              <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                Auris AI will be available when it&apos;s ready.
              </p>
            </div>
            <div className="rounded-xl border border-border-color bg-bg-main/80 p-3">
              <p className="text-[9px] font-mono uppercase tracking-[0.28em] text-text-secondary mb-1">Planned</p>
              <ul className="text-xs text-text-secondary space-y-1 list-disc list-inside">
                <li>Habit pattern insights</li>
                <li>Personalized streak coaching</li>
                <li>Weekly summaries</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
