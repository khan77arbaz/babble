'use client';
import React, { useRef, useEffect } from 'react';

const WaveformVisualizer = ({ isRecording, audioData, isVoiceDetected, voiceIntensity }) => {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null); // Track the animation frame

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    let waveOffset = 0;

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw wavy background
      ctx.beginPath();
      for (let x = 0; x <= width; x += 10) {
        const defaultWaveHeight = 20;
        const waveHeight = defaultWaveHeight + (isVoiceDetected ? voiceIntensity * 80 : 0);
        const y = height * 0.7 + Math.sin((x + waveOffset) * 0.02) * waveHeight;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = '#FFB684';
      ctx.fill();

      waveOffset -= 2;

      // Draw waveform if audioData is available
      if (audioData?.length) {
        ctx.beginPath();
        ctx.strokeStyle = '#2F4858';
        ctx.lineWidth = 2;

        const sliceWidth = width / audioData.length;
        let x = 0;

        for (let i = 0; i < audioData.length; i++) {
          const v = audioData[i] / 128.0;
          const amplification = isVoiceDetected ? 1 + voiceIntensity * 5 : 1;
          const y = (height / 2) * (1 - v * amplification);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
      }

      // Continue the animation if recording is active
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    if (isRecording) {
      draw(); // Start the animation when recording starts
    }

    return () => {
      // Clean up the animation when recording stops
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isRecording, audioData, isVoiceDetected, voiceIntensity]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={385.9}
      className="w-full h-full absolute inset-0"
    />
  );
};

export default WaveformVisualizer;
