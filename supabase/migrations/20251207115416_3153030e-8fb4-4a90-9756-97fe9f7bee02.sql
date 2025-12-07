-- Create live chat support tables
CREATE TABLE IF NOT EXISTS public.support_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, closed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  admin_id UUID
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.support_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Enable realtime for live chat
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;

-- RLS Policies for support_chats
CREATE POLICY "Users can view their own chats" ON public.support_chats
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own chats" ON public.support_chats
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all chats" ON public.support_chats
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all chats" ON public.support_chats
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for support_messages
CREATE POLICY "Users can view messages in their chats" ON public.support_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.support_chats WHERE id = chat_id AND user_id = auth.uid())
    OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Users can send messages in their chats" ON public.support_messages
  FOR INSERT WITH CHECK (
    (auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.support_chats WHERE id = chat_id AND user_id = auth.uid()))
    OR (has_role(auth.uid(), 'admin') AND is_admin = true)
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_support_chats_user_id ON public.support_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_support_chats_status ON public.support_chats(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_chat_id ON public.support_messages(chat_id);

-- Create trigger for updated_at
CREATE TRIGGER update_support_chats_updated_at
  BEFORE UPDATE ON public.support_chats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();