export type LearnChoice = {
  id: string;
  label: string;
};

export type LearnChoiceQuestion = {
  kind: "choice";
  id: string;
  prompt: string;
  options: LearnChoice[];
  correctId: string;
  explanation: string;
};

export type LearnHourQuestion = {
  kind: "hour";
  id: string;
  prompt: string;
  hint: string;
  prices: number[];
  cheapHours: number[];
  explanation: string;
};

export type LearnQuestion = LearnChoiceQuestion | LearnHourQuestion;

export type LearnChapter = {
  id: string;
  title: string;
  blurb: string;
  takeaway: string;
  coverUrl: string;
  questions: LearnQuestion[];
};

export const LEARN_CHAPTERS: LearnChapter[] = [
  {
    id: "ingrosso",
    title: "Il grafico non è la bolletta",
    blurb: "Cosa misura il giallo della home, e quando ti riguarda.",
    coverUrl: "/learn/covers/ingrosso.svg",
    takeaway:
      "Il grafico è l'ingrosso, non la bolletta. Con un fisso le oscillazioni non ti toccano; con variabile o fasce sì.",
    questions: [
      {
        kind: "choice",
        id: "bolletta",
        prompt:
          "Il grafico giallo della home: è il prezzo che paghi in bolletta?",
        options: [
          { id: "bill", label: "Sì, è la bolletta ora per ora" },
          {
            id: "wholesale",
            label: "No, è il prezzo all'ingrosso del mercato",
          },
          {
            id: "pun",
            label: "È la media di quello che pagano tutti in Italia",
          },
        ],
        correctId: "wholesale",
        explanation:
          "È il day-ahead all'ingrosso, in c€/kWh: quanto costa l'energia sul mercato, ora per ora. In bolletta ci sono anche rete, oneri e tasse. E il tuo contratto decide se quel movimento ti tocca.",
      },
      {
        kind: "choice",
        id: "fisso",
        prompt:
          "Hai un prezzo fisso per 12 mesi. Ti serve il grafico per risparmiare?",
        options: [
          { id: "yes", label: "Sì: sposto i consumi e pago meno" },
          { id: "no", label: "No: il kWh resta uguale tutto il giorno" },
          { id: "sunday", label: "Solo la domenica" },
        ],
        correctId: "no",
        explanation:
          "Con il fisso le oscillazioni del mercato non ti riguardano. Con un variabile, indicizzato o a fasce (F1/F2/F3, bioraria), sì: lì sapere quando consumare può fare la differenza.",
      },
    ],
  },
  {
    id: "orari",
    title: "Quando conviene consumare",
    blurb: "Una giornata tipo: tu scegli quando fare la lavatrice.",
    coverUrl: "/learn/covers/orari.svg",
    takeaway:
      "🍌 a metà giornata, 🐵 in serata. Spostare un carico conviene se il contratto segue il mercato.",
    questions: [
      {
        kind: "hour",
        id: "lavatrice",
        prompt: "Domani hai una giornata così. Quando fai la lavatrice?",
        hint: "Tocca un'ora sul grafico",
        prices: [
          18, 16, 15, 14, 14, 15, 17, 20, 22, 18, 14, 11, 9, 8, 9, 12, 16, 22,
          31, 28, 24, 21, 19, 18,
        ],
        cheapHours: [12, 13, 14],
        explanation:
          "🍌 a metà giornata, 🐵 in serata: è il classico giorno con il sole a pranzo e il picco quando tutti cucinano. Spostare un carico conviene se il contratto è variabile o a fasce. Con un fisso, il kWh non si muove.",
      },
    ],
  },
  {
    id: "zone",
    title: "Zone e prezzi di domani",
    blurb: "Perché la regione conta, e come facciamo a sapere già oggi.",
    coverUrl: "/learn/covers/zone.svg",
    takeaway:
      "Sette zone, prezzi diversi. Il mercato del giorno dopo chiude a mezzogiorno: i prezzi di domani escono nel pomeriggio.",
    questions: [
      {
        kind: "choice",
        id: "regione",
        prompt: "Perché vi chiediamo la regione?",
        options: [
          { id: "ads", label: "Per mandarvi la pubblicità giusta" },
          {
            id: "zone",
            label: "Perché in Italia i prezzi possono cambiare da zona a zona",
          },
          { id: "comune", label: "Perché ogni comune ha il suo PUN" },
        ],
        correctId: "zone",
        explanation:
          "Sette zone di mercato. Nord, Sicilia o Sardegna nello stesso quarto d'ora possono avere prezzi diversi. La regione serve a mostrarti dove consumi tu, non la media Italia.",
      },
      {
        kind: "choice",
        id: "domani",
        prompt:
          "Come facciamo a sapere già oggi quanto costerà l'energia di domani?",
        options: [
          { id: "ai", label: "Lo stimiamo con un modello" },
          {
            id: "dayahead",
            label:
              "Il mercato del giorno dopo chiude a mezzogiorno, i prezzi escono nel pomeriggio",
          },
          { id: "terna", label: "Lo comunica Terna la sera prima" },
        ],
        correctId: "dayahead",
        explanation:
          "Si chiama day-ahead. Gli operatori comprano e vendono l'energia di domani: il mercato chiude a mezzogiorno, i prezzi si pubblicano nel pomeriggio. A quel punto li tiriamo su, partono le mail, e sulla home il grafico può passare a domani.",
      },
    ],
  },
];

export function chapterById(id: string) {
  return LEARN_CHAPTERS.find((chapter) => chapter.id === id);
}

export function nextChapter(id: string) {
  const index = LEARN_CHAPTERS.findIndex((chapter) => chapter.id === id);
  if (index < 0) return undefined;
  return LEARN_CHAPTERS[index + 1];
}

export function learnChapterPath(id: string) {
  return `/learn/${id}`;
}
