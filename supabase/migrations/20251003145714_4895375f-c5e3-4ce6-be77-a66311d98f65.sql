-- Allow users with paid access to create posts (not only members)
DROP POLICY IF EXISTS "Members can create posts in their communities" ON public.posts;

CREATE POLICY "Members or paid users can create posts" 
ON public.posts 
FOR INSERT 
WITH CHECK (
  auth.uid() = author_id 
  AND (
    is_community_member(auth.uid(), community_id)
    OR has_paid_access(auth.uid(), community_id)
  )
);