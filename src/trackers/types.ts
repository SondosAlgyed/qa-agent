export interface Story {
  id: string; // the tracker's internal ID; some tools link by ID, not by key
  key: string;
  summary: string;
  description: string;
  status: string;
}

export interface TicketSystem {
  getStory(key: string): Promise<Story>;
  addComment(key: string, text: string): Promise<void>;
}