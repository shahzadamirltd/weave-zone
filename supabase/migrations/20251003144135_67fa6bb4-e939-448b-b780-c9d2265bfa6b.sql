-- Allow users with paid access to view comments (not only members)
DROP POLICY IF EXISTS "Members can view comments on posts in their communities" ON public.comments;

CREATE POLICY "Members or paid users can view comments" 
ON public.comments 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM posts
    WHERE posts.id = comments.post_id
      AND (
        is_community_member(auth.uid(), posts.community_id)
        OR has_paid_access(auth.uid(), posts.community_id)
      )
  )
);