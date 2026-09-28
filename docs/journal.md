# Learning Journal

## Week 1
- Set up Node, Playwright, Jira Cloud with 10 user stories (5 clear, 5 deliberately vague)
- Wrote tsconfig.json and understood each option
- Built a Jira client: generic request function, getStory, addComment
- Hard part: a 404 that was really an auth problem — Jira hides issues from
  unauthenticated users instead of returning 401
- Decision: pivoted to an open-source, project-agnostic tool with adapters