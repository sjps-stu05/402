import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Sparkles, RefreshCw, Check, X, ShieldAlert, 
  Dices, Hash, Palette, Wand2, Star
} from 'lucide-react';

interface AvatarStudioProps {
  studentName: string;
  currentAvatar: string;
  onClose: () => void;
  onSave: (newAvatarUrl: string) => void;
}

interface StyleOption {
  id: string;
  name: string;
  description: string;
  dicebearKey: string;
  emoji: string;
  tags: string[];
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    id: 'lorelei',
    name: '精緻日系動漫',
    description: '甜美細緻的經典日系動漫美少女風格',
    dicebearKey: 'lorelei',
    emoji: '🎀',
    tags: ['動漫風格', '極力推薦', '高細節']
  },
  {
    id: 'adventurer',
    name: '奇幻 RPG 冒險者',
    description: '日系奇幻 RPG 勇者與冒險家體操特徵',
    dicebearKey: 'adventurer',
    emoji: '⚔️',
    tags: ['動漫風格', '冒險', '中性']
  },
  {
    id: 'bottts',
    name: '經典發電機器人',
    description: '經典科技感機械齒輪頭像',
    dicebearKey: 'bottts',
    emoji: '🤖',
    tags: ['科幻', '原版', '機械']
  },
  {
    id: 'pixel-art',
    name: '復古 8-bit 像素',
    description: '懷舊遊戲機像素點陣動漫藝術',
    dicebearKey: 'pixel-art',
    emoji: '👾',
    tags: ['像素', '復古', '可愛']
  },
  {
    id: 'avataaars',
    name: '經典美式卡通',
    description: '繽紛活潑的經典美式 2D 向量卡通肖像',
    dicebearKey: 'avataaars',
    emoji: '👱',
    tags: ['美式卡通', '高自訂', '熱門']
  },
  {
    id: 'big-smile',
    name: '活力 Q 版大笑',
    description: '擁有燦爛笑容與多樣可愛配件的日系 Q 版大頭貼',
    dicebearKey: 'big-smile',
    emoji: '😸',
    tags: ['Q 版可愛', '療癒系', '動漫感']
  },
  {
    id: 'fun-emoji',
    name: '歡樂惡搞表情',
    description: '充滿趣味、大膽創意的生動表情包',
    dicebearKey: 'fun-emoji',
    emoji: '🤪',
    tags: ['趣味', '誇張', '繽紛']
  }
];

export default function AvatarStudio({
  studentName,
  currentAvatar,
  onClose,
  onSave
}: AvatarStudioProps) {
  const [selectedStyle, setSelectedStyle] = useState<StyleOption>(STYLE_OPTIONS[0]);
  const [seed, setSeed] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string>(currentAvatar);
  const [isGenerating, setIsGenerating] = useState(false);

  // Initialize seed with student's name if empty
  useEffect(() => {
    if (!seed) {
      const sanitizedName = studentName || 'student';
      setSeed(`${sanitizedName}-${Math.floor(Math.random() * 1000)}`);
    }
  }, [studentName]);

  // Handle URL updating based on selected style and seed value
  useEffect(() => {
    if (!seed) return;
    
    setIsGenerating(true);
    const bgColors = 'b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,d1fae5';
    const newUrl = `https://api.dicebear.com/7.x/${selectedStyle.dicebearKey}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bgColors}`;
    
    // Smooth image loading simulation
    const img = new Image();
    img.src = newUrl;
    img.onload = () => {
      setPreviewUrl(newUrl);
      setIsGenerating(false);
    };
    img.onerror = () => {
      setPreviewUrl(newUrl); // Fallback even if loading fails
      setIsGenerating(false);
    };
  }, [selectedStyle, seed]);

  // Sound synthesis engine for interactive experience
  const playZipSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.12);
      
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.12);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn('Audio synthesis failed in AvatarStudio', e);
    }
  };

  const handleRollDice = () => {
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    setSeed(`${studentName || 'student'}-${randomSuffix}`);
    playZipSound();
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden max-w-3xl w-full flex flex-col md:flex-row">
      
      {/* Left side: Preview Canvas Card */}
      <div className="w-full md:w-[42%] bg-gradient-to-b from-slate-50 to-blue-50/40 p-8 flex flex-col justify-between items-center border-b md:border-b-0 md:border-r border-slate-100 relative">
        
        {/* Sparkles Ambient Decor */}
        <div className="absolute top-4 left-4 text-blue-300">
          <Star className="w-5 h-5 animate-pulse" />
        </div>
        <div className="absolute bottom-4 right-4 text-purple-300">
          <Sparkles className="w-5 h-5 animate-pulse" />
        </div>

        <div className="w-full text-center space-y-1">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">AI 智慧造型工坊</span>
          <h3 className="text-xl font-serif font-bold text-slate-800">
            {studentName} 的個人肖像
          </h3>
        </div>

        {/* Live SVG Preview Box */}
        <div className="my-8 relative group">
          {/* Neon style gradient back shadow */}
          <div className="absolute inset-x-2 -inset-y-1 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-[2.2rem] blur-xl opacity-30 group-hover:opacity-40 transition-opacity duration-300" />
          
          <div className="relative w-44 h-44 bg-white rounded-[2.2rem] border-4 border-white shadow-xl flex items-center justify-center overflow-hidden">
            {previewUrl ? (
              <motion.img 
                key={previewUrl}
                src={previewUrl} 
                alt="Avatar Preview" 
                className={`w-full h-full object-cover rounded-[1.8rem] transition-all duration-300 ${isGenerating ? 'brightness-75 scale-95 opacity-80' : 'brightness-100 scale-100 opacity-100'}`}
                initial={{ scale: 0.9, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400 bg-slate-50 rounded-[1.8rem]">
                無預覽圖
              </div>
            )}
            {isGenerating && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Input Seed Customizer */}
        <div className="w-full space-y-3">
          <div className="flex bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm items-center gap-2">
            <Hash className="w-4 h-4 text-slate-400 shrink-0" />
            <input 
              type="text" 
              placeholder="自訂造型基因 (種子值)..." 
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              className="w-full bg-transparent outline-none text-xs font-bold text-slate-700"
            />
          </div>

          <button
            onClick={handleRollDice}
            className="w-full py-3 bg-white hover:bg-slate-50 text-slate-700 rounded-2xl font-bold text-xs border border-slate-200 transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Dices className="w-4 h-4 text-blue-500" />
            隨機生成新臉孔 (Shuffle)
          </button>
        </div>
      </div>

      {/* Right side: Options Selector and controls */}
      <div className="w-full md:w-[58%] p-8 flex flex-col justify-between space-y-8">
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-slate-800">選擇人像風格模式</h4>
              <p className="text-xs text-slate-400 mt-0.5">提供豐富、趣味的日系動漫與現代插畫等設計風格</p>
            </div>
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* List of Styles */}
          <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
            {STYLE_OPTIONS.map((style) => {
              const isSelected = selectedStyle.id === style.id;
              return (
                <button
                  key={style.id}
                  onClick={() => {
                    setSelectedStyle(style);
                    playZipSound();
                  }}
                  className={`w-full p-4 rounded-2xl text-left border transition-all flex items-start gap-4 ${isSelected ? 'border-blue-500 bg-blue-50/20 shadow-sm shadow-blue-50' : 'border-slate-100 hover:border-slate-200 bg-white hover:bg-slate-50/50'}`}
                >
                  <span className="text-2xl mt-0.5">{style.emoji}</span>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">{style.name}</span>
                      <div className="flex gap-1">
                        {style.tags.map(tag => (
                          <span 
                            key={tag} 
                            className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${tag === '動漫風格' ? 'bg-indigo-100 text-indigo-600' : tag === '極力推薦' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                      {style.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer buttons */}
        <div className="flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold text-xs transition-all"
          >
            取消關閉
          </button>
          <button
            onClick={() => {
              onSave(previewUrl);
            }}
            className="flex-1 py-3.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-2xl font-bold text-xs shadow-lg shadow-blue-100 hover:from-blue-600 hover:to-indigo-700 transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            確定套用此肖像
          </button>
        </div>
      </div>

    </div>
  );
}
