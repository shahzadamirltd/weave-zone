-- Add unique constraint to prevent duplicate comment reactions
ALTER TABLE public.comment_reactions 
ADD CONSTRAINT unique_user_comment_emoji UNIQUE (user_id, comment_id, emoji);