import { forwardRef } from 'react';
import Icon from '../Icon';

const Switch = forwardRef(({ checked, onChange, label, description, className = '', ...props }, ref) => {
    return (
        <div className={`flex items-center justify-between gap-4 ${className}`}>
            {(label || description) && (
                <div className="flex-1 min-w-0">
                    {label && <p className="text-sm font-bold text-text-primary">{label}</p>}
                    {description && <p className="text-xs text-text-secondary mt-1">{description}</p>}
                </div>
            )}
            <button
                ref={ref}
                type="button"
                role="switch"
                aria-checked={checked}
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-bg-main ${checked ? 'bg-accent' : 'bg-bg-sidebar border border-border-color'
                    }`}
                {...props}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-bg-main shadow-lg transition-transform duration-300 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-1'
                        }`}
                />
            </button>
        </div>
    );
});

Switch.displayName = 'Switch';

export default Switch;
