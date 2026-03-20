import React from 'react';
import { twMerge } from 'tailwind-merge';
import Icon from '../Icon';

export const Select = ({ label, options, value, onChange, className, containerClassName }) => {
    return (
        <div className={twMerge("space-y-2 relative group", containerClassName)}>
            {label && (
                <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">
                    {label}
                </label>
            )}
            <div className="relative">
                <select
                    value={value}
                    onChange={onChange}
                    className={twMerge(
                        "w-full bg-accent-dim border border-border-color p-3 pr-10 rounded-xl text-xs font-bold text-text-primary appearance-none focus:border-text-secondary outline-none transition-all cursor-pointer hover:bg-white/[0.03]",
                        className
                    )}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-bg-sidebar text-text-primary">
                            {opt.label}
                        </option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-secondary group-hover:text-text-primary transition-colors">
                    <Icon name="chevron-down" size={14} />
                </div>
            </div>
        </div>
    );
};
