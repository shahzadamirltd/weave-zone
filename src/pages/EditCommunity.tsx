import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Upload, Trash2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function EditCommunity() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [pricingType, setPricingType] = useState<"free" | "one_time" | "lifetime" | "recurring_monthly">("free");
  const [price, setPrice] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [allowMemberPosts, setAllowMemberPosts] = useState(true);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  const { data: community } = useQuery({
    queryKey: ["community", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("communities")
        .select("*")
        .eq("id", id)
        .single();
      return data;
    },
  });

  useEffect(() => {
    if (community) {
      setName(community.name || "");
      setDescription(community.description || "");
      setIsPrivate(community.is_private || false);
      setPricingType(community.pricing_type || "free");
      setPrice(community.price_amount ? community.price_amount.toString() : "");
      setAvatarPreview(community.avatar_url || "");
      setAllowMemberPosts((community as any).allow_member_posts ?? true);
    }
  }, [community]);

  // Check if user is owner
  useEffect(() => {
    if (community && profile && community.owner_id !== profile.id) {
      toast({
        title: "Access Denied",
        description: "Only the community owner can edit this community",
        variant: "destructive",
      });
      navigate(`/community/${id}`);
    }
  }, [community, profile, id, navigate, toast]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let avatarUrl = community?.avatar_url;

      // Upload new avatar if selected
      if (avatarFile) {
        const fileExt = avatarFile.name.split('.').pop();
        const fileName = `${profile?.id}/${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('community-media')
          .upload(fileName, avatarFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('community-media')
          .getPublicUrl(fileName);
        
        avatarUrl = publicUrl;
      }

      const { error } = await supabase
        .from("communities")
        .update({
          name,
          description,
          is_private: isPrivate,
          pricing_type: pricingType,
          price_amount: pricingType !== "free" && price ? parseFloat(price) : null,
          avatar_url: avatarUrl,
          allow_member_posts: allowMemberPosts,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Community updated successfully",
      });

      navigate(`/community/${id}`);
    } catch (error: any) {
      console.error("Update community error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update community",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("communities")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Community deleted successfully",
      });

      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete community",
        variant: "destructive",
      });
    }
  };

  if (!community) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-64 flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 px-8 py-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(`/community/${id}`)}
              className="rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Edit Community</h1>
          </div>
        </header>

        <div className="p-8">
          <div className="max-w-2xl">
            <div className="border border-border rounded-2xl p-6 space-y-6 bg-card">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Avatar Upload */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Community Image</Label>
                  <div className="flex items-center gap-4">
                    {avatarPreview && (
                      <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-border">
                        <img src={avatarPreview} alt="Community" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('avatar-upload')?.click()}
                      className="gap-2"
                    >
                      <Upload className="h-4 w-4" />
                      {avatarPreview ? 'Change Image' : 'Upload Image'}
                    </Button>
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Community Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Web Developers"
                    required
                    maxLength={100}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what your community is about..."
                    rows={4}
                    maxLength={500}
                    className="resize-none"
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/30">
                  <div className="space-y-1">
                    <Label htmlFor="private" className="text-sm font-medium">Private Community</Label>
                    <p className="text-xs text-muted-foreground">
                      Only people with an invite link can join
                    </p>
                  </div>
                  <Switch
                    id="private"
                    checked={isPrivate}
                    onCheckedChange={setIsPrivate}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border p-4 bg-muted/30">
                  <div className="space-y-1">
                    <Label htmlFor="allow-posts" className="text-sm font-medium">Allow Member Posts</Label>
                    <p className="text-xs text-muted-foreground">
                      Let members create posts in this community
                    </p>
                  </div>
                  <Switch
                    id="allow-posts"
                    checked={allowMemberPosts}
                    onCheckedChange={setAllowMemberPosts}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pricing" className="text-sm font-medium">Pricing Type</Label>
                  <select
                    id="pricing"
                    className="w-full h-11 px-4 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    value={pricingType}
                    onChange={(e) => setPricingType(e.target.value as any)}
                  >
                    <option value="free">Free</option>
                    <option value="one_time">One-Time Payment</option>
                    <option value="lifetime">Lifetime Access</option>
                    <option value="recurring_monthly">Monthly Subscription</option>
                  </select>
                </div>

                {pricingType !== "free" && (
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-sm font-medium">Price ($)</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="5"
                      placeholder="5.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                      className="h-11"
                    />
                    <p className="text-xs text-muted-foreground">Minimum price is $5</p>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(`/community/${id}`)}
                    className="flex-1 h-11"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading} className="flex-1 h-11">
                    {isLoading ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>

              {/* Delete Section */}
              <div className="pt-6 border-t border-destructive/20">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
                    <p className="text-sm text-muted-foreground">
                      Deleting this community is permanent and cannot be undone
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="gap-2">
                        <Trash2 className="h-4 w-4" />
                        Delete Community
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. This will permanently delete the
                          community and remove all associated data including posts, members, and payments.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
