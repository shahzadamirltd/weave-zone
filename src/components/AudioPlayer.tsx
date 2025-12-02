import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  audioUrl: string;
  duration?: number;
}

export const AudioPlayer = ({ audioUrl, duration }: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setAudioDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  // Generate waveform bars (20 bars)
  const bars = Array.from({ length: 20 }, (_, i) => {
    const height = Math.random() * 60 + 40; // Random height between 40-100%
    const isActive = (i / 20) * 100 < progress;
    return { height, isActive };
  });

  return (
    <div className="flex items-center gap-3 bg-accent/30 rounded-2xl p-3 max-w-xs">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      <Button
        variant="ghost"
        size="icon"
        onClick={togglePlay}
        className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0"
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
      </Button>

      <div className="flex-1 flex items-center gap-2">
        <div className="flex items-center gap-0.5 h-8 flex-1">
          {bars.map((bar, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-full transition-all duration-200",
                bar.isActive ? "bg-primary" : "bg-muted-foreground/30"
              )}
              style={{ height: `${bar.height}%` }}
            />
          ))}
        </div>
        
        <span className="text-xs text-muted-foreground font-medium min-w-[70px]">
          {formatTime(currentTime)} / {formatTime(audioDuration)}
        </span>
      </div>
    </div>
  );
};
