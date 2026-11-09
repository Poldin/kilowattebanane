"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

type FaqItem = {
  question: string;
  paragraphs: string[];
};

const FAQ: FaqItem[] = [
  {
    question: "Cosa succede quando mi iscrivo?",
    paragraphs: [
      "Lasci la bolletta o il POD. Capita a quale comunità puoi entrare, e i benefici della tua partecipazione vanno a chi stai sostenendo. Un contatto alla fine, per confermare.",
    ],
  },
  {
    question: "Devo pagare per iscrivermi?",
    paragraphs: [
      "No. L’iscrizione è gratuita. Non ti chiediamo un bonifico e non ti vendiamo un contratto luce. Se qualcuno lo fa a nome della comunità, non è questo percorso.",
    ],
  },
  {
    question: "Devo cambiare fornitore?",
    paragraphs: [
      "No. Restano il tuo venditore e la bolletta di sempre. La comunità non ti vende l’energia: condivide un incentivo sull’energia già in rete, nella stessa cabina primaria.",
    ],
  },
  {
    question: "Devo installare i pannelli?",
    paragraphs: [
      "No, se entri come consumatore. Ti basta un POD sotto la stessa cabina di un impianto della comunità. Se hai già un impianto, o lo stai facendo, puoi entrare anche come produttore.",
    ],
  },
  {
    question: "Come arriva il sostegno?",
    paragraphs: [
      "Il GSE paga la comunità, non il tuo venditore. La comunità ripartisce l’incentivo. In questa campagna la tua quota di benefici è destinata a chi stai sostenendo.",
    ],
  },
  {
    question: "Posso uscire quando voglio?",
    paragraphs: [
      "Sì. Puoi lasciare la comunità. Il sostegno vale per il periodo in cui partecipi, senza vincoli extra.",
    ],
  },
  {
    question: "Chi può iscriversi?",
    paragraphs: [
      "Privati, PMI, associazioni ed enti, se il POD è nella cabina della comunità. Se sei in affitto, sì: conta chi ha intestata la luce, non chi possiede la casa.",
    ],
  },
  {
    question: "Cosa fate con la bolletta?",
    paragraphs: [
      "Cerchiamo il POD, quello che inizia con IT. Serve a capire a quale comunità puoi entrare. In questo tentativo il file resta sul tuo dispositivo: non lo carichiamo sul server.",
    ],
  },
];

const PANEL_EASE = "duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

export function CerBeneficiaryFaq() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.paragraphs.join(" "),
      },
    })),
  };

  return (
    <section className="mt-14 w-full sm:mt-16" aria-labelledby="cer-iscriviti-faq-heading">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />
      <h2
        id="cer-iscriviti-faq-heading"
        className="text-3xl font-bold tracking-tight sm:text-4xl"
      >
        Domande frequenti
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        Prima di iscriverti, le risposte più chieste.
      </p>
      <div className="mt-6 border-t border-neutral-200 dark:border-neutral-800">
        {FAQ.map((item) => (
          <FaqRow key={item.question} item={item} />
        ))}
      </div>
    </section>
  );
}

function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonId = useId();

  return (
    <div className="border-b border-neutral-200 dark:border-neutral-800">
      <button
        type="button"
        id={buttonId}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full cursor-pointer items-start gap-3 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:focus-visible:ring-neutral-500"
      >
        <span className="min-w-0 flex-1 text-base font-medium leading-snug tracking-tight">
          {item.question}
        </span>
        <ChevronDown
          aria-hidden
          className={`mt-0.5 h-4 w-4 shrink-0 text-neutral-400 transition-transform ${PANEL_EASE} dark:text-neutral-500 ${open ? "rotate-180" : ""}`}
          strokeWidth={1.75}
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        className={`grid transition-[grid-template-rows] ${PANEL_EASE} ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`space-y-2 pb-4 pr-7 text-sm leading-relaxed text-neutral-600 transition-opacity ${PANEL_EASE} dark:text-neutral-400 ${open ? "opacity-100" : "opacity-0"}`}
          >
            {item.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
