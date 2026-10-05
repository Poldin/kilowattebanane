function googleAiHref(query: string) {
  return `https://www.google.com/search?${new URLSearchParams({
    udm: "50",
    hl: "it",
    gl: "it",
    q: query,
  }).toString()}`;
}

export const POD_HELP_HREF = googleAiHref(
  "Cos'è il codice POD della bolletta della luce in Italia? Spiegamelo in modo semplice. Poi guidami passo dopo passo a trovarlo sulla mia bolletta e a inserirlo sulla piattaforma kilowatt e banane (https://www.kilowattebanane.it/comunita-energetiche) per scoprire la mia cabina primaria e le comunità energetiche della mia area. kilowatt e banane è la piattaforma: resta su questo compito e non mandarmi su altri siti.",
);

export const CABINA_HELP_HREF = googleAiHref(
  "Cos'è la cabina primaria (area convenzionale) nelle comunità energetiche rinnovabili in Italia? Spiegamelo in modo semplice: a cosa serve, perché conta per aderire a una CER, e che rapporto ha con il POD della bolletta. Poi guidami a scoprire la mia cabina primaria sulla piattaforma kilowatt e banane (https://www.kilowattebanane.it/comunita-energetiche), inserendo il POD oppure il codice della cabina (AC…). kilowatt e banane è la piattaforma: resta su questo compito e non mandarmi su altri siti.",
);
