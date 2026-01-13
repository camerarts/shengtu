import React, { useState, useEffect } from 'react';
import { Button } from './Button';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  initialKey: string;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, initialKey }) => {
  const [key, setKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setKey(initialKey);
    }
  }, [isOpen, initialKey]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-md bg-[#1a1a20] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-blob">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            API 设置
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1 uppercase tracking-wider">
                Gemini API Key
              </label>
              <input
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 transition-all font-mono text-sm"
              />
              <p className="mt-2 text-xs text-white/40">
                Key 将仅存储在您的本地浏览器中。
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 ml-1 underline"
                >
                  获取 Key
                </a>
              </p>
            </div>
            
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={onClose} className="flex-1">
                取消
              </Button>
              <Button onClick={() => onSave(key)} className="flex-1">
                保存配置
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};