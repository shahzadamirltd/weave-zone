-- Add parent_id to comments for threading (replies)
ALTER TABLE public.comments
ADD COLUMN parent_id uuid REFERENCES public.comments(id) ON DELETE CASCADE;

-- Create comment_reactions table
CREATE TABLE public.comment_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'like',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on comment_reactions
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for comment_reactions
CREATE POLICY "Members can view comment reactions in their communities"
ON public.comment_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM comments
    JOIN posts ON posts.id = comments.post_id
    JOIN memberships ON memberships.community_id = posts.community_id
    WHERE comments.id = comment_reactions.comment_id
    AND memberships.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add comment reactions"
ON public.comment_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM comments
    JOIN posts ON posts.id = comments.post_id
    JOIN memberships ON memberships.community_id = posts.community_id
    WHERE comments.id = comment_reactions.comment_id
    AND memberships.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their comment reactions"
ON public.comment_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Create media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('community-media', 'community-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for community media
CREATE POLICY "Community members can view media"
ON storage.objects FOR SELECT
USING (bucket_id = 'community-media');

CREATE POLICY "Authenticated users can upload media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'community-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'community-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'community-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add indexes for performance
CREATE INDEX idx_posts_community_id ON public.posts(community_id);
CREATE INDEX idx_posts_author_id ON public.posts(author_id);
CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id);
CREATE INDEX idx_reactions_post_id ON public.reactions(post_id);
CREATE INDEX idx_comment_reactions_comment_id ON public.comment_reactions(comment_id);
CREATE INDEX idx_memberships_user_id ON public.memberships(user_id);
CREATE INDEX idx_memberships_community_id ON public.memberships(community_id);

-- Enable realtime for comment_reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.comment_reactions;