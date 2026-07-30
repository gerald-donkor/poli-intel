import { handlers } from "@/auth";

// Thin by design: this Route Handler exists for the external OAuth caller and
// carries no business logic (AGENTS.md §5.3).
export const { GET, POST } = handlers;
