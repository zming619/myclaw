"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number; // Delay in ms
  threshold?: number; // Threshold for intersection observer
  duration?: number; // Transition duration in ms
  direction?: "up" | "down" | "left" | "right"; // Direction for the reveal
}

export function Reveal({
  children,
  className,
  delay = 0,
  threshold = 0.2,
  duration = 700,
  direction = "up",
}: RevealProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [threshold]);

  const translateY = direction === "up" ? "translate-y-8" : direction === "down" ? "-translate-y-8" : "translate-y-0";
  const translateX = direction === "left" ? "translate-x-8" : direction === "right" ? "-translate-x-8" : "translate-x-0";

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all ease-out",
        isVisible ? "opacity-100 translate-x-0 translate-y-0" : cn("opacity-0", translateY, translateX),
        className
      )}
      style={{
        transitionDelay: `${delay}ms`,
        transitionDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}
