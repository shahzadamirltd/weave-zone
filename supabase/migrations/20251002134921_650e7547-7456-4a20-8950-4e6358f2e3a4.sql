-- Remove duplicate community names, keeping only the oldest one for each name
DELETE FROM public.communities a
USING public.communities b
WHERE LOWER(a.name) = LOWER(b.name)
  AND a.created_at > b.created_at;

-- Now add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX communities_name_unique_idx ON public.communities (LOWER(name));