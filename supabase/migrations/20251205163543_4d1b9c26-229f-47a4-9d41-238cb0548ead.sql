-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Add suspended column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ip_address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country text;

-- Create admin activity log
CREATE TABLE public.admin_activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id uuid NOT NULL,
    action text NOT NULL,
    target_type text,
    target_id uuid,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view activity log"
ON public.admin_activity_log
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert activity log"
ON public.admin_activity_log
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view and update all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all payments
CREATE POLICY "Admins can view all payments"
ON public.payments
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all payouts
CREATE POLICY "Admins can view all payouts"
ON public.payouts
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update payouts (for processing)
CREATE POLICY "Admins can update payouts"
ON public.payouts
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all posts
CREATE POLICY "Admins can view all posts"
ON public.posts
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete posts
CREATE POLICY "Admins can delete posts"
ON public.posts
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all communities
CREATE POLICY "Admins can view all communities"
ON public.communities
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to view all memberships
CREATE POLICY "Admins can view all memberships"
ON public.memberships
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));