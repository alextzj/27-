
import React, { useState, useEffect, useCallback } from 'react';
import JSZip from 'jszip';
import saveAs from 'file-saver';

import { Frame, ReferenceImages, VisualAsset, ImageResolution } from './types';
import { SHOT_TYPES, SHOT_TYPE_PRESETS } from './constants';
import * as Icons from './components/Icons';
import StoryboardCard from './components/StoryboardCard';
import * as Gemini from './services/geminiService';

interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

const App: React.FC = () => {
    const [assets, setAssets] = useState<ReferenceImages>([]);
    const [projectTitle, setProjectTitle] = useState("未命名电影分镜_27Shot");
    const [sceneDesc, setSceneDesc] = useState("");
    const [productionProtocol, setProductionProtocol] = useState("");
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isExportingImages, setIsExportingImages] = useState(false);
    const [isExportingGrid, setIsExportingGrid] = useState(false);
    const [regeneratingIndices, setRegeneratingIndices] = useState<Record<number, boolean>>({});
    const [hasApiKey, setHasApiKey] = useState(true);
    
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [targetResolution, setTargetResolution] = useState<ImageResolution>('4K');

    const aistudio = (window as any).aistudio as AIStudio | undefined;

    useEffect(() => {
        const checkKey = async () => {
            if (aistudio) {
                const selected = await aistudio.hasSelectedApiKey();
                setHasApiKey(selected);
            }
        };
        checkKey();
    }, [aistudio]);

    const handleSelectKey = async () => {
        if (aistudio) {
            await aistudio.openSelectKey();
            setHasApiKey(true);
        }
    };

    const [frames, setFrames] = useState<Frame[]>(Array(27).fill(null).map(() => ({
        image: null, shotType: 'MS', action: '', dialogue: '', zoom: 180, position: 'center 20%'
    })));

    const performRegeneration = useCallback(async (index: number, currentFrames: Frame[], currentProtocol: string, res?: ImageResolution) => {
        if (!currentProtocol && assets.length === 0) return;
        setRegeneratingIndices(prev => ({ ...prev, [index]: true }));
        try {
            const frame = currentFrames[index];
            const shotInfo = SHOT_TYPES.find(s => s.value === frame.shotType);
            const shotLabel = shotInfo?.label || frame.shotType;
            const resolution = res || targetResolution;

            // Highly explicit directive construction to FORCE shot type alignment.
            const shotPrompt = `
                [MANDATORY CINEMATIC DIRECTIVE]
                SHOT_TYPE: ${shotLabel} (${frame.shotType})
                COMPOSITION: Strict ${frame.shotType} lens perspective.
                SCENE_ACTION: ${frame.action || '主体在画面中央'}
                CONTEXT: ${sceneDesc}
                TECHNICAL: High-fidelity cinematic rendering, depth of field match for ${frame.shotType}.
            `;
            
            const newImage = await Gemini.generateCinemaFrame(shotPrompt, assets, currentProtocol || "保持视觉连续性与资产特征一致。", resolution);
            setFrames(prev => {
                const updated = [...prev];
                updated[index] = { ...updated[index], image: newImage };
                return updated;
            });
        } catch (e: any) {
            console.error(`Render failed for frame ${index}:`, e);
        } finally {
            setRegeneratingIndices(prev => ({ ...prev, [index]: false }));
        }
    }, [assets, sceneDesc, targetResolution]);

    const handleFrameChange = (idx: number, field: keyof Frame, val: string | number) => {
        setFrames(prev => {
            const newFrames = [...prev];
            // @ts-ignore
            newFrames[idx][field] = val;
            if (field === 'shotType') {
                const preset = SHOT_TYPE_PRESETS[val as string];
                if (preset) {
                    newFrames[idx].zoom = preset.zoom;
                    newFrames[idx].position = preset.position;
                }
                if (productionProtocol || assets.length > 0) performRegeneration(idx, newFrames, productionProtocol);
            }
            return newFrames;
        });
    };

    const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []) as File[];
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    const newAsset: VisualAsset = {
                        id: Math.random().toString(36).substr(2, 9),
                        data: ev.target.result as string,
                        type: 'other',
                        label: file.name
                    };
                    setAssets(prev => [...prev, newAsset]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const removeAsset = (id: string) => {
        setAssets(prev => prev.filter(a => a.id !== id));
        setProductionProtocol(""); 
    };

    const runAnalysisIfNeeded = async (): Promise<string> => {
        if (productionProtocol) return productionProtocol;
        if (assets.length === 0) {
            throw new Error("请上传至少一张视觉资产作为参考。");
        }
        setIsAnalyzing(true);
        try {
            const protocol = await Gemini.analyzeProductionAssets(assets, sceneDesc);
            setProductionProtocol(protocol);
            return protocol;
        } finally {
            setIsAnalyzing(false);
        }
    };

    const generateFullStoryboard = async () => {
        if (!sceneDesc) {
            alert("请先输入剧本或故事梗概。");
            return;
        }
        setIsGenerating(true);
        try {
            const protocol = await runAnalysisIfNeeded();
            
            // Step 1: Sequence Planning
            const plan = await Gemini.planStoryboardSequence(sceneDesc);
            if (!plan || plan.length === 0) throw new Error("分镜规划失败，AI 引擎响应异常。");

            const initialFrames = frames.map((f, i) => {
                const p = plan[i] || {};
                const sType = p.shotType || 'MS';
                const preset = SHOT_TYPE_PRESETS[sType] || { zoom: 100, position: 'center center' };
                return { 
                    ...f, 
                    image: null, 
                    shotType: sType, 
                    action: p.action || '',
                    zoom: preset.zoom, 
                    position: preset.position 
                };
            });
            setFrames(initialFrames);
            setIsGenerating(false);

            // Step 2: Iterative Rendering
            for (let i = 0; i < initialFrames.length; i++) {
                await performRegeneration(i, initialFrames, protocol);
                await new Promise(r => setTimeout(r, 600)); 
            }
        } catch (e: any) {
            alert("生成失败: " + e.message);
            setIsGenerating(false);
        }
    };

    const handleRegenerateFrame = async (index: number) => {
        if (assets.length === 0) { alert("请先上传参考图以保持视觉一致性。"); return; }
        try {
            const protocol = await runAnalysisIfNeeded();
            await performRegeneration(index, frames, protocol);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleDownloadIndividual = (img: string, filename: string) => {
        saveAs(img, filename);
    };

    const exportHighResZip = async () => {
        setIsExportingImages(true);
        const zip = new JSZip();
        const folder = zip.folder(`${projectTitle}_${targetResolution}_STORYBOARD`);
        try {
            for(let i=0; i<frames.length; i++) {
                if(!frames[i].image) continue;
                const base64 = frames[i].image!.split(',')[1];
                folder?.file(`Shot_${String(i+1).padStart(2,'0')}_${frames[i].shotType}.png`, base64, {base64: true});
            }
            const blob = await zip.generateAsync({type:"blob"}); 
            saveAs(blob, `${projectTitle}_分镜序列包.zip`);
        } finally { setIsExportingImages(false); }
    };

    const export4KGrid = async () => {
        setIsExportingGrid(true);
        const canvas = document.createElement('canvas');
        canvas.width = 3840; 
        canvas.height = 6480; 
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.fillStyle = "#020202"; ctx.fillRect(0,0,3840,6480);
        
        try {
            const load = (src: string) => new Promise<HTMLImageElement>(r => { const i = new Image(); i.onload=()=>r(i); i.src=src; });
            for(let i=0; i<frames.length; i++) {
                if(!frames[i].image) continue;
                const img = await load(frames[i].image!);
                const col = i % 3; const row = Math.floor(i / 3);
                ctx.drawImage(img, col * 1280, row * 720, 1280, 720);
                
                // Add labels to the exported grid
                ctx.fillStyle = "rgba(0,0,0,0.5)";
                ctx.fillRect(col * 1280 + 20, row * 720 + 20, 120, 40);
                ctx.fillStyle = "white";
                ctx.font = "bold 20px 'JetBrains Mono'";
                ctx.fillText(`SHOT ${i+1}`, col * 1280 + 35, row * 720 + 47);
            }
            canvas.toBlob(b => { if(b) saveAs(b, `${projectTitle}_27格总览图.png`); setIsExportingGrid(false); });
        } catch { setIsExportingGrid(false); }
    };

    return (
        <div className="flex h-screen text-cinema-text bg-black font-sans selection:bg-cinema-ai">
            <aside className="w-80 flex-shrink-0 flex flex-col glass-panel z-20 border-r border-white/10 shadow-2xl">
                <div className="p-6 pb-8 border-b border-white/5 flex flex-col gap-1">
                    <div className="flex items-center justify-between text-white">
                        <div className="flex items-center gap-2">
                            <Icons.Clapperboard size={20} className="text-cinema-accent" />
                            <h1 className="font-bold text-base tracking-tight uppercase font-mono italic">CineBoard Pro</h1>
                        </div>
                    </div>
                    <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-[0.2em] pl-7">Extended Cinematic Suite v4.5</span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scroll">
                    {!hasApiKey && (
                        <div className="p-4 bg-red-950/20 border border-red-900/50 rounded-sm space-y-2 animate-pulse">
                            <p className="text-[10px] text-red-500 uppercase tracking-widest font-bold">渲染引擎未激活</p>
                            <button onClick={handleSelectKey} className="w-full py-2 bg-red-600 text-white text-[9px] font-bold uppercase tracking-widest rounded-sm">配置 API Key</button>
                        </div>
                    )}

                    <section className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono flex items-center gap-2">
                                <Icons.Settings size={12}/> 视觉资产参考 ({assets.length})
                            </label>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                            {assets.map((asset) => (
                                <div key={asset.id} className="relative group aspect-[4/3] rounded-sm overflow-hidden border border-zinc-800 bg-zinc-900 shadow-lg transition-transform hover:scale-[1.02]">
                                    <img src={asset.data} className="w-full h-full object-cover" alt="Asset" />
                                    <button 
                                        onClick={() => removeAsset(asset.id)}
                                        className="absolute top-1 right-1 p-1.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Icons.Trash size={10} />
                                    </button>
                                    <div className="absolute bottom-0 left-0 right-0 p-1 bg-black/60 text-[6px] font-mono truncate text-zinc-400">
                                        {asset.label}
                                    </div>
                                </div>
                            ))}
                            <label className="aspect-[4/3] rounded-sm border border-dashed border-zinc-800 bg-zinc-900/30 flex flex-col items-center justify-center cursor-pointer hover:border-cinema-ai/40 transition-all hover:bg-zinc-900/50">
                                <Icons.ImagePlus size={16} className="text-zinc-600 mb-1" />
                                <span className="text-[7px] font-mono text-zinc-500 uppercase">导入资产</span>
                                <input type="file" multiple onChange={handleAssetUpload} className="hidden" />
                            </label>
                        </div>
                    </section>

                    <section className="space-y-4">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">故事核心 / 剧本梗概</label>
                        <div className="bg-zinc-900/50 p-4 rounded-sm border border-white/5 focus-within:border-cinema-ai/40 transition-colors">
                            <textarea 
                                value={sceneDesc} 
                                onChange={(e) => setSceneDesc(e.target.value)} 
                                className="w-full bg-transparent text-xs text-zinc-300 placeholder-zinc-700 outline-none h-32 resize-none font-sans leading-relaxed" 
                                placeholder="输入故事或场景描述，AI 将自动规划 27 个镜头的景别演进与叙事动作..."
                            ></textarea>
                        </div>
                    </section>

                    <div className="pt-2 space-y-4">
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest font-mono">资产分辨率 (Rendering Qual.)</label>
                            <div className="grid grid-cols-3 gap-1 bg-zinc-900/80 p-1 rounded-sm border border-white/5">
                                {(['1K', '2K', '4K'] as ImageResolution[]).map(res => (
                                    <button
                                        key={res}
                                        onClick={() => setTargetResolution(res)}
                                        className={`py-1.5 text-[10px] font-mono font-bold transition-all rounded-sm ${targetResolution === res ? 'bg-cinema-ai text-white shadow-lg shadow-violet-500/20' : 'text-zinc-600 hover:text-zinc-300'}`}
                                    >
                                        {res}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button 
                            onClick={generateFullStoryboard} 
                            disabled={isGenerating || isAnalyzing || assets.length === 0} 
                            className={`w-full py-4 rounded-sm font-bold text-[10px] uppercase tracking-widest flex flex-col items-center justify-center gap-1 transition-all shadow-xl
                                ${isGenerating || isAnalyzing || assets.length === 0
                                    ? 'bg-zinc-900 text-zinc-600 cursor-not-allowed' 
                                    : 'bg-cinema-ai text-white hover:bg-violet-600 active:scale-[0.98] ring-1 ring-white/10'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                {(isGenerating || isAnalyzing) ? <Icons.Loader className="animate-spin" /> : <Icons.Wand size={14} />}
                                <span>{isAnalyzing ? "镜头语言规划中..." : isGenerating ? `全序列渲染中 (${targetResolution})` : `智能生成 27 镜分镜序列`}</span>
                            </div>
                            <span className="text-[7px] opacity-50 tracking-[0.3em] font-normal uppercase">Cinematic Logic Lock</span>
                        </button>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col bg-cinema-black overflow-hidden relative">
                <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 bg-zinc-950/60 backdrop-blur-md relative z-10">
                    <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest font-mono">Story Sequence (3x9 Grid)</span>
                        <input type="text" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} className="bg-transparent text-lg text-white font-medium focus:outline-none w-96 font-sans tracking-tight border-b border-transparent focus:border-white/10" />
                    </div>
                    <div className="flex items-center gap-8">
                        <button onClick={export4KGrid} disabled={isExportingGrid || !frames.some(f => f.image)} className="text-zinc-500 hover:text-white transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider disabled:opacity-30">
                            <Icons.Grid3x3 size={16} /> 预览表导出
                        </button>
                        <button onClick={exportHighResZip} disabled={isExportingImages || !frames.some(f => f.image)} className="text-cinema-accent hover:text-amber-400 transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider disabled:opacity-30">
                            <Icons.Images size={16} /> 高清包导出
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 custom-scroll relative z-10">
                    <div className="max-w-[1700px] mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-40">
                            {frames.map((frame, index) => (
                                <StoryboardCard 
                                    key={index} index={index} frame={frame} 
                                    onChange={handleFrameChange} 
                                    isGenerating={isGenerating} 
                                    onRegenerate={handleRegenerateFrame} 
                                    isRegenerating={!!regeneratingIndices[index]} 
                                    onPreview={setPreviewImage}
                                    onDownload={handleDownloadIndividual}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <footer className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5 bg-zinc-950/95 backdrop-blur-md z-20 flex justify-center">
                    <div className="flex items-center gap-8 text-[9px] font-mono text-zinc-500 uppercase tracking-[0.25em]">
                        <span className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${productionProtocol ? 'bg-cinema-gen animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-700'}`}></span> 
                            {productionProtocol ? '视觉 DNA 已锁定' : '等待视觉源'}
                        </span>
                        <span className="w-1 h-1 bg-zinc-800 rounded-full"></span>
                        <span className="text-zinc-400">Gemini 3 Pro + Imagen {targetResolution}</span>
                        <span className="w-1 h-1 bg-zinc-800 rounded-full"></span>
                        <span className="text-zinc-500">Professional Sequential Logic v4.5</span>
                    </div>
                </footer>
            </main>

            {previewImage && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in zoom-in duration-300">
                    <button 
                        onClick={() => setPreviewImage(null)} 
                        className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all hover:scale-110"
                    >
                        <Icons.X size={24} />
                    </button>
                    <div className="max-w-[95%] max-h-[95%] shadow-[0_0_100px_rgba(0,0,0,1)] relative group">
                        <img src={previewImage} className="w-full h-full object-contain rounded-sm" alt="Preview" />
                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                                onClick={() => handleDownloadIndividual(previewImage, `${projectTitle}_Preview.png`)}
                                className="flex items-center gap-2 px-4 py-2 bg-cinema-accent text-black font-bold text-xs uppercase tracking-widest rounded shadow-xl"
                            >
                                <Icons.Download size={16} /> 保存当前帧
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
