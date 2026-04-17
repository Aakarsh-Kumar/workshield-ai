'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2 } from 'lucide-react';
import apiClient, { type ChatMessage } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import toast from 'react-hot-toast';

export function ChatSupport() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadHistory = async () => {
    setFetchingHistory(true);
    try {
      const res = await apiClient.getChatHistory();
      if (res.success) {
        setMessages(res.messages);
      }
    } catch (err) {
      console.error('History load failed:', err);
    } finally {
      setFetchingHistory(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    
    // Optimistic update
    const newMessage: ChatMessage = {
      role: 'user',
      parts: [{ text: userMessage }],
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);
    setLoading(true);

    try {
      const res = await apiClient.sendMessage(userMessage);
      if (res.success) {
        setMessages(prev => [...prev, {
          role: 'model',
          parts: [{ text: res.reply }],
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      // Try to get a helpful error message from the response
      const errorMessage = err.response?.data?.message || err.message || 'Failed to send message';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50 bg-slate-900 hover:bg-slate-800 text-white transition-all transform hover:scale-110 active:scale-95"
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-24 right-6 w-[350px] sm:w-[400px] h-[550px] z-50 flex flex-col shadow-2xl border-slate-200/60 overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
          <CardHeader className="bg-slate-900 text-white p-4">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-sky-500 flex items-center justify-center">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <p>WorkShield AI</p>
                <p className="text-[10px] text-sky-200 uppercase tracking-widest font-normal">Active Support</p>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50"
          >
            {fetchingHistory && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              </div>
            )}
            
            {messages.length === 0 && !fetchingHistory && (
              <div className="text-center py-10 px-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                  <p className="text-sm font-medium text-slate-800">Hello! I'm your WorkShield Assistant.</p>
                  <p className="mt-2 text-xs text-slate-500">I can help you check your policies, claims, or even create a new protection plan.</p>
                </div>
              </div>
            )}

            {messages.map((m, idx) => (
              <div 
                key={idx} 
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center ${m.role === 'user' ? 'bg-slate-200' : 'bg-sky-100'}`}>
                    {m.role === 'user' ? <User className="h-4 w-4 text-slate-600" /> : <Bot className="h-4 w-4 text-sky-600" />}
                  </div>
                  <div className={`p-3 rounded-2xl text-sm ${
                    m.role === 'user' 
                      ? 'bg-slate-900 text-white rounded-tr-none' 
                      : 'bg-white text-slate-900 shadow-sm border border-slate-100 rounded-tl-none font-medium'
                  }`}>
                    {m.parts[0].text.split('\n').map((line, i) => (
                      <p key={i} className={line.trim() === '' ? 'h-2' : ''}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                 <div className="flex gap-2 max-w-[85%] flex-row">
                  <div className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center bg-sky-100">
                    <Bot className="h-4 w-4 text-sky-600" />
                  </div>
                  <div className="p-3 rounded-2xl text-sm bg-white text-slate-900 shadow-sm border border-slate-100 rounded-tl-none flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="p-4 bg-white border-t border-slate-100">
            <form 
              className="flex w-full gap-2"
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            >
              <input
                placeholder="Type your message..."
                className="flex-1 bg-slate-50 border-0 focus:ring-2 focus:ring-sky-500 rounded-xl px-4 py-2 text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={loading}
              />
              <Button 
                type="submit" 
                size="icon" 
                className="rounded-xl bg-sky-600 hover:bg-sky-700 h-10 w-10 flex-shrink-0"
                disabled={!input.trim() || loading}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </>
  );
}
