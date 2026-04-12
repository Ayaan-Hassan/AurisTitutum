import React, { useState, useEffect, useMemo } from "react";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { useAuth } from "../contexts/AuthContext";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { db } from "../firebase.config";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  doc, 
  deleteDoc,
  arrayUnion, 
  arrayRemove, 
  query, 
  where,
  serverTimestamp,
  orderBy
} from "firebase/firestore";

const TARGET_DATE = new Date("2026-03-23T13:14:08Z"); // 60 hours from 2026-03-21T01:14:08+05:30 (ISO 2026-03-20T19:44:08Z, so +60h = 2026-03-23T07:44:08Z UTC or 2026-03-23T13:14:08 IST)

const SocialEngine = () => {
  const { user } = useAuth();
  const adminUid = (import.meta.env.VITE_ADMIN_UID || "").replace(/['"]/g, '').trim();
  const isAdmin = user && adminUid && user.uid?.trim() === adminUid;

  const [activeTab, setActiveTab] = useState("public");
  const [activeServer, setActiveServer] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteUid, setInviteUid] = useState("");
  const [timeLeft, setTimeLeft] = useState(TARGET_DATE - new Date());
  
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const chatEndRef = React.useRef(null);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newServerForm, setNewServerForm] = useState({
    name: "",
    habit: "",
    mode: "check",
    visibility: "public",
    startDate: new Date().toISOString().split('T')[0],
    endDate: "",
    rules: "",
    habitType: "Good"
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTimeLeft(TARGET_DATE - now);
    }, 1000);

    // Live sync servers from Firestore
    setLoading(true);
    const q = query(collection(db, "social_servers"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const serverList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setServers(serverList);
      setLoading(false);
    }, (error) => {
      console.error("Servers sync error:", error);
      setLoading(false);
    });

    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, []);

  // Live Sync Messages for active server
  useEffect(() => {
    if (!activeServer?.id) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, "social_servers", activeServer.id, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgList);
      
      // Better scroll to bottom
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    });

    return () => unsubscribe();
  }, [activeServer?.id]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!messageInput.trim() || !user || !activeServer) return;

    try {
      const text = messageInput;
      setMessageInput(""); // Clear early for better UX

      await addDoc(collection(db, "social_servers", activeServer.id, "messages"), {
        text,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split('@')[0] || "Operator",
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const formatTime = (ms) => {
    if (ms <= 0) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const isLive = timeLeft <= 0 || isAdmin;

  if (!isLive) {
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="relative">
          <div className="absolute inset-0 bg-accent/20 blur-[80px] rounded-full scale-150 animate-pulse" />
          <div className="relative w-24 h-24 rounded-3xl bg-accent-dim border border-accent/30 flex items-center justify-center text-accent shadow-2xl">
            <Icon name="lock" size={40} />
          </div>
        </div>

        <div className="space-y-4 max-w-lg relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">Launching Soon</span>
          </div>
          
          <h2 className="text-4xl font-black tracking-tighter text-text-primary">Social Hub Opening</h2>
          
          <p className="text-sm text-text-secondary leading-relaxed px-6">
            The Hub is currently getting ready for release. Soon you'll be able to join **Global Challenges**, create **Private Groups**, and view your **History**.
          </p>

          <div className="pt-6">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary mb-3 opacity-60">Releasing in</div>
            <div className="flex items-center justify-center gap-4">
              <div className="bg-bg-sidebar border border-border-color rounded-2xl p-5 min-w-[140px] shadow-xl">
                 <div className="text-4xl font-black font-mono tracking-tighter text-accent">{formatTime(timeLeft)}</div>
                 <div className="text-[9px] font-bold text-text-secondary uppercase mt-2 tracking-widest">Time Remaining</div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-[11px] font-bold text-text-primary/70">
            Current status: <span className="text-accent underline underline-offset-4">Live in {hours} hours and {minutes} minutes</span>
          </div>
        </div>
      </div>
    );
  }

  const filteredServers = useMemo(() => {
    return servers.filter(s => {
      const matchesSearch = s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.habit?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMode = filterMode === "all" || s.mode === filterMode;
      return matchesSearch && matchesMode;
    });
  }, [servers, searchQuery, filterMode]);

  const publicServers = useMemo(() => {
    return filteredServers.filter(s => s.visibility === "public");
  }, [filteredServers]);

  const privateServers = useMemo(() => {
    return filteredServers.filter(s => s.visibility === "private");
  }, [filteredServers]);

  const joinedPublicServers = useMemo(() => {
    if (!user) return [];
    return publicServers.filter(s => s.members?.includes(user.uid));
  }, [publicServers, user]);

  const availablePublicServers = useMemo(() => {
    if (!user) return publicServers;
    return publicServers.filter(s => !s.members?.includes(user.uid));
  }, [publicServers, user]);

  const joinedPrivateServers = useMemo(() => {
    if (!user) return [];
    return privateServers.filter(s => s.members?.includes(user.uid));
  }, [privateServers, user]);

  const handleJoin = async (inputCode) => {
    if (!user) {
      document.dispatchEvent(new CustomEvent("showToast", { 
        detail: { message: "Please sign in to join a server!", type: "error" } 
      }));
      return;
    }
    
    const serverToJoin = servers.find(s => 
      s.id === inputCode || 
      s.id.slice(0,6).toUpperCase() === inputCode.toUpperCase()
    );

    if (!serverToJoin) {
      document.dispatchEvent(new CustomEvent("showToast", { 
        detail: { message: "Invalid Server ID.", type: "error" } 
      }));
      return;
    }
    
    try {
      const serverRef = doc(db, "social_servers", serverToJoin.id);
      await updateDoc(serverRef, {
        members: arrayUnion(user.uid),
        totalJoined: increment(1)
      });
      document.dispatchEvent(new CustomEvent("showToast", { 
        detail: { message: "Successfully joined server!", type: "success" } 
      }));
    } catch (err) {
      console.error("Error joining server:", err);
      document.dispatchEvent(new CustomEvent("showToast", { 
        detail: { message: "Failed to join server.", type: "error" } 
      }));
    }
  };

  const handleLeave = async (serverId) => {
    if (!user) return;
    
    try {
      const serverRef = doc(db, "social_servers", serverId);
      await updateDoc(serverRef, {
        members: arrayRemove(user.uid),
        totalJoined: Math.max(0, (servers.find(s => s.id === serverId)?.totalJoined || 1) - 1)
      });
      setActiveServer(null);
      document.dispatchEvent(new CustomEvent("showToast", { 
        detail: { message: "You left the server.", type: "info" } 
      }));
    } catch (err) {
      console.error("Error leaving server:", err);
    }
  };

  const handleDeleteServer = async (serverId) => {
    if (!window.confirm("Are you sure you want to permanently delete this server?")) return;
    try {
      await deleteDoc(doc(db, "social_servers", serverId));
      setActiveServer(null);
      document.dispatchEvent(new CustomEvent("showToast", { 
        detail: { message: "Server deleted successfully.", type: "success" } 
      }));
    } catch (err) {
      console.error("Error deleting server:", err);
      document.dispatchEvent(new CustomEvent("showToast", { 
        detail: { message: "Failed to delete server.", type: "error" } 
      }));
    }
  };
  
  const isFormValid = useMemo(() => {
    const { name, habit, mode, visibility, startDate, endDate } = newServerForm;
    const today = new Date().toISOString().split('T')[0];
    
    // Validations:
    // 1. All required fields filled
    if (!name || !habit || !mode || !visibility || !startDate || !endDate) return false;
    // 2. Start date must be today or in the future
    if (startDate < today) return false;
    // 3. End date must be greater than today AND greater than start date
    if (endDate <= today || endDate <= startDate) return false;
    
    return true;
  }, [newServerForm]);

  const handleCreateServerSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid || !user) {
      if (!user) {
        document.dispatchEvent(new CustomEvent("showToast", { 
          detail: { message: "Please sign in to create a server!", type: "error" } 
        }));
        return;
      }
      
      const { startDate, endDate } = newServerForm;
      const today = new Date().toISOString().split('T')[0];
      if (startDate < today || endDate <= today || endDate <= startDate) {
        document.dispatchEvent(new CustomEvent("showToast", { 
          detail: { message: "Invalid timeline. Start must be today+ and End must be in future.", type: "error" } 
        }));
        return;
      }
      return;
    }

    try {
      const serverData = {
        ...newServerForm,
        totalJoined: 1,
        onlineCount: 1,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        members: [user.uid]
      };
      
      await addDoc(collection(db, "social_servers"), serverData);
      
      setIsCreateModalOpen(false);
      setNewServerForm({
        name: "",
        habit: "",
        mode: "check",
        visibility: "public",
        startDate: new Date().toISOString().split('T')[0],
        endDate: "",
        rules: "",
        habitType: "Good"
      });
      document.dispatchEvent(new CustomEvent("showToast", { 
        detail: { message: "Server created successfully and saved to Database!", type: "success" } 
      }));
    } catch (err) {
      console.error("Error creating server:", err);
      document.dispatchEvent(new CustomEvent("showToast", { 
        detail: { message: "Failed to create server.", type: "error" } 
      }));
    }
  };

  const displayServer = useMemo(() => {
    if (!activeServer) return null;
    return servers.find(s => s.id === activeServer.id) || activeServer;
  }, [activeServer, servers]);

  if (displayServer) {
    return (
      <div className="page-fade space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" icon="arrow-left" onClick={() => setActiveServer(null)}>
              Back to Hub
            </Button>
            <div className="h-4 w-px bg-border-color" />
            <h2 className="text-xl font-bold tracking-tight text-text-primary capitalize">{displayServer.name}</h2>
          </div>
          <div className="flex w-full md:w-auto bg-bg-sidebar p-1 rounded-2xl border border-border-color shadow-sm">
            {[
              { id: "dashboard", label: "Dashboard", icon: "activity" },
              { id: "leaderboard", label: "Leaderboard", icon: "trophy" },
              { id: "chat", label: "Chats", icon: "message-square" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveServerTab(tab.id)}
                className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex justify-center items-center gap-2.5 ${
                  activeServerTab === tab.id 
                    ? "bg-accent text-bg-main shadow-lg shadow-accent/20" 
                    : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
                }`}
              >
                <Icon name={tab.icon} size={14} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {activeServerTab === "dashboard" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="lg:col-span-2 space-y-8">
              <Card className="p-8 relative overflow-hidden group border-none bg-gradient-to-br from-bg-sidebar to-bg-main">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
                <div className="flex justify-between items-start mb-8 relative z-10">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">{displayServer.habitType} Challenge</span>
                      <span className="w-1 h-1 rounded-full bg-border-color" />
                      <span className="text-[10px] font-mono font-bold text-text-secondary uppercase">{displayServer.mode}</span>
                      <span className="w-1 h-1 rounded-full bg-border-color" />
                      <span className="text-[10px] font-mono font-bold text-accent/80 uppercase cursor-pointer hover:text-accent transition-colors flex items-center gap-1" onClick={() => {
                        navigator.clipboard.writeText(displayServer.id.slice(0,6).toUpperCase());
                        document.dispatchEvent(new CustomEvent("showToast", { detail: { message: "Server Code Copied!", type: "success" } }));
                      }}>
                        ID: {displayServer.id.slice(0,6).toUpperCase()} <Icon name="copy" size={10} />
                      </span>
                    </div>
                    <h3 className="text-3xl font-black tracking-tighter text-text-primary mb-2">{displayServer.name}</h3>
                    <p className="text-sm text-text-secondary max-w-lg">Master your {displayServer.habit} consistency alongside {displayServer.totalJoined?.toLocaleString() || "1"} users globally.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    {(isAdmin || displayServer.createdBy === user?.uid) && (
                      <Button variant="danger" size="sm" icon="trash" onClick={() => handleDeleteServer(displayServer.id)}>
                        Delete
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="text-danger hover:bg-danger/10" icon="log-out" onClick={() => handleLeave(displayServer.id)}>Leave</Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 relative z-10">
                  <MetricBox label="Total Members" value={displayServer.totalJoined?.toString() || "1"} icon="users" color="text-accent" />
                  <MetricBox label="Mode" value={displayServer.mode} icon="settings" color="text-success" />
                  <MetricBox label="Start Date" value={new Date(displayServer.startDate).toLocaleDateString()} icon="calendar" color="text-text-primary" />
                  <MetricBox label="End Date" value={new Date(displayServer.endDate).toLocaleDateString()} icon="flag" color="text-text-secondary" />
                </div>
              </Card>
            </div>

            <div className="space-y-6">
               <Card className="p-6">
                  <h4 className="text-sm font-bold text-text-primary mb-4">Server Rules & Info</h4>
                  <div className="space-y-4">
                    {displayServer.rules && (
                      <div className="p-4 rounded-xl bg-bg-main/50 border border-border-color/30 text-[11px] text-text-secondary leading-relaxed font-bold italic">
                        "{displayServer.rules}"
                      </div>
                    )}
                    <ProtocolItem icon="shield-check" title="Verification" desc="Anti-cheat always active" />
                    <ProtocolItem icon="clock" title="Reset Time" desc="Day resets at midnight (UTC)" />
                  </div>
               </Card>

               <Card className="p-6 space-y-4 border-accent/20 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-[50px] pointer-events-none" />
                  <h4 className="text-sm font-bold text-text-primary flex items-center gap-2 relative z-10">
                    <Icon name="activity" size={16} className="text-accent" />
                    Log Habit Progress
                  </h4>
                  <div className="relative z-10">
                    {['quick', 'check', 'upload'].includes(displayServer.mode) ? (
                       <Button variant="primary" className="w-full shadow-lg shadow-accent/20 h-12" icon="check" onClick={handleLogProgress}>
                         Mark as Complete
                       </Button>
                    ) : (
                       <div className="space-y-3">
                         <Input 
                           type="number" 
                           placeholder={displayServer.mode === "timer" ? "Minutes spent..." : "Enter amount..."} 
                           value={logValue} 
                           onChange={(e) => setLogValue(e.target.value)} 
                           className="bg-bg-main/50"
                         />
                         <Button variant="primary" className="w-full shadow-lg shadow-accent/20" icon="plus" onClick={handleLogProgress}>
                           Confirm & Log
                         </Button>
                       </div>
                    )}
                  </div>
               </Card>
            </div>
          </div>
        )}

        {activeServerTab === "leaderboard" && (
          <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-300">
             <Card className="p-8">
                <div className="flex items-center justify-between mb-8 border-b border-border-color/50 pb-6">
                  <div>
                    <h3 className="text-2xl font-black tracking-tighter text-text-primary flex items-center gap-3">
                      <Icon name="trophy" size={24} className="text-yellow-500" />
                      Global Leaderboard
                    </h3>
                    <p className="text-xs text-text-secondary mt-1">Real-time rankings strictly based on verified logs.</p>
                  </div>
                  <div className="hidden sm:block text-[10px] font-mono text-text-secondary/50 uppercase tracking-widest bg-bg-main px-3 py-1.5 rounded-lg border border-border-color">
                    Live Sync Active
                  </div>
                </div>

                <div className="space-y-3">
                   {leaderboardData.length > 0 ? leaderboardData.map((lb, idx) => (
                      <div key={lb.id} className="flex items-center justify-between p-4 rounded-2xl bg-bg-main/40 border border-border-color/30 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${idx === 0 ? 'bg-yellow-500/20 text-yellow-500 shadow-lg shadow-yellow-500/10' : idx === 1 ? 'bg-gray-300/20 text-gray-300' : idx === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-bg-sidebar text-text-secondary'}`}>
                            #{idx + 1}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-text-primary flex items-center gap-2">
                              {lb.userName} {user?.uid === lb.id && <span className="text-[9px] bg-accent/20 text-accent px-1.5 py-0.5 rounded uppercase tracking-widest">You</span>}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-black font-mono tracking-tighter text-text-primary">{Math.floor(lb.score).toLocaleString()}</p>
                          <p className="text-[9px] text-text-secondary uppercase tracking-widest">{displayServer.mode === 'timer' ? 'Minutes' : 'Total Score'}</p>
                        </div>
                      </div>
                   )) : (
                      <div className="flex flex-col items-center justify-center py-16 opacity-40">
                        <Icon name="bar-chart-2" size={32} className="text-text-secondary mb-3" />
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary text-center">No Activity Logged</p>
                        <p className="text-[10px] text-text-secondary mt-1">Be the first to secure the top rank.</p>
                      </div>
                   )}
                </div>
             </Card>
          </div>
        )}

        {activeServerTab === "chat" && (
          <div className="max-w-4xl mx-auto animate-in fade-in zoom-in-95 duration-300">
            <Card className="p-6 flex flex-col h-[60vh] min-h-[500px]">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-color/50">
                <div>
                  <h3 className="text-xl font-black tracking-tight text-text-primary flex items-center gap-2">
                    <Icon name="message-square" size={20} className="text-accent" /> Server Transmissions
                  </h3>
                  <p className="text-[11px] text-text-secondary font-bold mt-1">Encrypted global chat for {displayServer.name}</p>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-success uppercase tracking-widest bg-success/10 px-3 py-1.5 rounded-lg border border-success/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> {displayServer.onlineCount} Online
                </span>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-4 pr-2 border border-border-color/20 bg-bg-main/20 rounded-2xl p-4">
                {messages.length > 0 ? (
                  messages.map((m) => (
                    <ChatMessage 
                      key={m.id}
                      user={m.senderName}
                      msg={m.text}
                      time={m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just now"}
                      self={m.senderId === user?.uid}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-50">
                    <Icon name="mail" size={32} className="text-text-secondary mb-2" />
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-text-secondary">Silence</p>
                    <p className="text-[10px] text-text-secondary">Initiate the first transmission.</p>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="relative">
                <Input 
                  placeholder="Type a message..." 
                  className="pr-12 bg-bg-main/50" 
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                />
                <button 
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-accent text-bg-main flex items-center justify-center hover:opacity-90 active:scale-90 transition-all disabled:opacity-30"
                  disabled={!messageInput.trim()}
                >
                  <Icon name="send" size={14} />
                </button>
              </form>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="page-fade space-y-10 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2">
          <h2 className="text-4xl font-black tracking-tighter text-text-primary">Social Engine</h2>
          <p className="text-xs text-text-secondary max-w-md font-medium">Coordinate with global operators, initiate private challenges, and track your competitive trajectory.</p>
        </div>

        <div className="flex bg-bg-sidebar p-1 rounded-2xl border border-border-color h-12 shadow-sm">
          {[
            { id: "public", label: "Global", icon: "layout" },
            { id: "private", label: "Private", icon: "lock" },
            { id: "history", label: "History", icon: "clock" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2.5 ${
                activeTab === tab.id 
                  ? "bg-accent text-bg-main shadow-lg shadow-accent/20" 
                  : "text-text-secondary hover:text-text-primary hover:bg-white/[0.03]"
              }`}
            >
              <Icon name={tab.icon} size={14} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "public" && (
        <div className="space-y-10">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-bg-sidebar/50 p-4 rounded-2xl border border-border-color/50">
            <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
              <div className="relative w-full sm:w-64">
                <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary/50" />
                <input 
                  type="text" 
                  placeholder="Search global servers..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 flex-1 bg-bg-main/40 border border-border-color/30 rounded-xl pl-10 pr-4 text-xs font-bold text-text-primary outline-none focus:border-accent/50 transition-all placeholder:text-text-secondary/30"
                />
              </div>
              <CustomSelect 
                value={filterMode} 
                onChange={setFilterMode}
                options={[
                  { value: "all", label: "All Modes" },
                  { value: "check", label: "Check-in" },
                  { value: "count", label: "Number Count" },
                  { value: "timer", label: "Stopwatch/Timer" },
                ]}
                containerClassName="h-10 w-full sm:w-40"
              />
            </div>
            
            <Button 
              variant="primary" 
              className="shadow-xl shadow-accent/20 w-full md:w-auto mt-2 md:mt-0" 
              icon="plus" 
              size="md"
              onClick={() => setIsCreateModalOpen(true)}
            >
              Start New Server
            </Button>
          </div>

          {joinedPublicServers.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-text-secondary flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(74,222,128,0.5)]" /> My Joined Servers
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {joinedPublicServers.map(server => (
                   <ServerCard key={server.id} server={server} onOpen={handleOpenServer} active />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-text-secondary flex items-center gap-3">
              <Icon name="globe" size={14} /> Available Public Servers
            </h3>
            
            {loading ? (
              <div className="space-y-3 opacity-50">
                {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-2xl bg-bg-sidebar/50 animate-pulse border border-border-color" />)}
              </div>
            ) : availablePublicServers.length > 0 ? (
              <div className="space-y-3">
                {availablePublicServers.map(server => (
                  <ServerRow key={server.id} server={server} onOpen={handleOpenServer} onJoin={handleJoin} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 bg-bg-sidebar/20 rounded-[3rem] border border-border-color border-dashed space-y-4 opacity-40">
                <Icon name="globe" size={32} className="text-text-secondary" />
                <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest text-center">No public servers found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "private" && (
        <div className="space-y-10 animate-in fade-in duration-500">
           <div className="bg-bg-sidebar/40 border border-border-color/50 rounded-3xl p-8 lg:p-12 relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-10">
              <div className="absolute -top-32 -left-32 w-96 h-96 bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
              
              <div className="flex-1 space-y-4 relative z-10 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent text-[10px] font-black uppercase tracking-widest rounded-full border border-accent/20">
                   <Icon name="lock" size={12} /> Secure Protocols
                </div>
                <h3 className="text-3xl lg:text-4xl font-black tracking-tighter text-text-primary">Private Networks</h3>
                <p className="text-sm text-text-secondary max-w-lg leading-relaxed mx-auto lg:mx-0">
                  Connect locally with specialized groups or construct your own encrypted domain. Enter a 6-character Invite ID to link up.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 justify-center lg:justify-start">
                   <div className="flex gap-2 max-w-sm w-full">
                     <Input 
                      placeholder="Enter 6-char ID" 
                      value={inviteUid} 
                      onChange={(e) => setInviteUid(e.target.value)} 
                      className="flex-1 bg-bg-main/60 border-border-color/40 text-center font-mono font-bold tracking-widest uppercase"
                      maxLength={6}
                     />
                     <Button 
                      variant="primary" 
                      disabled={!inviteUid} 
                      className="px-6 shadow-xl shadow-accent/20"
                      onClick={() => {
                        handleJoin(inviteUid);
                        setInviteUid("");
                      }}
                     >
                      Join
                     </Button>
                   </div>
                   <div className="hidden sm:block w-px h-8 bg-border-color/50 mx-2" />
                   <Button 
                     variant="ghost" 
                     icon="plus" 
                     className="px-6 bg-white/[0.02] border border-border-color/30 hover:bg-white/[0.05]"
                     onClick={() => setIsCreateModalOpen(true)}
                   >
                     Create Server
                   </Button>
                </div>
              </div>
              
              <div className="hidden lg:flex w-64 h-64 relative justify-center items-center shrink-0">
                 <div className="absolute inset-0 bg-gradient-to-tr from-accent/20 to-transparent border border-accent/20 rounded-full animate-spin-slow opacity-50" />
                 <div className="w-48 h-48 bg-bg-main rounded-full border border-border-color flex items-center justify-center shadow-2xl relative z-10">
                    <Icon name="shield" size={48} className="text-accent/40" />
                 </div>
              </div>
           </div>

           {joinedPrivateServers.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-text-secondary flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgba(var(--accent),0.5)]" /> My Private Servers
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {joinedPrivateServers.map(server => (
                   <ServerCard key={server.id} server={server} onOpen={handleOpenServer} active />
                ))}
              </div>
            </div>
           )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
           <div className="flex items-center justify-between border-b border-border-color pb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-text-secondary">My Past Challenges</h3>
              <CustomSelect containerClassName="w-48" value="all" onChange={()=>{}} options={[{label: "All Records", value: "all"}]} />
           </div>
           
           <div className="space-y-4">
             {[].length > 0 ? [].map(h => (
                <Card key={h.id} className="p-6 group flex items-center justify-between hover:bg-white/[0.02]">
                   <div className="flex items-center gap-6">
                      <div className="w-12 h-12 rounded-2xl bg-bg-main border border-border-color flex items-center justify-center text-text-secondary group-hover:text-accent transition-colors">
                        <Icon name="trophy" size={20} />
                      </div>
                      <div>
                        <h4 className="font-bold text-text-primary">{h.name}</h4>
                        <p className="text-[11px] font-mono text-text-secondary mt-1 uppercase tracking-tighter opacity-60">End Date: {h.date}</p>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-sm font-black text-text-primary">Rank #{h.rank}</p>
                      <p className="text-[10px] text-text-secondary font-mono mt-1">Out of {h.total} Users</p>
                   </div>
                </Card>
             )) : (
              <div className="flex flex-col items-center justify-center py-20 bg-bg-sidebar/20 rounded-[3rem] border border-border-color border-dashed space-y-4 opacity-60">
                <div className="w-16 h-16 rounded-3xl bg-bg-main border border-border-color flex items-center justify-center">
                  <Icon name="scroll" size={32} className="text-text-secondary/40" />
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-text-secondary">History Empty</p>
                  <p className="text-[10px] text-text-secondary mt-1">No completed challenges yet.</p>
                </div>
              </div>
             )}
           </div>
        </div>
      )}

      {/* Create Server Modal (Root Level for Portal-like layering) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 w-screen h-screen bg-black/85 backdrop-blur-2xl z-[9999] flex flex-col items-center overflow-y-auto pt-24 pb-24" onClick={() => setIsCreateModalOpen(false)}>
        <div className="w-full max-w-xl px-4 pointer-events-none">
          <Card 
            className="p-8 pointer-events-auto shadow-[0_32px_120px_-20px_rgba(0,0,0,0.8)] border-white/5 bg-bg-sidebar/95 backdrop-blur-xl relative overflow-hidden animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-accent/10 rounded-full blur-[100px] pointer-events-none" />
            
            <form onSubmit={handleCreateServerSubmit} className="space-y-6 relative z-10">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-2xl font-black tracking-widest text-text-primary uppercase flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-accent rounded-full" />
                  New Server
                </h3>
                <button 
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-10 h-10 rounded-xl bg-bg-main border border-border-color flex items-center justify-center text-text-secondary hover:text-danger transition-colors hover:border-danger/30"
                >
                  <Icon name="x" size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <Input 
                    label="Server Name"
                    placeholder="e.g. Morning Runners"
                    value={newServerForm.name}
                    onChange={(e) => setNewServerForm({...newServerForm, name: e.target.value})}
                  />
                  <Input 
                    label="What habit will we track?"
                    placeholder="e.g. Running, Reading, Coding"
                    value={newServerForm.habit}
                    onChange={(e) => setNewServerForm({...newServerForm, habit: e.target.value})}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <CustomSelect 
                      label="Tracking Method"
                      value={newServerForm.mode}
                      onChange={(val) => setNewServerForm({...newServerForm, mode: val})}
                      options={[
                        { value: "quick", label: "Tap / Quick" },
                        { value: "count", label: "Number Count" },
                        { value: "check", label: "Simple Check" },
                        { value: "timer", label: "Stopwatch/Timer" },
                        { value: "rating", label: "Rating (Stars)" },
                        { value: "upload", label: "Photo Upload" },
                      ]}
                    />
                    <CustomSelect 
                      label="Habit Type"
                      value={newServerForm.habitType}
                      onChange={(val) => setNewServerForm({...newServerForm, habitType: val})}
                      options={[
                        { value: "Good", label: "Good Habit" },
                        { value: "Bad", label: "Bad Habit" },
                      ]}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Input 
                        label="Start Date"
                        type="date"
                        min={new Date().toISOString().split('T')[0]}
                        value={newServerForm.startDate}
                        style={{ colorScheme: 'dark' }}
                        onChange={(e) => setNewServerForm({...newServerForm, startDate: e.target.value})}
                      />
                      {newServerForm.startDate && newServerForm.startDate < new Date().toISOString().split('T')[0] && (
                        <p className="text-[9px] text-danger font-bold ml-1">Error: Backdating is not permitted</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Input 
                        label="End Date"
                        type="date"
                        min={newServerForm.startDate ? new Date(new Date(newServerForm.startDate).getTime() + 86400000).toISOString().split('T')[0] : new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                        value={newServerForm.endDate}
                        style={{ colorScheme: 'dark' }}
                        onChange={(e) => setNewServerForm({...newServerForm, endDate: e.target.value})}
                      />
                      {newServerForm.endDate && (newServerForm.endDate <= new Date().toISOString().split('T')[0] || (newServerForm.startDate && newServerForm.endDate <= newServerForm.startDate)) && (
                        <p className="text-[9px] text-danger font-bold ml-1">Error: End date must be in future & after start</p>
                      )}
                    </div>
                  </div>
                  <CustomSelect 
                    label="Who can join?"
                    value={newServerForm.visibility}
                    onChange={(val) => setNewServerForm({...newServerForm, visibility: val})}
                    options={[
                      { value: "public", label: "Public (Global)" },
                      { value: "private", label: "Private (Friends Only)" },
                    ]}
                  />
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">
                      Server Rules (Optional)
                    </label>
                    <textarea 
                      className="w-full h-24 bg-accent-dim border border-border-color p-3 rounded-xl text-xs font-bold text-text-primary focus:border-text-secondary outline-none transition-all placeholder:text-text-secondary/30 resize-none hover:bg-white/[0.02]"
                      placeholder="e.g. No cheating, Be respectful..."
                      value={newServerForm.rules}
                      onChange={(e) => setNewServerForm({...newServerForm, rules: e.target.value})}
                    />
                  </div>
                </div>
              </div>

                <Button 
                  type="submit" 
                  variant="primary" 
                  className={`w-full h-12 shadow-lg shadow-accent/20 ${!isFormValid ? 'opacity-50' : 'opacity-100 hover:scale-[1.02]'}`}
                  icon="plus"
                  disabled={!isFormValid}
                >
                  Create Master Server
                </Button>
            </form>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
};

// --- Sub-components (Restored & Fixed) ---


const ServerCard = ({ server, onOpen, onJoin, active = false }) => (
  <Card 
    className="p-0 overflow-hidden group cursor-pointer border-none bg-gradient-to-br from-bg-sidebar to-bg-main shadow-sm flex flex-col h-full"
    onClick={() => onOpen(server)}
  >
    <div className="p-7 space-y-5 relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex justify-between items-start relative z-10">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-accent shadow-lg shadow-accent/5 transition-all group-hover:scale-110 ${active ? 'bg-accent text-bg-main' : 'bg-accent/10'}`}>
          <Icon name={active ? "activity" : "layers"} size={24} />
        </div>
      </div>

      <div className="space-y-1 relative z-10 mt-4">
        <h3 className="text-xl font-black tracking-tight text-text-primary leading-tight group-hover:text-accent transition-colors">{server.name}</h3>
        <p className="text-xs font-bold text-text-secondary flex items-center gap-2">
          {server.habit} <span className="w-1 h-1 rounded-full bg-border-color" /> {server.mode}
        </p>
      </div>

      <div className="space-y-2 relative z-10 pt-2">
        <div className="flex justify-between items-center text-[10px] font-mono font-black uppercase tracking-widest text-text-secondary/50">
          <span>{server.totalJoined?.toLocaleString() || "1"} Users</span>
          <span className="text-accent/60 cursor-pointer hover:text-accent flex items-center gap-1 z-20" onClick={(e) => {
            e.stopPropagation();
            navigator.clipboard.writeText(server.id.slice(0,6).toUpperCase());
            document.dispatchEvent(new CustomEvent("showToast", { detail: { message: "Server ID copied!", type: "success" } }));
          }}>
            ID: {server.id.slice(0,6).toUpperCase()} <Icon name="copy" size={10} />
          </span>
        </div>
        <div className="w-full bg-black/20 rounded-full h-1 overflow-hidden">
          <div className="bg-accent h-full w-[100%] transition-all duration-700" />
        </div>
      </div>
    </div>
    <div className="mt-auto border-t border-border-color/30 p-5 flex items-center justify-between bg-white/[0.01]">
        {active ? (
          <Button variant="ghost" size="sm" className="w-full text-accent hover:bg-accent/10" onClick={(e) => { e.stopPropagation(); onOpen(server); }}>Open Server</Button>
        ) : (
          <Button variant="primary" size="md" className="w-full shadow-lg shadow-accent/10" onClick={(e) => { e.stopPropagation(); onJoin?.(server.id); }}>Join Now</Button>
        )}
    </div>
  </Card>
);

const ServerRow = ({ server, onOpen, onJoin, active = false }) => (
  <Card 
    className="p-4 overflow-hidden group cursor-pointer border border-border-color/50 bg-bg-sidebar/30 hover:bg-bg-sidebar/60 transition-colors shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
    onClick={() => onOpen?.(server)}
  >
    <div className="flex items-center gap-5">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${active ? 'bg-accent text-bg-main shadow-lg shadow-accent/20' : 'bg-accent/10 text-accent'}`}>
        <Icon name={active ? "activity" : "layers"} size={22} />
      </div>
      <div>
        <h3 className="text-sm font-black tracking-tight text-text-primary leading-tight group-hover:text-accent transition-colors">{server.name}</h3>
        <div className="flex items-center gap-3 mt-1.5 opacity-80">
          <span className="text-[10px] font-bold text-text-secondary bg-bg-main px-2 py-0.5 rounded-md border border-border-color">{server.habit}</span>
          <span className="w-1 h-1 rounded-full bg-border-color" />
          <span className="text-[10px] font-mono text-text-secondary uppercase">{server.mode}</span>
        </div>
      </div>
    </div>
    
    <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
      <div className="flex flex-col items-start sm:items-end gap-1">
        <span className="text-[10px] font-mono font-black uppercase tracking-widest text-text-secondary">
          {server.totalJoined?.toLocaleString() || "1"} Users
        </span>
      </div>
      
      <div className="sm:border-l border-border-color/30 sm:pl-6 pl-0">
        {active ? (
          <Button variant="ghost" size="sm" className="text-accent hover:bg-accent/10 h-9" onClick={(e) => { e.stopPropagation(); onOpen?.(server); }}>Open Server</Button>
        ) : (
          <Button variant="primary" size="sm" className="h-9 px-6 shadow-md shadow-accent/10" onClick={(e) => { e.stopPropagation(); onJoin?.(server.id); }}>Join</Button>
        )}
      </div>
    </div>
  </Card>
);

const ChatMessage = ({ user, msg, time, self = false }) => (
  <div className={`flex flex-col ${self ? 'items-end' : 'items-start'} max-w-[90%] ${self ? 'ml-auto' : ''}`}>
    <div className="flex items-center gap-2 mb-1">
      {!self && <span className="text-[10px] font-black text-accent uppercase tracking-widest">{user}</span>}
      <span className="text-[9px] font-mono text-text-secondary/40">{time}</span>
    </div>
    <div className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${self ? 'bg-accent text-bg-main rounded-tr-none' : 'bg-bg-sidebar border border-border-color/50 text-text-primary rounded-tl-none shadow-sm'}`}>
      {msg}
    </div>
  </div>
);

const MetricBox = ({ label, value, icon, color }) => (
  <div className="bg-bg-main/40 border border-border-color/50 rounded-2xl p-4 transition-all hover:bg-bg-main/60">
    <div className="flex items-center gap-2 mb-1.5">
      <Icon name={icon} size={12} className="text-text-secondary/40" />
      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary opacity-60">{label}</span>
    </div>
    <p className={`text-xl font-black font-mono tracking-tighter ${color}`}>{value}</p>
  </div>
);

const ProtocolItem = ({ icon, title, desc }) => (
  <div className="flex items-start gap-4">
    <div className="w-8 h-8 rounded-lg bg-bg-sidebar border border-border-color flex items-center justify-center text-text-secondary shrink-0">
      <Icon name={icon} size={14} />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-bold text-text-primary leading-tight">{title}</p>
      <p className="text-[10px] text-text-secondary mt-0.5 truncate">{desc}</p>
    </div>
  </div>
);

const CustomSelect = ({ label, options, value, onChange, containerClassName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className={`space-y-2 relative ${containerClassName}`}>
      {label && (
        <label className="text-[10px] font-black text-text-secondary uppercase tracking-widest ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full h-full min-h-[40px] bg-accent-dim border border-border-color px-4 rounded-xl text-xs font-bold text-text-primary flex items-center justify-between hover:bg-white/[0.03] transition-all outline-none focus:border-accent"
        >
          {selectedOption.label}
          <Icon name="chevron-down" size={14} className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[110]" onClick={() => setIsOpen(false)} />
            <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-bg-sidebar border border-border-color rounded-xl shadow-2xl z-[120] py-2 animate-in zoom-in-95 duration-200">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full px-4 py-2.5 text-left text-xs font-bold transition-colors hover:bg-accent hover:text-bg-main ${value === opt.value ? 'text-accent' : 'text-text-primary'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SocialEngine;
