
-- Create IP blocklist table
CREATE TABLE public.ip_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  country TEXT,
  reason TEXT,
  blocked_by uuid REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(ip_address)
);

-- Enable RLS
ALTER TABLE public.ip_blocklist ENABLE ROW LEVEL SECURITY;

-- Only admins can manage IP blocks
CREATE POLICY "Admins can manage IP blocklist"
ON public.ip_blocklist
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create country blocklist table  
CREATE TABLE public.country_blocklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  reason TEXT,
  blocked_by uuid REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(country_code)
);

-- Enable RLS
ALTER TABLE public.country_blocklist ENABLE ROW LEVEL SECURITY;

-- Only admins can manage country blocks
CREATE POLICY "Admins can manage country blocklist"
ON public.country_blocklist
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));
