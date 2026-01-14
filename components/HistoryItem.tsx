import React from 'react';
import { HistoryItem as HistoryItemType } from '../types';
import { RATIO_LABELS } from '../constants';

interface HistoryItemProps {
  item: HistoryItemType;
  onClick: (item: HistoryItemType) => void;
  onDelete: (id: string) => void;
}

export const HistoryItemCard: React.FC<HistoryItemProps> = ({ item, onClick, onDelete }) => {
  // Prefer the R2 URL if available, otherwise fallback to thumbnail/base64
  const src = item.imageUrl || `data:image/png;base64,${item.thumbnailBase64}`;

  return (
    <div 
      onClick={() => onClick(item)}
      className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer border border-white/5 hover:border-indigo-500/50 transition-all duration-300"
    >
      <img 
        src={src} 
        alt={item.prompt} 
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        loading="lazy"
      />
      
      {/* Overlay Content */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
        
        {/* Delete Button (Top Right) */}
        <div className="absolute top-2 right-2">
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete(item.id);
                }}
                className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/80 text-red-200 hover:text-white backdrop-blur-md transition-all border border-red-500/30"
                title="删除记录"
            >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </button>
        </div>

        <p className="text-white text-xs font-medium line-clamp-1 mb-1">{item.prompt}</p>
        <div className="flex gap-2">
          <span className="text-[10px] text-white/70 bg-white/10 px-1.5 py-0.5 rounded backdrop-blur-md">
            {RATIO_LABELS[item.aspectRatio] || item.aspectRatio}
          </span>
          {item.imageUrl && (
             <span className="text-[10px] text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded backdrop-blur-md border border-indigo-500/30">
               CLOUD
             </span>
          )}
        </div>
      </div>
    </div>
  );
};