import {
  promptUnauthenticated,
  promptRegistering,
  promptLoggingIn,
  promptAuthenticated,
  prompts,
} from "./prompts";

import type { UserState } from "./state-machine";

export function getPromptForState(state: UserState, user: any) {
  // ------------------------------------------------------------
  // LOGGING_OUT y NO_SESSION
  // ------------------------------------------------------------
  if (state === "LOGGING_OUT") {
    return prompts.LOGGING_OUT;
  }

  if (state === "NO_SESSION") {
    return prompts.NO_SESSION;
  }

  // ------------------------------------------------------------
  // Estados existentes tradicionales
  // ------------------------------------------------------------
  switch (state) {
    case "UNAUTHENTICATED":
      return promptUnauthenticated;

    case "REGISTERING":
      return promptRegistering;

    case "LOGGING_IN":
      return promptLoggingIn;

    case "AUTHENTICATED":
      return promptAuthenticated(user);

    default:
      return promptUnauthenticated;
  }
}
