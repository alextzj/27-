
import React, { useRef, useState, useEffect } from 'react';
import { Frame } from '../types';
import { SHOT_TYPES } from '../constants';
import * as Icons from './Icons';

interface StoryboardCardProps {
    index: number;
    frame: Frame;
    onChange: (index: number, field: keyof Frame, val: string | number) => void;
    isGenerating: boolean;
    onRegenerate: (index: number) => void;
    isRegenerating: boolean;
    onPreview: (img: string) => void;
    onDownload: (img: string, filename: string) => void;
}

const parsePosition = (posStr: string) => {
    const map: Record<string, number> = { left: 0, center: 50, right: 100, top: 0, bottom: 100 };
    const parts = posStr.split(' ');
    let xStr = parts[0] || 'center';
    let yStr = parts[1] || 'center';
    
    const parse = (p: string) => {
        if (map[p] !== undefined) return map[p];
        if (p.endsWith('%')) return parseFloat(p);
        return 50;
    };
    
    return { x: parse(xStr), y: parse(yStr) };
};

const StoryboardCard: React.FC<StoryboardCardProps> = ({ index, frame, onChange, isGenerating, onRegenerate, isRegenerating, onPreview, onDownload }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isInteracting, setIsInteracting] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, posX: 50, posY: 50, zoom: 100 });

    const pos = parsePosition(frame.position);

    const cropWidth = 100 / (frame.zoom / 100);
    const cropHeight = 100 / (frame.zoom / 100);
    const cropLeft = pos.x * (1 - cropWidth / 100);
    const cropTop = pos.y * (1 - cropHeight / 100);

    const imageStyle: React.CSSProperties = frame.image ? {
        backgroundImage: `url(${frame.image})`,
        backgroundSize: `${frame.zoom}%`, 
        backgroundPosition: frame.position,
        backgroundRepeat: 'no-repeat',
        transition: (isDragging || isGenerating || isRegenerating) ? 'none' : 'background 0.3s cubic-bezier(0.2, 0, 0, 1)',
        cursor: frame.zoom > 100 ? (isDragging ? 'grabbing' : 'grab') : 'default'
    } : {};

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!frame.image || frame.zoom <= 100 || isGenerating || isRegenerating) return;
        if ((e.target as HTMLElement).closest('button')) return;
        
        e.preventDefault();
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y, zoom: frame.zoom };
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return;
        const { width, height } = containerRef.current.getBoundingClientRect();
        const zoomFactor = (dragStart.current.zoom / 100) - 1;
        if (zoomFactor <= 0.01) return;
        const moveX = ((e.clientX - dragStart.current.x) / width) * 100 / zoomFactor;
        const moveY = ((e.clientY - dragStart.current.y) / height) * 100 / zoomFactor;
        let newX = Math.max(0, Math.min(100, dragStart.current.posX - moveX));
        let newY = Math.max(0, Math.min(100, dragStart.current.posY - moveY));
        onChange(index, 'position', `${newX.toFixed(1)}% ${newY.toFixed(1)}%`);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    useEffect(() => { return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); }; }, []);

    return (
        <div 
            className={`group flex flex-col bg-[#0a0a0a] border transition-all duration-500 overflow-hidden ${(isGenerating || isRegenerating) ? 'border-cinema-ai/40 ring-1 ring-cinema-ai/20 shadow-[0_0_30px_rgba(139,92,246,0.15)]' : 'border-zinc-800 hover:border-zinc-600 shadow-xl'}`}
            onMouseEnter={() => setIsInteracting(true)}
            onMouseLeave={() => setIsInteracting(false)}
        >
            <div ref={containerRef} className="relative w-full aspect-video bg-black overflow-hidden border-b border-white/5" onMouseDown={handleMouseDown}>
                
                {/* Meta Labels */}
                <div className="absolute top-2 left-3 z-30 flex items-center gap-3 font-mono text-[8px] text-white/50 tracking-widest pointer-events-none select-none">
                    <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${(isGenerating || isRegenerating) ? "bg-cinema-ai animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.8)]" : "bg-red-500"}`}></span>
                        <span className={(isGenerating || isRegenerating) ? "text-cinema-ai" : "text-white"}>
                            {(isGenerating || isRegenerating) ? "RENDERING" : "CAM A"}
                        </span>
                    </div>
                    <span className="opacity-40">|</span>
                    <span>SHOT #{String(index + 1).padStart(2, '0')}</span>
                    <span className="bg-white/10 px-1 rounded text-white/80">{frame.shotType}</span>
                </div>

                {/* Action Controls */}
                <div className="absolute top-2 right-2 z-40 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onRegenerate(index); }}
                        disabled={isRegenerating || !frame.action}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-sm text-[8px] font-bold tracking-widest backdrop-blur-md border transition-all disabled:opacity-30 disabled:cursor-not-allowed
                            ${isRegenerating 
                                ? 'bg-cinema-ai/20 border-cinema-ai text-cinema-ai' 
                                : 'bg-black/60 border-white/10 text-white hover:bg-cinema-ai hover:border-cinema-ai'
                            }`}
                    >
                        <Icons.Refresh size={10} className={isRegenerating ? "animate-spin" : ""} />
                        {isRegenerating ? "扫描中..." : "渲染"}
                    </button>
                </div>

                {/* Render Logic */}
                {frame.image ? (
                    <div className="w-full h-full transform transition-transform duration-500" style={imageStyle}></div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#050505]">
                        <div className="flex gap-1 mb-2 opacity-5">
                            {[...Array(4)].map((_,i) => <div key={i} className="w-1 h-8 bg-white"></div>)}
                        </div>
                        <span className="text-[8px] font-mono text-zinc-900 tracking-[0.4em]">NO SIGNAL</span>
                    </div>
                )}

                {/* Controls Overlay */}
                {frame.image && !isGenerating && !isRegenerating && (
                    <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/95 to-transparent flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 z-30" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mr-2">
                             <button onClick={(e) => { e.stopPropagation(); onPreview(frame.image!); }} className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded transition-colors">
                                <Icons.Maximize size={12} />
                            </button>
                        </div>
                        <Icons.ZoomIn size={12} className="text-zinc-500" />
                        <input type="range" min="100" max="350" step="5" value={frame.zoom} onChange={(e) => onChange(index, 'zoom', parseFloat(e.target.value))} className="flex-1 h-0.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cinema-ai" />
                        <span className="text-[8px] font-mono text-zinc-500 w-6">{frame.zoom}%</span>
                    </div>
                )}
            </div>

            <div className="p-3 space-y-2 bg-[#0c0c0c] flex-1 flex flex-col">
                <div className="flex justify-between items-center">
                    <select 
                        value={frame.shotType}
                        onChange={(e) => onChange(index, 'shotType', e.target.value)}
                        className="bg-transparent text-cinema-accent text-[9px] font-bold font-mono uppercase tracking-[0.2em] outline-none cursor-pointer hover:text-amber-400 transition-colors"
                    >
                        {SHOT_TYPES.map(t => <option key={t.value} value={t.value} className="bg-zinc-900 text-zinc-400">{t.label}</option>)}
                    </select>
                    {frame.image && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDownload(frame.image!, `Shot_${index+1}.png`); }}
                            className="text-zinc-600 hover:text-white transition-colors"
                        >
                            <Icons.Download size={10} />
                        </button>
                    )}
                </div>
                <textarea 
                    value={frame.action}
                    onChange={(e) => onChange(index, 'action', e.target.value)}
                    placeholder="// 输入镜头描述..."
                    className="w-full flex-1 min-h-[60px] bg-transparent text-[10px] text-zinc-400 placeholder-zinc-800 resize-none border-none p-0 leading-relaxed font-sans focus:ring-0 focus:text-zinc-200 transition-colors custom-scroll"
                ></textarea>
            </div>
        </div>
    );
};

export default StoryboardCard;
