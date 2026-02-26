import { twMerge } from 'tailwind-merge';

export const Card = ({ children, className, hoverEffect = true, ...props }) => {
    return (
        <div
            className={twMerge(
                "glass-card bg-card-bg border border-border-color rounded-2xl p-6 transition-all duration-300",
                hoverEffect && "hover:border-text-secondary hover:shadow-lg hover:-translate-y-1",
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
};
