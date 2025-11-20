import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Mic, X, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob) => void;
  onCancel?: () => void;
}

export const VoiceRecorder = ({ onSend, onCancel }: VoiceRecorderProps) => {
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support audio recording. Please use Chrome, Firefox, or Safari.");
      }

      // Check if any audio input devices are available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      
      if (audioDevices.length === 0) {
        throw new Error("No microphone found. Please connect a microphone and try again.");
      }

      let stream: MediaStream;
      
      // Try with constraints first, then fallback to basic
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (constraintError) {
        console.log("Trying basic audio constraints...", constraintError);
        // Fallback to basic audio without constraints
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error("Audio recording is not supported in your browser");
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        onSend(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error: any) {
      console.error("Microphone access error:", error);
      
      let errorMessage = "Could not access microphone. ";
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage = "Please click Allow when your browser asks for microphone permission.";
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage = "No microphone detected. Please connect a microphone and refresh the page.";
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage = "Microphone is already being used by another app. Please close other apps and try again.";
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage = "Please check your microphone connection and browser permissions.";
      }
      
      toast({
        title: "Cannot Record Audio",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      chunksRef.current = [];
      onCancel?.();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onMouseDown={startRecording}
        onTouchStart={startRecording}
        className="hover:bg-primary/10"
      >
        <Mic className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full animate-pulse">
      <Mic className="h-5 w-5 text-primary animate-pulse" />
      <span className="text-sm font-medium">{formatTime(recordingTime)}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={cancelRecording}
        className="h-8 w-8"
      >
        <X className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={stopRecording}
        className="h-8 w-8"
      >
        <Send className="h-4 w-4 text-primary" />
      </Button>
    </div>
  );
};
