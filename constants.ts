
import { ProjectType } from './types';

export const ART_STYLES = [
  { name: 'Default', prompt: '' },
  { name: 'Vintage Comic', prompt: 'classic 1960s comic book style, dotted halftone, bold ink lines, vibrant colors' },
  { name: 'Noir Manga', prompt: 'high contrast black and white manga style, dramatic shadows, clean line art' },
  { name: 'Water Color', prompt: 'soft watercolor illustration, painterly, ethereal, textured paper' },
  { name: 'Cyberpunk', prompt: 'futuristic neon aesthetic, high-tech, gritty urban atmosphere, glow effects' },
  { name: 'Oil Painting', prompt: 'heavy brush strokes, textured oil on canvas, classical masterpiece style' }
];

export const PROJECT_CONFIGS: Record<ProjectType, { defaultPages: number; pageRatio: string }> = {
  [ProjectType.COMIC_BOOK]: { defaultPages: 4, pageRatio: 'aspect-[3/4]' },
  [ProjectType.BOOK]: { defaultPages: 1, pageRatio: 'aspect-[2/3]' },
  [ProjectType.GREETING_CARD]: { defaultPages: 2, pageRatio: 'aspect-[5/7]' },
  [ProjectType.PLAYING_CARDS]: { defaultPages: 2, pageRatio: 'aspect-[2.5/3.5]' },
  [ProjectType.GAME_DECK]: { defaultPages: 10, pageRatio: 'aspect-[2.5/3.5]' },
  [ProjectType.BUSINESS_CARD]: { defaultPages: 2, pageRatio: 'aspect-[3.5/2]' }
};

export const PANEL_TEMPLATES: Record<ProjectType, string[]> = {
  [ProjectType.COMIC_BOOK]: ['Standard 4-Panel', 'Dynamic Action', 'Wide Single', 'Classic 6-Panel Grid'],
  [ProjectType.BOOK]: ['Front Cover', 'Back Cover', 'Full Wrap', 'Inner Sleeve'],
  [ProjectType.GREETING_CARD]: ['Vertical Fold', 'Horizontal Fold', 'Single Flat'],
  [ProjectType.PLAYING_CARDS]: ['Poker Face', 'TCG Layout', 'Minimalist'],
  [ProjectType.GAME_DECK]: ['Standard Card', 'Ability Card', 'Boss Card'],
  [ProjectType.BUSINESS_CARD]: ['Standard Horizontal', 'Vertical Pro', 'Modern Slim']
};
