// Aktiváló ügynök: a levelek kérdései és válaszkategóriái. Kliensen is használható (nincs benne titok).
// Az ügynök (twinx-agents, src/activation/questions.ts) ugyanezeket a kulcsokat írja a linkekbe: új kérdésnél mindkét helyen bővíteni kell.
export const ACTIVATION_MIGRATION = "20261105120000_activation-agent.sql";

export const FEEDBACK_QUESTIONS: Record<string, { question: string; options: Record<string, string> }> = {
  what_held_back: {
    question: "Mi tartott vissza attól, hogy újra használd?",
    options: {
      not_good_enough: "Nem lett elég jó",
      no_need_now: "Most nincs rá szükségem",
      unclear: "Nem volt egyértelmű",
      other: "Más ok",
    },
  },
  can_we_help: {
    question: "Mi kellene ahhoz, hogy kipróbáld?",
    options: {
      no_time: "Most nincs rá időm",
      not_sure_useful: "Nem tudom, mire jó nekem",
      need_help: "Segítség kellene az első lépéshez",
      other: "Más ok",
    },
  },
};

export function feedbackLabels(questionId: string, category: string): { question: string; answer: string } {
  const q = FEEDBACK_QUESTIONS[questionId];
  return { question: q?.question ?? questionId, answer: q?.options[category] ?? category };
}

/** Az állapotok felhasználóbarát neve az admin listához. */
export const ACTIVATION_STATE_LABEL: Record<string, string> = {
  unconfirmed: "Nem erősített",
  not_started: "Nem kezdte el",
  tried_once: "Egyszer próbálta",
  waiting: "Friss használó",
  returning: "Visszatérő",
  low_credit: "Fogyó kredit",
  buyer: "Vásárló",
  dormant: "Alvó",
};
