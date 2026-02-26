import { useState, useEffect, memo } from 'react';

const RealTimeClock = memo(() => {
    const [time, setTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex flex-col items-end">
            <div className="text-[11px] text-zinc-200 font-mono tracking-wider">
                {time.toLocaleTimeString([], { hour12: false })}
            </div>
            <div className="text-[9px] text-zinc-600 font-mono">
                {time.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()}
            </div>
        </div>
    );
});

export default RealTimeClock;
