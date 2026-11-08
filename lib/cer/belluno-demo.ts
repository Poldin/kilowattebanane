export type CerDemoHit = {
  id: string;
  denominazione: string;
  comune: string;
  potenzaKw: number | null;
  nUtenze: number | null;
};

export const BELLUNO_DEMO_CERS: CerDemoHit[] = [
  {
    id: "demo-zoldo",
    denominazione: "Zoldo",
    comune: "Val di Zoldo",
    potenzaKw: 120.7,
    nUtenze: 80,
  },
  {
    id: "demo-feltrenergy",
    denominazione: "Feltrenergy",
    comune: "Feltre",
    potenzaKw: 47,
    nUtenze: 12,
  },
  {
    id: "demo-eyco",
    denominazione: "EYCO",
    comune: "Pieve di Cadore",
    potenzaKw: 46.9,
    nUtenze: 12,
  },
];
