import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Compass, Heart, Info, RefreshCw, 
  Wind, ShieldCheck, Sparkles 
} from 'lucide-react';

interface MindfulnessChallengeProps {
  onComplete: (averageStability: number) => void;
  onCancel: () => void;
  esp32IMU: { ax: number; ay: number; az: number; gx: number; gy: number; gz: number };
  esp32Connected: boolean;
  esp32Virtual: boolean;
  esp32StablePercent: number;
}

export default function MindfulnessChallenge({
  onComplete,
  onCancel,
  esp32IMU,
  esp32Connected,
  esp32Virtual,
  esp32StablePercent
}: MindfulnessChallengeProps) {
  const [sessionStarted, setSessionStarted] = useState(false);
  const [breatheState, setBreatheState] = useState<'inhale' | 'exhale' | 'hold'>('inhale');
  const [progress, setProgress] = useState(0); // 0 to 100
  const [breathingCycleCount, setBreathingCycleCount] = useState(0);
  const [cycleTimer, setCycleTimer] = useState(4); // 4-second intervals
  
  // Track stable scores to compute final average
  const stabilityHistoryRef = useRef<number[]>([]);
  const stabilityIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // play resonant audio chimes using Web Audio API
  const playZenBell = (type: 'bowl' | 'gong') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const gain2 = ctx.createGain();

      osc.connect(gain);
      osc2.connect(gain2);
      gain.connect(ctx.destination);
      gain2.connect(ctx.destination);

      if (type === 'bowl') {
        // High crystalline Tibetan bowl pitch (G5 & B5)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(987.77, ctx.currentTime); // B5

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.8);
        gain2.gain.setValueAtTime(0.04, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

        osc.start();
        osc.stop(ctx.currentTime + 1.8);
        osc2.start();
        osc2.stop(ctx.currentTime + 1.8);
      } else {
        // Deep resonance Zen Gong pitch (G2, G3 & D4)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(98.00, ctx.currentTime); // G2
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(196.00, ctx.currentTime); // G3

        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 4.0);
        gain2.gain.setValueAtTime(0.10, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.0);

        // Third harmonic
        const osc3 = ctx.createOscillator();
        const gain3 = ctx.createGain();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(293.66, ctx.currentTime); // D4
        osc3.connect(gain3);
        gain3.connect(ctx.destination);
        gain3.gain.setValueAtTime(0.05, ctx.currentTime);
        gain3.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 2.5);

        osc.start();
        osc.stop(ctx.currentTime + 4.0);
        osc2.start();
        osc2.stop(ctx.currentTime + 4.0);
        osc3.start();
        osc3.stop(ctx.currentTime + 4.0);
      }
    } catch (e) {
      console.warn('Zen audio synthesis failed', e);
    }
  };

  const handleStartMinfulness = () => {
    setSessionStarted(true);
    playZenBell('bowl');
    setProgress(0);
    setBreathingCycleCount(0);
    setBreatheState('inhale');
    setCycleTimer(4);
    stabilityHistoryRef.current = [];
  };

  // Breathing circle controller & progress speed
  useEffect(() => {
    if (!sessionStarted) return;

    // 1. Stability polling & progress step updates
    const progressInterval = setInterval(() => {
      // Fetch currently calculated stability from actual stream or fallback average (96%)
      const currentStability = (esp32Connected || esp32Virtual) ? esp32StablePercent : 97;
      stabilityHistoryRef.current.push(currentStability);

      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }

        // If highly unstable (shaking), progress bar crawls or temporarily freezes, otherwise fills up!
        const stepRate = currentStability >= 85 ? 1.4 : 0.12; 
        return Math.min(100, prev + stepRate);
      });
    }, 150);

    // 2. Inhale/Exhale 4-second cycle timer
    const breatheCycleInterval = setInterval(() => {
      setCycleTimer(prev => {
        if (prev <= 1) {
          // Switch breathing cycles
          setBreatheState(curr => {
            if (curr === 'inhale') return 'exhale';
            return 'inhale';
          });
          return 4;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(breatheCycleInterval);
    };
  }, [sessionStarted, esp32Connected, esp32Virtual, esp32StablePercent]);

  // Finish callback when progress hits 100
  useEffect(() => {
    if (sessionStarted && progress >= 100) {
      setSessionStarted(false);
      playZenBell('gong');
      
      // Calculate average stability
      const total = stabilityHistoryRef.current.reduce((acc, v) => acc + v, 0);
      const avg = stabilityHistoryRef.current.length > 0 
        ? Math.round(total / stabilityHistoryRef.current.length) 
        : 95;
      
      setTimeout(() => {
        onComplete(avg);
      }, 1000);
    }
  }, [progress, sessionStarted, onComplete]);

  return (
    <div className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-slate-200 shadow-sm max-w-xl mx-auto text-center space-y-8 relative overflow-hidden">
      {/* Serene Decorative Accents */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-50 rounded-full blur-3xl opacity-60 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-50 rounded-full blur-3xl opacity-60 pointer-events-none" />

      {!sessionStarted ? (
        <div className="space-y-6">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mx-auto shadow-inner">
            <Compass className="w-8 h-8 animate-spin-slow animate-pulse" />
          </div>
          <div>
            <h3 className="text-2xl font-serif font-bold text-slate-900 mb-2">正念靜心穩定度大考驗</h3>
            <p className="text-slate-400 text-sm leading-relaxed font-medium">
              考驗你的心靈專注和平靜強度！手持 <span className="text-blue-600 font-bold">ESP32-S3 控制器</span>，
              跟著畫面節奏進行「四秒吸氣、四秒吐氣」。
              系統會嚴密監測你的手部抖動情況，當你手部完全穩妥不晃動時，靜心進度條才會快速向前哦！
            </p>
          </div>

          <div className="bg-slate-50 p-4 border border-slate-100 rounded-2xl text-left flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-500 font-medium leading-normal">
              <span className="font-bold text-slate-700 block mb-0.5">系統聯動說明</span>
              挑戰完成後，系統會分析您的平均穩定度成果，並自動寫入您的情緒學習護照，作為調適努力的實體紀錄！
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={onCancel}
              className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-2xl font-bold text-xs hover:bg-slate-200 transition-all"
            >
              取消
            </button>
            <button
              onClick={handleStartMinfulness}
              className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-bold text-xs shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all"
            >
              開始靜心 🧘‍♀️
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8">
          {/* Circular Breathing Ripple Visualizer */}
          <div className="relative w-48 h-48 flex items-center justify-center">
            
            {/* Pulsing Breathing Rings (Inhale = expands, Exhale = shrinks) */}
            <motion.div
              animate={{ 
                scale: breatheState === 'inhale' ? 1.4 : 0.85,
                opacity: breatheState === 'inhale' ? 0.3 : 0.15
              }}
              transition={{ duration: 4, ease: 'easeInOut' }}
              className="absolute w-36 h-36 border border-blue-500 rounded-full"
            />
            <motion.div
              animate={{ 
                scale: breatheState === 'inhale' ? 1.25 : 0.75,
                opacity: breatheState === 'inhale' ? 0.45 : 0.25
              }}
              transition={{ duration: 4, ease: 'easeInOut' }}
              className="absolute w-32 h-32 bg-blue-100/50 rounded-full"
            />
            
            {/* Core Zen Sphere */}
            <motion.div
              animate={{ 
                scale: breatheState === 'inhale' ? 1.15 : 0.70,
                boxShadow: breatheState === 'inhale' 
                  ? '0 0 32px rgba(59, 130, 246, 0.5)' 
                  : '0 0 12px rgba(148, 163, 184, 0.2)'
              }}
              transition={{ duration: 4, ease: 'easeInOut' }}
              className="w-24 h-24 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-full flex flex-col items-center justify-center text-white z-10"
            >
              <Wind className="w-8 h-8 animate-pulse mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">
                {breatheState === 'inhale' ? '吸氣' : '呼氣'}
              </span>
              <span className="text-[12px] font-mono mt-1 font-bold">
                {cycleTimer}s
              </span>
            </motion.div>
          </div>

          {/* Real-time stability status display */}
          <div className="w-full space-y-3">
            <div className="flex justify-between items-center px-2">
              <span className="text-xs font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-slate-400 rotate-45" />
                當前手部穩定度 (Stability)
              </span>
              <span className={`text-sm font-black font-mono ${(esp32Connected || esp32Virtual) && esp32StablePercent < 85 ? 'text-red-500 animate-pulse' : 'text-emerald-600'}`}>
                {(esp32Connected || esp32Virtual) ? `${esp32StablePercent}%` : '96% (虛擬探針)'}
              </span>
            </div>

            {/* Stability rating slider bar */}
            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <motion.div 
                className={`h-full ${((esp32Connected || esp32Virtual) && esp32StablePercent < 85) ? 'bg-red-500' : 'bg-emerald-500'}`}
                animate={{ width: `${(esp32Connected || esp32Virtual) ? esp32StablePercent : 96}%` }}
                transition={{ duration: 0.15 }}
              />
            </div>

            {/* Breathing Progress bar */}
            <div className="pt-2">
              <div className="flex justify-between text-[11px] mb-1 font-bold text-slate-500">
                <span>靜心整合進度 (Challenge Progress)</span>
                <span className="font-mono">{Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Dynamic support tips based on stability */}
            <AnimatePresence mode="wait">
              {((esp32Connected || esp32Virtual) && esp32StablePercent < 85) ? (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-3.5 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-2 text-left"
                >
                  <Wind className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-600 font-medium leading-normal leading-relaxed">
                    <strong>⚠️ 偵測到細微晃動：</strong> 放鬆肩膀與雙手，保持平托，跟著呼吸圓圈慢吸慢吐，平靜自然會到來...
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-2 text-left"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-emerald-600 font-medium leading-normal leading-relaxed">
                    <strong>🌟 身心平穩中：</strong> 非常棒，維持姿勢，手部抖動振幅非常小。繼續專注在心胸的起伏，吸進清新，吐出多餘。
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
