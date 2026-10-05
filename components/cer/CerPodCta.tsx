"use client";

import { useCerSignup } from "@/components/cer/CerSignupProvider";

export const CER_SIGNUP_BUTTON_CLASS =
  "inline-flex items-center rounded-md bg-[#165B44] px-3 py-1.5 text-base font-bold text-white transition-opacity hover:opacity-90 sm:text-lg";

type CerPodCtaProps = {
  className?: string;
};

export function CerPodCta({ className }: CerPodCtaProps = {}) {
  const { openSignup } = useCerSignup();

  return (
    <button
      type="button"
      onClick={() => openSignup()}
      className={`${CER_SIGNUP_BUTTON_CLASS}${className ? ` ${className}` : ""}`}
    >
      iscriviti a una CER!
    </button>
  );
}
