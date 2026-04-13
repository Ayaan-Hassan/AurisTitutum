import { useState, useRef, useEffect } from 'react';
import Icon from './Icon';

export default function AurisChat({ isOpen, onClose, userConfig, habits, notes, reminders, notifications }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am Titum AI, your friendly habit coach. How can I help you build better systems today? 😊' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRefDesktop = useRef(null);
  const messagesEndRefMobile = useRef(null);

  const handleClearChat = () => {
    setMessages([
      { role: 'assistant', content: 'Hello! I am Titum AI, your friendly habit coach. How can I help you build better systems today? 😊' }
    ]);
  };

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

    const systemPrompt = `You are Titum AI, a highly empathetic, friendly, and enthusiastic habit coach. ${userNameContext}
${habitContext}
${notesContext}
${remindersContext}
${notificationsContext}

CRITICAL RULES FOR YOUR RESPONSES:
1. CONVERSATIONAL EMPATHY: Always acknowledge and respond warmly to what the user just said FIRST.
2. EXHAUSTIVE ANALYSIS: When asked to analyze, you must be extremely detailed. Analyze every single piece of data provided in the context below. Calculate consistency percentages, identify specific days of the week where the user struggles, find correlations between different habits (e.g., "When you sleep well, your Manstratio habit improved by X%"), and provide a long-term trend report.
3. BE BRUTALLY HONEST: If the logs show they are failing, tell them. Do not sugarcoat progress that isn't there. If they haven't logged a habit, explicitly mention that there is no data for it.
4. FORMATTING: Use clear paragraphs. Never send a wall of text.
5. HIGHLIGHTING: Wrap critical metrics, habit names, and advice in **double asterisks**. These appear as vibrant colored text in the UI. Use this for ALL important data points.
6. NO HALLUCINATION: Only use the raw logs provided. If a habit has "No logs yet", say exactly that.
7. NO OTHER MARKDOWN: Do not use headers, bullet points, or italics. Only use **bold** for highlights. Use emojis warmly.`;

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

  const renderChatContent = (isMobile) => (
    <>
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-2xl p-3 sm:p-4 text-xs sm:text-sm leading-relaxed shadow-sm transition-all ${
                msg.role === 'user' 
                  ? 'bg-accent text-bg-main rounded-tr-sm animate-in fade-in slide-in-from-bottom-2 duration-300' 
                  : 'bg-bg-main border border-border-color text-text-primary rounded-tl-sm animate-in fade-in slide-in-from-left-2 zoom-in-95 duration-500'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-2 opacity-80">
                  <Icon name="brain" size={12} className="text-accent" />
                  <span className="text-[10px] font-bold tracking-wider uppercase font-mono">Titum AI</span>
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.role === 'assistant' ? renderFormattedText(msg.content) : msg.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl p-4 bg-bg-main border border-border-color text-text-primary rounded-tl-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
            placeholder="Ask Titum AI..."
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
              <Icon name="brain" size={18} className="text-accent" />
            </div>
            <div>
              <h2 className="font-bold text-text-primary">Titum AI</h2>
              <p className="text-[10px] text-success uppercase tracking-wider font-mono">Online</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
                <Icon name="brain" size={16} className="text-accent" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-text-primary">Titum AI</h2>
                <p className="text-[9px] text-success uppercase tracking-wider font-mono">Online</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
    </>
  );
}
