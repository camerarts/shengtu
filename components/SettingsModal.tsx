import React, { useState, useEffect } from 'react';
import { Button } from './Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (keys: { gemini: string; modelscope: string }) => void;
  initialKeys: { gemini: string; modelscope: string };
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, initialKeys }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [modelscopeKey, setModelscopeKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setGeminiKey(initialKeys.gemini || '');
      setModelscopeKey(initialKeys.modelscope || '');
    }
  }, [isOpen, initialKeys]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-[#1a1a20] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            API 配置
          </h2>
          
          <div className="space-y-5">
            {/* Gemini Key */}
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5 uppercase tracking-wider">
                Gemini API Key (Google)
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 transition-all font-mono text-sm"
              />
              <p className="mt-1.5 text-[10px] text-white/40">
                用于 Gemini 3 Pro 模型。
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 ml-1 underline">获取 Key</a>
              </p>
            </div>

            {/* ModelScope Key */}
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5 uppercase tracking-wider">
                ModelScope Token (阿里魔搭)
              </label>
              <input
                type="password"
                value={modelscopeKey}
                onChange={(e) => setModelscopeKey(e.target.value)}
                placeholder="ms-..."
                className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 transition-all font-mono text-sm"
              />
              <p className="mt-1.5 text-[10px] text-white/40">
                用于 Z-Image-Turbo 模型。
                <a href="https://modelscope.cn/my/myaccesstoken" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 ml-1 underline">获取 Token</a>
              </p>
            </div>
            
            <div className="flex gap-3 pt-4">
              <Button variant="ghost" onClick={onClose} className="flex-1">
                取消
              </Button>
              <Button onClick={() => onSave({ gemini: geminiKey, modelscope: modelscopeKey })} className="flex-1">
                保存所有配置
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};