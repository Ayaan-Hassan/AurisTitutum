import React, { useState, useEffect } from "react";
import Icon from "../components/Icon";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useAuth } from "../contexts/AuthContext";
import { Input } from "../components/ui/Input";

const MOCK_PUBLIC_SERVERS = [
  {
    id: "pub1",
    name: "75 Hard Challenge",
    habit: "Fitness & Reading",
    mode: "check",
    totalJoined: 15420,
    online: 1205,
    startDate: "2026-04-01",
    endDate: "2026-06-15",
    joined: false,
  },
  {
    id: "pub2",
    name: "10k Steps Daily",
    habit: "Walking",
    mode: "count",
    totalJoined: 8321,
    online: 402,
    startDate: "2026-03-01",
    endDate: "2026-04-01",
    joined: true,
  },
  {
    id: "pub3",
    name: "LeetCode Daily",
    habit: "Coding",
    mode: "check",
    totalJoined: 5102,
    online: 890,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    joined: false,
  },
  {
    id: "pub4",
    name: "Meditation Mornings",
    habit: "Mindfulness",
    mode: "timer",
    totalJoined: 3420,
    online: 150,
    startDate: "2026-03-20",
    endDate: "2026-05-20",
    joined: false,
  }
];

const MOCK_SOCIAL_HISTORY = [
  { id: "hist1", name: "January Fitness", rank: "Top 5%", state: "Won" },
  { id: "hist2", name: "Read 10 Books", rank: "Top 20%", state: "Won" },
  { id: "hist3", name: "Morning Wakeup", rank: "Bottom 10%", state: "Lost" },
];

const SocialEngine = ({ habits }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("public"); // "public", "private", "history"
  const [servers, setServers] = useState(MOCK_PUBLIC_SERVERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeServer, setActiveServer] = useState(null); // When opened

  const joinedServers = servers.filter(s => s.joined);
  const discoverServers = servers.filter(s => !s.joined).sort((a, b) => b.totalJoined - a.totalJoined);

  const toggleJoin = (id) => {
    setServers(servers.map(s => s.id === id ? { ...s, joined: !s.joined } : s));
  };

  const openServer = (server) => {
    setActiveServer(server);
  };

  if (activeServer) {
    return (
      <div className="page-fade max-w-7xl w-full pb-20 fade-in">
        <button 
          onClick={() => setActiveServer(null)}
          className="flex items-center gap-2 mb-6 text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary hover:text-text-primary transition-all"
        >
          <Icon name="arrow-left" size={14} /> Back to Social Hub
        </button>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 space-y-6">
            <Card className="p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter text-text-primary capitalize mb-2">{activeServer.name}</h2>
                  <div className="flex gap-4">
                    <span className="text-[10px] font-mono text-text-secondary tracking-[0.2em] uppercase flex items-center gap-1">
                      <Icon name="activity" size={12} className="text-accent" /> {activeServer.habit}
                    </span>
                    <span className="text-[10px] font-mono text-text-secondary tracking-[0.2em] uppercase flex items-center gap-1">
                      <Icon name="users" size={12} className="text-success" /> {activeServer.totalJoined.toLocaleString()} Operators
                    </span>
                  </div>
                </div>
                {!activeServer.joined ? (
                  <Button variant="primary" onClick={() => toggleJoin(activeServer.id)} className="shadow-lg shadow-accent/20">Join Challenge</Button>
                ) : (
                  <Button variant="outline" onClick={() => setActiveServer(null)}>Leave</Button>
                )}
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                 <div className="bg-bg-sidebar/50 rounded-2xl p-4 border border-border-color">
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-text-secondary mb-1">Your Rank</p>
                    <p className="text-2xl font-bold font-mono text-accent">#42</p>
                 </div>
                 <div className="bg-bg-sidebar/50 rounded-2xl p-4 border border-border-color">
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-text-secondary mb-1">Your Streak</p>
                    <p className="text-2xl font-bold font-mono text-success">14d</p>
                 </div>
                 <div className="bg-bg-sidebar/50 rounded-2xl p-4 border border-border-color">
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-text-secondary mb-1">Time Left</p>
                    <p className="text-2xl font-bold font-mono text-text-primary">45d</p>
                 </div>
                 <div className="bg-bg-sidebar/50 rounded-2xl p-4 border border-border-color">
                    <p className="text-[10px] uppercase font-black tracking-[0.2em] text-text-secondary mb-1">Action</p>
                    <Button variant="primary" className="w-full mt-1 text-[10px]">Log Habit</Button>
                 </div>
              </div>

              <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
                <Icon name="trophy" size={18} className="text-yellow-500" /> Leaderboard
              </h3>
              <div className="bg-bg-main/30 rounded-2xl border border-border-color overflow-hidden">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs font-bold w-6 text-text-secondary">#{i}</span>
                      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center font-bold text-xs uppercase text-accent border border-accent/30">{String.fromCharCode(64 + i)}</div>
                      <span className="text-sm font-semibold tracking-wide">Operator_{Math.floor(Math.random() * 9000) + 1000}</span>
                    </div>
                    <div className="flex gap-4">
                      <span className="text-xs font-mono font-bold text-success">{Math.floor(Math.random() * 30 + 10)}d streak</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="w-full md:w-80 flex flex-col gap-4">
             <Card className="p-6 flex-1 flex flex-col">
               <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary mb-4 flex items-center gap-2">
                 <Icon name="message-square" size={16} /> Server Chat
               </h3>
               <div className="flex-1 bg-bg-main/50 rounded-xl border border-white/5 p-4 mb-4 min-h-[300px] flex flex-col justify-end gap-3 opacity-70">
                 <div className="text-xs text-text-secondary bg-white/5 p-3 rounded-lg rounded-tl-none self-start max-w-[85%]">Hey everyone, keep up the good work!</div>
                 <div className="text-xs text-text-primary bg-accent/20 border border-accent/20 p-3 rounded-lg rounded-tr-none self-end max-w-[85%]">Just logged my 10k steps for today.</div>
                 <div className="text-xs text-text-secondary bg-white/5 p-3 rounded-lg rounded-tl-none self-start max-w-[85%]">Consistency is key. See you at the top.</div>
               </div>
               <div className="flex gap-2">
                 <input type="text" placeholder="Send a message..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 text-xs outline-none focus:border-accent" />
                 <Button variant="primary" className="px-4"><Icon name="send" size={14} /></Button>
               </div>
             </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade max-w-7xl w-full space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-text-primary capitalize">Social Hub</h2>
          <p className="text-[10px] font-mono text-text-secondary tracking-[0.2em] uppercase mt-2">Connect, Compete, and Compound.</p>
        </div>
        <div className="flex bg-bg-sidebar p-1.5 rounded-2xl border border-border-color">
          {[
            { id: "public", label: "Public" },
            { id: "private", label: "Private" },
            { id: "history", label: "History" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all flex items-center gap-2 ${
                activeTab === tab.id 
                  ? "bg-accent text-bg-main shadow-lg shadow-accent/20" 
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "public" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex flex-wrap gap-4 items-center justify-between bg-bg-sidebar/50 p-4 rounded-3xl border border-border-color backdrop-blur-sm">
            <div className="flex gap-4">
              <select className="bg-bg-main border border-border-color rounded-xl px-4 py-2 text-xs font-bold text-text-secondary outline-none focus:border-accent cursor-pointer appearance-none">
                <option value="">All Modes</option>
                <option value="check">Check</option>
                <option value="count">Count</option>
                <option value="timer">Timer</option>
              </select>
              <select className="bg-bg-main border border-border-color rounded-xl px-4 py-2 text-xs font-bold text-text-secondary outline-none focus:border-accent cursor-pointer appearance-none">
                <option value="">Sort By</option>
                <option value="popular">Most Popular</option>
                <option value="new">Newest</option>
              </select>
            </div>
            <div className="flex gap-4 items-center w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Icon name="search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                <input 
                  type="text" 
                  placeholder="Search servers..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-bg-main border border-border-color rounded-xl pl-9 pr-4 py-2.5 text-xs text-text-primary outline-none focus:border-accent transition-all"
                />
              </div>
              <Button variant="outline" className="shrink-0 bg-accent/10 border-accent/20 text-accent hover:bg-accent hover:text-bg-main transition-colors">
                <Icon name="plus" size={14} className="mr-2" />
                Create Server
              </Button>
            </div>
          </div>

          {joinedServers.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(74,222,128,0.5)]" /> Active Servers
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {joinedServers.map(server => (
                  <ServerCard key={server.id} server={server} onOpen={openServer} onToggleJoin={toggleJoin} />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary flex items-center gap-2">
              <Icon name="globe" size={16} /> Discover
            </h3>
            <div className="grid grid-cols-1 overflow-hidden rounded-[2rem] border border-border-color bg-bg-sidebar/30 divide-y divide-border-color">
              {discoverServers.map(server => (
                <DiscoverRow key={server.id} server={server} onOpen={openServer} onToggleJoin={toggleJoin} />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "private" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <Card className="p-8 border-dashed border-2 bg-transparent text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center text-accent mb-4">
              <Icon name="user-plus" size={24} />
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-2">Invite Friends via UID</h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto mb-6">Create a private server and invite your friends using their unique ID found in Settings.</p>
            <div className="flex max-w-md mx-auto gap-2">
               <Input placeholder="Enter Friend's UID" className="flex-1" />
               <Button variant="primary">Send Invite</Button>
            </div>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <Card className="p-6 opacity-60 grayscale cursor-not-allowed">
               <h4 className="font-bold text-text-primary mb-1">Company Hustle (Private)</h4>
               <p className="text-xs text-text-secondary mb-4">You & 3 friends</p>
               <Button variant="outline" className="w-full text-xs" disabled>Coming Soon</Button>
             </Card>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-6 animate-in fade-in duration-500">
           <h3 className="text-sm font-bold uppercase tracking-widest text-text-secondary flex items-center gap-2">
             <Icon name="clock" size={16} /> Social History
           </h3>
           <Card className="overflow-hidden">
             {MOCK_SOCIAL_HISTORY.map((hist, idx) => (
                <div key={hist.id} className={`p-5 flex items-center justify-between hover:bg-white/5 transition-colors ${idx !== 0 ? 'border-t border-border-color' : ''}`}>
                  <div>
                    <h4 className="font-bold text-text-primary text-sm">{hist.name}</h4>
                    <p className="text-xs text-text-secondary font-mono mt-1">Challenge Completed</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-black uppercase tracking-wider mb-1 ${hist.state === 'Won' ? 'text-success' : 'text-danger'}`}>{hist.state}</p>
                    <p className="text-[10px] text-text-secondary font-mono">{hist.rank}</p>
                  </div>
                </div>
             ))}
           </Card>
        </div>
      )}
    </div>
  );
};

const ServerCard = ({ server, onOpen, onToggleJoin }) => (
  <Card 
    className="p-0 overflow-hidden group cursor-pointer hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/10 transition-all border-none bg-gradient-to-br from-bg-sidebar to-bg-main relative"
    onClick={() => onOpen(server)}
  >
    <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
    <div className="p-6 relative z-10">
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center text-accent font-bold">
          <Icon name="activity" size={20} />
        </div>
        <div className="flex gap-2">
           <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest bg-success/10 text-success px-2 py-1 rounded-md">
             <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> {server.online} Online
           </span>
        </div>
      </div>
      <h3 className="text-lg font-black tracking-tight text-text-primary mb-1">{server.name}</h3>
      <p className="text-xs text-text-secondary font-mono mb-4">{server.habit} • {server.mode}</p>
      
      <div className="w-full bg-black/20 rounded-full h-1.5 mb-2 overflow-hidden">
        <div className="bg-accent h-full w-[65%]" />
      </div>
      <p className="text-[9px] font-mono text-text-secondary uppercase tracking-[0.2em] mb-4">
        {server.totalJoined.toLocaleString()} / 20k Capacity
      </p>

      <div className="flex justify-between items-center text-[9px] text-text-secondary/60 font-mono uppercase tracking-[0.1em] border-t border-white/5 pt-4 mt-2">
         <span>{server.startDate}</span>
         <Icon name="arrow-right" size={10} />
         <span>{server.endDate}</span>
      </div>
    </div>
  </Card>
);

const DiscoverRow = ({ server, onOpen, onToggleJoin }) => (
  <div 
    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-bg-main/50 transition-colors cursor-pointer"
    onClick={() => onOpen(server)}
  >
    <div className="flex items-center gap-5">
      <div className="w-12 h-12 rounded-2xl bg-bg-main border border-border-color flex items-center justify-center text-text-secondary group-hover:text-accent group-hover:border-accent/40 transition-colors shrink-0">
        <Icon name="hash" size={20} />
      </div>
      <div className="min-w-0">
        <h4 className="font-bold text-text-primary mb-0.5 truncate">{server.name}</h4>
        <p className="text-[11px] font-mono text-text-secondary truncate">{server.habit} • {server.totalJoined.toLocaleString()} joined</p>
      </div>
    </div>
    <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end w-full sm:w-auto mt-2 sm:mt-0">
      <div className="text-right hidden md:block">
        <p className="text-[10px] uppercase font-black tracking-widest text-text-secondary mb-1">Ends In</p>
        <p className="text-xs font-mono text-text-primary">24 Days</p>
      </div>
      <Button 
        variant="primary" 
        className="text-[10px] w-full sm:w-auto"
        onClick={(e) => {
          e.stopPropagation();
          onToggleJoin(server.id);
        }}
      >
        Join
      </Button>
    </div>
  </div>
);

export default SocialEngine;
