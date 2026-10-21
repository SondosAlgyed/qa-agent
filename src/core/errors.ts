// An error we expected, with a message the user can act on.
// The CLI prints it as one line; any other error is a bug and keeps its stack trace.
export class QaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QaError";
  }
}
