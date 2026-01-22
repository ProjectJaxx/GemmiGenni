
export enum ProjectType {
  COMIC_BOOK = 'Comic Book',
  BOOK = 'Book',
  GREETING_CARD = 'Greeting Card',
  PLAYING_CARDS = 'Playing Cards',
  GAME_DECK = 'Game Deck',
  BUSINESS_CARD = 'Business Card'
}

export enum ObjectType {
  IMAGE = 'image',
  TEXT = 'text',
  SPEECH_BUBBLE = 'speech_bubble',
  NARRATION = 'narration'
}

export interface CanvasObject {
  id: string;
  type: ObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  // Specific properties
  content?: string; // For text/speech
  imageUrl?: string; // For images
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  flippedH?: boolean;
  flippedV?: boolean;
  locked?: boolean;
  tailX?: number; // For speech bubbles
  tailY?: number;
}

export interface Panel {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  backgroundColor: string;
  backgroundImage?: string;
  borderColor: string;
  borderWidth: number;
  opacity: number;
  objects: CanvasObject[];
  collapsed?: boolean;
}

export interface PageGradient {
  type: 'none' | 'linear' | 'radial';
  color1: string;
  color2: string;
  angle: number;
}

export interface Page {
  id: string;
  name: string;
  panels: Panel[];
  backgroundColor: string;
  backgroundImage?: string;
  gradient?: PageGradient;
}

export interface Project {
  id: string;
  name: string;
  type: ProjectType;
  pages: Page[];
  currentPageIndex: number;
  prompts: { prompt: string; negative: string; style: string }[];
}

export type SidebarTab = 'page-setup' | 'panel-setup' | 'text' | 'genni' | 'none';
