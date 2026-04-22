import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, collectionGroup, getCountFromServer, onSnapshot, doc, deleteDoc, updateDoc, addDoc, query } from "firebase/firestore";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, BarChart, Bar } from 'recharts';
import { db } from "../firebase.config";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/Button";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { ConfirmModal, RenameModal } from "../components/Modals";
import { useHabitNotifications } from "../hooks/useHabitNotifications";

const SurveillanceMonitor = ({ userId }) => {
    const [liveData, setLiveData] = useState(null);

    useEffect(() => {
        if (!userId) return;
        const unsub = onSnapshot(doc(db, "users", userId), (snap) => {
            if (snap.exists()) {
                setLiveData(snap.data());
            }
        });
        return () => unsub();
    }, [userId]);

    if (!liveData) return (
        <div className="bg-black/95 border border-white/5 rounded-3xl p-12 flex flex-col items-center justify-center gap-4 animate-pulse">
            <Icon name="loader-2" size={32} className="text-white/20 animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Initialising uplink...</p>
        </div>
    );

    const diff = (new Date() - new Date(liveData.lastLivePulse || 0)) / 1000;
    const isActive = liveData.liveFrame && diff < 30; // 30s buffer for safety

    return (
        <div className="bg-black/95 border border-success/30 rounded-3xl p-4 sm:p-6 relative overflow-hidden animate-in fade-in zoom-in duration-500 shadow-2xl shadow-success/10 group ring-1 ring-white/5">
            <div className="absolute top-4 left-6 flex items-center gap-2 z-10 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-full border border-white/10 shadow-lg">
                <span className="relative flex h-2.5 w-2.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isActive ? 'bg-danger' : 'bg-white/20'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isActive ? 'bg-danger' : 'bg-white/20'}`}></span>
                </span>
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white">Orbital Feed / Live</span>
            </div>
            
            <div className="absolute top-4 right-6 flex flex-col items-end gap-1.5 z-10 bg-black/60 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 shadow-lg">
                <span className="text-[9px] font-mono text-white/50 uppercase tracking-widest flex items-center gap-2">
                    <Icon name="shield-check" size={10} className="text-success/50"/>
                    End-to-End Encrypted
                </span>
                {liveData.lastLivePulse && (
                    <span className={`text-[9px] font-mono font-bold uppercase flex items-center gap-2 ${diff < 5 ? 'text-success' : 'text-danger/80'}`}>
                        {diff < 5 ? (
                            <><Icon name="zap" size={10} className="animate-pulse"/> High Fidelity (640p)</>
                        ) : (
                            <><Icon name="alert-triangle" size={10}/> Data Stale: ${Math.floor(diff)}s</>
                        )}
                    </span>
                )}
            </div>
            
            <div className="aspect-video w-full max-w-5xl mx-auto rounded-2xl overflow-hidden bg-bg-sidebar border border-white/10 relative shadow-[inset_0_0_100px_rgba(0,0,0,0.9)]">
                {isActive ? (
                    <img 
                        src={liveData.liveFrame} 
                        className="w-full h-full object-contain bg-black" 
                        alt="Live Surveillance Feed"
                    />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-white/5">
                        <div className="relative">
                            <Icon name="video-off" size={80} className="opacity-20 translate-y-2" />
                            <Icon name="wifi-off" size={40} className="absolute -top-2 -right-4 text-danger/30" />
                        </div>
                        <div className="text-center space-y-2">
                            <p className="text-[11px] font-black uppercase tracking-[0.4em] text-white/20">Signal Interrupted</p>
                            <p className="text-[9px] uppercase tracking-widest text-white/10 max-w-[280px]">Ensure user is active on the console and camera permissions are granted.</p>
                        </div>
                    </div>
                )}
                {/* HUD Elements */}
                <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                    <div className="flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-[8px] font-mono text-white/30 uppercase">Uplink: Primary-Alpha</p>
                            <p className="text-[8px] font-mono text-white/30 uppercase">COORD: 51.5074 N, 0.1278 W</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-mono text-success/60 font-bold uppercase tracking-widest">Active Stream</p>
                            <p className="text-[8px] font-mono text-white/30 uppercase">Rate: 2.5 FPS</p>
                        </div>
                    </div>
                </div>
                {/* CRT / Scanline Effect - More subtle */}
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_3px,2px_100%] opacity-20"></div>
                {/* Corner Accents */}
                <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-white/10 rounded-tl-sm pointer-events-none"></div>
                <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-white/10 rounded-tr-sm pointer-events-none"></div>
                <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-white/10 rounded-bl-sm pointer-events-none"></div>
                <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-white/10 rounded-br-sm pointer-events-none"></div>
            </div>
        </div>
    );
};

export default function AdminDashboard() {
    const { user } = useAuth();
    const { addToast } = useHabitNotifications([]);
    const [stats, setStats] = useState({ users: 0, habits: 0, reminders: 0, notes: 0 });
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [selectedUser, setSelectedUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [userLoading, setUserLoading] = useState(false);
    const [inspectorHabit, setInspectorHabit] = useState(null);
    const [subUnsubscribes, setSubUnsubscribes] = useState([]);
    
    const [pinnedUsers, setPinnedUsers] = useState(() => {
        const saved = localStorage.getItem("admin_pinned_users");
        return saved ? JSON.parse(saved) : [];
    });
    const [showOnlineOnly, setShowOnlineOnly] = useState(() => localStorage.getItem("admin_show_online") === "true");
    const [showBannedOnly, setShowBannedOnly] = useState(() => localStorage.getItem("admin_show_banned") === "true");
    const [graphRange, setGraphRange] = useState(() => localStorage.getItem("admin_graph_range") || "30d");
    const [graphType, setGraphType] = useState(() => localStorage.getItem("admin_graph_type") || "area");
    const [searchQuery, setSearchQuery] = useState("");
    const [ageFilter, setAgeFilter] = useState({ min: "", max: "" });
    const [activeTab, setActiveTab] = useState("users");
    const [inquiries, setInquiries] = useState([]);

    const [confirmAction, setConfirmAction] = useState(null);
    const [adminMessage, setAdminMessage] = useState(null);
    const [editModal, setEditModal] = useState(null);
    const [liveTick, setLiveTick] = useState(0);
    const [zoomedImg, setZoomedImg] = useState(null);

    const [showRangeDropdown, setShowRangeDropdown] = useState(false);
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const [createComplex, setCreateComplex] = useState(null);
    const [guestOnlineCount, setGuestOnlineCount] = useState(0);

    useEffect(() => {
        localStorage.setItem("admin_pinned_users", JSON.stringify(pinnedUsers));
    }, [pinnedUsers]);

    useEffect(() => {
        localStorage.setItem("admin_show_online", showOnlineOnly);
    }, [showOnlineOnly]);

    useEffect(() => {
        localStorage.setItem("admin_show_banned", showBannedOnly);
    }, [showBannedOnly]);

    useEffect(() => {
        localStorage.setItem("admin_graph_range", graphRange);
    }, [graphRange]);

    useEffect(() => {
        localStorage.setItem("admin_graph_type", graphType);
    }, [graphType]);

    useEffect(() => {
        const i = setInterval(() => setLiveTick(t => t + 1), 1000);
        return () => clearInterval(i);
    }, []);

    const isUserOnline = (u) => {
        if (!u) return false;
        if (u.isOnline === false) return false;
        if (u.isOnline && !u.lastActive) return true;
        const diff = new Date() - new Date(u.lastActive);
        return diff < 75000;
    };

    const adminUid = (import.meta.env.VITE_ADMIN_UID || "").replace(/['"]/g, '').trim();
    const isAdmin = user && adminUid && user.uid?.trim() === adminUid;

    const fetchStats = async () => {
        try {
            setLoading(true);
            setError(null);
            const [usersSnapshot, remindersSnapshot, notesSnapshot] = await Promise.all([
                getCountFromServer(collection(db, "users")),
                getCountFromServer(collectionGroup(db, "reminders")),
                getCountFromServer(collectionGroup(db, "notes"))
            ]);

            setStats(prev => ({
                ...prev,
                users: usersSnapshot.data().count,
                reminders: remindersSnapshot.data().count,
                notes: notesSnapshot.data().count
            }));
            setLoading(false);
        } catch (err) {
            console.error(err);
            // Don't show total error for background stats
        }
        setLoading(false);
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
        const unsubGuests = onSnapshot(collection(db, "guest_presence"), (snapshot) => {
            let count = 0;
            const threshold = 60000;
            const now = new Date();
            snapshot.forEach(d => {
                const data = d.data();
                const lastActive = data.lastActive;
                // Stricter check: must be within threshold AND not explicitly flagged as offline
                if (lastActive && (now - new Date(lastActive)) < threshold && data.isOnline !== false) {
                    count++;
                }
            });
            setGuestOnlineCount(count);
        });

        const unsubHabits = onSnapshot(query(collectionGroup(db, "habits")), (snapshot) => {
            // Recalculate accurately on any change, only counting real user habits
            let total = 0;
            snapshot.forEach(doc => {
                if (doc.ref.path.startsWith('users/')) {
                    total++;
                }
            });
            setStats(prev => ({ ...prev, habits: total }));
        });

        const unsubReminders = onSnapshot(query(collectionGroup(db, "reminders")), (snapshot) => {
            setStats(prev => ({ ...prev, reminders: snapshot.size }));
        });

        const unsubNotes = onSnapshot(query(collectionGroup(db, "notes")), (snapshot) => {
            setStats(prev => ({ ...prev, notes: snapshot.size }));
        });

        fetchStats();
        return () => { 
            unsubUsers(); 
            unsubInquiries(); 
            unsubGuests(); 
            unsubHabits(); 
            unsubReminders(); 
            unsubNotes(); 
        };
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
                await updateDoc(doc(db, "users", id), { isWiped: true });
                addToast("User data wiped", "info");
            } else if (action === "ban") {
                await updateDoc(doc(db, "users", id), { isBanned: true });
                addToast("User banned", "warning");
            } else if (action === "unban") {
                await updateDoc(doc(db, "users", id), { isBanned: false, isWiped: false });
                addToast("User access restored", "success");
            } else if (action === "delete") {
                if (type === "inquiry") {
                    await deleteDoc(doc(db, "inquiries", id));
                } else if (type === "user") {
                    await deleteDoc(doc(db, "users", id));
                } else {
                    const collMap = {
                        "habits": "habits",
                        "notes": "notes",
                        "reminders": "reminders",
                        "logs": "logs"
                    };
                    await deleteDoc(doc(db, "users", selectedUser, collMap[type] || type, id));
                }
                addToast(`${type.charAt(0).toUpperCase() + type.slice(1)} deleted`, "info");
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
        const hourCounts = {};
        const now = new Date();

        usersList.forEach(u => {
            const d = u.createdAt ? new Date(u.createdAt) : new Date();
            const dateK = d.toISOString().split('T')[0];
            const hourK = d.getHours();
            dateCounts[dateK] = (dateCounts[dateK] || 0) + 1;
            if (d.toDateString() === now.toDateString()) {
                hourCounts[hourK] = (hourCounts[hourK] || 0) + 1;
            }
        });

        const data = [];
        if (graphRange === "24h") {
            for (let i = 0; i < 24; i++) {
                data.push({ name: `${i}:00`, users: hourCounts[i] || 0 });
            }
        } else {
            const days = graphRange === "7d" ? 7 : graphRange === "30d" ? 30 : 90;
            for (let i = days - 1; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const k = d.toISOString().split('T')[0];
                const display = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                data.push({ name: display, users: dateCounts[k] || 0 });
            }
        }
        return data;
    }, [usersList, graphRange]);

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
                    <Button onClick={fetchStats} variant="outline" size="sm" icon="rotate-ccw" className="border-accent/30 text-accent hover:bg-accent/10">Refresh Data</Button>
                </div>
            </div>

            {error ? (
                <div className="p-4 rounded-xl border border-danger/40 bg-danger/10 text-danger text-xs font-mono uppercase flex items-center gap-3">
                    <Icon name="alert-circle" size={16} /> {error}
                </div>
            ) : loading ? (
                <div className="flex items-center gap-3 text-text-secondary text-xs font-mono uppercase py-20 justify-center">
                    <Icon name="loader-2" className="animate-spin text-accent" size={24} />
                    Calculating network density...
                </div>
            ) : (
                <div className="flex flex-col gap-6 relative animate-in fade-in duration-700">
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        <MetricCard title="Total Users" value={usersList.length} icon="user" />
                        <MetricCard 
                            title="Online Now" 
                            value={usersList.filter(u => isUserOnline(u)).length + guestOnlineCount} 
                            icon="activity" 
                            color="text-success"
                            indicator={<span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span></span>}
                        />
                        <MetricCard title="Habits Created" value={stats.habits} icon="activity" />
                        <MetricCard title="Reminders Set" value={stats.reminders} icon="bell" />
                        <MetricCard title="Total Notes" value={stats.notes} icon="file-text" />
                    </div>

                    {activeTab === "users" ? (
                    <div className="flex flex-col lg:flex-row gap-6 h-[720px]">
                        <div className="w-full lg:w-80 shrink-0 bg-card-bg border border-border-color rounded-3xl shadow-sm flex flex-col h-full overflow-hidden">
                            <div className="p-5 border-b border-border-color bg-accent-dim shrink-0">
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-bold tracking-tight text-sm uppercase">User Directory</h3>
                                    <div className="flex gap-1">
                                        <button 
                                            onClick={() => { setShowOnlineOnly(!showOnlineOnly); if (!showOnlineOnly) setShowBannedOnly(false); }}
                                            className={`p-2 rounded-lg border transition-all ${showOnlineOnly ? 'bg-success text-white border-success' : 'bg-white/5 text-text-secondary border-border-color hover:border-accent/40'}`}
                                            title="Online Users"
                                        >
                                            <Icon name="activity" size={14} />
                                        </button>
                                        <button 
                                            onClick={() => { setShowBannedOnly(!showBannedOnly); if (!showBannedOnly) setShowOnlineOnly(false); }}
                                            className={`p-2 rounded-lg border transition-all ${showBannedOnly ? 'bg-danger text-white border-danger shadow-lg shadow-danger/20' : 'bg-white/5 text-danger border-border-color hover:border-danger/40'}`}
                                            title="Banned Users"
                                        >
                                            <Icon name="user-x" size={14} />
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="relative">
                                        <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary opacity-50" />
                                        <input 
                                            type="text" 
                                            placeholder="Search..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-bg-main border border-border-color pl-9 pr-4 py-2 rounded-xl text-xs outline-none focus:border-accent transition-all"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <input 
                                                type="number" 
                                                placeholder="Min Age" 
                                                className="w-full bg-bg-main border border-border-color p-2 rounded-xl text-[10px] outline-none focus:border-accent transition-all"
                                                value={ageFilter.min}
                                                onChange={(e) => setAgeFilter(prev => ({ ...prev, min: e.target.value }))}
                                            />
                                        </div>
                                        <span className="text-text-secondary text-[10px]">-</span>
                                        <div className="relative flex-1">
                                            <input 
                                                type="number" 
                                                placeholder="Max Age" 
                                                className="w-full bg-bg-main border border-border-color p-2 rounded-xl text-[10px] outline-none focus:border-accent transition-all"
                                                value={ageFilter.max}
                                                onChange={(e) => setAgeFilter(prev => ({ ...prev, max: e.target.value }))}
                                            />
                                        </div>
                                        {(ageFilter.min || ageFilter.max) && (
                                            <button 
                                                onClick={() => setAgeFilter({ min: "", max: "" })}
                                                className="p-1 text-accent hover:text-white transition-colors"
                                            >
                                                <Icon name="x-circle" size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="overflow-y-auto flex-1 custom-scrollbar">
                                {usersList
                                    .filter(u => {
                                        if (showOnlineOnly) return isUserOnline(u);
                                        if (showBannedOnly) return u.isBanned;
                                        return true;
                                    })
                                    .filter(u => {
                                        const age = parseInt(u.age);
                                        const minAge = ageFilter.min ? parseInt(ageFilter.min) : 0;
                                        const maxAge = ageFilter.max ? parseInt(ageFilter.max) : Infinity;
                                        const matchesAge = isNaN(age) ? (!ageFilter.min && !ageFilter.max) : (age >= minAge && age <= maxAge);
                                        return matchesAge;
                                    })
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
                                                {u.isBanned && <span className="text-[9px] text-danger border border-danger/30 px-1.5 rounded-md uppercase font-black bg-danger/5">Banned</span>}
                                                {pinnedUsers.includes(u.id) && <Icon name="pin" size={10} className="text-accent" />}
                                            </p>
                                            <p className="text-[10px] text-text-secondary font-mono truncate opacity-60">{u.email}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                             <div className="hidden group-hover/row:flex items-center gap-1.5 animate-in slide-in-from-right-2 duration-200">
                                                 <button onClick={(e) => { e.stopPropagation(); setPinnedUsers(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id]); }} title="Pin User" className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all border ${pinnedUsers.includes(u.id) ? 'bg-accent/20 text-accent border-accent/40' : 'bg-white/5 text-text-secondary border-border-color hover:border-accent/40'} hover:scale-110 active:scale-90`}><Icon name="pin" size={12}/></button>

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
                                    <Icon name="loader-2" className="animate-spin text-accent" size={32} />
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
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-wrap gap-4 text-[10px] font-mono text-text-secondary ml-1 mt-2">
                                                <span className="flex items-center gap-1.5"><Icon name="mail" size={10} /> {usersList.find(u => u.id === selectedUser)?.email}</span>
                                                {usersList.find(u => u.id === selectedUser)?.age && (
                                                    <span className="flex items-center gap-1.5 text-accent"><Icon name="calendar" size={10} /> {usersList.find(u => u.id === selectedUser).age} Years</span>
                                                )}
                                                {usersList.find(u => u.id === selectedUser)?.gender && (
                                                    <span className="flex items-center gap-1.5 text-accent uppercase"><Icon name="user" size={10} /> {usersList.find(u => u.id === selectedUser).gender}</span>
                                                )}
                                                <span className="opacity-30">|</span>
                                                <span className="flex items-center gap-1.5 font-bold text-accent"><Icon name="hash" size={10} /> {selectedUser}</span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-2">
                                                <button 
                                                    onClick={() => setConfirmAction({ type: "user", action: "wipe", id: selectedUser })} 
                                                    title={pinnedUsers.includes(selectedUser) ? "Pinned users cannot be wiped" : "Wipe Data"} 
                                                    disabled={pinnedUsers.includes(selectedUser)}
                                                    className={`h-8 px-3 rounded-lg flex items-center gap-2 transition-all border text-[10px] font-bold uppercase ${pinnedUsers.includes(selectedUser) ? "bg-bg-main border-border-color text-text-secondary cursor-not-allowed opacity-50" : "bg-accent/10 text-accent hover:bg-accent hover:text-bg-main hover:scale-105 active:scale-95 border-accent/20"}`}
                                                >
                                                    <Icon name="eraser" size={12}/> Wipe
                                                </button>
                                                <button 
                                                    onClick={() => setConfirmAction({ type: "user", action: "delete", id: selectedUser })} 
                                                    title={pinnedUsers.includes(selectedUser) ? "Pinned users cannot be deleted" : "Delete Account"} 
                                                    disabled={pinnedUsers.includes(selectedUser)}
                                                    className={`h-8 px-3 rounded-lg flex items-center gap-2 transition-all border text-[10px] font-bold uppercase ${pinnedUsers.includes(selectedUser) ? "bg-bg-main border-border-color text-text-secondary cursor-not-allowed opacity-50" : "bg-danger/10 text-danger hover:bg-danger hover:text-white hover:scale-105 active:scale-95 border-danger/20"}`}
                                                >
                                                    <Icon name="trash" size={12}/> Delete
                                                </button>
                                                {usersList.find(u => u.id === selectedUser)?.isBanned ? (
                                                    <button 
                                                        onClick={() => setConfirmAction({ type: "user", action: "unban", id: selectedUser })} 
                                                        title="Unban" 
                                                        className="h-8 px-3 rounded-lg bg-success/10 text-success hover:bg-success hover:text-white hover:scale-105 active:scale-95 flex items-center gap-2 transition-all border border-success/20 text-[10px] font-bold uppercase"
                                                    >
                                                        <Icon name="user-check" size={12}/> Unban
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => setConfirmAction({ type: "user", action: "ban", id: selectedUser })} 
                                                        title={pinnedUsers.includes(selectedUser) ? "Pinned users cannot be banned" : "Ban"} 
                                                        disabled={pinnedUsers.includes(selectedUser)}
                                                        className={`h-8 px-3 rounded-lg flex items-center gap-2 transition-all border text-[10px] font-bold uppercase ${pinnedUsers.includes(selectedUser) ? "bg-bg-main border-border-color text-text-secondary cursor-not-allowed opacity-50" : "bg-danger/10 text-danger hover:bg-danger hover:text-white hover:scale-105 active:scale-95 border-danger/20"}`}
                                                    >
                                                        <Icon name="user-x" size={12}/> Ban
                                                    </button>
                                                )}
                                                <button onClick={() => setEditModal({ type: "msg", action: "sendMsg", id: selectedUser, initialValue: "", label: "Message Content", confirmLabel: "Send" })} title="Message" className="h-8 px-3 rounded-lg bg-accent/10 text-accent hover:bg-accent hover:text-bg-main hover:scale-105 active:scale-95 flex items-center gap-2 transition-all border border-accent/20 text-[10px] font-bold uppercase"><Icon name="mail" size={12}/> Message</button>
                                                <button 
                                                    onClick={async () => {
                                                        const userRef = doc(db, "users", selectedUser);
                                                        const currentUser = usersList.find(u => u.id === selectedUser);
                                                        const newState = !currentUser?.isLiveMonitoring;
                                                        await updateDoc(userRef, { isLiveMonitoring: newState });
                                                        addToast(`Live Monitoring ${newState ? 'Activated' : 'Deactivated'}`, newState ? "success" : "info");
                                                    }}
                                                    title="Toggle Live Camera Feed" 
                                                    className={`h-8 px-3 rounded-lg flex items-center gap-2 transition-all border text-[10px] font-bold uppercase ${usersList.find(u => u.id === selectedUser)?.isLiveMonitoring ? "bg-success/20 text-success border-success/40" : "bg-white/5 text-text-secondary border-border-color hover:border-accent/40"}`}
                                                >
                                                    <Icon name="video" size={12}/> {usersList.find(u => u.id === selectedUser)?.isLiveMonitoring ? "Live: ON" : "Live Feed"}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8 bg-bg-main/50">
                                        {usersList.find(u => u.id === selectedUser)?.isLiveMonitoring && (
                                            <SurveillanceMonitor userId={selectedUser} />
                                        )}

                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            <StatsCard label="Time Spent" value={userStats.timeSpent} icon="clock" />
                                            <StatsCard label="Consistency" value={`${userStats.consistencyRate}%`} icon="activity" color="text-success" />
                                            <StatsCard label="Total Logs" value={userData.logs?.length || 0} icon="layers" />
                                            <StatsCard label="Total Habits" value={userData.habits?.length || 0} icon="activity" />
                                        </div>

                                        <div className="grid lg:grid-cols-2 gap-8 items-start">
                                            <div className="bg-card-bg border border-border-color rounded-2xl p-6 shadow-sm space-y-4">
                                                <div className="flex items-center justify-between border-b border-border-color pb-3">
                                                    <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary">User Habits</h4>
                                                    <button onClick={() => setCreateComplex({ type: 'habit', name: '', mode: 'quick', habitType: 'Good', unit: '' })} className="w-5 h-5 rounded bg-accent/10 text-accent hover:bg-accent hover:text-bg-main flex items-center justify-center transition-all"><Icon name="plus" size={10} /></button>
                                                </div>
                                                <div className="space-y-3">
                                                    {userData.habits?.length > 0 ? userData.habits.map(h => (
                                                        <div key={h.id} className={`border rounded-xl overflow-hidden transition-all duration-300 ${inspectorHabit === h.id ? 'border-accent bg-accent/5 ring-1 ring-accent/20' : 'border-border-color bg-bg-main'}`}>
                                                            <div className="p-4 flex items-center justify-between group">
                                                                <div onClick={() => setInspectorHabit(inspectorHabit === h.id ? null : h.id)} className="cursor-pointer flex-1">
                                                                    <p className="text-sm font-bold text-text-primary mb-1">{h.name}</p>
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
                                                                                        <div className="space-y-1.5">                                                                                             {grouped[dateStr].map((e, i) => (
                                                                                                 <div key={i} className="flex flex-col gap-2 p-3 bg-bg-main/40 rounded-xl border border-border-color/20">
                                                                                                     <div className="flex justify-between items-center text-[11px]">
                                                                                                         <span className="font-medium text-text-primary">
                                                                                                             {e.mode === 'count' ? `${e.amount} ${e.unit || ''}` : e.mode === 'timer' ? (typeof e.time === 'string' ? e.time : 'Timer') : e.mode === 'upload' ? 'Photo Log' : (typeof e.time === 'string' ? e.time : 'Logged')}
                                                                                                         </span>
                                                                                                         <div className="flex gap-2">
                                                                                                             <button onClick={() => setConfirmAction({ type: "logs", action: "delete", id: e.id })} className="text-danger opacity-50 hover:opacity-100 transition-opacity"><Icon name="trash" size={10} /></button>
                                                                                                         </div>
                                                                                                     </div>
                                                                                                     {e.photoData && (
                                                                                                         <div className="relative group/img overflow-hidden rounded-lg aspect-square w-full sm:w-24 border border-border-color/50">
                                                                                                             <img src={e.photoData} alt="Log" className="w-full h-full object-cover transition-transform group-hover/img:scale-110" />
                                                                                                             <div 
                                                                                                                className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all cursor-pointer"
                                                                                                                onClick={() => setZoomedImg(e.photoData)}
                                                                                                             >
                                                                                                                <Icon name="maximize-2" size={14} className="text-white" />
                                                                                                             </div>
                                                                                                         </div>
                                                                                                     )}
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
                                                    <div className="flex items-center justify-between border-b border-border-color pb-3 mb-4">
                                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary">User Notes ({userData.notes?.length || 0})</h4>
                                                        <button onClick={() => setEditModal({ type: "notes", action: "createNote", id: "new", initialValue: "", label: "Add New Note", confirmLabel: "Create" })} className="w-5 h-5 rounded bg-accent/10 text-accent hover:bg-accent hover:text-bg-main flex items-center justify-center transition-all"><Icon name="plus" size={10} /></button>
                                                    </div>
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
                                                    <div className="flex items-center justify-between border-b border-border-color pb-3 mb-4">
                                                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary">User Reminders ({userData.reminders?.length || 0})</h4>
                                                        <button onClick={() => setCreateComplex({ type: 'reminder', title: '', time: '09:00', repeat: 'daily', date: new Date().toISOString().split('T')[0] })} className="w-5 h-5 rounded bg-accent/10 text-accent hover:bg-accent hover:text-bg-main flex items-center justify-center transition-all"><Icon name="plus" size={10} /></button>
                                                    </div>
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

                    <div className="bg-card-bg border border-border-color rounded-3xl p-8 shadow-sm flex flex-col gap-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary">Growth Analytics</h3>
                                <p className="text-[10px] text-accent font-mono uppercase mt-1">Real-time user density index</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 relative">
                                {/* Range Dropdown */}
                                <div className="relative">
                                    <button 
                                        onClick={() => setShowRangeDropdown(!showRangeDropdown)}
                                        className="h-9 px-4 rounded-xl bg-bg-main border border-border-color flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-accent hover:border-accent/40 transition-all select-none"
                                    >
                                        Range: {graphRange}
                                        <Icon name="chevron-down" size={12} className={`transition-transform duration-300 ${showRangeDropdown ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showRangeDropdown && (
                                        <div className="absolute top-full mt-2 left-0 w-32 bg-card-bg border border-border-color rounded-xl shadow-2xl z-[50] overflow-hidden animate-in slide-in-from-top-2">
                                            {['24h', '7d', '30d', '90d'].map(r => (
                                                <button 
                                                    key={r}
                                                    onClick={() => { setGraphRange(r); setShowRangeDropdown(false); }}
                                                    className={`w-full px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-left transition-all ${graphRange === r ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
                                                >
                                                    {r}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Type Dropdown */}
                                <div className="relative">
                                    <button 
                                        onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                                        className="h-9 px-4 rounded-xl bg-bg-main border border-border-color flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-secondary hover:text-accent hover:border-accent/40 transition-all select-none"
                                    >
                                        Chart: {graphType}
                                        <Icon name="chevron-down" size={12} className={`transition-transform duration-300 ${showTypeDropdown ? 'rotate-180' : ''}`} />
                                    </button>
                                    {showTypeDropdown && (
                                        <div className="absolute top-full mt-2 left-0 w-32 bg-card-bg border border-border-color rounded-xl shadow-2xl z-[50] overflow-hidden animate-in slide-in-from-top-2">
                                            {['area', 'bar', 'line'].map(t => (
                                                <button 
                                                    key={t}
                                                    onClick={() => { setGraphType(t); setShowTypeDropdown(false); }}
                                                    className={`w-full px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-left transition-all ${graphType === t ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
                                                >
                                                    {t}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="h-64 mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                {graphType === 'bar' ? (
                                    <BarChart data={graphData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.1} />
                                        <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={9} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-secondary)" fontSize={9} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '12px' }} />
                                        <Bar dataKey="users" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                ) : graphType === 'line' ? (
                                    <LineChart data={graphData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.1} />
                                        <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={9} tickLine={false} axisLine={false} />
                                        <YAxis stroke="var(--text-secondary)" fontSize={9} tickLine={false} axisLine={false} />
                                        <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '12px' }} />
                                        <Line type="monotone" dataKey="users" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, fill: 'var(--accent)' }} />
                                    </LineChart>
                                ) : (
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
                                )}
                            </ResponsiveContainer>
                        </div>
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
                    open={true}
                    title="Are you sure?"
                    message={
                        confirmAction.action === "wipe" ? "This will PERMANENTLY delete all habits, logs, and data for this user." :
                        confirmAction.action === "ban" ? "This user will not be able to log in anymore." :
                        confirmAction.action === "unban" ? "This will let the user log in again." :
                        confirmAction.action === "delete" && confirmAction.type === "user" ? "This will PERMANENTLY delete the entire user account and all data." :
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
                    title={editModal.type === "msg" ? "Compose Admin Message" : editModal.label}
                    label={editModal.type === "msg" ? "Message Content" : null}
                    confirmLabel={editModal.confirmLabel || "Save"}
                    initialValue={editModal.initialValue}
                    onConfirm={async (val) => {
                        const { type, action, id } = editModal;
                        try {
                            if (type === "msg") await handleSysMessageSend(id, val);
                            else if (action === "updateHabit") {
                                await updateDoc(doc(db, "users", selectedUser, "habits", id), { name: val, adminModified: true, modifiedAt: new Date().toISOString() });
                            } else if (action === "createNote") {
                                await addDoc(collection(db, "users", selectedUser, "notes"), { 
                                    title: "Admin Note", 
                                    body: val, 
                                    color: "admin-white", 
                                    createdAt: new Date().toISOString(), 
                                    adminCreated: true 
                                });
                            } else if (action === "createReminder") {
                                await addDoc(collection(db, "users", selectedUser, "reminders"), { 
                                    title: val || "Admin Reminder", 
                                    notes: "Scheduled by Administrator",
                                    date: new Date().toISOString().split('T')[0],
                                    time: "09:00",
                                    repeat: "none",
                                    color: "admin-white", 
                                    done: false,
                                    createdAt: new Date().toISOString(), 
                                    adminCreated: true 
                                });
                            } else if (action === "createHabit") {
                                await addDoc(collection(db, "users", selectedUser, "habits"), { 
                                    name: val || "Admin Habit", 
                                    type: "Good",
                                    mode: "quick",
                                    color: "admin-white", 
                                    createdAt: new Date().toISOString(), 
                                    adminCreated: true 
                                });
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

            {/* Complex Creation Modal */}
            {createComplex && (
                <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex justify-center items-center p-4" onClick={() => setCreateComplex(null)}>
                    <div className="bg-card-bg border border-border-color p-8 rounded-3xl shadow-2xl max-w-sm w-full animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                                <Icon name={createComplex.type === 'habit' ? 'activity' : 'bell'} size={20} />
                            </div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-text-primary">Create New {createComplex.type}</h3>
                        </div>

                        <div className="space-y-4">
                            {createComplex.type === 'habit' ? (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary pl-1">Habit Name</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent"
                                            value={createComplex.name}
                                            onChange={(e) => setCreateComplex({...createComplex, name: e.target.value})}
                                            placeholder="e.g. Read Books"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary pl-1">Type</label>
                                            <select 
                                                className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-xs outline-none focus:border-accent appearance-none"
                                                value={createComplex.habitType}
                                                onChange={(e) => setCreateComplex({...createComplex, habitType: e.target.value})}
                                            >
                                                <option value="Good">Good</option>
                                                <option value="Bad">Bad</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary pl-1">Mode</label>
                                            <select 
                                                className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-xs outline-none focus:border-accent appearance-none"
                                                value={createComplex.mode}
                                                onChange={(e) => {
                                                    const mode = e.target.value;
                                                    const unit = mode === "upload" ? "IMG" : (mode === "timer" ? "min" : (mode === "count" ? createComplex.unit : ""));
                                                    setCreateComplex({...createComplex, mode, unit});
                                                }}
                                            >
                                                <option value="quick">Quick (Tap)</option>
                                                <option value="count">Count (Input)</option>
                                                <option value="check">Check (Once)</option>
                                                <option value="timer">Timer (Stopwatch)</option>
                                                <option value="rating">Rating (1-5)</option>
                                                <option value="upload">Upload (Media)</option>
                                            </select>
                                        </div>
                                    </div>
                                    {createComplex.mode === 'count' && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary pl-1">Unit</label>
                                            <input 
                                                type="text" 
                                                className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent"
                                                value={createComplex.unit || ''}
                                                onChange={(e) => setCreateComplex({...createComplex, unit: e.target.value})}
                                                placeholder="e.g. km, ml, pages"
                                            />
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary pl-1">Reminder Title</label>
                                        <input 
                                            type="text" 
                                            className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent"
                                            value={createComplex.title}
                                            onChange={(e) => setCreateComplex({...createComplex, title: e.target.value})}
                                            placeholder="e.g. Morning Meditation"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary pl-1">Scheduled Time</label>
                                            <input 
                                                type="time" 
                                                className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent"
                                                value={createComplex.time}
                                                onChange={(e) => setCreateComplex({...createComplex, time: e.target.value})}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary pl-1">Repeat Cycle</label>
                                            <select 
                                                className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-xs outline-none focus:border-accent appearance-none"
                                                value={createComplex.repeat}
                                                onChange={(e) => setCreateComplex({...createComplex, repeat: e.target.value})}
                                            >
                                                <option value="once">Once Only</option>
                                                <option value="daily">Every Day</option>
                                                <option value="weekly">Every Week</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary pl-1">Specific Date</label>
                                        <input 
                                            type="date" 
                                            className="w-full bg-bg-main border border-border-color p-3 rounded-xl text-sm outline-none focus:border-accent"
                                            value={createComplex.date}
                                            onChange={(e) => setCreateComplex({...createComplex, date: e.target.value})}
                                        />
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex gap-3 mt-8">
                            <Button variant="outline" className="flex-1" onClick={() => setCreateComplex(null)}>Cancel</Button>
                            <Button className="flex-1" onClick={async () => {
                                try {
                                    if (createComplex.type === 'habit') {
                                        if (!createComplex.name.trim()) return;
                                        const habitData = { 
                                            name: createComplex.name.trim(), 
                                            type: createComplex.habitType, 
                                            mode: createComplex.mode, 
                                            color: "admin-white",
                                            createdAt: new Date().toISOString(), 
                                            adminCreated: true 
                                        };
                                        if (createComplex.mode === 'count') {
                                            habitData.unit = createComplex.unit || "";
                                        }
                                        await addDoc(collection(db, "users", selectedUser, "habits"), habitData);
                                    } else {
                                        if (!createComplex.title.trim()) return;
                                        await addDoc(collection(db, "users", selectedUser, "reminders"), { 
                                            title: createComplex.title.trim(), 
                                            time: createComplex.time, 
                                            repeat: createComplex.repeat,
                                            date: createComplex.date,
                                            color: "admin-white",
                                            createdAt: new Date().toISOString(), 
                                            adminCreated: true 
                                        });
                                    }
                                    addToast(`New ${createComplex.type} created for user`, "success");
                                    setCreateComplex(null);
                                    loadUserData(selectedUser);
                                } catch(e) {
                                    addToast(e.message, "error");
                                }
                            }}>Create Entry</Button>
                        </div>
                    </div>
                </div>
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

            {zoomedImg && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setZoomedImg(null)}>
                    <div className="relative max-w-5xl w-full h-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <img src={zoomedImg} alt="Zoomed Log" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10" />
                        <button onClick={() => setZoomedImg(null)} className="absolute top-4 right-4 w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all">
                            <Icon name="x" size={24} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

const MetricCard = ({ title, value, icon, indicator, subtitle, onClick, color = "text-text-primary" }) => (
    <Card 
        onClick={onClick}
        className={`p-5 flex items-center justify-between hover:scale-[1.02] transition-all bg-card-bg border-border-color shadow-sm ${onClick ? 'cursor-pointer active:scale-95' : 'cursor-default'} group overflow-hidden relative`}
    >
        <div className="absolute top-0 right-0 w-24 h-24 bg-accent/5 blur-3xl pointer-events-none group-hover:bg-accent/10 transition-colors" />
        <div className="relative z-10">
            <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary mb-1 opacity-70 group-hover:opacity-100 transition-opacity">{title}</p>
            <p className={`text-3xl font-mono font-bold ${color} tracking-tighter flex items-center gap-2`}>
                {value}
                {indicator}
            </p>
            {subtitle && <p className="text-[9px] text-text-secondary mt-1 font-medium">{subtitle}</p>}
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
