import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GlassCard } from './components/GlassCard';
import { Button } from './components/Button';
import { InputWithTools } from './components/InputWithTools';
import { HistoryItemCard } from './components/HistoryItem';
import { SettingsModal } from './components/SettingsModal';
import { AspectRatio, ImageQuality, HistoryItem } from './types';
import { ASPECT_RATIOS, QUALITIES, SYNTH_ID_NOTICE, RATIO_LABELS } from './constants';
import { generateImageBlob, uploadImageBlob, createThumbnail, formatBytes, splitImageToGrid, downloadBatch } from './utils';

const MAX_HISTORY = 20;

function App() {
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  // Prompt State Split
  const [promptHeader, setPromptHeader] = useState(''); // 抬头/风格
  const [promptBody, setPromptBody] = useState('');     // 正文/主体
  
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

  // Split View State
  const [splitImages, setSplitImages] = useState<string[]>([]);
  const [isSplitView, setIsSplitView] = useState(false);
  const [processingSplit, setProcessingSplit] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Computed Prompt: Join with double newline for visual separation
  const combinedPrompt = [promptHeader.trim(), promptBody.trim()].filter(Boolean).join('\n\n');

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

  // Cleanup split images on unmount or new generation
  useEffect(() => {
    return () => {
      setSplitImages([]);
      setIsSplitView(false);
    };
  }, [currentResult]);

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

  const deleteHistoryItem = useCallback((id: string) => {
    setHistory(prev => {
        const updated = prev.filter(item => item.id !== id);
        try { localStorage.setItem('gemini_history', JSON.stringify(updated)); } catch (e) {}
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
    if (!combinedPrompt) return setError("请输入提示词");

    setLoading(true);
    setError(null);
    setCurrentResult(null);
    setIsSplitView(false);
    setSplitImages([]);
    const startTime = Date.now();

    try {
      // 1. Generate Blob (Local)
      const { blob, width, height } = await generateImageBlob(
        apiKey, combinedPrompt, negativePrompt.trim() || undefined, aspectRatio, quality, referenceImage
      );

      const duration = (Date.now() - startTime) / 1000;
      const localUrl = URL.createObjectURL(blob);
      const historyId = Date.now().toString();

      // 2. Generate Thumbnail for History
      const thumb = await createThumbnail(blob);

      const newItem: HistoryItem = {
        id: historyId,
        timestamp: Date.now(),
        prompt: combinedPrompt, // Save full prompt
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

  const handleSplitImage = async () => {
    if (!currentResult || !currentResult.blob) return;
    setProcessingSplit(true);
    try {
        const parts = await splitImageToGrid(currentResult.blob);
        setSplitImages(parts);
        setIsSplitView(true);
    } catch (e) {
        console.error("Split failed", e);
        setError("九宫格切割失败");
    } finally {
        setProcessingSplit(false);
    }
  };

  const handleDownloadAllSplit = () => {
    if (splitImages.length === 0) return;
    downloadBatch(splitImages, `gemini-grid-${Date.now()}`);
  };

  const restoreHistoryItem = (item: HistoryItem) => {
    // We put the whole stored prompt into Body, empty Header, because we can't reliably split it back
    setPromptHeader(''); 
    setPromptBody(item.prompt);
    
    setNegativePrompt(item.negativePrompt || '');
    setAspectRatio(item.aspectRatio);
    setQuality(item.quality);
    
    // Reset Views
    setIsSplitView(false);
    setSplitImages([]);
    
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
    <div className="container mx-auto px-4 py-6 max-w-[1400px] relative z-10">
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
           <div className="hidden sm:block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/50">v3.5-Pro</div>
           <button onClick={() => setShowSettings(true)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
           </button>
        </div>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Column 1: Core Inputs (Header & Body) - Span 3 */}
        <div className="lg:col-span-3 space-y-6">
          <GlassCard title="创意输入" className="h-full">
            <div className="space-y-6">
              <InputWithTools
                label="风格前缀 / 抬头 (Header)"
                value={promptHeader}
                onChange={setPromptHeader}
                placeholder="例如：赛博朋克风格，8k分辨率..."
                multiline={true}
                minHeight="h-32"
              />

              <InputWithTools
                label="画面内容 / 主体 (Body)"
                value={promptBody}
                onChange={setPromptBody}
                placeholder="例如：一只穿着宇航服的猫..."
                multiline={true}
                minHeight="h-64"
              />
            </div>
          </GlassCard>
        </div>

        {/* Column 2: Final Prompt & Configuration - Span 4 */}
        <div className="lg:col-span-4 space-y-6">
          <GlassCard title="配置与预览">
            <div className="space-y-5">
              
              {/* Computed Prompt Preview (ReadOnly) */}
              <InputWithTools
                label="最终 Prompt 预览 (自动生成)"
                value={combinedPrompt}
                readOnly={true}
                multiline={true}
                minHeight="h-48"
                placeholder="(等待输入...)"
              />

              {/* Negative Prompt */}
              <InputWithTools
                label="反向提示词 (Negative)"
                value={negativePrompt}
                onChange={setNegativePrompt}
                placeholder="例如：低质量，变形，模糊..."
                multiline={false}
              />

              {/* Reference Image */}
              <div className="relative">
                <label className="text-xs text-white/40 mb-1.5 block ml-1">参考图片 (Optional)</label>
                {!referenceImage ? (
                  <div onClick={() => fileInputRef.current?.click()} className="w-full h-12 border border-dashed border-white/20 rounded-xl bg-white/5 hover:bg-white/10 hover:border-indigo-500/50 transition-all flex items-center justify-center gap-2 cursor-pointer group">
                    <svg className="w-4 h-4 text-white/40 group-hover:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-xs text-white/40 group-hover:text-white/70">上传参考图</span>
                  </div>
                ) : (
                  <div className="w-full h-12 border border-white/10 rounded-xl bg-black/30 flex items-center justify-between p-1.5 pl-3">
                    <div className="flex items-center gap-3"><div className="h-8 w-8 rounded overflow-hidden border border-white/20"><img src={referenceImage} alt="Ref" className="w-full h-full object-cover" /></div><span className="text-xs text-white/80">已使用参考图</span></div>
                    <button onClick={() => { setReferenceImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" className="hidden" />
              </div>

              {/* Settings Dropdowns */}
              <div className="grid grid-cols-2 gap-3">
                 <div>
                   <label className="text-xs text-white/40 mb-1.5 block ml-1">图片比例</label>
                   <div className="relative">
                      <select 
                        value={aspectRatio} 
                        onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                        className="w-full appearance-none bg-black/20 border border-white/10 hover:border-white/20 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all cursor-pointer"
                      >
                        {ASPECT_RATIOS.map((r) => (
                          <option key={r} value={r} className="bg-[#1a1a20] text-white py-1">
                            {RATIO_LABELS[r] || r}
                          </option>
                        ))}
                      </select>
                   </div>
                 </div>
                 <div>
                   <label className="text-xs text-white/40 mb-1.5 block ml-1">清晰度</label>
                   <div className="relative">
                      <select 
                        value={quality} 
                        onChange={(e) => setQuality(e.target.value as ImageQuality)}
                        className="w-full appearance-none bg-black/20 border border-white/10 hover:border-white/20 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all cursor-pointer"
                      >
                        {QUALITIES.map((q) => (
                          <option key={q} value={q} className="bg-[#1a1a20] text-white py-1">
                            {q} Ultra HD
                          </option>
                        ))}
                      </select>
                   </div>
                 </div>
              </div>

              <Button onClick={handleGenerate} disabled={loading || !combinedPrompt} isLoading={loading} className="w-full py-3 text-lg shadow-xl shadow-indigo-500/10 hover:shadow-indigo-500/30">{loading ? '生成中...' : '开始绘制'}</Button>
            </div>
          </GlassCard>
        </div>

        {/* Column 3: Result & History - Span 5 */}
        <div className="lg:col-span-5 space-y-6">
          <GlassCard className="min-h-[500px] flex flex-col justify-center relative overflow-hidden">
            {error && <div className="absolute top-6 left-6 right-6 z-20 bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl backdrop-blur-md shadow-2xl">{error}</div>}
            
            {!currentResult && !loading && !error && <div className="text-center space-y-4 opacity-50"><p className="text-white/40 text-sm">Waiting for inspiration...</p></div>}
            
            {(loading || processingSplit) && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm z-10"><div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-indigo-500 animate-spin"></div></div>}

            {currentResult && (
              <div className="relative w-full h-full flex flex-col">
                <div className="flex-grow flex items-center justify-center bg-black/40 rounded-2xl overflow-hidden mb-4 border border-white/5 relative group">
                  {isSplitView && splitImages.length > 0 ? (
                    <div className="w-full h-full max-h-[600px] grid grid-cols-3 gap-1 p-1 bg-black/50 overflow-y-auto">
                        {splitImages.map((src, i) => (
                            <img key={i} src={src} className="w-full h-full object-cover" alt={`Split ${i}`} />
                        ))}
                    </div>
                  ) : (
                    <img src={currentResult.cloudUrl || currentResult.localUrl} alt="Result" className="max-h-[600px] w-auto max-w-full object-contain shadow-2xl" />
                  )}
                  
                  {/* Floating Action Bar */}
                  <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex items-center justify-between shadow-2xl z-20 transition-all">
                     <div className="flex items-center gap-2 pl-2">
                        {!isSplitView && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 border border-white/5 text-[10px] font-mono text-white/90">
                             {currentResult.width} x {currentResult.height}
                          </div>
                        )}
                        {currentResult.blob && currentResult.blob.size > 0 && !isSplitView && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/10 border border-white/5 text-[10px] font-mono text-white/90">
                             {formatBytes(currentResult.blob.size)}
                          </div>
                        )}
                        {isSplitView && <div className="text-xs font-semibold text-white/80 px-2">九宫格视图</div>}
                     </div>

                     <div className="flex items-center gap-1.5">
                         {!isSplitView && (
                           <>
                             {!currentResult.cloudUrl ? (
                                <button onClick={handleUpload} disabled={uploading} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-200 hover:text-white transition-all text-xs font-medium disabled:opacity-50">
                                   {uploading ? <span className="animate-spin">C</span> : <span>↑</span>} <span>上传</span>
                                </button>
                             ) : (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium cursor-default">
                                    <span>✓ 已同步</span>
                                </div>
                             )}
                             <button onClick={handleSplitImage} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all" title="九宫格"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg></button>
                             <div className="w-px h-4 bg-white/10 mx-1"></div>
                             <button onClick={handleDownload} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all" title="下载"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                             <a href={currentResult.cloudUrl || currentResult.localUrl} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all" title="打开"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg></a>
                           </>
                         )}
                         {isSplitView && (
                            <>
                               <button onClick={handleDownloadAllSplit} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-200 hover:text-white transition-all text-xs font-medium"><span>一键下载 (9张)</span></button>
                               <div className="w-px h-4 bg-white/10 mx-1"></div>
                               <button onClick={() => setIsSplitView(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all" title="退出"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                            </>
                         )}
                     </div>
                  </div>
                </div>
                <div className="flex justify-between items-center px-2">
                   <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                         <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>
                         <span className="text-xs text-white/40 font-mono">{(currentResult.generationTime).toFixed(2)}s</span>
                      </div>
                      <span className="text-[10px] text-white/20">|</span>
                      <p className="text-[10px] text-white/30 tracking-wide">{SYNTH_ID_NOTICE}</p>
                   </div>
                </div>
              </div>
            )}
          </GlassCard>

          <GlassCard title="最近创作">
             {history.length === 0 ? <div className="text-white/30 text-sm py-4">暂无历史记录。</div> : 
               <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 gap-4">
                 {history.map(item => <HistoryItemCard key={item.id} item={item} onClick={restoreHistoryItem} onDelete={deleteHistoryItem} />)}
               </div>
             }
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

export default App;