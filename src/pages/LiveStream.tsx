import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Users, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function LiveStream() {
  const { toast } = useToast();
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [volume, setVolume] = useState(100);
  const [viewerCount, setViewerCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  const requestPermissions = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      toast({ title: "Permissions granted", description: "Camera and microphone access enabled" });
      return true;
    } catch (error) {
      toast({ 
        title: "Permission denied", 
        description: "Please allow camera and microphone access", 
        variant: "destructive" 
      });
      return false;
    }
  };

  const startStream = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsLive(true);
      toast({ title: "Live!", description: "You are now streaming" });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to start stream", 
        variant: "destructive" 
      });
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsLive(false);
    toast({ title: "Stream ended" });
  };

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !isVideoOn;
      });
      setIsVideoOn(!isVideoOn);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
    }
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <AppLayout>
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Live Stream</h1>
          {isLive && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500 text-white rounded-full animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full" />
              LIVE
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Video Stream */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden">
              <div className="relative aspect-video bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {!isLive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <p className="text-white text-lg">Stream not started</p>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="p-4 bg-card space-y-4">
                <div className="flex justify-center gap-4">
                  <Button
                    variant={isMuted ? "destructive" : "outline"}
                    size="icon"
                    onClick={toggleMute}
                    disabled={!isLive}
                  >
                    {isMuted ? <MicOff /> : <Mic />}
                  </Button>

                  <Button
                    variant={isVideoOn ? "outline" : "destructive"}
                    size="icon"
                    onClick={toggleVideo}
                    disabled={!isLive}
                  >
                    {isVideoOn ? <Video /> : <VideoOff />}
                  </Button>

                  <Button
                    variant={volume === 0 ? "outline" : "default"}
                    size="icon"
                    className="relative"
                  >
                    {volume === 0 ? <VolumeX /> : <Volume2 />}
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <VolumeX className="h-4 w-4" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={handleVolumeChange}
                    className="flex-1"
                  />
                  <Volume2 className="h-4 w-4" />
                  <span className="text-sm w-12 text-right">{volume}%</span>
                </div>

                {!isLive ? (
                  <Button onClick={startStream} className="w-full">
                    Go Live
                  </Button>
                ) : (
                  <Button onClick={stopStream} variant="destructive" className="w-full">
                    End Stream
                  </Button>
                )}
              </div>
            </Card>
          </div>

          {/* Stream Info */}
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Viewers</span>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span className="font-bold">{viewerCount}</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-2">Tips Received</h3>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">$0.00</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Viewers can send tips during your stream
              </p>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-2">Stream Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className={isLive ? "text-red-500 font-semibold" : "text-muted-foreground"}>
                    {isLive ? "Live" : "Offline"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quality</span>
                  <span>720p</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}