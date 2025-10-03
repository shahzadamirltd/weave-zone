-- Create live_streams table to track live sessions
CREATE TABLE IF NOT EXISTS public.live_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  viewer_count INTEGER DEFAULT 0,
  total_gifts_received NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create gifts table to track gifts sent during live streams
CREATE TABLE IF NOT EXISTS public.gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_stream_id UUID NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 5),
  platform_fee NUMERIC NOT NULL,
  creator_earnings NUMERIC NOT NULL,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create content_analytics table to track likes and engagement
CREATE TABLE IF NOT EXISTS public.content_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'live_stream')),
  content_id UUID NOT NULL,
  likes_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(community_id, content_type, content_id, date)
);

-- Enable RLS
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for live_streams
CREATE POLICY "Community members can view live streams"
  ON public.live_streams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.memberships
      WHERE memberships.community_id = live_streams.community_id
      AND memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Community owners can manage their live streams"
  ON public.live_streams FOR ALL
  USING (auth.uid() = creator_id);

-- RLS Policies for gifts
CREATE POLICY "Users can view gifts in their community streams"
  ON public.gifts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.live_streams ls
      JOIN public.memberships m ON m.community_id = ls.community_id
      WHERE ls.id = gifts.live_stream_id
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send gifts"
  ON public.gifts FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- RLS Policies for content_analytics
CREATE POLICY "Community members can view analytics"
  ON public.content_analytics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.communities
      WHERE communities.id = content_analytics.community_id
      AND communities.owner_id = auth.uid()
    )
  );

-- Trigger for updating live_streams updated_at
CREATE TRIGGER update_live_streams_updated_at
  BEFORE UPDATE ON public.live_streams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updating content_analytics updated_at
CREATE TRIGGER update_content_analytics_updated_at
  BEFORE UPDATE ON public.content_analytics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live streaming
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_streams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.gifts;