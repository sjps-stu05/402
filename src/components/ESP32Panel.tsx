import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Cpu, RotateCcw, Zap, HelpCircle, 
  Activity, Play, Pause, RefreshCw, AlertCircle, Bluetooth
} from 'lucide-react';

interface ESP32PanelProps {
  esp32Connected: boolean;
  esp32Virtual: boolean;
  esp32IMU: { ax: number; ay: number; az: number; gx: number; gy: number; gz: number };
  esp32StablePercent: number;
  activeGesture: string | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
  onToggleVirtual: (active: boolean) => void;
  onSimulateIMU: (ax: number, ay: number, az: number) => void;
  onSimulateGesture: (gesture: string) => void;
  bleConnected?: boolean;
  bleOffset?: number;
  bleDeviceName?: string;
  onBLEConnect?: () => Promise<void>;
  onBLEDisconnect?: () => void;
  bleBias?: number;
  ayBias?: number;
  onCalibrate?: () => void;
}

export default function ESP32Panel({
  esp32Connected,
  esp32Virtual,
  esp32IMU,
  esp32StablePercent,
  activeGesture,
  onConnect,
  onDisconnect,
  onToggleVirtual,
  onSimulateIMU,
  onSimulateGesture,
  bleConnected = false,
  bleOffset = 0,
  bleDeviceName = '',
  onBLEConnect,
  onBLEDisconnect,
  bleBias = 0,
  ayBias = 0,
  onCalibrate
}: ESP32PanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [ledColor, setLedColor] = useState('#64748b'); // default gray
  const [shakeIntensity, setShakeIntensity] = useState(0);

  // Synchronize pitch/roll adjustments to IMU values
  useEffect(() => {
    if (esp32Virtual) {
      // Calculate ax, ay, az from pitch and roll (angles in degrees)
      const rRad = (roll * Math.PI) / 180;
      const pRad = (pitch * Math.PI) / 180;
      
      // Simple projection:
      const ax = parseFloat((9.8 * Math.sin(pRad)).toFixed(2));
      const ay = parseFloat((-9.8 * Math.sin(rRad) * Math.cos(pRad)).toFixed(2));
      const az = parseFloat((9.8 * Math.cos(rRad) * Math.cos(pRad)).toFixed(2));
      
      onSimulateIMU(ax, ay, az);
    }
  }, [pitch, roll, esp32Virtual]);

  // Handle NeoPixel RGB status flashing
  useEffect(() => {
    if (activeGesture === 'sun') {
      // sun: yellow flashing
      setLedColor('#f59e0b');
    } else if (activeGesture === 'storm') {
      // storm: purple flashing
      setLedColor('#a855f7');
    } else if (activeGesture === 'rain') {
      // rain: blue breathing pulsing
      setLedColor('#3b82f6');
    } else if (activeGesture === 'cloud') {
      // cloud: gray steady dim
      setLedColor('#94a3b8');
    } else {
      setLedColor('#64748b');
    }
  }, [activeGesture]);

  const handleVirtualShake = () => {
    if (!esp32Virtual) return;
    setShakeIntensity(20);
    onSimulateGesture('storm');
    
    // Animate decaying shake intensity over time
    let localInt = 20;
    const interval = setInterval(() => {
      localInt -= 4;
      if (localInt <= 0) {
        clearInterval(interval);
        setShakeIntensity(0);
      } else {
        setShakeIntensity(localInt);
        // Add random shake noise to IMU simulating storm
        const sax = (Math.random() - 0.5) * localInt;
        const say = (Math.random() - 0.5) * localInt;
        const saz = 9.8 + (Math.random() - 0.5) * localInt;
        onSimulateIMU(parseFloat(sax.toFixed(2)), parseFloat(say.toFixed(2)), parseFloat(saz.toFixed(2)));
      }
    }, 100);
  };

  const resetSliders = () => {
    setPitch(0);
    setRoll(0);
    onSimulateIMU(0, 0, 9.8);
  };

  return (
    <div className="fixed bottom-24 md:bottom-6 right-6 z-[100] flex flex-col items-end gap-2">
      {/* Floating Status Indicator Badge */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 ${
          esp32Connected 
            ? 'bg-green-600 text-white' 
            : bleConnected
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
            : esp32Virtual 
            ? 'bg-blue-600 text-white animate-pulse' 
            : 'bg-slate-900 hover:bg-slate-800 text-white'
        }`}
      >
        <Cpu className={`w-5 h-5 ${esp32Connected || bleConnected || esp32Virtual ? 'animate-spin-slow' : ''}`} />
        <span className="text-xs font-bold font-mono">
          {esp32Connected ? 'ESP32-S3: 實體串口連線' : bleConnected ? `ESP32-S3: 藍牙已連線 (${bleDeviceName})` : esp32Virtual ? 'ESP32-S3: 模擬器啟動' : '🎮 體感控制器連線'}
        </span>
        <div className={`w-2.5 h-2.5 rounded-full ${esp32Connected ? 'bg-emerald-400' : bleConnected ? 'bg-indigo-400' : esp32Virtual ? 'bg-cyan-400' : 'bg-slate-500'}`} />
      </button>

      {/* Controller Drawer / Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-80 md:w-96 bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden p-6 gap-4 flex flex-col max-h-[80vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Cpu className="text-blue-600 w-5 h-5" />
                <h4 className="font-bold text-slate-800 text-base">ESP32-S3 MotionGame 控制台</h4>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                關閉
              </button>
            </div>

            {/* Connection and Hardware Mode */}
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">硬體連線模式</label>
              
              <div className="grid grid-cols-2 gap-2">
                {!esp32Connected ? (
                  <button
                    onClick={onConnect}
                    className="py-2.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 border border-green-200"
                  >
                    <Activity className="w-4 h-4" /> 網頁串口
                  </button>
                ) : (
                  <button
                    onClick={onDisconnect}
                    className="py-2.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 border border-red-200"
                  >
                    斷開串口
                  </button>
                )}

                {!bleConnected ? (
                  <button
                    onClick={onBLEConnect}
                    className="py-2.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 border border-indigo-200"
                  >
                    <Bluetooth className="w-4 h-4" /> 藍牙配對
                  </button>
                ) : (
                  <button
                    onClick={onBLEDisconnect}
                    className="py-2.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 border border-red-200"
                  >
                    斷開藍牙
                  </button>
                )}
              </div>

              <button
                onClick={() => onToggleVirtual(!esp32Virtual)}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 border ${
                  esp32Virtual 
                    ? 'bg-blue-600 text-white border-blue-600' 
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
                }`}
              >
                {esp32Virtual ? '停用體感虛擬機' : '開啟體感虛擬機'}
              </button>

              {(!('serial' in navigator)) && (
                <p className="text-[10px] text-amber-500 font-medium leading-normal flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  此瀏覽器在 iframe 內限制 Web Serial，建議點擊「藍牙配對 (BLE)」或「開啟體感虛擬機」來操作體感功能！
                </p>
              )}
            </div>

            {/* Simulated/Real Dashboard Display */}
            {(esp32Connected || esp32Virtual || bleConnected) && (
              <div className="space-y-4 pt-2 border-t border-slate-100">
                {/* 3D SVG Board Illustration */}
                <div className="bg-slate-900 rounded-2xl p-4 flex flex-col items-center justify-center relative overflow-hidden h-36">
                  {/* Cosmic Background Accent */}
                  <div className="absolute inset-0 bg-radial-gradient from-blue-900/40 to-transparent pointer-events-none" />
                  
                  {/* Rotating vector ESP32S3 Board based on virtual tilt values */}
                  <motion.div
                    animate={{ 
                      rotateX: pitch, 
                      rotateY: roll,
                      x: (Math.random() - 0.5) * shakeIntensity * 1.5,
                      y: (Math.random() - 0.5) * shakeIntensity * 1.5,
                    }}
                    transition={{ type: 'spring', stiffness: 100, damping: 10 }}
                    className="w-36 h-20 bg-[#1e293b] rounded-md border-2 border-slate-700 relative flex flex-col items-center justify-between p-2 shadow-2xl"
                    style={{ transformStyle: 'preserve-3d', perspective: 400 }}
                  >
                    {/* Header Ports */}
                    <div className="w-6 h-1.5 bg-silver border border-slate-500 rounded-b absolute -top-0.5 left-1/2 -translate-x-1/2" title="USB-C Port" />
                    
                    {/* Left Golden Pins */}
                    <div className="absolute left-0.5 top-2 bottom-2 w-1 flex flex-col justify-between gap-0.5">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="w-1 h-1 bg-yellow-500 rounded-sm" />
                      ))}
                    </div>
                    {/* Right Golden Pins */}
                    <div className="absolute right-0.5 top-2 bottom-2 w-1 flex flex-col justify-between gap-0.5">
                      {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="w-1 h-1 bg-yellow-500 rounded-sm" />
                      ))}
                    </div>

                    {/* Espressif Chip */}
                    <div className="w-10 h-10 bg-slate-800 rounded border border-slate-600 flex items-center justify-center text-[6px] text-slate-300 font-mono text-center leading-none p-1">
                      ESP32-S3<br />IMU-SYS
                    </div>

                    {/* Blinking RGB LED (NeoPixel) */}
                    <div className="absolute top-2 right-4 flex flex-col items-center gap-0.5">
                      <motion.div
                        animate={{ 
                          scale: [1, 1.2, 1],
                          boxShadow: [`0 0 4px ${ledColor}`, `0 0 16px ${ledColor}`, `0 0 4px ${ledColor}`] 
                        }}
                        transition={{ repeat: Infinity, duration: activeGesture === 'storm' ? 0.2 : activeGesture === 'rain' ? 1.5 : 0.8 }}
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: ledColor }}
                      />
                      <span className="text-[5px] text-slate-400 uppercase font-mono">RGB</span>
                    </div>

                    {/* Dynamic Label */}
                    <div className="text-[8px] font-mono font-bold text-slate-400 select-none">
                      {activeGesture ? `G: ${activeGesture.toUpperCase()}` : 'IDLE'}
                    </div>
                  </motion.div>
                </div>

                {/* IMU variables & Stability monitoring */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400 font-medium">運動穩定度 (Stability)</span>
                    <span className={`font-black text-sm ${esp32StablePercent > 90 ? 'text-green-600' : esp32StablePercent > 60 ? 'text-yellow-600' : 'text-red-500 animate-pulse'}`}>
                      {esp32StablePercent}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${esp32StablePercent > 90 ? 'bg-green-500' : esp32StablePercent > 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${esp32StablePercent}%` }}
                    />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-[10px] text-slate-500">
                    <div>
                      <span className="text-slate-400">Acc X:</span> {esp32IMU.ax.toFixed(2)}
                    </div>
                    <div>
                      <span className="text-slate-400">Acc Y:</span> {esp32IMU.ay.toFixed(2)}
                    </div>
                    <div>
                      <span className="text-slate-400">Acc Z:</span> {esp32IMU.az.toFixed(2)}
                    </div>
                  </div>

                  {bleConnected && (
                    <div className="space-y-1 mt-2 pt-2 border-t border-slate-100 font-mono text-xs">
                      <div className="flex items-center justify-between text-indigo-600">
                        <span className="font-bold flex items-center gap-1"><Bluetooth className="w-3.5 h-3.5" /> 藍牙原始傾角:</span>
                        <span className="font-bold">{bleOffset > 0 ? `+${bleOffset}` : bleOffset}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>校準基準偏角 (Bias):</span>
                        <span>{bleBias > 0 ? `+${bleBias}` : bleBias}</span>
                      </div>
                      <div className="flex items-center justify-between text-emerald-600 font-bold">
                        <span>有效體感傾角 (Active):</span>
                        <span>{Math.max(-100, Math.min(100, bleOffset - bleBias))}</span>
                      </div>
                    </div>
                  )}

                  {ayBias !== 0 && (esp32Connected || esp32Virtual) && (
                    <div className="space-y-1 mt-2 pt-2 border-t border-slate-100 font-mono text-xs text-slate-500">
                      <div className="flex items-center justify-between">
                        <span>校準基準 Y 軸 Acc:</span>
                        <span>{ayBias.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-emerald-600 font-bold">
                        <span>有效 Y 軸 Acc:</span>
                        <span>{(esp32IMU.ay - ayBias).toFixed(2)}</span>
                      </div>
                    </div>
                  )}

                  {onCalibrate && (esp32Connected || bleConnected || esp32Virtual) && (
                    <button
                      onClick={onCalibrate}
                      className="w-full mt-3 py-2 bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-105 active:scale-98 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>🎯 點擊校準當前姿勢為零點 (Calibrate)</span>
                    </button>
                  )}
                </div>

                {/* Virtual Simulation Sliders & Gesture Hotkeys */}
                {esp32Virtual && (
                  <div className="space-y-4 border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">虛擬體感面板</span>
                      <button 
                        onClick={resetSliders} 
                        className="p-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center gap-1 transition-all"
                        title="重設控制器姿態"
                      >
                        <RotateCcw className="w-3 h-3" /> 重置
                      </button>
                    </div>

                    {/* Tilt Slider Controls */}
                    <div className="space-y-2.5">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1 text-slate-500 font-bold">
                          <span>前後俯仰 (Pitch / Y軸 Acc)</span>
                          <span className="font-mono">{pitch}°</span>
                        </div>
                        <input
                          type="range"
                          min="-45"
                          max="45"
                          step="1"
                          value={pitch}
                          onChange={(e) => setPitch(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] mb-1 text-slate-500 font-bold">
                          <span>左右翻滾 (Roll / X軸 Acc)</span>
                          <span className="font-mono">{roll}°</span>
                        </div>
                        <input
                          type="range"
                          min="-45"
                          max="45"
                          step="1"
                          value={roll}
                          onChange={(e) => setRoll(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                      </div>
                    </div>

                    {/* Pre-made Action Simulators */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">快捷肢體手勢模擬</span>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setPitch(40);
                            onSimulateGesture('sun');
                            setTimeout(() => {
                              setPitch(0);
                            }, 1000);
                          }}
                          className="p-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 border border-yellow-200 rounded-xl text-[10px] font-bold transition-all text-left flex items-center gap-1"
                        >
                          ☀️ 跳躍大太陽
                        </button>
                        <button
                          onClick={handleVirtualShake}
                          className="p-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-xl text-[10px] font-bold transition-all text-left flex items-center gap-1"
                        >
                          ⛈️ 怒擺暴風雨
                        </button>
                        <button
                          onClick={() => {
                            setRoll(-40);
                            onSimulateGesture('rain');
                          }}
                          className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-[10px] font-bold transition-all text-left flex items-center gap-1"
                        >
                          🌧️ 緩垂雨天 (Sad)
                        </button>
                        <button
                          onClick={() => {
                            setRoll(0);
                            setPitch(0);
                            onSimulateGesture('cloud');
                          }}
                          className="p-2 bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 rounded-xl text-[10px] font-bold transition-all text-left flex items-center gap-1"
                        >
                          ☁️ 平托多雲 (Calm)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
