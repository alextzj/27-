
export type ImageResolution = '1K' | '2K' | '4K';

export interface Frame {
  image: string | null;
  shotType: string;
  action: string;
  dialogue: string;
  zoom: number;
  position: string;
}

export interface ShotType {
  value: string;
  label: string;
}

export interface ShotPreset {
  zoom: number;
  position: string;
}

export interface FrameData {
    shotType?: string;
    action?: string;
    dialogue?: string;
    zoom?: number;
    position?: string;
}

export interface VisualAsset {
  id: string;
  data: string; // base64
  type: 'environment' | 'character' | 'prop' | 'style' | 'other';
  label: string;
}

export type ReferenceImages = VisualAsset[];
