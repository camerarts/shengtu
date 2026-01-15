import { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';
import { GridGeneratorView } from './views/GridGeneratorView';
import { FreeformGeneratorView } from './views/FreeformGeneratorView';
import { HistoryItem } from './types';

const MAX_HISTORY = 20;

function AppContent() {
  // Global State: API Keys & History
  const [apiKeys, setApiKeys] = useState({ gemini: '', modelscope: '' });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  
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

  // Determine title based on location
  const location = useLocation();
  const getPageTitle = () => {
    if (location.pathname.includes('freeform')) return '自由创意工坊';
    return 'Gemini 3 灵感绘图';
  };

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
      <Sidebar 
        onSettingsClick={() => setShowSettings(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full pl-6 py-6 pr-4 min-w-0">
        
        {/* Header */}
        <nav className="flex-none flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-tight">
              {getPageTitle()}
            </h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="hidden sm:block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/50">v3.8-Router</div>
          </div>
        </nav>

        {/* View Content */}
        <div className="flex-1 min-h-0">
          <Routes>
            <Route path="/grid" element={
              <GridGeneratorView 
                apiKeys={apiKeys} 
                history={history} 
                onSaveHistory={saveToHistory}
                onDeleteHistory={deleteHistoryItem}
                onRequestSettings={() => setShowSettings(true)}
              />
            } />
            <Route path="/freeform" element={
              <FreeformGeneratorView 
                apiKeys={apiKeys}
                history={history}
                onSaveHistory={saveToHistory}
                onDeleteHistory={deleteHistoryItem}
                onRequestSettings={() => setShowSettings(true)}
              />
            } />
            <Route path="*" element={<Navigate to="/grid" replace />} />
          </Routes>
        </div>

      </div>
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}

export default App;