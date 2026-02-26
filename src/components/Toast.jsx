import Icon from './Icon';

const Toast = ({ message, type, onClose, id }) => {
    // Determine gradient/border based on type
    const colors = {
        reminder: 'from-accent/20 to-accent-dim border-accent/40 text-text-primary',
        info: 'from-card-bg to-accent-dim border-border-color text-text-primary',
        danger: 'from-danger/20 to-card-bg border-danger/40 text-danger'
    }[type] || 'from-card-bg to-accent-dim border-border-color text-text-primary';

    const icon = {
        reminder: 'bell',
        info: 'info',
        danger: 'alert-triangle'
    }[type] || 'bell';

    return (
        <div
            className={`toast-animation flex items-start gap-4 p-4 rounded-2xl border backdrop-blur-xl bg-gradient-to-br shadow-2xl max-w-sm w-full ${colors}`}
        >
            <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 border border-white/10`}>
                <Icon name={icon} size={16} />
            </div>
            <div className="flex-1 pr-4">
                <p className="text-[11px] font-bold leading-relaxed">{message}</p>
            </div>
            <button
                onClick={() => onClose(id)}
                className="shrink-0 text-text-secondary hover:text-text-primary transition-colors mt-0.5"
            >
                <Icon name="x" size={14} />
            </button>
        </div>
    );
};

const ToastContainer = ({ toasts, onClose }) => {
    return (
        <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-4 items-end pointer-events-none">
            {toasts.map(toast => (
                <div key={toast.id} className="pointer-events-auto">
                    <Toast {...toast} onClose={onClose} />
                </div>
            ))}
        </div>
    );
};

export default ToastContainer;
