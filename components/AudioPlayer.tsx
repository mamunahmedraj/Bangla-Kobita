import React, { useEffect, useRef, useState } from 'react';

interface AudioPlayerProps {
  audioBuffer: AudioBuffer | null;
  onPlayComplete: () => void;
  onIntensityChange?: (intensity: number) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioBuffer, onPlayComplete, onIntensityChange }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Store the latest callback in a ref to ensure the animation loop always calls the current version
  const onIntensityChangeRef = useRef(onIntensityChange);

  useEffect(() => {
    onIntensityChangeRef.current = onIntensityChange;
  }, [onIntensityChange]);

  const stopAudio = () => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsPlaying(false);
    // Reset intensity when stopped
    if (onIntensityChangeRef.current) {
        onIntensityChangeRef.current(0);
    }
  };

  const drawVisualizer = () => {
    if (!canvasRef.current || !analyserRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current) return;
      
      animationRef.current = requestAnimationFrame(draw);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate Audio Intensity for external effects
      // We focus on the lower half of frequencies for "impact" and calculate an average
      let sum = 0;
      const relevantBins = Math.floor(bufferLength * 0.7);
      for (let i = 0; i < relevantBins; i++) {
        sum += dataArray[i];
      }
      const average = sum / relevantBins;
      const normalizedIntensity = Math.min(1, average / 255); // 0.0 to 1.0

      // Call the external handler
      if (onIntensityChangeRef.current) {
        onIntensityChangeRef.current(normalizedIntensity);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Revolutionary Theme Colors for Visualizer
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 1.5; // Scale down slightly

        // Gradient from Red to Dark Red
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, '#7f1d1d'); // Dark Red
        gradient.addColorStop(1, '#ef4444'); // Bright Red

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }
    };

    draw();
  };

  const playAudio = async () => {
    if (!audioBuffer) return;

    // Stop existing playback
    stopAudio();

    // Create context if needed
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Ensure context is running (needed for some browsers after user gesture)
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    // Setup Analyser
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    
    analyserRef.current = analyser;
    sourceRef.current = source;

    source.onended = () => {
      setIsPlaying(false);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      // Clear canvas
      if (canvasRef.current) {
        const cCtx = canvasRef.current.getContext('2d');
        cCtx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      // Reset intensity
      if (onIntensityChangeRef.current) {
        onIntensityChangeRef.current(0);
      }
      onPlayComplete();
    };

    source.start(0);
    setIsPlaying(true);
    drawVisualizer();
  };

  // Auto-play when buffer changes (and is not null)
  useEffect(() => {
    if (audioBuffer) {
      playAudio();
    }
    return () => stopAudio();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBuffer]);

  return (
    <div className="w-full h-32 flex items-center justify-center relative overflow-hidden bg-black/40 border-t-2 border-red-900 mt-8 rounded-lg shadow-[0_0_15px_rgba(220,38,38,0.3)]">
        {!isPlaying && audioBuffer && (
            <button 
                onClick={playAudio}
                className="absolute z-10 text-red-500 font-bold tracking-widest uppercase border border-red-600 px-6 py-2 hover:bg-red-900/50 transition-colors"
            >
                পুনরায় শুনুন (Replay)
            </button>
        )}
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={128} 
        className="w-full h-full opacity-80"
      />
    </div>
  );
};