import { ShotType, ShotPreset } from './types';

export const SHOT_TYPES: ShotType[] = [
    { value: 'ELS', label: 'ELS 大远景' },
    { value: 'LS', label: 'LS 远景' },
    { value: 'FS', label: 'FS 全景' },
    { value: 'MS', label: 'MS 中景' },
    { value: 'CU', label: 'CU 特写' },
    { value: 'ECU', label: 'ECU 大特写' },
    { value: 'POV', label: 'POV 主观视角' },
    { value: 'OTS', label: 'OTS 过肩镜头' },
    { value: 'LA', label: 'LA 仰视' },
    { value: 'HA', label: 'HA 俯视' },
    { value: 'DA', label: 'DA 倾斜/荷兰角' },
    { value: 'OH', label: 'OH 顶视' },
    { value: 'BE', label: 'BE 鸟瞰' },
];

export const SHOT_TYPE_PRESETS: Record<string, ShotPreset> = {
    'ELS': { zoom: 100, position: 'center center' }, 
    'LS':  { zoom: 120, position: 'center center' }, 
    'FS':  { zoom: 140, position: 'center center' }, 
    'MS':  { zoom: 180, position: 'center 20%' },    
    'CU':  { zoom: 240, position: 'center 15%' },    
    'ECU': { zoom: 350, position: 'center 30%' },    
    'POV': { zoom: 130, position: 'center center' }, 
    'OTS': { zoom: 160, position: '20% center' },    
    'LA':  { zoom: 130, position: 'center bottom' }, 
    'HA':  { zoom: 130, position: 'center top' },    
    'DA':  { zoom: 120, position: 'center center' }, 
    'OH':  { zoom: 100, position: 'center center' }, 
    'BE':  { zoom: 100, position: 'center center' }, 
};