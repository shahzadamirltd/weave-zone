import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Check if user has a theme preference
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
    setTheme(initialTheme);
    document.documentElement.classList.toggle("dark", initialTheme === "dark");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="relative h-10 w-10 rounded-full overflow-hidden transition-all"
    >
      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
        theme === "light" ? "rotate-0 scale-100" : "rotate-90 scale-0"
      }`}>
        <Sun className="h-5 w-5" />
      </div>
      <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${
        theme === "dark" ? "rotate-0 scale-100" : "-rotate-90 scale-0"
      }`}>
        <Moon className="h-5 w-5" />
      </div>
    </Button>
  );
}
