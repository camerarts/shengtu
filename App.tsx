import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GlassCard } from './components/GlassCard';
import { Button } from './components/Button';
import { HistoryItemCard } from './components/HistoryItem';
import { SettingsModal } from './components/SettingsModal';
import { AspectRatio, ImageQuality, HistoryItem } from './types';
import { ASPECT_RATIOS, QUALITIES, SYNTH_ID_NOTICE, RATIO_LABELS } from './constants';
import { generateImageBlob, uploadImageBlob, createThumbnail } from './utils';

const MAX_HISTORY = 20;

function App() {
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => 
    (localStorage.getItem('gemini_aspect_ratio') as AspectRatio) || AspectRatio.SQUARE
  );
  const [quality, setQuality] = useState<ImageQuality>(() => 
    (localStorage.getItem('gemini_quality') as ImageQuality) || ImageQuality.Q_1K
  );
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Current Active Result
  const [currentResult, setCurrentResult] = useState<{
    blob: Blob;
    localUrl: string; // ObjectURL for display
    cloudUrl?: string; // Set after upload
    width: number;
    height: number;
    generationTime: number;
    historyId?: string; // To update history later
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // --- Effects ---
  useEffect(() => localStorage.setItem('gemini_aspect_ratio', aspectRatio), [aspectRatio]);
  useEffect(() => localStorage.setItem('gemini_quality', quality), [quality]);
  useEffect(() => {
    const savedHistory = localStorage.getItem('gemini_history');
    if (savedHistory) {
      try { setHistory(JSON.parse(savedHistory)); } catch (e) {}
    }
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
  }, []);

  const saveToHistory = useCallback((newItem: HistoryItem) => {
    setHistory(prev => {
      // If updating existing item (adding cloud URL), find and replace
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) return setError("参考图片不能超过 5MB");
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setReferenceImage(event.target.result as string);
          setError(null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!apiKey) {
      setError("请先配置 API Key");
      setShowSettings(true);
      return;
    }
    if (!prompt.trim()) return setError("请输入提示词");

    setLoading(true);
    setError(null);
    setCurrentResult(null);
    const startTime = Date.now();

    try {
      // 1. Generate Blob (Local)
      const { blob, width, height } = await generateImageBlob(
        apiKey, prompt.trim(), negativePrompt.trim() || undefined, aspectRatio, quality, referenceImage
      );

      const duration = (Date.now() - startTime) / 1000;
      const localUrl = URL.createObjectURL(blob);
      const historyId = Date.now().toString();

      // 2. Generate Thumbnail for History
      const thumb = await createThumbnail(blob);

      const newItem: HistoryItem = {
        id: historyId,
        timestamp: Date.now(),
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        aspectRatio,
        quality,
        thumbnailBase64: thumb, // Save small thumb
        imageUrl: undefined,    // No cloud URL yet
        width, height
      };
      
      saveToHistory(newItem);

      setCurrentResult({
        blob,
        localUrl,
        width,
        height,
        generationTime: duration,
        historyId
      });

    } catch (err: any) {
      setError(err.message || "生成失败");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!currentResult || uploading) return;
    setUploading(true);
    try {
      // Upload Blob
      const url = await uploadImageBlob(currentResult.blob);
      
      // Update State
      setCurrentResult(prev => prev ? { ...prev, cloudUrl: url } : null);

      // Update History
      const itemToUpdate = history.find(h => h.id === currentResult.historyId);
      if (itemToUpdate) {
        saveToHistory({ ...itemToUpdate, imageUrl: url });
      }
    } catch (e: any) {
      setError("上传失败: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = () => {
    if (!currentResult) return;
    const link = document.createElement('a');
    link.href = currentResult.localUrl; // Download from local blob is fastest
    link.download = `gemini-3-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const restoreHistoryItem = (item: HistoryItem) => {
    setPrompt(item.prompt);
    setNegativePrompt(item.negativePrompt || '');
    setAspectRatio(item.aspectRatio);
    setQuality(item.quality);
    
    // For history items, we might not have the Blob anymore (unless we cache it, but page reload clears cache)
    // If we have Cloud URL, use it. If not, we only have the thumbnail :(
    // This is a trade-off of "Local First" without Persistent Storage (IndexedDB).
    
    setCurrentResult({
      blob: new Blob(), // Empty blob, download might fail if not cloud
      localUrl: item.imageUrl || item.thumbnailBase64, // Fallback to thumb if no cloud
      cloudUrl: item.imageUrl,
      width: item.width,
      height: item.height,
      generationTime: 0,
      historyId: item.id
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl relative z-10">
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={(k) => { setApiKey(k); setShowSettings(false); localStorage.setItem('gemini_api_key', k); }}
        initialKey={apiKey}
      />

      <nav className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/20"></div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-tight">
            Gemini 3 灵感绘图
          </h1>
        </div>
        <div className="flex items-center gap-3">
           <div className="hidden sm:block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/50">v3.2-Blob</div>
           <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
           </button>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          <GlassCard title="创意提示词 (Prompt)">
            <div className="space-y-4">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="描述你的想象... (例如：一座由透明水晶构成的未来城市，日落光照，8k渲染)" className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 transition-all resize-none h-32 text-sm leading-relaxed" />
              <input type="text" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} placeholder="反向提示词" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 transition-all text-sm" />
              
              <div className="relative">
                {!referenceImage ? (
                  <div onClick={() => fileInputRef.current?.click()} className="w-full h-16 border border-dashed border-white/20 rounded-xl bg-white/5 hover:bg-white/10 hover:border-indigo-500/50 transition-all flex items-center justify-center gap-2 cursor-pointer group">
                    <svg className="w-5 h-5 text-white/40 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-sm text-white/40 group-hover:text-white/70">上传参考图</span>
                  </div>
                ) : (
                  <div className="w-full h-16 border border-white/10 rounded-xl bg-black/30 flex items-center justify-between p-2 pl-3">
                    <div className="flex items-center gap-3"><div className="h-12 w-12 rounded-lg overflow-hidden border border-white/20"><img src={referenceImage} alt="Ref" className="w-full h-full object-cover" /></div><span className="text-sm text-white/80">已使用参考图</span></div>
                    <button onClick={() => { setReferenceImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-400"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
              </div>

              <Button onClick={handleGenerate} disabled={loading || !prompt} isLoading={loading} className="w-full py-3 text-lg">{loading ? '生成中...' : '开始生成'}</Button>
            </div>
          </GlassCard>

          <GlassCard title="参数配置">
             <div className="space-y-6">
               <div>
                 <label className="text-xs text-white/50 uppercase font-semibold mb-3 block">图片比例</label>
                 <div className="grid grid-cols-5 gap-2">{ASPECT_RATIOS.map((r) => <button key={r} onClick={() => setAspectRatio(r)} className={`flex flex-col items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold border transition-all ${aspectRatio === r ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-105' : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10'}`}><span>{r}</span></button>)}</div>
               </div>
               <div>
                 <label className="text-xs text-white/50 uppercase font-semibold mb-3 block">清晰度</label>
                 <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">{QUALITIES.map((q) => <button key={q} onClick={() => setQuality(q)} className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${quality === q ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/50 hover:text-white'}`}>{q}</button>)}</div>
               </div>
             </div>
          </GlassCard>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <GlassCard className="min-h-[500px] flex flex-col justify-center relative overflow-hidden">
            {error && <div className="absolute top-6 left-6 right-6 z-20 bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl backdrop-blur-md">{error}</div>}
            {!currentResult && !loading && !error && <div className="text-center space-y-4 opacity-50"><p className="text-white/40 text-sm">输入提示词，开始绘制你的梦境</p></div>}
            {loading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm z-10"><div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-indigo-500 animate-spin"></div></div>}

            {currentResult && (
              <div className="relative w-full h-full flex flex-col">
                <div className="flex-grow flex items-center justify-center bg-black/40 rounded-xl overflow-hidden mb-4 border border-white/5 relative">
                  <img src={currentResult.cloudUrl || currentResult.localUrl} alt="Result" className="max-h-[600px] w-auto max-w-full object-contain shadow-2xl" />
                </div>
                
                <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-white/50">
                       <span className="w-2 h-2 rounded-full bg-green-500"></span>
                       <span>耗时: {currentResult.generationTime.toFixed(2)}秒</span>
                       {currentResult.cloudUrl ? <span className="text-indigo-400 ml-2">已云端同步</span> : <span className="text-orange-300 ml-2">本地预览模式</span>}
                    </div>
                    <p className="text-[10px] text-indigo-300/80">{SYNTH_ID_NOTICE}</p>
                  </div>
                  
                  <div className="flex gap-3">
                     {/* Upload Button */}
                     {!currentResult.cloudUrl && (
                         <Button 
                            variant="secondary" 
                            onClick={handleUpload} 
                            isLoading={uploading}
                            className="bg-indigo-500/20 border-indigo-500/30 hover:bg-indigo-500/30 text-indigo-200"
                         >
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                            上传云端
                         </Button>
                     )}
                     
                     <Button variant="secondary" onClick={() => setCurrentResult(null)}>关闭</Button>
                     <Button variant="primary" onClick={handleDownload}>下载</Button>
                  </div>
                </div>
              </div>
            )}
          </GlassCard>

          <GlassCard title="最近创作">
             {history.length === 0 ? <div className="text-white/30 text-sm py-4">暂无历史记录。</div> : 
               <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                 {history.map(item => <HistoryItemCard key={item.id} item={item} onClick={restoreHistoryItem} />)}
               </div>
             }
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

export default App;