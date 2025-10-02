-- Add pricing and payment tables for paid community system

-- Pricing tiers enum
CREATE TYPE public.pricing_type AS ENUM ('free', 'one_time', 'lifetime', 'recurring_monthly');

-- Platform configuration table (for admin-configurable settings)
CREATE TABLE public.platform_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  grace_period_days INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add pricing to communities
ALTER TABLE public.communities
ADD COLUMN pricing_type public.pricing_type NOT NULL DEFAULT 'free',
ADD COLUMN price_amount DECIMAL(10,2),
ADD COLUMN stripe_price_id TEXT,
ADD COLUMN stripe_product_id TEXT,
ADD COLUMN trial_period_days INTEGER DEFAULT 0,
ADD COLUMN preview_enabled BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN approval_required BOOLEAN NOT NULL DEFAULT false;

-- Payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL,
  creator_earnings DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_type public.pricing_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  grace_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, community_id)
);

-- Payouts table (for creator withdrawals)
CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_details JSONB,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Refund requests table
CREATE TABLE public.refund_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_refund_id TEXT,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Coupon codes table
CREATE TABLE public.coupon_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID REFERENCES public.communities(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  stripe_coupon_id TEXT,
  max_uses INTEGER,
  times_used INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for platform_config (read-only for all, only admin can update)
CREATE POLICY "Anyone can view platform config"
ON public.platform_config FOR SELECT
USING (true);

-- RLS Policies for payments
CREATE POLICY "Users can view their own payments"
ON public.payments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Community owners can view payments for their communities"
ON public.payments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.communities
  WHERE communities.id = payments.community_id
  AND communities.owner_id = auth.uid()
));

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their own subscriptions"
ON public.subscriptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Community owners can view subscriptions for their communities"
ON public.subscriptions FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.communities
  WHERE communities.id = subscriptions.community_id
  AND communities.owner_id = auth.uid()
));

-- RLS Policies for payouts
CREATE POLICY "Creators can view their own payouts"
ON public.payouts FOR SELECT
USING (auth.uid() = creator_id);

CREATE POLICY "Creators can request payouts"
ON public.payouts FOR INSERT
WITH CHECK (auth.uid() = creator_id);

-- RLS Policies for refund_requests
CREATE POLICY "Users can view their own refund requests"
ON public.refund_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create refund requests"
ON public.refund_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for coupon_codes
CREATE POLICY "Community owners can manage their coupon codes"
ON public.coupon_codes FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.communities
  WHERE communities.id = coupon_codes.community_id
  AND communities.owner_id = auth.uid()
));

CREATE POLICY "Anyone can view active coupon codes"
ON public.coupon_codes FOR SELECT
USING (active = true AND (expires_at IS NULL OR expires_at > now()));

-- Triggers for updated_at
CREATE TRIGGER update_platform_config_updated_at
BEFORE UPDATE ON public.platform_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payouts_updated_at
BEFORE UPDATE ON public.payouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_refund_requests_updated_at
BEFORE UPDATE ON public.refund_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coupon_codes_updated_at
BEFORE UPDATE ON public.coupon_codes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default platform config
INSERT INTO public.platform_config (platform_fee_percentage, grace_period_days)
VALUES (10.00, 3);

-- Function to check if user has paid access to community
CREATE OR REPLACE FUNCTION public.has_paid_access(_user_id uuid, _community_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = _community_id
    AND (
      -- Free community
      c.pricing_type = 'free'
      OR
      -- Owner always has access
      c.owner_id = _user_id
      OR
      -- One-time or lifetime payment
      (c.pricing_type IN ('one_time', 'lifetime') AND EXISTS (
        SELECT 1 FROM public.payments p
        WHERE p.user_id = _user_id
        AND p.community_id = _community_id
        AND p.status = 'completed'
      ))
      OR
      -- Active subscription
      (c.pricing_type = 'recurring_monthly' AND EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.user_id = _user_id
        AND s.community_id = _community_id
        AND s.status = 'active'
        AND s.current_period_end > now()
      ))
    )
  )
$$;

-- Update membership RLS to include paid access check
DROP POLICY IF EXISTS "Members can view memberships of their communities" ON public.memberships;
CREATE POLICY "Members can view memberships of their communities"
ON public.memberships FOR SELECT
USING (
  is_community_member(auth.uid(), community_id)
  OR has_paid_access(auth.uid(), community_id)
);

-- Update posts RLS to include paid access check
DROP POLICY IF EXISTS "Members can view posts in their communities" ON public.posts;
CREATE POLICY "Members can view posts in their communities"
ON public.posts FOR SELECT
USING (
  is_community_member(auth.uid(), community_id)
  OR has_paid_access(auth.uid(), community_id)
);