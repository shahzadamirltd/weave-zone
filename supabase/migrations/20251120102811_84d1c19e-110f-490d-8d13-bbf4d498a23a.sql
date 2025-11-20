-- Enable realtime for gifts table (live_streams already has realtime)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'gifts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE gifts;
  END IF;
END $$;

-- Create trigger to notify members when creator goes live
CREATE OR REPLACE FUNCTION public.notify_live_stream_started()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify all community members except the creator
  INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type)
  SELECT 
    m.user_id,
    'live_stream',
    'Live stream started!',
    (SELECT name FROM communities WHERE id = NEW.community_id) || ' is now live',
    NEW.id,
    'live_stream'
  FROM memberships m
  WHERE m.community_id = NEW.community_id
    AND m.user_id != NEW.creator_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for live stream notifications
DROP TRIGGER IF EXISTS on_live_stream_started ON public.live_streams;
CREATE TRIGGER on_live_stream_started
  AFTER INSERT ON public.live_streams
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION public.notify_live_stream_started();