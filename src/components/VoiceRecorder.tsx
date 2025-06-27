import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Play, Pause, Square, RotateCcw, Send } from 'lucide-react';

interface VoiceRecorderProps {
  onAudioRecorded: (audioBlob: Blob, duration: number) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  maxDuration?: number; // in seconds
  isDisabled?: boolean;
  className?: string;
}

export type RecordingState = 'idle' | 'requesting' | 'recording' | 'recorded' | 'playing';

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onAudioRecorded,
  onRecordingStart,
  onRecordingStop,
  maxDuration = 120, // 2 minutes default
  isDisabled = false,
  className = ''
}) => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const visualizationRef = useRef<number | null>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up function
  const cleanup = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }

    if (visualizationRef.current) {
      cancelAnimationFrame(visualizationRef.current);
      visualizationRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
  }, []);

  // Setup audio visualization
  const setupAudioVisualization = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      const updateLevels = () => {
        if (analyserRef.current && recordingState === 'recording') {
          analyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average level
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const normalizedLevel = average / 255;
          
          setAudioLevels(prev => {
            const newLevels = [...prev, normalizedLevel];
            // Keep only last 100 levels for visualization
            return newLevels.slice(-100);
          });
          
          visualizationRef.current = requestAnimationFrame(updateLevels);
        }
      };
      
      updateLevels();
    } catch (error) {
      console.error('Error setting up audio visualization:', error);
    }
  }, [recordingState]);

  // Request microphone permission and start recording
  const startRecording = async () => {
    try {
      setError(null);
      setRecordingState('requesting');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Setup MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        
        setRecordingState('recorded');
        onRecordingStop?.();
      };
      
      // Setup visualization
      setupAudioVisualization(stream);
      
      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setRecordingState('recording');
      setDuration(0);
      setAudioLevels([]);
      onRecordingStart?.();
      
      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 0.1;
          if (newDuration >= maxDuration) {
            stopRecording();
            return maxDuration;
          }
          return newDuration;
        });
      }, 100);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Could not access microphone. Please check permissions.');
      setRecordingState('idle');
    }
  };

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      
      if (visualizationRef.current) {
        cancelAnimationFrame(visualizationRef.current);
        visualizationRef.current = null;
      }
      
      // Stop media stream
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    }
  }, [recordingState]);

  // Play recorded audio
  const playAudio = () => {
    if (audioUrl && audioElementRef.current) {
      audioElementRef.current.play();
      setRecordingState('playing');
      setCurrentTime(0);
      
      // Update current time during playback
      playbackTimerRef.current = setInterval(() => {
        if (audioElementRef.current) {
          setCurrentTime(audioElementRef.current.currentTime);
        }
      }, 100);
    }
  };

  // Pause audio playback
  const pauseAudio = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setRecordingState('recorded');
      
      if (playbackTimerRef.current) {
        clearInterval(playbackTimerRef.current);
        playbackTimerRef.current = null;
      }
    }
  };

  // Reset recording
  const resetRecording = () => {
    cleanup();
    setRecordingState('idle');
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setCurrentTime(0);
    setAudioLevels([]);
    setError(null);
  };

  // Send recording
  const sendRecording = () => {
    if (audioBlob) {
      onAudioRecorded(audioBlob, duration);
    }
  };

  // Audio element event handlers
  const handleAudioEnded = () => {
    setRecordingState('recorded');
    setCurrentTime(0);
    
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  };

  // Format time display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return (
    <div className={`voice-recorder ${className}`}>
      {/* Audio element for playback */}
      {audioUrl && (
        <audio
          ref={audioElementRef}
          src={audioUrl}
          onEnded={handleAudioEnded}
          style={{ display: 'none' }}
        />
      )}
      
      {/* Error display */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
      
      {/* Recording visualization */}
      <div className="bg-gray-50 rounded-lg p-6 mb-4">
        {/* Status indicator */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {recordingState === 'recording' && (
              <>
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-red-600">Recording</span>
              </>
            )}
            {recordingState === 'recorded' && (
              <>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-600">Ready</span>
              </>
            )}
            {recordingState === 'playing' && (
              <>
                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-blue-600">Playing</span>
              </>
            )}
            {recordingState === 'requesting' && (
              <>
                <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-yellow-600">Requesting Permission</span>
              </>
            )}
          </div>
          
          <div className="text-sm font-mono text-gray-600">
            {recordingState === 'playing' ? formatTime(currentTime) : formatTime(duration)}
            {duration > 0 && recordingState === 'playing' && ` / ${formatTime(duration)}`}
          </div>
        </div>
        
        {/* Audio visualization */}
        <div className="h-20 flex items-end justify-center space-x-1 mb-4">
          {recordingState === 'recording' ? (
            // Live visualization during recording
            audioLevels.map((level, index) => (
              <div
                key={index}
                className="bg-blue-500 w-1 transition-all duration-100"
                style={{
                  height: `${Math.max(2, level * 60)}px`
                }}
              />
            ))
          ) : recordingState === 'recorded' || recordingState === 'playing' ? (
            // Static visualization for recorded audio
            <div className="flex items-center justify-center w-full h-full">
              <div className="flex items-end space-x-1">
                {Array.from({ length: 40 }, (_, i) => (
                  <div
                    key={i}
                    className={`w-1 transition-all duration-200 ${
                      recordingState === 'playing' && currentTime > (i / 40) * duration
                        ? 'bg-blue-500'
                        : 'bg-gray-300'
                    }`}
                    style={{
                      height: `${Math.max(4, Math.random() * 40 + 10)}px`
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            // Idle state
            <div className="flex items-center justify-center w-full h-full text-gray-400">
              <Mic className="w-8 h-8" />
            </div>
          )}
        </div>
        
        {/* Duration bar */}
        {maxDuration && (
          <div className="w-full bg-gray-200 rounded-full h-1 mb-4">
            <div
              className={`h-1 rounded-full transition-all duration-200 ${
                duration >= maxDuration ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${(duration / maxDuration) * 100}%` }}
            />
          </div>
        )}
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-center space-x-3">
        {recordingState === 'idle' && (
          <button
            onClick={startRecording}
            disabled={isDisabled}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <Mic className="w-5 h-5" />
            <span>Start Recording</span>
          </button>
        )}
        
        {recordingState === 'requesting' && (
          <div className="flex items-center space-x-2 text-gray-600">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span>Requesting microphone access...</span>
          </div>
        )}
        
        {recordingState === 'recording' && (
          <button
            onClick={stopRecording}
            className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <Square className="w-5 h-5" />
            <span>Stop Recording</span>
          </button>
        )}
        
        {(recordingState === 'recorded' || recordingState === 'playing') && (
          <>
            {recordingState === 'recorded' && (
              <button
                onClick={playAudio}
                className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <Play className="w-4 h-4" />
                <span>Play</span>
              </button>
            )}
            
            {recordingState === 'playing' && (
              <button
                onClick={pauseAudio}
                className="flex items-center space-x-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                <Pause className="w-4 h-4" />
                <span>Pause</span>
              </button>
            )}
            
            <button
              onClick={resetRecording}
              className="flex items-center space-x-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
            
            <button
              onClick={sendRecording}
              disabled={isDisabled}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <Send className="w-5 h-5" />
              <span>Send Response</span>
            </button>
          </>
        )}
      </div>
      
      {/* Recording tips */}
      {recordingState === 'idle' && (
        <div className="mt-4 text-sm text-gray-600 text-center">
          <p>Make sure you're in a quiet environment for the best audio quality.</p>
          <p>Maximum recording time: {formatTime(maxDuration)}</p>
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;