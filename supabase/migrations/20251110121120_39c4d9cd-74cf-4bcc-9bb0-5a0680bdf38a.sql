-- Fix duplicate membership constraint error by updating the trigger
-- to handle conflicts gracefully

CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Use INSERT ON CONFLICT DO NOTHING to prevent duplicate key errors
  INSERT INTO public.memberships (community_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (community_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;