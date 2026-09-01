import type { ReactNode } from "react";

type FaqItem = {
  question: string;
  answer: ReactNode;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Come fate a sapere il costo dell'energia di domani?",
    answer: (
      <>
        Usiamo i prezzi di mercato dell&apos;energia elettrica pubblicati ogni
        giorno per zona. Li traduciamo in una mail chiara: ore più convenienti,
        ore da evitare, senza jargon. In Italia il mercato è{" "}
        <em>zonale</em>: Nord, Centro-Nord, Centro-Sud, Sud, Calabria, Sicilia e
        Sardegna possono avere prezzi diversi nella stessa ora — per questo
        chiediamo la regione: così ti mostriamo i dati della zona in cui
        consumi.
      </>
    ),
  },
  {
    question: "Da dove prendete i dati?",
    answer: (
      <>
        Dai prezzi day-ahead pubblicati sulla{" "}
        <a
          href="https://transparency.entsoe.eu/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-foreground hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400"
        >
          Transparency Platform di ENTSO-E
        </a>
        , la rete europea dei gestori di trasmissione elettrica. È la fonte
        ufficiale UE dei mercati energetici: dati pubblici, standardizzati e
        usati dagli operatori di tutto il continente — non stime private.
      </>
    ),
  },
  {
    question: "È davvero gratis?",
    answer:
      "Sì. Ti iscrivi con regione ed email, ricevi l'aggiornamento quotidiano e puoi annullare quando vuoi dal link in fondo a ogni messaggio.",
  },
  {
    question: "Perché conta la regione?",
    answer:
      "In Italia il costo dell'energia può variare per zona di mercato. Con la regione giusta ti mandiamo i dati rilevanti per dove consumi.",
  },
  {
    question: "Come leggo il grafico?",
    answer:
      "L'asse verticale è in centesimi di euro per kilowattora (c€/kWh): è il prezzo all'ingrosso di un'ora di consumo, non la bolletta finale. L'asse orizzontale copre l'intera giornata, da mezzanotte a mezzanotte. La curva gialla segue l'andamento orario; nella giornata di oggi la linea rossa verticale indica l'ora attuale. Le 🍌 segnano i momenti più convenienti, le 🐵 i picchi da evitare — se due valli o due picchi distano poco, li segnaliamo entrambi. Sotto, la tabella ripete gli stessi valori ogni quarto d'ora.",
  },
  {
    question: "Come faccio a vedere il prezzo puntuale di un punto sul grafico?",
    answer:
      "Tocca o clicca un punto sulla curva: in alto a destra compare un riquadro con orario, prezzo e una percentuale. Lo 0% è il momento più conveniente della giornata (🍌), il 100% il più caro (🐵). Sotto il 50% vedi una 🍌, sopra una 🐵. Le linee tratteggiate ti mostrano dove sei; per chiudere tocca il riquadro o la ×. I prezzi puntuali ogni quarto d'ora restano comunque tutti visibili nella tabella sotto il grafico.",
  },
  {
    question: "Il prezzo all'ingrosso è quello che pago in bolletta?",
    answer:
      "No. Quello che mostriamo è il prezzo all'ingrosso: quanto costa l'energia sul mercato, ora per ora. Quello che paghi tu dipende dal contratto. Con un piano a prezzo fisso il kWh resta uguale tutto il giorno — le oscillazioni del grafico non ti riguardano. Con un piano a fasce orarie o variabile, invece, la bolletta segue (in misura diversa) proprio questi movimenti: lì sapere quando consumare può fare la differenza.",
  },
];

export function Faq() {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="w-full scroll-mt-20 border-t border-neutral-200 pt-12 dark:border-neutral-800"
    >
      <h2
        id="faq-heading"
        className="text-lg font-medium tracking-tight text-foreground sm:text-xl"
      >
        FAQ
      </h2>
      <dl className="mt-6 space-y-6">
        {FAQ_ITEMS.map((item) => (
          <div key={item.question}>
            <dt className="text-sm font-medium text-foreground">
              {item.question}
            </dt>
            <dd className="mt-1.5 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              {item.answer}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
