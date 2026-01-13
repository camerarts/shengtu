import { AspectRatio, ImageQuality } from './types';

export const ASPECT_RATIOS: AspectRatio[] = [
  AspectRatio.SQUARE,
  AspectRatio.PORTRAIT_2_3,
  AspectRatio.LANDSCAPE_3_2,
  AspectRatio.PORTRAIT_3_4,
  AspectRatio.LANDSCAPE_4_3,
  AspectRatio.PORTRAIT_4_5,
  AspectRatio.LANDSCAPE_5_4,
  AspectRatio.PORTRAIT_9_16,
  AspectRatio.LANDSCAPE_16_9,
  AspectRatio.CINEMATIC_21_9,
];

export const QUALITIES: ImageQuality[] = [
  ImageQuality.Q_1K,
  ImageQuality.Q_2K,
  ImageQuality.Q_4K,
];

export const SYNTH_ID_NOTICE = "Gemini 3 Pro 生成的图像带有 SynthID™ 隐形水印以验证真实性。";

// Used for history display formatting
export const RATIO_LABELS: Record<AspectRatio, string> = {
  [AspectRatio.SQUARE]: "1:1 方形",
  [AspectRatio.PORTRAIT_2_3]: "2:3 纵向",
  [AspectRatio.LANDSCAPE_3_2]: "3:2 横向",
  [AspectRatio.PORTRAIT_3_4]: "3:4 纵向",
  [AspectRatio.LANDSCAPE_4_3]: "4:3 横向",
  [AspectRatio.PORTRAIT_4_5]: "4:5 纵向",
  [AspectRatio.LANDSCAPE_5_4]: "5:4 横向",
  [AspectRatio.PORTRAIT_9_16]: "9:16 手机",
  [AspectRatio.LANDSCAPE_16_9]: "16:9 桌面",
  [AspectRatio.CINEMATIC_21_9]: "21:9 电影",
};