import React, { useState, useRef, useEffect } from 'react';
import { generateRevolutionarySpeech, generatePoemText } from './services/geminiService';
import { FULL_POEM_TEXT } from './types';
import { AudioPlayer } from './components/AudioPlayer';

type AppMode = 'GENERATE' | 'EDIT';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('GENERATE');
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  
  // Generation State
  const [topic, setTopic] = useState('');
  const [mood, setMood] = useState('Biplobi (Revolutionary)');
  const [style, setStyle] = useState('Kazi Nazrul Islam');
  const [isGeneratingText, setIsGeneratingText] = useState(false);

  // Audio/Playback State
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [poemText, setPoemText] = useState(FULL_POEM_TEXT);

  // Refs for visual effects
  const redPulseRef = useRef<HTMLDivElement>(null);
  const splatterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bgBlob1Ref = useRef<HTMLDivElement>(null);
  const bgBlob2Ref = useRef<HTMLDivElement>(null);
  const smoothedIntensityRef = useRef(0);

  // Initial Key Check
  useEffect(() => {
    const checkKey = async () => {
      if (typeof (window as any).aistudio?.hasSelectedApiKey === 'function') {
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        setHasKey(true); // Fallback if environment doesn't use selection logic
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (typeof (window as any).aistudio?.openSelectKey === 'function') {
      await (window as any).aistudio.openSelectKey();
      setHasKey(true); // Proceed assuming success
    }
  };

  /**
   * Optimized MP3 encoding using the global lamejs library
   */
  const audioBufferToMp3 = async (buffer: AudioBuffer): Promise<Blob> => {
    const channels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitrate = 96; 
    
    // Access lamejs from window to avoid scoping issues with its internal constants
    const lame = (window as any).lamejs;
    if (!lame) {
      throw new Error("lamejs library not loaded properly.");
    }
    
    const mp3encoder = new lame.Mp3Encoder(channels, sampleRate, bitrate);
    const mp3Data: any[] = [];
    const samplesL = buffer.getChannelData(0);
    const samplesR = channels > 1 ? buffer.getChannelData(1) : null;

    const floatTo16BitPCM = (input: Float32Array) => {
      const output = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const s = input[i];
        output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return output;
    };

    const left = floatTo16BitPCM(samplesL);
    const right = samplesR ? floatTo16BitPCM(samplesR) : null;
    const sampleBlockSize = 1152;

    for (let i = 0; i < left.length; i += sampleBlockSize) {
      const leftChunk = left.subarray(i, i + sampleBlockSize);
      let mp3buf;
      if (right) {
        const rightChunk = right.subarray(i, i + sampleBlockSize);
        mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      } else {
        mp3buf = mp3encoder.encodeBuffer(leftChunk);
      }
      if (mp3buf.length > 0) mp3Data.push(mp3buf);
    }

    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
    return new Blob(mp3Data, { type: 'audio/mp3' });
  };

  const handleDownload = async () => {
    if (!audioBuffer) return;
    setIsDownloading(true);
    setError(null);
    try {
      await new Promise(r => setTimeout(r, 50));
      const blob = await audioBufferToMp3(audioBuffer);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `BengaliPoem_${Date.now()}.mp3`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Download failed:", err);
      setError(`Download failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleTextGeneration = async () => {
    if (!topic.trim()) {
      setError("Please enter a topic.");
      return;
    }
    
    setIsGeneratingText(true);
    setError(null);
    
    try {
      const generated = await generatePoemText(topic, mood, style);
      setPoemText(generated);
      setMode('EDIT');
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Requested entity was not found")) {
        setHasKey(false);
        setError("API authentication failed. Please select your API key.");
      } else {
        setError("Poem generation failed. Please try again or check your API key.");
      }
    } finally {
      setIsGeneratingText(false);
    }
  };

  const handleGenerateAndPlay = async () => {
    if (!poemText.trim()) {
        setError("Text is empty.");
        return;
    }

    setIsLoadingAudio(true);
    setError(null);
    setAudioBuffer(null);

    try {
      const buffer = await generateRevolutionarySpeech(poemText);
      setAudioBuffer(buffer);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("Requested entity was not found")) {
        setHasKey(false);
        setError("API authentication failed. Please select your API key.");
      } else {
        setError(err.message || "Failed to generate speech. Ensure you have selected a valid project API key.");
      }
    } finally {
      setIsLoadingAudio(false);
    }
  };

  const handleIntensityChange = (intensity: number) => {
    if (redPulseRef.current) redPulseRef.current.style.opacity = (Math.pow(intensity, 1.5) * 0.8).toString();
    if (splatterRef.current) {
        splatterRef.current.style.transform = `translate(-50%, -50%) scale(${1 + (intensity * 0.2)})`;
        splatterRef.current.style.opacity = (0.3 + (Math.pow(intensity, 2) * 0.6)).toString();
    }
    if (containerRef.current) {
        if (intensity > 0.4) {
            const shake = (intensity - 0.4) * 10;
            containerRef.current.style.transform = `translate(${(Math.random()-0.5)*shake}px, ${(Math.random()-0.5)*shake}px) rotate(${(Math.random()-0.5)*intensity*0.5}deg)`;
        } else {
            containerRef.current.style.transform = 'none';
        }
    }
    smoothedIntensityRef.current += (intensity - smoothedIntensityRef.current) * 0.05;
    const sVal = smoothedIntensityRef.current;
    if (bgBlob1Ref.current) bgBlob1Ref.current.style.transform = `translate(${sVal * -50}px, ${sVal * -30}px) scale(${1 + sVal * 0.1})`;
    if (bgBlob2Ref.current) bgBlob2Ref.current.style.transform = `translate(${sVal * 50}px, ${sVal * 30}px) scale(${1 + sVal * 0.15})`;
  };

  if (hasKey === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black p-6 text-center">
        <h1 className="text-3xl font-black text-red-500 mb-6 uppercase tracking-widest">API Key Required</h1>
        <p className="text-neutral-400 max-w-md mb-8">
          To generate revolutionary poems and high-quality voiceovers, you must select an API key from a paid GCP project.
          <br/><br/>
          Visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-red-400 underline">billing documentation</a> for details.
        </p>
        <button 
          onClick={handleOpenKeySelector}
          className="px-8 py-4 bg-red-600 text-white font-bold rounded uppercase tracking-widest hover:bg-red-700 transition-colors shadow-[0_0_20px_rgba(220,38,38,0.5)]"
        >
          Select API Key
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative overflow-x-hidden selection:bg-red-700 selection:text-white pb-20">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div ref={bgBlob1Ref} className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-900/20 rounded-full blur-[100px]" />
        <div ref={bgBlob2Ref} className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-red-900/10 rounded-full blur-[100px]" />
        <div ref={redPulseRef} className="absolute inset-0 bg-gradient-radial from-red-600/60 via-transparent to-transparent mix-blend-overlay opacity-0" />
        <div ref={splatterRef} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[110%] blood-splatter opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_40%,rgba(0,0,0,0.8)_100%)]" />
      </div>

      <div ref={containerRef} className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 py-12 flex flex-col items-center">
        
        <header className="mb-8 text-center space-y-4 w-full">
          <div className="inline-block border-b-4 border-red-600 pb-2 mb-2">
            <h1 className="text-4xl md:text-6xl font-black text-red-500 tracking-tighter uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              কবিতা জেনারেটর
            </h1>
          </div>
          <p className="text-neutral-400 text-sm md:text-base tracking-widest font-sans uppercase">
            AI Powered Bengali Poetry & Performance
          </p>
        </header>

        <div className="flex gap-4 mb-8 bg-black/40 p-1 rounded-lg border border-red-900/30">
          <button 
            onClick={() => setMode('GENERATE')}
            className={`px-6 py-2 rounded transition-all duration-300 uppercase text-xs tracking-widest font-bold ${mode === 'GENERATE' ? 'bg-red-900/50 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Create (AI)
          </button>
          <button 
            onClick={() => setMode('EDIT')}
            className={`px-6 py-2 rounded transition-all duration-300 uppercase text-xs tracking-widest font-bold ${mode === 'EDIT' ? 'bg-red-900/50 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Editor
          </button>
        </div>

        <main className="w-full relative group">
          {mode === 'GENERATE' ? (
             <div className="w-full bg-black/20 border-2 border-red-900/30 rounded-lg p-6 md:p-8 space-y-6 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-red-400 text-xs uppercase tracking-widest">Topic (বিষয়)</label>
                    <input 
                      type="text" 
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Revolution, Rain, Lost Love..."
                      className="w-full bg-black/40 border border-red-900/30 rounded p-4 text-white focus:border-red-500 outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-red-400 text-xs uppercase tracking-widest">Mood (মেজাজ)</label>
                    <select 
                      value={mood}
                      onChange={(e) => setMood(e.target.value)}
                      className="w-full bg-black/40 border border-red-900/30 rounded p-4 text-white focus:border-red-500 outline-none"
                    >
                      <option value="Biplobi (Revolutionary)">Biplobi (Revolutionary)</option>
                      <option value="Prem (Romantic)">Prem (Romantic)</option>
                      <option value="Biroho (Melancholic)">Biroho (Melancholic)</option>
                      <option value="Dorshon (Philosophical)">Dorshon (Philosophical)</option>
                      <option value="Prokriti (Nature)">Prokriti (Nature)</option>
                      <option value="Roudro (Angry)">Roudro (Angry)</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-2">
                   <label className="text-red-400 text-xs uppercase tracking-widest">Poetic Style (শৈলী)</label>
                   <select 
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      className="w-full bg-black/40 border border-red-900/30 rounded p-4 text-white focus:border-red-500 outline-none"
                    >
                      <option value="Kazi Nazrul Islam (Rebel/Powerful)">Kazi Nazrul Islam (Rebel/Powerful)</option>
                      <option value="Rabindranath Tagore (Lyrical/Deep)">Rabindranath Tagore (Lyrical/Deep)</option>
                      <option value="Jibanananda Das (Surreal/Visual)">Jibanananda Das (Surreal/Visual)</option>
                      <option value="Sukanta Bhattacharya (Socialist/Raw)">Sukanta Bhattacharya (Socialist/Raw)</option>
                      <option value="Modern Free Verse">Modern Free Verse</option>
                    </select>
                </div>

                <div className="pt-4 flex justify-center">
                  <button
                    onClick={handleTextGeneration}
                    disabled={isGeneratingText || !topic.trim()}
                    className="relative w-full md:w-auto px-12 py-4 bg-red-900/20 border border-red-500/50 text-red-100 font-bold uppercase tracking-widest hover:bg-red-800/30 transition-all disabled:opacity-50"
                  >
                    {isGeneratingText ? "Generating Poem..." : "Generate Poem"}
                  </button>
                </div>
             </div>
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-4">
               <textarea
                value={poemText}
                onChange={(e) => setPoemText(e.target.value)}
                className="w-full h-[50vh] bg-black/20 border-2 border-red-900/30 rounded-lg p-6 md:p-8 text-lg md:text-2xl text-center text-neutral-200 font-medium focus:border-red-600 outline-none resize-none font-serif shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]"
                placeholder="Write your poem here..."
                spellCheck="false"
              />
            </div>
          )}
        </main>

        <div className="mt-10 w-full flex flex-col items-center space-y-6">
          {error && (
            <div className="p-4 border border-red-500/50 bg-red-900/20 text-red-200 rounded text-sm text-center animate-pulse">
              {error}
            </div>
          )}

          {mode === 'EDIT' && !audioBuffer && (
            <button
              onClick={handleGenerateAndPlay}
              disabled={isLoadingAudio || !poemText.trim()}
              className="px-8 py-4 border-2 border-red-600 text-red-500 font-bold text-xl uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all disabled:opacity-50"
            >
              {isLoadingAudio ? "প্রস্তুত হচ্ছে..." : "আবৃত্তি শুনুন (Recite)"}
            </button>
          )}

          {audioBuffer && (
            <div className="w-full flex flex-col items-center z-20">
               <AudioPlayer audioBuffer={audioBuffer} onPlayComplete={() => {}} onIntensityChange={handleIntensityChange} />
               <div className="flex flex-wrap justify-center gap-4 mt-6">
                  <button onClick={() => setAudioBuffer(null)} className="px-4 py-2 text-xs text-red-500/70 border border-red-900/50 rounded uppercase">Edit Text</button>
                  <button onClick={handleDownload} disabled={isDownloading} className="px-4 py-2 text-xs bg-red-600/20 text-red-100 border border-red-500/50 rounded uppercase font-bold min-w-[160px] flex items-center justify-center">
                    {isDownloading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Optimizing...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2" viewBox="0 0 16 16">
                          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                        </svg>
                        ডাউনলোড (MP3)
                      </>
                    )}
                  </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;