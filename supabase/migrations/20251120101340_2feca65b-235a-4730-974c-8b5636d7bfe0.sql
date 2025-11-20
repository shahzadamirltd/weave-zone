-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_community_created ON public.communities;
DROP TRIGGER IF EXISTS update_communities_updated_at ON public.communities;
DROP TRIGGER IF EXISTS update_posts_updated_at ON public.posts;
DROP TRIGGER IF EXISTS update_comments_updated_at ON public.comments;

-- Create trigger for post reactions (likes)
DROP TRIGGER IF EXISTS on_reaction_created ON public.reactions;
CREATE TRIGGER on_reaction_created
  AFTER INSERT ON public.reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_reaction();

-- Create trigger for comment reactions (likes)
DROP TRIGGER IF EXISTS on_comment_reaction_created ON public.comment_reactions;
CREATE TRIGGER on_comment_reaction_created
  AFTER INSERT ON public.comment_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment_reaction();

-- Create trigger for new comments
DROP TRIGGER IF EXISTS on_comment_created ON public.comments;
CREATE TRIGGER on_comment_created
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment();

-- Create trigger for comment replies
DROP TRIGGER IF EXISTS on_comment_reply_created ON public.comments;
CREATE TRIGGER on_comment_reply_created
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_comment_reply();

-- Create trigger for new community members
DROP TRIGGER IF EXISTS on_member_joined ON public.memberships;
CREATE TRIGGER on_member_joined
  AFTER INSERT ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_community_join();

-- Create trigger for payout requests
DROP TRIGGER IF EXISTS on_payout_requested ON public.payouts;
CREATE TRIGGER on_payout_requested
  AFTER INSERT ON public.payouts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payout_request();

-- Create trigger for completed payments
DROP TRIGGER IF EXISTS on_payment_completed ON public.payments;
CREATE TRIGGER on_payment_completed
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_received();

-- Create trigger for new posts by community owners
DROP TRIGGER IF EXISTS on_creator_post_created ON public.posts;
CREATE TRIGGER on_creator_post_created
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_members_on_creator_post();

-- Create trigger to automatically add community owner as member
CREATE TRIGGER on_community_created
  AFTER INSERT ON public.communities
  FOR EACH ROW
  EXECUTE FUNCTION public.add_owner_as_member();

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_communities_updated_at
  BEFORE UPDATE ON public.communities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();