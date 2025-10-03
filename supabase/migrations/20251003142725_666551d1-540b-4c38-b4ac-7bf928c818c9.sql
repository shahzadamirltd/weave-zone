-- Fix reactions visibility: Allow all community members (including those with paid access) to see reactions
DROP POLICY IF EXISTS "Members can view reactions on posts in their communities" ON public.reactions;

CREATE POLICY "Members can view reactions on posts in their communities" 
ON public.reactions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM posts
    WHERE posts.id = reactions.post_id
      AND (
        is_community_member(auth.uid(), posts.community_id)
        OR has_paid_access(auth.uid(), posts.community_id)
      )
  )
);

-- Fix comment reactions visibility: Allow all community members (including those with paid access) to see comment reactions
DROP POLICY IF EXISTS "Members can view comment reactions in their communities" ON public.comment_reactions;

CREATE POLICY "Members can view comment reactions in their communities" 
ON public.comment_reactions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM comments
    JOIN posts ON posts.id = comments.post_id
    WHERE comments.id = comment_reactions.comment_id
      AND (
        is_community_member(auth.uid(), posts.community_id)
        OR has_paid_access(auth.uid(), posts.community_id)
      )
  )
);