import { raisedEuro } from "@/lib/crowd/rank";
import type { CrowdCampaign } from "@/lib/crowd/types";

const CAMPAIGNS: CrowdCampaign[] = [
  {
    slug: "tetto-pascoli-modena",
    title: "Tetto solare della scuola Pascoli",
    place: "Modena",
    technology: "fotovoltaico",
    kwp: 48,
    goalEuro: 54000,
    kwhYear: 60000,
    closesOn: "2026-11-09",
    summary: "Pannelli sul tetto della scuola media. Di giorno coprono aule e palestra.",
    story:
      "Quarantotto kilowatt sul tetto della scuola media Pascoli. Di giorno l’impianto copre aule e palestra. Quello che avanza entra in rete.",
    donors: [
      {
        id: "beretta",
        name: "Panificio Beretta",
        subtitle: "Forno di quartiere · corso Canalchiaro",
        amountEuro: 6400,
      },
      {
        id: "giulia",
        name: "Giulia Monti",
        subtitle: "Mamma di due alunni · classe 2B",
        amountEuro: 2100,
      },
      {
        id: "neri",
        name: "Studio Neri",
        subtitle: "Commercialisti · sponsor dell’impianto",
        amountEuro: 1800,
      },
      {
        id: "marco",
        name: "Marco Rinaldi",
        subtitle: "Insegnante di scienze · Pascoli",
        amountEuro: 950,
      },
      {
        id: "anna",
        name: "Anna e Luca",
        subtitle: "Famiglia del quartiere Buon Pastore",
        amountEuro: 700,
      },
      {
        id: "sole",
        name: "Cooperativa Sole",
        subtitle: "Gruppo d’acquisto cittadino",
        amountEuro: 500,
      },
      {
        id: "davide",
        name: "Davide P.",
        subtitle: "Ex alunno · ora all’università",
        amountEuro: 280,
      },
      {
        id: "elena",
        name: "Elena Vighi",
        subtitle: "Nonna di Sofia · prima donazione",
        amountEuro: 140,
      },
    ],
  },
  {
    slug: "pensilina-mercato-bari",
    title: "Pensilina del mercato di Bari",
    place: "Bari",
    technology: "fotovoltaico",
    kwp: 32,
    goalEuro: 38000,
    kwhYear: 44800,
    closesOn: "2026-11-30",
    summary: "Ombra sui banchi e corrente per celle e luci della sera.",
    story:
      "Una pensilina fotovoltaica sopra i banchi del mercato. Fa ombra a chi vende e alimenta celle e illuminazione serale.",
    donors: [
      {
        id: "porto",
        name: "Officine del Porto",
        subtitle: "Officina meccanica · lungomare",
        amountEuro: 5200,
      },
      {
        id: "conte",
        name: "Famiglia Conte",
        subtitle: "Banco pesce · mercato coperto",
        amountEuro: 4800,
      },
      {
        id: "bar",
        name: "Bar Centrale",
        subtitle: "Caffè degli operatori del mercato",
        amountEuro: 3100,
      },
      {
        id: "luca",
        name: "Luca Sannino",
        subtitle: "Commerciante ortofrutta",
        amountEuro: 1900,
      },
      {
        id: "madonnella",
        name: "Quartiere Madonnella",
        subtitle: "Raccolta di vicinato",
        amountEuro: 1200,
      },
      {
        id: "chiara",
        name: "Chiara De Santis",
        subtitle: "Cliente abituale · sabato mattina",
        amountEuro: 700,
      },
    ],
  },
  {
    slug: "agrivoltaico-fontana",
    title: "Agrivoltaico Cascina Fontana",
    place: "Cuneo",
    technology: "fotovoltaico",
    kwp: 90,
    goalEuro: 110000,
    kwhYear: 108000,
    closesOn: "2026-12-18",
    summary: "Novanta kilowatt tra i filari, alti abbastanza per il trattore.",
    story:
      "Filari di pannelli alti abbastanza da lasciare passare il trattore. Novanta kilowatt tra le colture della cascina.",
    donors: [
      {
        id: "fontana",
        name: "Cascina Fontana",
        subtitle: "Azienda agricola · filari e vigneto",
        amountEuro: 24000,
      },
      {
        id: "frantoio",
        name: "Frantoio Reale",
        subtitle: "Oleificio del paese",
        amountEuro: 11000,
      },
      {
        id: "marta",
        name: "Marta Bianco",
        subtitle: "Agronomo · consulenza sul campo",
        amountEuro: 3200,
      },
      {
        id: "langhe",
        name: "Gruppo d’acquisto Langhe",
        subtitle: "47 famiglie del territorio",
        amountEuro: 1800,
      },
      {
        id: "paolo",
        name: "Paolo Greco",
        subtitle: "Mezzadro · Cascina Fontana",
        amountEuro: 800,
      },
      {
        id: "osteria",
        name: "Osteria del Ponte",
        subtitle: "Ristorante · menù km zero",
        amountEuro: 600,
      },
    ],
  },
];

export function campaignPath(slug: string) {
  return `/campagne/${slug}`;
}

export function listCampaigns() {
  return [...CAMPAIGNS].sort((a, b) => a.closesOn.localeCompare(b.closesOn));
}

export function getCampaign(slug: string) {
  return CAMPAIGNS.find((campaign) => campaign.slug === slug) ?? null;
}

export function campaignRaised(campaign: CrowdCampaign) {
  return raisedEuro(campaign.donors);
}
