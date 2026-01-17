import React, { useState, useEffect } from 'react';
import { GlassCard } from '../components/GlassCard';
import { Button } from '../components/Button';
import { AspectRatio, ImageQuality, HistoryItem, ModelProvider } from '../types';
import { ASPECT_RATIOS } from '../constants';
import { generateImageBlob, uploadImageBlob, createThumbnail, getDimensions } from '../utils';

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

  // Common styles for unified tone
  const inputBaseStyle = "bg-white/5 border border-white/10 rounded-xl px-3 text-xs text-white/90 focus:outline-none focus:border-indigo-500/30 transition-all";

  // --- Render ---
  return (
    <div className="flex h-full gap-5">
      
      {/* 
        LEFT PANEL: CONTROL STATION 
        Width: 2/3 (66%) - Significantly increased from fixed 600px
        Style: Unified dark glass tone
      */}
      <div className="w-2/3 flex flex-col gap-5 flex-shrink-0">
        <GlassCard noPadding className="h-full flex flex-col bg-black/40 border-white/10 overflow-hidden">
            
            {/* 1. Header & Scrollable Content Container */}
            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
                
                {/* Header Section */}
                <div className="p-5 pb-0 flex-shrink-0">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-bold text-white/80 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-1.5 h-4 bg-indigo-500 rounded-full"></span>
                            创意控制台
                        </h2>
                        <div className="text-[10px] font-mono text-white/30">Z-TURBO</div>
                    </div>
                </div>

                {/* Main Input Area - Massive Height */}
                <div className="flex-1 px-5 py-4 flex flex-col min-h-[600px]">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-[11px] font-medium text-white/40 uppercase tracking-wider">提示词 (Prompt)</label>
                        <span className="text-[10px] font-mono text-white/20">{prompt.length} chars</span>
                    </div>
                    <div className="flex-1 relative group">
                        <textarea 
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="描述画面细节、光影、风格..."
                            className={`w-full h-full p-4 text-sm leading-relaxed resize-none custom-scrollbar placeholder-white/20 ${inputBaseStyle} bg-white/5 focus:bg-white/10`}
                        />
                        <div className="absolute bottom-3 right-3">
                             <button 
                                onClick={() => navigator.clipboard.writeText(prompt)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/30 hover:text-white transition-colors"
                             >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                             </button>
                        </div>
                    </div>
                </div>

                {/* Settings Section */}
                <div className="p-5 pt-0 space-y-5 pb-8">
                    
                    {/* Negative Prompt */}
                    <div>
                        <label className="text-[10px] font-bold text-white/30 mb-1.5 block uppercase tracking-wider">负向提示词 (Negative)</label>
                        <input 
                            type="text" 
                            value={negativePrompt}
                            onChange={(e) => setNegativePrompt(e.target.value)}
                            placeholder="低质量, 错误, 模糊..."
                            className={`w-full py-2.5 ${inputBaseStyle}`}
                        />
                    </div>

                    {/* Aspect Ratio - Single Line Minimalist */}
                    <div>
                         <div className="flex justify-between items-end mb-2">
                            <label className="text-[10px] font-bold text-white/30 uppercase tracking-wider">画面比例 (Ratio)</label>
                            <span className="text-[10px] font-mono text-indigo-300">{getDims(aspectRatio).width}x{getDims(aspectRatio).height}</span>
                         </div>
                         <div className="flex items-center gap-2">
                            {ASPECT_RATIOS.map(r => {
                                const active = aspectRatio === r;
                                return (
                                    <button
                                        key={r}
                                        onClick={() => setAspectRatio(r)}
                                        className={`flex-1 py-2 rounded-lg text-[10px] font-medium transition-all border ${
                                            active 
                                            ? 'bg-indigo-500/20 border-indigo-500/30 text-indigo-200' 
                                            : 'bg-white/5 border-transparent hover:bg-white/10 text-white/40 hover:text-white/70'
                                        }`}
                                    >
                                        {r}
                                    </button>
                                );
                            })}
                         </div>
                    </div>

                    {/* Quality & Action Row */}
                    <div className="flex gap-3 h-11">
                         {/* Quality Selector */}
                         <div className="w-1/3 relative">
                            <select 
                                value={quality}
                                onChange={(e) => setQuality(e.target.value as ImageQuality)}
                                className={`w-full h-full appearance-none cursor-pointer ${inputBaseStyle}`}
                            >
                                {MODELSCOPE_SUPPORTED_QUALITIES.map(q => <option key={q} value={q} className="bg-[#1a1a20]">{q}</option>)}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-white/30">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                         </div>

                         {/* Generate Button */}
                         <Button 
                            onClick={handleGenerate} 
                            disabled={loading || !prompt} 
                            isLoading={loading} 
                            className="flex-1 h-full text-sm font-semibold tracking-wide border-indigo-500/30 shadow-none hover:shadow-[0_0_20px_rgba(99,102,241,0.3)] bg-gradient-to-r from-indigo-600 to-indigo-700"
                         >
                            {loading ? '生成中...' : '立即生成'}
                         </Button>
                    </div>
                </div>
            </div>
        </GlassCard>
      </div>

      {/* 
        RIGHT PANEL: IMMERSIVE VIEWPORT 
        Style: Minimal, pure preview
      */}
      <div className="flex-1 h-full min-w-0">
        <GlassCard noPadding className="h-full flex flex-col relative bg-[#0a0a0c]/80 border-white/5 overflow-hidden">
            
            {/* Top Info Overlay */}
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 pointer-events-none">
                <div className="flex flex-col">
                   <span className="text-[10px] font-bold text-white/20 tracking-[0.2em] uppercase">VIEWPORT</span>
                </div>
                {error && (
                    <div className="pointer-events-auto bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-2 rounded-lg backdrop-blur-md text-xs font-medium shadow-lg animate-in fade-in slide-in-from-top-2">
                        {error}
                    </div>
                )}
            </div>

            {/* Canvas Area - Fixed sizing logic */}
            <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-10">
                {/* Grid Background */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>

                {loading && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-30">
                     <div className="w-12 h-12 border-2 border-white/10 border-t-indigo-500 rounded-full animate-spin"></div>
                   </div>
                )}

                {!currentResult ? (
                    <div className="flex flex-col items-center justify-center text-center opacity-20 select-none">
                        <div className="w-20 h-20 rounded-2xl border border-white/20 flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </div>
                        <p className="text-xs font-mono tracking-widest">READY</p>
                    </div>
                ) : (
                    <div className="relative w-full h-full flex items-center justify-center group">
                        {/* Image Frame - Ensure it fits within parent */}
                        <img 
                            src={currentResult.cloudUrl || currentResult.localUrl} 
                            alt="Result" 
                            className="max-w-full max-h-full object-contain shadow-2xl drop-shadow-2xl"
                        />
                        
                        {/* Hover Overlay Actions */}
                        <div className="absolute bottom-4 flex items-center gap-2 p-1.5 bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                            {!currentResult.cloudUrl ? (
                                <button onClick={handleUpload} disabled={uploading} className="p-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 hover:text-white transition-all" title="上传">
                                    <svg className={`w-4 h-4 ${uploading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                </button>
                            ) : (
                                <div className="p-2 text-green-400"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                            )}
                            <button onClick={handleDownload} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all" title="下载">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                            </button>
                            <a href={currentResult.cloudUrl || currentResult.localUrl} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-all">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </GlassCard>
      </div>

    </div>
  );
};