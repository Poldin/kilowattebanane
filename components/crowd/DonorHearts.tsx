"use client";

import { Heart } from "lucide-react";
import { useState } from "react";

function heartIconClass(size: "sm" | "md" | "lg") {
  if (size === "lg") return "h-6 w-6 sm:h-7 sm:w-7";
  if (size === "md") return "h-5 w-5";
  return "h-4 w-4";
}

export function DonorHearts({
  donorName,
  size = "sm",
  className = "",
}: {
  donorName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [liked, setLiked] = useState(false);
  const icon = heartIconClass(size);

  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={liked ? `Togli il cuore a ${donorName}` : `Metti un cuore a ${donorName}`}
      onClick={() => setLiked((value) => !value)}
      className={`inline-flex shrink-0 rounded-md p-1 text-neutral-400 transition-colors hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-600${className ? ` ${className}` : ""}`}
    >
      <Heart
        className={`${icon}${liked ? " fill-red-500 text-red-500" : ""}`}
        strokeWidth={liked ? 0 : 2}
      />
    </button>
  );
}
