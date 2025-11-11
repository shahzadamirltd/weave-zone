-- Fix critical security issues

-- 1. Restrict profiles table to authenticated users only
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 2. Fix notifications - remove open INSERT policy
-- Notifications should only be created by backend functions with service role
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;