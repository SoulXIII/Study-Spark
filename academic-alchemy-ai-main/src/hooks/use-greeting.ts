import { useState, useEffect } from "react";

interface GreetingInfo {
  greeting: string;
  emoji: string;
  timeOfDay: "morning" | "afternoon" | "evening" | "night";
}

export const useGreeting = (): GreetingInfo => {
  const [greeting, setGreeting] = useState<GreetingInfo>({
    greeting: "Good morning",
    emoji: "👋",
    timeOfDay: "morning",
  });

  useEffect(() => {
    const getGreeting = () => {
      const now = new Date();
      const hour = now.getHours();

      let greetingText: string;
      let emoji: string;
      let timeOfDay: "morning" | "afternoon" | "evening" | "night";

      // Determine greeting based on hour
      if (hour >= 5 && hour < 12) {
        greetingText = "Good morning";
        emoji = "🌅";
        timeOfDay = "morning";
      } else if (hour >= 12 && hour < 17) {
        greetingText = "Good afternoon";
        emoji = "☀️";
        timeOfDay = "afternoon";
      } else if (hour >= 17 && hour < 21) {
        greetingText = "Good evening";
        emoji = "🌆";
        timeOfDay = "evening";
      } else {
        greetingText = "Good night, night owl";
        emoji = "🌙";
        timeOfDay = "night";
      }

      setGreeting({
        greeting: greetingText,
        emoji,
        timeOfDay,
      });
    };

    getGreeting();

    // Update greeting every minute
    const interval = setInterval(getGreeting, 60000);
    return () => clearInterval(interval);
  }, []);

  return greeting;
};
