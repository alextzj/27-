
import { GoogleGenAI, Type } from "@google/genai";
import { FrameData, ReferenceImages, VisualAsset, ImageResolution } from "../types";

// Professional Cinema Models
const SEMANTIC_MODEL = "gemini-3-pro-preview"; 
const RENDER_MODEL = "gemini-3-pro-image-preview";

/**
 * Initializes a clean AI instance.
 */
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Stage 1: Analyze a dynamic gallery of assets to create a unified Visual Protocol.
 */
export const analyzeProductionAssets = async (assets: ReferenceImages, textContext: string): Promise<string> => {
    if (assets.length === 0) return "No assets provided. Proceeding with general consistency.";
    
    const ai = getAI();
    
    const prompt = `
        Role: Senior Visual Continuity Director (资深视觉连续性导演).
        Context: "${textContext}"
        
        Task: Perform a deep forensic analysis of the attached visual reference images.
        Extract and define a "VISUAL DNA PROTOCOL" that MUST be followed for every frame in this production.
        
        Structure your technical response into these keys:
        1. MASTER_PALETTE: Define specific hex-range colors, saturation levels, and tonal mapping.
        2. LIGHT_SIGNATURE: Define the light source type (e.g., Rim lighting, Rembrandt, High-key), intensity, and shadows.
        3. CHARACTER_LOCKED_FEATURES: If characters exist, list exact features (eye color, scars, cloth texture, hair flow).
        4. ENV_FIDELITY: Surface materials, atmospheric density (fog, dust), and lens style (anamorphic/spherical).
        
        OUTPUT FORMAT: Technical English descriptive protocol for an image generation engine.
    `;

    const parts: any[] = [{ text: prompt }];

    assets.forEach((asset, index) => {
        parts.push({ 
            inlineData: { 
                mimeType: "image/jpeg", 
                data: asset.data.split(',')[1] 
            } 
        });
        parts.push({ text: `REFERENCE_ASSET_${index + 1}: [Type: ${asset.type}, Label: ${asset.label}]` });
    });

    const response = await ai.models.generateContent({
        model: SEMANTIC_MODEL,
        contents: { parts }
    });

    return response.text || "Protocol synthesis failed.";
};

/**
 * Stage 2: Shot Rendering with strict Visual Protocol locking and variable resolution.
 */
export const generateCinemaFrame = async (
    shotPrompt: string, 
    assets: ReferenceImages, 
    protocol: string,
    resolution: ImageResolution = '4K'
): Promise<string> => {
    const ai = getAI();

    const systemInstruction = `
        [IDENTITY]: LEAD CINEMATOGRAPHER & RENDERING ENGINE.
        
        [MANDATORY COMPOSITION HIERARCHY]:
        1. THE REQUESTED SHOT TYPE (景别) IS ABSOLUTE. 
           - If CU: Render a tight head-shot.
           - If ELS: Render an expansive wide-shot.
           - IGNORE the camera distance/angle in reference images. Use them ONLY for character/style details.
           
        2. THE ACTION & POSITIONING: Place the characters and objects exactly as described in the "CURRENT_SHOT_DIRECTIVE".
        
        3. THE VISUAL PROTOCOL (Style/Character/Lighting):
        ${protocol}
        
        [STRICT TECHNICAL RULES]:
        - DO NOT match the composition of reference images. MATCH THE TEXT PROMPT'S SHOT TYPE.
        - Ensure cinematic focal length and depth of field consistent with the requested shot type.
    `;

    const parts: any[] = [
        { text: systemInstruction },
        { text: `CURRENT_SHOT_DIRECTIVE (MANDATORY COMPOSITION): ${shotPrompt}` }
    ];

    assets.forEach(asset => {
        parts.push({ inlineData: { mimeType: "image/jpeg", data: asset.data.split(',')[1] } });
    });

    const response = await ai.models.generateContent({
        model: RENDER_MODEL,
        contents: { parts },
        config: {
            imageConfig: {
                aspectRatio: "16:9",
                imageSize: resolution 
            }
        }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
    }
    throw new Error(`${resolution} Rendering Error: Image not returned by engine.`);
};

/**
 * Stage 3: Professional Cinematic Planning (JSON Structured).
 * Enhanced with advanced cinematic grammar and Chinese descriptive logic.
 */
export const planStoryboardSequence = async (context: string): Promise<FrameData[]> => {
    const ai = getAI();
    
    const prompt = `
        Role: 资深电影导演、动画分镜指导 (Master Cinema Director & Animation Storyboard Supervisor).
        Task: 基于提供的故事内核，规划一个逻辑严密、视听语言专业的 27 镜分镜序列： "${context}".
        
        [镜头语言核心逻辑 (Cinematic Grammar Rules)]:
        1. 景别演进 (Shot Scale Progression):
           - 严禁逻辑跳跃：不允许从 ELS (大远景) 直接跳到 ECU (大特写) 而没有中间过渡。
           - 遵循 5 镜原则：建立镜头(ELS/LS) -> 主体介绍(FS/MS) -> 动作细节(MS/CU) -> 情绪反应(CU/ECU) -> 重新建立环境(LS/MS)。
        2. 叙事节奏 (Narrative Pacing):
           - 前 9 镜 (Act 1 - Setup): 侧重于环境建立和角色定位。多用 LS, FS, MS。
           - 中 9 镜 (Act 2 - Conflict): 侧重于互动和张力。多用 OTS (过肩), POV (主观), CU (特写)。
           - 后 9 镜 (Act 3 - Resolution): 高潮动作与余韵。使用 DA (倾斜角度) 增加动感，最后以 LS/ELS 结束叙事。
        3. 画面构图 (Composition Theory):
           - 描述需包含：构图方式（如九宫格、对角线）、光效（如侧逆光、明暗对比）、以及精确的动态（如“镜头缓缓推向主体”）。
        
        [输出规范]:
        - action (中文描述): 必须使用专业电影术语，描述必须与 shotType 完美匹配。例如 CU 必须描述面部细节或局部特写，LS 必须描述角色与环境的关系。
        - shotType: 仅限 (ELS, LS, FS, MS, CU, ECU, POV, OTS, LA, HA, DA, OH, BE)。

        JSON 格式输出，数组长度必须为 27。
    `;
    
    const response = await ai.models.generateContent({
        model: SEMANTIC_MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        shotType: { 
                            type: Type.STRING,
                            description: "标准景别代码"
                        },
                        action: { 
                            type: Type.STRING,
                            description: "专业、细致的中文镜头描述，包含构图、光影及动作"
                        },
                    },
                    required: ["shotType", "action"]
                }
            }
        }
    });

    try {
        const plan = JSON.parse(response.text || "[]");
        return plan.slice(0, 27);
    } catch (e) {
        console.error("Planning Parse Error:", response.text);
        return [];
    }
};
