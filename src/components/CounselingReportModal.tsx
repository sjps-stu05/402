import React, { useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  X, FileDown, Sparkles, Sun, Cloud, CloudRain, CloudLightning, Calendar, Tag, Check, Award
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { SELData, MoodType } from '../types';

interface CounselingReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: string;
  data: SELData;
  keywordCounts: { word: string; count: number }[];
  highestMoodInfo: {
    mood: MoodType;
    label: string;
    color: string;
    icon: string;
    tips: string[];
    desc: string;
  };
  summaryReport: string;
  onGenerateAIReport: () => Promise<void>;
  isGeneratingReport: boolean;
}

export default function CounselingReportModal({
  isOpen,
  onClose,
  selectedMonth,
  data,
  keywordCounts,
  highestMoodInfo,
  summaryReport,
  onGenerateAIReport,
  isGeneratingReport
}: CounselingReportModalProps) {
  const reportRef = useRef<HTMLDivElement | null>(null);

  // Filter trends data for selected month only
  const monthChartData = useMemo(() => {
    return data.moodHistory
      .filter(day => day.date.startsWith(selectedMonth))
      .map(day => {
        const moodsArray = Object.values(day.moods) as MoodType[];
        const counts = moodsArray.reduce((acc, mood) => {
          acc[mood] = (acc[mood] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        return {
          date: day.date.split('-')[2] + '日', // Display DD only for month view to keep it clean
          sun: counts['sun'] || 0,
          cloud: counts['cloud'] || 0,
          rain: counts['rain'] || 0,
          storm: counts['storm'] || 0,
        };
      });
  }, [data.moodHistory, selectedMonth]);

  // Aggregate stats for the month
  const stats = useMemo(() => {
    let sun = 0;
    let cloud = 0;
    let rain = 0;
    let storm = 0;
    let totalSignIns = 0;

    data.moodHistory
      .filter(day => day.date.startsWith(selectedMonth))
      .forEach(day => {
        Object.values(day.moods).forEach(mood => {
          if (mood === 'sun') sun++;
          else if (mood === 'cloud') cloud++;
          else if (mood === 'rain') rain++;
          else if (mood === 'storm') storm++;
          totalSignIns++;
        });
      });

    return { sun, cloud, rain, storm, total: totalSignIns };
  }, [data.moodHistory, selectedMonth]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[120] flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-slate-100 rounded-[2.5rem] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Top Header */}
        <div className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 font-serif">輔導報告匯出預覽</h3>
              <p className="text-xs text-slate-400 font-medium">預覽並匯出 A4 規格班級情緒氣象分析報告</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Native browser print button - 100% reliable vector PDF generation */}
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>向量列印 / 另存 A4 PDF (最推薦)</span>
            </button>
            
            <button 
              onClick={onClose}
              className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center bg-slate-50 gap-6">
          
          {/* A4 Paper Canvas */}
          <div 
            ref={reportRef}
            style={{ width: '210mm', minHeight: '297mm' }}
            className="bg-white text-slate-800 p-[20mm] shadow-lg border border-slate-200/60 rounded-sm font-sans flex flex-col justify-between shrink-0"
            id="report-printable-area"
          >
            <div>
              {/* Report Header */}
              <div className="border-b-2 border-indigo-600 pb-5 mb-8 flex justify-between items-end">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-extrabold tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md uppercase">
                      班級輔導專用
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold font-serif text-slate-900 tracking-tight">
                    班級情緒氣象與輔導分析報告
                  </h1>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5 justify-end text-slate-500 font-bold text-xs mb-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>統計月份：{selectedMonth.replace('-', '年 ')}月</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    產出時間：{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </span>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 flex flex-col items-center text-center">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-500 mb-1.5">
                    <Sun className="w-4.5 h-4.5 fill-amber-100" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold block">大太陽 (晴天)</span>
                  <span className="text-lg font-black text-amber-600 mt-0.5">{stats.sun} <span className="text-[10px] font-medium text-slate-400">次</span></span>
                </div>

                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex flex-col items-center text-center">
                  <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-1.5">
                    <Cloud className="w-4.5 h-4.5 fill-slate-100" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold block">多雲 (陰天)</span>
                  <span className="text-lg font-black text-slate-600 mt-0.5">{stats.cloud} <span className="text-[10px] font-medium text-slate-400">次</span></span>
                </div>

                <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-3 flex flex-col items-center text-center">
                  <div className="w-8 h-8 bg-blue-100/60 rounded-full flex items-center justify-center text-blue-500 mb-1.5">
                    <CloudRain className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold block">雨天 (低落)</span>
                  <span className="text-lg font-black text-blue-600 mt-0.5">{stats.rain} <span className="text-[10px] font-medium text-slate-400">次</span></span>
                </div>

                <div className="bg-purple-50/40 border border-purple-100 rounded-xl p-3 flex flex-col items-center text-center">
                  <div className="w-8 h-8 bg-purple-100/50 rounded-full flex items-center justify-center text-purple-600 mb-1.5">
                    <CloudLightning className="w-4.5 h-4.5" />
                  </div>
                  <span className="text-[10px] text-slate-400 font-bold block">暴風雨 (憤怒)</span>
                  <span className="text-lg font-black text-purple-600 mt-0.5">{stats.storm} <span className="text-[10px] font-medium text-slate-400">次</span></span>
                </div>
              </div>

              {/* Main Contents Section (Grid of Chart and Word Cloud) */}
              <div className="grid grid-cols-3 gap-6 mb-8">
                {/* Chart Preview */}
                <div className="col-span-2 border border-slate-100 bg-slate-50/40 rounded-2xl p-5">
                  <h3 className="text-xs font-bold text-slate-700 mb-3.5 flex items-center gap-1.5">
                    <div className="w-1.5 h-3 bg-indigo-500 rounded-full" />
                    本月情緒氣象起伏趨勢圖
                  </h3>
                  {monthChartData.length > 0 ? (
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} />
                          <Line type="monotone" dataKey="sun" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2.5, fill: '#f59e0b' }} isAnimationActive={false} />
                          <Line type="monotone" dataKey="cloud" stroke="#9ca3af" strokeWidth={2} dot={{ r: 2.5, fill: '#9ca3af' }} isAnimationActive={false} />
                          <Line type="monotone" dataKey="rain" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2.5, fill: '#3b82f6' }} isAnimationActive={false} />
                          <Line type="monotone" dataKey="storm" stroke="#a855f7" strokeWidth={2} dot={{ r: 2.5, fill: '#a855f7' }} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[180px] flex items-center justify-center text-xs text-slate-400 font-medium">
                      本月尚無情緒氣象簽到記錄
                    </div>
                  )}
                </div>

                {/* Word Cloud Preview */}
                <div className="border border-slate-100 bg-slate-50/40 rounded-2xl p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-500" />
                      情緒詞出現頻率
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {keywordCounts.slice(0, 8).map(({ word, count }) => (
                        <span 
                          key={word} 
                          className={`text-[10px] px-2 py-0.5 rounded-full border border-slate-200/50 ${
                            count > 6 ? 'bg-amber-50 text-amber-700 font-bold border-amber-100' : 'bg-slate-50 text-slate-600'
                          }`}
                        >
                          #{word}({count})
                        </span>
                      ))}
                      {keywordCounts.length === 0 && (
                        <span className="text-[10px] text-slate-400">無記錄情緒詞</span>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 text-[9px] text-slate-400 font-medium leading-relaxed">
                    根據每日心情自述日誌中詞頻統計得出。
                  </div>
                </div>
              </div>

              {/* Weather Tips (氣象小叮嚀) */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-8">
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-xl border shrink-0 ${highestMoodInfo.color}`}>
                    {highestMoodInfo.icon === 'sun' && <Sun className="w-5 h-5 text-amber-500 fill-amber-100/40" />}
                    {highestMoodInfo.icon === 'cloud' && <Cloud className="w-5 h-5 text-slate-400 fill-slate-100/30" />}
                    {highestMoodInfo.icon === 'rain' && <CloudRain className="w-5 h-5 text-blue-500 fill-blue-100/30" />}
                    {highestMoodInfo.icon === 'storm' && <CloudLightning className="w-5 h-5 text-purple-600 fill-purple-100/30" />}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-800">導師氣象小叮嚀 (最高指標：{highestMoodInfo.label})</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      {highestMoodInfo.desc}
                    </p>
                    <ul className="grid grid-cols-1 gap-1.5 pt-1">
                      {highestMoodInfo.tips.map((tip, idx) => (
                        <li key={idx} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                          <span className="text-amber-500 font-bold shrink-0">•</span>
                          <span className="leading-relaxed font-medium">{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* AI Report Analysis Highlights */}
              <div className="bg-indigo-50/30 border border-indigo-100/60 rounded-2xl p-6 mb-8">
                <div className="flex items-center gap-1.5 mb-3.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-xs font-extrabold text-indigo-900 uppercase tracking-wider">
                    AI 班級情緒起伏與成長亮點
                  </h3>
                </div>
                
                {summaryReport ? (
                  <div className="text-[11px] text-slate-600 font-medium leading-relaxed space-y-2 whitespace-pre-wrap">
                    {summaryReport.slice(0, 600)} {/* Keeps the text clean and well-fit on A4 */}
                    {summaryReport.length > 600 && <span className="text-[10px] text-slate-400 block mt-1">(下略部分報告內容，詳細內容請至 AI 儀表板檢視...)</span>}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-[11px] text-slate-400 font-medium mb-3">
                      尚未產出本週的 AI 情緒修復與關懷報告亮點。
                    </p>
                    <button
                      onClick={onGenerateAIReport}
                      disabled={isGeneratingReport}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-xl shadow-sm transition-all"
                    >
                      {isGeneratingReport ? (
                        <>
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>AI 分析中...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          <span>立即啟動 AI 亮點分析</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Signature Block & Footer */}
            <div className="border-t border-slate-200 pt-6 mt-10">
              <div className="flex justify-between items-center text-xs text-slate-500 font-semibold mb-8">
                <div className="w-1/3">
                  <p className="mb-8">班級導師簽名：____________________</p>
                </div>
                <div className="w-1/3 text-right">
                  <p className="mb-8">輔導主任 / 心理師簽章：____________________</p>
                </div>
              </div>
              <div className="flex justify-between items-center text-[9px] text-slate-400 font-medium">
                <span>學生總體簽到人次：{stats.total} 人次</span>
                <span>第 1 頁，共 1 頁</span>
              </div>
            </div>

          </div>

        </div>
      </motion.div>
    </div>
  );
}
