import { twMerge } from 'tailwind-merge';
import Icon from '../Icon';

export const Button = ({
    children,
    variant = 'primary',
    size = 'md',
    icon,
    className,
    ...props
}) => {
    const baseStyles = "inline-flex items-center justify-center rounded-xl font-bold uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
        primary: "bg-accent text-bg-main hover:opacity-90 shadow-sm",
        secondary: "bg-accent-dim text-text-primary border border-border-color hover:border-text-secondary hover:bg-accent-dim/80",
        ghost: "bg-transparent text-text-secondary hover:text-text-primary hover:bg-accent-dim",
        danger: "bg-transparent text-text-secondary hover:text-danger hover:border-danger border border-transparent hover:bg-danger/5",
        outline: "bg-transparent border border-border-color text-text-primary hover:border-text-secondary"
    };

    const sizes = {
        sm: "text-[9px] px-3 py-1.5 gap-1.5",
        md: "text-[10px] px-4 py-2.5 gap-2",
        lg: "text-xs px-6 py-3.5 gap-2.5",
        icon: "w-8 h-8 p-0 grid place-items-center",
        iconLg: "w-10 h-10 p-0 grid place-items-center"
    };

    return (
        <button
            className={twMerge(baseStyles, variants[variant], sizes[size], className)}
            {...props}
        >
            {icon && <Icon name={icon} size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14} />}
            {children}
        </button>
    );
};
