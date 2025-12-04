import { coreRules, toolRules, memoryPrompt, authPrompt, casualPrompt } from "./prompts-module";
import { getPromptForState } from "./getPromt";

export function buildSystemPrompt(state: any, domain: string, user: any) {
  const baseStatePrompt = getPromptForState(state, user);

  const stack = [
    coreRules,
    toolRules,
    baseStatePrompt, // ← MANTENEMOS la máquina de estado
  ];

  switch (domain) {
    case "memory":
      stack.push(memoryPrompt);
      break;

    case "authentication":
      stack.push(authPrompt);
      break;

    default:
      stack.push(casualPrompt);
  }

  return stack.join("\n\n");
}
