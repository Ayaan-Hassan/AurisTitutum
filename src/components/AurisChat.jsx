import { useState, useRef, useEffect } from 'react';
import Icon from './Icon';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase.config';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, getDoc, doc, getDocs, orderBy, limit } from 'firebase/firestore';

export default function AurisChat({ user, isOpen, onClose, userConfig, habits, notes, reminders, notifications }) {
  const { updateUserConfig, peerMessages: globalPeerMessages } = useAuth();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'System initialized. I am Titum AI, your behavioral analyst and execution coach. Let\'s review your data.' }
  ]);
  const [peerMessages, setPeerMessages] = useState([]);
  const [isWaitingForPeer, setIsWaitingForPeer] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [peerId, setPeerId] = useState(null);
  const [peerName, setPeerName] = useState('');
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [peerCodeInput, setPeerCodeInput] = useState('');
  const [isConnecting, setIsLoadingLocal] = useState(false);
  const messagesEndRefDesktop = useRef(null);
  const messagesEndRefMobile = useRef(null);

  // Sync peerMessages from global state
  useEffect(() => {
    if (peerId && user?.uid) {
      // Find all messages between these two specific UIDs regardless of who is sender
      const filtered = globalPeerMessages
        .filter(m => 
          (m.from === user.uid && m.to === peerId) || 
          (m.from === peerId && m.to === user.uid)
        )
        .map(m => ({
          ...m,
          role: m.from === user.uid ? 'user' : 'assistant'
        }));
      
      setPeerMessages(filtered);
      
      // Determine if we are waiting for a reply
      if (filtered.length > 0) {
        const lastMsg = filtered[filtered.length - 1];
        setIsWaitingForPeer(lastMsg.from === user.uid);
      } else {
        setIsWaitingForPeer(false);
      }
    } else {
      setPeerMessages([]);
      setIsWaitingForPeer(false);
    }
  }, [globalPeerMessages, peerId, user?.uid]);

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
        detail: { message: "Sign in to connect with others.", type: "warning" },
      });
      document.dispatchEvent(toastEvent);
      return;
    }
    if (!peerCodeInput.trim()) return;

    setIsLoadingLocal(true);
    try {
      // 1. Find user ID by code
      const codeRef = doc(db, "secret_codes", peerCodeInput.trim().toUpperCase());
      const codeSnap = await getDoc(codeRef);

      if (!codeSnap.exists()) {
        const toastEvent = new CustomEvent("showToast", {
          detail: { message: "Invalid secret code. Please check and try again.", type: "error" },
        });
        document.dispatchEvent(toastEvent);
        setIsLoadingLocal(false);
        return;
      }

      const targetUid = codeSnap.data().uid;
      if (targetUid === user.uid) {
        const toastEvent = new CustomEvent("showToast", {
          detail: { message: "You cannot connect with yourself.", type: "warning" },
        });
        document.dispatchEvent(toastEvent);
        setIsLoadingLocal(false);
        return;
      }

      // 2. Fetch peer's display name
      let name = "Peer User";
      try {
        const rootRef = doc(db, "users", targetUid);
        const rootSnap = await getDoc(rootRef);
        if (rootSnap.exists()) {
          name = rootSnap.data().displayName || rootSnap.data().name || "Peer User";
        } else {
          const peerProfileRef = doc(db, "users", targetUid, "settings", "profile");
          const peerProfileSnap = await getDoc(peerProfileRef);
          if (peerProfileSnap.exists()) {
            const data = peerProfileSnap.data();
            name = data.name || data.displayName || "Peer User";
          }
        }
      } catch (profileErr) {
        console.warn("Could not fetch peer profile name:", profileErr);
      }

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
          detail: { message: `Connected to ${name} successfully!`, type: "success" },
        });
        document.dispatchEvent(toastEvent);
      } catch (err) {
        console.error("Failed to persist connection:", err);
      }

    } catch (err) {
      console.error("Connection error:", err);
      const toastEvent = new CustomEvent("showToast", {
        detail: { message: "An error occurred while connecting.", type: "error" },
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
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
        {activeMessages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-2xl p-3 sm:p-4 text-xs sm:text-sm leading-relaxed shadow-sm transition-all ${
                msg.role === 'user' 
                  ? 'bg-accent text-bg-main rounded-tr-sm animate-in fade-in slide-in-from-bottom-2 duration-300' 
                  : 'bg-bg-main border border-border-color text-text-primary rounded-tl-sm animate-in fade-in slide-in-from-left-2 zoom-in-95 duration-500'
              }`}
            >
              {(msg.role === 'assistant' || (peerId && msg.from !== user?.uid)) && (
                <div className="flex items-center gap-1.5 mb-2 opacity-80">
                  <Icon name={peerId ? "user" : "brain"} size={12} className="text-accent" />
                  <span className="text-[10px] font-bold tracking-wider uppercase font-mono">
                    {peerId ? (msg.from === user?.uid ? "You" : peerName) : "Titum AI"}
                  </span>
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.role === 'assistant' && !peerId ? renderFormattedText(msg.content) : msg.content}</div>
            </div>
          </div>
        ))}
        {(isLoading || isWaitingForPeer) && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl p-4 bg-bg-main border border-border-color text-text-primary rounded-tl-sm flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black text-accent uppercase tracking-widest font-mono">
                  {isWaitingForPeer ? `Waiting for ${peerName}...` : "Titum AI"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={isMobile ? messagesEndRefMobile : messagesEndRefDesktop} />
      </div>

      <div className="p-4 border-t border-border-color bg-bg-main shrink-0">
        <div className="relative flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={peerId ? `Message ${peerName}...` : "Ask Titum AI..."}
            className="w-full bg-bg-main border border-border-color rounded-xl py-3 px-4 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent resize-none min-h-[44px] max-h-32 custom-scrollbar"
            rows={1}
            style={{
              height: 'auto',
            }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="w-11 h-11 shrink-0 rounded-xl bg-accent text-bg-main flex items-center justify-center hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="send" size={16} />
          </button>
        </div>
        <p className="text-center mt-2 text-[9px] text-text-secondary">
          Titum AI may produce inaccurate information about habits.
        </p>
      </div>
    </>
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-md z-40 animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Desktop */}
      <div className="hidden md:flex fixed top-0 right-0 bottom-0 w-full max-w-md bg-bg-main border-l border-border-color shadow-xl z-50 flex-col animate-in slide-in-from-right">
        <div className="flex items-center justify-between p-4 border-b border-border-color shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-accent/20 flex items-center justify-center">
              <Icon name={peerId ? "users" : "brain"} size={18} className="text-accent" />
            </div>
            <div>
              <h2 className="font-bold text-text-primary leading-tight">{peerId ? peerName : "Titum AI"}</h2>
              <p className="text-[10px] text-success uppercase tracking-wider font-mono">{peerId ? "Connected" : "Online"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {peerId ? (
              <button 
                onClick={handleExitPeerChat}
                title="Exit Chat"
                className="px-3 h-9 rounded-lg border border-border-color flex items-center justify-center text-[10px] uppercase font-black tracking-widest text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-all gap-2"
              >
                <Icon name="log-out" size={14} />
                Exit
              </button>
            ) : (
              <button 
                onClick={() => setShowConnectModal(true)} 
                title="Connect with Peer"
                className="w-9 h-9 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
              >
                <Icon name="share-2" size={14} />
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
          <div className="flex items-center justify-between p-4 border-b border-border-color shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                <Icon name={peerId ? "users" : "brain"} size={16} className="text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary leading-tight">{peerId ? peerName : "Titum AI"}</h2>
                <p className="text-[9px] text-success uppercase tracking-wider font-mono">{peerId ? "Connected" : "Online"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {peerId ? (
                <button 
                  onClick={handleExitPeerChat}
                  title="Exit Chat"
                  className="px-2 h-8 rounded-lg border border-border-color flex items-center justify-center text-[9px] uppercase font-black tracking-widest text-text-secondary hover:text-red-500 transition-all gap-1.5"
                >
                  <Icon name="log-out" size={12} />
                  Exit
                </button>
              ) : (
                <button 
                  onClick={() => setShowConnectModal(true)} 
                  title="Connect with Peer"
                  className="w-8 h-8 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors"
                >
                  <Icon name="share-2" size={12} />
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
            <h3 className="text-lg font-bold text-text-primary mb-2">Connect to Peer</h3>
            <p className="text-xs text-text-secondary mb-6 leading-relaxed">
              Enter Admin's unique secret code to connect to his personal AI.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-text-secondary uppercase tracking-[0.2em] mb-2 font-mono">
                  Enter Secret Code
                </label>
                <input
                  type="text"
                  value={peerCodeInput}
                  onChange={(e) => setPeerCodeInput(e.target.value.toUpperCase())}
                  placeholder="EX: A1B2C3D4"
                  className="w-full bg-bg-sidebar border border-border-color rounded-xl py-3 px-4 text-center font-mono text-lg font-bold tracking-[0.3em] text-accent focus:outline-none focus:border-accent transition-all uppercase"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConnectPeer();
                  }}
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowConnectModal(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-border-color text-[11px] font-bold uppercase tracking-widest text-text-secondary hover:bg-accent-dim transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConnectPeer}
                  disabled={!peerCodeInput.trim() || isConnecting}
                  className="flex-1 px-4 py-3 rounded-xl bg-accent text-bg-main text-[11px] font-bold uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {isConnecting ? "Connecting..." : "Connect"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
