import { useState, useEffect } from "react";
import { collection, getDocs, collectionGroup, getCountFromServer } from "firebase/firestore";
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
                notes: notesSnapshot.data().count,
                dau: "Check PostHog for exact DAU",
                sheets: "N/A"
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
            const logsSnap = await getDocs(collection(db, "users", uid, "logs"));

            setUserData({
                habits: habitsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                notes: notesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                reminders: remindersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                logs: logsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
            });
        } catch(err) {
            console.error("Error loading user data:", err);
        }
        setUserLoading(false);
    };

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
                    <Icon name="loader" className="animate-spin" />
                    Aggregating nodes...
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <MetricCard title="Total Users" value={stats.users} icon="user" />
                        <MetricCard title="Habits Created" value={stats.habits} icon="activity" />
                        <MetricCard title="Reminders" value={stats.reminders} icon="bell" />
                        <MetricCard title="Notes" value={stats.notes} icon="file-text" />
                        <MetricCard title="Sheets Connected" value={stats.sheets} icon="file-spreadsheet" />
                        <MetricCard title="Active Today" value={stats.dau} icon="trending-up" />
                    </div>

                    <div className="mt-8 bg-card-bg border border-border-color rounded-2xl overflow-hidden shadow-sm">
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
                                    <tr key={u.id} className="hover:bg-accent-dim transition-colors">
                                       <td className="px-6 py-4 font-mono text-xs">{u.id}</td>
                                       <td className="px-6 py-4 font-bold">{u.displayName || "Unknown User"}</td>
                                       <td className="px-6 py-4 text-text-secondary">{u.email}</td>
                                       <td className="px-6 py-4 text-right">
                                           <Button size="sm" variant="outline" onClick={() => loadUserData(u.id)} className="text-xs px-4 py-1.5 h-auto">View Data</Button>
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                    </div>
                </>
            )}

            {selectedUser && (
                <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setSelectedUser(null)}>
                    <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto custom-scrollbar bg-bg-main rounded-3xl border border-border-color shadow-2xl p-6 sm:p-8 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-8 pb-6 border-b border-border-color">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-accent mb-2">User Data Inspector</p>
                                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1">{usersList.find(u => u.id === selectedUser)?.displayName || "Unknown User"}</h2>
                                <p className="text-xs text-text-secondary font-mono">{usersList.find(u => u.id === selectedUser)?.email} | ID: {selectedUser}</p>
                            </div>
                            <button onClick={() => setSelectedUser(null)} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all text-text-secondary">
                                <Icon name="x" size={16} />
                            </button>
                        </div>

                        {userLoading ? (
                            <div className="py-24 flex flex-col items-center justify-center gap-4 text-text-secondary">
                                <Icon name="loader" className="animate-spin" size={32} />
                                <p className="text-xs tracking-widest uppercase font-bold">Querying infrastructure...</p>
                            </div>
                        ) : userData ? (
                            <div className="space-y-8">
                                {/* Dashboard Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="p-5 rounded-2xl bg-accent-dim border border-border-color flex flex-col justify-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2 flex items-center gap-2"><Icon name="activity" size={14}/> Habits</p>
                                        <p className="text-3xl font-mono font-bold text-text-primary">{userData.habits?.length || 0}</p>
                                    </div>
                                    <div className="p-5 rounded-2xl bg-accent-dim border border-border-color flex flex-col justify-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2 flex items-center gap-2"><Icon name="check-circle" size={14}/> Log Events</p>
                                        <p className="text-3xl font-mono font-bold text-text-primary">{userData.logs?.length || 0}</p>
                                    </div>
                                    <div className="p-5 rounded-2xl bg-accent-dim border border-border-color flex flex-col justify-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2 flex items-center gap-2"><Icon name="file-text" size={14}/> Notes</p>
                                        <p className="text-3xl font-mono font-bold text-text-primary">{userData.notes?.length || 0}</p>
                                    </div>
                                    <div className="p-5 rounded-2xl bg-accent-dim border border-border-color flex flex-col justify-center">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2 flex items-center gap-2"><Icon name="bell" size={14}/> Reminders</p>
                                        <p className="text-3xl font-mono font-bold text-text-primary">{userData.reminders?.length || 0}</p>
                                    </div>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    {/* Habits */}
                                    <div className="p-5 sm:p-6 rounded-3xl border border-border-color bg-bg-sidebar">
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary mb-4 border-b border-border-color pb-3">Constructed Habits</h4>
                                        <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                            {userData.habits?.length > 0 ? userData.habits.map(h => (
                                                <div key={h.id} className="p-4 bg-bg-main rounded-2xl border border-border-color flex items-center justify-between group hover:border-text-secondary transition-colors">
                                                    <div>
                                                        <p className="text-sm font-bold text-text-primary mb-1">{h.emoji} {h.name}</p>
                                                        <div className="flex gap-2">
                                                           <span className={`text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-md ${h.type === 'Good' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>{h.type}</span>
                                                           <span className="text-[9px] font-mono text-text-secondary px-2 py-0.5 rounded-md bg-white/5 border border-white/10 uppercase">{h.mode}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )) : <p className="text-xs text-text-secondary font-medium">No habits established.</p>}
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    <div className="p-5 sm:p-6 rounded-3xl border border-border-color bg-bg-sidebar">
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary mb-4 border-b border-border-color pb-3">Written Notes</h4>
                                        <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                            {userData.notes?.length > 0 ? userData.notes.map(n => (
                                                <div key={n.id} className="p-4 bg-bg-main rounded-2xl border border-border-color hover:border-text-secondary transition-colors">
                                                    <div className="flex items-center gap-2 mb-2">
                                                       {n.pinned && <Icon name="pin" size={12} className="text-accent" />}
                                                       <p className="text-sm font-bold text-text-primary truncate">{n.title || "Untitled"}</p>
                                                    </div>
                                                    <p className="text-xs text-text-secondary truncate font-medium">{n.body || "No content"}</p>
                                                </div>
                                            )) : <p className="text-xs text-text-secondary font-medium">No notes written.</p>}
                                        </div>
                                    </div>
                                    
                                    {/* Reminders */}
                                    <div className="p-5 sm:p-6 rounded-3xl border border-border-color bg-bg-sidebar">
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary mb-4 border-b border-border-color pb-3">Scheduled Reminders</h4>
                                        <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                            {userData.reminders?.length > 0 ? userData.reminders.map(r => (
                                                <div key={r.id} className="p-4 bg-bg-main rounded-2xl border border-border-color flex flex-col hover:border-text-secondary transition-colors">
                                                    <div className="flex justify-between items-start mb-2">
                                                       <p className="text-sm font-bold text-text-primary pr-4">{r.title}</p>
                                                       <span className="text-[10px] font-mono text-accent bg-accent/10 px-2 py-1 rounded-lg whitespace-nowrap">{r.time}</span>
                                                    </div>
                                                    {r.date && <p className="text-xs text-text-secondary mt-1 max-w-[80%] truncate">{new Date(r.date).toLocaleDateString()}</p>}
                                                </div>
                                            )) : <p className="text-xs text-text-secondary font-medium">No reminders set.</p>}
                                        </div>
                                    </div>

                                    {/* Logs */}
                                    <div className="p-5 sm:p-6 rounded-3xl border border-border-color bg-bg-sidebar">
                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary mb-4 border-b border-border-color pb-3">Raw Log Activity</h4>
                                        <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                            {userData.logs?.length > 0 ? userData.logs.map(l => (
                                                <div key={l.id} className="p-4 bg-bg-main rounded-2xl border border-border-color flex justify-between items-center hover:border-text-secondary transition-colors">
                                                    <p className="text-sm font-bold text-text-primary">{new Date(l.createdAt || l.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                    <div className="flex gap-2 items-center">
                                                       <span className="text-xs text-text-secondary font-mono bg-white/5 border border-white/10 px-2 py-1 rounded-md">{l.entries?.length || 0} hits</span>
                                                    </div>
                                                </div>
                                            )) : <p className="text-xs text-text-secondary font-medium">No recorded log events.</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
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
