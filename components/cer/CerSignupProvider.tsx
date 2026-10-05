"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CerSignupDialog } from "@/components/cer/CerSignupDialog";
import type { PodCerHit } from "@/lib/cer/pod-parse";

export type CerSignupPrefill = {
  cabinaCodice?: string | null;
  cabinaGestore?: string | null;
  initialPod?: string | null;
  cers?: PodCerHit[];
};

type CerSignupContextValue = {
  openSignup: (prefill?: CerSignupPrefill) => void;
};

const CerSignupContext = createContext<CerSignupContextValue | null>(null);

export function CerSignupProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const [prefill, setPrefill] = useState<CerSignupPrefill>({});

  const openSignup = useCallback((next?: CerSignupPrefill) => {
    setPrefill(next ?? {});
    setSession((n) => n + 1);
    setOpen(true);
  }, []);

  const value = useMemo(() => ({ openSignup }), [openSignup]);

  return (
    <CerSignupContext.Provider value={value}>
      {children}
      <CerSignupDialog
        key={session}
        open={open}
        onClose={() => setOpen(false)}
        cabinaCodice={prefill.cabinaCodice ?? null}
        cabinaGestore={prefill.cabinaGestore}
        initialPod={prefill.initialPod ?? null}
        cers={prefill.cers ?? []}
      />
    </CerSignupContext.Provider>
  );
}

export function useCerSignup() {
  const context = useContext(CerSignupContext);
  if (!context) {
    throw new Error("useCerSignup must be used within CerSignupProvider");
  }
  return context;
}

export function useCerSignupOptional() {
  return useContext(CerSignupContext);
}
