-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS public.message_reactions CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.user_presence CASCADE;