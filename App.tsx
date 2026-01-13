import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GlassCard } from './components/GlassCard';
import { Button } from './components/Button';
import { HistoryItemCard } from './components/HistoryItem';
import { SettingsModal } from './components/SettingsModal';
import { 
  AspectRatio, 
  ImageQuality, 
  GenerateImageResponse, 
  HistoryItem 
} from './types';
import { ASPECT_RATIOS, QUALITIES, SYNTH_ID_NOTICE, RATIO_LABELS } from './constants';
import { generateImageDirectly } from './utils';

const MAX_HISTORY = 20;

function App() {
  // --- State ---
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [quality, setQuality] = useState<ImageQuality>(ImageQuality.Q_1K);
  
  // New State for Reference Image
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateImageResponse | null>(null);
  const [generationTime, setGenerationTime] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // --- Effects ---
  useEffect(() => {
    // Load History
    const savedHistory = localStorage.getItem('gemini_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history");
      }
    }
    
    // Load API Key
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const saveToHistory = useCallback((newItem: HistoryItem) => {
    setHistory(prev => {
      const updated = [newItem, ...prev].slice(0, MAX_HISTORY);
      localStorage.setItem('gemini_history', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleSaveSettings = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini_api_key', key);
    setShowSettings(false);
    setError(null);
  };

  // --- Image Upload Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("参考图片不能超过 5MB");
        return;
      }
      
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

  const removeReferenceImage = () => {
    setReferenceImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // --- Actions ---
  const handleGenerate = async () => {
    if (!apiKey) {
      setError("请先点击右上角设置图标配置 Gemini API Key。");
      setShowSettings(true);
      return;
    }

    if (!prompt.trim()) {
      setError("请输入提示词。");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    const startTime = Date.now();

    try {
      // Direct client-side call
      const successData = await generateImageDirectly(
        apiKey,
        prompt.trim(),
        negativePrompt.trim() || undefined,
        aspectRatio,
        quality,
        referenceImage // Pass the reference image
      );

      const duration = (Date.now() - startTime) / 1000;
      
      setGenerationTime(duration);
      setResult(successData);

      // Save to history
      saveToHistory({
        id: Date.now().toString(),
        timestamp: Date.now(),
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        aspectRatio,
        quality,
        thumbnailBase64: successData.base64,
        referenceImageBase64: referenceImage || undefined, // Save ref image
        width: successData.width,
        height: successData.height
      });

    } catch (err: any) {
      setError(err.message || "发生了意外的错误。");
      // Don't auto-show settings modal, just show the error message.
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const link = document.createElement('a');
    link.href = `data:${result.contentType};base64,${result.base64}`;
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
    setReferenceImage(item.referenceImageBase64 || null); // Restore ref image
    setResult({
      contentType: 'image/png',
      base64: item.thumbnailBase64,
      width: item.width,
      height: item.height
    });
    setGenerationTime(0);
    setError(null);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl relative z-10">
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveSettings}
        initialKey={apiKey}
      />

      {/* A) Top Navigation */}
      <nav className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg shadow-indigo-500/20"></div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70 tracking-tight">
            Gemini 3 灵感绘图
          </h1>
        </div>
        <div className="flex items-center gap-3">
           <div className="hidden sm:block px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-white/50">
             v3.0-preview
           </div>
           <button
             onClick={() => setShowSettings(true)}
             className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
             title="设置 API Key"
           >
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
             </svg>
           </button>
        </div>
      </nav>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Input & Controls */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* B) Input Area */}
          <GlassCard title="创意提示词 (Prompt)">
            <div className="space-y-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述你的想象... (例如：一座由透明水晶构成的未来城市，日落光照，8k渲染，赛博朋克风格)"
                className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all resize-none h-32 text-sm leading-relaxed"
              />
              <input
                type="text"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="反向提示词 (可选，例如：丑陋，模糊，低质量，变形)"
                className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm"
              />

              {/* Reference Image Uploader */}
              <div className="relative">
                {!referenceImage ? (
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-16 border border-dashed border-white/20 rounded-xl bg-white/5 hover:bg-white/10 hover:border-indigo-500/50 transition-all flex items-center justify-center gap-2 cursor-pointer group"
                  >
                    <svg className="w-5 h-5 text-white/40 group-hover:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm text-white/40 group-hover:text-white/70 transition-colors">上传参考图 (可选)</span>
                  </div>
                ) : (
                  <div className="w-full h-16 border border-white/10 rounded-xl bg-black/30 flex items-center justify-between p-2 pl-3 group">
                    <div className="flex items-center gap-3">
                       <div className="h-12 w-12 rounded-lg overflow-hidden border border-white/20">
                         <img src={referenceImage} alt="Ref" className="w-full h-full object-cover" />
                       </div>
                       <span className="text-sm text-white/80">已使用参考图</span>
                    </div>
                    <button 
                      onClick={removeReferenceImage}
                      className="p-2 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-400 transition-colors"
                      title="删除参考图"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileChange} 
                  accept="image/png, image/jpeg, image/webp" 
                  className="hidden" 
                />
              </div>

              <Button 
                onClick={handleGenerate} 
                disabled={loading || !prompt} 
                isLoading={loading}
                className="w-full py-3 text-lg"
              >
                {loading ? '生成中...' : '开始生成'}
              </Button>
            </div>
          </GlassCard>

          {/* C) Parameters Area */}
          <GlassCard title="参数配置">
             <div className="space-y-6">
               <div>
                 <label className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3 block">图片比例</label>
                 <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                   {ASPECT_RATIOS.map((ratio) => {
                     const [w, h] = ratio.split(':').map(Number);
                     const isLandscape = w >= h;
                     return (
                       <button
                         key={ratio}
                         onClick={() => setAspectRatio(ratio)}
                         className={`flex flex-col items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all duration-200 border ${
                           aspectRatio === ratio
                             ? 'bg-indigo-600 border-indigo-400 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] scale-105 z-10'
                             : 'bg-white/5 border-transparent text-white/50 hover:bg-white/10 hover:text-white hover:border-white/10'
                         }`}
                       >
                         {/* Schematic Thumbnail */}
                         <div className="w-6 h-6 flex items-center justify-center">
                           <div 
                             className={`border-[1.5px] rounded-[2px] transition-all ${
                               aspectRatio === ratio 
                                 ? 'border-white bg-white/30' 
                                 : 'border-white/30 bg-white/5 group-hover:border-white/60'
                             }`}
                             style={{
                               aspectRatio: `${w}/${h}`,
                               width: isLandscape ? '100%' : 'auto',
                               height: !isLandscape ? '100%' : 'auto'
                             }}
                           />
                         </div>
                         <span>{ratio}</span>
                       </button>
                     );
                   })}
                 </div>
                 <div className="text-right mt-1 text-xs text-white/40 font-mono">
                   {RATIO_LABELS[aspectRatio]}
                 </div>
               </div>

               <div>
                 <label className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-3 block">清晰度 & 细节</label>
                 <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
                   {QUALITIES.map((q) => (
                     <button
                       key={q}
                       onClick={() => setQuality(q)}
                       className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                         quality === q
                           ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] ring-1 ring-indigo-400'
                           : 'text-white/50 hover:text-white hover:bg-white/5'
                       }`}
                     >
                       {q}
                     </button>
                   ))}
                 </div>
               </div>
             </div>
          </GlassCard>
        </div>

        {/* Right Column: Result & History */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* D) Result Area */}
          <GlassCard className="min-h-[500px] flex flex-col justify-center relative overflow-hidden group">
            {error && (
               <div className="absolute top-6 left-6 right-6 z-20 bg-red-500/10 border border-red-500/20 text-red-200 px-4 py-3 rounded-xl backdrop-blur-md flex items-center gap-3">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                   <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                 </svg>
                 <span className="text-sm font-medium">{error}</span>
               </div>
            )}

            {!result && !loading && !error && (
              <div className="text-center space-y-4 opacity-50">
                <div className="w-20 h-20 border-2 border-dashed border-white/20 rounded-2xl mx-auto flex items-center justify-center">
                  <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-white/40 text-sm">输入提示词，开始绘制你的梦境</p>
              </div>
            )}

            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 backdrop-blur-sm z-10">
                <div className="w-16 h-16 relative">
                  <div className="absolute inset-0 rounded-full border-t-2 border-r-2 border-indigo-500 animate-spin"></div>
                  <div className="absolute inset-2 rounded-full border-b-2 border-l-2 border-purple-500 animate-spin reverse"></div>
                </div>
                <p className="mt-4 text-indigo-300 font-medium animate-pulse">
                   {referenceImage ? '正在分析参考图并绘制...' : '正在绘制像素...'}
                </p>
              </div>
            )}

            {result && (
              <div className="relative w-full h-full flex flex-col">
                <div className="flex-grow flex items-center justify-center bg-black/40 rounded-xl overflow-hidden mb-4 border border-white/5 relative">
                  <img 
                    src={`data:${result.contentType};base64,${result.base64}`} 
                    alt="Generated Result" 
                    className="max-h-[600px] w-auto max-w-full object-contain shadow-2xl"
                  />
                  <a 
                    href={`data:${result.contentType};base64,${result.base64}`} 
                    target="_blank"
                    rel="noreferrer"
                    className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white/70 hover:text-white backdrop-blur-md transition-colors"
                    title="查看大图"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
                
                <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-white/50">
                       <span className="w-2 h-2 rounded-full bg-green-500"></span>
                       <span>耗时: {generationTime.toFixed(2)}秒</span>
                       <span className="text-white/20">|</span>
                       <span>{result.width}x{result.height}px</span>
                    </div>
                    <p className="text-[10px] text-indigo-300/80 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                      {SYNTH_ID_NOTICE}
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                     <Button variant="secondary" onClick={() => setResult(null)}>关闭</Button>
                     <Button variant="primary" onClick={handleDownload}>
                       下载 PNG
                       <svg className="ml-2 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                       </svg>
                     </Button>
                  </div>
                </div>
              </div>
            )}
          </GlassCard>

          {/* E) History Area */}
          <GlassCard title="最近创作">
             {history.length === 0 ? (
               <div className="text-white/30 text-sm py-4">暂无历史记录。开始创作吧！</div>
             ) : (
               <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                 {history.map(item => (
                   <HistoryItemCard key={item.id} item={item} onClick={restoreHistoryItem} />
                 ))}
               </div>
             )}
          </GlassCard>

        </div>
      </div>
    </div>
  );
}

export default App;