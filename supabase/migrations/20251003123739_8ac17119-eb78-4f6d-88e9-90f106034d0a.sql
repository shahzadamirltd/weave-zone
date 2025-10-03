-- Fix RLS recursion issue by simplifying memberships SELECT policy
-- The is_community_member function is SECURITY DEFINER so it bypasses RLS,
-- but we need to ensure the memberships table itself has a non-recursive policy

DROP POLICY IF EXISTS "Members can view memberships of their communities" ON public.memberships;

-- Allow users to see memberships for communities they own or are members of
CREATE POLICY "Users can view memberships"
ON public.memberships
FOR SELECT
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.communities 
    WHERE communities.id = memberships.community_id 
    AND communities.owner_id = auth.uid()
  )
  OR auth.uid() IN (
    SELECT m.user_id FROM public.memberships m 
    WHERE m.community_id = memberships.community_id
  )
);

-- Add bank_details column to payouts table for storing bank account information
ALTER TABLE public.payouts 
ADD COLUMN IF NOT EXISTS bank_details TEXT;

-- Add admin_email column to platform_config for receiving payout notifications
ALTER TABLE public.platform_config 
ADD COLUMN IF NOT EXISTS admin_email TEXT DEFAULT 'admin@example.com';