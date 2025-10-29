export interface PromptTemplate {
  id: string;
  description: string;
  system: string;
  user: string;
}

export interface PromptPack {
  version: string;
  aiSummary: PromptTemplate;
  insights: PromptTemplate;
  writer: PromptTemplate;
  flashcards: PromptTemplate;
  quiz: PromptTemplate;
  chatbot: PromptTemplate;
}
