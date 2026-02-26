import { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';
import Icon from '../components/Icon';
import { useTheme } from '../components/ThemeProvider';
import { Card } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';

const Analytics = ({ habits, selectedHabitId, setSelectedHabitId }) => {
    const { theme } = useTheme();
    const { user } = useAuth();
    const [timeRange, setTimeRange] = useState('weekly');
    const [compareMode, setCompareMode] = useState(false);
    const [selectedHabits, setSelectedHabits] = useState([]);
    const [chartType, setChartType] = useState('line');

    useEffect(() => {
        if (!compareMode) {
            const id = selectedHabitId || habits[0]?.id;
            setSelectedHabits(id ? [id] : []);
        }
    }, [compareMode, selectedHabitId, habits]);

    const enterCompareMode = () => {
        setCompareMode(true);
        setSelectedHabits(habits.slice(0, 2).map(h => h.id));
    };

    const habitColors = useMemo(() => {
        const root = typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : null;
        const chartPrimary = root?.getPropertyValue('--chart-primary')?.trim() || (theme === 'dark' ? '#3b82f6' : '#2563eb');
        const chartSecondary = root?.getPropertyValue('--chart-secondary')?.trim() || (theme === 'dark' ? '#8b5cf6' : '#7c3aed');
        const chartAccent = root?.getPropertyValue('--chart-accent')?.trim() || (theme === 'dark' ? '#ef4444' : '#dc2626');
        const success = root?.getPropertyValue('--success')?.trim() || (theme === 'dark' ? '#10b981' : '#059669');
        const accent = root?.getPropertyValue('--accent')?.trim() || (theme === 'dark' ? '#E4E4E7' : '#18181b');
        // Ensure high contrast colors - never use background colors for data
        return [
            chartPrimary,      // Blue - high contrast
            chartSecondary,    // Purple - high contrast
            chartAccent,       // Red - high contrast
            success,           // Green - high contrast
            accent             // Accent color - high contrast
        ];
    }, [theme]);

    const toggleHabit = (habitId) => {
        setSelectedHabits(prev => {
            if (prev.includes(habitId)) {
                if (prev.length <= 1) return prev;
                return prev.filter(id => id !== habitId);
            }
            if (prev.length >= 5) return prev;
            return [...prev, habitId];
        });
    };

    const selectSingleHabit = (habitId) => {
        setSelectedHabitId?.(habitId);
        setSelectedHabits([habitId]);
    };

    const chartData = useMemo(() => {
        if (selectedHabits.length === 0) return [];
        const selectedHabitObjects = habits.filter(h => selectedHabits.includes(h.id));
        if (selectedHabitObjects.length === 0) return [];

        const todayKey = new Date().toISOString().split('T')[0];

        if (timeRange === 'daily') {
            return Array.from({ length: 24 }).map((_, i) => {
                const label = `${i.toString().padStart(2, '0')}:00`;
                const dataPoint = { name: label };
                selectedHabitObjects.forEach(habit => {
                    const logToday = (habit.logs || []).find(l => l.date === todayKey);
                    const entries = logToday?.entries || [];
                    let total = 0;
                    entries.forEach(entry => {
                        const isCount = typeof entry === 'string' && entry.includes('|');
                        if (isCount) {
                            const [timePart, valueStr] = entry.split('|');
                            const hr = parseInt(timePart.split(':')[0], 10);
                            if (hr === i) total += parseInt(valueStr, 10) || 0;
                        } else {
                            const hr = parseInt(String(entry).split(':')[0], 10);
                            if (hr === i) total += 1;
                        }
                    });
                    dataPoint[habit.id] = total;
                });
                return dataPoint;
            });
        }

        const length = timeRange === 'weekly' ? 7 : timeRange === 'monthly' ? 30 : 12;
        return Array.from({ length }).map((_, i) => {
            const d = new Date();
            if (timeRange === 'yearly') d.setMonth(d.getMonth() - (length - 1 - i));
            else d.setDate(d.getDate() - (length - 1 - i));
            const dateStr = d.toISOString().split('T')[0];
            let name;
            if (timeRange === 'weekly') name = d.toLocaleDateString('en-US', { weekday: 'short' });
            else if (timeRange === 'monthly') name = d.getDate().toString();
            else name = d.toLocaleDateString('en-US', { month: 'short' });
            const dataPoint = { name };
            selectedHabitObjects.forEach(habit => {
                const log = (habit.logs || []).find(l => l.date === dateStr);
                dataPoint[habit.id] = log ? log.count : 0;
            });
            return dataPoint;
        });
    }, [selectedHabits, timeRange, habits]);

    const hasDataInPeriod = useMemo(() => {
        return chartData.some(d => selectedHabits.some(habitId => (d[habitId] || 0) > 0));
    }, [chartData, selectedHabits]);

    const chartColors = useMemo(() => ({
        grid: theme === 'dark' ? '#27272a' : '#e4e4e7',
        text: theme === 'dark' ? '#71717a' : '#a1a1aa',
        tooltipBg: theme === 'dark' ? '#18181b' : '#ffffff',
        tooltipBorder: theme === 'dark' ? '#27272a' : '#e4e4e7',
        tooltipText: theme === 'dark' ? '#FAFAFA' : '#18181b'
    }), [theme]);

    if (!user) {
        return (
            <div className="page-fade space-y-6 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tighter text-text-primary">Analytics</h2>
                        <p className="text-text-secondary text-xs mt-1">
                            Detailed analytics are available when you sign in.
                        </p>
                    </div>
                </div>
                <Card className="p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 hover:translate-y-0 hover:shadow-none hover:border-border-color">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-accent-dim border border-border-color flex items-center justify-center">
                            <Icon name="line-chart" size={24} className="text-accent" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-text-primary">Sign in to unlock analytics</h3>
                            <p className="text-xs text-text-secondary mt-1">
                                Compare habits, view streak breakdowns, and explore long-range performance once you are logged in.
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="primary"
                        className="w-full sm:w-auto"
                        onClick={() => { window.location.href = '/login'; }}
                    >
                        Sign in for free
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="page-fade space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tighter text-text-primary">Analytics</h2>
                    <p className="text-text-secondary text-xs mt-1">Track performance, compare habits, and spot trends over time.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => { if (compareMode) setCompareMode(false); else { setCompareMode(true); enterCompareMode(); } }}
                        className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all flex items-center gap-2 ${compareMode ? 'bg-accent text-bg-main border-accent' : 'bg-accent-dim border-border-color text-text-secondary hover:text-text-primary'}`}
                    >
                        <Icon name="bar-chart-2" size={12} />
                        {compareMode ? 'Single' : 'Compare'}
                    </button>
                    <div className="flex bg-accent-dim border border-border-color p-1 rounded-xl">
                        {['daily', 'weekly', 'monthly', 'yearly'].map(r => (
                            <button key={r} onClick={() => setTimeRange(r)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap ${timeRange === r ? 'bg-accent text-bg-main' : 'text-text-secondary hover:text-text-primary'}`}>{r}</button>
                        ))}
                    </div>
                    <div className="flex bg-accent-dim border border-border-color p-1 rounded-xl">
                        <button onClick={() => setChartType('line')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase ${chartType === 'line' ? 'bg-accent text-bg-main' : 'text-text-secondary hover:text-text-primary'}`}>Line</button>
                        <button onClick={() => setChartType('bar')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase ${chartType === 'bar' ? 'bg-accent text-bg-main' : 'text-text-secondary hover:text-text-primary'}`}>Bar</button>
                    </div>
                </div>
            </div>

            <div className="flex gap-6 flex-col lg:flex-row">
                {/* Sidebar: list of habits */}
                <Card className="lg:w-64 shrink-0 p-4 hover:translate-y-0 hover:shadow-none hover:border-border-color flex flex-col lg:min-h-[500px]">
                    <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3">Habits</p>
                    <div className="space-y-1 flex-1 overflow-y-auto custom-scrollbar">
                        {habits.length === 0 ? (
                            <p className="text-[10px] text-text-secondary">No habits yet.</p>
                        ) : (
                            habits.map(h => {
                                const isSelected = selectedHabits.includes(h.id);
                                const colorIdx = selectedHabits.indexOf(h.id);
                                const dotColor = colorIdx >= 0 ? habitColors[colorIdx] : null;
                                return (
                                    <button
                                        key={h.id}
                                        onClick={() => compareMode ? toggleHabit(h.id) : selectSingleHabit(h.id)}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${isSelected ? 'bg-accent-dim border border-border-color text-text-primary' : 'text-text-secondary hover:bg-accent-dim hover:text-text-primary'}`}
                                    >
                                        {dotColor && <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />}
                                        <span className="truncate">{h.name}</span>
                                    </button>
                                );
                            })
                        )}
                    </div>
                </Card>

                {/* Chart area */}
                <div className="flex-1 min-w-0">
                    <Card className="p-6 min-h-[500px] flex flex-col hover:translate-y-0 hover:shadow-none hover:border-border-color">
                        {selectedHabits.length > 0 ? (
                            <>
                                <div className="flex flex-wrap gap-3 mb-4">
                                    {selectedHabits.map((habitId, index) => {
                                        const habit = habits.find(h => h.id === habitId);
                                        if (!habit) return null;
                                        return (
                                            <div key={habitId} className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: habitColors[index] }} />
                                                <span className="text-xs text-text-secondary">{habit.name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex-1 min-h-[400px] w-full">
                                    {!hasDataInPeriod && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                                            <p className="text-[10px] font-bold uppercase text-text-secondary">No activity in this period.</p>
                                        </div>
                                    )}
                                    <ResponsiveContainer width="100%" height="100%" minHeight={400}>
                                        {chartType === 'bar' ? (
                                            <BarChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                                <XAxis dataKey="name" tick={{ fill: chartColors.text, fontSize: 10 }} />
                                                <YAxis tick={{ fill: chartColors.text, fontSize: 10 }} />
                                                <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: '12px', fontSize: '11px', color: chartColors.tooltipText }} />
                                                <Legend />
                                                {selectedHabits.map((habitId, index) => {
                                                    const habit = habits.find(h => h.id === habitId);
                                                    return <Bar key={habitId} dataKey={habitId} name={habit?.name} fill={habitColors[index]} fillOpacity={0.9} radius={[4, 4, 0, 0]} />;
                                                })}
                                            </BarChart>
                                        ) : (
                                            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                                                <XAxis dataKey="name" tick={{ fill: chartColors.text, fontSize: 10 }} />
                                                <YAxis tick={{ fill: chartColors.text, fontSize: 10 }} />
                                                <Tooltip contentStyle={{ backgroundColor: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: '12px', fontSize: '11px', color: chartColors.tooltipText }} />
                                                <Legend />
                                                {selectedHabits.map((habitId, index) => {
                                                    const habit = habits.find(h => h.id === habitId);
                                                    return <Line key={habitId} type="monotone" dataKey={habitId} name={habit?.name} stroke={habitColors[index]} strokeWidth={2.5} strokeOpacity={0.9} dot={{ fill: habitColors[index], r: 3, fillOpacity: 0.9 }} activeDot={{ r: 5, fill: habitColors[index] }} />;
                                                })}
                                            </LineChart>
                                        )}
                                    </ResponsiveContainer>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center min-h-[400px]">
                                <p className="text-sm text-text-secondary uppercase tracking-widest">
                                    {habits.length === 0 ? 'Create habits to see analytics' : 'Select a habit from the list'}
                                </p>
                            </div>
                        )}
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
