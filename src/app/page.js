'use client';
import React, { useState, useRef, useEffect } from 'react';
import WaveformVisualizer from '../component/WaveformVisualizer';
import { Volume2, Wand, Trash2} from 'lucide-react';

export default function Home() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [waveform, setWaveform] = useState([]);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [isVoiceDetected, setIsVoiceDetected] = useState(false);
  const [voiceIntensity, setVoiceIntensity] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const countdownRef = useRef(null);
  const audioStreamRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isCountingDownRef = useRef(false);

  useEffect(() => {
    return () => {
      stopRecording(true);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      isCountingDownRef.current = false;
    };
  }, []);

  const startCountdown = () => {
    // Prevent multiple countdown starts
    if (isCountingDownRef.current) return;
    
    // Clear any existing interval
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
    
    isCountingDownRef.current = true;
    setCountdown(3);
    
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          isCountingDownRef.current = false;
          startRecording();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const initAudioContext = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      
      if (!analyserRef.current) {
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.smoothingTimeConstant = 0.8;
      }

      // Ensure audio context is running
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    } catch (error) {
      console.error('Error initializing audio context:', error);
      setError('Failed to initialize audio system.');
    }
  };

  const startRecording = async () => {
    setIsDone(false);
    try {
      setError(null);
      
      // Initialize audio context first
      await initAudioContext();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      
      // Create and configure MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      // Connect audio nodes
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateWaveform = () => {
        if (!analyserRef.current || isPaused) return;
        
        analyserRef.current.getByteTimeDomainData(dataArray);
        setWaveform([...dataArray]);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += Math.abs(dataArray[i] - 128);
        }
        const average = sum / bufferLength;
        
        const isVoice = average > 5;
        setIsVoiceDetected(isVoice);
        setVoiceIntensity(Math.min(average / 30, 1));

        if (!isPaused) {
          animationFrameRef.current = requestAnimationFrame(updateWaveform);
        }
      };

      mediaRecorderRef.current.ondataavailable = (event) => {
        setAudioBlob(event.data);
      };

      // Start recording and visualization
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setIsPaused(false);
      updateWaveform();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setError('Microphone not found or permission denied.');
      
      // Reset states on error
      setIsRecording(false);
      setIsPaused(false);
      isCountingDownRef.current = false;
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      setIsPaused(true);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  const resumeRecording = async () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      await initAudioContext(); // Ensure audio context is initialized
      setIsPaused(false);
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateWaveform = () => {
        if (!analyserRef.current || isPaused) return;
        
        analyserRef.current.getByteTimeDomainData(dataArray);
        setWaveform([...dataArray]);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += Math.abs(dataArray[i] - 128);
        }
        const average = sum / bufferLength;
        
        const isVoice = average > 5;
        setIsVoiceDetected(isVoice);
        setVoiceIntensity(Math.min(average / 30, 1));

        if (!isPaused) {
          animationFrameRef.current = requestAnimationFrame(updateWaveform);
        }
      };

      updateWaveform();
    }
  };

  const stopRecording = (fullStop = false) => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      setCountdown(null);
    }
    isCountingDownRef.current = false;

    if (mediaRecorderRef.current && isRecording) {
      if (!fullStop) {
        pauseRecording();
        return;
      }

      setIsDone(true);
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      setIsVoiceDetected(false);
      setVoiceIntensity(0);
      setWaveform([]);

      // Stop and cleanup audio stream
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }

      // Cancel animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Cleanup audio context
      if (audioContextRef.current) {
        audioContextRef.current.close().then(() => {
          audioContextRef.current = null;
          analyserRef.current = null;
        });
      }

      // Cleanup audio blob
      if (audioBlob) {
        URL.revokeObjectURL(audioBlob);
        setAudioBlob(null);
      }

      mediaRecorderRef.current = null;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#2F4858] relative overflow-hidden">
      <div className="relative w-full max-w-7xl mx-4">
        <div className="text-center mb-4">
          <h1 className="text-white text-xl font-light">Babble</h1>
        </div>

        <div className="relative bg-[#2F4858] rounded-xl border border-white p-1 min-h-[80vh] flex flex-col items-center justify-center">
          {isRecording && !isPaused && !isDone && (
            <WaveformVisualizer 
              isRecording={isRecording && !isPaused} 
              audioData={waveform} 
              isVoiceDetected={isVoiceDetected} 
              voiceIntensity={voiceIntensity} 
            />
          )}

          {!isRecording ? (
            // Babble button
            <button
              onClick={startCountdown}
              disabled={isCountingDownRef.current}
              className={`w-40 h-40 md:w-64 md:h-64 rounded-full ${
                countdown !== null || isRecording ? 'bg-white text-black' : 'bg-transparent border-2 border-[#F3A47D]'
              } transition-all duration-300 flex items-center justify-center z-10`}
            >
              {countdown !== null ? (
                <span className="text-4xl md:text-6xl font-light">{countdown}</span>
              ) : (
                <span className="text-lg md:text-xl font-light text-[#F3A47D]">Babble</span>
              )}
            </button>
          ) : isPaused ? (
            <div className="flex justify-center items-center z-10">
              <div className="flex items-center gap-4 md:gap-8">
                <button
                  onClick={() => stopRecording(true)}
                  className="w-32 h-32 md:w-48 md:h-48 rounded-full bg-white text-black transition-all duration-300 flex items-center justify-center hover:bg-gray-100"
                >
                  <span className="text-base md:text-lg">Done</span>
                </button>
                <button
                  onClick={resumeRecording}
                  className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-[#F3A47D] text-black transition-all duration-300 flex items-center justify-center hover:bg-gray-100"
                >
                  <span className="text-base md:text-lg">Resume</span>
                </button>
              </div>
            </div>

          ) : countdown !== null ? (
            // Countdown display
            <button className="w-40 h-40 md:w-64 md:h-64 rounded-full bg-white text-black transition-all duration-300 flex items-center justify-center z-10">
              <span className="text-4xl md:text-6xl font-light">{countdown}</span>
            </button>
          ) : (
            // Stop button during recording
            <button
              onClick={() => stopRecording(false)}
              className="w-40 h-40 md:w-64 md:h-64 rounded-full bg-white text-black transition-all duration-300 flex items-center justify-center z-10 mt-auto mb-20 md:mb-0 md:mt-0"
            >
              <span className="text-lg md:text-xl font-light">Stop</span>
            </button>
          )}

          {/* Delete button */}
          {/* {isRecording && (
            <div className="flex flex-col items-center mt-1 md:mt-4">
              <button
                className="w-12 h-12 rounded-full bg-white flex items-center justify-center hover:bg-gray-100 transition-colors z-20"
                style={{ marginTop: '10px' }}
              >
                <Trash2 size={20} className="text-[#F3A47D]" />
              </button>
            </div>
          )} */}


         {/* Bottom buttons */}
          <div className="absolute bottom-[-22px] left-1/2 -translate-x-1/2 flex gap-3 md:gap-4 z-10">
            <button className="w-10 h-10 md:w-12 md:h-12 rounded-full  bg-[#2F4858] border-[1px] flex items-center justify-center hover:bg-gray-100 transition-colors">
              <Wand size={20} className="text-[#F3A47D] md:w-5 md:h-5" />
            </button>
            <button className="w-10 h-10 md:w-12 md:h-12 rounded-full  bg-[#2F4858] border-[1px] flex items-center justify-center hover:bg-gray-100 transition-colors">
              <Volume2 size={20} className="text-[#F3A47D] md:w-5 md:h-5" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-red-500 text-sm bg-[#2a3a4c] px-4 py-2 rounded-full">
          {error}
        </div>
      )}
    </div>
  );
}