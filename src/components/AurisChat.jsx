import { useState, useRef, useEffect, useMemo } from 'react';
import Icon from './Icon';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase.config';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, getDoc, doc, getDocs, orderBy, limit, updateDoc, deleteDoc } from 'firebase/firestore';
import { getTitumSystemPrompt, getEnhancementPrompt } from '../config/aiInstructions';

const ADMIN_CODE = "7@XEON1215225";
const ADMIN_UID = "inB7hQ7PAuRxt19mBZ3xKe8unaV2";

export default function AurisChat({ user, isOpen, onClose, userConfig, habits, notes, reminders, notifications }) {
  const { updateUserConfig, peerMessages: globalPeerMessages, clearUnreadPeerCount } = useAuth();

  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'System initialized. I am Titum AI, your behavioral analyst and execution coach. Let\'s review your data.' }
  ]);
  const [peerMessages, setPeerMessages] = useState([]);
  const [enhancementRules, setEnhancementRules] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [peerId, setPeerId] = useState(null);
  const [peerName, setPeerName] = useState('');
  const [isAdminListView, setIsAdminListView] = useState(false);

  const isBioBotActive = peerId === ADMIN_UID;

  useEffect(() => {
    // We don't call clearUnreadPeerCount here anymore because it's a local-only state.
    // Instead, the server-side 'read' update in the effect below will 
    // naturally update the global count via the onSnapshot listener.
  }, [isOpen]);

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

      setPeerMessages(filtered);
    } else {
      setPeerMessages([]);
    }
  }, [globalPeerMessages, peerId, user?.uid]);
  
  // Persistent Read-Sync Effect
  useEffect(() => {
    if (isOpen && peerId && user?.uid && peerMessages.length > 0) {
      const unreadFromPeer = peerMessages.filter(m => m.from === peerId && m.read === false);
      if (unreadFromPeer.length > 0) {
        const markAllAsRead = async () => {
          for (const m of unreadFromPeer) {
            try {
              await updateDoc(doc(db, "titum_connect_messages", m.id), {
                read: true
              });
            } catch (err) {
              console.warn(`Failed to mark message ${m.id} as read:`, err);
            }
          }
        };
        markAllAsRead();
      }
    }
  }, [isOpen, peerId, user?.uid, peerMessages]);

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

  const handleClearChat = async () => {
    if (peerId && user?.uid) {
      // Create an optimistic UI update
      setPeerMessages([]);
      
      try {
        // Find and delete all messages in this specific conversation
        const q = query(
          collection(db, "titum_connect_messages"),
          where("participants", "array-contains", user.uid)
        );
        const snapshot = await getDocs(q);
        
        // Filter specifically for the current peerId to avoid deleting other active chats if any
        const msgToDelete = snapshot.docs.filter(d => d.data().participants?.includes(peerId));
        
        for (const msgDoc of msgToDelete) {
          await deleteDoc(doc(db, "titum_connect_messages", msgDoc.id));
        }

        const toastEvent = new CustomEvent("showToast", {
          detail: { message: "Secure chat history erased.", type: "success" },
        });
        document.dispatchEvent(toastEvent);
      } catch (err) {
        console.error("Failed to erase peer history:", err);
      }
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

  const isAdmin = useMemo(() => {
    if (!user?.uid) return false;
    const envAdmin = (import.meta.env.VITE_ADMIN_UID || "").replace(/['"]/g, '').trim();
    return user.uid === ADMIN_UID || user.uid === envAdmin;
  }, [user?.uid]);

  const adminConversations = useMemo(() => {
    if (!isAdmin || !globalPeerMessages || !globalPeerMessages.length) return [];
    
    const conversations = {};
    globalPeerMessages.forEach(msg => {
      if (!msg) return;
      const otherUid = msg.from === user?.uid ? msg.to : msg.from;
      if (!otherUid || otherUid === user?.uid) return;
      
      const isFromOther = msg.from === otherUid;
      const isToAdmin = msg.to === user?.uid;

      if (!conversations[otherUid]) {
        conversations[otherUid] = {
          uid: otherUid,
          name: msg.from === user?.uid ? (msg.toName || "User") : (msg.fromName || "User"),
          lastMessage: msg,
          unreadCount: (isFromOther && isToAdmin && msg.read === false) ? 1 : 0
        };
      } else {
        const currentLast = conversations[otherUid].lastMessage;
        const msgTime = msg.timestamp?.toMillis ? msg.timestamp.toMillis() : 0;
        const lastTime = currentLast?.timestamp?.toMillis ? currentLast.timestamp.toMillis() : 0;
        
        if (msgTime > lastTime) {
          conversations[otherUid].lastMessage = msg;
        }

        if (isFromOther && isToAdmin && msg.read === false) {
          conversations[otherUid].unreadCount++;
        }
      }
    });

    return Object.values(conversations).sort((a, b) => {
        const timeA = a.lastMessage?.timestamp?.toMillis ? a.lastMessage.timestamp.toMillis() : 0;
        const timeB = b.lastMessage?.timestamp?.toMillis ? b.lastMessage.timestamp.toMillis() : 0;
        return timeB - timeA;
    });
  }, [globalPeerMessages, user?.uid, isAdmin]);

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

  const handleEnhance = async () => {
    if (!input.trim() || isEnhancing) return;

    setIsEnhancing(true);
    try {
      const prompt = getEnhancementPrompt(input, enhancementRules);

      const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.href,
          "X-Title": "BioBot Enhancement",
        },
        body: JSON.stringify({
          model: import.meta.env.VITE_MODEL_SECONDARY || "meta-llama/llama-3.3-70b-instruct",
          messages: [
            { role: "user", content: prompt }
          ]
        })
      });

      if (!response.ok) throw new Error("Enhancement failed");

      const data = await response.json();
      const enhancedText = data.choices[0].message?.content?.trim() || input;
      setInput(enhancedText);

      const toastEvent = new CustomEvent("showToast", {
        detail: { message: "Transmission Enhanced.", type: "success" },
      });
      document.dispatchEvent(toastEvent);
    } catch (err) {
      console.error("Enhancement error:", err);
      const toastEvent = new CustomEvent("showToast", {
        detail: { message: "Enhancement Failed. System limit reached?", type: "error" },
      });
      document.dispatchEvent(toastEvent);
    } finally {
      setIsEnhancing(false);
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
          read: false,
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

    const systemPrompt = getTitumSystemPrompt(userNameContext, habitContext, notesContext, remindersContext, notificationsContext);

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

  const renderAdminUserList = () => {
    if (adminConversations.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-40">
          <Icon name="users" size={48} className="mb-4" />
          <p className="text-xs font-black uppercase tracking-widest text-slate-900">No Active Syncs</p>
          <p className="text-[10px] mt-2 font-mono uppercase font-black text-slate-500">Wait for user initialization...</p>
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50 relative z-10">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
           <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 font-mono">Verified Connection Nodes</p>
           <div className="flex items-center gap-2">
             <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
             <span className="text-[8px] font-black text-success uppercase tracking-widest">Master Link Active</span>
           </div>
        </div>
        {adminConversations.map((conv) => (
          <button
            key={conv.uid}
            onClick={() => {
              setPeerId(conv.uid);
              setPeerName(conv.name);
              setIsAdminListView(false);
            }}
            className={`w-full p-5 flex items-center gap-4 text-left border-b border-slate-100 transition-all hover:bg-white active:bg-slate-100 ${peerId === conv.uid ? 'bg-white ring-1 ring-inset ring-slate-200' : ''}`}
          >
            <div className="w-12 h-12 shrink-0 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-lg shadow-lg relative">
              {conv.name.charAt(0).toUpperCase()}
              {conv.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-slate-50 animate-bounce shadow-lg">
                  {conv.unreadCount}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-900 truncate">{conv.name}</span>
                <span className="text-[9px] font-mono text-slate-400 font-bold uppercase whitespace-nowrap ml-2">
                  {conv.lastMessage?.timestamp?.toMillis 
                    ? new Date(conv.lastMessage.timestamp.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                    : "Live"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate font-medium">
                {conv.lastMessage?.from === user?.uid ? (
                  <span className="text-[9px] uppercase font-black text-slate-300 mr-1 tracking-tighter">Admin:</span>
                ) : ""}
                {conv.lastMessage?.content}
              </p>
            </div>
          </button>
        ))}
      </div>
    );
  };

  const renderChatContent = (isMobile) => {
    const activeMessages = peerId ? peerMessages : messages;

    if (isAdmin && isAdminListView) {
      return renderAdminUserList();
    }

    return (
      <>
        <div className={`flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 custom-scrollbar scroll-smooth transition-all duration-1000 ${isBioBotActive ? 'bg-slate-50 relative' : ''}`}>
          {isBioBotActive && (
            <>
              <div className="absolute inset-0 pointer-events-none opacity-50" style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(15, 23, 42, 0.03) 0%, transparent 75%)' }} />
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-slate-300/50 to-transparent shadow-sm" />
            </>
          )}
          {(isBioBotActive ? peerMessages : (peerId ? peerMessages : messages)).map((msg, index) => (
            <div key={msg.id || index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group animate-in fade-in slide-in-from-bottom-2 duration-500 relative z-10`}>
              {(msg.role === 'assistant' || (peerId && msg.from !== user?.uid)) && (
                <div className="flex items-center gap-2.5 mb-2 opacity-60 group-hover:opacity-100 transition-all">
                  <div className={`w-1.5 h-1.5 rounded-full ${isBioBotActive ? 'bg-slate-900 shadow-[0_0_8px_rgba(15,23,42,0.1)]' : 'bg-accent'}`} />
                  <span className={`text-[9px] font-black tracking-[0.25em] uppercase font-mono ${isBioBotActive ? 'text-slate-900' : 'text-text-secondary'}`}>
                    {peerId ? (msg.from === user?.uid ? "Authorized" : (isBioBotActive ? "BioBot AH" : peerName)) : "Titum Core"}
                  </span>
                </div>
              )}

              <div
                className={`max-w-[85%] px-5 py-3.5 rounded-2xl text-[13px] leading-relaxed transition-all duration-500 ${msg.role === 'user'
                    ? (isBioBotActive
                      ? 'bg-white border border-slate-200 text-slate-800 rounded-tr-none shadow-sm'
                      : 'bg-accent text-bg-main font-medium rounded-tr-none shadow-lg shadow-accent/10')
                    : (isBioBotActive
                      ? 'bg-white border border-slate-100 text-slate-700 rounded-tl-none border-l-slate-400 border-l-2 shadow-sm'
                      : 'bg-bg-main border border-border-color text-text-primary rounded-tl-none shadow-sm')
                  }`}
              >
                <div className={`whitespace-pre-wrap tracking-wide font-medium ${isBioBotActive ? 'text-slate-700' : ''}`}>
                  {msg.role === 'assistant' && !peerId ? renderFormattedText(msg.content) : msg.content}
                </div>
              </div>

              {msg.timestamp && (isBioBotActive || peerId) && (
                <span className={`text-[8px] mt-2 opacity-40 font-mono tracking-widest uppercase font-black ${isBioBotActive ? 'text-slate-400' : ''}`}>
                  {msg.timestamp?.toMillis ? new Date(msg.timestamp.toMillis()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Verified"}
                </span>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start relative z-10">
              <div className={`max-w-[85%] rounded-2xl p-5 flex flex-col gap-3 ${isBioBotActive ? 'bg-white border border-slate-200 text-slate-900 rounded-tl-none shadow-sm' : 'bg-bg-main border border-border-color text-text-primary rounded-tl-none'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-slate-900 rounded-full animate-pulse" />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse delay-75" />
                    <div className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-pulse delay-150" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.3em] font-mono whitespace-nowrap text-slate-900">
                    Synchronizing...
                  </span>
                </div>
              </div>
            </div>
          )}
          <div ref={isMobile ? messagesEndRefMobile : messagesEndRefDesktop} className="h-6" />
        </div>

        <div className={`p-5 border-t shrink-0 transition-all duration-1000 ${isBioBotActive ? 'bg-white border-slate-100' : 'bg-bg-main border-border-color'}`}>
          {isAdmin && peerId && (
            <div className="mb-4 animate-in slide-in-from-bottom-3 duration-500">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-mono flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse" />
                    BioBot Override Processor
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative group">
                    <input
                      type="text"
                      value={enhancementRules}
                      onChange={(e) => setEnhancementRules(e.target.value)}
                      placeholder="Custom Logic Rules (e.g. 'theme: funny', 'tone: aggressive')"
                      className={`w-full py-2 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all duration-300 border ${isBioBotActive ? 'bg-slate-50 border-slate-200 text-slate-600 focus:border-slate-300' : 'bg-bg-main border-border-color text-text-secondary focus:border-accent'}`}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-20 group-hover:opacity-100 transition-opacity">
                      <Icon name="command" size={10} />
                    </div>
                  </div>
                  <button
                    onClick={handleEnhance}
                    disabled={!input.trim() || isEnhancing}
                    className="h-10 px-4 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 hover:bg-black active:scale-95 transition-all disabled:opacity-20 shadow-lg shadow-black/10"
                  >
                    {isEnhancing ? (
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Icon name="sparkles" size={12} />
                    )}
                    {isEnhancing ? "Syncing..." : "Enhance"}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="relative flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={false}
              placeholder={isBioBotActive ? "Enter command..." : (peerId ? `Message ${peerName}...` : "Ask Titum AI...")}
              className={`w-full border rounded-xl py-3.5 px-5 text-sm focus:outline-none transition-all duration-500 resize-none min-h-[48px] max-h-32 custom-scrollbar font-medium ${isBioBotActive
                  ? 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-100 disabled:opacity-50 disabled:cursor-not-allowed'
                  : 'bg-bg-main border-border-color text-text-primary placeholder:text-text-secondary focus:border-accent focus:ring-1 focus:ring-accent disabled:opacity-50'
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
              className={`w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed ${isBioBotActive
                  ? 'bg-slate-900 text-white shadow-lg hover:bg-black'
                  : 'bg-accent text-bg-main shadow-lg shadow-accent/10 hover:opacity-90'
                }`}
            >
              <Icon name="send" size={18} />
            </button>
          </div>
          <p className={`text-center mt-3 text-[9px] font-black uppercase tracking-[0.2em] transition-colors duration-1000 ${isBioBotActive ? 'text-slate-400' : 'text-text-secondary'}`}>
            {isBioBotActive ? "BioBot Premium Support Channel" : "Titum AI may produce inaccurate information about habits."}
          </p>
        </div>
      </>
    );
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 animate-in fade-in duration-1000 ${isBioBotActive ? 'bg-white/40 backdrop-blur-md' : 'bg-black/50 backdrop-blur-md'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Desktop */}
      <div className={`hidden md:flex fixed top-0 right-0 bottom-0 w-full max-w-md bg-bg-main border-l shadow-2xl z-50 flex-col animate-in slide-in-from-right transition-all duration-1000 ${isBioBotActive ? 'border-slate-100' : 'border-border-color'}`}>
        <div className={`flex items-center justify-between p-5 border-b shrink-0 transition-all duration-1000 ${isBioBotActive ? 'bg-white border-slate-100' : 'border-border-color'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-1000 ${isBioBotActive ? 'bg-slate-900 shadow-xl' : 'bg-accent/20'}`}>
              <Icon name={isBioBotActive ? "shield-check" : (peerId ? "users" : "brain")} size={22} className={isBioBotActive ? "text-white" : "text-accent"} />
            </div>
            <div>
              <h2 className={`font-black tracking-tight transition-all duration-1000 ${isBioBotActive ? 'text-slate-900 text-xl font-bold' : 'text-text-primary text-lg'}`}>
                {isBioBotActive ? "BioBot Protocol" : (peerId ? peerName : "Titum AI")}
              </h2>
              <p className={`text-[10px] uppercase tracking-[0.4em] font-mono font-black ${isBioBotActive ? 'text-slate-400 animate-pulse' : 'text-success'}`}>
                {isBioBotActive ? "Encrypted Link" : (peerId ? "Linked" : "Online")}
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
            {isAdmin && (
              <button
                onClick={() => setIsAdminListView(!isAdminListView)}
                title="Active Nodes"
                className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-all ${isAdminListView ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' : 'border-border-color text-text-secondary hover:text-text-primary hover:bg-accent/10'}`}
              >
                <Icon name="users" size={16} />
                {adminConversations.some(c => c.unreadCount > 0) && !isAdminListView && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-bg-main" />
                )}
              </button>
            )}
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
          <div className={`flex items-center justify-between p-4 border-b shrink-0 transition-all duration-1000 ${isBioBotActive ? 'bg-white border-slate-100' : 'border-border-color'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-1000 ${isBioBotActive ? 'bg-slate-900 shadow-lg' : 'bg-accent/20'}`}>
                <Icon name={isBioBotActive ? "shield-check" : (peerId ? "users" : "brain")} size={18} className={isBioBotActive ? "text-white" : "text-accent"} />
              </div>
              <div>
                <h2 className={`text-sm font-black tracking-tight transition-all duration-1000 ${isBioBotActive ? 'text-slate-900 uppercase' : 'text-text-primary leading-tight'}`}>{isBioBotActive ? "BioBot Master" : (peerId ? peerName : "Titum AI")}</h2>
                <p className={`text-[9px] uppercase tracking-[0.3em] font-mono font-black ${isBioBotActive ? 'text-slate-400 animate-pulse' : 'text-success'}`}>{isBioBotActive ? "Secure Link" : (peerId ? "Connected" : "Online")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <button
                  onClick={() => setIsAdminListView(!isAdminListView)}
                  title="Active Nodes"
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all relative ${isAdminListView ? 'bg-slate-900 text-white border-slate-900' : 'border-border-color text-text-secondary'}`}
                >
                  <Icon name="users" size={14} />
                  {adminConversations.some(c => c.unreadCount > 0) && !isAdminListView && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-bg-main" />
                  )}
                </button>
              )}
              {peerId ? (
                <button
                  onClick={handleExitPeerChat}
                  title="Exit Chat"
                  className={`px-2 h-8 rounded-lg border flex items-center justify-center text-[9px] uppercase font-black tracking-widest transition-all gap-1.5 ${isBioBotActive ? 'border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-50' : 'border-border-color text-text-secondary hover:text-red-500'}`}
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
          <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tighter flex items-center gap-3 uppercase">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shadow-lg shadow-black/10">
                <Icon name="command" size={16} className="text-white" />
              </div>
              BioBot Protocol
            </h3>
            <p className="text-xs text-slate-500 mb-8 leading-relaxed font-medium">
              Initialize secure connection to the Master terminal. Enter the decrypted access token to begin synchronization.
            </p>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-900 uppercase tracking-[0.4em] mb-3 font-mono">
                  &gt; IDENTIFY_TOKEN
                </label>
                <input
                  type="text"
                  value={peerCodeInput}
                  onChange={(e) => setPeerCodeInput(e.target.value)}
                  placeholder="********"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-4 text-center font-mono text-lg font-bold tracking-[0.2em] text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-slate-900/50 focus:ring-1 focus:ring-slate-100 transition-all"
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
                  className="flex-1 px-4 py-4 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase tracking-[0.2em] hover:bg-black transition-all disabled:opacity-50 shadow-lg shadow-black/10"
                >
                  {isConnecting ? "SYNCING..." : "INITIALIZE"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
