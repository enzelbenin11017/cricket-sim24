import React, { useEffect, useState, useRef } from 'react';
import { BallHistory } from '../types';
import { Volume2, VolumeX, Radio, Sparkles } from 'lucide-react';

interface CommentaryBoxProps {
  currentCommentaryList: string[];
  ballHistory: BallHistory[];
  lastBall?: BallHistory;
}

const COMMENTATOR_VOICES = [
  { name: 'R. Shastri', tone: 'Booming Echo' },
  { name: 'N. Hussain', tone: 'Analytical Slate' },
  { name: 'H. Bhogle', tone: 'Poetic Flow' },
  { name: 'M. Atherton', tone: 'Classic English' }
];

export const CommentaryBox: React.FC<CommentaryBoxProps> = ({
  currentCommentaryList,
  ballHistory,
  lastBall
}) => {
  const [commentator, setCommentator] = useState(COMMENTATOR_VOICES[0]);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pick a commentator on mount or on new delivery
  useEffect(() => {
    const randomComm = COMMENTATOR_VOICES[Math.floor(Math.random() * COMMENTATOR_VOICES.length)];
    setCommentator(randomComm);
  }, [lastBall]);

  // Scroll to bottom on new commentary lines
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [currentCommentaryList]);

  // Optionally perform Text-to-Speech (browser SpeechSynthesis) if not muted
  useEffect(() => {
    if (!isMuted && currentCommentaryList.length > 0) {
      const lastLine = currentCommentaryList[currentCommentaryList.length - 1];
      try {
        window.speechSynthesis?.cancel();
        const utterance = new SpeechSynthesisUtterance(lastLine);
        utterance.rate = 1.05;
        utterance.pitch = commentator.name === 'R. Shastri' ? 0.9 : 1.1;
        window.speechSynthesis?.speak(utterance);
      } catch (e) {
        console.warn('TTS failed to speak:', e);
      }
    }
  }, [currentCommentaryList, isMuted, commentator]);

  return (
    <div className="w-full flex flex-col bg-[#0A0F0D]/90 border border-white/10 rounded-xl overflow-hidden shadow-2xl font-sans" id="commentary-box">
      {/* Header Panel */}
      <div className="bg-black/80 border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-brand-emerald rounded-full animate-ping shadow-[0_0_8px_#00FF85]" />
          <Radio size={14} className="text-brand-emerald" />
          <span className="text-[10px] font-black text-neutral-300 uppercase tracking-widest">Live Broadcast Box</span>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Commentator Bio */}
          <span className="text-[10px] text-neutral-300 font-bold flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded border border-white/10">
            <Sparkles size={10} className="text-brand-emerald" /> MIC: {commentator.name}
          </span>
          {/* TTS Audio Toggle */}
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-1.5 rounded transition-all border ${
              isMuted 
                ? 'bg-white/5 hover:bg-white/10 text-neutral-400 border-white/10' 
                : 'bg-brand-emerald hover:bg-brand-emerald/90 text-black border-brand-emerald font-black'
            }`}
            title={isMuted ? 'Turn on voice commentary' : 'Mute voice'}
          >
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        </div>
      </div>

      {/* Scroller Content */}
      <div 
        ref={containerRef}
        className="p-4 h-36 overflow-y-auto bg-black/40 flex flex-col gap-3 scrollbar-thin scroll-smooth"
      >
        {currentCommentaryList.length === 0 ? (
          <div className="text-neutral-500 text-xs italic text-center py-8">
            The bowlers are warming up. The turf looks emerald green under the modern arena floodlights.
          </div>
        ) : (
          currentCommentaryList.map((line, idx) => {
            const isFourOrSix = line.startsWith('SIX') || line.startsWith('FOUR') || line.includes('6 runs') || line.includes('4 runs');
            const isWicket = line.startsWith('OUT') || line.includes('falls') || line.includes('WICKET');
            
            let lineStyle = 'text-neutral-300';
            let borderStyle = 'border-white/5';
            
            if (isWicket) {
              lineStyle = 'text-red-400 font-black';
              borderStyle = 'border-red-500/30 bg-red-950/20';
            } else if (isFourOrSix) {
              lineStyle = 'text-brand-emerald font-extrabold text-glow-emerald';
              borderStyle = 'border-brand-emerald/30 bg-brand-emerald/5';
            }

            return (
              <div 
                key={idx} 
                className={`text-xs leading-relaxed p-2 rounded border transition-all duration-300 animate-fadeIn ${lineStyle} ${borderStyle}`}
              >
                <span className="text-[9px] text-neutral-500 font-mono mr-2 uppercase tracking-wide">
                  [LIVE COMMENTARY]
                </span>
                {line}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
