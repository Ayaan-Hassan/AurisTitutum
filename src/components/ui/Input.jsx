import { twMerge } from 'tailwind-merge';

export const Input = ({ label, className, containerClassName, ...props }) => {
    return (
        <div className={twMerge("space-y-2", containerClassName)}>
            {label && (
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">
                    {label}
                </label>
            )}
            <input
                className={twMerge(
                    "w-full bg-accent-dim border border-border-color p-3 rounded-lg text-sm text-text-primary focus:border-text-secondary outline-none transition-all placeholder-text-secondary/50",
                    className
                )}
                {...props}
            />
        </div>
    );
};
