'use client';

import { useState, useEffect } from 'react';

interface AiVoiceSummaryProps {
    text: string;
    className?: string;
}

export function AiVoiceSummary({ text, className }: AiVoiceSummaryProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [supported, setSupported] = useState(false);
    const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            setSupported(true);

            const loadVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                // Try to find a good Spanish voice (Google Desktop or Microsoft)
                const esVoices = voices.filter(v => v.lang.startsWith('es-'));

                // Prioritize Premium or Google voices if they exist, otherwise pick first ES voice
                const preferred = esVoices.find(v => v.name.includes('Google') || v.name.includes('Premium')) || esVoices[0] || voices[0];
                setVoice(preferred);
            };

            loadVoices();
            if (speechSynthesis.onvoiceschanged !== undefined) {
                speechSynthesis.onvoiceschanged = loadVoices;
            }
        }

        return () => {
            if (window.speechSynthesis) window.speechSynthesis.cancel();
        };
    }, []);

    const togglePlay = () => {
        if (!supported) return;

        if (isPlaying) {
            window.speechSynthesis.cancel();
            setIsPlaying(false);
        } else {
            const utterance = new SpeechSynthesisUtterance(text);
            if (voice) utterance.voice = voice;
            utterance.rate = 1.05; // Slightly faster for a more "snappy" AI feel
            utterance.pitch = 1.1; // Slightly higher

            utterance.onend = () => setIsPlaying(false);
            utterance.onerror = () => setIsPlaying(false);

            setIsPlaying(true);
            window.speechSynthesis.speak(utterance);
        }
    };

    if (!supported) return null;

    return (
        <button
            onClick={togglePlay}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all border shadow-lg ${isPlaying
                ? 'bg-primary/20 border-primary text-primary shadow-primary/20 animate-pulse-slow'
                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                } ${className || ''}`}
            title="Escuchar análisis sintético"
        >
            <span className="material-symbols-outlined text-[18px]">
                {isPlaying ? 'stop_circle' : 'play_circle'}
            </span>
            <span className="text-xs font-bold font-mono tracking-wider">
                {isPlaying ? 'PLAYING...' : 'AI AUDIO'}
            </span>

            {isPlaying && (
                <div className="flex items-center gap-0.5 ml-1 h-3">
                    <span className="w-1 bg-primary rounded-full animate-soundwave-1"></span>
                    <span className="w-1 bg-primary rounded-full animate-soundwave-2"></span>
                    <span className="w-1 bg-primary rounded-full animate-soundwave-3"></span>
                </div>
            )}
        </button>
    );
}
