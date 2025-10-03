-- Critical fix: Add trigger to automatically add community owners as members
-- This is essential for RLS policies to work correctly
CREATE TRIGGER trigger_add_owner_as_member
  AFTER INSERT ON public.communities
  FOR EACH ROW
  EXECUTE FUNCTION public.add_owner_as_member();

-- Ensure all notification triggers are in place
-- These may have been missing or not properly created

-- Trigger for post likes
DROP TRIGGER IF EXISTS trigger_notify_post_like ON public.reactions;
CREATE TRIGGER trigger_notify_post_like
  AFTER INSERT ON public.reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_like();

-- Trigger for comments
DROP TRIGGER IF EXISTS trigger_notify_comment ON public.comments;
CREATE TRIGGER trigger_notify_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment();

-- Trigger for comment replies
DROP TRIGGER IF EXISTS trigger_notify_comment_reply ON public.comments;
CREATE TRIGGER trigger_notify_comment_reply
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment_reply();

-- Trigger for community joins
DROP TRIGGER IF EXISTS trigger_notify_community_join ON public.memberships;
CREATE TRIGGER trigger_notify_community_join
  AFTER INSERT ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_community_join();

-- Trigger for payout requests
DROP TRIGGER IF EXISTS trigger_notify_payout_request ON public.payouts;
CREATE TRIGGER trigger_notify_payout_request
  AFTER INSERT ON public.payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payout_request();

-- Trigger for payments received
DROP TRIGGER IF EXISTS trigger_notify_payment_received ON public.payments;
CREATE TRIGGER trigger_notify_payment_received
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status != 'completed')
  EXECUTE FUNCTION public.notify_payment_received();