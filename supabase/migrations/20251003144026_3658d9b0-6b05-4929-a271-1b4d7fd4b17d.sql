-- Fix reactions INSERT policy to allow users with paid access
DROP POLICY IF EXISTS "Users can add reactions" ON public.reactions;

CREATE POLICY "Users can add reactions" 
ON public.reactions 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
    SELECT 1
    FROM posts
    WHERE posts.id = reactions.post_id
      AND (
        is_community_member(auth.uid(), posts.community_id)
        OR has_paid_access(auth.uid(), posts.community_id)
      )
  )
);

-- Fix comment_reactions INSERT policy to allow users with paid access
DROP POLICY IF EXISTS "Users can add comment reactions" ON public.comment_reactions;

CREATE POLICY "Users can add comment reactions" 
ON public.comment_reactions 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id 
  AND EXISTS (
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

-- Fix comments INSERT policy to allow users with paid access
DROP POLICY IF EXISTS "Members can create comments" ON public.comments;

CREATE POLICY "Members can create comments" 
ON public.comments 
FOR INSERT 
WITH CHECK (
  auth.uid() = author_id 
  AND EXISTS (
    SELECT 1
    FROM posts
    WHERE posts.id = comments.post_id
      AND (
        is_community_member(auth.uid(), posts.community_id)
        OR has_paid_access(auth.uid(), posts.community_id)
      )
  )
);