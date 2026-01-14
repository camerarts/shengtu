import React from 'react';

interface InputWithToolsProps {
  label?: string;
  value: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  multiline?: boolean;
  readOnly?: boolean;
  className?: string;
  minHeight?: string;
  fullHeight?: boolean; // New prop to force full height expansion
}

export const InputWithTools: React.FC<InputWithToolsProps> = ({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  readOnly = false,
  className = "",
  minHeight = "h-12",
  fullHeight = false
}) => {
  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handlePaste = async () => {
    if (readOnly || !onChange) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) onChange(text);
    } catch (err) {
      console.error('Failed to paste', err);
    }
  };

  return (
    <div className={`${className} ${fullHeight ? 'flex flex-col' : ''}`}>
      {label && <label className="text-xs text-white/40 mb-1.5 block ml-1">{label}</label>}
      <div className={`relative group ${fullHeight ? 'flex-1 flex flex-col' : ''}`}>
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange && onChange(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            className={`w-full bg-black/20 border border-white/10 rounded-xl p-3 pt-9 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 transition-all resize-none text-sm leading-relaxed ${fullHeight ? 'h-full flex-1' : minHeight} ${readOnly ? 'cursor-default text-white/80' : ''}`}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange && onChange(e.target.value)}
            placeholder={placeholder}
            readOnly={readOnly}
            className={`w-full bg-black/20 border border-white/10 rounded-xl p-3 pt-9 text-white placeholder-white/30 focus:outline-none focus:border-indigo-500/50 transition-all text-sm font-medium ${readOnly ? 'cursor-default text-white/80' : ''}`}
          />
        )}

        {/* Copy Button (Top Left) */}
        <div className="absolute top-2 left-2 z-10">
           <button 
             onClick={handleCopy}
             className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/20 text-white/40 hover:text-white transition-colors text-[10px] flex items-center gap-1.5 backdrop-blur-sm border border-white/5"
             title="复制内容"
           >
             <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
             <span className="font-medium">复制</span>
           </button>
        </div>

        {/* Paste Button (Top Right) - Only if editable */}
        {!readOnly && (
            <div className="absolute top-2 right-2 z-10">
            <button 
                onClick={handlePaste}
                className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/20 text-white/40 hover:text-white transition-colors text-[10px] flex items-center gap-1.5 backdrop-blur-sm border border-white/5"
                title="粘贴内容"
            >
                <span className="font-medium">粘贴</span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            </button>
            </div>
        )}
      </div>
    </div>
  );
};