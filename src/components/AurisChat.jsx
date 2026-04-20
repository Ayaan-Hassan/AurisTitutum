import { useState, useRef, useEffect } from 'react';
import Icon from './Icon';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase.config';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, getDoc, doc, getDocs, orderBy, limit } from 'firebase/firestore';

const ADMIN_CODE = "7@XEON1215225";
const ADMIN_UID = "inB7hQ7PAuRxt19mBZ3xKe8unaV2";

export default function AurisChat({ user, isOpen, onClose, userConfig, habits, notes, reminders, notifications }) {
  const { updateUserConfig, peerMessages: globalPeerMessages, clearUnreadPeerCount } = useAuth();
  
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'System initialized. I am Titum AI, your behavioral analyst and execution coach. Let\'s review your data.' }
  ]);
  const [peerMessages, setPeerMessages] = useState([]);
  const [isWaitingForPeer, setIsWaitingForPeer] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [peerId, setPeerId] = useState(null);
  const [peerName, setPeerName] = useState('');
  
  const isBioBotActive = peerId === ADMIN_UID;

  useEffect(() => {
    if (isOpen) {
      clearUnreadPeerCount?.();
    }
  }, [isOpen, clearUnreadPeerCount]);

  const [showConnectModal, setShowConnectModal] = useState(false);
  const [peerCodeInput, setPeerCodeInput] = useState('');
  const [isConnecting, setIsLoadingLocal] = useState(false);
  const messagesEndRefDesktop = useRef(null);
  const messagesEndRefMobile = useRef(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Sync peerMessages from global state
  useEffect(() => {
    if (peerId && user?.uid) {
      const filtered = globalPeerMessages
        .filter(m => 
          m.participants?.includes(user.uid) && m.participants?.includes(peerId)
        )
        .map(m => ({
          ...m,
          role: m.from === user.uid ? 'user' : 'assistant'
        }));
      
      setPeerMessages(filtered);
      
      // Determine if we are waiting for a reply
      const isAdmin = user.uid === "inB7hQ7PAuRxt19mBZ3xKe8unaV2";
      if (!isAdmin) {
        // If guest has sent a message and waiting, OR if chat is empty (waiting for first connection)
        if (filtered.length > 0) {
          const lastMsg = filtered[filtered.length - 1];
          setIsWaitingForPeer(lastMsg.from === user.uid);
        } else {
          // Empty chat, just connecting
          setIsWaitingForPeer(true);
        }
      } else {
        // Admin only sees waiting if they actually sent a message recently
        const lastMsg = filtered[filtered.length - 1];
        setIsWaitingForPeer(lastMsg && lastMsg.from === user.uid);
      }
    } else {
      setPeerMessages([]);
      setIsWaitingForPeer(false);
    }
  }, [globalPeerMessages, peerId, user?.uid]);
  
  // Sync state with userConfig for auto-handshake
  useEffect(() => {
    if (userConfig?.connectedPeerId && userConfig.connectedPeerId !== peerId) {
      setPeerId(userConfig.connectedPeerId);
      setPeerName(userConfig.connectedPeerName || 'Peer User');
    } else if (!userConfig?.connectedPeerId && peerId) {
      // Don't auto-disconnect if we are in the middle of a session? 
      // Actually, if it's cleared in Firestore, clear it here.
      setPeerId(null);
      setPeerName('');
    }
  }, [userConfig?.connectedPeerId, userConfig?.connectedPeerName]);

  const handleClearChat = () => {
    if (peerId) {
      setPeerMessages([]);
    } else {
      setMessages([
        { role: 'assistant', content: 'System initialized. I am Titum AI, your behavioral analyst and execution coach. Let\'s review your data.' }
      ]);
    }
  };

  const handleExitPeerChat = async () => {
    setPeerId(null);
    setPeerName('');
    setPeerMessages([]);
    
    // Persist disconnection to Firestore
    try {
      await updateUserConfig({
        connectedPeerId: null,
        connectedPeerName: ''
      });
      
      const toastEvent = new CustomEvent("showToast", {
        detail: { message: "Disconnected from peer chat.", type: "info" },
      });
      document.dispatchEvent(toastEvent);
    } catch (err) {
      console.error("Failed to persist disconnection:", err);
    }
  };

  const handleConnectPeer = async () => {
    if (!user) {
      const toastEvent = new CustomEvent("showToast", {
        detail: { message: "Sign in to connect with BioBot.", type: "warning" },
      });
      document.dispatchEvent(toastEvent);
      return;
    }
    if (!peerCodeInput.trim()) return;

    setIsLoadingLocal(true);
    try {
      if (peerCodeInput.trim().toUpperCase() !== ADMIN_CODE) {
        const toastEvent = new CustomEvent("showToast", {
          detail: { message: "Invalid Access Code. Access Denied.", type: "error" },
        });
        document.dispatchEvent(toastEvent);
        setIsLoadingLocal(false);
        return;
      }

      if (ADMIN_UID === user.uid) {
        const toastEvent = new CustomEvent("showToast", {
          detail: { message: "System Error: Admin cannot connect to self.", type: "warning" },
        });
        document.dispatchEvent(toastEvent);
        setIsLoadingLocal(false);
        return;
      }

      const targetUid = ADMIN_UID;
      const name = "BioBot";

      setPeerId(targetUid);
      setPeerName(name);
      setShowConnectModal(false);
      setPeerCodeInput('');

      // Persist connection state to Firestore
      try {
        await updateUserConfig({
          connectedPeerId: targetUid,
          connectedPeerName: name
        });
        
        const toastEvent = new CustomEvent("showToast", {
          detail: { message: `Secure Connection to ${name} Established!`, type: "success" },
        });
        document.dispatchEvent(toastEvent);
      } catch (err) {
        console.error("Failed to persist connection:", err);
      }

    } catch (err) {
      console.error("Connection error:", err);
      const toastEvent = new CustomEvent("showToast", {
        detail: { message: "Connection to BioBot failed.", type: "error" },
      });
      document.dispatchEvent(toastEvent);
    } finally {
      setIsLoadingLocal(false);
    }
  };

  useEffect(() => {
    if (userConfig?.connectedPeerId && userConfig.connectedPeerId !== peerId) {
      setPeerId(userConfig.connectedPeerId);
      setPeerName(userConfig.connectedPeerName || 'Peer User');
    } else if (!userConfig?.connectedPeerId && peerId) {
      setPeerId(null);
      setPeerName('');
    }
  }, [userConfig?.connectedPeerId, userConfig?.connectedPeerName]);

  useEffect(() => {
    if (messagesEndRefDesktop.current) {
      messagesEndRefDesktop.current.scrollIntoView({ behavior: 'smooth' });
    }
    if (messagesEndRefMobile.current) {
      messagesEndRefMobile.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const determineComplexity = (prompt) => {
    const isComplex = prompt.length > 200 || 
                      /why|how|explain|analyze|compare|evaluate|calculate|solve/i.test(prompt) ||
                      /(?:\r?\n){2,}/.test(prompt);
    return isComplex ? 'complex' : 'simple';
  };

  const fetchWithTimeout = async (resource, options = {}) => {
    const { timeout = 15000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, {
        ...options,
        signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    if (peerId) {
      const msgText = input.trim();
      setInput('');
      
      const optimisticMsg = {
        id: 'temp-' + Date.now(),
        content: msgText,
        from: user.uid,
        to: peerId,
        participants: [user.uid, peerId],
        role: 'user',
        timestamp: null // Will be handled by sorting logic
      };

      setPeerMessages(prev => [...prev, optimisticMsg]);
      
      try {
        await addDoc(collection(db, "titum_connect_messages"), {
          from: user.uid,
          fromName: userConfig.name || "Peer User",
          to: peerId,
          participants: [user.uid, peerId],
          content: msgText,
          timestamp: serverTimestamp(),
          conversationId: user.uid < peerId ? `${user.uid}_${peerId}` : `${peerId}_${user.uid}`
        });
      } catch (err) {
        console.error("Critical Send Error:", err);
        // Remove optimistic message on actual failure
        setPeerMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        
        const toastEvent = new CustomEvent("showToast", {
          detail: { 
            message: `Send Failed: ${err.code === 'permission-denied' ? "Check your Firebase Rules" : err.message}`, 
            type: "error" 
          },
        });
        document.dispatchEvent(toastEvent);
      }
      return;
    }

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const complexity = determineComplexity(userMessage.content);
    
    // Model fallback sequence (OpenRouter)
    const primaryModel = import.meta.env.VITE_MODEL_PRIMARY || 'google/gemma-3-27b-it';
    const secondaryModel = import.meta.env.VITE_MODEL_SECONDARY || 'meta-llama/llama-3.3-70b-instruct';
    const fallbackModel = import.meta.env.VITE_MODEL_FALLBACK || 'mistralai/mistral-7b-instruct';

    let modelToUse = complexity === 'complex' ? secondaryModel : primaryModel;
    let fallbackToUse = fallbackModel;

    const habitContext = habits && habits.length > 0 
      ? `Their tracked habits and raw data:\n${habits.map(h => {
          const recentLogs = h.logs ? h.logs.slice(-60) : [];
          const logsStr = recentLogs.length > 0 
            ? recentLogs.map(l => `[${l.date}: ${l.mode || 'Success'}]`).join(', ') 
            : 'No logs yet';
          
          const totalCompletions = h.logs ? h.logs.filter(l => l.count > 0).length : 0;
          const currentStreak = h.streak || 0;
          
          return `- **${h.name}**
  | Type: ${h.type || 'N/A'}
  | Mode: ${h.mode || 'N/A'}
  | Unit: ${h.unit || 'count'}
  | Frequency: ${h.frequency || 'Daily'}
  | Total completions: ${totalCompletions}
  | Current Streak: ${currentStreak}
  | Recent History: ${logsStr}`;
        }).join('\n\n')}` 
      : "They have no habits tracked yet.";
      
    const notesContext = notes && notes.length > 0 ? `Notes they wrote: ${notes.map(n => n.title).join(', ')}.` : "";
    const remindersContext = reminders && reminders.length > 0 ? `Active reminders: ${reminders.map(r => r.title).join(', ')}.` : "";
    const notificationsContext = notifications && notifications.length > 0 ? `Recent notifications: ${notifications.map(n => n.title).join(', ')}.` : "";

    const userNameContext = userConfig && userConfig.name ? `The user's name is ${userConfig.name}.` : "";

    const systemPrompt = `You are Titum AI, a production-level AI habit analysis and behavior correction system, NOT a motivational chatbot. Act as a high-performance behavioral analyst and execution coach. ${userNameContext}
${habitContext}
${notesContext}
${remindersContext}
${notificationsContext}

🔥 CORE OBJECTIVE
Transform user behavior using data-driven analysis, psychological pattern recognition, ruthless clarity, and actionable execution. No generic advice, empty motivation, or repetitive templates.

🧠 INTELLIGENCE MODEL (MANDATORY)
Operate using this hierarchy:
1. Reality (What is actually happening)
2. Root Cause (Why it's happening)
3. Pattern Detection (What repeats)
4. Prediction (What will happen next)
5. Execution (What to do NOW)

⚙️ BEHAVIOR ENGINE RULES
1. CONSISTENCY FAILURE DETECTION: If user quits habits after 3-4 days -> Identify "motivation-based system failure" -> Switch to system-building mode.
2. SLEEP PRIORITY OVERRIDE: If sleep is inconsistent -> Ignore productivity optimization -> Focus ONLY on fixing sleep.
3. DOPAMINE LOOP DETECTION: If late night scrolling or bad habits shown -> Identify dopamine overload -> Connect to inconsistency.
4. ZERO STREAK MODE: If all habit streaks = 0 -> Reduce everything to ONE action only.
5. FAKE LOG DETECTION: If user admits faking habits -> Call it out directly -> Explain "no real progress possible".

🧩 RESPONSE FRAMEWORK (STRICT)
Every answer MUST follow:
1. Reality: Brutal, direct truth of what's happening.
2. Root Cause: WHY based on data.
3. Pattern: Repeating behavioral cycle.
4. ONE ACTION: ONLY one small task.
5. RULE / CONSTRAINT: A strict, non-negotiable rule.

🧨 TONE SYSTEM
Adapt based on user state:
- Frustrated/angry -> Direct, sharp, controlled
- Confused -> Clear, structured
- Lazy/unmotivated -> Minimal, command-based
- Consistent -> Slightly encouraging
NEVER: Overly soft, therapist-style, or long emotional paragraphs. NEVER use emojis warmly.

🚫 HARD RESTRICTIONS
- DO NOT give long plans, multiple actions, generic advice, or praise unnecessarily.
- NO HALLUCINATION: Only use the raw logs provided. If a habit has "No logs yet", say exactly that.
- FORMATTING/UI RULES: Wrap critical metrics, habit names, and advice in **double asterisks** ONLY. This activates color-coding in the UI. (e.g., "**Sleep before 12**")
- NO OTHER MARKDOWN: Do not use headers, bullet points, or italics. Only use **bold** for highlights. Use single line breaks.

💣 EXAMPLE OUTPUT
You don't have a discipline problem.
Your sleep is destroying your consistency.

You sleep late -> low energy -> skip habits -> feel guilty -> repeat.

Action: **Sleep before 12 tonight.**
Rule: **No phone after 11.**`;

    const attemptFetch = async (model) => {
      if (!import.meta.env.VITE_OPENROUTER_KEY) {
        throw new Error("API Key Missing: VITE_OPENROUTER_KEY is not defined in the build. If on Vercel, please trigger a full Redeploy.");
      }

      const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.href,
          "X-Title": "Titum AI",
        },
        body: JSON.stringify({
          model: model,
          stream: true,
          messages: [
            { role: "system", content: systemPrompt },
            ...newMessages
          ]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenRouter Error (${response.status}): ${errText}`);
      }
      return response;
    };

    const processStream = async (response) => {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let assistantMessage = "";
      
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      setIsLoading(false);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line === 'data: [DONE]') return;
          if (line.startsWith('data: ')) {
              try {
                  const data = JSON.parse(line.slice(6));
                  if (data.choices?.[0]?.delta?.content) {
                      assistantMessage += data.choices[0].delta.content;
                      setMessages(prev => {
                          const newMsgs = [...prev];
                          newMsgs[newMsgs.length - 1] = { role: 'assistant', content: assistantMessage };
                          return newMsgs;
                      });
                  }
              } catch (e) {
                  // handle parse err silently
              }
          }
        }
      }
    };

    try {
      let res = await attemptFetch(modelToUse);
      await processStream(res);
    } catch (error) {
      console.warn(`Request with ${modelToUse} failed:`, error.message);
      try {
        let resFallback = await attemptFetch(fallbackToUse);
        await processStream(resFallback);
      } catch (fallbackError) {
        console.error("All models failed", fallbackError.message);
        
        let errorMessage = "I'm having trouble connecting to my brain right now.";
        
        if (fallbackError.message.includes("API Key Missing")) {
           errorMessage = "VITE_OPENROUTER_KEY is missing! If you just added it in Vercel, you *must* trigger a new deployment for Vite to embed it.";
        } else if (fallbackError.message.includes("OpenRouter Error")) {
           errorMessage = `OpenRouter rejected the model request. Check API key and credits. Details: ${fallbackError.message}`;
        }
        
        setMessages([...newMessages, { role: 'assistant', content: errorMessage }]);
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  // Use a normal function returning JSX to prevent React from unmounting focus state on typing
  const renderFormattedText = (text) => {
    if (!text) return null;
    const parts = text.split(/\*\*(.*?)\*\*/g);
    const colors = [
      '#60a5fa', // Bright Blue
      '#f472b6', // Pink
      '#34d399', // Emerald
      '#fbbf24', // Amber
      '#a78bfa', // Purple
      '#ffffff'  // White
    ];
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        const color = colors[((index - 1) / 2) % colors.length];
        return (
          <span key={index} className="font-extrabold tracking-tight" style={{ color, textShadow: '0 0 10px rgba(255,255,255,0.1)' }}>
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const renderChatContent = (isMobile) => {
    const activeMessages = peerId ? peerMessages : messages;
    
    return (
    <>
      <div className={`flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 custom-scrollbar scroll-smooth transition-all duration-1000 ${isBioBotActive ? 'bg-[#020617] relative' : ''}`}>
        {isBioBotActive && (
          <>
            <div className="absolute inset-0 pointer-events-none opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(56, 189, 248, 0.05) 0%, transparent 75%)' }} />
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/10 to-transparent shadow-[0_0_15px_rgba(56,189,248,0.1)]" />
          </>
        )}
        {(isBioBotActive ? peerMessages : (peerId ? peerMessages : messages)).map((msg, index) => (
          <div key={msg.id || index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group animate-in fade-in slide-in-from-bottom-2 duration-500 relative z-10`}>
            {(msg.role === 'assistant' || (peerId && msg.from !== user?.uid)) && (
              <div className="flex items-center gap-2.5 mb-2 opacity-50 group-hover:opacity-100 transition-all">
                <div className={`w-1.5 h-1.5 rounded-full ${isBioBotActive ? 'bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]' : 'bg-accent'}`} />
                <span className={`text-[9px] font-black tracking-[0.25em] uppercase font-mono ${isBioBotActive ? 'text-sky-400/80' : 'text-text-secondary'}`}>
                  {peerId ? (msg.from === user?.uid ? "Command Center" : (isBioBotActive ? "BioBot Master" : peerName)) : "Titum Core"}
                </span>
              </div>
            )}
            
            <div 
              className={`max-w-[85%] px-5 py-3.5 rounded-2xl text-[13px] leading-relaxed transition-all duration-500 ${
                msg.role === 'user' 
                  ? (isBioBotActive 
                      ? 'bg-slate-900/50 border border-slate-800 text-slate-100 rounded-tr-none shadow-lg' 
                      : 'bg-accent text-bg-main font-medium rounded-tr-none shadow-lg shadow-accent/10')
                  : (isBioBotActive 
                      ? 'bg-white/[0.02] border border-white/[0.05] backdrop-blur-md text-slate-200 rounded-tl-none border-l-sky-500/40 border-l-2 shadow-2xl' 
                      : 'bg-bg-main border border-border-color text-text-primary rounded-tl-none shadow-sm')
              }`}
              style={isBioBotActive ? { boxShadow: msg.role === 'user' ? 'none' : 'inset 0 0 40px rgba(255,255,255,0.01)' } : {}}
            >
              <div className={`whitespace-pre-wrap tracking-wide font-medium ${isBioBotActive ? 'text-slate-200' : ''}`}>
                {msg.role === 'assistant' && !peerId ? renderFormattedText(msg.content) : msg.content}
              </div>
            </div>
            
            {msg.timestamp && (isBioBotActive || peerId) && (
              <span className={`text-[8px] mt-2 opacity-20 font-mono tracking-widest uppercase font-black ${isBioBotActive ? 'text-sky-200' : ''}`}>
                {msg.timestamp?.toMillis ? new Date(msg.timestamp.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Encrypted"}
              </span>
            )}
          </div>
        ))}
        {(isLoading || isWaitingForPeer) && (
          <div className="flex justify-start relative z-10">
            <div className={`max-w-[85%] rounded-2xl p-5 flex flex-col gap-3 ${isBioBotActive ? 'bg-slate-900/40 border border-white/5 text-sky-400/70 rounded-tl-none shadow-2xl backdrop-blur-sm' : 'bg-bg-main border border-border-color text-text-primary rounded-tl-none'}`}>
              <div className="flex items-center gap-3">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-sky-500 rounded-full animate-pulse" />
                  <div className="w-1.5 h-1.5 bg-sky-500/50 rounded-full animate-pulse delay-75" />
                  <div className="w-1.5 h-1.5 bg-sky-500/20 rounded-full animate-pulse delay-150" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] font-mono whitespace-nowrap">
                  {isWaitingForPeer ? "Analyzing Bio-Metrics..." : "Processing Command..."}
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={isMobile ? messagesEndRefMobile : messagesEndRefDesktop} className="h-6" />
      </div>

      <div className={`p-5 border-t shrink-0 transition-all duration-1000 ${isBioBotActive ? 'bg-[#020617] border-white/5' : 'bg-bg-main border-border-color'}`}>
        <div className="relative flex items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isBioBotActive ? "Execute Transmission..." : (peerId ? `Message ${peerName}...` : "Ask Titum AI...")}
            className={`w-full border rounded-xl py-3.5 px-5 text-sm focus:outline-none transition-all duration-500 resize-none min-h-[48px] max-h-32 custom-scrollbar font-medium ${
              isBioBotActive 
                ? 'bg-slate-900/50 border-white/5 text-slate-100 placeholder:text-slate-600 focus:border-sky-500/30 focus:ring-1 focus:ring-sky-500/10' 
                : 'bg-bg-main border-border-color text-text-primary placeholder:text-text-secondary focus:border-accent focus:ring-1 focus:ring-accent'
            }`}
            rows={1}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              isBioBotActive 
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-900/20 hover:bg-sky-500 hover:shadow-sky-500/20' 
                : 'bg-accent text-bg-main shadow-lg shadow-accent/10 hover:opacity-90'
            }`}
          >
            <Icon name="send" size={18} />
          </button>
        </div>
        <p className={`text-center mt-3 text-[9px] font-black uppercase tracking-[0.2em] transition-colors duration-1000 ${isBioBotActive ? 'text-slate-700' : 'text-text-secondary'}`}>
          {isBioBotActive ? "Secure Admin Terminal Connection Active" : "Titum AI may produce inaccurate information about habits."}
        </p>
      </div>
    </>
    );
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 animate-in fade-in duration-1000 ${isBioBotActive ? 'bg-slate-950/80 backdrop-blur-2xl' : 'bg-black/50 backdrop-blur-md'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Desktop */}
      <div className={`hidden md:flex fixed top-0 right-0 bottom-0 w-full max-w-md bg-bg-main border-l shadow-2xl z-50 flex-col animate-in slide-in-from-right transition-all duration-1000 ${isBioBotActive ? 'border-white/5' : 'border-border-color'}`}>
        <div className={`flex items-center justify-between p-5 border-b shrink-0 transition-all duration-1000 ${isBioBotActive ? 'bg-[#020617] border-white/5' : 'border-border-color'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-1000 ${isBioBotActive ? 'bg-sky-500 shadow-2xl shadow-sky-500/20' : 'bg-accent/20'}`}>
              <Icon name={isBioBotActive ? "shield-check" : (peerId ? "users" : "brain")} size={22} className={isBioBotActive ? "text-white" : "text-accent"} />
            </div>
            <div>
              <h2 className={`font-black tracking-tight transition-all duration-1000 ${isBioBotActive ? 'text-sky-100 text-xl font-bold' : 'text-text-primary text-lg'}`}>
                {isBioBotActive ? "BioBot Protocol" : (peerId ? peerName : "Titum AI")}
              </h2>
              <p className={`text-[10px] uppercase tracking-[0.4em] font-mono font-black ${isBioBotActive ? 'text-sky-500 animate-pulse' : 'text-success'}`}>
                {isBioBotActive ? "Active Link" : (peerId ? "Linked" : "Online")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {peerId ? (
              <button 
                onClick={handleExitPeerChat}
                title="Exit Chat"
                className={`px-3 h-9 rounded-lg border flex items-center justify-center text-[10px] uppercase font-black tracking-widest transition-all gap-2 ${isBioBotActive ? 'border-amber-500/30 text-amber-500/70 hover:bg-amber-500/10' : 'border-border-color text-text-secondary hover:text-red-500 hover:bg-red-500/10'}`}
              >
                <Icon name="log-out" size={14} />
                Disconnect
              </button>
            ) : (
              <button 
                onClick={() => setShowConnectModal(true)} 
                title="Connect with BioBot"
                className="w-9 h-9 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
              >
                <Icon name="terminal" size={14} />
              </button>
            )}
            <button 
              onClick={handleClearChat} 
              title="New Chat"
              className="w-9 h-9 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-accent/10 transition-colors"
            >
              <Icon name="rotate-ccw" size={14} />
            </button>
            <button onClick={onClose} className="w-9 h-9 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        {renderChatContent(false)}
      </div>

      {/* Mobile */}
      <div className="md:hidden fixed inset-x-0 bottom-0 top-[10%] z-50 flex flex-col pointer-events-none">
        <div
          className="flex-1 bg-bg-main border-t border-border-color rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 pointer-events-auto flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`flex items-center justify-between p-4 border-b shrink-0 transition-all duration-700 ${isBioBotActive ? 'bg-amber-500/5 border-amber-500/20' : 'border-border-color'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-700 ${isBioBotActive ? 'bg-amber-500 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.4)]' : 'bg-accent/20'}`}>
                <Icon name={isBioBotActive ? "command" : (peerId ? "users" : "brain")} size={18} className={isBioBotActive ? "text-bg-main" : "text-accent"} />
              </div>
              <div>
                <h2 className={`text-sm font-black tracking-tight transition-colors duration-700 ${isBioBotActive ? 'text-amber-500 uppercase italic' : 'text-text-primary leading-tight'}`}>{isBioBotActive ? "BioBot" : (peerId ? peerName : "Titum AI")}</h2>
                <p className={`text-[9px] uppercase tracking-widest font-mono font-bold ${isBioBotActive ? 'text-amber-500/60' : 'text-success'}`}>{isBioBotActive ? "Master Control" : (peerId ? "Connected" : "Online")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {peerId ? (
                <button 
                  onClick={handleExitPeerChat}
                  title="Exit Chat"
                  className={`px-2 h-8 rounded-lg border flex items-center justify-center text-[9px] uppercase font-black tracking-widest transition-all gap-1.5 ${isBioBotActive ? 'border-amber-500/30 text-amber-500/70 hover:bg-amber-500/10' : 'border-border-color text-text-secondary hover:text-red-500'}`}
                >
                  <Icon name="log-out" size={12} />
                  Exit
                </button>
              ) : (
                <button 
                  onClick={() => setShowConnectModal(true)} 
                  title="Connect with BioBot"
                  className="w-8 h-8 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                >
                  <Icon name="terminal" size={12} />
                </button>
              )}
              <button 
                onClick={handleClearChat} 
                title="New Chat"
                className="w-8 h-8 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-accent/10 transition-colors"
              >
                <Icon name="rotate-ccw" size={12} />
              </button>
              <button onClick={onClose} className="w-8 h-8 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
                <Icon name="x" size={14} />
              </button>
            </div>
          </div>
          
          {renderChatContent(true)}
        </div>
      </div>
      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 transition-all">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowConnectModal(false)} />
          <div className="relative w-full max-w-sm bg-bg-main border border-border-color rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-text-primary mb-2 tracking-tighter flex items-center gap-2 uppercase italic">
              <Icon name="command" size={20} className="text-amber-500" />
              BioBot Protocol
            </h3>
            <p className="text-xs text-text-secondary mb-8 leading-relaxed font-medium">
              Initialize secure connection to the Admin terminal. Enter the decrypted access code to proceed.
            </p>
            
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-3 font-mono">
                  &gt; IDENTIFY_TOKEN
                </label>
                <input
                  type="text"
                  value={peerCodeInput}
                  onChange={(e) => setPeerCodeInput(e.target.value)}
                  placeholder="********"
                  className="w-full bg-black/40 border border-amber-500/30 rounded-xl py-4 px-4 text-center font-mono text-lg font-bold tracking-[0.2em] text-amber-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-all"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConnectPeer();
                  }}
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowConnectModal(false)}
                  className="flex-1 px-4 py-4 rounded-xl border border-border-color text-[11px] font-bold uppercase tracking-widest text-text-secondary hover:bg-white/5 transition-all"
                >
                  Abort
                </button>
                <button 
                  onClick={handleConnectPeer}
                  disabled={!peerCodeInput.trim() || isConnecting}
                  className="flex-1 px-4 py-4 rounded-xl bg-amber-500 text-bg-main text-[11px] font-black uppercase tracking-[0.2em] hover:opacity-90 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                >
                  {isConnecting ? "LINKING..." : "INITIALIZE"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
