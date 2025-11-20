import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageCircle, Mail, Book } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export default function Help() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  const { data: user } = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const handleSendHelp = async () => {
    if (!subject.trim() || !message.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-help-email", {
        body: {
          subject,
          message,
          userEmail: user?.email || "anonymous@user.com",
          userName: profile?.username || "Anonymous User",
        },
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your message has been sent. We'll get back to you soon!",
      });
      
      setSubject("");
      setMessage("");
      setOpen(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Help & Support</h1>
          </div>
        </header>

        <div className="p-8">
          <div className="max-w-5xl space-y-6">
            {/* Contact Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Card className="border-2 hover:shadow-lg transition-all cursor-pointer hover-lift">
                    <CardHeader className="text-center">
                      <Mail className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <CardTitle className="text-lg">Contact Support</CardTitle>
                      <CardDescription>Send us an email</CardDescription>
                    </CardHeader>
                  </Card>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Contact Support</DialogTitle>
                    <DialogDescription>
                      Send your message to buyverly@gmail.com
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="subject">Subject</Label>
                      <Input
                        id="subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="What do you need help with?"
                      />
                    </div>
                    <div>
                      <Label htmlFor="message">Message</Label>
                      <Textarea
                        id="message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Describe your issue or question..."
                        rows={6}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSendHelp} disabled={loading}>
                      {loading ? "Sending..." : "Send Message"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Card className="border-2 hover:shadow-lg transition-all cursor-pointer hover-lift">
                <CardHeader className="text-center">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <CardTitle className="text-lg">Live Chat</CardTitle>
                  <CardDescription>Chat with our support team</CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-2 hover:shadow-lg transition-all cursor-pointer hover-lift">
                <CardHeader className="text-center">
                  <Book className="h-8 w-8 mx-auto mb-2 text-primary" />
                  <CardTitle className="text-lg">Documentation</CardTitle>
                  <CardDescription>Browse our guides</CardDescription>
                </CardHeader>
              </Card>
            </div>

            {/* FAQ */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
                <CardDescription>Quick answers to common questions</CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="item-1">
                    <AccordionTrigger>How do I create a community?</AccordionTrigger>
                    <AccordionContent>
                      Click the "+" button at the bottom right corner of the dashboard to create a new community. Fill in the details and choose your pricing model.
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-2">
                    <AccordionTrigger>How do payments work?</AccordionTrigger>
                    <AccordionContent>
                      Payments are processed securely through Stripe. You can set up one-time payments or subscriptions for your communities. Earnings are tracked in the Payments section.
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-3">
                    <AccordionTrigger>Can I customize my community?</AccordionTrigger>
                    <AccordionContent>
                      Yes! You can customize your community name, description, avatar, pricing, and privacy settings. Go to your community settings to make changes.
                    </AccordionContent>
                  </AccordionItem>
                  
                  <AccordionItem value="item-4">
                    <AccordionTrigger>How do I manage members?</AccordionTrigger>
                    <AccordionContent>
                      As a community owner, you can view all members in your community page. You have the ability to moderate posts and manage access based on your community settings.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
