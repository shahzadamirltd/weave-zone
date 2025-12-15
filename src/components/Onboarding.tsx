import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageCircle, Users, DollarSign, Shield, ArrowRight, Check } from "lucide-react";

interface OnboardingProps {
  onComplete: () => void;
}

const steps = [
  {
    icon: MessageCircle,
    title: "Welcome to Communities",
    description: "Connect with like-minded people, share content, and build meaningful relationships in your own private communities.",
    color: "bg-primary",
  },
  {
    icon: Users,
    title: "Create & Join Communities",
    description: "Start your own community or join existing ones. Share posts, media, voice messages, and engage with members in real-time.",
    color: "bg-blue-500",
  },
  {
    icon: DollarSign,
    title: "Monetize Your Content",
    description: "Set up paid communities with one-time or subscription pricing. Receive tips during live streams and grow your earnings.",
    color: "bg-amber-500",
  },
  {
    icon: Shield,
    title: "Safe & Secure",
    description: "Your data is protected with enterprise-grade security. Real-time messaging keeps your community connected 24/7.",
    color: "bg-emerald-500",
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-card flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-12">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentStep
                  ? "w-8 bg-primary"
                  : index < currentStep
                  ? "w-2 bg-primary/50"
                  : "w-2 bg-border"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            {/* Icon */}
            <div className={`w-20 h-20 mx-auto mb-8 rounded-2xl ${steps[currentStep].color} flex items-center justify-center shadow-elevated`}>
              {(() => {
                const Icon = steps[currentStep].icon;
                return <Icon className="h-10 w-10 text-white" />;
              })()}
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-foreground mb-4">
              {steps[currentStep].title}
            </h1>

            {/* Description */}
            <p className="text-muted-foreground leading-relaxed mb-12">
              {steps[currentStep].description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={handleNext}
            className="w-full py-6 rounded-xl text-base font-medium"
          >
            {currentStep === steps.length - 1 ? (
              <>
                <Check className="h-5 w-5 mr-2" />
                Get Started
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>
          
          {currentStep < steps.length - 1 && (
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="w-full py-6 rounded-xl text-base text-muted-foreground"
            >
              Skip
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
