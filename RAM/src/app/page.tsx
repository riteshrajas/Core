'use client';

import VoiceAgent from '@/components/VoiceAgent';
import { ConversationProvider } from '@elevenlabs/react';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 selection:bg-indigo-500/30">
      {/* Background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-4xl z-10 flex flex-col items-center text-center space-y-12">
        <header className="space-y-4">
          <div className="inline-block px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-widest">
              Knowledge-Aware Agent
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tighter leading-none">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400 text-shadow-glow">APEX</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl max-w-lg mx-auto font-medium">
            Your real-time digital twin and agentic AI ecosystem.
          </p>
        </header>

        <section className="w-full max-w-md">
          <ConversationProvider>
            <VoiceAgent />
          </ConversationProvider>
        </section>

        <footer className="pt-12">
          <p className="text-slate-600 text-xs font-mono tracking-widest uppercase">
            System ready • All sensors online
          </p>
        </footer>
      </div>
    </main>
  );
}