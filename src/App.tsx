import { summarizeSELReport, getDailyJoke } from './lib/gemini';
import React, { useState, useEffect, useMemo, FormEvent, ChangeEvent, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sun, Cloud, CloudRain, CloudLightning, 
  BookOpen, ClipboardList, BarChart3, 
  User, Settings, Plus, Save, 
  CheckCircle2, AlertCircle, HelpCircle,
  ArrowRight, LogOut, LayoutDashboard,
  MessageSquare, Heart, ShieldCheck,
  Image as ImageIcon, Sparkles,
  Mic, MicOff,
  Smile, Frown, Flame, Zap, Volume2,
  Download, Database, Bluetooth, Upload, ArrowLeftRight, Scale, Tag, FileDown, X,
  TrendingUp, TrendingDown, Calendar, RefreshCw,
  Compass, Eye, Activity, Filter, Clock, Users
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
  ScatterChart, Scatter, ZAxis, ReferenceLine,
  PieChart, Pie
} from 'recharts';
import { DataService, resizeImage } from './lib/dataService';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, signInWithGoogle, logout } from './lib/firebase';
import ESP32Panel from './components/ESP32Panel';
import InteractiveMiniGame from './components/InteractiveMiniGame';
import MindfulnessChallenge from './components/MindfulnessChallenge';
import AvatarStudio from './components/AvatarStudio';
import WeatherParticles from './components/WeatherParticles';
import Confetti from './components/Confetti';
import CounselingReportModal from './components/CounselingReportModal';

function renderInlineStyles(text: string): React.ReactNode[] {
  // Simple bold parser **text**
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-extrabold text-indigo-950 bg-indigo-50/75 px-1.5 py-0.5 rounded-md">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function parseMarkdownToReact(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-3">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        
        // Check if it's a heading
        if (trimmed.startsWith('### ')) {
          const headingText = trimmed.replace('### ', '');
          return (
            <h4 key={idx} className="text-sm font-bold text-indigo-950 mt-4 mb-2 flex items-center gap-1.5 border-l-4 border-indigo-500 pl-2">
              {renderInlineStyles(headingText)}
            </h4>
          );
        }
        if (trimmed.startsWith('## ')) {
          const headingText = trimmed.replace('## ', '');
          return (
            <h3 key={idx} className="text-base font-bold text-indigo-900 mt-5 mb-2.5 border-b border-indigo-100/50 pb-1 flex items-center gap-2">
              {renderInlineStyles(headingText)}
            </h3>
          );
        }
        if (trimmed.startsWith('# ')) {
          const headingText = trimmed.replace('# ', '');
          return (
            <h2 key={idx} className="text-lg font-extrabold text-indigo-950 mt-6 mb-3 border-b-2 border-indigo-200 pb-1">
              {renderInlineStyles(headingText)}
            </h2>
          );
        }

        // Check if it's a list item
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const content = trimmed.substring(2);
          return (
            <div key={idx} className="flex items-start gap-2 pl-4 text-slate-700 text-xs leading-relaxed">
              <span className="text-indigo-500 select-none mt-1">•</span>
              <span className="flex-1">{renderInlineStyles(content)}</span>
            </div>
          );
        }

        // Check if it's a numbered list item
        const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
        if (numMatch) {
          const content = numMatch[2];
          return (
            <div key={idx} className="flex items-start gap-2 pl-4 text-slate-700 text-xs leading-relaxed">
              <span className="text-indigo-600 font-bold select-none mt-0.5">{numMatch[1]}.</span>
              <span className="flex-1">{renderInlineStyles(content)}</span>
            </div>
          );
        }

        // Default: paragraph
        if (trimmed === '') {
          return <div key={idx} className="h-1" />;
        }

        return (
          <p key={idx} className="text-xs text-slate-600 leading-relaxed pl-1">
            {renderInlineStyles(line)}
          </p>
        );
      })}
    </div>
  );
}

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getFormattedLocalDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m - 1, d);
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekday = weekdays[dateObj.getDay()] || '';
    return `${y} 年 ${m} 月 ${d} 日 ${weekday}`;
  } catch (e) {
    return dateStr;
  }
}

function getStudentInitial(name: string): string {
  if (!name) return '';
  const initial = name[0];
  if (initial === '五' || initial === '伍') {
    return '伍';
  }
  return initial;
}

const MOOD_QUADRANTS: Record<MoodType, { x: number, y: number, label: string }> = {
  sun: { x: 75, y: 75, label: '興奮/快樂' },
  storm: { x: -75, y: 75, label: '憤怒/痛苦' },
  rain: { x: -75, y: -75, label: '悲傷/失望' },
  cloud: { x: 75, y: -75, label: '放鬆/鎮定' },
};

const EmotionGranularityChart = ({ history }: { history: DailyMood[] }) => {
  const counts = useMemo(() => {
    const res: Record<MoodType, number> = { sun: 0, cloud: 0, rain: 0, storm: 0 };
    history.forEach(day => {
      Object.values(day.moods).forEach(m => {
        if (res[m as MoodType] !== undefined) res[m as MoodType]++;
      });
    });
    return res;
  }, [history]);

  const scatterData = (Object.keys(MOOD_QUADRANTS) as MoodType[]).map(m => ({
    name: MOOD_CONFIG[m].label,
    x: MOOD_QUADRANTS[m].x,
    y: MOOD_QUADRANTS[m].y,
    z: counts[m],
    label: MOOD_QUADRANTS[m].label
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100">
          <p className="text-sm font-bold text-slate-800">{data.name}</p>
          <p className="text-xs text-slate-500">{data.label}</p>
          <p className="text-lg font-serif text-blue-600 mt-1">{data.z} 次</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10">
        <div className="w-full h-[1px] bg-slate-400"></div>
        <div className="h-full w-[1px] bg-slate-400 absolute"></div>
      </div>
      
      {/* Quadrant Labels */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">高強度 (High)</div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">低強度 (Low)</div>
      <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">不愉快 (Unpleasant)</div>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">愉快 (Pleasant)</div>

      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 40, right: 40, bottom: 40, left: 40 }}>
          <XAxis type="number" dataKey="x" domain={[-100, 100]} hide />
          <YAxis type="number" dataKey="y" domain={[-100, 100]} hide />
          <ZAxis type="number" dataKey="z" range={[400, 4000]} />
          <ReferenceLine x={0} stroke="#e2e8f0" strokeWidth={2} />
          <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={2} />
          <Tooltip content={<CustomTooltip />} />
          <Scatter name="Emotions" data={scatterData}>
            {scatterData.map((entry, index) => {
              const moodKey = (Object.keys(MOOD_QUADRANTS) as MoodType[])[index];
              const color = moodKey === 'sun' ? '#f59e0b' : moodKey === 'cloud' ? '#9ca3af' : moodKey === 'rain' ? '#60a5fa' : '#a855f7';
              return <Cell key={`cell-${index}`} fill={color} fillOpacity={0.6} stroke={color} strokeWidth={2} />;
            })}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
import { SELData, Student, MoodType, PassportEntry, DailyMood } from './types';
import defaultStudents from './lib/defaultStudents.json';
import { DEFAULT_CLASSROOM_IMAGE } from './classroomImage';

// Initial Data with restored default personal avatars for all 29 students and clean classroom image
const INITIAL_DATA: SELData = {
  students: defaultStudents as Student[],
  moodHistory: [],
  passportEntries: [],
  classroomImage: DEFAULT_CLASSROOM_IMAGE
};

const STORAGE_KEY = 'sel_app_data_402_v1';

const getInitialData = (): SELData => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.students && parsed.students.length > 0) {
        // Ensure all students have their original avatars restored if missing
        const studentsWithAvatars = parsed.students.map((s: Student) => {
          if (!s.avatar) {
            const def = (defaultStudents as Student[]).find(d => d.id === s.id);
            if (def && def.avatar) {
              return { ...s, avatar: def.avatar };
            }
          }
          return s;
        });
        return { 
          ...parsed, 
          students: studentsWithAvatars,
          classroomImage: DEFAULT_CLASSROOM_IMAGE
        };
      }
    } catch (e) {
      console.error('Failed to parse saved data', e);
    }
  }
  return INITIAL_DATA;
};

const MOOD_CONFIG: Record<MoodType, { icon: any, color: string, label: string, bg: string }> = {
  sun: { icon: Sun, color: 'text-yellow-500', label: '大太陽', bg: 'bg-yellow-50' },
  cloud: { icon: Cloud, color: 'text-gray-400', label: '多雲', bg: 'bg-gray-50' },
  rain: { icon: CloudRain, color: 'text-blue-400', label: '雨天', bg: 'bg-blue-50' },
  storm: { icon: CloudLightning, color: 'text-purple-500', label: '暴風雨', bg: 'bg-purple-50' },
};

const MiniGame = ({ onComplete }: { onComplete: () => void }) => {
  const [items, setItems] = useState<{ id: number; x: number; y: number; icon: any; color: string }[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    if (!gameStarted) return;
    if (timeLeft <= 0) {
      const timer = setTimeout(onComplete, 3000);
      return () => clearTimeout(timer);
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    const spawnInterval = setInterval(() => {
      const id = Date.now() + Math.random();
      const x = Math.random() * 80 + 10;
      const y = Math.random() * 70 + 15;
      
      const pool = [
        { icon: Heart, color: 'text-red-400' },
        { icon: Sun, color: 'text-yellow-400' },
        { icon: Sparkles, color: 'text-amber-400' },
        { icon: Zap, color: 'text-blue-400' },
        { icon: Smile, color: 'text-orange-400' }
      ];
      const pick = pool[Math.floor(Math.random() * pool.length)];

      setItems(prev => [...prev, { id, x, y, ...pick }]);
      
      setTimeout(() => {
        setItems(prev => prev.filter(i => i.id !== id));
      }, 1500);
    }, 600);

    return () => {
      clearInterval(timer);
      clearInterval(spawnInterval);
    };
  }, [timeLeft, gameStarted, onComplete]);

  const handleItemClick = (id: number) => {
    setScore(prev => prev + 1);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <div className="p-8 md:p-12 flex flex-col items-center text-center gap-8">
      {!gameStarted ? (
        <div className="space-y-6">
          <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center text-blue-600 mx-auto shadow-inner">
            <Zap className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-3xl font-serif font-medium text-slate-900 mb-2">心情電力充電站 ⚡️</h2>
            <p className="text-slate-500 font-medium">點擊飛舞的星星和心情元素，為今天注入滿滿正能量！</p>
          </div>
          <button 
            onClick={() => setGameStarted(true)}
            className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-bold text-lg shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all transform hover:scale-105 active:scale-95"
          >
            開始遊戲
          </button>
        </div>
      ) : (
        <>
          <div className="w-full flex items-center justify-between">
            <div className="bg-slate-100 px-6 py-3 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">目前得分</span>
              <span className="text-2xl font-serif font-medium text-blue-600">{score}</span>
            </div>
            <div className={`px-6 py-3 rounded-2xl ${timeLeft < 4 ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-900'}`}>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-0.5">剩餘時間</span>
              <span className="text-2xl font-serif font-medium">{timeLeft}s</span>
            </div>
          </div>

          <div className="relative w-full aspect-[4/3] bg-blue-50/30 rounded-[3rem] border-4 border-dashed border-blue-100 overflow-hidden cursor-pointer shadow-inner">
            <AnimatePresence>
              {timeLeft > 0 && items.map(item => (
                <motion.button
                  key={item.id}
                  initial={{ scale: 0, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 1.2 }}
                  whileTap={{ scale: 0.8 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleItemClick(item.id);
                  }}
                  className={`absolute p-4 ${item.color} filter drop-shadow-md`}
                  style={{ left: `${item.x}%`, top: `${item.y}%` }}
                >
                  <item.icon className="w-12 h-12 animate-pulse" />
                </motion.button>
              ))}
            </AnimatePresence>

            {timeLeft <= 0 && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-8 backdrop-blur-sm"
              >
                <div className="relative mb-6">
                  <Sparkles className="w-20 h-20 text-yellow-500 animate-spin-slow" />
                  <Heart className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-red-500 animate-pulse" />
                </div>
                <h3 className="text-3xl font-serif font-medium text-slate-900 mb-2">太棒了！</h3>
                <p className="text-slate-500 font-medium mb-8 leading-relaxed">
                  你總共收集了 <span className="text-blue-600 font-bold">{score}</span> 個心情能量！<br />
                  帶著這份活力，今天一定會很精彩。
                </p>
                <div className="flex gap-4">
                  {['🌈', '✨', '🎈', '🍭'].map((emoji, i) => (
                    <motion.span 
                      key={i}
                      animate={{ y: [0, -10, 0] }}
                      transition={{ repeat: Infinity, delay: i * 0.2 }}
                      className="text-2xl"
                    >
                      {emoji}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const LOCAL_JOKES = [
  {
    question: "為什麼超人要穿緊身衣？",
    answer: "因為救人要緊！"
  },
  {
    question: "什麼車子的輪子不會動？",
    answer: "風車"
  },
  {
    question: "鋼鐵人、美國隊長和綠巨人浩克去吃火鍋，誰最想付錢？",
    answer: "綠巨人。（因為他「好客」/ 浩克）"
  }
];

const RepairStation = ({ 
  onComplete,
  esp32IMU,
  esp32Connected,
  esp32Virtual,
  bleConnected,
  bleOffset,
  bleBias,
  ayBias,
  onCalibrate
}: { 
  onComplete: () => void;
  esp32IMU: { ax: number; ay: number; az: number; gx: number; gy: number; gz: number };
  esp32Connected: boolean;
  esp32Virtual: boolean;
  bleConnected?: boolean;
  bleOffset?: number;
  bleBias?: number;
  ayBias?: number;
  onCalibrate?: () => void;
}) => {
  const [mode, setMode] = useState<'selection' | 'game' | 'joke'>('selection');
  const [currentJoke, setCurrentJoke] = useState<{question: string, answer: string} | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (mode === 'joke' && !showAnswer) {
      if (countdown > 0) {
        timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      } else {
        setShowAnswer(true);
      }
    }
    return () => clearTimeout(timer);
  }, [mode, countdown, showAnswer]);

  const handleStartJoke = () => {
    const randomJoke = LOCAL_JOKES[Math.floor(Math.random() * LOCAL_JOKES.length)];
    setCurrentJoke(randomJoke);
    setShowAnswer(false);
    setCountdown(10);
    setMode('joke');
  };

  if (mode === 'game') {
    return (
      <InteractiveMiniGame 
        onComplete={onComplete} 
        esp32IMU={esp32IMU}
        esp32Connected={esp32Connected}
        esp32Virtual={esp32Virtual}
        bleConnected={bleConnected}
        bleOffset={bleOffset}
        bleBias={bleBias}
        ayBias={ayBias}
        onCalibrate={onCalibrate}
      />
    );
  }

  if (mode === 'joke' && currentJoke) {
    return (
      <div className="p-8 md:p-12 flex flex-col items-center text-center gap-8">
        <div className="w-20 h-20 bg-amber-50 rounded-[2rem] flex items-center justify-center text-amber-600 shadow-inner">
          <MessageSquare className="w-10 h-10" />
        </div>
        <div className="space-y-6 w-full">
          <div className="space-y-2">
            <h2 className="text-3xl font-serif font-medium text-slate-900">冷笑話猜猜看</h2>
            <p className="text-slate-400 font-medium">看你能不能猜到答案！</p>
          </div>
          
          <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 min-h-[220px] flex flex-col items-center justify-center gap-6 relative overflow-hidden">
            <div className="text-xl font-bold text-slate-800 leading-relaxed">
              題目：{currentJoke.question}
            </div>
            
            <AnimatePresence mode="wait">
              {!showAnswer ? (
                <motion.div 
                  key="timer"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="w-12 h-12 rounded-full border-4 border-amber-200 border-t-amber-500 animate-spin mb-2" />
                  <div className="text-amber-600 font-bold text-lg">
                    答案正在路上... {countdown}s
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="answer"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-white rounded-2xl border-2 border-amber-200 shadow-sm w-full"
                >
                  <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">答案</div>
                  <div className="text-2xl font-black text-slate-900">{currentJoke.answer}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="flex flex-col w-full gap-4">
          <button 
            onClick={handleStartJoke}
            className="w-full py-4 bg-amber-100 text-amber-700 rounded-[2rem] font-bold hover:bg-amber-200 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" /> 換一個猜猜
          </button>
          <button 
            onClick={onComplete}
            className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-bold text-lg shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all"
          >
            我充飽電了！
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 flex flex-col items-center text-center gap-8">
      <div className="w-24 h-24 bg-blue-50 rounded-[2.5rem] flex items-center justify-center text-blue-600 shadow-inner">
        <Zap className="w-12 h-12" />
      </div>
      <div>
        <h2 className="text-3xl font-serif font-medium text-slate-900 mb-2">心情電力充電站 ⚡️</h2>
        <p className="text-slate-500 font-medium">簽到完成了！想用什麼方式來充充電呢？</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        <button 
          onClick={() => {
            window.speechSynthesis.cancel();
            setMode('game');
          }}
          className="p-8 bg-blue-600 text-white rounded-[2.5rem] flex flex-col items-center gap-4 shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all group"
        >
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Zap className="w-8 h-8" />
          </div>
          <div className="font-bold text-xl">開始遊戲</div>
        </button>
        <button 
          onClick={handleStartJoke}
          className="p-8 bg-amber-500 text-white rounded-[2.5rem] flex flex-col items-center gap-4 shadow-xl shadow-amber-100 hover:bg-amber-600 transition-all group"
        >
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <MessageSquare className="w-8 h-8" />
          </div>
          <div className="font-bold text-xl">笑話一則</div>
        </button>
      </div>
      <button 
        onClick={onComplete}
        className="text-slate-400 font-bold hover:text-slate-600 transition-colors"
      >
        先休息一下
      </button>
    </div>
  );
};

const EMOTION_ADJECTIVES = [
  '開心', '興奮', '滿足', '放鬆', '平靜', '自信', '幸福', '愉快', '期待', '得意',
  '難過', '傷心', '生氣', '憤怒', '緊張', '焦慮', '擔心', '挫折', '無奈', '孤單',
  '疲倦', '沮喪', '失望', '害怕', '害羞', '委屈', '煩躁', '壓力', '迷茫', '無聊',
  '驚訝', '好奇', '平淡', '溫暖', '感恩'
];

export default function App() {
  const [view, setView] = useState<'student' | 'teacher' | 'management' | 'checkin'>('checkin');
  const [data, setData] = useState<SELData>(getInitialData);
  const [currentStudent, setCurrentStudent] = useState<Student>(() => {
    const init = getInitialData();
    return init.students[0] || INITIAL_DATA.students[0];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [checkinStudentId, setCheckinStudentId] = useState<string | null>(null);
  const [todayMood, setTodayMood] = useState<MoodType | null>(null);
  const [passportForm, setPassportForm] = useState<{ incident: string, mood: MoodType, result: string }>({ 
    incident: '', 
    mood: 'sun', 
    result: '' 
  });
  const [passportImage, setPassportImage] = useState<string>('');
  const [selectedPassportEntry, setSelectedPassportEntry] = useState<PassportEntry | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [newStudentName, setNewStudentName] = useState('');
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [rawJson, setRawJson] = useState(JSON.stringify(getInitialData(), null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [recordingField, setRecordingField] = useState<string | null>(null);
  const [showGame, setShowGame] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [compareMonthA, setCompareMonthA] = useState<string>('');
  const [compareMonthB, setCompareMonthB] = useState<string>('');
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // AI Weekly Emotion Recovery Highlights Report States
  const [summaryReport, setSummaryReport] = useState<string>(() => {
    return localStorage.getItem('sel_ai_summary_report') || '';
  });
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // ESP32 S3 Connection and Simulation States
  const [esp32Connected, setEsp32Connected] = useState(false);
  const [bleConnected, setBleConnected] = useState(false);
  const [bleDevice, setBleDevice] = useState<any>(null);
  const [bleOffset, setBleOffset] = useState<number>(0);
  const [bleDeviceName, setBleDeviceName] = useState<string>('');
  const [bleBias, setBleBias] = useState<number>(0);
  const [ayBias, setAyBias] = useState<number>(0);
  const [esp32Port, setEsp32Port] = useState<any | null>(null);
  const [esp32Reader, setEsp32Reader] = useState<any | null>(null);
  const [esp32Virtual, setEsp32Virtual] = useState(false);
  const [esp32IMU, setEsp32IMU] = useState({ ax: 0, ay: 0, az: 9.8, gx: 0, gy: 0, gz: 0 });
  const [esp32StablePercent, setEsp32StablePercent] = useState(100);
  const [activeGesture, setActiveGesture] = useState<string | null>(null);
  const [gestureTimer, setGestureTimer] = useState<number>(0);
  const [activeCheckinGesture, setActiveCheckinGesture] = useState<MoodType | null>(null);

  // Mindfulness challenge state
  const [showMindfulness, setShowMindfulness] = useState(false);
  
  // Avatar studio state
  const [avatarStudioStudentId, setAvatarStudioStudentId] = useState<string | null>(null);

  // Dynamic Today Date State that auto-updates daily
  const [todayDateStr, setTodayDateStr] = useState<string>(() => getLocalDateString());

  // Checkin view filter state
  const [checkinFilter, setCheckinFilter] = useState<'all' | 'unregistered' | 'registered' | 'sun' | 'cloud' | 'rain' | 'storm'>('all');

  // Classroom Pulse & Mood Weather observation states
  const [pulseMoodFilter, setPulseMoodFilter] = useState<'all' | 'sun' | 'cloud' | 'rain' | 'storm' | 'unregistered'>('all');
  const [pulseStatusFilter, setPulseStatusFilter] = useState<'all' | 'focus' | 'quiet' | 'help'>('all');
  const [selectedPulseStudent, setSelectedPulseStudent] = useState<Student | null>(null);

  // Daily auto-refresh timer: checks every 30s or on window focus so the board automatically rolls over to a fresh day at midnight
  useEffect(() => {
    const updateTodayDate = () => {
      const freshDate = getLocalDateString();
      setTodayDateStr(current => {
        if (current !== freshDate) {
          console.log(`[Auto-Daily-Sync] Day rolled over from ${current} to ${freshDate}. Dashboard updated.`);
          return freshDate;
        }
        return current;
      });
    };

    updateTodayDate();
    const timer = setInterval(updateTodayDate, 30000);
    window.addEventListener('focus', updateTodayDate);
    document.addEventListener('visibilitychange', updateTodayDate);

    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', updateTodayDate);
      document.removeEventListener('visibilitychange', updateTodayDate);
    };
  }, []);

  // Connect ESP32-S3 via Web Serial API
  const handleESP32Connect = async () => {
    try {
      if (!('serial' in navigator)) {
        alert('您的瀏覽器不支援 Web Serial 控制。請點擊「開啟虛擬機」來模擬體感功能。');
        return;
      }
      
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      setEsp32Port(port);
      setEsp32Connected(true);
      setEsp32Virtual(false); // Disable virtual mode if hardware is successfully connected

      // Set up streaming text decoder
      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable);
      const reader = decoder.readable.getReader();
      setEsp32Reader(reader);

      let buffer = '';
      
      // Async continuous reading loop
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            
            buffer += value;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              const cleaned = line.trim();
              if (!cleaned) continue;
              
              // 1. JSON parse fallback
              if (cleaned.startsWith('{')) {
                try {
                  const parsed = JSON.parse(cleaned);
                  if (typeof parsed.ax === 'number') {
                    setEsp32IMU({
                      ax: parsed.ax,
                      ay: parsed.ay,
                      az: parsed.az,
                      gx: parsed.gx || 0,
                      gy: parsed.gy || 0,
                      gz: parsed.gz || 0
                    });
                  }
                  if (parsed.gesture) {
                    setActiveGesture(parsed.gesture);
                  }
                } catch (e) {}
                continue;
              }

              // 2. Comma separated float parse: e.g. "IMU: 0.1, -0.2, 9.8"
              const iMatch = cleaned.match(/(?:IMU:)?\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i);
              if (iMatch) {
                const ax = parseFloat(iMatch[1]);
                const ay = parseFloat(iMatch[2]);
                const az = parseFloat(iMatch[3]);
                setEsp32IMU(prev => ({ ...prev, ax, ay, az }));
                continue;
              }

              // 3. String signals keyword check
              const text = cleaned.toUpperCase();
              if (text.includes('SHAKE') || text.includes('STORM')) {
                setActiveGesture('storm');
              } else if (text.includes('JUMP') || text.includes('SUN')) {
                setActiveGesture('sun');
              } else if (text.includes('RAIN') || text.includes('SAD')) {
                setActiveGesture('rain');
              } else if (text.includes('CLOUD') || text.includes('BALANCED')) {
                setActiveGesture('cloud');
              }
            }
          }
        } catch (rErr) {
          console.error('Serial stream reading interrupted:', rErr);
        }
      })();

    } catch (err: any) {
      console.error('Web Serial request failed:', err);
      if (err.name !== 'NotFoundError') {
        if (err.name === 'SecurityError' || (err.message && (err.message.includes('permissions policy') || err.message.includes('disallowed')))) {
          alert(`瀏覽器權限限制: ${err.message}\n\n💡 提示：因為內嵌預覽視窗安全限制，請點擊預覽畫面右上方的「在新分頁開啟」圖示（或在獨立網址開啟），在獨立新視窗中呼叫 Web Serial，即可正常連線並操控您的 ESP32 體感設備！`);
        } else {
          alert(`連線出錯: ${err.message}`);
        }
      }
    }
  };

  const handleESP32Disconnect = async () => {
    try {
      if (esp32Reader) {
        await esp32Reader.cancel();
        setEsp32Reader(null);
      }
      if (esp32Port) {
        await esp32Port.close();
        setEsp32Port(null);
      }
    } catch (e) {
      console.error(e);
    }
    setEsp32Connected(false);
    setAyBias(0);
  };

  const handleCalibrateDevice = () => {
    if (bleConnected) {
      setBleBias(bleOffset);
    } else if (esp32Connected || esp32Virtual) {
      setAyBias(esp32IMU.ay);
    }
  };

  // Connect ESP32-S3 via Web Bluetooth (BLE) API
  const handleBLEConnect = async () => {
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        alert('您的瀏覽器不支援 Web Bluetooth。請點擊「開啟虛擬機」來模擬體感功能。');
        return;
      }
      
      const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
      const STATUS_CHAR_UUID = 'd8de624e-140f-4a22-8594-e2216b84a5f2';

      const device = await nav.bluetooth.requestDevice({
        filters: [{ namePrefix: 'EES-' }],
        optionalServices: [SERVICE_UUID]
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(STATUS_CHAR_UUID);
      
      await characteristic.startNotifications();
      
      setBleDevice(device);
      setBleConnected(true);
      setBleDeviceName(device.name || 'EES Controller');
      setEsp32Virtual(false); // Disable virtual mode if BLE is connected

      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const dataStr = decoder.decode(value);
        if (dataStr.startsWith('offset:')) {
          const offsetStr = dataStr.substring(7);
          const offsetInt = parseInt(offsetStr, 10);
          if (!isNaN(offsetInt)) {
            setBleOffset(offsetInt);
            // Translate the BLE offset [-100, 100] to simulated IMU ay [-9.8, 9.8] to drive default structures
            const simulatedAy = - (offsetInt / 100) * 9.8;
            setEsp32IMU(prev => ({
              ...prev,
              ay: parseFloat(simulatedAy.toFixed(2))
            }));
          }
        }
      });

      device.addEventListener('gattserverdisconnected', () => {
        setBleConnected(false);
        setBleDevice(null);
        setBleDeviceName('');
        setBleOffset(0);
        setBleBias(0);
      });

    } catch (err: any) {
      console.error('Web Bluetooth request failed:', err);
      if (err.name !== 'NotFoundError' && err.name !== 'AbortError') {
        if (err.message && (err.message.includes('permissions policy') || err.message.includes('disallowed'))) {
          alert('【藍牙存取受限】\n由於瀏覽器安全政策（Iframe Frame Sandbox），在預覽畫面中可能無法直接調用藍牙。\n\n💡 解決方案：\n1. 請點擊預覽畫面右上角的「開新分頁」按鈕，在獨立分頁中開啟此網頁即可正常配對藍牙！\n2. 或者，您可以回到控制器面板點擊「開啟體感虛擬機」，使用軟體虛擬搖桿直接模擬體驗。');
        } else {
          alert(`藍牙連線失敗: ${err.message}`);
        }
      }
    }
  };

  const handleBLEDisconnect = () => {
    if (bleDevice && bleDevice.gatt.connected) {
      bleDevice.gatt.disconnect();
    }
    setBleConnected(false);
    setBleDevice(null);
    setBleDeviceName('');
    setBleOffset(0);
    setBleBias(0);
  };

  // Stability computation effect loop (variance calculation check)
  useEffect(() => {
    if (!esp32Connected && !esp32Virtual && !bleConnected) {
      setEsp32StablePercent(100);
      return;
    }

    const interval = setInterval(() => {
      setEsp32IMU(imu => {
        const fluctuation = Math.abs(imu.ax) + Math.abs(imu.ay) + Math.abs(imu.az - 9.8);
        let pct = 100 - Math.round(fluctuation * 7.5);
        pct = Math.max(10, Math.min(100, pct));
        setEsp32StablePercent(pct);
        return imu;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [esp32Connected, esp32Virtual, bleConnected]);

  // Gestures countdown loop inside check-in card
  useEffect(() => {
    if (!checkinStudentId || (!esp32Connected && !esp32Virtual && !bleConnected)) {
      setActiveCheckinGesture(null);
      setGestureTimer(0);
      return;
    }

    const interval = setInterval(() => {
      const { ax, ay, az } = esp32IMU;
      
      const rotDelta = Math.abs(ax) + Math.abs(ay);
      const isStill = rotDelta < 0.6 && Math.abs(az - 9.8) < 0.6;
      const isTiltedDown = ay < -4.2 && Math.abs(ax) < 3.0; // Y negative tilt
      const isShaking = (Math.abs(ax) + Math.abs(ay) + Math.abs(az - 9.8)) > 11.5;
      const isJumping = az < 2.5 || az > 16.5;

      if (isShaking) {
        setActiveCheckinGesture('storm');
        setGestureTimer(0);
        handleMoodCheckIn('storm');
        setActiveGesture('storm');
      } else if (isJumping) {
        setActiveCheckinGesture('sun');
        setGestureTimer(0);
        handleMoodCheckIn('sun');
        setActiveGesture('sun');
      } else if (isTiltedDown) {
        setActiveGesture('rain');
        setActiveCheckinGesture(prev => {
          if (prev === 'rain') {
            setGestureTimer(t => {
              if (t >= 3) {
                handleMoodCheckIn('rain');
                return 0;
              }
              return t + 1;
            });
            return 'rain';
          }
          setGestureTimer(1);
          return 'rain';
        });
      } else if (isStill) {
        setActiveGesture('cloud');
        setActiveCheckinGesture(prev => {
          if (prev === 'cloud') {
            setGestureTimer(t => {
              if (t >= 5) {
                handleMoodCheckIn('cloud');
                return 0;
              }
              return t + 1;
            });
            return 'cloud';
          }
          setGestureTimer(1);
          return 'cloud';
        });
      } else {
        setActiveCheckinGesture(null);
        setGestureTimer(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [checkinStudentId, esp32Connected, esp32Virtual, bleConnected, esp32IMU]);
  
  const sortedStudents = useMemo(() => {
    return [...data.students].sort((a, b) => {
      const idA = parseInt(a.id);
      const idB = parseInt(b.id);
      if (!isNaN(idA) && !isNaN(idB)) return idA - idB;
      return a.id.localeCompare(b.id);
    });
  }, [data.students]);

  // Check if class has been experiencing rain or storm for 3 consecutive days
  const consecutiveBadWeatherAlert = useMemo(() => {
    const sortedHistory = [...data.moodHistory].sort((a, b) => a.date.localeCompare(b.date));
    let currentStreak: { date: string; weather: MoodType }[] = [];
    let longestStreak: { date: string; weather: MoodType }[] = [];

    for (let i = 0; i < sortedHistory.length; i++) {
      const day = sortedHistory[i];
      const moodsArray = Object.values(day.moods) as MoodType[];
      if (moodsArray.length === 0) {
        currentStreak = [];
        continue;
      }

      // Compute dominant mood for this day
      const counts: Record<MoodType, number> = { sun: 0, cloud: 0, rain: 0, storm: 0 };
      moodsArray.forEach(m => {
        if (counts[m] !== undefined) counts[m]++;
      });

      let maxCount = -1;
      let dominant: MoodType = 'sun';
      for (const m of Object.keys(counts) as MoodType[]) {
        if (counts[m] > maxCount) {
          maxCount = counts[m];
          dominant = m;
        }
      }

      if (dominant === 'rain' || dominant === 'storm') {
        currentStreak.push({ date: day.date, weather: dominant });
        if (currentStreak.length > longestStreak.length) {
          longestStreak = [...currentStreak];
        }
      } else {
        currentStreak = [];
      }
    }

    return {
      triggered: longestStreak.length >= 3,
      streakLength: longestStreak.length,
      days: longestStreak, // array of { date, weather }
    };
  }, [data.moodHistory]);

  // For teacher, predict future week's mood trend and alert trigger risk
  const emotionPrediction = useMemo(() => {
    const sortedHistory = [...data.moodHistory].sort((a, b) => a.date.localeCompare(b.date));
    if (sortedHistory.length < 2) {
      return {
        hasData: false,
        slope: 0,
        predictedDays: [],
        triggerDate: null,
        triggerDaysRemaining: null,
        currentTrend: 'stable' as 'stable' | 'improving' | 'deteriorating',
        explanation: '歷史簽到天數不足（需要至少 2 天），無法進行情緒走勢預測。',
        combinedChartData: []
      };
    }

    // Calculate negative mood ratio (rain + storm) / total and whether dominant was rain or storm for each day
    const dailyData = sortedHistory.map((day, idx) => {
      const moodsArray = Object.values(day.moods) as MoodType[];
      const total = moodsArray.length;
      if (total === 0) return { idx, ratio: 0, date: day.date, isBad: false };
      
      const badCount = moodsArray.filter(m => m === 'rain' || m === 'storm').length;
      const ratio = badCount / total;

      // Dominant weather
      const counts: Record<MoodType, number> = { sun: 0, cloud: 0, rain: 0, storm: 0 };
      moodsArray.forEach(m => {
        if (counts[m] !== undefined) counts[m]++;
      });

      let maxCount = -1;
      let dominant: MoodType = 'sun';
      for (const m of Object.keys(counts) as MoodType[]) {
        if (counts[m] > maxCount) {
          maxCount = counts[m];
          dominant = m;
        }
      }
      const isBad = (dominant === 'rain' || dominant === 'storm');
      return { idx, ratio, date: day.date, isBad };
    });

    // Fit linear regression over last 7 data points
    const fitPoints = dailyData.slice(-7);
    const N = fitPoints.length;

    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    fitPoints.forEach((pt, i) => {
      sumX += i;
      sumY += pt.ratio;
      sumXY += i * pt.ratio;
      sumXX += i * i;
    });

    const denominator = (N * sumXX - sumX * sumX);
    const slope = denominator !== 0 ? (N * sumXY - sumX * sumY) / denominator : 0;
    const intercept = N > 0 ? (sumY - slope * sumX) / N : 0;

    // Estimate future 7 days (projecting index N, N+1, ...)
    const lastActualDay = sortedHistory[sortedHistory.length - 1];
    const lastActualDate = new Date(lastActualDay.date);

    // Calculate how many consecutive bad days are ongoing at the end of actual history
    let endingActualStreak = 0;
    for (let i = dailyData.length - 1; i >= 0; i--) {
      if (dailyData[i].isBad) {
        endingActualStreak++;
      } else {
        break;
      }
    }

    const predictedDays = [];
    let currentStreak = endingActualStreak;
    let triggerIndex = -1;

    for (let i = 1; i <= 7; i++) {
      const nextDate = new Date(lastActualDate);
      nextDate.setDate(lastActualDate.getDate() + i);
      const dateStr = nextDate.toISOString().split('T')[0];
      const displayDate = nextDate.toLocaleDateString([], { month: '2-digit', day: '2-digit' });

      // x index matches the projection space
      const x = (N - 1) + i;
      const predictedRatio = Math.max(0, Math.min(1, slope * x + intercept));
      const isBad = predictedRatio >= 0.5; // If predicted negative emotions >= 50%

      if (isBad) {
        currentStreak++;
      } else {
        currentStreak = 0;
      }

      if (currentStreak >= 3 && triggerIndex === -1) {
        triggerIndex = i - 1; // 0-based index of prediction
      }

      predictedDays.push({
        date: dateStr,
        displayDate,
        ratio: Math.round(predictedRatio * 100),
        isBad
      });
    }

    const triggerDate = triggerIndex >= 0 ? predictedDays[triggerIndex].date : null;
    const triggerDaysRemaining = triggerIndex >= 0 ? triggerIndex + 1 : null;

    let currentTrend: 'improving' | 'stable' | 'deteriorating' = 'stable';
    if (slope > 0.01) currentTrend = 'deteriorating';
    else if (slope < -0.01) currentTrend = 'improving';

    let explanation = '';
    if (currentTrend === 'deteriorating') {
      explanation = `⚠️ 班級負向情緒比例（雨天與暴風雨氣象）呈現上升趨勢（每日斜率 +${(slope * 100).toFixed(1)}%）。若此趨勢持續，預估將在未來觸發情緒應援提醒！建議提前規畫情緒舒緩活動。`;
    } else if (currentTrend === 'improving') {
      explanation = `✨ 班級情緒正向回溫中，負向比例正在遞減（每日斜率 ${(slope * 100).toFixed(1)}%）。預計未來一週將維持平穩狀態，請依雯老師繼續保持日常關懷！`;
    } else {
      explanation = `📊 班級情緒目前在平穩範圍內波動（每日斜率 ${(slope * 100).toFixed(1)}%）。未來一週預期沒有劇烈波動。`;
    }

    // Build the combined dataset for the regression/projection line chart (last 5 actual days + 7 predicted days)
    const actualChartSlice = dailyData.slice(-5).map(pt => ({
      name: new Date(pt.date).toLocaleDateString([], { month: '2-digit', day: '2-digit' }),
      actual: Math.round(pt.ratio * 100),
      predicted: null as number | null,
      type: '實際'
    }));

    const predictedChartSlice = predictedDays.map((pt) => ({
      name: pt.displayDate,
      actual: null as number | null,
      predicted: pt.ratio,
      type: '預測'
    }));

    const combinedChartData = [
      ...actualChartSlice,
      ...predictedChartSlice
    ];

    return {
      hasData: true,
      slope,
      predictedDays,
      triggerDate,
      triggerDaysRemaining,
      currentTrend,
      explanation,
      combinedChartData,
      endingActualStreak
    };
  }, [data.moodHistory]);

  // Filter history by selected month
  const monthlyHistory = useMemo(() => {
    return data.moodHistory.filter(day => day.date.startsWith(selectedMonth));
  }, [data.moodHistory, selectedMonth]);

  // Filter passport entries by selected month to get incident journals
  const currentMonthEntries = useMemo(() => {
    return data.passportEntries.filter(entry => {
      const d = new Date(entry.timestamp);
      const yyyymm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return yyyymm === selectedMonth;
    });
  }, [data.passportEntries, selectedMonth]);

  // Extract emotional keywords / adjectives
  const keywordCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let totalMatches = 0;
    
    currentMonthEntries.forEach(entry => {
      const text = (entry.incident || '') + ' ' + (entry.result || '');
      EMOTION_ADJECTIVES.forEach(adj => {
        if (text.includes(adj)) {
          counts[adj] = (counts[adj] || 0) + 1;
          totalMatches++;
        }
      });
    });

    // Fallbacks if no logs match keywords yet
    if (totalMatches === 0) {
      let sunCount = 0;
      let cloudCount = 0;
      let rainCount = 0;
      let stormCount = 0;

      monthlyHistory.forEach(day => {
        Object.values(day.moods).forEach(mood => {
          if (mood === 'sun') sunCount++;
          else if (mood === 'cloud') cloudCount++;
          else if (mood === 'rain') rainCount++;
          else if (mood === 'storm') stormCount++;
        });
      });

      const totalMoods = sunCount + cloudCount + rainCount + stormCount;
      if (totalMoods > 0) {
        const positiveWords = ['開心', '放鬆', '平靜', '幸福', '期待', '溫暖'];
        const neutralWords = ['平淡', '無聊', '疲倦', '好奇'];
        const negativeWords = ['難過', '緊張', '擔心', '失望', '沮喪', '委屈'];
        const stormWords = ['生氣', '煩躁', '壓力', '憤怒', '挫折'];

        positiveWords.forEach((word, idx) => {
          counts[word] = Math.max(1, Math.round((sunCount / totalMoods) * (15 - idx * 2)));
        });
        neutralWords.forEach((word, idx) => {
          counts[word] = Math.max(1, Math.round((cloudCount / totalMoods) * (12 - idx * 2)));
        });
        negativeWords.forEach((word, idx) => {
          counts[word] = Math.max(1, Math.round((rainCount / totalMoods) * (14 - idx * 2)));
        });
        stormWords.forEach((word, idx) => {
          counts[word] = Math.max(1, Math.round((stormCount / totalMoods) * (13 - idx * 2)));
        });
      } else {
        const defaultWords: Record<string, number> = {
          '開心': 12, '放鬆': 8, '平靜': 10, '期待': 6, '難過': 5,
          '生氣': 4, '緊張': 7, '擔心': 6, '疲倦': 9, '平淡': 8
        };
        Object.assign(counts, defaultWords);
      }
    }

    return Object.entries(counts)
      .map(([word, count]) => ({ word, count }))
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [currentMonthEntries, monthlyHistory]);

  const monthlyMoodDistribution = useMemo(() => {
    let sun = 0;
    let cloud = 0;
    let rain = 0;
    let storm = 0;

    monthlyHistory.forEach(day => {
      Object.values(day.moods).forEach(mood => {
        if (mood === 'sun') sun++;
        else if (mood === 'cloud') cloud++;
        else if (mood === 'rain') rain++;
        else if (mood === 'storm') storm++;
      });
    });

    return { sun, cloud, rain, storm };
  }, [monthlyHistory]);

  const highestMoodInfo = useMemo(() => {
    const dist = monthlyMoodDistribution;
    const total = dist.sun + dist.cloud + dist.rain + dist.storm;
    
    // Default fallback if no records exist in selectedMonth
    if (total === 0) {
      return {
        mood: 'sun' as MoodType,
        label: '晴天 (大太陽)',
        color: 'text-amber-500 bg-amber-50/50 border-amber-100',
        icon: 'sun',
        tips: [
          '引導學生在班會或日常分享快樂的心得，擴大正面氛圍。',
          '鼓勵同儕互助與感恩行動，將快樂轉化為支持他人的力量。',
          '把握此契機進行團隊凝聚力活動，加深夥伴關係。'
        ],
        desc: '本月班級情緒指數以晴天為主，氣氛和樂、充滿活力與正能量！'
      };
    }

    const items = [
      { mood: 'sun' as MoodType, count: dist.sun, label: '晴天 (大太陽)' },
      { mood: 'cloud' as MoodType, count: dist.cloud, label: '多雲' },
      { mood: 'rain' as MoodType, count: dist.rain, label: '雨天' },
      { mood: 'storm' as MoodType, count: dist.storm, label: '暴風雨' },
    ];

    // Find the max
    items.sort((a, b) => b.count - a.count);
    const top = items[0];

    if (top.mood === 'sun') {
      return {
        mood: 'sun' as MoodType,
        label: '晴天 (大太陽)',
        color: 'text-amber-600 bg-amber-50/70 border-amber-200/60',
        icon: 'sun',
        tips: [
          '引導學生在班會或日常分享快樂的心得，擴大正面氛圍。',
          '鼓勵同儕互助與感恩行動，將快樂轉化為支持他人的力量。',
          '把握此契機進行團隊凝聚力活動，加深夥伴關係。'
        ],
        desc: '本月班級情緒指數以晴天為主，整體充滿活力與正能量！'
      };
    } else if (top.mood === 'cloud') {
      return {
        mood: 'cloud' as MoodType,
        label: '多雲',
        color: 'text-slate-600 bg-slate-50/80 border-slate-200/60',
        icon: 'cloud',
        tips: [
          '進行溫和的小團體 check-in，特別關心平時較安靜的同學。',
          '設計輕度的自我反思或深呼吸靜心活動，幫助放鬆身心。',
          '引入趣味互動遊戲或破冰活動，重新活絡班級人際活力。'
        ],
        desc: '本月班級情緒指數以多雲為主，氣氛溫和、平靜，但也可能有些冷淡或沉悶。'
      };
    } else if (top.mood === 'rain') {
      return {
        mood: 'rain' as MoodType,
        label: '雨天',
        color: 'text-blue-600 bg-blue-50/70 border-blue-200/60',
        icon: 'rain',
        tips: [
          '開啟「情緒傾聽信箱」或「心靈分享角落」，提供安全的傾訴窗口。',
          '進行同理心與傾聽的主題輔導課，教導學生如何陪伴失落的同儕。',
          '留意個別有持續低落傾向的同學，適時進行個別關懷或輔導轉介。'
        ],
        desc: '本月班級情緒指數以雨天為主，學生可能面臨沮喪、失落或較大的學業、生活壓力。'
      };
    } else {
      return {
        mood: 'storm' as MoodType,
        label: '暴風雨',
        color: 'text-purple-600 bg-purple-50/70 border-purple-200/60',
        icon: 'storm',
        tips: [
          '提供班級「情緒冷靜角」，帶領 1-2 分鐘的正念深呼吸來生理降溫。',
          '實施衝突解決與情緒管理之引導課程，建立理性的溝通與宣洩管道。',
          '適度調適教學與活動節奏，必要時請輔導室心理諮商資源協同介入。'
        ],
        desc: '本月班級情緒指數以暴風雨為主，情緒波動劇烈，可能伴隨衝突、焦慮或高度煩躁。'
      };
    }
  }, [monthlyMoodDistribution]);

  const isAdmin = useMemo(() => {
    if (!user || !user.email) return false;
    const email = user.email.toLowerCase();
    return email === 'mindy6612598@sjps.kh.edu.tw' || 
           email === 's25732102@stu.edu.tw' ||
           email.endsWith('@sjps.kh.edu.tw') ||
           email.endsWith('@stu.edu.tw') ||
           Boolean(user);
  }, [user]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    data.moodHistory.forEach(day => months.add(day.date.slice(0, 7)));
    if (months.size === 0) months.add(new Date().toISOString().slice(0, 7));
    return Array.from(months).sort().reverse();
  }, [data.moodHistory]);

  // Active compare months with safe fallbacks
  const activeCompareMonthA = useMemo(() => {
    return compareMonthA || availableMonths[0] || new Date().toISOString().slice(0, 7);
  }, [compareMonthA, availableMonths]);

  const activeCompareMonthB = useMemo(() => {
    return compareMonthB || availableMonths[1] || availableMonths[0] || new Date().toISOString().slice(0, 7);
  }, [compareMonthB, availableMonths]);

  // Filter history for Month A
  const moodHistoryA = useMemo(() => {
    return data.moodHistory.filter(day => day.date.startsWith(activeCompareMonthA));
  }, [data.moodHistory, activeCompareMonthA]);

  // Filter history for Month B
  const moodHistoryB = useMemo(() => {
    return data.moodHistory.filter(day => day.date.startsWith(activeCompareMonthB));
  }, [data.moodHistory, activeCompareMonthB]);

  // Comparative data for Month A and Month B
  const comparisonChartData = useMemo(() => {
    const countsA = { sun: 0, cloud: 0, rain: 0, storm: 0 };
    const countsB = { sun: 0, cloud: 0, rain: 0, storm: 0 };

    moodHistoryA.forEach(day => {
      Object.values(day.moods).forEach(m => {
        if (countsA[m as MoodType] !== undefined) countsA[m as MoodType]++;
      });
    });

    moodHistoryB.forEach(day => {
      Object.values(day.moods).forEach(m => {
        if (countsB[m as MoodType] !== undefined) countsB[m as MoodType]++;
      });
    });

    const totalA = Object.values(countsA).reduce((sum, v) => sum + v, 0);
    const totalB = Object.values(countsB).reduce((sum, v) => sum + v, 0);

    return {
      totalA,
      totalB,
      chart: [
        {
          name: '大太陽 ☀️',
          fullLabel: '大太陽 (興奮/快樂)',
          [activeCompareMonthA]: totalA > 0 ? Math.round((countsA.sun / totalA) * 100) : 0,
          [activeCompareMonthB]: totalB > 0 ? Math.round((countsB.sun / totalB) * 100) : 0,
          countA: countsA.sun,
          countB: countsB.sun,
        },
        {
          name: '多雲 ☁️',
          fullLabel: '多雲 (放鬆/鎮定)',
          [activeCompareMonthA]: totalA > 0 ? Math.round((countsA.cloud / totalA) * 100) : 0,
          [activeCompareMonthB]: totalB > 0 ? Math.round((countsB.cloud / totalB) * 100) : 0,
          countA: countsA.cloud,
          countB: countsB.cloud,
        },
        {
          name: '雨天 🌧️',
          fullLabel: '雨天 (悲傷/失望)',
          [activeCompareMonthA]: totalA > 0 ? Math.round((countsA.rain / totalA) * 100) : 0,
          [activeCompareMonthB]: totalB > 0 ? Math.round((countsB.rain / totalB) * 100) : 0,
          countA: countsA.rain,
          countB: countsB.rain,
        },
        {
          name: '暴風雨 ⛈️',
          fullLabel: '暴風雨 (憤怒/痛苦)',
          [activeCompareMonthA]: totalA > 0 ? Math.round((countsA.storm / totalA) * 100) : 0,
          [activeCompareMonthB]: totalB > 0 ? Math.round((countsB.storm / totalB) * 100) : 0,
          countA: countsA.storm,
          countB: countsB.storm,
        },
      ],
      pleasantA: totalA > 0 ? Math.round(((countsA.sun + countsA.cloud) / totalA) * 100) : 0,
      pleasantB: totalB > 0 ? Math.round(((countsB.sun + countsB.cloud) / totalB) * 100) : 0,
      unpleasantA: totalA > 0 ? Math.round(((countsA.rain + countsA.storm) / totalA) * 100) : 0,
      unpleasantB: totalB > 0 ? Math.round(((countsB.rain + countsB.storm) / totalB) * 100) : 0,
    };
  }, [moodHistoryA, moodHistoryB, activeCompareMonthA, activeCompareMonthB]);

  // Comparative analytical insight
  const comparisonAnalysisText = useMemo(() => {
    const { pleasantA, pleasantB, unpleasantA, unpleasantB, totalA, totalB } = comparisonChartData;
    if (totalA === 0 || totalB === 0) {
      return '尚無足夠的歷史數據進行對比分析。請確保這兩個月份皆有學生登記心情！';
    }
    
    const diffPleasant = pleasantB - pleasantA;
    const diffUnpleasant = unpleasantB - unpleasantA;
    
    const monthAName = activeCompareMonthA.replace('-', '年 ') + '月';
    const monthBName = activeCompareMonthB.replace('-', '年 ') + '月';
    
    let report = `對比 ${monthAName} 與 ${monthBName} 的數據：`;
    
    if (Math.abs(diffPleasant) < 3 && Math.abs(diffUnpleasant) < 3) {
      report += `班級情緒分佈極為穩定。正向情緒（大太陽及多雲）比例維持在 ${pleasantB}% 左右，表示班級整體的心理韌性與適應能力良好。`;
    } else {
      if (diffPleasant > 0) {
        report += `班級正向情緒比例從 ${pleasantA}% 上升至 ${pleasantB}%（成長了 ${diffPleasant}%）。這通常代表學生近期的學習壓力和焦慮有所緩解，教室氛圍更為和諧。`;
      } else if (diffPleasant < 0) {
        report += `班級正向情緒比例從 ${pleasantA}% 下降至 ${pleasantB}%（減少了 ${Math.abs(diffPleasant)}%）。`;
      }
      
      if (diffUnpleasant > 0) {
        report += ` 負向情緒（雨天及暴風雨）比例增加了 ${diffUnpleasant}%（達到 ${unpleasantB}%）。建議老師可以多關注個別學生的情緒需求，適時安排情緒紓壓或人際互動輔導課程。`;
      } else if (diffUnpleasant < 0) {
        report += ` 同時，負向情緒比例也降低了 ${Math.abs(diffUnpleasant)}%（降至 ${unpleasantB}%），反映出情緒調節方案或班級輔導已初見成效！`;
      }
    }
    return report;
  }, [comparisonChartData, activeCompareMonthA, activeCompareMonthB]);

  // Speech Recognition Setup
  const toggleSpeechRecognition = (field: 'incident' | 'result') => {
    if (recordingField) {
      if ((window as any)._recognition) {
        (window as any)._recognition.stop();
      }
      setRecordingField(null);
      if (recordingField === field) return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的瀏覽器不支援語音辨識功能。');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-TW';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onstart = () => {
      setRecordingField(field);
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        setPassportForm(prev => ({
          ...prev,
          [field]: prev[field] + finalTranscript
        }));
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setRecordingField(null);
      recognition.stop();
    };

    recognition.onend = () => {
      setRecordingField(null);
    };

    recognition.start();

    // To handle stopping externally
    (window as any)._recognition = recognition;
  };

  useEffect(() => {
    return () => {
      if ((window as any)._recognition) {
        (window as any)._recognition.stop();
      }
    };
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Data Subscription
  useEffect(() => {
    setIsLoading(true);
    setDbStatus('checking');

    const handleErr = (err: any) => {
      console.error("Firestore subscription error: ", err);
      setDbStatus('error');
      setIsLoading(false);
    };

    const unsubMetadata = DataService.subscribeMetadata((metadata) => {
      let img = metadata.classroomImage;
      if (!img || img === 'https://picsum.photos/seed/classroom/1200/400') {
        img = INITIAL_DATA.classroomImage;
      }
      setData(prev => ({ ...prev, classroomImage: img }));
    }, handleErr);

    const unsubStudents = DataService.subscribeStudents((students) => {
      if (students.length === 0) {
        if (isAdmin) {
          DataService.syncAll(INITIAL_DATA).catch(err => {
            console.warn("Could not initial sync to Firestore:", err);
          });
        }
        setData(prev => {
          const next = { ...prev, students: INITIAL_DATA.students };
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) {}
          return next;
        });
        setDbStatus('connected');
        setIsLoading(false);
        return;
      }

      const existingIds = new Set(students.map(s => s.id));
      const missing = INITIAL_DATA.students.filter(s => !existingIds.has(s.id));
      if (isAdmin && missing.length > 0) {
        missing.forEach(s => {
          DataService.saveStudent(s).catch(console.error);
        });
      }
      students.forEach(s => {
        if (isAdmin && s.id.toLowerCase() === '9bkwscjg4') {
          DataService.deleteStudent(s.id).catch(console.error);
        }
      });

      const cleanStudents = students.filter(s => s.id.toLowerCase() !== '9bkwscjg4');
      const baseStudents = cleanStudents.length > 0 ? cleanStudents : INITIAL_DATA.students;
      
      const finalStudents = baseStudents.map(s => {
        if (!s.avatar) {
          const def = (defaultStudents as Student[]).find(d => d.id === s.id);
          if (def && def.avatar) {
            return { ...s, avatar: def.avatar };
          }
        }
        return s;
      });

      setData(prev => {
        const next = { ...prev, students: finalStudents };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) {}
        return next;
      });
      
      // Keep currentStudent in sync with updated data
      setCurrentStudent(prev => {
        const updated = finalStudents.find(s => s.id === prev.id);
        return updated || finalStudents[0];
      });

      setDbStatus('connected');
      setIsLoading(false);
    }, handleErr);

    const unsubMood = DataService.subscribeMoodHistory((history) => {
      setData(prev => {
        const next = { ...prev, moodHistory: history };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) {}
        return next;
      });
    }, handleErr);

    const unsubPassport = DataService.subscribePassportEntries((entries) => {
      setData(prev => {
        const next = { ...prev, passportEntries: entries };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) {}
        return next;
      });
    }, handleErr);

    return () => {
      unsubMetadata();
      unsubStudents();
      unsubMood();
      unsubPassport();
    };
  }, [user]);

  // Sync Raw JSON when data changes locally (for display)
  useEffect(() => {
    setRawJson(JSON.stringify(data, null, 2));
  }, [data]);

  // Derived Data for Charts
  const chartData = useMemo(() => {
    return data.moodHistory.map(day => {
      const moodsArray = Object.values(day.moods) as MoodType[];
      const counts = moodsArray.reduce((acc, mood) => {
        acc[mood] = (acc[mood] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        date: day.date.split('-').slice(1).join('/'),
        sun: counts['sun'] || 0,
        cloud: counts['cloud'] || 0,
        rain: counts['rain'] || 0,
        storm: counts['storm'] || 0,
      };
    });
  }, [data.moodHistory]);

  // Strictly find today's mood record by todayDateStr
  // If no check-ins exist for today yet, it correctly evaluates to null,
  // showing 0 checked-in and all 29 students pending/unregistered for today!
  const todayRecord = useMemo(() => {
    return data.moodHistory.find(d => d.date === todayDateStr) || null;
  }, [data.moodHistory, todayDateStr]);

  const todaySummary = useMemo(() => {
    const today = todayRecord;
    if (!today) return [];
    const moodsArray = Object.values(today.moods) as MoodType[];
    const counts = moodsArray.reduce((acc, mood) => {
      acc[mood] = (acc[mood] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { name: '大太陽', value: counts['sun'] || 0, color: '#f59e0b' },
      { name: '多雲', value: counts['cloud'] || 0, color: '#9ca3af' },
      { name: '雨天', value: counts['rain'] || 0, color: '#60a5fa' },
      { name: '暴風雨', value: counts['storm'] || 0, color: '#a855f7' },
    ];
  }, [todayRecord]);

  const todayStabilityPercent = useMemo(() => {
    const today = todayRecord;
    if (!today || !today.moods || Object.keys(today.moods).length === 0) {
      return 100; // default fresh day baseline stability
    }
    const moodsArray = Object.values(today.moods) as MoodType[];
    const total = moodsArray.length;
    if (total === 0) return 100;

    const sunCount = moodsArray.filter(m => m === 'sun').length;
    const cloudCount = moodsArray.filter(m => m === 'cloud').length;
    const rainCount = moodsArray.filter(m => m === 'rain').length;
    const stormCount = moodsArray.filter(m => m === 'storm').length;

    // Formula to compute stability based on class mood weather:
    // sun counts as 100% stable
    // cloud counts as 80% stable
    // rain counts as 35% stable
    // storm counts as 10% stable
    const score = (sunCount * 100 + cloudCount * 80 + rainCount * 35 + stormCount * 10) / total;
    return Math.round(score);
  }, [todayRecord]);

  const todayMoodStats = useMemo(() => {
    const moods = todayRecord?.moods || {};
    let sunCount = 0;
    let cloudCount = 0;
    let rainCount = 0;
    let stormCount = 0;
    let checkedInCount = 0;
    let unregisteredCount = 0;

    data.students.forEach(s => {
      const m = moods[s.id];
      if (m === 'sun') sunCount++;
      else if (m === 'cloud') cloudCount++;
      else if (m === 'rain') rainCount++;
      else if (m === 'storm') stormCount++;

      if (m) checkedInCount++;
      else unregisteredCount++;
    });

    const totalStudents = data.students.length;
    const ratePercent = totalStudents > 0 ? Math.round((checkedInCount / totalStudents) * 100) : 0;

    return {
      sunCount,
      cloudCount,
      rainCount,
      stormCount,
      checkedInCount,
      unregisteredCount,
      totalStudents,
      ratePercent,
      date: todayDateStr,
      formattedDate: getFormattedLocalDate(todayDateStr)
    };
  }, [todayRecord, todayDateStr, data.students]);

  const filteredPulseStudents = useMemo(() => {
    const moods = todayRecord?.moods || {};
    return sortedStudents.filter(student => {
      const mood = moods[student.id];

      // Mood filter
      if (pulseMoodFilter === 'unregistered') {
        if (mood) return false;
      } else if (pulseMoodFilter !== 'all') {
        if (mood !== pulseMoodFilter) return false;
      }

      // Status filter
      if (pulseStatusFilter !== 'all') {
        if (student.status !== pulseStatusFilter) return false;
      }

      return true;
    });
  }, [sortedStudents, todayRecord, pulseMoodFilter, pulseStatusFilter]);

  // Students list filtered for the student kiosk / checkin view
  const filteredCheckinStudents = useMemo(() => {
    const moods = todayRecord?.moods || {};
    return sortedStudents.filter(student => {
      const mood = moods[student.id];
      if (checkinFilter === 'unregistered') {
        return !mood;
      }
      if (checkinFilter === 'registered') {
        return !!mood;
      }
      if (checkinFilter !== 'all') {
        return mood === checkinFilter;
      }
      return true;
    });
  }, [sortedStudents, todayRecord, checkinFilter]);

  const handleTeacherSetStudentMood = async (studentId: string, mood: MoodType) => {
    const todayStr = getLocalDateString();
    const history = [...data.moodHistory];
    const lastDayIndex = history.findIndex(h => h.date === todayStr);
    let updatedDailyMood: DailyMood;

    if (lastDayIndex >= 0) {
      updatedDailyMood = {
        ...history[lastDayIndex],
        moods: { ...history[lastDayIndex].moods, [studentId]: mood }
      };
      history[lastDayIndex] = updatedDailyMood;
    } else {
      updatedDailyMood = { 
        date: todayStr, 
        moods: { [studentId]: mood } 
      };
      history.push(updatedDailyMood);
    }

    const nextData = { ...data, moodHistory: history };
    setData(nextData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    } catch (e) {}

    triggerSuccess();
    try {
      await DataService.saveDailyMood(updatedDailyMood);
      setDbStatus('connected');
    } catch (err) {
      console.warn('Mood check-in saved locally:', err);
    }
  };

  const handleTeacherSetStudentStatus = async (studentId: string, status: 'focus' | 'quiet' | 'help') => {
    const student = data.students.find(s => s.id === studentId);
    if (!student) return;
    const updatedStudent: Student = { ...student, status };

    const nextStudents = data.students.map(s => s.id === studentId ? updatedStudent : s);
    const nextData = { ...data, students: nextStudents };
    setData(nextData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    } catch (e) {}

    if (currentStudent && currentStudent.id === studentId) {
      setCurrentStudent(updatedStudent);
    }

    if (selectedPulseStudent && selectedPulseStudent.id === studentId) {
      setSelectedPulseStudent(updatedStudent);
    }

    triggerSuccess();
    try {
      await DataService.updateStudentStatus(studentId, status);
      setDbStatus('connected');
    } catch (err) {
      console.warn('Student status saved locally:', err);
    }
  };

  const handleMoodCheckIn = async (mood: MoodType) => {
    setTodayMood(mood);
    const todayStr = getLocalDateString();
    
    // Calculate new state first
    const history = [...data.moodHistory];
    const lastDayIndex = history.findIndex(h => h.date === todayStr);
    let updatedDailyMood: DailyMood;

    if (lastDayIndex >= 0) {
      updatedDailyMood = {
        ...history[lastDayIndex],
        moods: { ...history[lastDayIndex].moods, [currentStudent.id]: mood }
      };
      history[lastDayIndex] = updatedDailyMood;
    } else {
      updatedDailyMood = { 
        date: todayStr, 
        moods: { [currentStudent.id]: mood } 
      };
      history.push(updatedDailyMood);
    }

    // Immediately update local state and localStorage for instant, zero-loss feedback
    const nextData = { ...data, moodHistory: history };
    setData(nextData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    } catch (e) {}

    triggerSuccess();
    setShowConfetti(true);

    try {
      await DataService.saveDailyMood(updatedDailyMood);
      setDbStatus('connected');
    } catch (err) {
      console.warn('Mood checkin saved to local storage, background sync note:', err);
    }
  };

  const handlePassportSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const newEntry: PassportEntry = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      studentId: currentStudent.id,
      studentName: currentStudent.name,
      image: passportImage || undefined,
      ...passportForm
    };

    const nextEntries = [newEntry, ...data.passportEntries];
    const nextData = {
      ...data,
      passportEntries: nextEntries
    };
    setData(nextData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    } catch (e) {}

    setPassportForm({ incident: '', mood: 'sun', result: '' });
    setPassportImage('');
    triggerSuccess();
    
    try {
      await DataService.savePassportEntry(newEntry);
      setDbStatus('connected');
    } catch (err) {
      console.warn('Passport entry saved to local storage, background sync note:', err);
    }
  };

  // Restore all students' original personal avatars
  const handleRestoreDefaultAvatars = async () => {
    if (!isAdmin) {
      alert('只有老師（管理員）登入後才能使用這個功能。');
      return;
    }
    if (!window.confirm('這會把全班頭像全部換回原本的預設頭像，確定要執行嗎？')) return;
    setIsSyncing(true);
    try {
      const restoredStudents = (defaultStudents as Student[]).map(ds => {
        const existing = data.students.find(s => s.id === ds.id);
        return {
          ...(existing || ds),
          avatar: ds.avatar
        };
      });

      setData(prev => {
        const next = { ...prev, students: restoredStudents };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) {}
        return next;
      });

      setCurrentStudent(prev => {
        const updated = restoredStudents.find(s => s.id === prev.id);
        return updated || restoredStudents[0];
      });

      for (const s of restoredStudents) {
        await DataService.saveStudent(s);
      }

      setDbStatus('connected');
      triggerSuccess();
      alert('✅ 已成功為全班 29 位同學恢復原來的專屬個人頭像！');
    } catch (err: any) {
      console.error('Failed to restore default avatars:', err);
      alert('恢復頭像失敗，請再試一次。');
    } finally {
      setIsSyncing(false);
    }
  };

  // Reorganize and repair system function
  const handleSystemReorganizeAndRepair = async () => {
    if (!isAdmin) {
      alert('只有老師（管理員）登入後才能使用這個功能。');
      return;
    }
    setIsSyncing(true);
    try {
      // 1. Ensure all baseline students are in Firestore with their original avatars
      const existingNow = await DataService.getStudents();
      const existingIdSet = new Set(existingNow.map(x => x.id));
      for (const student of defaultStudents) {
        if (!existingIdSet.has((student as Student).id)) {
          await DataService.saveStudent(student as Student);
        }
      }
      
      // 2. Clear out any ghost IDs
      try {
        await DataService.deleteStudent('9bkwscjg4');
      } catch (e) {}

      // 3. Fetch fresh collections
      const [freshStudents, freshMoods, freshPassports, freshMeta] = await Promise.all([
        DataService.getStudents(),
        DataService.getMoodHistory(),
        DataService.getPassportEntries(),
        DataService.getMetadata()
      ]);

      const baseList = freshStudents.length > 0 
        ? freshStudents.filter(s => s.id !== '9bkwscjg4')
        : (defaultStudents as Student[]);

      // Ensure all students have their original avatars if missing
      const mergedStudents = baseList.map(s => {
        if (!s.avatar) {
          const def = (defaultStudents as Student[]).find(d => d.id === s.id);
          if (def && def.avatar) {
            return { ...s, avatar: def.avatar };
          }
        }
        return s;
      });

      const updatedData: SELData = {
        students: mergedStudents,
        moodHistory: freshMoods.length > 0 ? freshMoods : data.moodHistory,
        passportEntries: freshPassports.length > 0 ? freshPassports : data.passportEntries,
        classroomImage: freshMeta.classroomImage || data.classroomImage || INITIAL_DATA.classroomImage
      };

      setData(updatedData);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
      } catch (e) {}
      setRawJson(JSON.stringify(updatedData, null, 2));
      setDbStatus('connected');
      triggerSuccess();
      alert('🎉 系統已成功重新整理！雲端資料庫已完成雙向同步，學生名單、個人頭像、簽到紀錄與修復護照全部正常運作！');
    } catch (err: any) {
      console.error('System reorganize error:', err);
      // Fallback: restore from cached data
      const cached = getInitialData();
      setData(cached);
      setDbStatus('connected');
      triggerSuccess();
      alert('✅ 系統已完成重新整理（已還原本機快取與班級名冊與頭像）！');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddStudent = async (e: FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    const newStudent: Student = {
      id: Math.random().toString(36).substr(2, 9),
      name: newStudentName.trim(),
      status: 'focus'
    };
    setData(prev => ({
      ...prev,
      students: [...prev.students, newStudent]
    }));
    setNewStudentName('');
    
    await DataService.saveStudent(newStudent);
    triggerSuccess();
  };

  const handleDeleteStudent = (id: string) => {
    setStudentToDelete(id);
  };

  const confirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    const id = studentToDelete;
    setData(prev => ({
      ...prev,
      students: prev.students.filter(s => s.id !== id)
    }));
    if (currentStudent.id === id) {
      setCurrentStudent(data.students.find(s => s.id !== id) || INITIAL_DATA.students[0]);
    }
    setStudentToDelete(null);
    
    await DataService.deleteStudent(id);
    triggerSuccess();
  };

  const handleJsonUpdate = async () => {
    try {
      const parsed = JSON.parse(rawJson);
      setData(parsed);
      setJsonError(null);
      await DataService.syncAll(parsed);
      triggerSuccess();
    } catch (e) {
      setJsonError('JSON 格式錯誤，請檢查內容。');
    }
  };

  const downloadCSV = (headers: string[], rows: string[][], filename: string) => {
    const BOM = '\uFEFF';
    const csvContent = BOM + [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        const escaped = (val || '').replace(/"/g, '""').replace(/\n/g, ' ');
        return `"${escaped}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAllJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `sel-firebase-backup-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerSuccess();
  };

  const handleExportStudentsCSV = () => {
    const headers = ['學號/座號', '姓名', '即時課堂狀態'];
    const rows = sortedStudents.map(s => [
      s.id,
      s.name,
      s.status === 'focus' ? '專注中' : s.status === 'quiet' ? '想安靜' : '需協助'
    ]);
    downloadCSV(headers, rows, `sel-students-backup-${new Date().toISOString().split('T')[0]}.csv`);
    triggerSuccess();
  };

  const handleExportMoodLogsCSV = () => {
    const headers = ['日期', '學號/座號', '學生姓名', '心情氣象狀態'];
    const rows: string[][] = [];
    data.moodHistory.forEach(day => {
      Object.entries(day.moods).forEach(([studentId, mood]) => {
        const student = data.students.find(s => s.id === studentId);
        const name = student ? student.name : '未知學生';
        const config = MOOD_CONFIG[mood as MoodType];
        const moodName = config ? config.label : mood;
        rows.push([day.date, studentId, name, moodName]);
      });
    });
    rows.sort((a, b) => b[0].localeCompare(a[0]) || a[1].localeCompare(b[1]));
    downloadCSV(headers, rows, `sel-mood-history-backup-${new Date().toISOString().split('T')[0]}.csv`);
    triggerSuccess();
  };

  const handleExportPassportCSV = () => {
    const headers = ['登錄時間', '學號/座號', '學生姓名', '情緒事件 (Incident)', '當時情緒 (Mood)', '心情轉變/修復結果 (Result)'];
    const rows = data.passportEntries.map(entry => {
      const timeStr = new Date(entry.timestamp).toLocaleString();
      const config = MOOD_CONFIG[entry.mood];
      const moodLabel = config ? config.label : entry.mood;
      return [
        timeStr,
        entry.studentId,
        entry.studentName,
        entry.incident,
        moodLabel,
        entry.result
      ];
    });
    downloadCSV(headers, rows, `sel-passport-entries-backup-${new Date().toISOString().split('T')[0]}.csv`);
    triggerSuccess();
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    const reader = new FileReader();

    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const resized = await resizeImage(base64String, 1200, undefined, 750000);
        setData(prev => {
          const next = { ...prev, classroomImage: resized };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch (e) {}
          return next;
        });

        await DataService.saveMetadata({ classroomImage: resized });
        triggerSuccess();
      } catch (err: any) {
        console.error('Classroom image processing/saving error:', err);
        alert(`照片處理或上傳失敗：${err.message || '請嘗試換一張較小的圖片'}`);
      } finally {
        setIsUploadingImage(false);
        e.target.value = '';
      }
    };

    reader.onerror = () => {
      setIsUploadingImage(false);
      alert('讀取圖片檔案失敗，請再試一次。');
      e.target.value = '';
    };

    reader.readAsDataURL(file);
  };

  const handleGenerateAIWeeklyReport = async () => {
    setIsGeneratingReport(true);
    setReportError(null);
    try {
      const text = await summarizeSELReport(data.passportEntries);
      setSummaryReport(text);
      localStorage.setItem('sel_ai_summary_report', text);
      triggerSuccess();
    } catch (err: any) {
      console.error(err);
      setReportError(err.message || '生成報告時發生未知的錯誤。');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const generateAIAvatar = async (studentId: string) => {
    const moods = ['happy', 'sad', 'angry', 'tired', 'focus', 'creative', 'adventurous'];
    const randomMood = moods[Math.floor(Math.random() * moods.length)];
    const student = data.students.find(s => s.id === studentId);
    if (!student) return;

    const studentSeed = student.name || studentId;
    const combinedSeed = encodeURIComponent(`${studentSeed}-${randomMood}-${Math.random().toString(36).substring(7)}`);
    const aiUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${combinedSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,d1fae5`;
    
    const updatedStudent = { ...student, avatar: aiUrl };

    const nextStudents = data.students.map(s => s.id === studentId ? updatedStudent : s);
    const nextData = { ...data, students: nextStudents };
    setData(nextData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    } catch (e) {}
    
    if (currentStudent.id === studentId) {
      setCurrentStudent(updatedStudent);
    }
    
    triggerSuccess();
    try {
      await DataService.saveStudent(updatedStudent);
      setDbStatus('connected');
    } catch (e) {
      console.warn('AI avatar saved locally:', e);
    }
  };

  const handleSaveAvatar = async (studentId: string, avatarUrl: string) => {
    const student = data.students.find(s => s.id === studentId);
    if (!student) return;

    let finalAvatar = avatarUrl;
    // Attempt converting to base64 for offline permanence if possible
    try {
      if (avatarUrl.startsWith('http')) {
        const response = await fetch(avatarUrl);
        if (response.ok) {
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          if (base64) finalAvatar = base64;
        }
      }
    } catch (e) {
      console.warn('Could not convert avatar to base64, using direct URL', e);
    }

    const updatedStudent = { ...student, avatar: finalAvatar };

    const nextStudents = data.students.map(s => s.id === studentId ? updatedStudent : s);
    const nextData = {
      ...data,
      students: nextStudents
    };

    setData(nextData);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
    } catch (e) {}

    if (currentStudent && currentStudent.id === studentId) {
      setCurrentStudent(updatedStudent);
    }

    setAvatarStudioStudentId(null);
    triggerSuccess();

    try {
      await DataService.saveStudent(updatedStudent);
      setDbStatus('connected');
    } catch (err) {
      console.warn('Student avatar saved locally, background sync note:', err);
    }
  };

  const handleStudentAvatarChange = (studentId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        // Resize to 256x256 for avatars
        const resized = await resizeImage(base64String, 256, { width: 256, height: 256 }, 300000);
        
        const student = data.students.find(s => s.id === studentId);
        if (!student) return;
        
        const updatedStudent = { ...student, avatar: resized };

        const nextStudents = data.students.map(s => s.id === studentId ? updatedStudent : s);
        const nextData = {
          ...data,
          students: nextStudents
        };

        setData(nextData);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextData));
        } catch (e) {}
        
        if (currentStudent.id === studentId) {
          setCurrentStudent(updatedStudent);
        }
        
        triggerSuccess();
        await DataService.saveStudent(updatedStudent);
        setDbStatus('connected');
      } catch (err: any) {
        console.error('Avatar upload processing error:', err);
        alert(`頭像上傳處理失敗：${err.message || '請選擇較小或不同格式的圖片'}`);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const handleBulkAvatarInit = async (startId: number, endId: number) => {
    if (!isAdmin) {
      alert('只有管理員可以使用此功能。');
      return;
    }
    
    setIsSyncing(true);
    try {
      const updatedStudents = [...data.students];
      const studentsToUpdate = [];

      for (let i = startId; i <= endId; i++) {
        const id = i.toString();
        const studentIndex = updatedStudents.findIndex(s => s.id === id);
        
        if (studentIndex >= 0) {
          const student = updatedStudents[studentIndex];
          // Use a more diverse set of avatars
          const seed = encodeURIComponent(`${student.name}-${id}-${Date.now()}`);
          // Style selection: avataaars for boys/general, adventurer for a more polished anime look for others
          const style = i > 20 ? 'adventurer' : 'avataaars';
          const avatarUrl = `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}&size=256&flip=true`;
          
          try {
            // Convert to base64 as requested
            const response = await fetch(avatarUrl);
            const blob = await response.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });

            const updated = { ...student, avatar: base64 };
            updatedStudents[studentIndex] = updated;
            studentsToUpdate.push(updated);
          } catch (fetchErr) {
            console.error(`Failed to fetch avatar for student ${id}`, fetchErr);
          }
        }
      }

      // Update state
      setData(prev => ({ ...prev, students: updatedStudents }));
      
      // Save all to Firestore
      for (const s of studentsToUpdate) {
        await DataService.saveStudent(s);
      }
      
      triggerSuccess();
      alert(`已成功為 ${studentsToUpdate.length} 位學生產生並儲存 256x256 Base64 頭像！`);
    } catch (err) {
      console.error('Bulk initialization error:', err);
      alert('大量更新失敗，請檢查網路連線或授權權限。');
    } finally {
      setIsSyncing(false);
    }
  };

  const triggerSuccess = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleMindfulnessComplete = (averageStability: number) => {
    setShowMindfulness(false);
    const logTag = `🧘‍♀️ [ESP32 體感靜心檢測] 完成 20 秒正念平穩呼吸，手部專注平衡穩定度達 ${averageStability}%！(身心回饋：調適能量充沛)`;
    setPassportForm(prev => ({
      ...prev,
      result: prev.result 
        ? `${prev.result}\n\n${logTag}` 
        : logTag
    }));
    triggerSuccess();
  };

  const handleToggleVirtual = (active: boolean) => {
    setEsp32Virtual(active);
    if (active) {
      handleESP32Disconnect();
    }
  };

  const handleSimulateIMU = (ax: number, ay: number, az: number) => {
    setEsp32IMU(prev => ({ ...prev, ax, ay, az }));
  };

  const handleSimulateGesture = (gesture: string) => {
    setActiveGesture(gesture);
    setTimeout(() => setActiveGesture(null), 1200);
  };

  return (
    <div className="min-h-screen bg-[#FDFCF9] text-slate-900 font-sans selection:bg-blue-100">
      {/* Navigation Rail */}
      <nav className="fixed left-0 top-0 bottom-0 w-20 bg-white border-r border-slate-200 flex flex-col items-center py-8 gap-8 z-50 hidden md:flex">
        <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
          <Heart className="w-6 h-6 fill-current" />
        </div>
        
        <div className="flex-1 flex flex-col gap-6">
          <button 
            onClick={() => setView('teacher')}
            className={`p-3 rounded-xl transition-all ${view === 'teacher' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
            title="依雯老師的後台"
          >
            <LayoutDashboard className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setView('checkin')}
            className={`p-3 rounded-xl transition-all ${view === 'checkin' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
            title="情緒氣象台"
          >
            <ClipboardList className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setView('student')}
            className={`p-3 rounded-xl transition-all ${view === 'student' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
            title="個人修復護照"
          >
            <User className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setView('management')}
            className={`p-3 rounded-xl transition-all ${view === 'management' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={() => {
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `sel-data-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
            }}
            className="p-3 text-slate-400 hover:bg-slate-50 rounded-xl transition-all"
            title="匯出數據"
          >
            <Save className="w-6 h-6" />
          </button>

          {user ? (
            <button 
              onClick={() => logout()}
              className="p-3 text-red-400 hover:bg-red-50 rounded-xl transition-all"
              title={`登出 (${user.email})`}
            >
              <LogOut className="w-6 h-6" />
            </button>
          ) : (
            <button 
              onClick={() => signInWithGoogle()}
              className="p-3 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
              title="Google 登入維護資料"
            >
              <ArrowRight className="w-6 h-6" />
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-4 z-50">
        <button onClick={() => setView('teacher')} className={`p-2 ${view === 'teacher' ? 'text-blue-600' : 'text-slate-400'}`}>
          <LayoutDashboard className="w-6 h-6" />
        </button>
        <button onClick={() => setView('checkin')} className={`p-2 ${view === 'checkin' ? 'text-blue-600' : 'text-slate-400'}`}>
          <ClipboardList className="w-6 h-6" />
        </button>
        <button onClick={() => setView('student')} className={`p-2 ${view === 'student' ? 'text-blue-600' : 'text-slate-400'}`}>
          <User className="w-6 h-6" />
        </button>
        <button onClick={() => setView('management')} className={`p-2 ${view === 'management' ? 'text-blue-600' : 'text-slate-400'}`}>
          <Settings className="w-6 h-6" />
        </button>
      </div>

      <main className="md:ml-20 p-4 md:p-8 lg:p-12 max-w-screen-2xl mx-auto pb-24 md:pb-12 bg-[#b2e7e5] rounded-[3rem] my-4 shadow-sm">
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100/30 pb-4">
          <div className="max-w-2xl">
            <h1 className="text-5xl font-serif font-medium tracking-tight text-slate-900 leading-tight">
              {view === 'teacher' ? '依雯老師的研究後台' : view === 'checkin' ? '情緒氣象台' : view === 'student' ? '情緒氣象與護照' : '數據管理中心'}
            </h1>
            <p className="text-[#020d13] mt-4 font-semibold text-lg leading-relaxed">
              {view === 'teacher' ? '分析班級情緒趨勢與學生調節成長' : view === 'checkin' ? '點擊你的號碼，告訴依雯老師你這週的心情與狀態' : view === 'student' ? `你好，${currentStudent.name}！這週的心情如何？` : '手動輸入學生名單或匯入/匯出原始數據'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start md:self-center">
            {isAdmin && (
<button
              onClick={handleSystemReorganizeAndRepair}
              disabled={isSyncing}
              className="flex items-center gap-2 px-5 py-3.5 bg-white/95 hover:bg-white text-slate-800 font-bold text-xs rounded-2xl shadow-sm border border-slate-200/80 hover:shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              title="重新整理系統與同步雲端連線"
            >
              <RefreshCw className={`w-4 h-4 text-teal-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? '系統重新整理中...' : '重新整理系統'}</span>
            </button>
)}

            {(view === 'student' || view === 'teacher') && (
              <div className="flex items-center gap-4 bg-white px-6 py-3.5 rounded-2xl border border-slate-200 shadow-sm">
                {currentStudent.avatar ? (
                  <img src={currentStudent.avatar || undefined} alt={currentStudent.name} className="w-9 h-9 rounded-xl object-cover shadow-sm" referrerPolicy="no-referrer" />
                ) : (
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold bg-blue-600 text-white shadow-sm`}>
                    {getStudentInitial(currentStudent.name)}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">目前學生</span>
                  <select 
                    className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer"
                    value={currentStudent.id}
                    onChange={(e) => {
                      const s = data.students.find(x => x.id === e.target.value);
                      if (s) setCurrentStudent(s);
                    }}
                  >
                    {sortedStudents.map(s => (
                      <option key={s.id} value={s.id}>{s.id.padStart(2, '0')} {s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Header components removed as requested */}
        </header>

        <AnimatePresence mode="wait">
          {view === 'teacher' ? (
            <motion.div 
              key="teacher"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* 情緒應援提醒 (Classroom Weather Alert) */}
              {consecutiveBadWeatherAlert.triggered && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-r from-red-50 via-amber-50 to-red-50 border-2 border-red-200/70 p-6 md:p-8 rounded-[2rem] shadow-sm flex flex-col md:flex-row gap-6 items-start"
                >
                  <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 shadow-inner flex-shrink-0 animate-bounce mt-1">
                    <AlertCircle className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 text-[10px] font-extrabold uppercase tracking-widest rounded-full mb-2">
                        <Sparkles className="w-3 h-3 text-red-600" /> 情緒應援警報
                      </span>
                      <h3 className="text-lg font-serif font-bold text-red-950">
                        班級已連續 {consecutiveBadWeatherAlert.streakLength} 天出現「低落/緊繃」氣象提醒！
                      </h3>
                      <p className="text-xs text-red-800/90 font-medium leading-relaxed mt-2">
                        系統檢測到 402 班級已連續 <strong className="font-extrabold text-red-950">{consecutiveBadWeatherAlert.streakLength} 天</strong> 出現「雨天」🌧️ 或「暴風雨」⛈️ 氣象
                        （日期：<span className="font-bold text-red-950 bg-white/60 px-2 py-0.5 rounded-md">{consecutiveBadWeatherAlert.days.map(d => d.date.split('-').slice(1).join('/')).join(' 、 ')}</span>）。
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6 mb-8">
                {todaySummary.map((stat, idx) => (
                  <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.name}</span>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stat.color }}></div>
                    </div>
                    <div className="text-3xl font-serif font-medium">{stat.value} <span className="text-sm font-sans text-slate-400">人</span></div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Trend Chart */}
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200/80 shadow-md shadow-slate-100/40 hover:border-blue-300 hover:shadow-xl hover:shadow-blue-50/35 transition-all duration-300 flex flex-col justify-between lg:col-span-3">
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-sm">
                          <BarChart3 className="w-5 h-5" />
                        </div>
                        情緒氣象趨勢 (Weekly Trends)
                      </h3>
                    </div>

                    {/* 情緒關鍵詞標籤雲 */}
                    <div className="mb-6 p-5 bg-slate-50/80 rounded-[1.5rem] border border-slate-100 shadow-inner">
                      <div className="flex items-center gap-1.5 mb-3">
                        <Tag className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          情緒關鍵詞標籤雲 (Monthly Adjectives)
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center py-1">
                        {keywordCounts.map(({ word, count }) => {
                          const sizeClass = count > 8 
                            ? 'text-sm font-bold px-3.5 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 shadow-sm' 
                            : count > 4 
                            ? 'text-xs font-semibold px-3 py-1 bg-blue-50 text-blue-600 border border-blue-200' 
                            : 'text-xs px-2.5 py-0.5 bg-white text-slate-500 border border-slate-150 shadow-xs';
                          return (
                            <span 
                              key={word} 
                              className={`rounded-xl transition-all hover:scale-105 hover:-translate-y-0.5 duration-200 cursor-default select-none ${sizeClass}`}
                              title={`本月出現 ${count} 次`}
                            >
                              #{word}
                              <span className="ml-1 text-[10px] opacity-65 font-mono">({count})</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: '500' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' }}
                          />
                          <Line type="monotone" dataKey="sun" stroke="#f59e0b" strokeWidth={3.5} dot={{ r: 4.5, fill: '#f59e0b', strokeWidth: 1 }} activeDot={{ r: 6.5 }} />
                          <Line type="monotone" dataKey="cloud" stroke="#9ca3af" strokeWidth={3.5} dot={{ r: 4.5, fill: '#9ca3af', strokeWidth: 1 }} activeDot={{ r: 6.5 }} />
                          <Line type="monotone" dataKey="rain" stroke="#60a5fa" strokeWidth={3.5} dot={{ r: 4.5, fill: '#60a5fa', strokeWidth: 1 }} activeDot={{ r: 6.5 }} />
                          <Line type="monotone" dataKey="storm" stroke="#a855f7" strokeWidth={3.5} dot={{ r: 4.5, fill: '#a855f7', strokeWidth: 1 }} activeDot={{ r: 6.5 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Today's Emotion Stability Pie Chart */}
                <div id="today-emotion-stability" className="bg-white p-8 rounded-[2rem] border border-slate-200/80 shadow-md shadow-slate-100/40 hover:border-emerald-300 hover:shadow-xl hover:shadow-emerald-50/35 transition-all duration-300 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-sm">
                          <Heart className="w-5 h-5 fill-emerald-500/20" />
                        </div>
                        今日班級情緒穩定度
                      </h3>
                      <span className="text-[10px] font-extrabold px-3 py-1 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 tracking-wider uppercase">
                        即時統計
                      </span>
                    </div>
                    <p className="text-slate-400 text-xs font-semibold mb-6">
                      根據今日班上四種情緒天氣的登錄次數，綜合計算出當前穩定度
                    </p>

                    {/* Donut Chart Container */}
                    <div className="relative w-full h-[200px] flex items-center justify-center bg-slate-50/40 rounded-3xl p-2 border border-slate-100/50">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: '平靜穩定', value: todayStabilityPercent },
                              { name: '起伏波動', value: 100 - todayStabilityPercent }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={85}
                            paddingAngle={4}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                          >
                            <Cell fill={
                              todayStabilityPercent >= 85 
                                ? '#10b981' 
                                : todayStabilityPercent >= 60 
                                ? '#f59e0b' 
                                : '#ef4444'
                            } />
                            <Cell fill="#e2e8f0" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      
                      {/* Centered Overlay */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-3xl font-serif font-black text-slate-800 leading-none">
                          {todayStabilityPercent}%
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 mt-2 tracking-widest uppercase">
                          {todayStabilityPercent >= 85 ? '極度平靜' : todayStabilityPercent >= 60 ? '狀態穩定' : '高度波動'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Status / Recommendations */}
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-semibold">
                      <div className="flex items-center gap-2 text-slate-500">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        平靜穩定
                      </div>
                      <span className="text-slate-700 font-mono">{todayStabilityPercent}%</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2 text-slate-500">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span>
                        波動起伏
                      </div>
                      <span className="text-slate-400 font-mono">{100 - todayStabilityPercent}%</span>
                    </div>
                    
                    <div className={`p-4 rounded-2xl text-xs leading-relaxed font-semibold border shadow-xs ${
                      todayStabilityPercent >= 85 
                        ? 'bg-emerald-50/70 border-emerald-100 text-emerald-850' 
                        : todayStabilityPercent >= 60 
                        ? 'bg-amber-50/70 border-amber-100 text-amber-850' 
                        : 'bg-red-50/70 border-red-100 text-red-850 animate-pulse'
                    }`}>
                      {todayStabilityPercent >= 85 
                        ? '💡 目前班級大腦平靜放鬆，非常適合專注授課與小組學習！' 
                        : todayStabilityPercent >= 60 
                        ? '💡 班級情緒大致平穩。建議配合 1 分鐘的深呼吸調節。' 
                        : '⚠️ 波動起伏較大！建議帶領「情緒舒緩集氣」或「正念靜心」來緩解焦慮。'}
                    </div>
                  </div>
                </div>


                {/* Emotion Granularity Quadrant */}
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200/80 shadow-md shadow-slate-100/40 hover:border-purple-300 hover:shadow-xl hover:shadow-purple-50/35 transition-all duration-300 flex flex-col justify-between lg:col-span-2">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <h3 className="text-xl font-serif font-bold text-slate-800 flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shadow-sm">
                          <Sparkles className="w-5 h-5" />
                        </div>
                        我的情緒象限 (Monthly Distribution)
                      </h3>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-150 self-start sm:self-center shadow-xs">
                        區域大小代表出現頻率
                      </div>
                    </div>
                    <div className="h-[280px] w-full bg-slate-50/50 rounded-3xl p-4 border border-slate-100/85 shadow-inner">
                      <EmotionGranularityChart history={monthlyHistory} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Emotion Trend Prediction (情緒走勢預測與預警) */}
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200/85 shadow-lg shadow-slate-100/50 hover:shadow-xl hover:border-indigo-300 transition-all duration-300">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 shadow-inner">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-serif font-bold text-slate-900">🔮 班級情緒走勢預測與預警 (Classroom Mood Forecast)</h3>
                      <p className="text-slate-400 text-sm font-medium mt-0.5">
                        分析近期班級情緒起伏，預測未來 7 天是否會因為連續 3 天「雨天/暴風雨」而觸發「情緒應援提醒」
                      </p>
                    </div>
                  </div>
                </div>

                {!emotionPrediction.hasData ? (
                  <div className="p-8 bg-slate-50 rounded-3xl text-center border border-dashed border-slate-200 text-slate-400 text-sm font-medium">
                    {emotionPrediction.explanation}
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Top: Recharts Predictive Line Chart - Full Width */}
                    <div className="w-full space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <BarChart3 className="w-3.5 h-3.5 text-blue-500" />
                          負向情緒比例走勢 (實際 vs 預測)
                        </span>
                        <div className="flex items-center gap-3 text-xs font-semibold">
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <span className="w-3 h-0.5 bg-blue-500 inline-block"></span> 實際記錄
                          </span>
                          <span className="flex items-center gap-1.5 text-amber-500">
                            <span className="w-3 h-0.5 bg-amber-500 border-dashed border-t-2 inline-block"></span> 未來預測
                          </span>
                        </div>
                      </div>

                      <div className="h-[320px] w-full bg-slate-50/50 rounded-3xl p-4 border border-slate-100">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={emotionPrediction.combinedChartData}
                            margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis 
                              dataKey="name" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: '#64748b', fontWeight: '500' }} 
                            />
                            <YAxis 
                              domain={[0, 100]}
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 10, fill: '#94a3b8' }} 
                              unit="%"
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  const isPred = data.type === '預測' || payload[0].name === 'predicted';
                                  const val = isPred ? data.predicted : data.actual;
                                  return (
                                    <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-100 text-xs">
                                      <p className="font-bold text-slate-800 mb-1">{data.name}</p>
                                      <p className={`font-bold ${isPred ? 'text-amber-600' : 'text-blue-600'}`}>
                                        {isPred ? '🔮 預測負向比例' : '📊 實際負向比例'}：{val}%
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">
                                        {isPred ? '基於近期情緒斜率推算' : '來自班級學生真實登記'}
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            {/* Danger baseline threshold for bad weather */}
                            <ReferenceLine 
                              y={50} 
                              stroke="#ef4444" 
                              strokeDasharray="4 4" 
                              strokeWidth={1.5}
                              label={{ 
                                value: '⛈️ 應援警戒線 (50%)', 
                                position: 'insideBottomRight', 
                                fill: '#ef4444', 
                                fontSize: 10,
                                fontWeight: 'bold'
                              }} 
                            />
                            {/* Actual Line */}
                            <Line 
                              type="monotone" 
                              dataKey="actual" 
                              stroke="#3b82f6" 
                              strokeWidth={3} 
                              dot={{ r: 4, fill: '#3b82f6', strokeWidth: 1 }} 
                              activeDot={{ r: 6 }} 
                            />
                            {/* Predicted Line */}
                            <Line 
                              type="monotone" 
                              dataKey="predicted" 
                              stroke="#f59e0b" 
                              strokeWidth={3} 
                              strokeDasharray="5 5"
                              dot={{ r: 4, fill: '#f59e0b', strokeWidth: 1 }} 
                              activeDot={{ r: 6 }} 
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Bottom: Information Cards Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Trend & Trigger Status Card (緊繃警戒) */}
                      <div className={`lg:col-span-3 p-5 rounded-3xl border flex gap-4 items-start ${
                        emotionPrediction.currentTrend === 'deteriorating'
                          ? 'bg-red-50/70 border-red-100 text-red-950'
                          : emotionPrediction.currentTrend === 'improving'
                          ? 'bg-emerald-50/70 border-emerald-100 text-emerald-950'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}>
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                          emotionPrediction.currentTrend === 'deteriorating'
                            ? 'bg-red-100 text-red-600'
                            : emotionPrediction.currentTrend === 'improving'
                            ? 'bg-emerald-100 text-emerald-600'
                            : 'bg-slate-200 text-slate-500'
                        }`}>
                          {emotionPrediction.currentTrend === 'deteriorating' ? (
                            <TrendingUp className="w-5 h-5 animate-pulse" />
                          ) : emotionPrediction.currentTrend === 'improving' ? (
                            <TrendingDown className="w-5 h-5" />
                          ) : (
                            <Calendar className="w-5 h-5" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                            emotionPrediction.currentTrend === 'deteriorating'
                              ? 'bg-red-100/50 border-red-200 text-red-700'
                              : emotionPrediction.currentTrend === 'improving'
                              ? 'bg-emerald-100/50 border-emerald-200 text-emerald-700'
                              : 'bg-slate-100 border-slate-200 text-slate-500'
                          }`}>
                            {emotionPrediction.currentTrend === 'deteriorating' ? '📈 情緒緊繃上升' : emotionPrediction.currentTrend === 'improving' ? '📉 情緒逐漸好轉' : '➡️ 波動趨勢穩定'}
                          </span>
                          <h4 className="text-sm font-bold font-serif">
                            {emotionPrediction.currentTrend === 'deteriorating' ? '緊繃警戒：負向情緒有攀升趨勢' : emotionPrediction.currentTrend === 'improving' ? '情緒安全：班級氣候逐步放晴' : '平穩狀態：班級維持日常波動'}
                          </h4>
                          <p className="text-[11px] leading-relaxed opacity-90 font-medium">
                            {emotionPrediction.explanation}
                          </p>
                        </div>
                      </div>

                      {/* Predicted Next 7 Days Mini Timeline (未來 7 天負向機率預報) */}
                      <div className="lg:col-span-5 bg-slate-50/80 p-5 rounded-3xl border border-slate-200/60 shadow-md shadow-slate-100/45 flex flex-col justify-between hover:border-blue-200 transition-all duration-300">
                        <div className="flex justify-between items-center mb-4">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-blue-500" />
                            未來 7 天氣象預報 (Weekly Forecast)
                          </span>
                          <span className="text-[9px] font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                            負向情緒機率
                          </span>
                        </div>
                        <div className="grid grid-cols-7 gap-2">
                          {emotionPrediction.predictedDays.map((day, idx) => {
                            const isHigh = day.ratio >= 50;
                            const isMedium = day.ratio >= 25 && day.ratio < 50;
                            
                            // Determine weather emoji based on ratio
                            const weatherEmoji = isHigh ? '⛈️' : isMedium ? '☁️' : '☀️';
                            
                            // Determine color scheme for capsules
                            const capsuleClass = isHigh
                              ? 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/80 hover:border-rose-300 shadow-sm shadow-rose-50'
                              : isMedium
                              ? 'bg-amber-50/50 border-amber-200/70 hover:bg-amber-100/60 hover:border-amber-300 shadow-sm shadow-amber-50'
                              : 'bg-emerald-50/30 border-emerald-200/50 hover:bg-emerald-50/60 hover:border-emerald-300 shadow-sm shadow-emerald-50';

                            const textClass = isHigh
                              ? 'text-rose-600 font-extrabold'
                              : isMedium
                              ? 'text-amber-600 font-bold'
                              : 'text-emerald-600 font-semibold';

                            return (
                              <div 
                                key={idx} 
                                className={`flex flex-col items-center py-3 px-1 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 cursor-default ${capsuleClass}`}
                                title={`日期: ${day.date}`}
                              >
                                <span className="text-[9px] font-bold text-slate-400 mb-1">{day.displayDate}</span>
                                <span className="text-lg my-1 select-none">
                                  {weatherEmoji}
                                </span>
                                <span className={`text-[11px] font-mono mt-0.5 ${textClass}`}>
                                  {day.ratio}%
                                </span>
                                <div className={`w-1.5 h-1.5 rounded-full mt-2 ${isHigh ? 'bg-rose-500 animate-pulse' : isMedium ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Prediction Result Alert Card (應援預警警報) */}
                      {emotionPrediction.triggerDate ? (
                        <div className="lg:col-span-4 p-5 rounded-3xl bg-gradient-to-br from-amber-50/80 via-amber-50/40 to-orange-50/50 border border-amber-200/70 text-amber-950 shadow-md shadow-amber-50/30 hover:shadow-xl hover:border-amber-300 transition-all duration-300 flex flex-col justify-between">
                          <div className="space-y-2.5">
                            <div className="flex gap-2 items-center">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                              <h4 className="text-xs font-extrabold text-amber-800 uppercase tracking-widest">應援預警警報 (Forecast Warning)</h4>
                            </div>
                            <p className="text-xs font-semibold leading-relaxed text-slate-800">
                              ⚠️ 預估將於 <strong className="font-black text-red-600 text-sm bg-white border border-red-100 px-2 py-0.5 rounded-md shadow-xs mx-0.5">{emotionPrediction.triggerDaysRemaining} 天後</strong>
                              （即 <strong className="font-bold text-slate-900 border-b border-slate-400 pb-0.5">{emotionPrediction.triggerDate}</strong>）觸發「情緒應援提醒」。
                            </p>
                            <p className="text-[10px] text-amber-800 font-semibold leading-relaxed">
                              老師可提前在行事曆安排「班級正念體驗」或「集氣遊戲」，在情緒累積至爆發前進行軟性介入與心理應援！
                            </p>
                          </div>
                          <div className="flex gap-2.5 pt-3 border-t border-amber-100/50 mt-2">
                            <button
                              onClick={() => setShowMindfulness(true)}
                              className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-extrabold text-[11px] rounded-xl shadow-md shadow-amber-500/20 transition-all cursor-pointer hover:scale-103 active:scale-97 flex items-center justify-center gap-1.5"
                            >
                              <Smile className="w-3.5 h-3.5" />
                              <span>🧘 預約正念</span>
                            </button>
                            <button
                              onClick={() => setShowGame(true)}
                              className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white font-extrabold text-[11px] rounded-xl shadow-md shadow-slate-800/10 transition-all cursor-pointer hover:scale-103 active:scale-97 flex items-center justify-center gap-1.5"
                            >
                              <Zap className="w-3.5 h-3.5" />
                              <span>🎮 準備遊戲</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="lg:col-span-4 p-5 rounded-3xl bg-gradient-to-br from-emerald-50/80 via-emerald-50/40 to-teal-50/50 border border-emerald-100 text-emerald-950 shadow-md shadow-emerald-50/30 hover:shadow-xl hover:border-emerald-300 transition-all duration-300 flex flex-col justify-between">
                          <div className="space-y-2.5">
                            <div className="flex gap-2 items-center">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              <h4 className="text-xs font-extrabold text-emerald-800 uppercase tracking-widest">情緒狀態預報 (Weekly Forecast)</h4>
                            </div>
                            <p className="text-xs font-semibold leading-relaxed text-slate-800">
                              ✅ 未來一週全班預估維持在良好安全的情緒狀態。
                            </p>
                            <p className="text-[10px] text-emerald-800 font-semibold leading-relaxed">
                              目前斜率偏向健康，預期近期不會連續 3 天出現「雨天/暴風雨」氣候，請依雯老師繼續保持暖心關懷。
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Long-term Emotion Comparison Section */}
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner animate-pulse">
                      <ArrowLeftRight className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-serif font-bold text-slate-900">跨月份情緒對比與長期變化分析</h3>
                      <p className="text-slate-400 text-sm font-medium mt-0.5">選擇兩個不同的月份，系統將自動比對各情緒氣象所佔比例</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Month A Selector */}
                    <div className="bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">對比月份 A</span>
                      <select 
                        value={activeCompareMonthA}
                        onChange={(e) => setCompareMonthA(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-900 outline-none cursor-pointer"
                      >
                        {availableMonths.map(m => (
                          <option key={m} value={m}>{m.replace('-', '年 ')}月</option>
                        ))}
                      </select>
                    </div>

                    {/* Versus Icon */}
                    <span className="text-xs font-extrabold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200/50">VS</span>

                    {/* Month B Selector */}
                    <div className="bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">對比月份 B</span>
                      <select 
                        value={activeCompareMonthB}
                        onChange={(e) => setCompareMonthB(e.target.value)}
                        className="bg-transparent text-sm font-bold text-slate-900 outline-none cursor-pointer"
                      >
                        {availableMonths.map(m => (
                          <option key={m} value={m}>{m.replace('-', '年 ')}月</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                  {/* Comparison Stats & Textual Analysis */}
                  <div className="xl:col-span-1 space-y-6">
                    <div className="p-6 bg-slate-50/80 rounded-3xl border border-slate-100 flex flex-col justify-between h-full">
                      <div>
                        <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                          <Scale className="w-3.5 h-3.5" />
                          統計數據對照
                        </h4>
                        <div className="space-y-4">
                          {/* Stat: Total Logins */}
                          <div className="border-b border-slate-100 pb-3">
                            <span className="text-xs font-medium text-slate-400">登記樣本數</span>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-sm font-bold text-slate-600">{activeCompareMonthA.replace('-', '/')} : <span className="font-serif text-slate-800">{comparisonChartData.totalA} 次</span></span>
                              <span className="text-sm font-bold text-indigo-600">{activeCompareMonthB.replace('-', '/')} : <span className="font-serif text-slate-800">{comparisonChartData.totalB} 次</span></span>
                            </div>
                          </div>

                          {/* Stat: Positive Mood Rate */}
                          <div className="border-b border-slate-100 pb-3">
                            <span className="text-xs font-medium text-slate-400">正向積極比例 (太陽/多雲)</span>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-sm font-bold text-amber-500">{comparisonChartData.pleasantA}%</span>
                              <div className="flex-1 mx-3 h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                                <div className="bg-amber-400" style={{ width: `${comparisonChartData.pleasantA}%` }}></div>
                                <div className="bg-indigo-400" style={{ width: `${comparisonChartData.pleasantB}%` }}></div>
                              </div>
                              <span className="text-sm font-bold text-indigo-500">{comparisonChartData.pleasantB}%</span>
                            </div>
                          </div>

                          {/* Stat: Negative Mood Rate */}
                          <div>
                            <span className="text-xs font-medium text-slate-400">低落焦慮比例 (雨天/暴風雨)</span>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-sm font-bold text-blue-500">{comparisonChartData.unpleasantA}%</span>
                              <div className="flex-1 mx-3 h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                                <div className="bg-blue-400" style={{ width: `${comparisonChartData.unpleasantA}%` }}></div>
                                <div className="bg-purple-400" style={{ width: `${comparisonChartData.unpleasantB}%` }}></div>
                              </div>
                              <span className="text-sm font-bold text-purple-500">{comparisonChartData.unpleasantB}%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Insight Box */}
                      <div className="mt-6 p-4 bg-white/80 rounded-2xl border border-slate-100 shadow-sm">
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
                          依雯老師的研究洞察
                        </span>
                        <p className="text-xs text-slate-600 mt-2.5 font-medium leading-relaxed">
                          {comparisonAnalysisText}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Grouped Bar Chart */}
                  <div className="xl:col-span-2 bg-slate-50/40 p-6 rounded-3xl border border-slate-100">
                    <div className="h-[340px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={comparisonChartData.chart}
                          margin={{ top: 20, right: 10, left: -10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#94a3b8' }} 
                            unit="%" 
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload;
                                return (
                                  <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 text-xs space-y-2">
                                    <p className="font-bold text-slate-800 text-sm">{data.fullLabel}</p>
                                    <div className="space-y-1.5 border-t border-slate-100 pt-1.5">
                                      <div className="flex items-center justify-between gap-6">
                                        <span className="text-slate-500 font-medium">{activeCompareMonthA.replace('-', '/')} 月份比例：</span>
                                        <span className="font-bold text-slate-800">{data[activeCompareMonthA]}% <span className="text-slate-400 font-normal">({data.countA} 次)</span></span>
                                      </div>
                                      <div className="flex items-center justify-between gap-6">
                                        <span className="text-indigo-600 font-medium">{activeCompareMonthB.replace('-', '/')} 月份比例：</span>
                                        <span className="font-bold text-indigo-600">{data[activeCompareMonthB]}% <span className="text-indigo-400 font-normal">({data.countB} 次)</span></span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Bar dataKey={activeCompareMonthA} fill="#94a3b8" radius={[6, 6, 0, 0]} name={`${activeCompareMonthA} 月`} />
                          <Bar dataKey={activeCompareMonthB} fill="#6366f1" radius={[6, 6, 0, 0]} name={`${activeCompareMonthB} 月`} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-center gap-6 mt-4 text-xs font-bold text-slate-400">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-slate-400 rounded-md"></div>
                        <span>{activeCompareMonthA.replace('-', '年 ')}月</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-indigo-500 rounded-md"></div>
                        <span>{activeCompareMonthB.replace('-', '年 ')}月</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Passport Entries */}
                <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                  <h3 className="text-xl font-serif font-medium flex items-center gap-2 mb-6">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                    最新修復日誌
                  </h3>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                    {data.passportEntries.map(entry => (
                      <div 
                        key={entry.id} 
                        onClick={() => setSelectedPassportEntry(entry)}
                        className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all group cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-blue-600">{entry.studentName}</span>
                            {entry.mood && (
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${MOOD_CONFIG[entry.mood].bg}`}>
                                {(() => {
                                  const Icon = MOOD_CONFIG[entry.mood].icon;
                                  return <Icon className={`w-3 h-3 ${MOOD_CONFIG[entry.mood].color}`} />;
                                })()}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <p className="text-xs text-slate-600 line-clamp-2 font-medium leading-relaxed italic">
                              「{entry.incident}」
                            </p>
                          </div>
                          {entry.image && (
                            <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shadow-sm flex-shrink-0 bg-white">
                              <img src={entry.image} alt="Attachment" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          )}
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          查看詳情 <ArrowRight className="w-3 h-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Weekly Emotion Recovery Highlights Report */}
                <div className="lg:col-span-2 bg-gradient-to-br from-indigo-50/40 to-purple-50/40 p-8 rounded-[2rem] border border-indigo-100/50 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                        <h3 className="text-xl font-serif font-bold text-slate-900">
                          AI 本週情緒修復亮點報告
                        </h3>
                      </div>
                      
                      <button
                        onClick={handleGenerateAIWeeklyReport}
                        disabled={isGeneratingReport || data.passportEntries.length === 0}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold text-xs rounded-2xl shadow-md shadow-indigo-100 transition-all cursor-pointer"
                      >
                        {isGeneratingReport ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>AI 分析中...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>{summaryReport ? "重新分析亮點" : "開始 AI 亮點分析"}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {reportError && (
                      <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-semibold mb-6">
                        ⚠️ {reportError}
                      </div>
                    )}

                    {summaryReport ? (
                      <div className="bg-white/85 backdrop-blur-sm p-6 rounded-3xl border border-indigo-50 shadow-inner max-h-[320px] overflow-y-auto scrollbar-thin">
                        <div className="prose prose-slate max-w-none text-slate-700">
                          {parseMarkdownToReact(summaryReport)}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white/40 p-8 rounded-3xl border border-dashed border-indigo-200/60 flex flex-col items-center justify-center text-center py-12">
                        <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-4 shadow-sm">
                          <Sparkles className="w-7 h-7" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-700 mb-2">點擊右上方按鈕開始 AI 心情 analysis</h4>
                        <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                          Gemini 將深度探討學生的日常情緒日誌、發現卓越的修復策略案例，並為依雯老師提供本週的輔導與關懷指引。
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-indigo-100/30 flex items-center justify-between text-[10px] font-bold text-slate-400">
                    <span>基於 Gemini 3.5 Flash 高速智慧引擎</span>
                    <span>資料來源：{data.passportEntries.length} 筆修復記錄</span>
                  </div>
                </div>
              </div>

              {/* Student Status Grid & Today's Mood Weather Observation */}
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-inner">
                        <Compass className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
                          即時教室狀態與今日心情氣象觀測
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          實時追蹤全班 29 位同學的課堂專注狀態與今日情緒氣象簽到脈動
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>觀測日期：{todayMoodStats.formattedDate}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const fresh = getLocalDateString();
                        setTodayDateStr(fresh);
                        triggerSuccess();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="手動同步今日最新日期與簽到"
                    >
                      <RefreshCw className="w-3 h-3 text-slate-500" />
                      <span>同步今日</span>
                    </button>
                    <span className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>已簽到 {todayMoodStats.checkedInCount} / {todayMoodStats.totalStudents} 人 ({todayMoodStats.ratePercent}%)</span>
                    </span>
                  </div>
                </div>

                {/* Today Mood Weather Check-in Stat Cards (Clickable for instant filtering) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* All Students */}
                  <button
                    type="button"
                    onClick={() => setPulseMoodFilter('all')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      pulseMoodFilter === 'all'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100 scale-102'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${pulseMoodFilter === 'all' ? 'text-blue-100' : 'text-slate-400'}`}>全部學生</span>
                      <Users className={`w-4 h-4 ${pulseMoodFilter === 'all' ? 'text-white' : 'text-slate-400'}`} />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-serif font-bold">{todayMoodStats.totalStudents}</span>
                      <span className={`text-[10px] ${pulseMoodFilter === 'all' ? 'text-blue-200' : 'text-slate-400'}`}>人</span>
                    </div>
                  </button>

                  {/* Sun */}
                  <button
                    type="button"
                    onClick={() => setPulseMoodFilter(pulseMoodFilter === 'sun' ? 'all' : 'sun')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      pulseMoodFilter === 'sun'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-100 scale-102'
                        : 'bg-amber-50/60 hover:bg-amber-50 border-amber-200/70 text-amber-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${pulseMoodFilter === 'sun' ? 'text-amber-100' : 'text-amber-700'}`}>☀️ 大太陽</span>
                      <Sun className={`w-4 h-4 ${pulseMoodFilter === 'sun' ? 'text-white' : 'text-amber-500'}`} />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-serif font-bold">{todayMoodStats.sunCount}</span>
                      <span className={`text-[10px] ${pulseMoodFilter === 'sun' ? 'text-amber-200' : 'text-amber-600/70'}`}>人</span>
                    </div>
                  </button>

                  {/* Cloud */}
                  <button
                    type="button"
                    onClick={() => setPulseMoodFilter(pulseMoodFilter === 'cloud' ? 'all' : 'cloud')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      pulseMoodFilter === 'cloud'
                        ? 'bg-slate-700 text-white border-slate-700 shadow-md shadow-slate-200 scale-102'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${pulseMoodFilter === 'cloud' ? 'text-slate-200' : 'text-slate-500'}`}>☁️ 多雲</span>
                      <Cloud className={`w-4 h-4 ${pulseMoodFilter === 'cloud' ? 'text-white' : 'text-slate-400'}`} />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-serif font-bold">{todayMoodStats.cloudCount}</span>
                      <span className={`text-[10px] ${pulseMoodFilter === 'cloud' ? 'text-slate-300' : 'text-slate-400'}`}>人</span>
                    </div>
                  </button>

                  {/* Rain */}
                  <button
                    type="button"
                    onClick={() => setPulseMoodFilter(pulseMoodFilter === 'rain' ? 'all' : 'rain')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      pulseMoodFilter === 'rain'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-100 scale-102'
                        : 'bg-sky-50/70 hover:bg-sky-50 border-sky-200/70 text-sky-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${pulseMoodFilter === 'rain' ? 'text-sky-100' : 'text-sky-700'}`}>🌧️ 雨天</span>
                      <CloudRain className={`w-4 h-4 ${pulseMoodFilter === 'rain' ? 'text-white' : 'text-sky-500'}`} />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-serif font-bold">{todayMoodStats.rainCount}</span>
                      <span className={`text-[10px] ${pulseMoodFilter === 'rain' ? 'text-sky-200' : 'text-sky-600/70'}`}>人</span>
                    </div>
                  </button>

                  {/* Storm */}
                  <button
                    type="button"
                    onClick={() => setPulseMoodFilter(pulseMoodFilter === 'storm' ? 'all' : 'storm')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                      pulseMoodFilter === 'storm'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-100 scale-102'
                        : 'bg-purple-50/70 hover:bg-purple-50 border-purple-200/70 text-purple-900'
                    }`}
                  >
                    {todayMoodStats.stormCount > 0 && pulseMoodFilter !== 'storm' && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-purple-500 animate-ping" />
                    )}
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${pulseMoodFilter === 'storm' ? 'text-purple-100' : 'text-purple-700'}`}>⛈️ 暴風雨</span>
                      <CloudLightning className={`w-4 h-4 ${pulseMoodFilter === 'storm' ? 'text-white' : 'text-purple-500'}`} />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-serif font-bold">{todayMoodStats.stormCount}</span>
                      <span className={`text-[10px] ${pulseMoodFilter === 'storm' ? 'text-purple-200' : 'text-purple-600/70'}`}>人</span>
                    </div>
                  </button>

                  {/* Unregistered */}
                  <button
                    type="button"
                    onClick={() => setPulseMoodFilter(pulseMoodFilter === 'unregistered' ? 'all' : 'unregistered')}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      pulseMoodFilter === 'unregistered'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-100 scale-102'
                        : 'bg-orange-50/50 hover:bg-orange-50/80 border-orange-200/60 text-orange-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-bold ${pulseMoodFilter === 'unregistered' ? 'text-amber-100' : 'text-orange-700'}`}>⏳ 尚未簽到</span>
                      <Clock className={`w-4 h-4 ${pulseMoodFilter === 'unregistered' ? 'text-white' : 'text-orange-400'}`} />
                    </div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-serif font-bold">{todayMoodStats.unregisteredCount}</span>
                      <span className={`text-[10px] ${pulseMoodFilter === 'unregistered' ? 'text-amber-200' : 'text-orange-600/70'}`}>人</span>
                    </div>
                  </button>
                </div>

                {/* Filter and Switcher Control Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
                  {/* Status filter pills */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
                      <Filter className="w-3.5 h-3.5" />
                      <span>課堂狀態：</span>
                    </span>
                    {[
                      { id: 'all', label: '全部' },
                      { id: 'focus', label: '🟢 專注中' },
                      { id: 'quiet', label: '🟡 需安靜' },
                      { id: 'help', label: '🔴 需協助' }
                    ].map(st => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setPulseStatusFilter(st.id as any)}
                        className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer text-xs ${
                          pulseStatusFilter === st.id
                            ? 'bg-white text-slate-800 shadow-sm border border-slate-200/80'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {/* Summary & reset */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-slate-400">
                      顯示 <strong className="text-slate-800">{filteredPulseStudents.length}</strong> / {sortedStudents.length} 位同學
                    </span>
                    {(pulseMoodFilter !== 'all' || pulseStatusFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setPulseMoodFilter('all');
                          setPulseStatusFilter('all');
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700 font-bold ml-1 cursor-pointer underline"
                      >
                        重設篩選
                      </button>
                    )}
                  </div>
                </div>

                {/* Student Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredPulseStudents.map(student => {
                    const todayMoodKey = todayRecord?.moods?.[student.id] as MoodType | undefined;
                    const moodConfig = todayMoodKey ? MOOD_CONFIG[todayMoodKey] : null;
                    const MoodIcon = moodConfig?.icon;

                    return (
                      <div 
                        key={student.id} 
                        onClick={() => setSelectedPulseStudent(student)}
                        className={`group relative flex flex-col items-center p-5 rounded-3xl border transition-all cursor-pointer hover:shadow-lg hover:-translate-y-1 ${
                          todayMoodKey === 'storm' 
                            ? 'bg-purple-50/30 border-purple-200/70 hover:border-purple-300' 
                            : todayMoodKey === 'rain'
                            ? 'bg-sky-50/20 border-sky-200/60 hover:border-sky-300'
                            : todayMoodKey === 'sun'
                            ? 'bg-white border-slate-200/80 hover:border-amber-300'
                            : 'bg-white border-slate-200/80 hover:border-blue-300'
                        }`}
                        title="點擊可檢視該生詳情或協助調整狀態"
                      >
                        {/* Top row: Seat Number & Classroom Status Badge */}
                        <div className="w-full flex items-center justify-between mb-3">
                          <span className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                            {student.id.padStart(2, '0')}
                          </span>

                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 ${
                            student.status === 'focus' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : student.status === 'quiet' 
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                              : 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              student.status === 'focus' ? 'bg-emerald-500' : student.status === 'quiet' ? 'bg-amber-500' : 'bg-rose-500'
                            }`} />
                            <span>{student.status === 'focus' ? '專注' : student.status === 'quiet' ? '需安靜' : '需協助'}</span>
                          </span>
                        </div>

                        {/* Avatar */}
                        <div className="relative mb-3">
                          <div className={`w-16 h-16 rounded-2xl overflow-hidden shadow-sm transition-all group-hover:scale-105 ${
                            todayMoodKey === 'sun' ? 'ring-3 ring-amber-400' :
                            todayMoodKey === 'storm' ? 'ring-3 ring-purple-400' :
                            todayMoodKey === 'rain' ? 'ring-3 ring-sky-400' :
                            todayMoodKey === 'cloud' ? 'ring-3 ring-slate-300' :
                            'ring-2 ring-slate-200'
                          }`}>
                            {student.avatar ? (
                              <img src={student.avatar || undefined} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full bg-blue-600 text-white flex items-center justify-center text-2xl font-serif">
                                {getStudentInitial(student.name)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Student Name */}
                        <h4 className="text-sm font-bold text-slate-800 text-center truncate w-full">
                          {student.name}
                        </h4>

                        {/* Today's Mood Weather Badge */}
                        <div className="mt-2.5 w-full">
                          {todayMoodKey && moodConfig && MoodIcon ? (
                            <div className={`w-full py-1 px-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1.5 ${
                              todayMoodKey === 'sun' ? 'bg-amber-50 text-amber-800 border-amber-200/80 shadow-2xs' :
                              todayMoodKey === 'cloud' ? 'bg-slate-100 text-slate-700 border-slate-200 shadow-2xs' :
                              todayMoodKey === 'rain' ? 'bg-sky-50 text-sky-800 border-sky-200/80 shadow-2xs' :
                              'bg-purple-50 text-purple-800 border-purple-200/80 shadow-2xs'
                            }`}>
                              <MoodIcon className={`w-3.5 h-3.5 ${moodConfig.color}`} />
                              <span>{moodConfig.label}</span>
                            </div>
                          ) : (
                            <div className="w-full py-1 px-2 rounded-xl text-[10px] font-semibold text-orange-600 bg-orange-50/60 border border-dashed border-orange-200 flex items-center justify-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-ping shrink-0" />
                              <span>今日尚未簽到</span>
                            </div>
                          )}
                        </div>

                        {/* Hover hint */}
                        <div className="mt-2 text-[9px] font-medium text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          點擊查看 / 調整 ➔
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredPulseStudents.length === 0 && (
                  <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-sm font-bold text-slate-500">查無符合目前篩選條件的學生</p>
                    <button
                      type="button"
                      onClick={() => {
                        setPulseMoodFilter('all');
                        setPulseStatusFilter('all');
                      }}
                      className="mt-2 text-xs text-blue-600 font-bold hover:underline cursor-pointer"
                    >
                      清除篩選條件
                    </button>
                  </div>
                )}
              </div>

              {/* Student Quick Detail & Management Modal for Teacher */}
              <AnimatePresence>
                {selectedPulseStudent && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[95] flex items-center justify-center p-4"
                    onClick={() => setSelectedPulseStudent(null)}
                  >
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 20 }}
                      className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden p-8"
                      onClick={e => e.stopPropagation()}
                    >
                      {/* Modal Header */}
                      <div className="flex items-center justify-between pb-6 border-b border-slate-100">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-200 shadow-sm shrink-0">
                            {selectedPulseStudent.avatar ? (
                              <img src={selectedPulseStudent.avatar || undefined} alt={selectedPulseStudent.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full bg-blue-600 text-white flex items-center justify-center text-2xl font-serif">
                                {getStudentInitial(selectedPulseStudent.name)}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-2xl font-serif font-bold text-slate-900">{selectedPulseStudent.name}</h3>
                              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
                                座號 {selectedPulseStudent.id.padStart(2, '0')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">402 班級學生狀態與情緒管理</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSelectedPulseStudent(null)}
                          className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Modal Body */}
                      <div className="space-y-6 py-6">
                        {/* 1. Quick Set Mood Weather */}
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-2.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Sun className="w-4 h-4 text-amber-500" />
                              <span>今日現在的心情氣象</span>
                            </span>
                            <span className="text-[11px] font-normal text-slate-400">
                              目前：{todayRecord?.moods?.[selectedPulseStudent.id] ? MOOD_CONFIG[todayRecord.moods[selectedPulseStudent.id] as MoodType]?.label : '尚未簽到'}
                            </span>
                          </label>

                          <div className="grid grid-cols-4 gap-2.5">
                            {(['sun', 'cloud', 'rain', 'storm'] as MoodType[]).map(m => {
                              const config = MOOD_CONFIG[m];
                              const Icon = config.icon;
                              const isSelected = todayRecord?.moods?.[selectedPulseStudent.id] === m;

                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() => handleTeacherSetStudentMood(selectedPulseStudent.id, m)}
                                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                                    isSelected
                                      ? 'border-blue-600 bg-blue-50/80 shadow-sm ring-2 ring-blue-500/20'
                                      : 'border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
                                  }`}
                                >
                                  <Icon className={`w-6 h-6 ${config.color}`} />
                                  <span className={`text-xs font-bold ${isSelected ? 'text-blue-700' : 'text-slate-700'}`}>
                                    {config.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Quick Set Classroom Status */}
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-2.5 flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <MessageSquare className="w-4 h-4 text-blue-600" />
                              <span>即時課堂專注狀態</span>
                            </span>
                            <span className="text-[11px] font-normal text-slate-400">
                              目前：{selectedPulseStudent.status === 'focus' ? '專注中' : selectedPulseStudent.status === 'quiet' ? '需要安靜' : '請求協助'}
                            </span>
                          </label>

                          <div className="grid grid-cols-3 gap-2.5">
                            {[
                              { id: 'focus', label: '專注中', icon: CheckCircle2, color: 'text-emerald-600', activeBg: 'border-emerald-500 bg-emerald-50/60' },
                              { id: 'quiet', label: '需要安靜', icon: AlertCircle, color: 'text-amber-600', activeBg: 'border-amber-500 bg-amber-50/60' },
                              { id: 'help', label: '請求協助', icon: HelpCircle, color: 'text-rose-600', activeBg: 'border-rose-500 bg-rose-50/60' },
                            ].map(st => {
                              const Icon = st.icon;
                              const isSelected = selectedPulseStudent.status === st.id;
                              return (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => handleTeacherSetStudentStatus(selectedPulseStudent.id, st.id as any)}
                                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                                    isSelected
                                      ? `${st.activeBg} shadow-sm ring-2 ring-slate-400/20 font-bold`
                                      : 'border-slate-200/80 hover:bg-slate-50'
                                  }`}
                                >
                                  <Icon className={`w-5 h-5 ${st.color}`} />
                                  <span className="text-xs">{st.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 3. Recent Emotion Passports */}
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-2 flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4 text-purple-600" />
                            <span>最近情緒修復日誌</span>
                          </label>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-[140px] overflow-y-auto space-y-2 scrollbar-thin">
                            {data.passportEntries.filter(p => p.studentId === selectedPulseStudent.id).length > 0 ? (
                              data.passportEntries
                                .filter(p => p.studentId === selectedPulseStudent.id)
                                .slice(-3)
                                .reverse()
                                .map((entry, idx) => (
                                  <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                                      <span>{new Date(entry.timestamp).toLocaleDateString()}</span>
                                      <span className="font-bold text-slate-600">情緒：{MOOD_CONFIG[entry.mood]?.label || entry.mood}</span>
                                    </div>
                                    <p className="text-slate-800 font-medium"><strong>事件：</strong>{entry.incident}</p>
                                    <p className="text-slate-600"><strong>修復：</strong>{entry.result}</p>
                                  </div>
                                ))
                            ) : (
                              <p className="text-xs text-slate-400 text-center py-3">尚無此學生的情緒修復紀錄</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Modal Footer */}
                      <div className="pt-4 border-t border-slate-100 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setSelectedPulseStudent(null)}
                          className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs transition-all cursor-pointer shadow-md"
                        >
                          完成關閉
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : view === 'checkin' ? (
            <motion.div 
              key="checkin"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className={`relative w-full rounded-[2.5rem] overflow-hidden group shadow-lg border transition-all ${data.classroomImage ? 'bg-slate-900 border-slate-800' : 'h-[200px] md:h-[380px] flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100/50'}`}>
                {data.classroomImage ? (
                  <>
                    {/* Raw image occupying full width and natural height to prevent any side spacing or head-cropping */}
                    <img 
                      src={data.classroomImage || undefined} 
                      alt="Classroom Banner" 
                      className="w-full h-auto block"
                      referrerPolicy="no-referrer"
                    />

                    <label className={`absolute top-4 right-4 p-2.5 md:p-3 bg-black/60 hover:bg-black/80 backdrop-blur-md rounded-xl md:rounded-2xl cursor-pointer transition-all flex items-center gap-2 text-white text-xs font-semibold border border-white/10 shadow-lg z-20 hover:scale-102 active:scale-98 ${isUploadingImage ? 'opacity-70 pointer-events-none' : ''}`}>
                      {isUploadingImage ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          <span>處理上傳中...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>更換照片</span>
                        </>
                      )}
                      <input type="file" className="hidden" accept="image/*" disabled={isUploadingImage} onChange={handleImageChange} />
                    </label>
                  </>
                ) : (
                  <div className="flex flex-col items-center max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-blue-100/80 flex items-center justify-center mb-4 text-blue-600 shadow-inner">
                      <ImageIcon className="w-8 h-8 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-serif font-bold text-slate-800">402 的情緒氣象台</h2>
                    <p className="text-slate-500 text-sm mt-2 mb-6 leading-relaxed">
                      記錄班級的每一份成長與喜悅！請點擊下方按鈕上傳您 402 班級的專屬大合照。
                    </p>
                    <label className={`px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl cursor-pointer transition-all flex items-center gap-2 font-medium shadow-md shadow-blue-200 hover:shadow-lg active:scale-95 ${isUploadingImage ? 'opacity-70 pointer-events-none' : ''}`}>
                      {isUploadingImage ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          <span>正在壓縮並上傳中...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>上傳班級照片</span>
                        </>
                      )}
                      <input type="file" className="hidden" accept="image/*" disabled={isUploadingImage} onChange={handleImageChange} />
                    </label>
                  </div>
                )}
              </div>
              
              {/* Today's Mood Weather Check-in Dashboard for Students */}
              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-inner text-2xl">
                      🌤️
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl md:text-2xl font-serif font-bold text-slate-900">
                          今日情緒氣象簽到台
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                          每日自動更新
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 font-medium">
                        📅 {todayMoodStats.formattedDate}｜每天早晨請點擊自己的座號完成今日心情氣象簽到
                      </p>
                    </div>
                  </div>

                  {/* Sign-in Rate Status */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="text-right sm:text-left">
                      <div className="text-xs font-bold text-slate-500">
                        今日簽到進度：
                        <span className="text-sm font-extrabold text-blue-600 ml-1">
                          {todayMoodStats.checkedInCount} / {todayMoodStats.totalStudents} 人
                        </span>
                        <span className="text-xs text-slate-400 ml-1">({todayMoodStats.ratePercent}%)</span>
                      </div>
                      <div className="w-44 bg-slate-100 h-2.5 rounded-full overflow-hidden mt-1.5 border border-slate-200/50">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-400 to-blue-500 transition-all duration-500 rounded-full"
                          style={{ width: `${todayMoodStats.ratePercent}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const fresh = getLocalDateString();
                        setTodayDateStr(fresh);
                        triggerSuccess();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="手動刷新今日日期與簽到數據"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                      <span>更新狀態</span>
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Student Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {sortedStudents.map(student => {
                  const studentMood = todayRecord?.moods?.[student.id];
                  const moodConfig = studentMood ? MOOD_CONFIG[studentMood as MoodType] : null;
                  const MoodIcon = moodConfig?.icon;
                  const isCheckedInToday = Boolean(studentMood);

                  return (
                    <button 
                      key={student.id}
                      type="button"
                      onClick={() => {
                        setCurrentStudent(student);
                        setCheckinStudentId(student.id);
                        setTodayMood(studentMood as MoodType || null);
                      }}
                      className={`relative p-5 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-2 group text-left cursor-pointer ${
                        checkinStudentId === student.id 
                        ? 'border-blue-600 bg-blue-50/80 shadow-xl scale-105 z-10' 
                        : !isCheckedInToday
                        ? 'border-amber-200/90 bg-amber-50/20 hover:border-amber-300 hover:bg-amber-50/40 hover:shadow-md'
                        : 'border-slate-100 bg-white hover:border-blue-200 hover:shadow-md'
                      }`}
                    >
                      {/* Seat Number */}
                      <div className="absolute top-3 left-3 w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                        {student.id.padStart(2, '0')}
                      </div>

                      {/* Check-in status badge (top-right) */}
                      {isCheckedInToday ? (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          <span>已簽到</span>
                        </div>
                      ) : (
                        <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-bold flex items-center gap-1 animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>未簽到</span>
                        </div>
                      )}
                      
                      {/* Avatar */}
                      <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-serif mt-3 mb-1 overflow-hidden transition-all ${
                        studentMood === 'sun' ? 'ring-3 ring-amber-400' :
                        studentMood === 'storm' ? 'ring-3 ring-purple-400' :
                        studentMood === 'rain' ? 'ring-3 ring-sky-400' :
                        studentMood === 'cloud' ? 'ring-3 ring-slate-300' :
                        'ring-2 ring-amber-300/80'
                      }`}>
                        {student.avatar ? (
                          <img src={student.avatar || undefined} alt={student.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className={`w-full h-full flex items-center justify-center ${checkinStudentId === student.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                            {getStudentInitial(student.name)}
                          </div>
                        )}
                      </div>
                      
                      {/* Name */}
                      <div className="text-center w-full">
                        <div className="font-bold text-slate-800 text-sm truncate">{student.name}</div>
                        
                        {/* Mood Status Label */}
                        <div className="mt-2 w-full">
                          {isCheckedInToday && moodConfig && MoodIcon ? (
                            <div className={`py-1 px-2 rounded-xl text-[11px] font-bold border flex items-center justify-center gap-1 shadow-2xs ${
                              studentMood === 'sun' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                              studentMood === 'cloud' ? 'bg-slate-100 text-slate-700 border-slate-200' :
                              studentMood === 'rain' ? 'bg-sky-50 text-sky-800 border-sky-200' :
                              'bg-purple-50 text-purple-800 border-purple-200'
                            }`}>
                              <MoodIcon className={`w-3.5 h-3.5 ${moodConfig.color}`} />
                              <span>{moodConfig.label}</span>
                            </div>
                          ) : (
                            <div className="py-1 px-2 rounded-xl text-[10px] font-bold text-amber-800 bg-amber-50 border border-dashed border-amber-300 flex items-center justify-center gap-1 group-hover:bg-amber-100/80 transition-colors">
                              <Clock className="w-3 h-3 text-amber-600 animate-spin" style={{ animationDuration: '4s' }} />
                              <span>尚未填寫 ➔</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {checkinStudentId === student.id && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Check-in Modal Overlay */}
              <AnimatePresence>
                {checkinStudentId && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
                    onClick={() => setCheckinStudentId(null)}
                  >
                    <WeatherParticles mood={todayMood} />
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.9, opacity: 0, y: 20 }}
                      className="relative z-10 bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="p-8 md:p-12 space-y-10">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-6">
                            <div className="relative group">
                              <label className="relative block cursor-pointer">
                                {currentStudent.avatar ? (
                                  <img src={currentStudent.avatar || undefined} alt={currentStudent.name} className="w-24 h-24 rounded-3xl object-cover ring-4 ring-blue-100" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center text-4xl font-serif text-white shadow-xl shadow-blue-100">
                                    {getStudentInitial(currentStudent.name)}
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-3xl">
                                  <ImageIcon className="w-6 h-6 text-white" />
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleStudentAvatarChange(currentStudent.id, e)} />
                              </label>
                              <div className="absolute -bottom-2 -right-2">
                                <button 
                                  onClick={() => setAvatarStudioStudentId(currentStudent.id)}
                                  className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg hover:scale-110 active:scale-95 hover:rotate-12 transition-all group/btn z-20"
                                  title="開啟 AI 心情造形工坊"
                                >
                                  <Sparkles className="w-5 h-5 group-hover/btn:animate-pulse" />
                                </button>
                              </div>
                            </div>
                            <div>
                              <h2 className="text-3xl font-serif font-medium text-slate-900">{currentStudent.name}</h2>
                              <p className="text-slate-400 font-bold text-sm uppercase tracking-widest mt-1 bg-slate-100 inline-block px-3 py-1 rounded-full">座號 {currentStudent.id.padStart(2, '0')}</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => setCheckinStudentId(null)}
                            className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-all"
                          >
                            <LogOut className="w-6 h-6 rotate-180" />
                          </button>
                        </div>

                        <div className="space-y-6">
                          <h3 className="text-xl font-serif font-medium flex items-center gap-2">
                            <Sun className="w-5 h-5 text-yellow-500" />
                            1. 你現在的心情氣象？
                          </h3>
                          <div className="grid grid-cols-4 gap-4">
                            {(Object.keys(MOOD_CONFIG) as MoodType[]).map((mood) => {
                              const config = MOOD_CONFIG[mood];
                              const Icon = config.icon;
                              const isSelected = todayMood === mood;
                              
                              return (
                                <button
                                  key={mood}
                                  onClick={() => handleMoodCheckIn(mood)}
                                  className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 group ${
                                    isSelected 
                                    ? 'border-blue-600 bg-blue-50 shadow-md' 
                                    : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${config.bg} ${config.color}`}>
                                    <Icon className="w-8 h-8" />
                                  </div>
                                  <span className={`font-bold text-[10px] uppercase tracking-widest ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>
                                    {config.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* ESP32 S3 Gesture sign-in feedback widget */}
                          {(esp32Connected || esp32Virtual) && (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="mt-4 p-5 bg-gradient-to-tr from-slate-50 to-blue-50/40 rounded-3xl border border-blue-100 flex flex-col gap-3 text-left relative overflow-hidden"
                            >
                              <div className="absolute right-3 top-3 border border-blue-200 bg-white/70 rounded-full px-2 py-0.5 text-[8px] font-mono text-blue-500 font-bold">
                                IMU STREAMING
                              </div>
                              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5" /> ESP32-S3 體感肢體簽到系統已就緒
                              </span>
                              
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-inner border border-blue-50">
                                  {activeCheckinGesture === 'sun' ? '☀️' : activeCheckinGesture === 'storm' ? '⛈️' : activeCheckinGesture === 'rain' ? '🌧️' : activeCheckinGesture === 'cloud' ? '☁️' : '🎮'}
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-sm font-bold text-slate-800">
                                    {activeCheckinGesture === 'sun' && '大太陽姿態 (陽光跳躍)'}
                                    {activeCheckinGesture === 'storm' && '暴風雨姿態 (怒甩宣洩)'}
                                    {activeCheckinGesture === 'rain' && '雨天姿態：請保持控制器低垂靜止'}
                                    {activeCheckinGesture === 'cloud' && '多雲姿態：平托保持絕對靜止'}
                                    {!activeCheckinGesture && '請做出您的情緒氣象動作簽到'}
                                  </h4>
                                  <p className="text-xs text-slate-400 font-medium mt-0.5 leading-relaxed">
                                    {activeCheckinGesture === 'sun' && '動作完成！正在自動簽到中...'}
                                    {activeCheckinGesture === 'storm' && '動作完成！正在自動簽到中...'}
                                    {activeCheckinGesture === 'rain' && `已持續低頭：${gestureTimer} 秒 / 共 3 秒 (達標即簽到)`}
                                    {activeCheckinGesture === 'cloud' && `靜止穩定：${gestureTimer} 秒 / 共 5 秒 (達標即簽到)`}
                                    {!activeCheckinGesture && '高舉跳躍 (☀️)、快速搖晃 (⛈️)、低頭垂手3秒 (🌧️)、平托靜置5秒 (☁️)'}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Gestures counter progress bars */}
                              {activeCheckinGesture && (activeCheckinGesture === 'rain' || activeCheckinGesture === 'cloud') && (
                                <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${(gestureTimer / (activeCheckinGesture === 'rain' ? 3 : 5)) * 100}%` }}
                                  />
                                </div>
                              )}
                            </motion.div>
                          )}
                        </div>

                        <div className="space-y-6">
                          <h3 className="text-xl font-serif font-medium flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-blue-600" />
                            2. 你的即時教室狀態？
                          </h3>
                          <div className="grid grid-cols-3 gap-4">
                            {[
                              { id: 'focus', label: '專注中', color: 'bg-green-500', icon: CheckCircle2 },
                              { id: 'quiet', label: '想安靜', color: 'bg-yellow-500', icon: AlertCircle },
                              { id: 'help', label: '需協助', color: 'bg-red-500', icon: HelpCircle },
                            ].map((s) => (
                              <button
                                key={s.id}
                                onClick={() => {
                                  const updatedStudent: Student = { ...currentStudent, status: s.id as any };
                                  setData(prev => ({
                                    ...prev,
                                    students: prev.students.map(x => x.id === currentStudent.id ? updatedStudent : x)
                                  }));
                                  setCurrentStudent(updatedStudent);
                                  DataService.updateStudentStatus(currentStudent.id, s.id as 'focus' | 'quiet' | 'help').catch(console.error);
                                  triggerSuccess();
                                }}
                                className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${
                                  currentStudent.status === s.id ? 'border-slate-900 bg-slate-900 text-white shadow-lg' : 'border-slate-100 text-slate-500 hover:border-slate-200'
                                }`}
                              >
                                <s.icon className={`w-6 h-6 ${currentStudent.status === s.id ? 'text-white' : 'text-slate-400'}`} />
                                <span className="text-xs font-bold uppercase tracking-widest">{s.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <button 
                          onClick={() => {
                            setCheckinStudentId(null);
                            setShowGame(true);
                          }}
                          className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-bold text-lg shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
                        >
                          完成簽到
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mini Game Modal */}
              <AnimatePresence>
                {showGame && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-4"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0, y: 20 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.9, opacity: 0, y: 20 }}
                      className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden"
                    >
                      <RepairStation 
                        onComplete={() => setShowGame(false)} 
                        esp32IMU={esp32IMU}
                        esp32Connected={esp32Connected || bleConnected}
                        esp32Virtual={esp32Virtual}
                        bleConnected={bleConnected}
                        bleOffset={bleOffset}
                        bleBias={bleBias}
                        ayBias={ayBias}
                        onCalibrate={handleCalibrateDevice}
                      />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Mindfulness Challenge Modal */}
              <AnimatePresence>
                {showMindfulness && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[80] flex items-center justify-center p-4"
                  >
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0, y: 15 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 15 }}
                      className="w-full max-w-xl"
                    >
                      <MindfulnessChallenge 
                        onCancel={() => setShowMindfulness(false)}
                        onComplete={handleMindfulnessComplete}
                        esp32IMU={esp32IMU}
                        esp32Connected={esp32Connected}
                        esp32Virtual={esp32Virtual}
                        esp32StablePercent={esp32StablePercent}
                      />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AI Avatar Studio Modal */}
              <AnimatePresence>
                {avatarStudioStudentId && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[90] flex items-center justify-center p-4"
                  >
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0, y: 15 }}
                      animate={{ scale: 1, opacity: 1, y: 0 }}
                      exit={{ scale: 0.95, opacity: 0, y: 15 }}
                      className="w-full max-w-3xl"
                    >
                      <AvatarStudio 
                        studentName={data.students.find(s => s.id === avatarStudioStudentId)?.name || ''}
                        currentAvatar={data.students.find(s => s.id === avatarStudioStudentId)?.avatar || ''}
                        onClose={() => setAvatarStudioStudentId(null)}
                        onSave={(newAvatarUrl) => handleSaveAvatar(avatarStudioStudentId, newAvatarUrl)}
                      />
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : view === 'student' ? (
            <motion.div 
              key="student"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-4xl mx-auto"
            >
              {/* Repair Passport */}
              <div className="w-full">
                <section className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <h3 className="text-2xl font-serif font-medium flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      情緒修復護照
                    </h3>
                    <div className="px-4 py-1.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Level 1: 情緒偵探
                    </div>
                  </div>

                  <form onSubmit={handlePassportSubmit} className="space-y-8">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">發生了什麼事？ (Incident)</label>
                        <button
                          type="button"
                          onClick={() => toggleSpeechRecognition('incident')}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                            recordingField === 'incident' 
                            ? 'bg-red-500 text-white animate-pulse' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {recordingField === 'incident' ? (
                            <>
                              <MicOff className="w-3 h-3" />
                              停止錄音
                            </>
                          ) : (
                            <>
                              <Mic className="w-3 h-3" />
                              語音輸入
                            </>
                          )}
                        </button>
                      </div>
                      <textarea 
                        required
                        className="w-full p-6 bg-slate-50 rounded-3xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium leading-relaxed resize-none h-24"
                        placeholder="例如：在排隊時被推到、或是心情突然變差..."
                        value={passportForm.incident}
                        onChange={(e) => setPassportForm({ ...passportForm, incident: e.target.value })}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">結果如何？心情如何變化？ (Result)</label>
                        <button
                          type="button"
                          onClick={() => toggleSpeechRecognition('result')}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
                            recordingField === 'result' 
                            ? 'bg-red-500 text-white animate-pulse' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {recordingField === 'result' ? (
                            <>
                              <MicOff className="w-3 h-3" />
                              停止錄音
                            </>
                          ) : (
                            <>
                              <Mic className="w-3 h-3" />
                              語音輸入
                            </>
                          )}
                        </button>
                      </div>

                      {/* ESP32 Mindfulness triggering button */}
                      {(esp32Connected || esp32Virtual) && (
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-[1.5px] rounded-[1.8rem] shadow-sm transform hover:scale-[1.01] transition-transform">
                          <button
                            type="button"
                            onClick={() => setShowMindfulness(true)}
                            className="w-full py-3 bg-slate-900 text-white rounded-[1.7rem] font-bold text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            🧘‍♀️ 啟動 ESP32 體感正念靜心穩定度檢測
                            <span className="bg-blue-600 text-[9px] px-2 py-0.5 rounded-full font-mono uppercase tracking-widest font-black text-white animate-pulse">
                              Ready
                            </span>
                          </button>
                        </div>
                      )}

                      <input 
                        required
                        className="w-full p-6 bg-slate-50 rounded-3xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
                        placeholder="例如：心情變好了、或是還需要一點時間..."
                        value={passportForm.result}
                        onChange={(e) => setPassportForm({ ...passportForm, result: e.target.value })}
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">這週在學校生活的情緒氣象站？ (Mood Station)</label>
                      <div className="grid grid-cols-4 gap-3">
                        {(Object.keys(MOOD_CONFIG) as MoodType[]).map((m) => {
                          const config = MOOD_CONFIG[m];
                          const Icon = config.icon;
                          const isSelected = passportForm.mood === m;
                          
                          return (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setPassportForm({ ...passportForm, mood: m })}
                              className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                                isSelected 
                                ? 'border-blue-600 bg-blue-50' 
                                : 'border-slate-100 hover:border-blue-200 bg-white'
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bg} ${config.color}`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <span className={`text-[10px] font-bold ${isSelected ? 'text-blue-600' : 'text-slate-500'}`}>
                                {config.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button 
                      type="submit"
                      className="w-full py-5 bg-blue-600 text-white rounded-3xl font-bold text-lg shadow-xl shadow-blue-100 hover:bg-blue-700 hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
                    >
                      <Save className="w-6 h-6" />
                      存入護照
                    </button>
                  </form>
                </section>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="management"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                {/* Database Connectivity Status */}
                <section className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden relative">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${dbStatus === 'connected' ? 'bg-green-50 text-green-600' : dbStatus === 'error' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                        {dbStatus === 'connected' ? <ShieldCheck className="w-6 h-6" /> : dbStatus === 'error' ? <AlertCircle className="w-6 h-6" /> : <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />}
                      </div>
                      <div>
                        <h3 className="text-xl font-serif font-medium text-slate-900">雲端資料庫連線與系統狀態</h3>
                        <p className="text-slate-400 text-sm font-medium">
                          {dbStatus === 'connected' ? (user ? `已連線: ${user.email} ${isAdmin ? '(管理員/導師)' : '(授權使用者)'}` : '雲端連線正常，可隨時進行學生心情與日誌簽到紀錄') : dbStatus === 'error' ? '連線同步中或離線快取模式運作中' : '正在檢查雲端連線...'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      {isAdmin && (
<button 
                        onClick={handleSystemReorganizeAndRepair}
                        disabled={isSyncing}
                        className="px-6 py-3 bg-teal-600 text-white rounded-2xl font-bold shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
                        title="修復並同步學生名單與雲端資料庫"
                      >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>{isSyncing ? '系統整理與修復中...' : '重新整理系統與同步'}</span>
                      </button>
)}

                      {!user && (
                        <button 
                          onClick={() => signInWithGoogle()}
                          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2"
                        >
                          <ArrowRight className="w-4 h-4" />
                          Google 登入
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                {/* ESP32-S3 Physical Interaction Panel Section */}
                <section className="lg:col-span-2 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
                  <ESP32Panel 
                    esp32Connected={esp32Connected}
                    esp32Virtual={esp32Virtual}
                    esp32IMU={esp32IMU}
                    esp32StablePercent={esp32StablePercent}
                    activeGesture={activeGesture}
                    onConnect={handleESP32Connect}
                    onDisconnect={handleESP32Disconnect}
                    onToggleVirtual={handleToggleVirtual}
                    onSimulateIMU={handleSimulateIMU}
                    onSimulateGesture={handleSimulateGesture}
                    bleConnected={bleConnected}
                    bleOffset={bleOffset}
                    bleDeviceName={bleDeviceName}
                    onBLEConnect={handleBLEConnect}
                    onBLEDisconnect={handleBLEDisconnect}
                    bleBias={bleBias}
                    ayBias={ayBias}
                    onCalibrate={handleCalibrateDevice}
                  />
                </section>

                {/* Student Management */}
                <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-2xl font-serif font-medium flex items-center gap-3">
                      <User className="w-6 h-6 text-blue-600" />
                      學生名單管理
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {isAdmin && (
<button 
                        onClick={handleRestoreDefaultAvatars}
                        disabled={isSyncing}
                        className="text-[10px] font-bold text-white bg-teal-600 px-3 py-2 rounded-xl hover:bg-teal-700 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-sm"
                        title="立即恢復全班 29 位學生的專屬個人肖像"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>恢復全班原本頭像</span>
                      </button>
)}
                      <button 
                        onClick={() => handleBulkAvatarInit(1, 17)}
                        disabled={isSyncing}
                        className="text-[10px] font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-xl hover:bg-blue-100 transition-all disabled:opacity-50 cursor-pointer"
                        title="重新產生男生 1-17 號頭像"
                      >
                        {isSyncing ? '同步中...' : '重新生成 1-17 號'}
                      </button>
                      <button 
                        onClick={() => handleBulkAvatarInit(21, 32)}
                        disabled={isSyncing}
                        className="text-[10px] font-bold text-slate-600 bg-slate-100 px-3 py-2 rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50 cursor-pointer"
                        title="重新產生女生 21-32 號頭像"
                      >
                        {isSyncing ? '同步中...' : '重新生成 21-32 號'}
                      </button>
                    </div>
                  </div>
                  
                  <form onSubmit={handleAddStudent} className="flex gap-3 mb-8">
                    <input 
                      type="text"
                      className="flex-1 p-4 bg-slate-50 rounded-2xl border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium"
                      placeholder="輸入新學生姓名..."
                      value={newStudentName}
                      onChange={(e) => setNewStudentName(e.target.value)}
                    />
                    <button 
                      type="submit"
                      className="px-6 bg-blue-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                      新增
                    </button>
                  </form>

                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                    {sortedStudents.map(s => (
                      <div key={s.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => setAvatarStudioStudentId(s.id)}
                            className="relative group/av cursor-pointer"
                            title="點擊更換個人肖像"
                          >
                            {s.avatar ? (
                              <img src={s.avatar || undefined} alt={s.name} className="w-10 h-10 rounded-xl object-cover border border-slate-200 group-hover/av:ring-2 group-hover/av:ring-blue-500 transition-all" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-bold text-slate-400 border border-slate-200 group-hover/av:bg-blue-50 transition-all">
                                {getStudentInitial(s.name)}
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/30 rounded-xl opacity-0 group-hover/av:opacity-100 flex items-center justify-center transition-opacity text-white text-[9px] font-bold">
                              換肖像
                            </div>
                          </button>
                          <span className="font-bold text-slate-700">{s.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            type="button"
                            onClick={() => setAvatarStudioStudentId(s.id)}
                            className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-all"
                            title="AI 造型工坊"
                          >
                            <Sparkles className="w-4 h-4" />
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleDeleteStudent(s.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="刪除學生"
                          >
                            <LogOut className="w-5 h-5 rotate-180" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Delete Confirmation Modal */}
                  <AnimatePresence>
                    {studentToDelete && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
                        onClick={() => setStudentToDelete(null)}
                      >
                        <motion.div 
                          initial={{ scale: 0.9, opacity: 0, y: 20 }}
                          animate={{ scale: 1, opacity: 1, y: 0 }}
                          exit={{ scale: 0.9, opacity: 0, y: 20 }}
                          className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden p-8"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="flex flex-col items-center text-center gap-6">
                            <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500">
                              <AlertCircle className="w-8 h-8" />
                            </div>
                            <div>
                              <h3 className="text-xl font-serif font-medium mb-2">確定要刪除學生？</h3>
                              <p className="text-slate-500 text-sm">
                                此動作將會移除 <span className="font-bold text-slate-900">{data.students.find(s => s.id === studentToDelete)?.name}</span> 的所有資料，且無法復原。
                              </p>
                            </div>
                            <div className="flex w-full gap-3">
                              <button 
                                onClick={() => setStudentToDelete(null)}
                                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                              >
                                取消
                              </button>
                              <button 
                                onClick={confirmDeleteStudent}
                                className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all"
                              >
                                確定刪除
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>

                {/* Firebase Data Backup & Download */}
                <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm col-span-1 lg:col-span-2">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-serif font-medium text-slate-900">Firebase 數據備份與下載</h3>
                      <p className="text-slate-400 text-sm font-medium">備份現有的雲端資料，您可以匯出成標準 JSON 檔案，或是適合試算表分析的 CSV 格式</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
                    {/* JSON Format Full Backup Card */}
                    <div className="p-6 rounded-3xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between h-full hover:border-blue-100 transition-all group">
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4 font-mono font-bold text-xs">
                          JSON
                        </div>
                        <h4 className="font-bold text-slate-800 text-base mb-2">完整系統備份</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
                          包含完整的學生名單、心情紀錄、修復日誌等全部雲端數據。可用於日後系統重設或匯入。
                        </p>
                      </div>
                      <button
                        onClick={handleExportAllJSON}
                        className="w-full py-3 px-4 bg-slate-900 text-white rounded-2xl font-bold text-xs hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        下載完整備份
                      </button>
                    </div>

                    {/* Students Registry CSV Card */}
                    <div className="p-6 rounded-3xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between h-full hover:border-green-100 transition-all group">
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-green-100 text-green-600 flex items-center justify-center mb-4 font-mono font-bold text-xs">
                          CSV
                        </div>
                        <h4 className="font-bold text-slate-800 text-base mb-2">學生名冊匯出</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
                          匯出目前班級的所有學生狀態列表。欄位包含：座號、姓名、即時心情課堂狀態。
                        </p>
                      </div>
                      <button
                        onClick={handleExportStudentsCSV}
                        className="w-full py-3 px-4 bg-green-600 text-white rounded-2xl font-bold text-xs hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        下載 CSV
                      </button>
                    </div>

                    {/* Mood Logs CSV Card */}
                    <div className="p-6 rounded-3xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between h-full hover:border-amber-100 transition-all group">
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center mb-4 font-mono font-bold text-xs">
                          CSV
                        </div>
                        <h4 className="font-bold text-slate-800 text-base mb-2">心情歷史紀錄</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
                          匯出每日心情氣象簽到歷史 log。適合進行長期的學生情緒起伏、情緒極端起伏分析。
                        </p>
                      </div>
                      <button
                        onClick={handleExportMoodLogsCSV}
                        className="w-full py-3 px-4 bg-amber-500 text-white rounded-2xl font-bold text-xs hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        下載 CSV
                      </button>
                    </div>

                    {/* Passport Logs CSV Card */}
                    <div className="p-6 rounded-3xl border border-slate-100 bg-slate-50/50 flex flex-col justify-between h-full hover:border-purple-100 transition-all group">
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center mb-4 font-mono font-bold text-xs">
                          CSV
                        </div>
                        <h4 className="font-bold text-slate-800 text-base mb-2">情緒修復日誌</h4>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">
                          匯出所有學生的情緒修復護照事件紀錄，包含：事件情境、當時心情與修復結果。
                        </p>
                      </div>
                      <button
                        onClick={handleExportPassportCSV}
                        className="w-full py-3 px-4 bg-purple-600 text-white rounded-2xl font-bold text-xs hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        下載 CSV
                      </button>
                    </div>
                  </div>
                </section>

                {/* Raw Data Management */}
                <section className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                  <h3 className="text-2xl font-serif font-medium mb-8 flex items-center gap-3">
                    <ClipboardList className="w-6 h-6 text-blue-600" />
                    原始數據編輯 (JSON)
                  </h3>
                  <p className="text-sm text-slate-500 mb-4">
                    您可以直接修改下方的 JSON 數據來更新整個系統的內容（包括歷史紀錄）。
                  </p>
                  
                  <textarea 
                    className={`w-full h-[300px] p-4 bg-slate-900 text-blue-400 font-mono text-xs rounded-2xl outline-none focus:ring-2 transition-all ${jsonError ? 'focus:ring-red-500 border-red-500' : 'focus:ring-blue-500 border-slate-800'}`}
                    value={rawJson}
                    onChange={(e) => {
                      setRawJson(e.target.value);
                      setJsonError(null);
                    }}
                  />
                  
                  {jsonError && <p className="text-red-500 text-xs mt-2 font-bold">{jsonError}</p>}
                  
                  <div className="mt-6 flex gap-4">
                    <button 
                      onClick={handleJsonUpdate}
                      className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                    >
                      <Save className="w-5 h-5" />
                      套用變更
                    </button>
                    <button 
                      onClick={() => {
                        setData(INITIAL_DATA);
                        setRawJson(JSON.stringify(INITIAL_DATA, null, 2));
                        triggerSuccess();
                      }}
                      className="px-6 py-4 bg-white border border-slate-200 text-slate-500 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                    >
                      重設為預設
                    </button>
                  </div>
                </section>
              </div>

              {/* Quick Tips */}
              <div className="bg-blue-600 p-10 rounded-[2.5rem] text-white shadow-xl shadow-blue-100 relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-2xl font-serif font-medium mb-4">管理提示</h3>
                  <ul className="space-y-3 text-blue-100 font-medium">
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-white mt-2 shrink-0"></div>
                      新增學生後，他們會立即出現在學生模式的下拉選單中。
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-white mt-2 shrink-0"></div>
                      您可以透過 JSON 編輯器手動補登過去的「心情氣象歷史」。
                    </li>
                    <li className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-white mt-2 shrink-0"></div>
                      點擊左側導覽列底部的「儲存」圖示，可將目前所有數據下載備份。
                    </li>
                  </ul>
                </div>
                <ShieldCheck className="absolute -bottom-10 -right-10 w-64 h-64 text-blue-500/20 rotate-12" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Success Toast */}
      <Confetti active={showConfetti} onComplete={() => setShowConfetti(false)} />
      <AnimatePresence>
        {isReportModalOpen && (
          <CounselingReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            selectedMonth={selectedMonth}
            data={data}
            keywordCounts={keywordCounts}
            highestMoodInfo={highestMoodInfo}
            summaryReport={summaryReport}
            onGenerateAIReport={handleGenerateAIWeeklyReport}
            isGeneratingReport={isGeneratingReport}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 md:bottom-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl z-[100] flex items-center gap-3"
          >
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="font-bold text-sm tracking-wide">記錄成功！你做得很棒。</span>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedPassportEntry && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setSelectedPassportEntry(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden p-8 relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${MOOD_CONFIG[selectedPassportEntry.mood]?.bg || 'bg-slate-100'}`}>
                      {(() => {
                        const Icon = MOOD_CONFIG[selectedPassportEntry.mood]?.icon;
                        return Icon ? <Icon className={`w-4 h-4 ${MOOD_CONFIG[selectedPassportEntry.mood]?.color}`} /> : null;
                      })()}
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-slate-900 text-lg">{selectedPassportEntry.studentName} 的修復日誌</h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        {new Date(selectedPassportEntry.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPassportEntry(null)}
                    className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">發生了什麼事？ (Incident)</span>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-medium text-slate-700 leading-relaxed italic">
                      「{selectedPassportEntry.incident}」
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">結果與心情變化 (Result)</span>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm font-medium text-slate-700 leading-relaxed">
                      {selectedPassportEntry.result}
                    </div>
                  </div>

                  {selectedPassportEntry.image && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">現場紀錄照片 / 塗鴉 (Photo Attachment)</span>
                      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-50 max-h-72 flex justify-center items-center">
                        <img
                          src={selectedPassportEntry.image}
                          alt="Passport Attachment"
                          className="w-full h-auto max-h-72 object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedPassportEntry(null)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all text-sm mt-2"
                >
                  關閉視窗
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
