import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, Sun, Sparkles, Zap, Smile, 
  CloudLightning, Volume2, VolumeX, ShieldAlert, X
} from 'lucide-react';

interface InteractiveMiniGameProps {
  onComplete: () => void;
  esp32IMU: { ax: number; ay: number; az: number; gx: number; gy: number; gz: number };
  esp32Connected: boolean;
  esp32Virtual: boolean;
  bleConnected?: boolean;
  bleOffset?: number;
  bleBias?: number;
  ayBias?: number;
  onCalibrate?: () => void;
}

export default function InteractiveMiniGame({
  onComplete,
  esp32IMU,
  esp32Connected,
  esp32Virtual,
  bleConnected = false,
  bleOffset = 0,
  bleBias = 0,
  ayBias = 0,
  onCalibrate
}: InteractiveMiniGameProps) {
  const [items, setItems] = useState<{ id: number; x: number; y: number; icon: any; color: string; type: string }[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25);
  const [gameStarted, setGameStarted] = useState(false);
  const [basketX, setBasketX] = useState(50); // 0 to 100
  const [gameMode, setGameMode] = useState<'click' | 'tilt'>('click');
  const [hitEffects, setHitEffects] = useState<{ id: number; x: number; y: number; text: string }[]>([]);
  
  // Game effects: combo and background music states
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [bgmEnabled, setBgmEnabled] = useState(true);

  // Refs to allow game loops to run continuously without periodic resets
  const timeLeftRef = useRef(timeLeft);
  const gameStartedRef = useRef(gameStarted);
  const gameModeRef = useRef(gameMode);
  const basketXRef = useRef(basketX);
  const comboRef = useRef(combo);
  const maxComboRef = useRef(maxCombo);
  const bgmEnabledRef = useRef(bgmEnabled);

  const bgmIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const bgmCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  useEffect(() => {
    gameStartedRef.current = gameStarted;
  }, [gameStarted]);

  useEffect(() => {
    gameModeRef.current = gameMode;
  }, [gameMode]);

  useEffect(() => {
    basketXRef.current = basketX;
  }, [basketX]);

  useEffect(() => {
    comboRef.current = combo;
  }, [combo]);

  useEffect(() => {
    maxComboRef.current = maxCombo;
  }, [maxCombo]);

  useEffect(() => {
    bgmEnabledRef.current = bgmEnabled;
  }, [bgmEnabled]);

  // Auto-switch to tilt mode if ESP32 connected or virtualized or BLE connected
  useEffect(() => {
    if (esp32Connected || esp32Virtual || bleConnected) {
      setGameMode('tilt');
    } else {
      setGameMode('click');
    }
  }, [esp32Connected, esp32Virtual, bleConnected]);

  // Cheerful 8-Bit Retro BGM Sequencer
  const startBGM = () => {
    if (!bgmEnabledRef.current) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      
      if (bgmIntervalRef.current) {
        clearInterval(bgmIntervalRef.current);
      }
      if (bgmCtxRef.current) {
        try { bgmCtxRef.current.close(); } catch (e) {}
      }
      
      const ctx = new AudioContext();
      bgmCtxRef.current = ctx;
      
      // Upbeat pentatonic chord progression
      const chords = [
        [261.63, 329.63, 392.00, 440.00], // C4, E4, G4, A4 (C Major 6)
        [293.66, 349.23, 392.00, 523.25], // D4, F4, G4, C5   (Dm7/G)
        [329.63, 392.00, 440.00, 587.33], // E4, G4, A4, D5   (Em7)
        [392.00, 440.00, 523.25, 659.25], // G4, A4, C5, E5   (C Major 7)
      ];
      
      let step = 0;
      
      bgmIntervalRef.current = setInterval(() => {
        if (!gameStartedRef.current || timeLeftRef.current <= 0 || ctx.state === 'closed' || !bgmEnabledRef.current) {
          clearInterval(bgmIntervalRef.current!);
          return;
        }
        
        if (ctx.state === 'suspended') {
          ctx.resume();
        }
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'triangle'; // Pure retro feel
        
        const chordIndex = Math.floor(step / 4) % chords.length;
        const noteIndex = step % 4;
        const freq = chords[chordIndex][noteIndex];
        
        const isBass = step % 2 === 0;
        osc.frequency.setValueAtTime(isBass ? freq / 2 : freq, ctx.currentTime);
        
        const volume = isBass ? 0.025 : 0.015;
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        
        step++;
      }, 350);
    } catch (err) {
      console.warn('Game BGM synthesis failed', err);
    }
  };

  const stopBGM = () => {
    if (bgmIntervalRef.current) {
      clearInterval(bgmIntervalRef.current);
      bgmIntervalRef.current = null;
    }
    if (bgmCtxRef.current) {
      try {
        bgmCtxRef.current.close();
      } catch (e) {}
      bgmCtxRef.current = null;
    }
  };

  // Start BGM effect
  useEffect(() => {
    if (gameStarted && timeLeft > 0 && bgmEnabled) {
      startBGM();
    } else {
      stopBGM();
    }
    return () => stopBGM();
  }, [gameStarted, bgmEnabled]);

  // Synthesis engine for game audios
  const triggerAudio = (type: 'pop' | 'zap' | 'lightning' | 'hit' | 'start' | 'combo' | 'gameover' | 'lowtime' | 'miss') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'start') {
        // Retro happy chord rising up
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(261.63, ctx.currentTime); // C4
        osc.frequency.setValueAtTime(329.63, ctx.currentTime + 0.08); // E4
        osc.frequency.setValueAtTime(392.00, ctx.currentTime + 0.16); // G4
        osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.24); // C5
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
        osc.start();
        osc.stop(ctx.currentTime + 0.45);
      } else if (type === 'combo') {
        // Happy, shiny double high beep
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.08); // A5
        gain.gain.setValueAtTime(0.07, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'gameover') {
        // High triumph arpeggio! C5, E5, G5, C6
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.12); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.24); // G5
        osc.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.36); // C6
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
        osc.start();
        osc.stop(ctx.currentTime + 0.7);
      } else if (type === 'lowtime') {
        // Clean synth clock alarm tick
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660.00, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'miss') {
        // Deep sliding down bubble laser sound
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220.00, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(110.00, ctx.currentTime + 0.22);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } else if (type === 'hit') {
        // High punch woody slap transient for hammer strike
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);

        // Snap transient
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snapOsc.connect(snapGain);
        snapGain.connect(ctx.destination);
        snapOsc.type = 'sine';
        snapOsc.frequency.setValueAtTime(1500, ctx.currentTime);
        snapOsc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.05);
        snapGain.gain.setValueAtTime(0.2, ctx.currentTime);
        snapGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

        osc.start();
        osc.stop(ctx.currentTime + 0.16);
        snapOsc.start();
        snapOsc.stop(ctx.currentTime + 0.05);
      } else if (type === 'pop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === 'lightning') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'zap') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(260, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.07, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {
      console.warn('Game audio synthesis failed', e);
    }
  };

  // Direct key hooks for testing tilt / shooting on keyboard
  useEffect(() => {
    if (!gameStarted || timeLeft <= 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setBasketX(prev => Math.max(5, prev - 8));
      } else if (e.key === 'ArrowRight') {
        setBasketX(prev => Math.max(5, prev + 8));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameStarted, timeLeft]);

  // Physical tracking from ESP32 accelerometer or Bluetooth BLE Offset
  useEffect(() => {
    if (!gameStarted || timeLeft <= 0 || gameMode !== 'tilt') return;
    
    if (bleConnected && bleOffset !== undefined) {
      const calibratedOffset = bleOffset - bleBias;
      const clampedOffset = Math.max(-100, Math.min(100, calibratedOffset));
      const rawPercentage = 50 + (clampedOffset / 100) * 45;
      setBasketX(Math.max(5, Math.min(95, rawPercentage)));
    } else {
      const tiltMultiplier = -1.8;
      const rawVal = esp32IMU.ay - ayBias;
      
      if (Math.abs(rawVal) > 0.8) {
        setBasketX(prev => {
          const delta = rawVal * tiltMultiplier;
          return Math.max(5, Math.min(95, prev + delta));
        });
      }
    }
  }, [esp32IMU, bleConnected, bleOffset, bleBias, ayBias, gameStarted, timeLeft, gameMode]);

  // Spawning and physics updating loops
  // 1. Countdown timer effect
  useEffect(() => {
    if (!gameStarted) return;

    const timer = setInterval(() => {
      if (timeLeftRef.current <= 0) {
        clearInterval(timer);
        return;
      }
      const nextTime = timeLeftRef.current - 1;
      setTimeLeft(nextTime);
      
      // Low time alarm countdown ticks
      if (nextTime > 0 && nextTime <= 5) {
        triggerAudio('lowtime');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted]);

  // 2. Game completion triggers
  useEffect(() => {
    if (gameStarted && timeLeft <= 0) {
      triggerAudio('gameover');
      const timer = setTimeout(onComplete, 4500);
      return () => clearTimeout(timer);
    }
  }, [gameStarted, timeLeft, onComplete]);

  // 3. Spawning energy items (continuous loop)
  useEffect(() => {
    if (!gameStarted) return;

    const spawnInterval = setInterval(() => {
      if (timeLeftRef.current <= 0) {
        clearInterval(spawnInterval);
        return;
      }
      const id = Date.now() + Math.random();
      const x = Math.random() * 80 + 10;
      
      const pool = [
        { type: 'heart', icon: Heart, color: 'text-red-500' },
        { type: 'sun', icon: Sun, color: 'text-yellow-500' },
        { type: 'sparkles', icon: Sparkles, color: 'text-amber-500' },
        { type: 'zap', icon: Zap, color: 'text-blue-500' },
        { type: 'smile', icon: Smile, color: 'text-orange-500' }
      ];
      const pick = pool[Math.floor(Math.random() * pool.length)];

      setItems(prev => [...prev, { id, x, y: 0, ...pick }]);
    }, 1200);

    return () => clearInterval(spawnInterval);
  }, [gameStarted]);

  // 4. Trigger audio and visual chimes on start
  useEffect(() => {
    if (gameStarted) {
      triggerAudio('start');
    }
  }, [gameStarted]);

  // 5. Physics simulation loop (continuous speed updates)
  useEffect(() => {
    if (!gameStarted) return;

    const physicsInterval = setInterval(() => {
      if (timeLeftRef.current <= 0) {
        clearInterval(physicsInterval);
        return;
      }
      setItems(prev => {
        const updated: typeof prev = [];
        let missedAnItem = false;
        
        prev.forEach(item => {
          const nextY = item.y + 1.5;
          
          // Basket catch detection using active values
          if (gameModeRef.current === 'tilt') {
            const hitsBasket = nextY >= 80 && nextY <= 88 && Math.abs(item.x - basketXRef.current) <= 10;
            if (hitsBasket) {
              // Gamified combo multiplier: 1 + Math.floor(combo/5) bonus points!
              const comboBonus = Math.floor(comboRef.current / 5);
              const pointsEarned = 2 + comboBonus;
              setScore(s => s + pointsEarned);
              
              setCombo(c => {
                const nextCombo = c + 1;
                if (nextCombo > maxComboRef.current) {
                  setMaxCombo(nextCombo);
                }
                if (nextCombo > 0 && nextCombo % 5 === 0) {
                  triggerAudio('combo');
                }
                return nextCombo;
              });
              
              triggerAudio('pop');
              
              // Pop floating visual text for game feel
              const effectId = Date.now() + Math.random();
              let emotionEmoji = '⚡️';
              if (item.type === 'heart') emotionEmoji = '❤️';
              else if (item.type === 'sun') emotionEmoji = '☀️';
              else if (item.type === 'sparkles') emotionEmoji = '✨';
              else if (item.type === 'zap') emotionEmoji = '⚡️';
              else if (item.type === 'smile') emotionEmoji = '😊';
              
              setHitEffects(prevEffects => [
                ...prevEffects,
                { 
                  id: effectId, 
                  x: item.x, 
                  y: 80, 
                  text: `📥 收集! ${emotionEmoji} +${pointsEarned} 分${comboRef.current >= 4 ? ` (🔥 ${comboRef.current + 1}連擊!)` : ''}` 
                }
              ]);
              setTimeout(() => {
                setHitEffects(prevEffects => prevEffects.filter(e => e.id !== effectId));
              }, 750);
              
              return; // item caught/consumed
            }
          }

          if (nextY < 100) {
            updated.push({ ...item, y: nextY });
          } else {
            // Reached the bottom without being caught!
            missedAnItem = true;
          }
        });

        if (missedAnItem && gameModeRef.current === 'tilt') {
          // Reset combo with sound effect for game feel
          setCombo(prev => {
            if (prev > 0) {
              triggerAudio('miss');
            }
            return 0;
          });
        }

        return updated;
      });
    }, 50);

    return () => clearInterval(physicsInterval);
  }, [gameStarted]);

  // Click handler with combo system
  const handleItemClick = (id: number, x: number, y: number, type: string) => {
    if (gameMode === 'click') {
      const comboBonus = Math.floor(combo / 5);
      const pointsEarned = 1 + comboBonus;
      setScore(prev => prev + pointsEarned);
      
      setCombo(prevCombo => {
        const nextCombo = prevCombo + 1;
        if (nextCombo > maxCombo) {
          setMaxCombo(nextCombo);
        }
        if (nextCombo > 0 && nextCombo % 5 === 0) {
          triggerAudio('combo');
        }
        return nextCombo;
      });
      
      triggerAudio('hit');

      // Emoji mapping matching the mood items for rich satisfaction
      let emotionEmoji = '⚡️';
      if (type === 'heart') emotionEmoji = '❤️';
      else if (type === 'sun') emotionEmoji = '☀️';
      else if (type === 'sparkles') emotionEmoji = '✨';
      else if (type === 'zap') emotionEmoji = '⚡️';
      else if (type === 'smile') emotionEmoji = '😊';

      const effectId = Date.now() + Math.random();
      setHitEffects(prev => [
        ...prev,
        { 
          id: effectId, 
          x, 
          y, 
          text: `🔨 擊中! ${emotionEmoji} +${pointsEarned} 分${combo >= 4 ? ` (🔥 ${combo + 1}連擊!)` : ''}` 
        }
      ]);

      // Automatically clear after animation completes
      setTimeout(() => {
        setHitEffects(prev => prev.filter(e => e.id !== effectId));
      }, 750);

      setItems(prev => prev.filter(i => i.id !== id));
    }
  };

  return (
    <div className="p-6 md:p-10 flex flex-col items-center text-center gap-6 relative">
      {!gameStarted ? (
        <div className="space-y-6 w-full max-w-md">
          <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center text-blue-600 mx-auto shadow-inner relative">
            <Zap className="w-10 h-10 animate-pulse" />
            <div className="absolute -top-1 -right-1 bg-yellow-500 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-full">S3-IMU</div>
          </div>
          <div>
            <h2 className="text-3xl font-serif font-medium text-slate-900 mb-2">心情電力充電站 ⚡️</h2>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">
              本關已支援 <span className="text-blue-600 font-bold">ESP32-S3 體感控制器</span>！
              左右傾斜控制器，駕駛你的充電籃，收集落下的正能量！
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-2 text-left">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">控制模式選擇</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setGameMode('click')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${gameMode === 'click' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                🖱️ 滑鼠直接點擊
              </button>
              <button
                onClick={() => setGameMode('tilt')}
                className={`py-2 rounded-xl text-xs font-bold transition-all ${gameMode === 'tilt' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                🎮 ESP32-S3 / 鍵盤體感
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={onComplete}
              className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-[2rem] font-bold text-sm transition-all border border-slate-200 cursor-pointer"
            >
              🚪 返回關閉
            </button>
            <button 
              onClick={() => setGameStarted(true)}
              className="flex-[2] py-4 bg-blue-600 text-white rounded-[2rem] font-bold text-lg shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all transform hover:scale-105 active:scale-95 cursor-pointer"
            >
              啟動情緒發電機 ⚡️
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Stats Bar */}
          <div className="w-full flex items-center justify-between gap-4">
            <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 text-left">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none mb-0.5">目前得分 (Energy)</span>
              <span className="text-xl font-serif font-medium text-blue-600 font-mono">{score}</span>
            </div>

            {/* BGM & Interrupt Control Bar */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBgmEnabled(!bgmEnabled);
                  triggerAudio('pop');
                }}
                className={`p-2.5 rounded-xl border transition-all ${bgmEnabled ? 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100' : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'} cursor-pointer`}
                title={bgmEnabled ? '關閉背景音樂' : '開啟背景音樂'}
              >
                {bgmEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  triggerAudio('miss');
                  onComplete();
                }}
                className="px-3.5 py-2.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 text-rose-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>❌ 中斷充電</span>
              </button>
            </div>

            <div className={`px-4 py-2 rounded-2xl border ${timeLeft < 5 ? 'bg-red-50 text-red-500 border-red-100' : 'bg-slate-50 border-slate-100 text-slate-900'} text-right`}>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none mb-0.5">倒數計時</span>
              <span className="text-xl font-serif font-medium font-mono">{timeLeft}s</span>
            </div>
          </div>

          {/* Interactive Game Canvas */}
          <div 
            style={{ 
              cursor: gameMode === 'click' 
                ? 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\' style=\'font-size: 24px;\'><text y=\'24\'>🔨</text></svg>") 4 24, pointer'
                : 'default'
            }}
            className={`relative w-full aspect-[4/3] bg-gradient-to-b from-blue-50/10 to-indigo-50/20 rounded-[3rem] border-4 border-dashed overflow-hidden shadow-inner flex flex-col justify-between transition-colors duration-300 ${combo >= 5 ? 'border-yellow-400 bg-yellow-50/5' : 'border-slate-200'}`}
          >

            {/* Floating Combo Badge Overlay */}
            <AnimatePresence>
              {combo >= 2 && (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0, x: -10 }}
                  animate={{ scale: [1, 1.2, 1], opacity: 1, x: 0 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  className="absolute top-4 left-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-black text-xs px-3.5 py-2 rounded-full shadow-lg flex items-center gap-1.5 pointer-events-none z-10"
                >
                  <span className="animate-bounce">🔥</span>
                  <span>{combo} 連擊 !</span>
                  {combo >= 5 && <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full">加成 +{Math.floor(combo / 5)}</span>}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Falling items */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <AnimatePresence>
                {timeLeft > 0 && items.map(item => (
                  <motion.div
                    key={item.id}
                    className={`absolute p-2 ${item.color} drop-shadow-sm pointer-events-auto`}
                    style={{ left: `${item.x}%`, top: `${item.y}%`, transform: 'translate(-50%, -50%)' }}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                  >
                    <button
                      disabled={gameMode !== 'click'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleItemClick(item.id, item.x, item.y, item.type);
                      }}
                      style={{ cursor: gameMode === 'click' ? 'inherit' : 'default' }}
                    >
                      <item.icon className="w-10 h-10 animate-pulse" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Hit effects popups (Hammer sparkles, rating texts) */}
            <AnimatePresence>
              {hitEffects.map(effect => (
                <motion.div
                  key={effect.id}
                  initial={{ opacity: 1, y: 0, scale: 0.7 }}
                  animate={{ opacity: 0, y: -45, scale: 1.3, rotate: [0, -10, 10, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.65, ease: 'easeOut' }}
                  className="absolute pointer-events-none z-30 select-none"
                  style={{ left: `${effect.x}%`, top: `${effect.y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div className="absolute w-12 h-12 rounded-full border-2 border-yellow-400 bg-yellow-400/20 blur-sm animate-ping" />
                    <span className="text-[10px] font-black font-sans text-yellow-600 bg-white border-2 border-yellow-300 px-2.5 py-1 rounded-2xl shadow-xl flex items-center gap-1 whitespace-nowrap">
                      {effect.text}
                    </span>
                    <span className="text-[8px] text-yellow-500 font-black tracking-widest uppercase bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                      ⚡️ COMBO ACTIVE
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Tilt Control Help Hint overlay */}
            {gameMode === 'tilt' && (
              <div className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm px-4 py-1.5 rounded-full border border-slate-100 text-[10px] font-medium text-slate-500 uppercase tracking-wider flex items-center gap-1.5 pointer-events-none select-none z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                體感模式：傾斜控制器或使用 ← → 鍵
              </div>
            )}

            {gameMode === 'tilt' && onCalibrate && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCalibrate();
                  triggerAudio('pop');
                }}
                className="absolute top-3 right-48 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-[10px] px-3 py-1.5 rounded-full shadow-md transition-all flex items-center gap-1 z-20 cursor-pointer"
              >
                <span>🎯 校準零點</span>
              </button>
            )}

            {/* Bottom Element: Charge Basket (only visible in Tilt mode) */}
            <div className="mt-auto w-full h-16 relative border-t border-slate-100 bg-white/20 backdrop-blur-sm z-0 flex items-center">
              {gameMode === 'tilt' ? (
                <motion.div 
                  animate={{ left: `${basketX}%` }}
                  transition={{ type: 'spring', stiffness: 220, damping: 25 }}
                  className="absolute w-20 h-12 bg-blue-600 rounded-t-3xl border-t-4 border-yellow-400 flex items-center justify-center text-white font-bold text-xs shadow-xl -translate-x-1/2 bottom-0"
                >
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] uppercase tracking-widest leading-none text-blue-200">能量籃</span>
                    <span className="text-[14px]">🧺</span>
                  </div>
                </motion.div>
              ) : (
                <div className="w-full text-center text-xs font-bold text-slate-400 capitalize tracking-widest">
                  點擊落下的物件獲得能量
                </div>
              )}
            </div>

            {/* Game Over Screen */}
            {timeLeft <= 0 && (
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-8 backdrop-blur-sm z-[40]"
              >
                <div className="relative mb-4">
                  <Sparkles className="w-20 h-20 text-yellow-500 animate-spin-slow" />
                  <Heart className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-red-500 animate-pulse" />
                </div>
                <h3 className="text-3xl font-serif font-medium text-slate-900 mb-2">太棒了！充電完成 ⚡️</h3>
                <div className="text-slate-500 font-medium mb-6 text-sm max-w-sm leading-relaxed space-y-1">
                  <div>你總共收集了 <span className="text-blue-600 font-black text-xl">{score}</span> 個心情能量值！</div>
                  <div>最高連續收集：<span className="text-amber-500 font-black text-xl">🔥 {maxCombo}</span> 連擊！</div>
                  <div className="text-xs text-slate-400 pt-2">這份蓬勃的情緒電力已儲存至您的學習護照！</div>
                </div>
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
}
