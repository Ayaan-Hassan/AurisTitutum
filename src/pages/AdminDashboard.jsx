import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, collectionGroup, getCountFromServer, onSnapshot, doc, deleteDoc } from "firebase/firestore";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { db } from "../firebase.config";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/Button";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";

export default function AdminDashboard() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [selectedUser, setSelectedUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [userLoading, setUserLoading] = useState(false);
    const [inspectorHabit, setInspectorHabit] = useState(null);
    const [subUnsubscribes, setSubUnsubscribes] = useState([]);

    // NOTE: This assumes the user's UID has Firestore security rules giving them
    // permission to read entire collections/collectionGroups
    const adminUid = import.meta.env.VITE_ADMIN_UID;
    const isAdmin = user && adminUid && user.uid === adminUid;

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch global counts
            const habitsSnapshot = await getCountFromServer(collectionGroup(db, "habits"));
            const remindersSnapshot = await getCountFromServer(collectionGroup(db, "reminders"));
            const notesSnapshot = await getCountFromServer(collectionGroup(db, "notes"));

            setStats({
                users: usersList.length,
                habits: habitsSnapshot.data().count,
                reminders: remindersSnapshot.data().count,
                notes: notesSnapshot.data().count
            });
            setLoading(false);
        } catch (err) {
            console.error(err);
            setError("Failed to fetch admin stats. Ensure Firestore security rules permit collectionGroup queries for you.");
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isAdmin) return;
        
        const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
            const allUsers = [];
            snapshot.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
            setUsersList(allUsers);
        });
        
        fetchStats();

        return () => unsubUsers();
    }, [isAdmin]);

    // Cleanup user subs when component unmounts
    useEffect(() => {
        return () => subUnsubscribes.forEach(u => u());
    }, [subUnsubscribes]);

    const loadUserData = (uid) => {
        setUserLoading(true);
        setSelectedUser(uid);
        
        subUnsubscribes.forEach(unsub => unsub());
        
        let newSubs = [];
        const attachListener = (collectionName, key) => {
            const unsub = onSnapshot(collection(db, "users", uid, collectionName), (snapshot) => {
                const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setUserData(prev => ({ ...prev, [key]: data }));
                setUserLoading(false);
            }, (err) => console.error(err));
            newSubs.push(unsub);
        };

        setUserData({ habits: [], notes: [], reminders: [], logs: [] });
        attachListener("habits", "habits");
        attachListener("notes", "notes");
        attachListener("reminders", "reminders");
        attachListener("logs", "logs");
        
        setSubUnsubscribes(newSubs);
    };

    const deleteInspectorData = async (collectionName, id) => {
        if (window.confirm("Admin Privileges: Are you sure you want to permanently delete this user data?")) {
            try {
                await deleteDoc(doc(db, "users", selectedUser, collectionName, id));
            } catch(e) {
                console.error("Failed to delete", e);
            }
        }
    };

    const graphData = useMemo(() => {
        if (!usersList.length) return [];
        const dateCounts = {};
        usersList.forEach(u => {
            const d = u.createdAt ? new Date(u.createdAt) : new Date();
            const k = d.toISOString().split('T')[0];
            dateCounts[k] = (dateCounts[k] || 0) + 1;
        });

        const data = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const k = d.toISOString().split('T')[0];
            const display = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            data.push({ name: display, users: dateCounts[k] || 0 });
        }
        return data;
    }, [usersList]);

    const userStats = useMemo(() => {
        if (!userData || !usersList.length || !selectedUser) return null;
        const info = usersList.find(u => u.id === selectedUser);
        
        const createdDate = info?.createdAt ? new Date(info.createdAt) : new Date();
        const daysSince = Math.max(1, Math.ceil((new Date() - createdDate) / (1000 * 60 * 60 * 24)));
        const activeDates = new Set();
        let totalLogHits = 0;
        
        // Count from habit logs structure
        (userData.logs || []).forEach(l => {
             if (l.date) activeDates.add(l.date);
             totalLogHits++;
        });
        
        const consistencyRate = Math.min(100, Math.round((activeDates.size / daysSince) * 100));
        
        let exactMins = Math.floor((info?.exactTimeSpent || 0) / 60);
        const baseTimeMins = (userData.habits?.length * 15) + (totalLogHits * 2.5) + (userData.notes?.length * 5);
        
        // Prevent jarring resets if they just gained "exactTimeSpent" tracking by combining legacy estimate
        if (exactMins < 5) {
            exactMins += Math.floor(baseTimeMins);
        } else {
            // Over time, accurate tracking suppresses the legacy base estimator completely
            exactMins = Math.max(exactMins, Math.floor(baseTimeMins));
        }
        
        const hours = Math.floor(exactMins / 60);
        const mins = Math.floor(exactMins % 60);
        
        return {
           consistencyRate,
           timeSpent: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
           activeDays: activeDates.size,
           totalLogHits
        };
    }, [userData, usersList, selectedUser]);

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center p-10">
                <Icon name="shield-check" size={48} className="text-text-secondary mb-4" />
                <h2 className="text-xl font-bold font-mono uppercase tracking-[0.2em] text-text-primary">
                    Access Denied
                </h2>
                <p className="text-sm text-text-secondary mt-2">
                    Only the authorized master UID can access the analytics dashboard.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tighter text-text-primary">
                        Platform Master Console
                    </h2>
                    <p className="text-text-secondary text-xs mt-1">
                        Global metrics generated live from Firestore infrastructure.
                    </p>
                </div>
                <Button onClick={fetchStats} variant="outline" size="sm" icon="rotate-ccw">
                    Refresh Data
                </Button>
            </div>

            {error ? (
                <Card className="p-4 border-danger/40 bg-danger/10 text-danger text-sm">
                    {error}
                </Card>
            ) : loading ? (
                <div className="flex items-center gap-3 text-text-secondary text-sm font-mono uppercase py-10 justify-center">
                    <Icon name="loader" className="animate-spin" size={24} />
                    Aggregating nodes...
                </div>
            ) : (
                <div className="flex flex-col gap-6 relative items-start">
                    
                    {/* TOP SECTION: Global Platform Stats */}
                    <div className="w-full space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <MetricCard title="Total Users" value={stats.users} icon="users" />
                            <div className="bg-card-bg border border-border-color rounded-2xl p-5 flex items-center justify-between transition-transform hover:scale-[1.02] shadow-sm">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1">Online Users</p>
                                    <p className="text-3xl font-mono font-bold text-success flex items-center gap-2">
                                        {usersList.filter(u => u.isOnline).length} 
                                        <span className="relative flex h-3 w-3">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                                        </span>
                                    </p>
                                </div>
                                <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center text-success">
                                    <Icon name="radio" size={24} />
                                </div>
                            </div>
                            <MetricCard title="Habits Created" value={stats.habits} icon="activity" />
                            <MetricCard title="Reminders" value={stats.reminders} icon="bell" />
                            <MetricCard title="Notes" value={stats.notes} icon="file-text" />
                        </div>

                        {/* Graph */}
                        <div className="p-6 bg-card-bg border border-border-color rounded-3xl shadow-sm">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary mb-6"><Icon name="trending-up" className="inline-block mr-2" size={14} /> User Registration Growth (Last 30 Days)</h3>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={graphData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4}/>
                                                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                                        <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} />
                                        <Tooltip 
                                            contentStyle={{ backgroundColor: 'var(--bg-main)', borderColor: 'var(--border-color)', borderRadius: '12px', fontSize: '12px' }}
                                            itemStyle={{ color: 'var(--text-primary)' }}
                                            labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px' }}
                                        />
                                        <Area type="monotone" dataKey="users" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* BOTTOM SECTION: Split Inspection view */}
                    <div className="flex flex-col lg:flex-row gap-6 w-full h-[700px]">
                        {/* Left Sidebar (Users List) */}
                        <div className="w-full lg:w-80 shrink-0 bg-card-bg border border-border-color rounded-[2rem] shadow-sm flex flex-col h-full overflow-hidden">
                            <div className="p-5 border-b border-border-color bg-accent-dim shrink-0 flex justify-between items-center">
                                <h3 className="font-bold tracking-tighter text-sm">Registered Users</h3>
                                <span className="text-[10px] font-mono font-bold bg-accent/20 text-accent px-2 py-1 rounded-lg uppercase">{usersList.length} Network Nodes</span>
                            </div>
                            <div className="overflow-y-auto flex-1 custom-scrollbar">
                                {usersList.map(u => (
                                    <button 
                                        onClick={() => { loadUserData(u.id); setInspectorHabit(null); }} 
                                        key={u.id} 
                                        className={`w-full text-left p-4 flex items-center justify-between border-b border-border-color/50 transition-all ${selectedUser === u.id ? 'bg-accent/10 border-l-[3px] border-l-accent' : 'hover:bg-accent-dim border-l-[3px] border-l-transparent'}`}
                                    >
                                        <div className="min-w-0 pr-2">
                                            <p className="font-bold text-sm text-text-primary truncate">{u.displayName || "Unknown User"}</p>
                                            <p className="text-[11px] text-text-secondary font-mono truncate">{u.email}</p>
                                        </div>
                                        {u.isOnline && (
                                            <div className="w-2.5 h-2.5 rounded-full bg-success flex-shrink-0 relative shadow-[0_0_8px_rgba(var(--success-rgb),0.6)]">
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right Main Screen Box */}
                        <div className="flex-1 min-w-0 bg-card-bg border border-border-color rounded-[2rem] shadow-sm flex flex-col h-full overflow-hidden relative">
                            {!selectedUser ? (
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10 flex flex-col items-center justify-center">
                                    {/* Welcome / Empty State */}
                                    <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center text-accent mb-6 animate-pulse">
                                        <Icon name="search" size={32} />
                                    </div>
                                    <h3 className="text-2xl font-bold text-text-primary mb-3 text-center tracking-tighter">User Data Inspector Dashboard</h3>
                                    <p className="text-base text-text-secondary max-w-lg text-center">
                                        Select a user from the sidebar on the left to inject into their precise telemetry, habit constructions, written notes, and raw log activity events.
                                    </p>
                                </div>
                            ) : userLoading || !userData || !userStats ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-text-secondary animate-in fade-in">
                                <Icon name="loader" className="animate-spin" size={32} />
                                <p className="text-xs tracking-widest uppercase font-bold text-accent">Querying Profile infrastructure...</p>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {/* Inspector Header */}
                                <div className="p-6 sm:p-8 border-b border-border-color bg-gradient-to-r from-accent/10 to-transparent shrink-0 relative">
                                    <button onClick={() => setSelectedUser(null)} className="absolute top-6 right-6 w-8 h-8 rounded-lg bg-bg-main border border-border-color flex items-center justify-center hover:bg-white/10 text-text-secondary transition-all shadow-sm">
                                        <Icon name="x" size={14} />
                                    </button>
                                    <div className="flex items-center gap-4 mb-2">
                                        <div className="w-12 h-12 rounded-full bg-accent text-bg-main flex items-center justify-center font-bold text-xl uppercase shadow-lg shadow-accent/20">
                                            {(usersList.find(u => u.id === selectedUser)?.displayName || "U").charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent mb-1 flex items-center gap-2">Target Identity Confirmed {usersList.find(u => u.id === selectedUser)?.isOnline && <span className="w-2 h-2 rounded-full bg-success animate-pulse shadow-[0_0_8px_rgba(var(--success-rgb),0.8)]"></span>}</p>
                                            <h2 className="text-2xl font-bold tracking-tight text-text-primary leading-none flex items-center gap-3">
                                                {usersList.find(u => u.id === selectedUser)?.displayName || "Unknown User"}
                                            </h2>
                                        </div>
                                    </div>
                                    <p className="text-xs text-text-secondary font-mono mt-3 ml-16 flex items-center gap-2">
                                        <Icon name="mail" size={12} /> {usersList.find(u => u.id === selectedUser)?.email}
                                        <span className="opacity-50 mx-2">|</span>
                                        <Icon name="hash" size={12} /> {selectedUser}
                                    </p>
                                </div>

                                {/* Inspector Content */}
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-8 bg-bg-main">
                                    {/* Advanced Analytical Box */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-bg-sidebar border border-border-color rounded-2xl p-5 shadow-sm hover:border-accent/40 transition-colors">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1 flex items-center gap-2"><Icon name="clock" size={12}/> Est. Time Spent</p>
                                            <p className="text-2xl font-mono font-bold text-text-primary">{userStats.timeSpent}</p>
                                        </div>
                                        <div className="bg-bg-sidebar border border-border-color rounded-2xl p-5 shadow-sm hover:border-success/40 transition-colors">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1 flex items-center gap-2"><Icon name="activity" size={12}/> Consistency</p>
                                            <p className="text-2xl font-mono font-bold text-success">{userStats.consistencyRate}%</p>
                                        </div>
                                        <div className="bg-bg-sidebar border border-border-color rounded-2xl p-5 shadow-sm hover:border-accent/40 transition-colors">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1 flex items-center gap-2"><Icon name="check-square" size={12}/> Raw Log Hits</p>
                                            <p className="text-2xl font-mono font-bold text-text-primary">{userData.logs?.length || 0}</p>
                                        </div>
                                        <div className="bg-bg-sidebar border border-border-color rounded-2xl p-5 shadow-sm hover:border-accent/40 transition-colors">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1 flex items-center gap-2"><Icon name="grid" size={12}/> Habits Constructed</p>
                                            <p className="text-2xl font-mono font-bold text-text-primary">{userData.habits?.length || 0}</p>
                                        </div>
                                    </div>

                                    {/* Data Split View */}
                                    <div className="grid lg:grid-cols-2 gap-6 items-start">
                                        {/* Left Side: Habits & Logs Explorer */}
                                        <div className="bg-card-bg border border-border-color rounded-3xl p-6 shadow-sm">
                                            <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary mb-4 border-b border-border-color pb-3 flex items-center justify-between">
                                                <span>Habit Intelligence Inspector</span>
                                            </h4>
                                            <div className="space-y-3">
                                                {userData.habits?.length > 0 ? userData.habits.map(h => (
                                                    <div key={h.id} className={`border rounded-2xl overflow-hidden transition-all duration-300 ${inspectorHabit === h.id ? 'border-accent bg-accent-dim shadow-[0_0_15px_rgba(var(--accent-rgb),0.1)]' : 'border-border-color bg-bg-main hover:border-text-secondary/50'}`}>
                                                        <button 
                                                            onClick={() => setInspectorHabit(inspectorHabit === h.id ? null : h.id)} 
                                                            className="w-full text-left p-4 flex items-center justify-between group"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-bold text-text-primary mb-1 group-hover:text-accent transition-colors">{h.emoji} {h.name}</p>
                                                                <div className="flex gap-2">
                                                                   <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-md ${h.type === 'Good' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>{h.type}</span>
                                                                   <span className="text-[9px] font-mono text-text-secondary px-2 py-0.5 rounded-md bg-white/5 border border-white/10 uppercase">{h.mode}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button onClick={(e) => { e.stopPropagation(); deleteInspectorData("habits", h.id); }} className="p-1.5 rounded-lg border border-border-color/50 text-text-secondary hover:text-danger hover:border-danger/30 hover:bg-danger/10 transition-colors">
                                                                    <Icon name="trash" size={14} />
                                                                </button>
                                                                <Icon name={inspectorHabit === h.id ? "chevron-up" : "chevron-down"} size={16} className={`transition-all ${inspectorHabit === h.id ? 'text-accent' : 'text-text-secondary group-hover:text-text-primary'}`} />
                                                            </div>
                                                        </button>
                                                        
                                                        {inspectorHabit === h.id && (
                                                            <div className="p-4 bg-bg-sidebar animate-in slide-in-from-top-2 border-t border-border-color/50">
                                                                {(() => {
                                                                    const habitLogs = (userData.logs || []).filter(l => l.habitId === h.id).sort((a, b) => new Date(b.date) - new Date(a.date));
                                                                    if (habitLogs.length === 0) return <p className="text-xs text-text-secondary py-4 text-center border border-dashed border-border-color rounded-xl">No logs recorded yet.</p>;

                                                                    const grouped = {};
                                                                    habitLogs.forEach(l => {
                                                                        if (!grouped[l.date]) grouped[l.date] = [];
                                                                        grouped[l.date].push(l);
                                                                    });
                                                                    const sortedDates = Object.keys(grouped).sort((a,b) => new Date(b) - new Date(a));

                                                                    return (
                                                                        <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                                                            {sortedDates.map((dateStr, idx) => (
                                                                                <div key={idx} className="relative pl-3 border-l-2 border-border-color">
                                                                                    <div className="absolute w-2 h-2 rounded-full bg-border-color -left-[5px] top-[7px] ring-4 ring-bg-sidebar"></div>
                                                                                    <p className="text-[10px] font-mono font-bold tracking-widest text-text-primary bg-bg-main px-2 py-1 rounded-md inline-block shadow-sm border border-border-color/50 mb-2">{new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                                                    <div className="space-y-1.5 mt-1">
                                                                                        {grouped[dateStr].sort((a,b) => a.time?.localeCompare(b.time)).map((e, i) => {
                                                                                            let display = "Logged successfully";
                                                                                            const isPhoto = e.mode === "photo" || (e.time && e.time.startsWith("data:image"));
                                                                                            if (e.mode === "count") {
                                                                                                display = `${e.amount} ${e.unit || ""}`.trim();
                                                                                            }
                                                                                            return (
                                                                                                <div key={i} className="flex flex-col text-xs p-2.5 rounded-xl bg-bg-main border border-border-color/50 hover:border-accent/30 transition-colors gap-2 overflow-hidden w-full max-w-full group/log">
                                                                                                    <div className="flex justify-between items-center w-full min-w-0">
                                                                                                        <span className="text-text-primary font-medium truncate pr-2">{isPhoto ? "📷 Visual capture attached" : display}</span>
                                                                                                        <div className="flex items-center gap-2 shrink-0">
                                                                                                            <button onClick={() => deleteInspectorData("logs", e.id || e.__id || e.id__ || l.id)} className="opacity-0 group-hover/log:opacity-100 text-text-secondary hover:text-danger transition-colors bg-bg-main">
                                                                                                                <Icon name="trash" size={12} />
                                                                                                            </button>
                                                                                                            {(!isPhoto && e.time) && <span className="text-[10px] text-accent font-mono bg-accent/10 px-2 py-1 rounded-md max-w-[80px] truncate">{e.time}</span>}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    {isPhoto && e.time && (
                                                                                                        <div className="w-full h-32 rounded-lg overflow-hidden border border-border-color/30 mt-1 max-w-full bg-black/20">
                                                                                                            <img src={e.time} alt="Log capture" className="w-full h-full object-cover" />
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            );
                                                                                        })}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        )}
                                                    </div>
                                                )) : <p className="text-xs text-text-secondary font-medium">No habits established.</p>}
                                            </div>
                                        </div>

                                        {/* Right Side: Notes & Reminders */}
                                        <div className="space-y-6">
                                            {/* Notes */}
                                            <div className="bg-card-bg border border-border-color rounded-3xl p-6 shadow-sm">
                                                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary mb-4 border-b border-border-color pb-3">Written Notes ({userData.notes?.length || 0})</h4>
                                                <div className="space-y-3 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                                                    {userData.notes?.length > 0 ? userData.notes.map(n => (
                                                        <div key={n.id} className="p-4 bg-bg-sidebar rounded-2xl border border-border-color hover:border-text-secondary transition-colors group overflow-hidden w-full">
                                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                                <p className="text-sm font-bold text-text-primary break-words whitespace-normal min-w-0">{n.title || "Untitled"}</p>
                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <button onClick={() => deleteInspectorData("notes", n.id)} className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-danger transition-all bg-bg-sidebar rounded">
                                                                        <Icon name="trash" size={12} />
                                                                    </button>
                                                                    {n.pinned && <Icon name="pin" size={12} className="text-accent mt-0.5" />}
                                                                </div>
                                                            </div>
                                                            <p className="text-xs text-text-secondary font-medium leading-relaxed whitespace-pre-wrap break-words">{n.body || "No content"}</p>
                                                        </div>
                                                    )) : <p className="text-xs text-text-secondary font-medium">No notes written.</p>}
                                                </div>
                                            </div>
                                            
                                            {/* Reminders */}
                                            <div className="bg-card-bg border border-border-color rounded-3xl p-6 shadow-sm">
                                                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary mb-4 border-b border-border-color pb-3">Scheduled Reminders ({userData.reminders?.length || 0})</h4>
                                                <div className="space-y-3 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                                                    {userData.reminders?.length > 0 ? userData.reminders.map(r => (
                                                        <div key={r.id} className="p-4 bg-bg-sidebar rounded-2xl border border-border-color flex items-center justify-between hover:border-text-secondary transition-colors overflow-hidden w-full group">
                                                            <div className="min-w-0 pr-3">
                                                               <p className="text-sm font-bold text-text-primary mb-1 break-words whitespace-normal">{r.title}</p>
                                                               {r.date && <p className="text-[10px] text-text-secondary font-mono tracking-widest uppercase">{new Date(r.date).toLocaleDateString()}</p>}
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <button onClick={() => deleteInspectorData("reminders", r.id)} className="opacity-0 group-hover:opacity-100 p-1 text-text-secondary hover:text-danger transition-all bg-bg-sidebar rounded">
                                                                    <Icon name="trash" size={12} />
                                                                </button>
                                                                <span className="text-[10px] font-mono font-bold text-accent bg-accent/10 px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-sm shadow-accent/5">{r.time}</span>
                                                            </div>
                                                        </div>
                                                    )) : <p className="text-xs text-text-secondary font-medium">No reminders set.</p>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MetricCard({ title, value, icon }) {
    return (
        <Card className="p-5 sm:p-6 flex flex-col gap-4 border-border-color bg-bg-main hover:-translate-y-1 transition-all hover:shadow-[0_8px_30px_rgba(255,255,255,0.05)]">
            <div className="flex items-center text-accent justify-between">
                <Icon name={icon} size={20} />
            </div>
            <div>
                <h4 className="text-[10px] uppercase font-black tracking-[0.2em] text-text-secondary mb-2">
                    {title}
                </h4>
                <div className="text-3xl font-black text-text-primary font-mono tracking-tighter">
                    {value}
                </div>
            </div>
        </Card>
    );
}
