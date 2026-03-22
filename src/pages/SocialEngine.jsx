import React, { useState, useEffect, useMemo } from "react";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { useAuth } from "../contexts/AuthContext";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const MOCK_PUBLIC_SERVERS = [];
const MOCK_HISTORY = [];

const TARGET_DATE = new Date("2026-03-23T13:14:08Z"); // 60 hours from 2026-03-21T01:14:08+05:30 (ISO 2026-03-20T19:44:08Z, so +60h = 2026-03-23T07:44:08Z UTC or 2026-03-23T13:14:08 IST)

const SocialEngine = () => {
  const { user } = useAuth();
  const adminUid = (import.meta.env.VITE_ADMIN_UID || "").replace(/['"]/g, '').trim();
  const isAdmin = user && adminUid && user.uid?.trim() === adminUid;

  const [activeTab, setActiveTab] = useState("public");
  const [activeServer, setActiveServer] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [servers, setServers] = useState(MOCK_PUBLIC_SERVERS);
  const [inviteUid, setInviteUid] = useState("");
  const [timeLeft, setTimeLeft] = useState(TARGET_DATE - new Date());
  
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
    return () => clearInterval(timer);
  }, []);

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
      const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.habit.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMode = filterMode === "all" || s.mode === filterMode;
      return matchesSearch && matchesMode;
    });
  }, [servers, searchQuery, filterMode]);

  const joinedServers = useMemo(() => filteredServers.filter(s => s.joined), [filteredServers]);
  const publicServers = useMemo(() => filteredServers.filter(s => !s.joined).sort((a, b) => b.totalJoined - a.totalJoined), [filteredServers]);

  const handleJoin = (id) => {
    setServers(prev => prev.map(s => s.id === id ? { ...s, joined: true } : s));
  };

  const handleLeave = (id) => {
    setServers(prev => prev.map(s => s.id === id ? { ...s, joined: false } : s));
    setActiveServer(null);
  };
  
  const isFormValid = useMemo(() => {
    const { name, habit, mode, visibility, startDate, endDate, rules } = newServerForm;
    return name && habit && mode && visibility && startDate && endDate && rules;
  }, [newServerForm]);

  const handleCreateServerSubmit = (e) => {
    e.preventDefault();
    if (!isFormValid) return;

    const newServer = {
      id: `server-${Date.now()}`,
      ...newServerForm,
      totalJoined: 1,
      onlineCount: 1,
      joined: true,
    };
    setServers(prev => [...prev, newServer]);
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
      detail: { message: "Server created successfully!", type: "success" } 
    }));
  };

  if (activeServer) {
    return (
      <div className="page-fade space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" icon="arrow-left" onClick={() => setActiveServer(null)}>
            Back to Hub
          </Button>
          <div className="h-4 w-px bg-border-color" />
          <h2 className="text-xl font-bold tracking-tight text-text-primary capitalize">{activeServer.name}</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="p-8 relative overflow-hidden group border-none bg-gradient-to-br from-bg-sidebar to-bg-main">
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
              
                  <div className="flex justify-between items-start mb-8 relative z-10">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">{activeServer.habitType} Challenge</span>
                    <span className="w-1 h-1 rounded-full bg-border-color" />
                    <span className="text-[10px] font-mono font-bold text-text-secondary uppercase">{activeServer.mode}</span>
                  </div>
                  <h3 className="text-3xl font-black tracking-tighter text-text-primary mb-2">{activeServer.name}</h3>
                  <p className="text-sm text-text-secondary max-w-lg">Master your {activeServer.habit} consistency alongside {activeServer.totalJoined.toLocaleString()} users globally.</p>
                </div>
                <Button variant="danger" size="sm" icon="log-out" onClick={() => handleLeave(activeServer.id)}>Leave Server</Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 relative z-10">
                <MetricBox label="Global Rank" value="#42" icon="trending-up" color="text-accent" />
                <MetricBox label="Active Streak" value="14d" icon="flame" color="text-success" />
                <MetricBox label="Completion" value="88%" icon="check-circle" color="text-text-primary" />
                <MetricBox label="Time Remaining" value="12d" icon="clock" color="text-text-secondary" />
              </div>

              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-text-secondary">Performance Velocity</h4>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-success"><div className="w-1.5 h-1.5 rounded-full bg-success" /> You</span>
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-text-secondary/40"><div className="w-1.5 h-1.5 rounded-full bg-text-secondary/40" /> Avg.</span>
                  </div>
                </div>
                <div className="h-48 w-full bg-bg-main/30 rounded-2xl border border-border-color/50 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={[
                      { name: 'Mon', you: 4, avg: 3 },
                      { name: 'Tue', you: 6, avg: 4 },
                      { name: 'Wed', you: 5, avg: 4 },
                      { name: 'Thu', you: 8, avg: 5 },
                      { name: 'Fri', you: 7, avg: 4 },
                      { name: 'Sat', you: 9, avg: 6 },
                      { name: 'Sun', you: 6, avg: 5 },
                    ]}>
                      <defs>
                        <linearGradient id="colorYou" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.1} />
                      <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={9} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '12px', fontSize: '10px' }} />
                      <Area type="monotone" dataKey="you" stroke="var(--accent)" fillOpacity={1} fill="url(#colorYou)" strokeWidth={3} />
                      <Area type="monotone" dataKey="avg" stroke="var(--border-color)" fill="transparent" strokeDasharray="5 5" strokeWidth={1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="p-6 space-y-4">
                <h4 className="text-sm font-bold tracking-tight text-text-primary flex items-center gap-2">
                  <Icon name="trophy" size={16} className="text-yellow-500" /> Leaderboard (Real-time)
                </h4>
                <div className="space-y-2">
                  {[
                    { rank: 42, name: "You", val: "14d", color: "text-success", active: true },
                  ].map((p) => (
                    <div key={p.rank} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${p.active ? 'bg-accent/10 border-accent/30' : 'bg-bg-main/50 border-border-color/50 hover:border-text-secondary/30'}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono font-black text-text-secondary w-5">#{p.rank}</span>
                        <div className="w-7 h-7 rounded-lg bg-bg-sidebar border border-border-color flex items-center justify-center text-[10px] font-black">{p.name[0]}</div>
                        <span className={`text-xs font-bold ${p.active ? 'text-accent' : 'text-text-primary'}`}>{p.name}</span>
                      </div>
                      <span className={`text-xs font-mono font-bold ${p.color}`}>{p.val}</span>
                    </div>
                  ))}
                  <div className="text-center py-4">
                    <p className="text-[10px] text-text-secondary italic">Consolidating operator data...</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-[9px]"
                  onClick={() => document.dispatchEvent(new CustomEvent("showToast", { detail: { message: "Global rankings will be available after deployment.", type: "info" } }))}
                >
                  View Complete Rankings
                </Button>
              </Card>

              <Card className="p-6 flex flex-col h-[400px]">
                <h4 className="text-sm font-bold tracking-tight text-text-primary flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Icon name="mail" size={16} className="text-accent" /> Server Transmission</div>
                  <span className="text-[9px] font-mono text-success uppercase tracking-widest">{activeServer.onlineCount} Online</span>
                </h4>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 mb-4 pr-1">
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-40">
                    <Icon name="message-square" size={24} className="text-text-secondary" />
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">No Transmissions Logged</p>
                  </div>
                </div>
                <div className="relative">
                  <Input placeholder="Compose transmission..." className="pr-12" />
                  <button 
                    onClick={() => document.dispatchEvent(new CustomEvent("showToast", { detail: { message: "Global server transmission is currently in read-only mode.", type: "warning" } }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-accent text-bg-main flex items-center justify-center hover:opacity-90 active:scale-90 transition-all"
                  >
                    <Icon name="send" size={14} />
                  </button>
                </div>
              </Card>
            </div>
          </div>

          <div className="space-y-6">
             <Card className="p-6">
                <h4 className="text-sm font-bold text-text-primary mb-4">Server Rules</h4>
                <div className="space-y-4">
                  <ProtocolItem icon="shield-check" title="Verification" desc="Anti-cheat audit active" />
                  <ProtocolItem icon="clock" title="Reset Time" desc="Day resets at midnight (UTC)" />
                  <ProtocolItem icon="zap" title="Boosts" desc="Streak bonuses enabled" />
                  <ProtocolItem icon="user" title="Admin" desc="System Managed" />
                </div>
                <div className="h-px bg-border-color my-6" />
                <Button 
                  variant="primary" 
                  className="w-full" 
                  size="lg" 
                  icon="activity"
                  onClick={() => document.dispatchEvent(new CustomEvent("showToast", { detail: { message: "Logging will be enabled shortly.", type: "info" } }))}
                >
                  Log Habit Progress
                </Button>
             </Card>

             <Card className="p-6 bg-accent-dim/20 border-accent/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-accent text-bg-main flex items-center justify-center">
                    <Icon name="sparkles" size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-widest text-text-primary">Personal Insight</h4>
                    <p className="text-[10px] text-accent font-bold">AI Analysis</p>
                  </div>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">Based on your recent progress, you are doing better than 65% of users on <span className="text-accent font-bold">Wednesdays</span>. Keep it up to reach the top 20!</p>
             </Card>
          </div>
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-bg-sidebar/50 p-6 rounded-[2rem] border border-border-color backdrop-blur-md">
            <div className="relative lg:col-span-2">
              <Icon name="search" size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input 
                type="text" 
                placeholder="Search for servers..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-11 bg-bg-main/50 border border-border-color/50 rounded-xl pl-11 pr-4 text-xs font-bold text-text-primary outline-none focus:border-accent transition-all placeholder:text-text-secondary/30"
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
              containerClassName="h-11"
            />
            <Button 
              variant="primary" 
              className="h-11" 
              icon="plus" 
              size="md"
              onClick={() => setIsCreateModalOpen(true)}
            >
              Create Server
            </Button>
          </div>

          {/* Create Server Modal */}
          {isCreateModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 overflow-y-auto custom-scrollbar bg-black/80 backdrop-blur-md">
              <div 
                className="fixed inset-0 z-0"
                onClick={() => setIsCreateModalOpen(false)}
              />
              <Card className="relative my-4 w-full max-w-2xl bg-gradient-to-br from-bg-sidebar to-bg-main border-border-color/50 overflow-hidden animate-in zoom-in-95 duration-300 shadow-2xl z-10">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
                
                <form onSubmit={handleCreateServerSubmit} className="p-8 space-y-8">
                  <div className="flex justify-between items-center pb-4 border-b border-border-color/50">
                    <div>
                      <h3 className="text-2xl font-black tracking-tighter text-text-primary uppercase">Create New Server</h3>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent mt-1">Fill in the details for your new server</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsCreateModalOpen(false)}
                      className="w-10 h-10 rounded-xl bg-bg-main border border-border-color flex items-center justify-center text-text-secondary hover:text-danger transition-colors hover:border-danger/30"
                    >
                      <Icon name="x" size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <Input 
                        label="Server Name"
                        placeholder="e.g. Focus Squad"
                        value={newServerForm.name}
                        onChange={(e) => setNewServerForm({...newServerForm, name: e.target.value})}
                      />
                      <Input 
                        label="What habit to track?"
                        placeholder="e.g. Reading"
                        value={newServerForm.habit}
                        onChange={(e) => setNewServerForm({...newServerForm, habit: e.target.value})}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <CustomSelect 
                          label="Tracking Method"
                          value={newServerForm.mode}
                          onChange={(val) => setNewServerForm({...newServerForm, mode: val})}
                          options={[
                            { value: "check", label: "Check-in" },
                            { value: "count", label: "Number Count" },
                            { value: "timer", label: "Stopwatch/Timer" },
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
                        <Input 
                          label="Start Date"
                          type="date"
                          value={newServerForm.startDate}
                          onChange={(e) => setNewServerForm({...newServerForm, startDate: e.target.value})}
                        />
                        <Input 
                          label="End Date"
                          type="date"
                          value={newServerForm.endDate}
                          onChange={(e) => setNewServerForm({...newServerForm, endDate: e.target.value})}
                        />
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
                          Server Rules
                        </label>
                        <textarea 
                          className="w-full h-24 bg-accent-dim border border-border-color p-3 rounded-xl text-xs font-bold text-text-primary focus:border-text-secondary outline-none transition-all placeholder:text-text-secondary/30 resize-none hover:bg-white/[0.02]"
                          placeholder="What are the rules for this server?"
                          value={newServerForm.rules}
                          onChange={(e) => setNewServerForm({...newServerForm, rules: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <Button 
                      type="submit" 
                      variant="primary" 
                      className="w-full h-12 shadow-lg shadow-accent/20"
                      icon="plus"
                      disabled={!isFormValid}
                    >
                      Initialize Server
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {joinedServers.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-text-secondary flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_8px_rgba(74,222,128,0.5)]" /> My Joined Servers
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {joinedServers.map(server => (
                   <ServerCard key={server.id} server={server} onOpen={setActiveServer} active />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-text-secondary flex items-center gap-3">
              <Icon name="layout" size={14} /> Global Servers
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {publicServers.map(server => (
                <ServerCard key={server.id} server={server} onOpen={setActiveServer} onJoin={handleJoin} />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "private" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start animate-in fade-in duration-500">
           <Card className="p-10 space-y-6 text-center lg:text-left flex flex-col items-center lg:items-start min-h-[400px] justify-center">
              <div className="w-20 h-20 rounded-3xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4 shadow-2xl shadow-accent/5">
                <Icon name="user-plus" size={32} />
              </div>
              <h3 className="text-3xl font-black tracking-tighter text-text-primary">Create Private Server</h3>
              <p className="text-sm text-text-secondary max-w-sm leading-relaxed">Start a private server for your friends by entering their ID below.</p>
              
              <div className="w-full max-w-md space-y-4 pt-4">
                 <div className="flex gap-3">
                   <Input 
                    placeholder="Enter Friend's ID" 
                    value={inviteUid} 
                    onChange={(e) => setInviteUid(e.target.value)} 
                    className="flex-1 bg-white/[0.02]"
                   />
                   <Button 
                    variant="primary" 
                    disabled={!inviteUid} 
                    className="h-11"
                    onClick={() => {
                      document.dispatchEvent(new CustomEvent("showToast", { detail: { message: `Invite sent to ID: ${inviteUid}`, type: "success" } }));
                      setInviteUid("");
                    }}
                   >
                    Send Invite
                   </Button>
                 </div>
                 <div className="flex items-center gap-2 px-3 py-2 bg-accent-dim/30 rounded-lg border border-border-color/50">
                    <Icon name="info" size={12} className="text-text-secondary" />
                    <p className="text-[9px] font-mono font-bold text-text-secondary uppercase">Invites cannot be changed once they are sent.</p>
                 </div>
              </div>
           </Card>

            <div className="space-y-6">
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-text-secondary">Pending Invites</h3>
              <div className="space-y-4">
                 <div className="flex flex-col items-center justify-center py-12 bg-bg-sidebar/30 rounded-[2rem] border border-border-color border-dashed text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-border-color/20 flex items-center justify-center text-text-secondary/40">
                      <Icon name="user-check" size={24} />
                    </div>
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-[0.2em]">No Incoming Invites</p>
                 </div>
                 <p className="text-[10px] text-center text-text-secondary/40 font-mono italic">Waiting for new invites...</p>
              </div>
            </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
           <div className="flex items-center justify-between border-b border-border-color pb-4">
              <h3 className="text-sm font-black uppercase tracking-widest text-text-secondary">My Past Challenges</h3>
              <CustomSelect containerClassName="w-48" value="all" onChange={()=>{}} options={[{label: "All Records", value: "all"}]} />
           </div>
           
           <div className="space-y-4">
             {MOCK_HISTORY.length > 0 ? MOCK_HISTORY.map(h => (
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
    </div>
  );
};

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
        <div className="flex items-center gap-2">
           <span className="flex items-center gap-1.5 text-[10px] font-black tracking-widest bg-success/10 text-success border border-success/20 px-2.5 py-1 rounded-lg">
             <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> {server.onlineCount} Online
           </span>
        </div>
      </div>

      <div className="space-y-1 relative z-10">
        <h3 className="text-xl font-black tracking-tight text-text-primary leading-tight group-hover:text-accent transition-colors">{server.name}</h3>
        <p className="text-xs font-bold text-text-secondary flex items-center gap-2">
          {server.habit} <span className="w-1 h-1 rounded-full bg-border-color" /> {server.mode}
        </p>
      </div>

      <div className="space-y-2 relative z-10 pt-2">
        <div className="flex justify-between text-[10px] font-mono font-black uppercase tracking-widest text-text-secondary/50">
          <span>{server.totalJoined.toLocaleString()} Users</span>
          <span>95% Active</span>
        </div>
        <div className="w-full bg-black/20 rounded-full h-1 overflow-hidden">
          <div className="bg-accent h-full w-[70%] group-hover:w-[75%] transition-all duration-700" />
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

const ChatMessage = ({ user, msg, time, self = false }) => (
  <div className={`flex flex-col ${self ? 'items-end' : 'items-start'} max-w-[90%] ${self ? 'ml-auto' : ''}`}>
    <div className="flex items-center gap-2 mb-1">
      {!self && <span className="text-[10px] font-black text-accent uppercase tracking-widest">{user}</span>}
      <span className="text-[9px] font-mono text-text-secondary/40">{time}</span>
    </div>
    <div className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed ${self ? 'bg-accent text-bg-main rounded-tr-none' : 'bg-bg-sidebar border border-border-color/50 text-text-primary rounded-tl-noneShadow-sm'}`}>
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
          className="w-full bg-accent-dim border border-border-color px-4 py-3 rounded-xl text-xs font-bold text-text-primary flex items-center justify-between hover:bg-white/[0.03] transition-all outline-none focus:border-accent"
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
