import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Users } from "lucide-react";

interface LiveStreamBannerProps {
  viewerCount: number;
  onJoin: () => void;
}

export const LiveStreamBanner = ({ viewerCount, onJoin }: LiveStreamBannerProps) => {
  return (
    <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white p-4 rounded-xl shadow-lg animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="destructive" className="animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full mr-2" />
            LIVE
          </Badge>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span className="font-semibold">{viewerCount} watching</span>
          </div>
        </div>
        <Button
          onClick={onJoin}
          variant="secondary"
          className="bg-white text-red-600 hover:bg-gray-100"
        >
          <Video className="h-4 w-4 mr-2" />
          Join Stream
        </Button>
      </div>
    </div>
  );
};
