-- Add unique constraints and handles to communities
ALTER TABLE public.communities 
  ADD COLUMN IF NOT EXISTS handle TEXT UNIQUE,
  ADD CONSTRAINT unique_community_name UNIQUE (name);

-- Create index for faster handle lookups
CREATE INDEX IF NOT EXISTS idx_communities_handle ON public.communities(handle);

-- Update notification functions to include emoji meanings
CREATE OR REPLACE FUNCTION public.notify_post_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  emoji_meaning TEXT;
BEGIN
  -- Map emoji to meaning
  emoji_meaning := CASE NEW.emoji
    WHEN '❤️' THEN 'loved'
    WHEN '👍' THEN 'liked'
    WHEN '😂' THEN 'found funny'
    WHEN '😮' THEN 'was surprised by'
    WHEN '😢' THEN 'was sad about'
    WHEN '😡' THEN 'was angry about'
    ELSE 'reacted to'
  END;

  INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type)
  SELECT 
    p.author_id,
    'like',
    'New reaction on your post',
    u.username || ' ' || emoji_meaning || ' your post',
    NEW.post_id,
    'post'
  FROM public.posts p
  JOIN public.profiles u ON u.id = NEW.user_id
  WHERE p.id = NEW.post_id
    AND p.author_id != NEW.user_id;
  
  RETURN NEW;
END;
$function$;

-- Update trigger for reactions
DROP TRIGGER IF EXISTS notify_post_reaction_trigger ON public.reactions;
CREATE TRIGGER notify_post_reaction_trigger
  AFTER INSERT ON public.reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_reaction();

-- Create function for comment reactions
CREATE OR REPLACE FUNCTION public.notify_comment_reaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  emoji_meaning TEXT;
BEGIN
  emoji_meaning := CASE NEW.emoji
    WHEN '❤️' THEN 'loved'
    WHEN '👍' THEN 'liked'
    WHEN '😂' THEN 'found funny'
    WHEN '😮' THEN 'was surprised by'
    WHEN '😢' THEN 'was sad about'
    WHEN '😡' THEN 'was angry about'
    ELSE 'reacted to'
  END;

  INSERT INTO public.notifications (user_id, type, title, message, related_id, related_type)
  SELECT 
    c.author_id,
    'like',
    'New reaction on your comment',
    u.username || ' ' || emoji_meaning || ' your comment',
    NEW.comment_id,
    'comment'
  FROM public.comments c
  JOIN public.profiles u ON u.id = NEW.user_id
  WHERE c.id = NEW.comment_id
    AND c.author_id != NEW.user_id;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for comment reactions
DROP TRIGGER IF EXISTS notify_comment_reaction_trigger ON public.comment_reactions;
CREATE TRIGGER notify_comment_reaction_trigger
  AFTER INSERT ON public.comment_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment_reaction();