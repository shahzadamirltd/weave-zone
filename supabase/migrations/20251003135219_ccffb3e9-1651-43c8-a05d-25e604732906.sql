-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('like', 'comment', 'reply', 'join', 'payout', 'payment')),
  title text NOT NULL,
  message text NOT NULL,
  related_id uuid,
  related_type text,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to create notification for post likes
CREATE OR REPLACE FUNCTION notify_post_like()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type)
  SELECT 
    p.author_id,
    'like',
    'New like on your post',
    u.username || ' liked your post',
    NEW.post_id,
    'post'
  FROM public.posts p
  JOIN public.profiles u ON u.id = NEW.user_id
  WHERE p.id = NEW.post_id
    AND p.author_id != NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to create notification for comments
CREATE OR REPLACE FUNCTION notify_comment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type)
  SELECT 
    p.author_id,
    'comment',
    'New comment on your post',
    u.username || ' commented on your post',
    NEW.post_id,
    'post'
  FROM public.posts p
  JOIN public.profiles u ON u.id = NEW.author_id
  WHERE p.id = NEW.post_id
    AND p.author_id != NEW.author_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to create notification for comment replies
CREATE OR REPLACE FUNCTION notify_comment_reply()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type)
    SELECT 
      c.author_id,
      'reply',
      'New reply to your comment',
      u.username || ' replied to your comment',
      NEW.id,
      'comment'
    FROM public.comments c
    JOIN public.profiles u ON u.id = NEW.author_id
    WHERE c.id = NEW.parent_id
      AND c.author_id != NEW.author_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to create notification for community joins
CREATE OR REPLACE FUNCTION notify_community_join()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type)
  SELECT 
    c.owner_id,
    'join',
    'New member joined',
    u.username || ' joined ' || c.name,
    NEW.community_id,
    'community'
  FROM public.communities c
  JOIN public.profiles u ON u.id = NEW.user_id
  WHERE c.id = NEW.community_id
    AND c.owner_id != NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to create notification for payout requests
CREATE OR REPLACE FUNCTION notify_payout_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Notify the creator
  INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type)
  SELECT 
    NEW.creator_id,
    'payout',
    'Payout request submitted',
    'Your payout request for $' || NEW.amount || ' has been submitted',
    NEW.id,
    'payout'
  WHERE NEW.status = 'pending';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to create notification for payment received
CREATE OR REPLACE FUNCTION notify_payment_received()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type)
  SELECT 
    c.owner_id,
    'payment',
    'Payment received',
    'You received $' || NEW.creator_earnings || ' from ' || c.name,
    NEW.id,
    'payment'
  FROM public.communities c
  WHERE c.id = NEW.community_id
    AND NEW.status = 'completed';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers
CREATE TRIGGER trigger_notify_post_like
  AFTER INSERT ON public.reactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_post_like();

CREATE TRIGGER trigger_notify_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_comment();

CREATE TRIGGER trigger_notify_comment_reply
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_comment_reply();

CREATE TRIGGER trigger_notify_community_join
  AFTER INSERT ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION notify_community_join();

CREATE TRIGGER trigger_notify_payout_request
  AFTER INSERT ON public.payouts
  FOR EACH ROW
  EXECUTE FUNCTION notify_payout_request();

CREATE TRIGGER trigger_notify_payment_received
  AFTER INSERT ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_payment_received();