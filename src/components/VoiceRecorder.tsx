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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        onSend(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not access microphone",
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
