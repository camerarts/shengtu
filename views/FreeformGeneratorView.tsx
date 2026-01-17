import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { AspectRatio, ImageQuality, HistoryItem, ModelProvider } from '../types';
import { ASPECT_RATIOS, RATIO_LABELS } from '../constants';
import { generateImageBlob, uploadImageBlob, createThumbnail, formatBytes, getDimensions } from '../utils';

interface FreeformGeneratorViewProps {
  apiKeys: { gemini: string; modelscope: string };
  history: HistoryItem[];
  onSaveHistory: (item: HistoryItem) => void;
  onRequestSettings: () => void;
}

const MODELSCOPE_SUPPORTED_QUALITIES = [ImageQuality.Q_1K, ImageQuality.Q_2K];

export const FreeformGeneratorView: React.FC<FreeformGeneratorViewProps> = ({
  apiKeys, history, onSaveHistory, onRequestSettings
}) => {
  // --- State ---
  const [prompt, setPrompt] = useState(() => localStorage.getItem('freeform_prompt') || '');     
  const [negativePrompt, setNegativePrompt] = useState(() => localStorage.getItem('freeform_negative_prompt') || '');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(() => 
    (localStorage.getItem('freeform_aspect_ratio') as AspectRatio) || AspectRatio.SQUARE
  );
  const [quality, setQuality] = useState<ImageQuality>(() => {
    const saved = localStorage.getItem('freeform_quality') as ImageQuality;
    return MODELSCOPE_SUPPORTED_QUALITIES.includes(saved) ? saved : ImageQuality.Q_1K;
  });
  
  // Force ModelScope for this view as requested previously, but conceptually adaptable
  const [modelProvider] = useState<ModelProvider>(ModelProvider.MODELSCOPE);
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // --- Effects ---
  useEffect(() => localStorage.setItem('freeform_prompt', prompt), [prompt]);
  useEffect(() => localStorage.setItem('freeform_negative_prompt', negativePrompt), [negativePrompt]);
  useEffect(() => localStorage.setItem('freeform_aspect_ratio', aspectRatio), [aspectRatio]);
  useEffect(() => localStorage.setItem('freeform_quality', quality), [quality]);

  // --- Handlers ---
  const handleGenerate = async () => {
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
      const { blob } = await generateImageBlob(
        apiKeys, modelProvider, prompt, negativePrompt.trim() || undefined, aspectRatio, quality, null
      );

      const duration = (Date.now() - startTime) / 1000;
      const localUrl = URL.createObjectURL(blob);
      const historyId = Date.now().toString();

      // Get real dimensions
      const img = new Image();
      img.src = localUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      const realWidth = img.width;
      const realHeight = img.height;

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
        width: realWidth, 
        height: realHeight
      };
      
      onSaveHistory(newItem);
      setCurrentResult({
        blob, localUrl, width: realWidth, height: realHeight, generationTime: duration, historyId, provider: modelProvider
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

  const getDims = (r: AspectRatio) => getDimensions(r, quality);

  // --- Render ---
  return (
    <div className="flex h-full gap-5">
      
      {/* 
        LEFT PANEL: CONTROL STATION 
        Design: Darker, dense, vertical flow. Fixed width.
        Updated: Allows scrolling with overflow-y-auto to accommodate larger prompt area.
      */}
      <div className="w-[420px] flex flex-col gap-5 flex-shrink-0">
        <GlassCard noPadding className="h-full flex flex-col bg-black/40 border-white/10 overflow-y-auto custom-scrollbar">
            
            {/* 1. Header & Model Selection */}
            <div className="p-5 pb-0 flex-shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                        创意控制台
                    </h2>
                    <div className="text-[10px] font-mono text-white/30">Z-TURBO 引擎</div>
                </div>
                
                {/* Model Badge */}
                <div className="w-full bg-gradient-to-r from-purple-900/30 to-indigo-900/30 border border-purple-500/20 p-3 rounded-xl flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-300">
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </div>
                        <div>
                            <div className="text-xs font-bold text-white/90 tracking-wide">Z-Image-Turbo</div>
                            <div className="text-[10px] text-white/40">ModelScope Cloud</div>
                        </div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></div>
                </div>
            </div>

            {/* 2. Main Input Area (Auto Expand with significant min-height) */}
            <div className="flex-1 px-5 py-2 flex flex-col min-h-[900px]">
                <label className="text-[11px] font-medium text-white/40 mb-2 flex justify-between uppercase tracking-wider">
                    <span>提示词 (Prompt)</span>
                    <span className="text-white/20">{prompt.length} 字符</span>
                </label>
                <div className="flex-1 relative group">
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="在此输入您的创意灵感..."
                        className="w-full h-full bg-black/30 hover:bg-black/40 focus:bg-black/50 border border-white/10 focus:border-indigo-500/50 rounded-xl p-4 text-sm leading-relaxed text-white/90 placeholder-white/20 resize-none transition-all focus:outline-none custom-scrollbar"
                    />
                    <div className="absolute bottom-3 right-3 flex gap-2">
                         <button 
                            onClick={() => navigator.clipboard.writeText(prompt)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/30 hover:text-white transition-colors"
                            title="复制"
                         >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                         </button>
                    </div>
                </div>
            </div>

            {/* 3. Settings Area (Bottom) */}
            <div className="p-5 pt-2 bg-black/20 border-t border-white/5 space-y-5 flex-shrink-0">
                
                {/* Negative Prompt (Collapsible-ish feel) */}
                <div>
                     <label className="text-[10px] font-bold text-white/30 mb-1.5 uppercase tracking-wider">负向提示词 (Negative)</label>
                     <input 
                        type="text" 
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                        placeholder="不想出现的元素 (模糊, 变形...)"
                        className="w-full bg-black/30 border border-white/5 focus:border-white/20 rounded-lg px-3 py-2 text-xs text-white/80 placeholder-white/20 focus:outline-none transition-all"
                     />
                </div>

                {/* Aspect Ratio Select (Dropdown) */}
                <div>
                     <div className="flex justify-between items-end mb-2">
                        <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">画面比例 (Ratio)</label>
                        <span className="text-[10px] font-mono text-indigo-300">{getDims(aspectRatio).width}x{getDims(aspectRatio).height}</span>
                     </div>
                     <div className="relative">
                        <select 
                            value={aspectRatio}
                            onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                            className="w-full appearance-none bg-black/40 border border-white/10 hover:border-white/20 rounded-xl px-3 py-2.5 text-xs font-medium text-white/80 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all cursor-pointer"
                        >
                            {ASPECT_RATIOS.map(r => (
                                <option key={r} value={r} className="bg-[#1a1a20] text-white py-1">
                                    {RATIO_LABELS[r]}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-white/30">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                     </div>
                </div>

                {/* Quality & Action Row */}
                <div className="flex gap-3 items-stretch">
                     {/* Quality Selector */}
                     <div className="w-1/3">
                        <div className="relative h-full">
                            <select 
                                value={quality}
                                onChange={(e) => setQuality(e.target.value as ImageQuality)}
                                className="w-full h-full appearance-none bg-black/40 border border-white/10 hover:border-white/20 rounded-xl px-3 text-xs font-medium text-white/80 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition-all cursor-pointer"
                            >
                                {MODELSCOPE_SUPPORTED_QUALITIES.map(q => <option key={q} value={q} className="bg-[#1a1a20] text-white py-1">{q}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-white/30">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                     </div>

                     {/* Generate Button */}
                     <Button 
                        onClick={handleGenerate} 
                        disabled={loading || !prompt} 
                        isLoading={loading} 
                        className="flex-1 py-3.5 text-sm font-semibold tracking-wide shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] border-indigo-500/30"
                     >
                        {loading ? '生成中...' : '立即生成'}
                     </Button>
                </div>
            </div>
        </GlassCard>
      </div>

      {/* 
        RIGHT PANEL: IMMERSIVE VIEWPORT 
        Design: Minimal, focuses on the image. Floating tools.
      */}
      <div className="flex-1 h-full min-w-0">
        <GlassCard noPadding className="h-full flex flex-col relative overflow-hidden bg-[#0a0a0c]/60 border-white/5">
            
            {/* Top Bar */}
            <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-start z-10 pointer-events-none">
                <div className="flex flex-col">
                   <span className="text-xs font-bold text-white/20 tracking-[0.2em] uppercase">预览视口 (Viewport)</span>
                   {currentResult && (
                      <span className="text-[10px] font-mono text-white/40 mt-1 animate-pulse-slow">
                        渲染 ID: {currentResult.historyId?.slice(-6)}
                      </span>
                   )}
                </div>
                {error && (
                    <div className="pointer-events-auto bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-2 rounded-lg backdrop-blur-md text-xs font-medium shadow-lg animate-in fade-in slide-in-from-top-2">
                        {error}
                    </div>
                )}
            </div>

            {/* Canvas Area */}
            <div className="flex-1 relative flex items-center justify-center p-8">
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>

                {loading && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm z-30">
                     <div className="relative">
                        <div className="w-20 h-20 rounded-full border-2 border-white/5 border-t-indigo-500 animate-spin"></div>
                        <div className="w-16 h-16 rounded-full border-2 border-white/5 border-b-purple-500 animate-spin absolute top-2 left-2 reverse-spin"></div>
                     </div>
                     <p className="mt-6 text-white/60 text-xs font-mono tracking-widest animate-pulse">正在处理数据流...</p>
                   </div>
                )}

                {!currentResult ? (
                    <div className="flex flex-col items-center justify-center text-center opacity-30 select-none">
                        <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center mb-6 rotate-3">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        </div>
                        <p className="text-sm font-medium tracking-wide">准备就绪</p>
                    </div>
                ) : (
                    <div className="relative group max-w-full max-h-full shadow-2xl transition-transform duration-500">
                        {/* Image Frame */}
                        <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black">
                            <img 
                                src={currentResult.cloudUrl || currentResult.localUrl} 
                                alt="Result" 
                                className="max-w-full max-h-[calc(100vh-140px)] w-auto h-auto object-contain"
                                style={{ aspectRatio: `${currentResult.width}/${currentResult.height}` }}
                            />
                            
                            {/* Hover Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                        </div>

                        {/* Floating Action Bar (Bottom Center) */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-300 z-20">
                            
                            {/* Info Chip */}
                            <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/5 flex flex-col items-start mr-1">
                                <span className="text-[10px] text-white/40 font-bold uppercase">参数</span>
                                <span className="text-[10px] text-white/90 font-mono">{currentResult.width}x{currentResult.height} • {formatBytes(currentResult.blob.size)}</span>
                            </div>

                            {/* Actions */}
                            {!currentResult.cloudUrl ? (
                                <button onClick={handleUpload} disabled={uploading} className="p-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-white transition-all border border-transparent hover:border-indigo-500/30" title="上传云端">
                                    <svg className={`w-4 h-4 ${uploading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                </button>
                            ) : (
                                <div className="p-2.5 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20" title="已同步">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                </div>
                            )}

                            <button onClick={handleDownload} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-transparent hover:border-white/10" title="下载">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </button>
                            
                            <a href={currentResult.cloudUrl || currentResult.localUrl} target="_blank" rel="noreferrer" className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-transparent hover:border-white/10" title="全屏查看">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Status */}
            <div className="h-8 border-t border-white/5 bg-black/20 flex items-center justify-between px-4 text-[10px] text-white/20 select-none">
                <div className="flex gap-4">
                    <span>系统状态: 在线</span>
                    {currentResult && <span>耗时: {currentResult.generationTime.toFixed(2)}s</span>}
                </div>
                <div>
                     模型服务: <span className="text-indigo-400/50">MODELSCOPE_API</span>
                </div>
            </div>
        </GlassCard>
      </div>

    </div>
  );
};