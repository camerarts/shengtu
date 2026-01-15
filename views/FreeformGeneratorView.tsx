import React, { useState, useEffect, useRef } from 'react';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { InputWithTools } from '../components/InputWithTools';
import { HistoryItemCard } from '../components/HistoryItem';
import { AspectRatio, ImageQuality, HistoryItem, ModelProvider } from '../types';
import { ASPECT_RATIOS, QUALITIES, SYNTH_ID_NOTICE, RATIO_LABELS } from '../constants';
import { generateImageBlob, uploadImageBlob, createThumbnail, formatBytes } from '../utils';

// Icons
const AspectRatioIcon = ({ ratio }: { ratio: AspectRatio }) => {
  const common = "stroke-current stroke-2 fill-none";
  switch (ratio) {
    case AspectRatio.SQUARE: return <svg className="w-4 h-4" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2" className={common} /></svg>;
    default: return <svg className="w-4 h-4" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2" className={common} /></svg>;
  }
};

interface FreeformGeneratorViewProps {
  apiKeys: { gemini: string; modelscope: string };
  history: HistoryItem[];
  onSaveHistory: (item: HistoryItem) => void;
  onDeleteHistory: (id: string) => void;
  onClearHistory: () => void;
  onRequestSettings: () => void;
}

export const FreeformGeneratorView: React.FC<FreeformGeneratorViewProps> = ({
  apiKeys, history, onSaveHistory, onDeleteHistory, onClearHistory, onRequestSettings
}) => {
  // Uses distinct local storage keys for "freeform" workspace
  const [prompt, setPrompt] = useState(() => localStorage.getItem('freeform_prompt') || '');     
  const [negativePrompt, setNegativePrompt] = useState(() => localStorage.getItem('freeform_negative_prompt') || '');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => 
    (localStorage.getItem('freeform_aspect_ratio') as AspectRatio) || AspectRatio.SQUARE
  );
  const [quality, setQuality] = useState<ImageQuality>(() => 
    (localStorage.getItem('freeform_quality') as ImageQuality) || ImageQuality.Q_1K
  );
  
  // FIXED: Only support ModelScope (Z-Image-Turbo) as requested
  const [modelProvider] = useState<ModelProvider>(ModelProvider.MODELSCOPE);
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [isRatioOpen, setIsRatioOpen] = useState(false);
  const ratioDropdownRef = useRef<HTMLDivElement>(null);

  const [currentResult, setCurrentResult] = useState<{
    blob: Blob;
    localUrl: string;
    cloudUrl?: string;
    width: number;
    height: number;
    generationTime: number;
    historyId?: string;
    provider: ModelProvider;
  } | null>(null);

  useEffect(() => localStorage.setItem('freeform_prompt', prompt), [prompt]);
  useEffect(() => localStorage.setItem('freeform_negative_prompt', negativePrompt), [negativePrompt]);
  useEffect(() => localStorage.setItem('freeform_aspect_ratio', aspectRatio), [aspectRatio]);
  useEffect(() => localStorage.setItem('freeform_quality', quality), [quality]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ratioDropdownRef.current && !ratioDropdownRef.current.contains(event.target as Node)) {
        setIsRatioOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerate = async () => {
    // Only check ModelScope key
    if (modelProvider === ModelProvider.MODELSCOPE && !apiKeys.modelscope) {
      setError("请先配置 ModelScope Token");
      onRequestSettings();
      return;
    }
    if (!prompt) return setError("请输入提示词");

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      const { blob, width, height } = await generateImageBlob(
        apiKeys, modelProvider, prompt, negativePrompt.trim() || undefined, aspectRatio, quality, null
      );

      const duration = (Date.now() - startTime) / 1000;
      const localUrl = URL.createObjectURL(blob);
      const historyId = Date.now().toString();

      const thumb = await createThumbnail(blob);
      const newItem: HistoryItem = {
        id: historyId,
        timestamp: Date.now(),
        prompt: prompt,
        negativePrompt: negativePrompt.trim() || undefined,
        aspectRatio,
        quality,
        provider: modelProvider,
        thumbnailBase64: thumb,
        width, height
      };
      
      onSaveHistory(newItem);

      setCurrentResult({
        blob, localUrl, width, height, generationTime: duration, historyId, provider: modelProvider
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
      const url = await uploadImageBlob(currentResult.blob);
      setCurrentResult(prev => prev ? { ...prev, cloudUrl: url } : null);
      
      const itemToUpdate = history.find(h => h.id === currentResult.historyId);
      if (itemToUpdate) {
        onSaveHistory({ ...itemToUpdate, imageUrl: url });
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
    link.href = currentResult.localUrl;
    link.download = `z-image-turbo-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const restoreHistoryItem = (item: HistoryItem) => {
    setPrompt(item.prompt);
    setNegativePrompt(item.negativePrompt || '');
    setAspectRatio(item.aspectRatio);
    setQuality(item.quality);
    
    setCurrentResult({
      blob: new Blob(), 
      localUrl: item.imageUrl || item.thumbnailBase64,
      cloudUrl: item.imageUrl,
      width: item.width,
      height: item.height,
      generationTime: 0,
      historyId: item.id,
      provider: item.provider || ModelProvider.GEMINI
    });
  };

  const getAspectRatioStyle = () => {
    return { aspectRatio: aspectRatio.replace(':', '/') };
  };

  return (
    <div className="flex h-full gap-6">
      
      {/* Left Column: Inputs */}
      <div className="w-[43%] h-full flex flex-col min-w-[420px]">
        <GlassCard title="创意参数" className="h-full flex flex-col">
            <div className="flex-1 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                
                {/* Model Indicator */}
                <div>
                    <label className="text-xs text-white/40 mb-1.5 block ml-1">绘图模型 (Model)</label>
                    <div className="w-full bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/20 text-purple-200 p-3 rounded-xl text-xs font-medium flex items-center justify-between shadow-sm hover:border-purple-500/40 transition-colors cursor-default">
                        <div className="flex items-center gap-2">
                            <div className="p-1 rounded bg-purple-500/20">
                                <svg className="w-3.5 h-3.5 text-purple-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                            <span className="tracking-wide">Z-Image-Turbo</span>
                        </div>
                        <div className="flex items-center gap-2">
                             <span className="text-[10px] text-white/40">ModelScope</span>
                             <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
                        </div>
                    </div>
                </div>

                <InputWithTools
                    label="提示词 (Prompt)"
                    value={prompt}
                    onChange={setPrompt}
                    placeholder="描述你想要的画面..."
                    multiline={true}
                    minHeight="h-32"
                    className="flex-shrink-0"
                />

                <InputWithTools
                    label="反向提示词 (Negative)"
                    value={negativePrompt}
                    onChange={setNegativePrompt}
                    placeholder="不需要的元素..."
                    multiline={false}
                />

                {/* Config Row */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-white/40 mb-1.5 block ml-1">比例</label>
                        <div className="relative" ref={ratioDropdownRef}>
                            <div 
                                onClick={() => setIsRatioOpen(!isRatioOpen)}
                                className="w-full bg-black/20 border border-white/10 hover:border-white/20 rounded-xl px-3 py-2.5 text-xs text-white flex items-center justify-between cursor-pointer transition-all"
                            >
                                <span className="truncate">{RATIO_LABELS[aspectRatio]}</span>
                                <svg className={`w-3 h-3 text-white/50 transition-transform ${isRatioOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                            {isRatioOpen && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a20] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden py-1 max-h-60 overflow-y-auto">
                                {ASPECT_RATIOS.map((r) => (
                                    <div 
                                    key={r}
                                    onClick={() => { setAspectRatio(r); setIsRatioOpen(false); }}
                                    className={`px-3 py-2.5 flex items-center gap-2 hover:bg-white/5 cursor-pointer ${aspectRatio === r ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/80'}`}
                                    >
                                    <AspectRatioIcon ratio={r} />
                                    <span className="text-xs font-medium">{RATIO_LABELS[r]}</span>
                                    </div>
                                ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-white/40 mb-1.5 block ml-1">清晰度</label>
                        <select 
                            value={quality} 
                            onChange={(e) => setQuality(e.target.value as ImageQuality)}
                            className="w-full appearance-none bg-black/20 border border-white/10 hover:border-white/20 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all cursor-pointer"
                        >
                            {QUALITIES.map((q) => <option key={q} value={q} className="bg-[#1a1a20]">{q}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5">
                <Button onClick={handleGenerate} disabled={loading || !prompt} isLoading={loading} className="w-full py-3 shadow-xl">
                    立即生成
                </Button>
            </div>
        </GlassCard>
      </div>

      {/* Right Column: Preview + History */}
      <div className="flex-1 flex flex-col h-full gap-6 min-w-0">
         
         {/* Top Right: Preview (Explicitly set flex-grow-2 using style to ensure ratio) */}
         <div className="min-h-0" style={{ flex: '2 1 0%' }}>
            <GlassCard noPadding className="h-full flex flex-col justify-center relative overflow-hidden bg-black/40 border-white/10">
                {/* Header for Preview Section to make it distinct */}
                <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10 pointer-events-none">
                    <span className="text-xs font-bold text-white/30 tracking-wider uppercase bg-black/40 px-2 py-1 rounded backdrop-blur-md">预览画布</span>
                </div>

                {error && <div className="absolute top-12 left-6 right-6 z-20 bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl backdrop-blur-md">{error}</div>}
                
                {loading && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-20"><div className="w-16 h-16 rounded-full border-t-2 border-r-2 border-indigo-500 animate-spin"></div><p className="mt-4 text-white/50 text-sm animate-pulse">正在绘制...</p></div>}

                {!currentResult ? (
                    <div className="w-full h-full flex items-center justify-center p-8">
                        {/* Placeholder Canvas */}
                        <div 
                            className="w-full max-h-full border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center bg-white/5 backdrop-blur-sm transition-all duration-500"
                            style={getAspectRatioStyle()}
                        >
                           <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                              <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                           </div>
                           <p className="text-sm font-medium text-white/40">画板准备就绪</p>
                           <p className="text-xs text-white/20 mt-1">尺寸 {RATIO_LABELS[aspectRatio]}</p>
                        </div>
                    </div>
                ) : (
                    <div className="relative w-full h-full flex items-center justify-center group bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')]">
                        <img src={currentResult.cloudUrl || currentResult.localUrl} alt="Result" className="w-full h-full object-contain max-h-[calc(100%-2rem)]" />
                        
                        {/* Floating Toolbar */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-2 flex items-center gap-2 shadow-2xl opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0 z-20">
                            <div className="px-3 text-xs font-mono text-white/60 border-r border-white/10 flex items-center gap-2">
                                <span>{currentResult.width}x{currentResult.height}</span>
                                <span className="w-px h-3 bg-white/10"></span>
                                <span>{formatBytes(currentResult.blob.size)}</span>
                            </div>
                            {!currentResult.cloudUrl ? (
                                <button onClick={handleUpload} disabled={uploading} className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs transition-all">
                                    {uploading ? 'Up...' : '上传'}
                                </button>
                            ) : (
                                <span className="px-3 text-xs text-green-400">已同步</span>
                            )}
                            <button onClick={handleDownload} className="p-1.5 hover:bg-white/10 rounded-lg text-white/70">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </button>
                        </div>

                        {/* SynthID / Model Provider Notice */}
                        <div className="absolute bottom-2 right-2 z-10">
                            {currentResult.provider === ModelProvider.GEMINI ? (
                                <p className="text-[10px] text-white/20 tracking-wide mix-blend-plus-lighter">{SYNTH_ID_NOTICE}</p>
                            ) : (
                                <p className="text-[10px] text-purple-300/30 tracking-wide mix-blend-plus-lighter">Generated by ModelScope</p>
                            )}
                        </div>
                    </div>
                )}
            </GlassCard>
         </div>

         {/* Bottom Right: History */}
         <div className="min-h-[200px]" style={{ flex: '1 1 0%' }}>
            <GlassCard 
                title="历史记录" 
                className="h-full flex flex-col"
                headerAction={
                    history.length > 0 && (
                        <button 
                            onClick={onClearHistory}
                            className="text-xs text-red-300/70 hover:text-red-300 hover:bg-red-500/10 px-2 py-1 rounded transition-colors flex items-center gap-1 border border-transparent hover:border-red-500/20"
                            title="清空所有记录"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            清空
                        </button>
                    )
                }
            >
                {history.length === 0 ? <div className="text-white/30 text-sm py-4 text-center">空</div> : 
                <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pr-1 content-start">
                    {history.map(item => <HistoryItemCard key={item.id} item={item} onClick={restoreHistoryItem} onDelete={onDeleteHistory} />)}
                </div>
                }
            </GlassCard>
         </div>

      </div>

    </div>
  );
};