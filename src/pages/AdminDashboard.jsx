import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, collectionGroup, getCountFromServer } from "firebase/firestore";
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

            // Fetch actual users list
            const usersQuery = await getDocs(collection(db, "users"));
            const allUsers = [];
            usersQuery.forEach(doc => {
                 allUsers.push({ id: doc.id, ...doc.data() });
            });
            setUsersList(allUsers);

            setStats({
                users: allUsers.length,
                habits: habitsSnapshot.data().count,
                reminders: remindersSnapshot.data().count,
                notes: notesSnapshot.data().count
            });
        } catch (err) {
            console.error(err);
            setError("Failed to fetch admin stats. Ensure Firestore security rules permit collectionGroup queries for you.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) {
            fetchStats();
        }
    }, [isAdmin]);

    const loadUserData = async (uid) => {
        setUserLoading(true);
        setSelectedUser(uid);
        try {
            const habitsSnap = await getDocs(collection(db, "users", uid, "habits"));
            const notesSnap = await getDocs(collection(db, "users", uid, "notes"));
            const remindersSnap = await getDocs(collection(db, "users", uid, "reminders"));

            setUserData({
                habits: habitsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                notes: notesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                reminders: remindersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            });
        } catch(err) {
            console.error("Error loading user data:", err);
        }
        setUserLoading(false);
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
        (userData.habits || []).forEach(h => {
            (h.logs || []).forEach(l => {
                const dateStr = l.date || "unknown";
                if (l.entries?.length > 0) activeDates.add(dateStr);
                totalLogHits += (l.entries?.length || 0);
            });
        });
        
        const consistencyRate = Math.min(100, Math.round((activeDates.size / daysSince) * 100));
        
        const baseTimeMins = (userData.habits?.length * 15) + (totalLogHits * 2.5) + (userData.notes?.length * 5);
        const hours = Math.floor(baseTimeMins / 60);
        const mins = Math.floor(baseTimeMins % 60);
        
        return {
           consistencyRate,
           timeSpent: `${hours}h ${mins}m`,
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
                <div className="flex flex-col xl:flex-row gap-6 relative items-start">
                    {/* Left Column (Main Data) */}
                    <div className="flex-1 space-y-6 min-w-0 w-full">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard title="Total Users" value={stats.users} icon="users" />
                            <MetricCard title="Habits Created" value={stats.habits} icon="activity" />
                            <MetricCard title="Reminders" value={stats.reminders} icon="bell" />
                            <MetricCard title="Notes" value={stats.notes} icon="file-text" />
                        </div>

                        {/* Graph */}
                        <div className="p-6 bg-card-bg border border-border-color rounded-[2rem] shadow-sm">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary mb-6"><Icon name="trending-up" className="inline-block mr-2" size={14} /> User Registration Growth (Last 30 Days)</h3>
                            <div className="h-[250px] w-full">
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

                        {/* Users Table */}
                        <div className="bg-card-bg border border-border-color rounded-[2rem] overflow-hidden shadow-sm">
                            <div className="p-6 border-b border-border-color flex justify-between items-center bg-accent-dim">
                               <h3 className="text-lg font-bold font-mono tracking-tighter">Registered Users Intelligence</h3>
                            </div>
                            <div className="overflow-x-auto">
                               <table className="w-full text-left text-sm whitespace-nowrap">
                                  <thead className="bg-bg-main/50 text-text-secondary">
                                     <tr>
                                        <th className="px-6 py-4 font-bold tracking-widest uppercase text-[10px]">User ID</th>
                                        <th className="px-6 py-4 font-bold tracking-widest uppercase text-[10px]">Name</th>
                                        <th className="px-6 py-4 font-bold tracking-widest uppercase text-[10px]">Email</th>
                                        <th className="px-6 py-4 font-bold tracking-widest uppercase text-[10px] text-right">Action</th>
                                     </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border-color">
                                     {usersList.map(u => (
                                        <tr key={u.id} className={`transition-colors ${selectedUser === u.id ? 'bg-accent/10' : 'hover:bg-accent-dim'}`}>
                                           <td className="px-6 py-4 font-mono text-xs">{u.id}</td>
                                           <td className="px-6 py-4 font-bold">{u.displayName || "Unknown User"}</td>
                                           <td className="px-6 py-4 text-text-secondary">{u.email}</td>
                                           <td className="px-6 py-4 text-right">
                                               <Button size="sm" variant={selectedUser === u.id ? "primary" : "outline"} onClick={() => { loadUserData(u.id); setInspectorHabit(null); }} className="text-xs px-4 py-1.5 h-auto">
                                                   {selectedUser === u.id ? "Inspecting" : "View Data"}
                                               </Button>
                                           </td>
                                        </tr>
                                     ))}
                                  </tbody>
                               </table>
                            </div>
                        </div>
                    </div>

                    {/* Right Column (User Inspector) */}
                    {selectedUser && (
                        <div className="w-full xl:w-[450px] shrink-0 xl:sticky xl:top-[100px] bg-bg-main border border-border-color/50 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-120px)] animate-in slideInRight">
                            <div className="p-6 border-b border-border-color bg-gradient-to-b from-accent/5 to-transparent relative">
                                <button onClick={() => setSelectedUser(null)} className="absolute top-6 right-6 w-8 h-8 rounded-lg bg-bg-main border border-border-color flex items-center justify-center hover:text-text-primary text-text-secondary transition-all shadow-sm">
                                    <Icon name="x" size={14} />
                                </button>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent mb-2">Data Inspector</p>
                                <h2 className="text-2xl font-bold tracking-tight text-text-primary mb-1">{usersList.find(u => u.id === selectedUser)?.displayName || "Unknown User"}</h2>
                                <p className="text-xs text-text-secondary font-mono">{usersList.find(u => u.id === selectedUser)?.email}</p>
                            </div>

                            {userLoading || !userData || !userStats ? (
                                <div className="p-16 flex flex-col items-center justify-center gap-4 text-text-secondary">
                                    <Icon name="loader" className="animate-spin" size={32} />
                                    <p className="text-xs tracking-widest uppercase font-bold">Querying Profile...</p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                                    {/* Advanced Stats */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-bg-sidebar border border-border-color rounded-xl p-4 shadow-sm">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1">Total Time Spent</p>
                                            <p className="text-xl font-mono font-bold text-text-primary">{userStats.timeSpent}</p>
                                        </div>
                                        <div className="bg-bg-sidebar border border-border-color rounded-xl p-4 shadow-sm">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1">Consistency Rate</p>
                                            <p className="text-xl font-mono font-bold text-success">{userStats.consistencyRate}%</p>
                                        </div>
                                        <div className="bg-bg-sidebar border border-border-color rounded-xl p-4 shadow-sm">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1">Total Log Hits</p>
                                            <p className="text-xl font-mono font-bold text-text-primary">{userStats.totalLogHits}</p>
                                        </div>
                                        <div className="bg-bg-sidebar border border-border-color rounded-xl p-4 shadow-sm">
                                            <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary mb-1">Notes & Reminders</p>
                                            <p className="text-xl font-mono font-bold text-text-primary">{userData.notes.length + userData.reminders.length}</p>
                                        </div>
                                    </div>

                                    {/* Habits & Details */}
                                    <div>
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary mb-4 border-b border-border-color pb-2">Established Habits ({userData.habits.length})</h4>
                                        <div className="space-y-2">
                                            {userData.habits.length > 0 ? userData.habits.map(h => (
                                                <div key={h.id} className="border border-border-color rounded-xl bg-bg-main overflow-hidden shadow-sm">
                                                    <button 
                                                        onClick={() => setInspectorHabit(inspectorHabit === h.id ? null : h.id)} 
                                                        className={`w-full text-left p-4 transition-all flex items-center justify-between ${inspectorHabit === h.id ? 'bg-accent/10 border-b border-accent/20' : 'hover:bg-accent-dim'}`}
                                                    >
                                                        <div>
                                                            <p className="text-sm font-bold text-text-primary mb-1">{h.emoji} {h.name}</p>
                                                            <div className="flex gap-2">
                                                               <span className={`text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded ${h.type === 'Good' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>{h.type}</span>
                                                               <span className="text-[9px] font-mono text-text-secondary px-1.5 py-0.5 rounded bg-white/5 border border-white/10 uppercase">{h.mode}</span>
                                                            </div>
                                                        </div>
                                                        <Icon name={inspectorHabit === h.id ? "chevron-up" : "chevron-down"} size={16} className="text-text-secondary" />
                                                    </button>
                                                    {inspectorHabit === h.id && (
                                                        <div className="p-3 bg-bg-sidebar">
                                                            {(() => {
                                                                const allHabitLogs = (h.logs || []).filter(l => l.entries && l.entries.length > 0)
                                                                    .sort((a,b) => new Date(b.date) - new Date(a.date));
                                                                
                                                                if (allHabitLogs.length === 0) return <p className="text-xs text-text-secondary py-2 text-center">No logs recorded yet.</p>;
                                                                
                                                                return allHabitLogs.map((l, idx) => (
                                                                    <div key={idx} className="mb-4 last:mb-0">
                                                                        <p className="text-[10px] font-mono font-bold tracking-widest text-text-secondary mb-2 bg-black/20 px-2 py-1 rounded inline-block">{new Date(l.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                                        <div className="space-y-1">
                                                                            {l.entries.map((e, i) => {
                                                                                const isPhoto = typeof e === "string" && e.startsWith("data:image");
                                                                                const isCount = typeof e === "string" && e.includes("|") && !isPhoto;
                                                                                let display = "Logged successfully";
                                                                                let logTime = "";
                                                                                if (isPhoto) {
                                                                                    display = "📷 Visual capture attached";
                                                                                } else if (isCount) {
                                                                                    const parts = e.split("|");
                                                                                    logTime = parts[0];
                                                                                    display = `${parts[1]} ${parts[2] || ""}`.trim();
                                                                                } else {
                                                                                    logTime = e;
                                                                                }
                                                                                return (
                                                                                    <div key={i} className="flex justify-between items-center text-xs p-2 rounded-lg bg-bg-main border border-border-color">
                                                                                        <span className="text-text-primary font-medium">{display}</span>
                                                                                        {logTime && <span className="text-[10px] text-text-secondary font-mono bg-black/30 px-1.5 py-0.5 rounded">{logTime}</span>}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    </div>
                                                                ));
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            )) : <p className="text-xs text-text-secondary font-medium">No habits established.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
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
