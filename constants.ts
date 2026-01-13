import { AspectRatio, ImageQuality } from './types';

export const ASPECT_RATIOS: AspectRatio[] = [
  AspectRatio.SQUARE,
  AspectRatio.PORTRAIT_3_4,
  AspectRatio.LANDSCAPE_4_3,
  AspectRatio.PORTRAIT_9_16,
  AspectRatio.LANDSCAPE_16_9,
];

export const QUALITIES: ImageQuality[] = [
  ImageQuality.Q_1K,
  ImageQuality.Q_2K,
  ImageQuality.Q_4K,
];

export const SYNTH_ID_NOTICE = "Gemini 3 Pro 生成的图像带有 SynthID™ 隐形水印以验证真实性。";

// Used for history display formatting
export const RATIO_LABELS: Record<string, string> = {
  [AspectRatio.SQUARE]: "1:1 方形",
  [AspectRatio.PORTRAIT_3_4]: "3:4 纵向",
  [AspectRatio.LANDSCAPE_4_3]: "4:3 横向",
  [AspectRatio.PORTRAIT_9_16]: "9:16 手机",
  [AspectRatio.LANDSCAPE_16_9]: "16:9 桌面",
  // Legacy support for history items created before update
  "2:3": "2:3 (旧版)",
  "3:2": "3:2 (旧版)",
  "4:5": "4:5 (旧版)",
  "5:4": "5:4 (旧版)",
  "21:9": "21:9 (旧版)"
};