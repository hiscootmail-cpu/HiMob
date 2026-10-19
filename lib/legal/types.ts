export type LegalSection = { title: string; paragraphs: string[] };

export type LegalDocument = {
  title: string;
  /** Data da versão (ou "Rascunho de ..."). */
  updated: string;
  intro: string[];
  sections: LegalSection[];
};
