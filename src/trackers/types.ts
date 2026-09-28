export interface Story {
  key: string;
  summary: string;
  description: string;
  status: string;
}

export interface TicketSystem {
  getStory(key: string): Promise<Story>;
  addComment(key: string, text: string): Promise<void>;
}