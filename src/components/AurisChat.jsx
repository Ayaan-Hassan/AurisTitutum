import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Icon from './Icon';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase.config';
import {
  collection, addDoc, query, where, onSnapshot,
  serverTimestamp, doc, getDocs, orderBy, deleteDoc, updateDoc, limit
} from 'firebase/firestore';
import { getTitumSystemPrompt, getMemorySynthesisPrompt } from '../config/aiInstructions';
import { processMemorySynthesis, calculateMomentumScores } from '../services/memoryService';

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: 'Protocol Titum-V1 initialized. Connection stable. I have loaded your longitudinal behavioral data and momentum forecasts. Awaiting input.'
};

export default function AurisChat({ user, isOpen, onClose, userConfig, habits, notes, reminders, notifications }) {
  const { behavioralMemory, addBehavioralMemory, deleteBehavioralMemory, logDocs } = useAuth();

  // Conversation state
  const [conversations, setConversations] = useState([]); // list from Firestore
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationWordCount, setConversationWordCount] = useState(0);

  // UI state
  const [showMenu, setShowMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isSavingConv, setIsSavingConv] = useState(false);

  const messagesEndRef = useRef(null);
  const menuRef = useRef(null);

  // ─── Close menu when clicking outside ────────────────────────────────────────
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  // ─── Scroll to bottom on new messages ────────────────────────────────────────
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // ─── Load conversations list from Firestore ───────────────────────────────────
  useEffect(() => {
    if (!user?.uid || !isOpen) return;

    const q = query(
      collection(db, 'users', user.uid, 'ai_conversations'),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    const unsub = onSnapshot(q, (snap) => {
      const convs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setConversations(convs);

      // If we have no active conversation yet, load the most recent one
      if (!activeConvId && convs.length > 0 && messages.length <= 1) {
        const latest = convs[0];
        setActiveConvId(latest.id);
        setMessages(latest.messages || [INITIAL_MESSAGE]);
        setConversationWordCount(latest.wordCount || 0);
      }
    }, (err) => {
      console.warn('AI conversations listener error:', err);
    });

    return () => unsub();
  }, [user?.uid, isOpen]);

  // ─── Save messages to Firestore (debounced) ───────────────────────────────────
  const saveTimeoutRef = useRef(null);
  const saveConversation = useCallback(async (msgs, convId, wordCount) => {
    if (!user?.uid || msgs.length <= 1) return; // Don't save if only the initial message

    clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const title = msgs.find(m => m.role === 'user')?.content?.slice(0, 60) || 'New Conversation';
        const payload = {
          messages: msgs,
          title,
          wordCount: wordCount || 0,
          updatedAt: new Date().toISOString(),
          uid: user.uid,
        };

        if (convId) {
          await updateDoc(doc(db, 'users', user.uid, 'ai_conversations', convId), payload);
        } else {
          const ref = await addDoc(collection(db, 'users', user.uid, 'ai_conversations'), {
            ...payload,
            createdAt: new Date().toISOString(),
          });
          setActiveConvId(ref.id);
        }
      } catch (err) {
        console.warn('Failed to save conversation:', err);
      }
    }, 1500);
  }, [user?.uid]);

  // ─── Start a new conversation ─────────────────────────────────────────────────
  const handleNewConversation = () => {
    setActiveConvId(null);
    setMessages([INITIAL_MESSAGE]);
    setConversationWordCount(0);
    setShowMenu(false);
    setShowHistory(false);
  };

  // ─── Delete the current conversation ─────────────────────────────────────────
  const handleDeleteConversation = async (convId) => {
    const idToDelete = convId || activeConvId;
    if (!user?.uid || !idToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'ai_conversations', idToDelete));
      if (idToDelete === activeConvId) {
        handleNewConversation();
      }
    } catch (err) {
      console.warn('Failed to delete conversation:', err);
    }
    setShowMenu(false);
  };

  // ─── Load a past conversation ─────────────────────────────────────────────────
  const handleLoadConversation = (conv) => {
    setActiveConvId(conv.id);
    setMessages(conv.messages || [INITIAL_MESSAGE]);
    setConversationWordCount(conv.wordCount || 0);
    setShowHistory(false);
    setShowMenu(false);
  };

  // ─── Network / AI helpers ─────────────────────────────────────────────────────
  const fetchWithTimeout = async (resource, options = {}) => {
    const { timeout = 15000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(resource, { ...options, signal: controller.signal });
      clearTimeout(id);
      return response;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  };

  const determineComplexity = (prompt) => {
    const isComplex = prompt.length > 200 ||
      /why|how|explain|analyze|compare|evaluate|calculate|solve/i.test(prompt) ||
      /(?:\r?\n){2,}/.test(prompt);
    return isComplex ? 'complex' : 'simple';
  };

  // ─── Send message ─────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const complexity = determineComplexity(userMessage.content);
    const newWordCount = conversationWordCount + input.split(' ').length;
    setConversationWordCount(newWordCount);
    const isFatigued = newWordCount > 500;

    const primaryModel = import.meta.env.VITE_MODEL_PRIMARY || 'google/gemma-3-27b-it';
    const secondaryModel = import.meta.env.VITE_MODEL_SECONDARY || 'meta-llama/llama-3.3-70b-instruct';
    const fallbackModel = import.meta.env.VITE_MODEL_FALLBACK || 'mistralai/mistral-7b-instruct';

    let modelToUse = complexity === 'complex' ? secondaryModel : primaryModel;
    let fallbackToUse = fallbackModel;

    // Build context strings
    const habitContext = habits && habits.length > 0
      ? `Their tracked habits and raw data:\n${habits.map(h => {
        const recentLogs = h.logs ? h.logs.slice(-60) : [];
        const logsStr = recentLogs.length > 0
          ? recentLogs.map(l => `[${l.date}: ${l.mode || 'Success'}]`).join(', ')
          : 'No logs yet';
        const totalCompletions = h.logs ? h.logs.filter(l => l.count > 0).length : 0;
        return `- **${h.name}**\n  | Type: ${h.type || 'N/A'}\n  | Mode: ${h.mode || 'N/A'}\n  | Total completions: ${totalCompletions}\n  | Recent History: ${logsStr}`;
      }).join('\n\n')}`
      : "They have no habits tracked yet.";

    const notesContext = notes && notes.length > 0
      ? `Notes Analysis:\n${notes.slice(-20).map(n => `- ${n.isLocked ? '[SECURE NODE]' : n.title}: ${n.isLocked ? '[ACCESS RESTRICTED]' : (n.body?.substring(0, 150) + (n.body?.length > 150 ? '...' : ''))}`).join('\n')}`
      : "No notes available.";
    const remindersContext = reminders && reminders.length > 0 ? `Active reminders: ${reminders.map(r => r.title).join(', ')}.` : "";
    const notificationsContext = notifications && notifications.length > 0 ? `Recent notifications: ${notifications.map(n => n.title).join(', ')}.` : "";
    const userNameContext = userConfig?.name ? `The user's name is ${userConfig.name}.` : "";

    const behavioralMemoryContext = behavioralMemory && behavioralMemory.length > 0
      ? `LONG-TERM BEHAVIORAL MEMORY:\n${behavioralMemory.map(m => `- [${m.type}] ${m.summary} (Confidence: ${m.confidence || 'N/A'})`).join('\n')}`
      : "No long-term behavioral patterns recorded yet.";

    const behavioralStateContext = userConfig?.behavioralState
      ? `CURRENT BEHAVIORAL STATE: ${userConfig.behavioralState.toUpperCase()}\nIntervention Mode: ${userConfig.interventionMode || 'Standard'}`
      : "CURRENT BEHAVIORAL STATE: UNDETERMINED";

    const momentumScores = calculateMomentumScores(habits, logDocs, behavioralMemory);
    const momentumScoresContext = `INTERNAL BEHAVIORAL METRICS:\n- Execution Momentum: ${(momentumScores.executionMomentum * 100).toFixed(1)}%\n- Behavioral Stability: ${(momentumScores.behavioralStability * 100).toFixed(1)}%\n- Collapse Probability: ${(momentumScores.collapseProbability * 100).toFixed(1)}%\n- Recovery Strength: ${(momentumScores.recoveryStrength * 100).toFixed(1)}%`;

    const systemPrompt = getTitumSystemPrompt(userNameContext, habitContext, notesContext, remindersContext, notificationsContext, behavioralMemoryContext, behavioralStateContext, momentumScoresContext, isFatigued);

    const attemptFetch = async (model) => {
      if (!import.meta.env.VITE_OPENROUTER_KEY) {
        throw new Error("API Key Missing: VITE_OPENROUTER_KEY is not defined.");
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
          model,
          stream: true,
          messages: [{ role: "system", content: systemPrompt }, ...newMessages]
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
        const lines = chunk.split('\n').filter(l => l.trim() !== '');
        for (const line of lines) {
          if (line === 'data: [DONE]') return assistantMessage;
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
            } catch {}
          }
        }
      }
      return assistantMessage;
    };

    const synthesizeMemory = async (history) => {
      try {
        const memoryPrompt = getMemorySynthesisPrompt(
          history.map(m => `[${m.role}] ${m.content}`).join('\n'),
          behavioralMemory.map(m => `- ${m.summary}`).join('\n')
        );
        const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.href,
            "X-Title": "Titum Memory Synthesis",
          },
          body: JSON.stringify({
            model: import.meta.env.VITE_MODEL_FALLBACK || "mistralai/mistral-7b-instruct",
            messages: [{ role: "user", content: memoryPrompt }]
          })
        });
        if (!response.ok) return;
        const data = await response.json();
        const content = data.choices[0].message?.content;
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}') + 1;
        if (jsonStart === -1 || jsonEnd === -1) return;
        const synthesis = JSON.parse(content.slice(jsonStart, jsonEnd));
        await processMemorySynthesis(synthesis, behavioralMemory, addBehavioralMemory, deleteBehavioralMemory);
      } catch (err) {
        console.warn("Memory synthesis failed:", err);
      }
    };

    try {
      let res = await attemptFetch(modelToUse);
      const aiReply = await processStream(res);

      // Build final messages and persist to Firestore
      const finalMessages = [...newMessages, { role: 'assistant', content: aiReply }];
      saveConversation(finalMessages, activeConvId, newWordCount);

      if (newMessages.length % 4 === 0) {
        synthesizeMemory(newMessages);
      }
    } catch (error) {
      console.warn(`Request with ${modelToUse} failed:`, error.message);
      try {
        let resFallback = await attemptFetch(fallbackToUse);
        const aiReply = await processStream(resFallback);
        const finalMessages = [...newMessages, { role: 'assistant', content: aiReply }];
        saveConversation(finalMessages, activeConvId, newWordCount);
      } catch (fallbackError) {
        console.error("All models failed", fallbackError.message);
        let errorMessage = "I'm having trouble connecting to my brain right now.";
        if (fallbackError.message.includes("API Key Missing")) {
          errorMessage = "VITE_OPENROUTER_KEY is missing. Check your environment variables.";
        } else if (fallbackError.message.includes("OpenRouter Error")) {
          errorMessage = `OpenRouter rejected the request. Check API key and credits. Details: ${fallbackError.message}`;
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

  // ─── Render helpers ───────────────────────────────────────────────────────────
  const renderFormattedText = (text) => {
    if (!text) return null;
    const parts = text.split(/\*\*(.*?)\*\*/g);
    const colors = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#ffffff'];
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        const color = colors[((index - 1) / 2) % colors.length];
        return <span key={index} className="font-extrabold tracking-tight" style={{ color }}>{part}</span>;
      }
      return <span key={index}>{part}</span>;
    });
  };

  const formatConvTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // ─── History Panel ────────────────────────────────────────────────────────────
  const renderHistoryPanel = () => (
    <div className="flex-1 overflow-y-auto bg-bg-main custom-scrollbar">
      <div className="p-4 border-b border-border-color flex items-center justify-between sticky top-0 bg-bg-main z-10">
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-text-secondary">Conversation History</span>
        <button onClick={() => setShowHistory(false)} className="w-7 h-7 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
          <Icon name="x" size={12} />
        </button>
      </div>
      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-10 text-center opacity-40">
          <Icon name="message-square" size={36} className="mb-3 text-text-secondary" />
          <p className="text-xs font-black uppercase tracking-widest text-text-secondary">No saved conversations</p>
        </div>
      ) : (
        <div className="divide-y divide-border-color/40">
          {conversations.map(conv => (
            <div key={conv.id} className={`flex items-center gap-3 p-4 hover:bg-white/5 transition-colors group ${conv.id === activeConvId ? 'bg-accent/5 border-l-2 border-accent' : ''}`}>
              <button onClick={() => handleLoadConversation(conv)} className="flex-1 text-left min-w-0">
                <p className="text-xs font-semibold text-text-primary truncate">{conv.title || 'Conversation'}</p>
                <p className="text-[10px] text-text-secondary mt-0.5">{formatConvTime(conv.updatedAt)} · {conv.messages?.length || 0} messages</p>
              </button>
              <button
                onClick={() => handleDeleteConversation(conv.id)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-text-secondary hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                title="Delete"
              >
                <Icon name="trash" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ─── Chat Content ─────────────────────────────────────────────────────────────
  const renderChatContent = () => {
    if (showHistory) return renderHistoryPanel();

    return (
      <>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 custom-scrollbar scroll-smooth">
          {messages.map((msg, index) => (
            <div key={index} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2.5 mb-2 opacity-60 group-hover:opacity-100 transition-all">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                  <span className="text-[9px] font-black tracking-[0.25em] uppercase font-mono text-text-secondary">Titum Core</span>
                </div>
              )}
              <div className={`max-w-[85%] px-5 py-3.5 rounded-2xl text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent text-bg-main font-medium rounded-tr-none shadow-lg shadow-accent/10'
                  : 'bg-bg-main border border-border-color text-text-primary rounded-tl-none shadow-sm'
              }`}>
                <div className="whitespace-pre-wrap tracking-wide font-medium">
                  {msg.role === 'assistant' ? renderFormattedText(msg.content) : msg.content}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-bg-main border border-border-color text-text-primary rounded-2xl rounded-tl-none p-5 flex items-center gap-3">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce delay-75" />
                  <div className="w-1.5 h-1.5 bg-accent/30 rounded-full animate-bounce delay-150" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] font-mono text-text-secondary">Processing...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-6" />
        </div>

        {/* Input area */}
        <div className="p-5 border-t border-border-color shrink-0 bg-bg-main">
          <div className="relative flex items-end gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Titum AI..."
              className="w-full border border-border-color rounded-xl py-3.5 px-5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none min-h-[48px] max-h-32 custom-scrollbar font-medium bg-bg-main text-text-primary placeholder:text-text-secondary"
              rows={1}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="w-12 h-12 shrink-0 rounded-xl bg-accent text-bg-main flex items-center justify-center shadow-lg shadow-accent/10 hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Icon name="send" size={18} />
            </button>
          </div>
          <p className="text-center mt-3 text-[9px] font-black uppercase tracking-[0.2em] text-text-secondary">
            Titum AI may produce inaccurate information about habits.
          </p>
        </div>
      </>
    );
  };

  // ─── Header ───────────────────────────────────────────────────────────────────
  const renderHeader = (compact = false) => (
    <div className={`flex items-center justify-between ${compact ? 'p-4' : 'p-5'} border-b border-border-color shrink-0`}>
      <div className="flex items-center gap-3 sm:gap-4">
        <div className={`${compact ? 'w-9 h-9' : 'w-11 h-11'} rounded-xl bg-accent/20 flex items-center justify-center`}>
          <Icon name="brain" size={compact ? 18 : 22} className="text-accent" />
        </div>
        <div>
          <h2 className={`font-black tracking-tight text-text-primary ${compact ? 'text-sm' : 'text-lg'}`}>Titum AI</h2>
          <p className="text-[10px] uppercase tracking-[0.4em] font-mono font-black text-success">Online</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* History button */}
        <button
          onClick={() => { setShowHistory(!showHistory); setShowMenu(false); }}
          title="Conversation History"
          className={`${compact ? 'w-8 h-8' : 'w-9 h-9'} rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-accent hover:bg-accent/10 transition-colors ${showHistory ? 'bg-accent/10 text-accent' : ''}`}
        >
          <Icon name="message-square" size={compact ? 13 : 15} />
        </button>

        {/* More menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            title="Options"
            className={`${compact ? 'w-8 h-8' : 'w-9 h-9'} rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors`}
          >
            <Icon name="more-vertical" size={compact ? 13 : 15} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-bg-main border border-border-color rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <button
                onClick={handleNewConversation}
                className="w-full px-4 py-3 text-left text-xs font-semibold text-text-primary hover:bg-white/5 transition-colors flex items-center gap-3"
              >
                <Icon name="plus" size={14} className="text-accent" />
                New Conversation
              </button>
              {activeConvId && (
                <button
                  onClick={() => handleDeleteConversation(null)}
                  className="w-full px-4 py-3 text-left text-xs font-semibold text-red-400 hover:bg-red-400/10 transition-colors flex items-center gap-3"
                >
                  <Icon name="trash" size={14} />
                  Delete This Conversation
                </button>
              )}
            </div>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className={`${compact ? 'w-8 h-8' : 'w-9 h-9'} rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors`}
        >
          <Icon name="x" size={compact ? 14 : 16} />
        </button>
      </div>
    </div>
  );

  // ─── Main render ──────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Desktop panel */}
      <div className="hidden md:flex fixed top-0 right-0 bottom-0 w-full max-w-md bg-bg-main border-l border-border-color shadow-2xl z-50 flex-col animate-in slide-in-from-right duration-300">
        {renderHeader(false)}
        {renderChatContent()}
      </div>

      {/* Mobile panel */}
      <div className="md:hidden fixed inset-x-0 bottom-0 top-[10%] z-50 flex flex-col pointer-events-none">
        <div
          className="flex-1 bg-bg-main border-t border-border-color rounded-t-2xl shadow-2xl animate-in slide-in-from-bottom duration-300 pointer-events-auto flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {renderHeader(true)}
          {renderChatContent()}
        </div>
      </div>
    </>
  );
}
