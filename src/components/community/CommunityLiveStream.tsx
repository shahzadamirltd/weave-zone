import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Users, Gift, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface CommunityLiveStreamProps {
  communityId: string;
  isOwner: boolean;
  onClose: () => void;
}

export const CommunityLiveStream = ({ communityId, isOwner, onClose }: CommunityLiveStreamProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLive, setIsLive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [volume, setVolume] = useState(100);
  const [giftAmount, setGiftAmount] = useState("5");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [liveStreamId, setLiveStreamId] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  const { data: activeLiveStream } = useQuery({
    queryKey: ["live-stream", communityId],
    queryFn: async () => {
      const { data } = await supabase
        .from("live_streams")
        .select("*, gifts(amount)")
        .eq("community_id", communityId)
        .eq("status", "active")
        .maybeSingle();
      return data;
    },
    refetchInterval: 3000,
  });

  const { data: gifts } = useQuery({
    queryKey: ["gifts", liveStreamId],
    queryFn: async () => {
      if (!liveStreamId) return [];
      const { data } = await supabase
        .from("gifts")
        .select("*")
        .eq("live_stream_id", liveStreamId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!liveStreamId,
  });

  useEffect(() => {
    if (activeLiveStream) {
      setLiveStreamId(activeLiveStream.id);
    }
  }, [activeLiveStream]);

  useEffect(() => {
    if (!liveStreamId) return;

    const channel = supabase
      .channel(`live-stream-${liveStreamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gifts",
          filter: `live_stream_id=eq.${liveStreamId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["gifts", liveStreamId] });
          queryClient.invalidateQueries({ queryKey: ["live-stream", communityId] });
          toast({
            title: "New gift received!",
            description: `$${payload.new.amount} from a supporter`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [liveStreamId, queryClient, communityId]);

  const startStreamMutation = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("Not authenticated");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const { data, error } = await supabase
          .from("live_streams")
          .insert({
            community_id: communityId,
            creator_id: profile.id,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw new Error("Camera/microphone permission denied. Please allow access and try again.");
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      setIsLive(true);
      setLiveStreamId(data.id);
      toast({ title: "Live!", description: "You are now streaming" });
      queryClient.invalidateQueries({ queryKey: ["live-stream", communityId] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const endStreamMutation = useMutation({
    mutationFn: async () => {
      if (!liveStreamId) return;

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      const { error } = await supabase
        .from("live_streams")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", liveStreamId);

      if (error) throw error;
    },
    onSuccess: () => {
      setIsLive(false);
      setLiveStreamId(null);
      toast({ title: "Stream ended" });
      queryClient.invalidateQueries({ queryKey: ["live-stream", communityId] });
    },
  });

  const sendGiftMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(giftAmount);
      if (amount < 5) throw new Error("Minimum gift is $5");

      const { data, error } = await supabase.functions.invoke("send-gift", {
        body: { liveStreamId: activeLiveStream?.id, amount },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, "_blank");
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleMute = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !isVideoOn;
      });
      setIsVideoOn(!isVideoOn);
    }
  };

  const totalGifts = gifts?.reduce((sum, gift) => sum + parseFloat(String(gift.amount)), 0) || 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/95">
      <div className="container mx-auto h-full p-4 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-white">Live Stream</h2>
            {activeLiveStream && (
              <Badge className="bg-red-500 text-white animate-pulse">
                <div className="w-2 h-2 bg-white rounded-full mr-2" />
                LIVE
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-6 w-6 text-white" />
          </Button>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            <Card className="overflow-hidden h-full">
              <div className="relative aspect-video bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted={isOwner}
                  className="w-full h-full object-cover"
                />
                {!activeLiveStream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <p className="text-white text-lg">
                      {isOwner ? "Start your live stream" : "No live stream active"}
                    </p>
                  </div>
                )}
              </div>

              {isOwner && (
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
                    <Button variant="outline" size="icon">
                      {volume === 0 ? <VolumeX /> : <Volume2 />}
                    </Button>
                  </div>

                  {!isLive ? (
                    <Button
                      onClick={() => startStreamMutation.mutate()}
                      className="w-full"
                      disabled={startStreamMutation.isPending}
                    >
                      Go Live
                    </Button>
                  ) : (
                    <Button
                      onClick={() => endStreamMutation.mutate()}
                      variant="destructive"
                      className="w-full"
                      disabled={endStreamMutation.isPending}
                    >
                      End Stream
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Viewers</span>
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span className="font-bold">{activeLiveStream?.viewer_count || 0}</span>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Gift className="h-5 w-5 text-pink-500" />
                Gifts
              </h3>
              <div className="text-2xl font-bold text-green-500 mb-2">
                ${totalGifts.toFixed(2)}
              </div>

              {!isOwner && activeLiveStream && (
                <div className="space-y-2">
                  <Input
                    type="number"
                    placeholder="Amount ($5 min)"
                    value={giftAmount}
                    onChange={(e) => setGiftAmount(e.target.value)}
                    min="5"
                    step="1"
                  />
                  <Button
                    onClick={() => sendGiftMutation.mutate()}
                    className="w-full"
                    disabled={sendGiftMutation.isPending}
                  >
                    Send Gift
                  </Button>
                </div>
              )}
            </Card>

            {gifts && gifts.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold mb-2">Recent Gifts</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {gifts.map((gift) => (
                    <div key={gift.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Supporter
                      </span>
                      <span className="font-semibold text-green-500">
                        ${parseFloat(String(gift.amount)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};