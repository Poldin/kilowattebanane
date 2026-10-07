import { ChevronDown } from "lucide-react";

const GSE_CER_URL =
  "https://www.gse.it/servizi-per-te/autoconsumo/gruppi-di-autoconsumatori-e-comunita-di-energia-rinnovabile";

const LINK_CLASS =
  "underline decoration-neutral-300 underline-offset-2 transition-colors hover:text-foreground hover:decoration-neutral-500 dark:decoration-neutral-600 dark:hover:decoration-neutral-400";

type CerFaqItem = {
  question: string;
  paragraphs: string[];
  source?: string;
};

const CER_FAQ: CerFaqItem[] = [
  {
    question: "Devo cambiare fornitore?",
    paragraphs: [
      "No. Il POD resta sul contratto che hai già, con il venditore che hai scelto. La comunità non ti vende l’energia: chi entra mantiene il diritto di scegliere il proprio fornitore, e di uscire quando vuole.",
      "Se qualcuno ti propone un nuovo contratto “per attivare la CER”, ti sta vendendo un’altra cosa.",
    ],
  },
  {
    question: "Devo pagare per iscrivermi?",
    paragraphs: [
      "Da questa pagina no. Lasciare il POD e chiedere di aderire è gratis, e non cambia la bolletta.",
      "Una comunità è un’associazione o un ente, e lo statuto può prevedere una quota tra soci, decisa dai membri. Chi ti chiede un bonifico per sbloccare l’incentivo, o di firmare un nuovo fornitore, non sta applicando queste regole. Attenzione alle truffe.",
    ],
  },
  {
    question: "Devo installare i pannelli?",
    paragraphs: [
      "No, se entri come consumatore. Ti basta un POD sotto la stessa cabina primaria di un impianto della comunità. L’incentivo esiste perché qualcun altro produce e tu, nella stessa ora, consumi.",
      "Se hai un impianto, o lo stai facendo, entri come produttore: usi prima la tua energia e condividi quella che immetti in rete.",
    ],
  },
  {
    question: "I soldi arrivano in bolletta?",
    paragraphs: [
      "No. Il GSE paga la comunità, non il tuo venditore. In bolletta continui a pagare il contratto di sempre.",
      "È lo statuto a dire come si spartisce l’incentivo tra chi produce, chi consuma e le spese della comunità. Può arrivarti un accredito o un conguaglio tra soci: dipende da quelle regole, non da una riga nuova sulla bolletta.",
    ],
  },
  {
    question: "Quanto si prende, in concreto?",
    paragraphs: [
      "Solo sull’energia condivisa: i kilowattora prodotti e consumati nella stessa ora, sotto la stessa cabina. Su quei kWh il GSE riconosce una tariffa premio per 20 anni.",
      "Sta in genere tra 6 e 13 centesimi per kWh condiviso. Dipende dalla potenza dell’impianto (il tetto è 1 MW), dalla zona e dal prezzo zonale di quell’ora. Un impianto fino a 200 kW parte da 8 centesimi; il fotovoltaico al Centro e al Nord prende un po’ di più, perché il sole rende meno. In più c’è un contributo più piccolo: la restituzione di alcune componenti di rete sull’energia autoconsumata.",
      "Quei centesimi li incassa la comunità, che li ripartisce. Non sono uno sconto sull’intera bolletta. Per chi non ha pannelli è una quota. Per chi produce è un extra: l’energia immessa si vende comunque, al mercato o al GSE, e resta del produttore.",
      "La domanda va presentata entro il 31 dicembre 2027, oppure entro 30 giorni dal momento in cui gli impianti già ammessi a questa tariffa raggiungono 5 GW, se quel tetto arriva prima. Chi entra in tempo la tiene per 20 anni. Con le regole di oggi, chi arriva dopo non la prende.",
    ],
    source: `Cifre del decreto CACER, come le applica il GSE: ${GSE_CER_URL}`,
  },
  {
    question: "Mi arriva la corrente del vicino?",
    paragraphs: [
      "No. Non c’è un cavo tra le case. Usi la rete di sempre.",
      "Ogni ora il GSE confronta i kWh immessi dagli impianti della comunità e i kWh prelevati dai membri, nella stessa cabina primaria. L’energia condivisa è il numero più piccolo dei due. Di giorno, con il sole, quel numero sale. Di notte, se producono solo i pannelli, torna a zero: il consumo serale non la fa nascere.",
    ],
  },
  {
    question: "A cosa serve il POD?",
    paragraphs: [
      "È il codice della fornitura, quello che inizia con IT e sta in bolletta. Dice al GSE sotto quale cabina primaria sei allacciato.",
      "Solo chi sta sotto la stessa cabina può condividere. Per questo lo chiediamo: per dirti l’area e quali comunità sono aperte lì. Se hai già il codice della cabina, quello che inizia con AC, puoi usare quello.",
    ],
  },
  {
    question: "Posso entrare in più di una CER?",
    paragraphs: [
      "No. Un POD sta in una sola configurazione: non in due comunità, e nemmeno in una comunità e insieme nell’autoconsumo del condominio.",
      "Se hai due forniture diverse, casa e negozio, sono due POD. Ciascuno segue la cabina a cui è collegato.",
    ],
  },
  {
    question: "In condominio devo convincere tutto il palazzo?",
    paragraphs: [
      "No, per entrare in una CER. L’autoconsumo collettivo è un’altra cosa: riguarda lo stesso edificio o condominio, e si fa con un accordo tra chi aderisce.",
      "La comunità energetica copre l’area della cabina primaria, molto più larga di un palazzo. Ci entri con il tuo POD anche se il condominio non delibera nulla. Lo stesso POD non può stare in tutte e due.",
    ],
  },
  {
    question: "Il fotovoltaico che ho già conta?",
    paragraphs: [
      "Per la tariffa premio l’impianto deve essere rinnovabile, di potenza fino a 1 MW, ed entrato in esercizio dopo la costituzione della comunità. E comunque non prima del 16 dicembre 2021. Un tetto acceso prima, di regola, non prende quella tariffa.",
      "Può restare nella comunità: la sua energia conta per il contributo di valorizzazione, e la potenza di questi impianti esistenti non può superare il 30% del totale. Se hai potenziato l’impianto, per l’incentivo vale solo la parte nuova, misurata a parte.",
    ],
  },
  {
    question: "Sono in affitto: posso entrare?",
    paragraphs: [
      "Sì, se il contratto della luce è intestato a te. Conta il titolare del POD, non chi possiede la casa. Se la bolletta è del proprietario, la richiesta la fa lui.",
    ],
  },
  {
    question: "Una grande azienda può entrare?",
    paragraphs: [
      "Una persona, un’associazione, un comune, una scuola o un ente del terzo settore sì. Un’impresa sì se è una PMI, e se partecipare alla comunità non è la sua attività principale.",
      "Le grandi imprese non possono essere socie. Possono, in certi casi, dare mandato perché l’energia del loro impianto conti nella condivisione, senza entrare come soci: la vendita di quell’energia resta loro.",
    ],
  },
  {
    question: "E se nella mia zona non c’è nessuna CER?",
    paragraphs: [
      "Puoi lo stesso lasciare il POD. Registriamo la richiesta e ti scriviamo se nella tua cabina si apre una comunità a nuove adesioni. Nel frattempo non ti cambiamo fornitore e non ti chiediamo nulla.",
    ],
  },
];

function answerText(item: CerFaqItem) {
  return [...item.paragraphs, item.source].filter(Boolean).join(" ");
}

export function CerFaq() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: CER_FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answerText(item),
      },
    })),
  };

  return (
    <section className="mt-14 max-w-xl sm:mt-16" aria-labelledby="cer-faq-heading">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />
      <h2 id="cer-faq-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
        Domande frequenti
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Quello che conviene sapere prima di lasciare il POD.
      </p>
      <div className="mt-6 border-t border-neutral-200 dark:border-neutral-800">
        {CER_FAQ.map((item) => (
          <details key={item.question} className="group border-b border-neutral-200 dark:border-neutral-800">
            <summary className="flex cursor-pointer list-none items-start gap-3 py-3.5 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500 [&::-webkit-details-marker]:hidden">
              <span className="min-w-0 flex-1 text-base font-medium leading-snug tracking-tight">
                {item.question}
              </span>
              <ChevronDown
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none dark:text-neutral-500"
                strokeWidth={1.75}
              />
            </summary>
            <div className="space-y-2 pb-4 pr-7 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              {item.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {item.source ? (
                <p>
                  Cifre del decreto CACER, come le applica il{" "}
                  <a href={GSE_CER_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                    GSE
                  </a>
                  .
                </p>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
