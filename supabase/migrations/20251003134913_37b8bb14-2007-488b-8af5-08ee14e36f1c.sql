-- Create security definer function to check community membership
CREATE OR REPLACE FUNCTION public.user_is_community_member(_user_id uuid, _community_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = _user_id
      AND community_id = _community_id
  )
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Public communities viewable by all" ON public.communities;
DROP POLICY IF EXISTS "Users can view memberships" ON public.memberships;

-- Recreate communities policy without recursion
CREATE POLICY "Public communities viewable by all" 
ON public.communities 
FOR SELECT 
USING (
  (NOT is_private) 
  OR public.user_is_community_member(auth.uid(), id)
);

-- Recreate memberships policy without recursion
CREATE POLICY "Users can view memberships" 
ON public.memberships 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR (
    SELECT owner_id 
    FROM public.communities 
    WHERE id = memberships.community_id
  ) = auth.uid()
  OR public.user_is_community_member(auth.uid(), community_id)
);

-- Update admin email in platform_config
UPDATE public.platform_config 
SET admin_email = 'buyverly@buyverly.store'
WHERE id IS NOT NULL;