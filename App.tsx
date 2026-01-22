import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { 
  FilePlus, Save, Download, Settings, LogOut, Layout, Columns, Type, Sparkles, 
  ChevronRight, ChevronDown, Trash2, Copy, Image as ImageIcon, MessageSquare, 
  RotateCcw, FlipHorizontal, FlipVertical, Plus, Minus, Move, Layers, Search, Monitor, Box, FolderOpen, Menu, X, Palette,
  ChevronUp, ArrowUpToLine, ArrowDownToLine, ChevronDown as ChevronDownIcon,
  Maximize, Scissors, Lock, Unlock, MousePointer2, FileImage, FileCode
} from 'lucide-react';
import { 
  ProjectType, ObjectType, Project, SidebarTab, CanvasObject, Panel, Page, PageGradient 
} from './types';
import { ART_STYLES, PROJECT_CONFIGS, PANEL_TEMPLATES } from './constants';
import { gemini } from './services/geminiService';
import { RotationKnob, PropertyGroup } from './components/UIComponents';

type GenniDestination = 'new-object' | 'panel-bg' | 'page-bg';

interface DragState {
  type: 'panel' | 'object';
  id: string;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  containerWidth: number;
  containerHeight: number;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'page' | 'panel' | 'object';
  targetId?: string;
}

const App: React.FC = () => {
  // State
  const [project, setProject] = useState<Project>({
    id: '1',
    name: 'Untitled Comic',
    type: ProjectType.COMIC_BOOK,
    pages: [{
      id: 'p1',
      name: 'Page 1',
      backgroundColor: '#ffffff',
      panels: [
        {
          id: 'pan1',
          name: 'Main Panel',
          x: 5, y: 5, width: 90, height: 45,
          rotation: 0, backgroundColor: '#ffffff', borderColor: '#000000', borderWidth: 2, opacity: 1,
          objects: []
        },
        {
          id: 'pan2',
          name: 'Bottom Panel',
          x: 5, y: 52, width: 90, height: 43,
          rotation: 0, backgroundColor: '#ffffff', borderColor: '#000000', borderWidth: 2, opacity: 1,
          objects: []
        }
      ],
      gradient: { type: 'none', color1: '#ffffff', color2: '#e2e8f0', angle: 0 }
    }],
    currentPageIndex: 0,
    prompts: []
  });

  const [activeTab, setActiveTab] = useState<SidebarTab>('page-setup');
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [zoom, setZoom] = useState(0.8);
  const [status, setStatus] = useState('Ready');
  const [aiStatus, setAiStatus] = useState<'Online' | 'Offline'>('Online');
  const [isGenerating, setIsGenerating] = useState(false);

  // Dragging & Menu State
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, type: 'page' });

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Genni State
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(ART_STYLES[0].name);
  const [genniDestination, setGenniDestination] = useState<GenniDestination>('new-object');

  // Side effects
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (contextMenu.visible) {
        setContextMenu(prev => ({ ...prev, visible: false }));
      }
    };
    if (isMenuOpen || contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen, contextMenu.visible]);

  // Derived state
  const currentPage = project.pages[project.currentPageIndex] || project.pages[0];
  const selectedPanel = useMemo(() => 
    currentPage.panels.find(p => p.id === selectedPanelId), 
    [currentPage, selectedPanelId]
  );
  const selectedObject = useMemo(() => {
    if (!selectedPanel) return null;
    return selectedPanel.objects.find(o => o.id === selectedObjectId);
  }, [selectedPanel, selectedObjectId]);

  const getPageBackgroundStyle = (page: Page) => {
    const styles: React.CSSProperties = {
      backgroundColor: page.backgroundColor,
      backgroundImage: page.backgroundImage ? `url(${page.backgroundImage})` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
    if (page.gradient && page.gradient.type !== 'none') {
      const { type, color1, color2, angle } = page.gradient;
      if (type === 'linear') styles.backgroundImage = `linear-gradient(${angle}deg, ${color1}, ${color2})`;
      else if (type === 'radial') styles.backgroundImage = `radial-gradient(circle, ${color1}, ${color2})`;
    }
    return styles;
  };

  // Drag logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;
      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;
      const pctDeltaX = (deltaX / (dragState.containerWidth * zoom)) * 100;
      const pctDeltaY = (deltaY / (dragState.containerHeight * zoom)) * 100;
      const newX = Math.round((dragState.initialX + pctDeltaX) * 10) / 10;
      const newY = Math.round((dragState.initialY + pctDeltaY) * 10) / 10;
      if (dragState.type === 'panel') updatePanel({ x: newX, y: newY }, dragState.id);
      else updateObject({ x: newX, y: newY }, dragState.id);
    };
    const handleMouseUp = () => {
      if (dragState) { setDragState(null); setStatus('Ready'); }
    };
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, zoom]);

  const startDrag = (e: React.MouseEvent, type: 'panel' | 'object', id: string, initialX: number, initialY: number, container: HTMLElement | null) => {
    e.stopPropagation();
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setDragState({
      type,
      id,
      startX: e.clientX,
      startY: e.clientY,
      initialX,
      initialY,
      containerWidth: rect.width / zoom,
      containerHeight: rect.height / zoom,
    });
    if (type === 'panel') {
      setSelectedPanelId(id);
      setSelectedObjectId(null);
    } else {
      setSelectedObjectId(id);
    }
    setStatus(`Dragging ${type}`);
  };

  const exportPDF = () => {
    setIsMenuOpen(false);
    setStatus('Preparing PDF...');
    document.body.classList.add('is-printing');
    
    setTimeout(() => {
      window.print();
      document.body.classList.remove('is-printing');
      setStatus('Ready');
    }, 500);
  };

  const exportImage = async (format: 'png' | 'webp') => {
    const canvasEl = document.getElementById('page-canvas');
    if (!canvasEl) return;

    setIsMenuOpen(false);
    setStatus(`Exporting as ${format.toUpperCase()}...`);
    
    try {
      // Create high-res capture
      const canvas = await html2canvas(canvasEl, {
        scale: 2, // Double resolution for print quality
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });

      const dataUrl = canvas.toDataURL(`image/${format}`, 1.0);
      const link = document.createElement('a');
      link.download = `${project.name.replace(/\s+/g, '_')}_page_${project.currentPageIndex + 1}.${format}`;
      link.href = dataUrl;
      link.click();
      setStatus('Export successful');
    } catch (err) {
      console.error("Export Error:", err);
      setStatus('Export failed');
    }
  };

  const updateObject = (updates: Partial<CanvasObject>, objId?: string) => {
    const targetObjId = objId || selectedObjectId;
    if (!selectedPanelId || !targetObjId) return;
    const updatedPages = [...project.pages];
    const panel = updatedPages[project.currentPageIndex].panels.find(p => p.id === selectedPanelId);
    if (panel) {
      const objIndex = panel.objects.findIndex(o => o.id === targetObjId);
      if (objIndex !== -1) {
        panel.objects[objIndex] = { ...panel.objects[objIndex], ...updates };
        setProject(prev => ({ ...prev, pages: updatedPages }));
      }
    }
  };

  const updatePanel = (updates: Partial<Panel>, panelId?: string) => {
    const targetPanelId = panelId || selectedPanelId;
    if (!targetPanelId) return;
    const updatedPages = [...project.pages];
    const panelIndex = updatedPages[project.currentPageIndex].panels.findIndex(p => p.id === targetPanelId);
    if (panelIndex !== -1) {
      updatedPages[project.currentPageIndex].panels[panelIndex] = { 
        ...updatedPages[project.currentPageIndex].panels[panelIndex], 
        ...updates 
      };
      setProject(prev => ({ ...prev, pages: updatedPages }));
    }
  };

  const deletePanel = (panelId: string) => {
    const updatedPages = [...project.pages];
    updatedPages[project.currentPageIndex].panels = updatedPages[project.currentPageIndex].panels.filter(p => p.id !== panelId);
    setProject(p => ({ ...p, pages: updatedPages }));
    if (selectedPanelId === panelId) setSelectedPanelId(null);
    setStatus('Panel deleted');
  };

  const deleteObject = (objId: string) => {
    if (!selectedPanelId) return;
    const updatedPages = [...project.pages];
    const panel = updatedPages[project.currentPageIndex].panels.find(p => p.id === selectedPanelId);
    if (panel) {
      panel.objects = panel.objects.filter(o => o.id !== objId);
      setProject(p => ({ ...p, pages: updatedPages }));
      if (selectedObjectId === objId) setSelectedObjectId(null);
      setStatus('Object deleted');
    }
  };

  const duplicateObject = (objId: string) => {
    const panel = currentPage.panels.find(p => p.id === selectedPanelId);
    const obj = panel?.objects.find(o => o.id === objId);
    if (obj) {
      const newId = `obj_${Date.now()}`;
      updatePanel({ objects: [...panel!.objects, { ...obj, id: newId, x: obj.x + 5, y: obj.y + 5 }] });
      setSelectedObjectId(newId);
      setStatus('Object duplicated');
    }
  };

  const removeBg = async (objId?: string) => {
    const targetId = objId || selectedObjectId;
    const panel = currentPage.panels.find(p => p.id === selectedPanelId);
    const obj = panel?.objects.find(o => o.id === targetId);
    if (obj?.type === ObjectType.IMAGE && obj.imageUrl) {
      setStatus('Removing background...');
      const result = await gemini.removeBackground(obj.imageUrl);
      if (result) {
        updateObject({ imageUrl: result }, targetId);
        setStatus('Background removed');
      } else {
        setStatus('Background removal failed');
      }
    }
  };

  const updatePage = (updates: Partial<Page>) => {
    const updatedPages = [...project.pages];
    updatedPages[project.currentPageIndex] = { ...updatedPages[project.currentPageIndex], ...updates };
    setProject(prev => ({ ...prev, pages: updatedPages }));
  };

  const handleContextMenu = (e: React.MouseEvent, type: 'page' | 'panel' | 'object', id?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      targetId: id
    });
    
    if (type === 'panel' && id) {
      setSelectedPanelId(id);
      setSelectedObjectId(null);
    } else if (type === 'object' && id) {
      setSelectedObjectId(id);
    }
  };

  const addPanel = (templateName?: string) => {
    const newPanel: Panel = {
      id: `pan_${Date.now()}`,
      name: `Panel ${currentPage.panels.length + 1}`,
      x: 10, y: 10, width: 30, height: 30,
      rotation: 0, backgroundColor: '#ffffff', borderColor: '#000000', borderWidth: 2, opacity: 1,
      objects: []
    };
    const updatedPages = [...project.pages];
    updatedPages[project.currentPageIndex].panels.push(newPanel);
    setProject(prev => ({ ...prev, pages: updatedPages }));
    setSelectedPanelId(newPanel.id);
    setStatus('Panel added');
  };

  const addObject = (type: ObjectType, customProps?: Partial<CanvasObject>) => {
    if (!selectedPanelId) {
      alert("Select a panel first!");
      return null;
    }
    const newObj: CanvasObject = {
      id: `obj_${Date.now()}`,
      type,
      x: 20, y: 20, width: 50, height: 50,
      rotation: 0, opacity: 1, zIndex: 10,
      content: type === ObjectType.IMAGE ? '' : 'New Text',
      imageUrl: type === ObjectType.IMAGE ? '' : undefined,
      backgroundColor: type === ObjectType.SPEECH_BUBBLE ? '#ffffff' : 'transparent',
      borderColor: '#000000',
      borderWidth: 1,
      fontSize: 16,
      color: '#000000',
      ...customProps
    };
    const updatedPages = [...project.pages];
    const panel = updatedPages[project.currentPageIndex].panels.find(p => p.id === selectedPanelId);
    if (panel) {
      panel.objects.push(newObj);
      setProject(prev => ({ ...prev, pages: updatedPages }));
      setSelectedObjectId(newObj.id);
      setStatus(`${type} added`);
      return newObj.id;
    }
    return null;
  };

  const generateAIImage = async (target: GenniDestination) => {
    if (target !== 'page-bg' && !selectedPanelId) {
      setStatus('Select a panel first');
      return;
    }
    setIsGenerating(true);
    setStatus('Generating image...');
    const stylePrompt = ART_STYLES.find(s => s.name === selectedStyle)?.prompt || '';
    const result = await gemini.generateImage(currentPrompt, stylePrompt);
    if (result) {
      if (target === 'new-object') addObject(ObjectType.IMAGE, { imageUrl: result });
      else if (target === 'panel-bg') updatePanel({ backgroundImage: result });
      else if (target === 'page-bg') updatePage({ backgroundImage: result });
      setStatus('Image generated!');
    } else {
      setStatus('Generation failed');
    }
    setIsGenerating(false);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#121212] select-none text-gray-200 overflow-hidden relative">
      <input type="file" ref={fileInputRef} onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => setProject(JSON.parse(event.target?.result as string));
          reader.readAsText(file);
        }
      }} accept=".json" className="hidden" />

      {/* Top Bar */}
      <div className="flex items-center bg-[#1e1e1e] border-b border-gray-800 h-10 px-2 overflow-x-auto no-scrollbar shrink-0">
        {project.pages.map((p, idx) => (
          <button 
            key={p.id}
            onClick={() => { setProject(prev => ({ ...prev, currentPageIndex: idx })); setSelectedPanelId(null); setSelectedObjectId(null); }}
            className={`px-4 py-1 h-full text-xs border-r border-gray-800 transition-colors shrink-0 ${
              project.currentPageIndex === idx ? 'bg-[#2d2d2d] text-blue-400 font-bold shadow-[inset_0_-2px_0_#3b82f6]' : 'hover:bg-[#252525]'
            }`}
          >
            {p.name}
          </button>
        ))}
        <button onClick={() => setProject(prev => ({ ...prev, pages: [...prev.pages, {
          id: `p${prev.pages.length + 1}`,
          name: `Page ${prev.pages.length + 1}`,
          backgroundColor: '#ffffff',
          panels: [],
          gradient: { type: 'none', color1: '#ffffff', color2: '#e2e8f0', angle: 0 }
        }]}))} className="p-2 hover:bg-[#252525] text-gray-500 shrink-0"><Plus size={14}/></button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <div className="w-16 bg-[#1e1e1e] border-r border-gray-800 flex flex-col items-center py-4 gap-6 z-40 relative">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`p-3 rounded-lg transition-all ${isMenuOpen ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-[#2d2d2d] text-blue-500'}`}>
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          {isMenuOpen && (
            <div ref={menuRef} className="absolute left-14 top-4 w-56 bg-[#1e1e1e] border border-gray-800 rounded-xl shadow-2xl py-3 flex flex-col z-[100] animate-in slide-in-from-left-2 duration-200">
              <div className="px-4 pb-1 text-[9px] uppercase font-bold text-gray-500 tracking-wider">Project</div>
              <button onClick={() => window.location.reload()} className="flex items-center gap-3 px-4 py-2 hover:bg-[#2d2d2d] text-sm text-left transition-colors"><FilePlus size={16} className="text-blue-400"/> New project</button>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 px-4 py-2 hover:bg-[#2d2d2d] text-sm text-left transition-colors"><FolderOpen size={16} className="text-yellow-400"/> Load project</button>
              <button onClick={() => {
                const dataStr = JSON.stringify(project, null, 2);
                const url = URL.createObjectURL(new Blob([dataStr], { type: 'application/json' }));
                const link = document.createElement('a');
                link.href = url;
                link.download = `${project.name.replace(/\s+/g, '_')}_bundle.json`;
                link.click();
              }} className="flex items-center gap-3 px-4 py-2 hover:bg-[#2d2d2d] text-sm text-left transition-colors"><Save size={16} className="text-green-400"/> Save project</button>
              
              <div className="px-4 pb-1 pt-2 text-[9px] uppercase font-bold text-gray-500 tracking-wider">Export</div>
              <button onClick={() => exportImage('png')} className="flex items-center gap-3 px-4 py-2 hover:bg-[#2d2d2d] text-sm text-left transition-colors"><FileImage size={16} className="text-pink-400"/> Save as PNG</button>
              <button onClick={() => exportImage('webp')} className="flex items-center gap-3 px-4 py-2 hover:bg-[#2d2d2d] text-sm text-left transition-colors"><FileCode size={16} className="text-cyan-400"/> Save as WEBP</button>
              <button onClick={exportPDF} className="flex items-center gap-3 px-4 py-2 hover:bg-[#2d2d2d] text-sm text-left transition-colors"><Download size={16} className="text-purple-400"/> Export - PDF/Print</button>
            </div>
          )}
          <div className="flex flex-col gap-4">
            <button onClick={() => setActiveTab('page-setup')} className={`p-3 rounded-lg transition-colors ${activeTab === 'page-setup' ? 'bg-blue-600 text-white' : 'hover:bg-[#2d2d2d] text-gray-400'}`}><Layers size={22} /></button>
            <button onClick={() => setActiveTab('panel-setup')} className={`p-3 rounded-lg transition-colors ${activeTab === 'panel-setup' ? 'bg-blue-600 text-white' : 'hover:bg-[#2d2d2d] text-gray-400'}`}><Columns size={22} /></button>
            <button onClick={() => setActiveTab('text')} className={`p-3 rounded-lg transition-colors ${activeTab === 'text' ? 'bg-blue-600 text-white' : 'hover:bg-[#2d2d2d] text-gray-400'}`}><Type size={22} /></button>
            <button onClick={() => setActiveTab('genni')} className={`p-3 rounded-lg transition-colors ${activeTab === 'genni' ? 'bg-blue-600 text-white' : 'hover:bg-[#2d2d2d] text-gray-400'}`}><Sparkles size={22} /></button>
          </div>
        </div>

        {/* Dynamic Sidebar */}
        {activeTab !== 'none' && (
          <div className="w-72 bg-[#181818] border-r border-gray-800 flex flex-col overflow-y-auto no-scrollbar z-10 shrink-0">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1e1e1e] sticky top-0 z-20">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400">{activeTab}</h2>
              <button onClick={() => setActiveTab('none')} className="text-gray-500 hover:text-white"><Minus size={14}/></button>
            </div>
            <div className="p-4 space-y-4">
              {activeTab === 'page-setup' && (
                <div className="space-y-4">
                  <input value={project.name} onChange={(e) => setProject(p => ({ ...p, name: e.target.value }))} className="w-full bg-[#2d2d2d] border border-gray-700 rounded p-2 text-sm outline-none focus:border-blue-500" />
                  <select value={project.type} onChange={(e) => setProject(p => ({ ...p, type: e.target.value as ProjectType }))} className="w-full bg-[#2d2d2d] border border-gray-700 rounded p-2 text-sm outline-none">
                    {Object.values(ProjectType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}
              {activeTab === 'panel-setup' && (
                <div className="grid grid-cols-2 gap-2">
                  {PANEL_TEMPLATES[project.type].map(t => <button key={t} onClick={() => addPanel(t)} className="p-3 bg-[#2d2d2d] hover:bg-[#3d3d3d] border border-gray-700 rounded text-[10px] text-left transition-all">{t}</button>)}
                  <button onClick={() => addPanel()} className="col-span-2 border border-dashed border-gray-600 hover:border-blue-500 py-3 rounded text-xs text-gray-500">+ Custom Panel</button>
                </div>
              )}
              {activeTab === 'text' && (
                <div className="space-y-2">
                  <button onClick={() => addObject(ObjectType.TEXT)} className="w-full bg-[#2d2d2d] hover:bg-[#3d3d3d] p-3 rounded flex items-center gap-3 text-sm transition-all border border-gray-700"><Type size={18} className="text-blue-400"/> Free text</button>
                  <button onClick={() => addObject(ObjectType.NARRATION)} className="w-full bg-[#2d2d2d] hover:bg-[#3d3d3d] p-3 rounded flex items-center gap-3 text-sm transition-all border border-gray-700"><Box size={18} className="text-yellow-400"/> Narration</button>
                  <button onClick={() => addObject(ObjectType.SPEECH_BUBBLE)} className="w-full bg-[#2d2d2d] hover:bg-[#3d3d3d] p-3 rounded flex items-center gap-3 text-sm transition-all border border-gray-700"><MessageSquare size={18} className="text-green-400"/> Speech Bubble</button>
                </div>
              )}
              {activeTab === 'genni' && (
                <div className="space-y-4">
                   <select value={selectedStyle} onChange={(e) => setSelectedStyle(e.target.value)} className="w-full bg-[#2d2d2d] border border-gray-700 rounded p-2 text-sm outline-none">
                    {ART_STYLES.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                  <select value={genniDestination} onChange={(e) => setGenniDestination(e.target.value as GenniDestination)} className="w-full bg-[#2d2d2d] border border-gray-700 rounded p-2 text-sm outline-none">
                    <option value="new-object">New Object</option>
                    <option value="panel-bg">Panel BG</option>
                    <option value="page-bg">Page BG</option>
                  </select>
                  <textarea value={currentPrompt} onChange={(e) => setCurrentPrompt(e.target.value)} className="w-full bg-[#2d2d2d] border border-gray-700 rounded p-2 text-sm h-24 outline-none resize-none" placeholder="Enter prompt..." />
                  <button disabled={isGenerating} onClick={() => generateAIImage(genniDestination)} className={`w-full py-3 rounded text-sm font-bold flex items-center justify-center gap-2 transition-all ${isGenerating ? 'bg-gray-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    {isGenerating ? <RotateCcw className="animate-spin" size={16}/> : <Sparkles size={16}/>} Generate
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Canvas Viewport */}
        <div className="flex-1 relative bg-[#0f0f0f] overflow-auto flex items-start justify-center p-24 no-scrollbar print-target-container">
          <div className="fixed top-14 right-84 flex bg-[#1e1e1e] border border-gray-800 rounded-lg overflow-hidden z-30 zoom-controls">
             <button onClick={() => setZoom(z => Math.max(0.1, z - 0.1))} className="p-2 hover:bg-[#2d2d2d]"><Minus size={16}/></button>
             <div className="px-4 flex items-center text-xs font-mono w-20 justify-center border-x border-gray-800 text-blue-400">{Math.round(zoom * 100)}%</div>
             <button onClick={() => setZoom(z => Math.min(3, z + 0.1))} className="p-2 hover:bg-[#2d2d2d]"><Plus size={16}/></button>
          </div>

          <div 
            id="page-canvas" 
            ref={canvasRef} 
            onContextMenu={(e) => handleContextMenu(e, 'page')}
            onClick={() => { setSelectedPanelId(null); setSelectedObjectId(null); }}
            className={`relative shadow-[0_30px_60px_rgba(0,0,0,0.6)] origin-top transition-transform duration-200 pointer-events-auto bg-white border border-gray-300 ${PROJECT_CONFIGS[project.type].pageRatio}`}
            style={{ 
              width: `${800 * zoom}px`, 
              ...getPageBackgroundStyle(currentPage),
              cursor: dragState ? 'grabbing' : 'default'
            }}
          >
            {currentPage.panels.map((panel) => (
              <div
                key={panel.id}
                id={`panel-${panel.id}`}
                onContextMenu={(e) => handleContextMenu(e, 'panel', panel.id)}
                onMouseDown={(e) => startDrag(e, 'panel', panel.id, panel.x, panel.y, canvasRef.current)}
                className={`absolute group transition-shadow ${selectedPanelId === panel.id ? 'ring-2 ring-blue-500 z-10' : 'hover:ring-1 hover:ring-gray-300'}`}
                style={{
                  left: `${panel.x}%`, top: `${panel.y}%`, width: `${panel.width}%`, height: `${panel.height}%`,
                  transform: `rotate(${panel.rotation}deg)`,
                  backgroundColor: panel.backgroundColor,
                  backgroundImage: panel.backgroundImage ? `url(${panel.backgroundImage})` : 'none',
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  border: `${panel.borderWidth}px solid ${panel.borderColor}`,
                  opacity: panel.opacity, overflow: 'hidden',
                  cursor: dragState?.id === panel.id ? 'grabbing' : 'grab'
                }}
              >
                {panel.objects.map((obj) => (
                  <div
                    key={obj.id}
                    onContextMenu={(e) => handleContextMenu(e, 'object', obj.id)}
                    onMouseDown={(e) => startDrag(e, 'object', obj.id, obj.x, obj.y, document.getElementById(`panel-${panel.id}`))}
                    className={`absolute flex items-center justify-center ${selectedObjectId === obj.id ? 'ring-2 ring-yellow-400 z-50 scale-[1.02]' : ''}`}
                    style={{
                      left: `${obj.x}%`, top: `${obj.y}%`, width: `${obj.width}%`, height: `${obj.height}%`,
                      transform: `rotate(${obj.rotation}deg) scaleX(${obj.flippedH ? -1 : 1}) scaleY(${obj.flippedV ? -1 : 1})`,
                      opacity: obj.opacity, zIndex: obj.zIndex,
                      cursor: dragState?.id === obj.id ? 'grabbing' : 'move'
                    }}
                  >
                    {obj.type === ObjectType.IMAGE && obj.imageUrl && <img src={obj.imageUrl} className="w-full h-full object-contain pointer-events-none" alt="" />}
                    {(obj.type === ObjectType.TEXT || obj.type === ObjectType.NARRATION) && (
                      <div className={`p-2 w-full text-center ${obj.type === ObjectType.NARRATION ? 'bg-yellow-50 border-2 border-black font-serif' : ''}`} style={{ fontSize: `${obj.fontSize * zoom}px`, color: obj.color }}>{obj.content}</div>
                    )}
                    {obj.type === ObjectType.SPEECH_BUBBLE && (
                      <div className="relative w-full h-full bg-white border-2 border-black rounded-[40%] flex items-center justify-center p-4 shadow-md">
                        <div className="text-center font-bold text-black" style={{ fontSize: `${obj.fontSize * zoom}px` }}>{obj.content}</div>
                        <div className="absolute bottom-[-10px] left-[50%] w-4 h-4 bg-white border-b-2 border-r-2 border-black rotate-45 transform -translate-x-1/2"></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar - Properties & Explorer */}
        <div className="w-80 bg-[#1e1e1e] border-l border-gray-800 flex flex-col z-20 shrink-0">
          <div className="flex-1 overflow-y-auto no-scrollbar border-b border-gray-800">
            <div className="p-4 border-b border-gray-800 bg-[#181818] sticky top-0 z-20">
              <h2 className="text-xs font-bold uppercase tracking-widest text-blue-400">Properties</h2>
            </div>
            <div className="p-0">
              {selectedObject ? (
                <>
                  <PropertyGroup title="Transform">
                    <div className="flex justify-around items-end">
                      <RotationKnob value={selectedObject.rotation} onChange={(val) => updateObject({ rotation: val })} label="Rotation" />
                      <div className="flex flex-col gap-2">
                         <button onClick={() => updateObject({ flippedH: !selectedObject.flippedH })} className={`p-2 rounded border border-gray-700 transition-colors ${selectedObject.flippedH ? 'bg-blue-600' : 'hover:bg-[#2d2d2d]'}`}><FlipHorizontal size={14}/></button>
                         <button onClick={() => updateObject({ flippedV: !selectedObject.flippedV })} className={`p-2 rounded border border-gray-700 transition-colors ${selectedObject.flippedV ? 'bg-blue-600' : 'hover:bg-[#2d2d2d]'}`}><FlipVertical size={14}/></button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase text-gray-500 block mb-1">Scale / Size</label>
                      <input type="range" min="5" max="200" value={selectedObject.width} onChange={(e) => updateObject({ width: parseInt(e.target.value), height: parseInt(e.target.value) })} className="w-full accent-blue-500" />
                    </div>
                  </PropertyGroup>
                  <PropertyGroup title="Layout (Z-Index)">
                    <div className="flex items-center gap-2">
                        <input type="range" min="0" max="100" value={selectedObject.zIndex} onChange={(e) => updateObject({ zIndex: parseInt(e.target.value) })} className="flex-1 accent-blue-500" />
                        <span className="text-xs font-mono w-8">{selectedObject.zIndex}</span>
                    </div>
                  </PropertyGroup>
                </>
              ) : selectedPanel ? (
                <PropertyGroup title="Panel Geometry">
                   <RotationKnob value={selectedPanel.rotation} onChange={(val) => updatePanel({ rotation: val })} label="Rotation" />
                   <input type="range" min="0" max="20" value={selectedPanel.borderWidth} onChange={(e) => updatePanel({ borderWidth: parseInt(e.target.value) })} className="w-full accent-blue-500" />
                </PropertyGroup>
              ) : (
                <PropertyGroup title="Page Settings">
                  <input type="color" value={currentPage.backgroundColor} onChange={(e) => updatePage({ backgroundColor: e.target.value })} className="w-full h-10 bg-[#2d2d2d] border border-gray-700 rounded p-0 cursor-pointer overflow-hidden" />
                  <select value={currentPage.gradient?.type} onChange={(e) => updatePage({ gradient: { ...currentPage.gradient!, type: e.target.value as any } })} className="w-full bg-[#2d2d2d] border border-gray-700 rounded p-2 text-xs outline-none mt-2">
                    <option value="none">Solid</option>
                    <option value="linear">Linear</option>
                    <option value="radial">Radial</option>
                  </select>
                </PropertyGroup>
              )}
            </div>
          </div>
          <div className="h-1/2 flex flex-col bg-[#181818] overflow-hidden">
            <div className="p-4 border-b border-gray-800 bg-[#1e1e1e]">
              <h2 className="text-xs font-bold uppercase tracking-widest text-blue-400">Page Explorer</h2>
            </div>
            <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
              {currentPage.panels.map(panel => (
                <div key={panel.id} className="mb-2">
                  <div onClick={() => { setSelectedPanelId(panel.id); setSelectedObjectId(null); }} className={`flex items-center gap-2 p-1 text-xs rounded cursor-pointer ${selectedPanelId === panel.id && !selectedObjectId ? 'bg-blue-900/30 text-blue-300' : 'hover:bg-[#2d2d2d]'}`}>
                    <Columns size={12}/> {panel.name}
                  </div>
                  <div className="pl-4 border-l border-gray-800 ml-2 space-y-1">
                    {[...panel.objects].sort((a,b) => (b.zIndex||0) - (a.zIndex||0)).map(obj => (
                      <div key={obj.id} onClick={() => { setSelectedObjectId(obj.id); setSelectedPanelId(panel.id); }} className={`flex items-center justify-between p-1 text-[10px] rounded cursor-pointer ${selectedObjectId === obj.id ? 'bg-yellow-900/30 text-yellow-300' : 'hover:bg-[#2d2d2d]'}`}>
                        <span className="truncate">{obj.content || obj.type}</span>
                        <span className="text-[8px] opacity-40">Z:{obj.zIndex}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="h-8 bg-[#181818] border-t border-gray-800 px-4 flex items-center justify-between text-[10px] uppercase font-bold text-gray-500 z-50">
        <div className="flex gap-4">
          <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span> AI: {aiStatus}</span>
          <span className="truncate max-w-[200px]">{status}</span>
        </div>
        <span>Gemmi Genni Reaper v1.0</span>
      </div>

      {/* Context Menu Component */}
      {contextMenu.visible && (
        <div 
          className="fixed bg-[#1e1e1e] border border-gray-700 rounded shadow-2xl py-1 z-[1000] w-48 text-xs text-gray-300 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.type === 'page' && (
            <>
              <div className="px-3 py-1.5 text-[9px] text-gray-500 uppercase font-bold border-b border-gray-800 mb-1">Canvas / Page</div>
              <button onClick={() => { setGenniDestination('page-bg'); setActiveTab('genni'); }} className="w-full text-left px-3 py-2 hover:bg-blue-600 hover:text-white flex items-center gap-2"><Sparkles size={12}/> Generate Page BG</button>
              <button onClick={() => setActiveTab('page-setup')} className="w-full text-left px-3 py-2 hover:bg-[#2d2d2d] flex items-center gap-2"><Palette size={12}/> Change Page Color</button>
              <div className="border-t border-gray-800 my-1"></div>
              <button onClick={() => exportImage('png')} className="w-full text-left px-3 py-2 hover:bg-[#2d2d2d] flex items-center gap-2"><FileImage size={12} className="text-pink-400"/> Save as PNG</button>
              <button onClick={() => exportImage('webp')} className="w-full text-left px-3 py-2 hover:bg-[#2d2d2d] flex items-center gap-2"><FileCode size={12} className="text-cyan-400"/> Save as WEBP</button>
            </>
          )}

          {contextMenu.type === 'panel' && (
            <>
              <div className="px-3 py-1.5 text-[9px] text-gray-500 uppercase font-bold border-b border-gray-800 mb-1">Panel: {selectedPanel?.name}</div>
              <button onClick={() => { setGenniDestination('panel-bg'); setActiveTab('genni'); }} className="w-full text-left px-3 py-2 hover:bg-blue-600 hover:text-white flex items-center gap-2"><Sparkles size={12}/> Generate Panel BG</button>
              <button onClick={() => {
                if (contextMenu.targetId) {
                  const pan = currentPage.panels.find(p => p.id === contextMenu.targetId);
                  if (pan) {
                    const newId = `pan_${Date.now()}`;
                    updatePage({ panels: [...currentPage.panels, { ...pan, id: newId, x: pan.x + 5, y: pan.y + 5 }] });
                    setSelectedPanelId(newId);
                  }
                }
              }} className="w-full text-left px-3 py-2 hover:bg-[#2d2d2d] flex items-center gap-2"><Copy size={12}/> Duplicate Panel</button>
              <button onClick={() => contextMenu.targetId && deletePanel(contextMenu.targetId)} className="w-full text-left px-3 py-2 hover:bg-red-900/30 text-red-400 flex items-center gap-2"><Trash2 size={12}/> Delete Panel</button>
            </>
          )}

          {contextMenu.type === 'object' && contextMenu.targetId && (
            <>
              <div className="px-3 py-1.5 text-[9px] text-gray-500 uppercase font-bold border-b border-gray-800 mb-1">Object: {selectedObject?.type}</div>
              <button onClick={() => duplicateObject(contextMenu.targetId!)} className="w-full text-left px-3 py-2 hover:bg-[#2d2d2d] flex items-center gap-2"><Copy size={12}/> Duplicate</button>
              {selectedObject?.type === ObjectType.IMAGE && (
                <button onClick={() => removeBg(contextMenu.targetId)} className="w-full text-left px-3 py-2 hover:bg-blue-600 hover:text-white flex items-center gap-2"><Scissors size={12}/> Remove Background</button>
              )}
              {selectedObject?.type !== ObjectType.IMAGE && (
                <button onClick={() => { setActiveTab('text'); }} className="w-full text-left px-3 py-2 hover:bg-blue-600 hover:text-white flex items-center gap-2"><Type size={12}/> Edit Text</button>
              )}
              <button onClick={() => deleteObject(contextMenu.targetId!)} className="w-full text-left px-3 py-2 hover:bg-red-900/30 text-red-400 flex items-center gap-2"><Trash2 size={12}/> Delete Object</button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default App;