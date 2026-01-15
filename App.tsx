import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, ViewMode } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';
import { GridGeneratorView } from './views/GridGeneratorView';
import { FreeformGeneratorView } from './views/FreeformGeneratorView';
import { HistoryItem } from './types';

const MAX_HISTORY = 20;

function App() {
  // Global State: API Keys & History
  const [apiKeys, setApiKeys] = useState({ gemini: '', modelscope: '' });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  
  // Navigation State
  const [activeMode, setActiveMode] = useState<ViewMode>('grid');

  // Initialization
  useEffect(() => {
    const savedHistory = localStorage.getItem('gemini_history');
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch (e) {}
    }
    const savedGeminiKey = localStorage.getItem('gemini_api_key');
    const savedModelScopeKey = localStorage.getItem('modelscope_api_key');
    setApiKeys({ 
      gemini: savedGeminiKey || '', 
      modelscope: savedModelScopeKey || '' 
    });
  }, []);

  const saveToHistory = useCallback((newItem: HistoryItem) => {
    setHistory(prev => {
      const existingIdx = prev.findIndex(p => p.id === newItem.id);
      let updated;
      if (existingIdx >= 0) {
        updated = [...prev];
        updated[existingIdx] = newItem;
      } else {
        updated = [newItem, ...prev].slice(0, MAX_HISTORY);
      }
      try { localStorage.setItem('gemini_history', JSON.stringify(updated)); } catch (e) { console.warn("LS Full"); }
      return updated;
    });
  }, []);

  const deleteHistoryItem = useCallback((id: string) => {
    setHistory(prev => {
        const updated = prev.filter(item => item.id !== id);
        try { localStorage.setItem('gemini_history', JSON.stringify(updated)); } catch (e) {}
        return updated;
    });
  }, []);

  return (
    <div className="flex h-[83.3333vh] container mx-auto max-w-[1600px] relative z-10 box-border overflow-hidden">
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={(keys) => { 
          setApiKeys(keys); 
          setShowSettings(false); 
          localStorage.setItem('gemini_api_key', keys.gemini);
          localStorage.setItem('modelscope_api_key', keys.modelscope);
        }}
        initialKeys={apiKeys}
      />

      {/* Sidebar Navigation */}
      <Sidebar activeMode={activeMode} onModeChange={setActiveMode} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full pl-6 py-6 pr-4 min-w-0">
        
        {/* Header */}
        <nav className="flex-none flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-tight">
              {activeMode === 'grid' ? 'Gemini 3 灵感绘图' : '自由创意工坊'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/50">v3.7-MultiView</div>
             <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             </button>
          </div>
        </nav>

        {/* View Content */}
        <div className="flex-1 min-h-0">
          {activeMode === 'grid' ? (
            <GridGeneratorView 
              apiKeys={apiKeys} 
              history={history} 
              onSaveHistory={saveToHistory}
              onDeleteHistory={deleteHistoryItem}
              onRequestSettings={() => setShowSettings(true)}
            />
          ) : (
            <FreeformGeneratorView 
              apiKeys={apiKeys}
              history={history}
              onSaveHistory={saveToHistory}
              onDeleteHistory={deleteHistoryItem}
              onRequestSettings={() => setShowSettings(true)}
            />
          )}
        </div>

      </div>
    </div>
  );
}

export default App;