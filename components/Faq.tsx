import type { ReactNode } from "react";
import Link from "next/link";

export const FAQ_TOMORROW_ID = "faq-costo-domani";
export const FAQ_POCKET_ID = "faq-soldi-in-tasca";

export const FAQ_TOMORROW_Q =
  "Come fate a sapere il costo dell'energia di domani?";
export const FAQ_POCKET_Q =
  "Ok, sono prezzi all'ingrosso ma cosa significa in termini di soldi che mi restano in tasca?";

const FAQ_LINK_CLASS =
  "underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-foreground hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400";

type FaqItem = {
  id?: string;
  question: string;
  answer: ReactNode;
};

const FAQ_ITEMS: FaqItem[] = [
  {
    id: FAQ_TOMORROW_ID,
    question: FAQ_TOMORROW_Q,
    answer: (
      <>
        Usiamo i prezzi di mercato dell&apos;energia elettrica pubblicati ogni
        giorno per zona. Li traduciamo in una mail: ore più convenienti, ore da
        evitare. I prezzi di <em>domani</em> escono nel pomeriggio: te li
        mandiamo appena ci sono, così al mattino dopo li hai già. In Italia
        Nord, Centro-Nord, Centro-Sud, Sud, Calabria, Sicilia e Sardegna
        possono avere prezzi diversi nella stessa ora. Per questo chiediamo la
        regione: ti mostriamo la zona in cui consumi.
      </>
    ),
  },
  {
    question: "Quando escono i prezzi di domani?",
    answer:
      "Il mercato del giorno dopo chiude a mezzogiorno: gli operatori comprano e vendono l'energia di domani. I prezzi si pubblicano nel pomeriggio, e a quel punto li tiriamo su e partono le mail. Sulla home, dopo le 22, se i dati di domani ci sono già il grafico passa da solo a domani. Prima resti su oggi: domani lo trovi con le frecce o nell'archivio.",
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
          className={FAQ_LINK_CLASS}
        >
          Transparency Platform di ENTSO-E
        </a>
        , la rete europea dei gestori di trasmissione elettrica. È la fonte
        ufficiale UE dei mercati energetici: dati pubblici, standardizzati e
        usati dagli operatori di tutto il continente, non stime private.
      </>
    ),
  },
  {
    question: "È davvero gratis?",
    answer:
      "Sì. Ti iscrivi con regione ed email, ricevi l'aggiornamento quotidiano e puoi annullare quando vuoi dal link in fondo a ogni messaggio. Grafico, tabella e simulazione li usi anche senza iscriverti.",
  },
  {
    question: "Perché conta la regione?",
    answer:
      "In Italia il costo dell'energia può variare per zona di mercato. Con la regione giusta ti mandiamo i dati di dove consumi, non la media Italia.",
  },
  {
    question: "Come leggo il grafico?",
    answer:
      "L'asse verticale è in centesimi di euro per kilowattora (c€/kWh): è il prezzo all'ingrosso di un'ora di consumo, non la bolletta. L'asse orizzontale va da mezzanotte a mezzanotte. La curva gialla è l'andamento orario; nella giornata di oggi la linea rossa verticale è l'ora attuale. Le 🍌 segnano i momenti più convenienti, le 🐵 i picchi da evitare. Se due valli o due picchi distano poco, li segnaliamo entrambi. Tocca o clicca un punto sulla curva: in alto a destra compare orario, prezzo e una percentuale (0% = 🍌 del giorno, 100% = 🐵). Sotto il 50% vedi una 🍌, sopra una 🐵. Per chiudere, tocca il riquadro o la ×. La tabella sotto ripete gli stessi valori ogni quarto d'ora.",
  },
  {
    question: "Il prezzo all'ingrosso è quello che pago in bolletta?",
    answer:
      "No. Quello che mostriamo è il prezzo all'ingrosso: quanto costa l'energia sul mercato, ora per ora. Quello che paghi tu dipende dal contratto. Con un piano a prezzo fisso il kWh resta uguale tutto il giorno: le oscillazioni del grafico non ti riguardano. Con un piano a fasce orarie o variabile, invece, la bolletta segue (in misura diversa) proprio questi movimenti: lì sapere quando consumare può fare la differenza.",
  },
  {
    id: FAQ_POCKET_ID,
    question: FAQ_POCKET_Q,
    answer: (
      <>
        Il numero della simulazione è all&apos;ingrosso. Quello che ti resta in
        tasca dipende dal contratto.
        <br />
        <br />
        Con un <em>variabile</em> o indicizzato al PUN / prezzo zonale,
        spostare lavatrice e lavastoviglie nelle ore basse ti lascia in tasca,
        in larga parte, proprio il delta che vedi: un po&apos; di più se conti
        IVA e perdite di rete sulla materia energia, non il doppio. Con un{" "}
        <em>fisso</em>, zero: la simulazione racconta il mercato, non il tuo
        risparmio. Con le <em>fasce</em> (F1/F2/F3 o bioraria) conta la
        fascia, non il quarto d&apos;ora: se la banana cade in F3 e la scimmia
        in F1 il senso è lo stesso, l&apos;importo è più grezzo.
        <br />
        <br />
        Perché non è il doppio. In bolletta l&apos;energia è solo una fetta:
        rete, oneri e tasse le paghi a qualsiasi ora.{" "}
        <a
          href="https://www.arera.it/fileadmin/allegati/com_stampa/25/Comunicato_ARERA_aggiornamento_servizio_di_Maggior_Tutela_IV_trimestre_2025.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className={FAQ_LINK_CLASS}
        >
          ARERA, sul cliente tipo in Maggior Tutela da ottobre 2025
        </a>
        , metteva circa metà del kWh sull&apos;approvvigionamento (14,25 c€ su
        28,75). Nello stesso anno il PUN medio — l&apos;ingrosso nazionale —
        era{" "}
        <strong>11,59 c€/kWh</strong>, come riporta la{" "}
        <a
          href="https://www.arera.it/chi-siamo/relazione-annuale/relazione-annuale-2026"
          target="_blank"
          rel="noopener noreferrer"
          className={FAQ_LINK_CLASS}
        >
          Relazione annuale ARERA 2026
        </a>
        . Un kWh in tasca costa circa due volte e mezzo l&apos;ingrosso non
        perché il fornitore triplica, ma perché metà bolletta non è energia.
        Non moltiplicare il risparmio per 2,5.
      </>
    ),
  },
  {
    question: "Quando conviene consumare energia in Italia?",
    answer: (
      <>
        Dipende dal giorno e dalla zona. Ogni giornata ha ore più basse (🍌) e
        ore di picco (🐵): sono i prezzi di mercato, non la bolletta. Per una
        data precisa apri l&apos;
        <Link href="/prezzi" className={FAQ_LINK_CLASS}>
          archivio prezzi
        </Link>
        : minimo, medio, massimo e le fasce orarie per Nord, Centro-Nord,
        Centro-Sud, Sud, Calabria, Sicilia e Sardegna.
      </>
    ),
  },
  {
    question: "Dove vedo i prezzi di un giorno preciso?",
    answer: (
      <>
        Nell&apos;
        <Link href="/prezzi" className={FAQ_LINK_CLASS}>
          archivio
        </Link>
        , una pagina per ogni giornata di cui abbiamo i dati. Sulla home
        restano grafico interattivo e tabella ogni quarto d&apos;ora.
      </>
    ),
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
          <div
            key={item.question}
            id={item.id}
            className={item.id ? "scroll-mt-20" : undefined}
          >
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
