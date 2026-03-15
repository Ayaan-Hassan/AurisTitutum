import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, collectionGroup, getCountFromServer, onSnapshot, doc, deleteDoc, updateDoc, addDoc } from "firebase/firestore";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { db } from "../firebase.config";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/Button";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { ConfirmModal, RenameModal } from "../components/Modals";
import { useHabitNotifications } from "../hooks/useHabitNotifications";

export default function AdminDashboard() {
    const { user } = useAuth();
    const { addToast } = useHabitNotifications([]);
    const [stats, setStats] = useState(null);
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [selectedUser, setSelectedUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [userLoading, setUserLoading] = useState(false);
    const [inspectorHabit, setInspectorHabit] = useState(null);
    const [subUnsubscribes, setSubUnsubscribes] = useState([]);
    
    const [showOnlineOnly, setShowOnlineOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [pinnedUsers, setPinnedUsers] = useState(() => {
        const saved = localStorage.getItem("admin_pinned_users");
        return saved ? JSON.parse(saved) : [];
    });
    const [activeTab, setActiveTab] = useState("users"); // "users" or "inquiries"
    const [inquiries, setInquiries] = useState([]);

    const [confirmAction, setConfirmAction] = useState(null);
    const [adminMessage, setAdminMessage] = useState(null);
    const [editModal, setEditModal] = useState(null);
    const [liveTick, setLiveTick] = useState(0);

    useEffect(() => {
        localStorage.setItem("admin_pinned_users", JSON.stringify(pinnedUsers));
    }, [pinnedUsers]);

    useEffect(() => {
        const i = setInterval(() => setLiveTick(t => t + 1), 1000);
        return () => clearInterval(i);
    }, []);

    const isUserOnline = (u) => {
        if (!u) return false;
        if (u.isOnline === false) return false;
        if (u.isOnline && !u.lastActive) return true;
        const diff = new Date() - new Date(u.lastActive);
        return diff < 60000 * 2;
    };

    const adminUid = import.meta.env.VITE_ADMIN_UID;
    const isAdmin = user && adminUid && user.uid === adminUid;

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError(null);
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
            setError("Platform analytics mismatch. Protocol authentication failed.");
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
        const unsubInquiries = onSnapshot(collection(db, "inquiries"), (snapshot) => {
            const all = [];
            snapshot.forEach(d => all.push({ id: d.id, ...d.data() }));
            setInquiries(all.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
        });

        fetchStats();
        return () => { unsubUsers(); unsubInquiries(); };
    }, [isAdmin]);

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

    const handleActionConfirm = async () => {
        if (!confirmAction) return;
        const { type, action, id } = confirmAction;

        try {
            if (action === "wipe") {
                const subCollections = ["habits", "notes", "reminders", "logs", "sessions"];
                for (const coll of subCollections) {
                    const q = query(collection(db, "users", id, coll));
                    const snap = await getDocs(q);
                    snap.forEach(d => deleteDoc(d.ref));
                }
                addToast("User data wiped", "info");
            } else if (action === "ban") {
                await updateDoc(doc(db, "users", id), { isBanned: true });
                addToast("User banned", "warning");
            } else if (action === "unban") {
                await updateDoc(doc(db, "users", id), { isBanned: false });
                addToast("User access restored", "success");
            } else if (action === "delete") {
                const collMap = {
                    "habits": "habits",
                    "notes": "notes",
                    "reminders": "reminders",
                    "logs": "logs"
                };
                await deleteDoc(doc(db, "users", selectedUser, collMap[type] || type, id));
                addToast("Entry deleted", "info");
            }

            setConfirmAction(null);
            if (selectedUser) loadUserData(selectedUser);
        } catch (e) {
            addToast(e.message, "error");
        }
    };

    const handleSysMessageSend = async (uid, msg) => {
        if (!msg.trim()) return;
        const { addDoc, collection } = await import("firebase/firestore");
        try {
            await addDoc(collection(db, "users", uid, "systemMessages"), {
                message: msg,
                type: "admin",
                createdAt: new Date().toISOString(),
                read: false
            });
            addToast("Message sent to user", "success");
        } catch (e) {
            addToast(e.message, "error");
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
        (userData.logs || []).forEach(l => {
             if (l.date) activeDates.add(l.date);
             totalLogHits++;
        });
        const consistencyRate = Math.min(100, Math.round((activeDates.size / daysSince) * 100));
        let exactSeconds = info?.exactTimeSpent || 0;
        if (isUserOnline(info) && info.lastActive) {
            exactSeconds += Math.floor((new Date() - new Date(info.lastActive)) / 1000);
        }
        const baseTimeMins = (userData.habits?.length * 15) + (totalLogHits * 2.5) + (userData.notes?.length * 5);
        const totalSeconds = exactSeconds + Math.floor(baseTimeMins * 60);
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = Math.floor(totalSeconds % 60);
        return {
           consistencyRate,
           timeSpent: hours > 0 ? `${hours}h ${mins}m ${secs}s` : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`,
           activeDays: activeDates.size,
           totalLogHits
        };
    }, [userData, usersList, selectedUser, liveTick]);

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center p-10 min-h-[400px]">
                <Icon name="shield-check" size={48} className="text-text-secondary mb-4 opacity-20" />
                <h2 className="text-xl font-bold font-mono uppercase tracking-[0.2em] text-text-primary">Master Authorization Required</h2>
                <p className="text-xs text-text-secondary mt-2 font-mono uppercase">Identity Verification Mismatch. Protocol Denied.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-text-primary">Admin Panel</h2>
                    <p className="text-text-secondary text-[10px] uppercase font-bold tracking-widest mt-1 opacity-60">Control Center / Version 4.1.0</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-card-bg border border-border-color p-1 rounded-xl">
                        <button 
                            onClick={() => setActiveTab("users")}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === "users" ? "bg-accent text-bg-main" : "text-text-secondary hover:text-text-primary"}`}
                        >
                            Users
                        </button>

                    </div>
                    <Button onClick={fetchStats} variant="outline" size="sm" icon="rotate-ccw" className="border-accent/30 text-accent hover:bg-accent/10">Refresh Data</Button>
                </div>
            </div>

            {error ? (
                <div className="p-4 rounded-xl border border-danger/40 bg-danger/10 text-danger text-xs font-mono uppercase flex items-center gap-3">
                    <Icon name="alert-circle" size={16} /> {error}
                </div>
            ) : loading ? (
                <div className="flex items-center gap-3 text-text-secondary text-xs font-mono uppercase py-20 justify-center">
                    <Icon name="loader" className="animate-spin text-accent" size={24} />
                    Calculating network density...
                </div>
            ) : (
                <div className="flex flex-col gap-6 relative animate-in fade-in duration-700">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        <MetricCard title="Total Users" value={usersList.length} icon="user" />
                        <div 
                            onClick={() => setShowOnlineOnly(!showOnlineOnly)}
                            className={`bg-card-bg border ${showOnlineOnly ? 'border-success shadow-[0_0_20px_rgba(var(--success-rgb),0.2)]' : 'border-border-color'} rounded-2xl p-5 flex items-center justify-between transition-all hover:scale-[1.02] shadow-sm cursor-pointer group`}
                        >
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1">Online Now</p>
                                <p className="text-3xl font-mono font-bold text-success flex items-center gap-2">
                                    {usersList.filter(u => isUserOnline(u)).length}
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                                    </span>
                                </p>
                            </div>
                            <div className={`w-10 h-10 rounded-full ${showOnlineOnly ? 'bg-success text-white' : 'bg-success/10 text-success'} flex items-center justify-center transition-colors`}>
                                <Icon name="filter" size={20} />
                            </div>
                        </div>
                        <MetricCard title="Habits Created" value={stats.habits} icon="activity" />
                        <MetricCard title="Reminders Set" value={stats.reminders} icon="bell" />
                        <MetricCard title="Total Notes" value={stats.notes} icon="file-text" />
                    </div>
                    </div>

                    {activeTab === "users" ? (
                    <div className="flex flex-col lg:flex-row gap-6 h-[720px]">
                        <div className="w-full lg:w-80 shrink-0 bg-card-bg border border-border-color rounded-3xl shadow-sm flex flex-col h-full overflow-hidden">
                            <div className="p-5 border-b border-border-color bg-accent-dim shrink-0">
                                <h3 className="font-bold tracking-tight text-sm uppercase mb-3">User Directory</h3>
                                <div className="relative">
                                    <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary opacity-50" />
                                    <input 
                                        type="text" 
                                        placeholder="Search name or email..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-bg-main border border-border-color pl-9 pr-4 py-2 rounded-xl text-xs outline-none focus:border-accent transition-all"
                                    />
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-1 custom-scrollbar">
                                {usersList
                                    .filter(u => showOnlineOnly ? isUserOnline(u) : true)
                                    .filter(u => {
                                        const q = searchQuery.toLowerCase();
                                        return (u.displayName || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
                                    })
                                    .sort((a,b) => {
                                        const aPinned = pinnedUsers.includes(a.id);
                                        const bPinned = pinnedUsers.includes(b.id);
                                        if (aPinned && !bPinned) return -1;
                                        if (!aPinned && bPinned) return 1;
                                        return (isUserOnline(b) ? 1 : 0) - (isUserOnline(a) ? 1 : 0);
                                    })
                                    .map(u => (
                                    <div 
                                        onClick={() => { loadUserData(u.id); setInspectorHabit(null); }} 
                                        key={u.id} 
                                        className={`w-full group/row relative p-4 flex items-center justify-between border-b border-border-color transition-all cursor-pointer ${selectedUser === u.id ? 'bg-accent/10 border-l-[4px] border-l-accent' : 'hover:bg-accent/5 border-l-[4px] border-l-transparent'}`}
                                    >
                                        <div className="min-w-0 pr-2">
                                            <p className="font-bold text-sm text-text-primary truncate flex items-center gap-2">
                                                {u.displayName || "Unknown Identity"}
                                                {u.isBanned && <span className="text-[8px] bg-danger text-white px-1 rounded-sm uppercase font-black">Banned</span>}
                                                {pinnedUsers.includes(u.id) && <Icon name="pin" size={10} className="text-accent" />}
                                            </p>
                                            <p className="text-[10px] text-text-secondary font-mono truncate opacity-60">{u.email}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="hidden group-hover/row:flex items-center gap-1.5 animate-in slide-in-from-right-2 duration-200">
                                                <button onClick={(e) => { e.stopPropagation(); setPinnedUsers(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]); }} title="Pin User" className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border ${pinnedUsers.includes(u.id) ? 'bg-accent/20 text-accent border-accent/40' : 'bg-white/5 text-text-secondary border-border-color hover:border-accent/40'}`}><Icon name="pin" size={12}/></button>
                                                <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: "user", action: "wipe", id: u.id }); }} title="Wipe Data" className="w-7 h-7 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white flex items-center justify-center transition-all border border-danger/20"><Icon name="trash" size={12}/></button>
                                                {u.isBanned ? (
                                                    <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: "user", action: "unban", id: u.id }); }} title="Unban" className="w-7 h-7 rounded-lg bg-success/10 text-success hover:bg-success hover:text-white flex items-center justify-center transition-all border border-success/20"><Icon name="user-check" size={12}/></button>
                                                ) : (
                                                    <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: "user", action: "ban", id: u.id }); }} title="Ban" className="w-7 h-7 rounded-lg bg-danger/10 text-danger hover:bg-danger hover:text-white flex items-center justify-center transition-all border border-danger/20"><Icon name="user-x" size={12}/></button>
                                                )}
                                                <button onClick={(e) => { e.stopPropagation(); setEditModal({ type: "msg", action: "sendMsg", id: u.id, initialValue: "", label: "Message Content" }); }} title="Message" className="w-7 h-7 rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-bg-main flex items-center justify-center transition-all border border-accent/20"><Icon name="mail" size={12}/></button>
                                            </div>
                                            {isUserOnline(u) && <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(var(--success-rgb),0.6)]"></div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 min-w-0 bg-card-bg border border-border-color rounded-3xl shadow-sm flex flex-col h-full overflow-hidden relative">
                            {!selectedUser ? (
                                <div className="flex-1 flex flex-col p-8 overflow-hidden">
                                     <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 select-none">
                                        <Icon name="search" size={48} className="mb-4 text-accent" />
                                        <h3 className="text-xl font-bold tracking-tight mb-2">Select a User</h3>
                                        <p className="text-xs">Choose a person from the list on the left to see their details.</p>
                                    </div>
                                </div>
                            ) : userLoading || !userData || !userStats ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-text-secondary animate-in fade-in">
                                    <Icon name="loader" className="animate-spin text-accent" size={32} />
                                    <p className="text-[10px] tracking-widest uppercase font-black text-accent">Loading Data...</p>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-500">
                                    <div className="p-8 border-b border-border-color bg-gradient-to-br from-accent/5 to-transparent shrink-0">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-14 h-14 rounded-2xl bg-accent text-bg-main flex items-center justify-center font-black text-2xl shadow-xl shadow-accent/20">
                                                {(usersList.find(u => u.id === selectedUser)?.displayName || "U").charAt(0)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="text-[9px] font-black uppercase tracking-[0.3em] text-accent">Selected User</p>
                                                    {isUserOnline(usersList.find(u => u.id === selectedUser)) && <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shadow-[0_0_5px_rgba(var(--success-rgb),0.5)]"></span>}
                                                </div>
                                                <h2 className="text-3xl font-bold tracking-tight text-text-primary leading-none flex items-center gap-3">
                                                    {usersList.find(u => u.id === selectedUser)?.displayName || "Unknown User"}
                                                </h2>
                                            </div>
                                            <button onClick={() => setSelectedUser(null)} className="ml-auto w-10 h-10 rounded-xl bg-bg-main border border-border-color flex items-center justify-center hover:bg-white/10 text-text-secondary transition-all">
                                                <Icon name="x" size={16} />
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-4 text-[10px] font-mono text-text-secondary ml-1 mt-2">
                                            <span className="flex items-center gap-1.5"><Icon name="mail" size={10} /> {usersList.find(u => u.id === selectedUser)?.email}</span>
                                            <span className="opacity-30">|</span>
                                            <span className="flex items-center gap-1.5 font-bold text-accent"><Icon name="hash" size={10} /> {selectedUser}</span>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8 bg-bg-main/50">
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            <StatsCard label="Time Spent" value={userStats.timeSpent} icon="clock" />
                                            <StatsCard label="Consistency" value={`${userStats.consistencyRate}%`} icon="activity" color="text-success" />
                                            <StatsCard label="Total Logs" value={userData.logs?.length || 0} icon="layers" />
                                            <StatsCard label="Habits" value={userData.habits?.length || 0} icon="cpu" />
                                        </div>

                                        <div className="grid lg:grid-cols-2 gap-8 items-start">
                                            <div className="bg-card-bg border border-border-color rounded-2xl p-6 shadow-sm space-y-4">
                                                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary border-b border-border-color pb-3">User Habits</h4>
                                                <div className="space-y-3">
                                                    {userData.habits?.length > 0 ? userData.habits.map(h => (
                                                        <div key={h.id} className={`border rounded-xl overflow-hidden transition-all duration-300 ${inspectorHabit === h.id ? 'border-accent bg-accent/5 ring-1 ring-accent/20' : 'border-border-color bg-bg-main'}`}>
                                                            <div className="p-4 flex items-center justify-between group">
                                                                <div onClick={() => setInspectorHabit(inspectorHabit === h.id ? null : h.id)} className="cursor-pointer flex-1">
                                                                    <p className="text-sm font-bold text-text-primary mb-1">{h.emoji} {h.name}</p>
                                                                    <div className="flex gap-2">
                                                                       <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${h.type === 'Good' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>{h.type}</span>
                                                                       <span className="text-[8px] font-mono font-bold text-text-secondary px-1.5 py-0.5 rounded bg-white/5 uppercase tracking-tighter">{h.mode}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <button onClick={() => setEditModal({ type: "habits", action: "updateHabit", id: h.id, initialValue: h.name, label: "Edit Habit Name" })} className="p-2 rounded-lg bg-accent/10 text-accent hover:bg-accent border border-accent/20 hover:text-bg-main transition-all"><Icon name="edit" size={14} /></button>
                                                                    <button onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: "habits", action: "delete", id: h.id }); }} className="p-2 rounded-lg bg-danger/10 text-danger hover:bg-danger border border-danger/20 hover:text-white transition-all"><Icon name="trash" size={14} /></button>
                                                                    <div onClick={() => setInspectorHabit(inspectorHabit === h.id ? null : h.id)} className="cursor-pointer ml-1">
                                                                        <Icon name={inspectorHabit === h.id ? "chevron-up" : "chevron-down"} size={16} className="text-text-secondary" />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {inspectorHabit === h.id && (
                                                                <div className="p-4 bg-bg-sidebar border-t border-border-color/50 animate-in slide-in-from-top-1">
                                                                    {(() => {
                                                                        const habitLogs = (userData.logs || []).filter(l => l.habitId === h.id).sort((a,b) => new Date(b.date) - new Date(a.date));
                                                                        if (habitLogs.length === 0) return <p className="text-[10px] text-text-secondary py-6 text-center italic opacity-40">No activity logs found for this habit.</p>;
                                                                        const grouped = {};
                                                                        habitLogs.forEach(l => { if (!grouped[l.date]) grouped[l.date] = []; grouped[l.date].push(l); });
                                                                        const sortedDates = Object.keys(grouped).sort((a,b) => new Date(b) - new Date(a));
                                                                        return (
                                                                            <div className="space-y-4 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                                                                                {sortedDates.map((dateStr, idx) => (
                                                                                    <div key={idx} className="relative pl-3 border-l-[1px] border-border-color">
                                                                                        <p className="text-[9px] font-black text-text-secondary opacity-50 mb-2 uppercase tracking-tighter">{dateStr}</p>
                                                                                        <div className="space-y-1.5">
                                                                                            {grouped[dateStr].map((e, i) => (
                                                                                                <div key={i} className="flex justify-between items-center text-[11px] p-2 bg-bg-main/40 rounded-lg border border-border-color/20">
                                                                                                    <span className="font-medium text-text-primary">{e.mode === 'count' ? `${e.amount} ${e.unit || ''}` : e.mode === 'time' ? e.time : 'Logged'}</span>
                                                                                                    <div className="flex gap-2">
                                                                                                        <button onClick={() => {
                                                                                                            if (e.mode === "count") setEditModal({ type: "logs", action: "updateLogAmount", id: e.id, initialValue: String(e.amount), label: "Edit Log Amount" });
                                                                                                            else if (e.mode === "time") setEditModal({ type: "logs", action: "updateLogTime", id: e.id, initialValue: e.time, label: "Edit Log Duration" });
                                                                                                            else setAdminMessage({ type: "info", title: "Notice", body: "This log type cannot be edited here." });
                                                                                                        }} className="text-accent opacity-50 hover:opacity-100 transition-opacity"><Icon name="edit" size={10} /></button>
                                                                                                        <button onClick={() => setConfirmAction({ type: "logs", action: "delete", id: e.id })} className="text-danger opacity-50 hover:opacity-100 transition-opacity"><Icon name="trash" size={10} /></button>
                                                                                                    </div>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )) : <p className="text-xs text-text-secondary text-center py-6">No habits found.</p>}
                                                </div>
                                            </div>

                                            <div className="space-y-6">
                                                <div className="bg-card-bg border border-border-color rounded-2xl p-6 shadow-sm">
                                                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary border-b border-border-color pb-3 mb-4">User Notes ({userData.notes?.length || 0})</h4>
                                                    <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
                                                        {userData.notes?.length > 0 ? userData.notes.map(n => (
                                                            <div key={n.id} className="p-4 bg-bg-sidebar rounded-xl border border-border-color group">
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <p className="text-xs font-bold text-text-primary">{n.title || "Untitled Note"}</p>
                                                                    <div className="flex gap-2">
                                                                        <button onClick={() => setEditModal({ type: "notes", action: "updateNote", id: n.id, initialValue: n.body, label: "Edit Note Body" })} className="opacity-0 group-hover:opacity-100 text-accent transition-all"><Icon name="edit" size={12} /></button>
                                                                        <button onClick={() => setConfirmAction({ type: "notes", action: "delete", id: n.id })} className="opacity-0 group-hover:opacity-100 text-danger transition-all"><Icon name="trash" size={12} /></button>
                                                                    </div>
                                                                </div>
                                                                <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-3">{n.body}</p>
                                                            </div>
                                                        )) : <p className="text-[10px] text-text-secondary text-center">No notes written.</p>}
                                                    </div>
                                                </div>

                                                <div className="bg-card-bg border border-border-color rounded-2xl p-6 shadow-sm">
                                                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary border-b border-border-color pb-3 mb-4">User Reminders ({userData.reminders?.length || 0})</h4>
                                                    <div className="space-y-3 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
                                                        {userData.reminders?.length > 0 ? userData.reminders.map(r => (
                                                            <div key={r.id} className="p-4 bg-bg-sidebar rounded-xl border border-border-color flex items-center justify-between">
                                                                <p className="text-xs font-bold text-text-primary">{r.title}</p>
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-[10px] font-mono text-accent bg-accent/10 px-2 py-1 rounded">{r.time}</span>
                                                                    <div className="flex gap-2">
                                                                        <button onClick={() => setEditModal({ type: "reminders", action: "updateReminder", id: r.id, initialValue: r.time, label: "Edit Reminder Time" })} className="text-accent"><Icon name="edit" size={12} /></button>
                                                                        <button onClick={() => setConfirmAction({ type: "reminders", action: "delete", id: r.id })} className="text-danger"><Icon name="trash" size={12} /></button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )) : <p className="text-[10px] text-text-secondary text-center">No reminders set.</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    ) : null }

                    <div className="h-64 bg-card-bg border border-border-color rounded-3xl p-8 shadow-sm">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4">User Growth (Last 30 Days)</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={graphData}>
                                <defs>
                                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.2} />
                                <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '12px' }}
                                    itemStyle={{ color: 'var(--accent)', fontSize: '12px', fontWeight: 'bold' }}
                                />
                                <Area type="monotone" dataKey="users" stroke="var(--accent)" fillOpacity={1} fill="url(#colorUsers)" strokeWidth={3} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between border-b border-border-color pb-4">
                            <h3 className="text-lg font-bold tracking-tight text-text-primary">System Inquiries</h3>
                            <div className="px-3 py-1 bg-accent/10 border border-accent/20 rounded-full text-[10px] font-black text-accent uppercase tracking-widest">
                                {inquiries.filter(i => i.status === "pending").length} Pending Requests
                            </div>
                        </div>
                         <div className="grid grid-cols-1 gap-4">
                            {inquiries.length > 0 ? inquiries.map(inq => (
                                <div key={inq.id} className="bg-card-bg border border-border-color p-6 rounded-[2rem] shadow-sm flex flex-col md:flex-row gap-6 relative group">
                                    <div className="shrink-0 flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${inq.priority === 'High' ? 'bg-danger/20 text-danger' : inq.priority === 'Normal' ? 'bg-accent/20 text-accent' : 'bg-success/20 text-success'}`}>{inq.priority}</span>
                                            <span className="text-[10px] font-black uppercase px-2 py-1 bg-white/5 text-text-secondary rounded-lg">{inq.topic}</span>
                                        </div>
                                        <p className="text-xs font-bold text-text-primary mt-1">{inq.name}</p>
                                        <p className="text-[10px] text-text-secondary font-mono">{inq.email}</p>
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-sm text-text-primary mb-2">{inq.subject}</h4>
                                        <p className="text-xs text-text-secondary leading-relaxed bg-bg-main/50 p-4 rounded-2xl border border-border-color/50">{inq.message}</p>
                                        <div className="mt-4 flex items-center justify-between">
                                            <p className="text-[10px] text-text-secondary opacity-50 flex items-center gap-2"><Icon name="clock" size={10}/> {new Date(inq.createdAt).toLocaleString()}</p>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={async () => {
                                                        await updateDoc(doc(db, "inquiries", inq.id), { status: inq.status === 'pending' ? 'resolved' : 'pending' });
                                                    }}
                                                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${inq.status === 'resolved' ? 'bg-success text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
                                                >
                                                    {inq.status === 'resolved' ? 'Resolved' : 'Mark Resolved'}
                                                </button>
                                                <button 
                                                    onClick={() => setConfirmAction({ type: "inquiry", action: "delete", id: inq.id })}
                                                    className="w-10 h-10 rounded-xl bg-danger/10 text-danger hover:bg-danger hover:text-white flex items-center justify-center transition-all border border-danger/20"
                                                >
                                                    <Icon name="trash" size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-20 flex flex-col items-center justify-center opacity-30">
                                    <Icon name="mail" size={48} className="mb-4 text-accent" />
                                    <p className="font-bold uppercase tracking-widest text-xs">No pending inquiries.</p>
                                </div>
                            )}
                         </div>
                    </div>
                </div>

            )}

            {/* Simple Confirmation Modal */}
            {confirmAction && (
                <ConfirmModal 
                    title="Are you sure?"
                    message={
                        confirmAction.action === "wipe" ? "This will delete all data for this user forever." :
                        confirmAction.action === "ban" ? "This user will not be able to log in anymore." :
                        confirmAction.action === "unban" ? "This will let the user log in again." :
                        `Do you want to delete this ${confirmAction.type} entry?`
                    }
                    onConfirm={handleActionConfirm}
                    onCancel={() => setConfirmAction(null)}
                    variant={confirmAction.action === "unban" ? "success" : "danger"}
                    confirmLabel="Yes, Proceed"
                />
            )}

            {/* Edit Modal (Executes directly for less friction) */}
            {editModal && (
                <RenameModal 
                    title={editModal.label}
                    label={editModal.label}
                    initialValue={editModal.initialValue}
                    onConfirm={async (val) => {
                        const { type, action, id } = editModal;
                        try {
                            if (type === "msg") await handleSysMessageSend(id, val);
                            else if (action === "updateHabit") {
                                await updateDoc(doc(db, "users", selectedUser, "habits", id), { name: val, adminModified: true, modifiedAt: new Date().toISOString() });
                            } else if (action === "updateNote") {
                                await updateDoc(doc(db, "users", selectedUser, "notes", id), { body: val, adminModified: true, modifiedAt: new Date().toISOString() });
                            } else if (action === "updateReminder") {
                                await updateDoc(doc(db, "users", selectedUser, "reminders", id), { time: val, adminModified: true, modifiedAt: new Date().toISOString() });
                            } else if (action === "updateLogAmount") {
                                await updateDoc(doc(db, "users", selectedUser, "logs", id), { amount: Number(val), adminModified: true, modifiedAt: new Date().toISOString() });
                            } else if (action === "updateLogTime") {
                                await updateDoc(doc(db, "users", selectedUser, "logs", id), { time: val, adminModified: true, modifiedAt: new Date().toISOString() });
                            }
                            addToast("Changes saved successfully", "success");
                        } catch(e) {
                            addToast(e.message, "error");
                        }
                        setEditModal(null);
                    }}
                    onCancel={() => setEditModal(null)}
                />
            )}

            {/* Success/Error Feedback Modal */}
            {adminMessage && (
                <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex justify-center items-center p-4">
                    <div className="bg-card-bg border border-border-color p-8 rounded-3xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200 text-center border-t-4" style={{ borderColor: adminMessage.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>
                        <div className={`w-16 h-16 rounded-2xl mx-auto mb-6 flex items-center justify-center ${adminMessage.type === 'error' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                            <Icon name={adminMessage.type === 'error' ? 'alert-triangle' : 'check-circle'} size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-text-primary mb-2 tracking-tighter uppercase italic">{adminMessage.title}</h3>
                        <p className="text-xs text-text-secondary mb-8 font-mono leading-relaxed">{adminMessage.body}</p>
                        <Button onClick={() => setAdminMessage(null)} className="w-full bg-accent text-bg-main font-black uppercase tracking-widest h-12 rounded-xl">Acknowledged</Button>
                    </div>
                </div>
            )}
        </div>
    );
}

const MetricCard = ({ title, value, icon }) => (
    <Card className="p-5 flex items-center justify-between hover:scale-[1.02] transition-all bg-card-bg border-border-color shadow-sm cursor-default group overflow-hidden relative">
        <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 blur-3xl pointer-events-none group-hover:bg-accent/10 transition-colors" />
        <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1 opacity-70 group-hover:opacity-100 transition-opacity">{title}</p>
            <p className="text-3xl font-mono font-bold text-text-primary tracking-tighter">{value}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center group-hover:bg-accent group-hover:text-bg-main transition-all shadow-sm">
            <Icon name={icon} size={20} />
        </div>
    </Card>
);

const StatsCard = ({ label, value, icon, color = "text-text-primary" }) => (
    <div className="p-4 bg-bg-sidebar rounded-2xl border border-border-color/50 flex flex-col items-center justify-center text-center group hover:border-accent/30 transition-all shadow-sm">
        <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center mb-2 text-text-secondary group-hover:text-accent group-hover:bg-accent/10 transition-all`}>
            <Icon name={icon} size={16} />
        </div>
        <p className="text-[9px] font-black uppercase tracking-widest text-text-secondary opacity-60 mb-1">{label}</p>
        <p className={`text-sm font-mono font-bold ${color}`}>{value}</p>
    </div>
);
