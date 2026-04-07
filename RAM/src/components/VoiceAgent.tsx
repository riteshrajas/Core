'use client';

import { useConversation } from '@elevenlabs/react';
import { useCallback, useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2, AlertCircle, Terminal, Zap } from 'lucide-react';
import { getPersonalizedPrompt } from '@/app/actions';

export default function VoiceAgent() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionLogs, setConnectionLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const hasInjectedRef = useRef(false);
  
  const addLog = useCallback((msg: string) => {
    console.log(`[APEX] ${msg}`);
    setConnectionLogs(prev => [...prev.slice(-15), msg]);
  }, []);

  const conversation = useConversation({
    onConnect: () => {
      addLog('Link Established.');
      setIsConnecting(false);
      setErrorMessage(null);
    },
    onDisconnect: () => {
      addLog('Link Severed.');
      setIsConnecting(false);
      hasInjectedRef.current = false;
    },
    onError: (error) => {
      console.error('ElevenLabs Error:', error);
      setErrorMessage(typeof error === 'string' ? error : 'Handshake failed. Check Agent Public status.');
      setIsConnecting(false);
    },
  });

  const { status, isSpeaking } = conversation;

  const lastStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (status && status !== lastStatusRef.current) {
      addLog(`SDK Status: ${status}`);
      lastStatusRef.current = status;
    }
  }, [status, addLog]);

  const startConversation = useCallback(async () => {
    try {
      setIsConnecting(true);
      setErrorMessage(null);
      addLog('Starting Minimal Connection...');
      
      await navigator.mediaDevices.getUserMedia({ audio: true });
      addLog('Mic Ready.');

      const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '';
      
      // TEST: Start with ZERO overrides to confirm base connectivity
      await conversation.startSession({
        agentId: agentId,
      });

    } catch (error: any) {
      setErrorMessage(error.message || 'Check Mic Permissions.');
      setIsConnecting(false);
    }
  }, [conversation, addLog]);

  // Separate function to trigger sync manually once connected
  const syncIdentity = async () => {
    try {
      addLog('Injecting Neural Data...');
      const fullPrompt = await getPersonalizedPrompt();
      await conversation.sendContextualUpdate(fullPrompt);
      addLog('Sync Complete.');
      hasInjectedRef.current = true;
    } catch (err) {
      addLog('Sync Failed.');
    }
  };

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const isActive = status === 'connected';

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] p-8 bg-slate-900/50 rounded-3xl border border-slate-800 backdrop-blur-sm shadow-2xl transition-all duration-500">
      
      <div className="w-full flex justify-between items-center mb-4 px-2">
        <div className="flex gap-2">
          {isActive && !hasInjectedRef.current && (
            <button 
              onClick={syncIdentity}
              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded-full text-[10px] font-bold border border-indigo-500/30 transition-all animate-pulse"
            >
              <Zap className="w-3 h-3" /> SYNC NEURAL DATA
            </button>
          )}
        </div>
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 transition-colors"
        >
          <Terminal className="w-4 h-4" />
        </button>
      </div>

      <div className="relative mb-12">
        <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-700 ${
          isActive 
            ? (isSpeaking ? 'bg-indigo-500/50 scale-150 animate-pulse' : 'bg-indigo-500/30 scale-125') 
            : (isConnecting ? 'bg-indigo-500/10 scale-110 animate-spin-slow' : 'bg-transparent')
        }`} />
        
        <button
          onClick={isActive ? stopConversation : startConversation}
          disabled={isConnecting}
          className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 transform active:scale-95 group ${
            isActive 
              ? 'bg-red-500 hover:bg-red-600 shadow-red-500/25 shadow-2xl' 
              : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/40 shadow-2xl'
          } ${isConnecting ? 'opacity-50 cursor-not-allowed scale-90' : 'hover:scale-105'}`}
        >
          {isConnecting ? (
            <Loader2 className="w-12 h-12 text-white animate-spin" />
          ) : isActive ? (
            <MicOff className="w-12 h-12 text-white transition-transform group-hover:rotate-12" />
          ) : (
            <Mic className="w-12 h-12 text-white transition-transform group-hover:scale-110" />
          )}
        </button>
      </div>

      <div className="text-center space-y-6 w-full max-w-sm">
        <h2 className="text-2xl font-bold text-white tracking-tight">
          {isConnecting ? 'Syncing Neurons...' : isActive ? 'APEX is Active' : 'Initialize APEX'}
        </h2>
        
        {errorMessage && (
          <div className="flex items-center justify-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-red-200 text-xs font-medium text-left leading-tight">{errorMessage}</p>
          </div>
        )}

        <div className={`w-full overflow-hidden transition-all duration-500 ${isConnecting || isActive || showDebug ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="p-3 bg-black/40 rounded-xl border border-slate-800/50 text-left font-mono">
            <div className="overflow-y-auto max-h-40 scrollbar-hide">
              {connectionLogs.map((log, i) => (
                <p key={i} className={`text-[9px] uppercase tracking-wider mb-1 ${i === connectionLogs.length - 1 ? 'text-indigo-400' : 'text-slate-600'}`}>
                  <span className="opacity-30 mr-2">[{i}]</span> {log}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}