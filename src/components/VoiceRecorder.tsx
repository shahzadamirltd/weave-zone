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

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
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
        errorMessage += "Please allow microphone access in your browser settings.";
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage += "No microphone found. Please connect a microphone.";
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        errorMessage += "Microphone is already in use by another application.";
      } else if (error.message) {
        errorMessage = error.message;
      } else {
        errorMessage += "Please check your browser permissions and try again.";
      }
      
      toast({
        title: "Microphone Error",
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
