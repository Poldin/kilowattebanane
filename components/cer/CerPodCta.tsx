"use client";

import { useCerSignup } from "@/components/cer/CerSignupProvider";

type CerPodCtaProps = {
  className?: string;
};

export function CerPodCta({ className }: CerPodCtaProps = {}) {
  const { openSignup } = useCerSignup();

  return (
    <button
      type="button"
      onClick={() => openSignup()}
      className={`inline-flex items-center rounded-md bg-[#165B44] px-3 py-1.5 text-base font-bold text-white transition-opacity hover:opacity-90 sm:text-lg${className ? ` ${className}` : ""}`}
    >
      iscriviti a una CER!
    </button>
  );
}
