import { useState, useRef, useEffect } from 'react';
import Icon from './Icon';

export default function AurisChat({ isOpen, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am Titum AI, your habit coach. How can I help you build better systems today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRefDesktop = useRef(null);
  const messagesEndRefMobile = useRef(null);

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

    const systemPrompt = "You are Titum AI, a habit coach. Be concise, practical, and motivating.";

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

    try {
      let res = await attemptFetch(modelToUse);
      let data = await res.json();
      setMessages([...newMessages, { role: 'assistant', content: data.choices[0].message.content }]);
    } catch (error) {
      console.warn(`Request with ${modelToUse} failed:`, error.message);
      try {
        let resFallback = await attemptFetch(fallbackToUse);
        let dataFallback = await resFallback.json();
        setMessages([...newMessages, { role: 'assistant', content: dataFallback.choices[0].message.content }]);
      } catch (fallbackError) {
        console.error("All models failed", fallbackError.message);
        
        let errorMessage = "I'm having trouble connecting to my brain right now.";
        
        if (fallbackError.message.includes("API Key Missing")) {
           errorMessage = "VITE_OPENROUTER_KEY is missing! If you just added it in Vercel, you *must* trigger a new deployment for Vite to embed it.";
        } else if (fallbackError.message.includes("OpenRouter Error")) {
           errorMessage = `OpenRouter rejected the model request. You might be using an invalid model name or your account lacks credits. Details: ${fallbackError.message}`;
        }
        
        setMessages([...newMessages, { role: 'assistant', content: errorMessage }]);
      }
    } finally {
      setIsLoading(false);
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
  const renderChatContent = (isMobile) => (
    <>
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-2xl p-3 sm:p-4 text-xs sm:text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-accent text-bg-main rounded-tr-sm' 
                  : 'bg-bg-main border border-border-color text-text-primary rounded-tl-sm'
              }`}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1.5 opacity-80">
                  <Icon name="brain" size={12} className="text-accent" />
                  <span className="text-[10px] font-bold tracking-wider uppercase font-mono">Titum AI</span>
                </div>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>
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
          <button onClick={onClose} className="w-9 h-9 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary">
            <Icon name="x" size={16} />
          </button>
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
            <button onClick={onClose} className="w-8 h-8 rounded-lg border border-border-color flex items-center justify-center text-text-secondary hover:text-text-primary">
              <Icon name="x" size={14} />
            </button>
          </div>
          
          {renderChatContent(true)}
        </div>
      </div>
    </>
  );
}
