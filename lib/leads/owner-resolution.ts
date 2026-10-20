import { mockUsersStore } from "@/lib/db/mock-store";

/**
 * Resolves the display name for a given lead owner ID.
 * Accurately handles team members (e.g. Sheetal, Alex, Sarah), self assignment,
 * and preserves explicitly assigned names without erroneous fallbacks to session owner.
 */
export function resolveOwnerNameFromStore(
  ownerId: string | null | undefined,
  session?: { id?: string; name?: string; email?: string } | null,
  fallbackName?: string | null
): string | null {
  if (!ownerId || ownerId === "UNASSIGNED") return null;

  const isSelf =
    Boolean(session) &&
    (ownerId === "ME" ||
      ownerId === session?.id ||
      ownerId === "usr_sohel" ||
      ownerId === "platform-owner-sohel" ||
      (session?.email && ownerId.toLowerCase() === session.email.toLowerCase()));

  if (isSelf) {
    return session?.name || "Sohel Jatu";
  }

  // 1. Look up in mockUsersStore
  const found = mockUsersStore.find(
    (u) =>
      u.id === ownerId ||
      u.email.toLowerCase() === ownerId.toLowerCase()
  );
  if (found) {
    return found.name;
  }

  // 2. Known team member IDs
  if (ownerId === "usr_sheetal" || ownerId.toLowerCase().includes("sheetal")) {
    return "Sheetal D";
  }
  if (ownerId === "usr_alex" || ownerId.toLowerCase().includes("alex")) {
    return "Alex Sales";
  }
  if (ownerId === "usr_sarah" || ownerId.toLowerCase().includes("sarah")) {
    return "Sarah Manager";
  }
  if (ownerId === "usr_admin" || ownerId.toLowerCase().includes("admin")) {
    return "Admin User";
  }
  if (ownerId === "usr_auditor") {
    return "Rachel Auditor";
  }

  // 3. Fallback name if provided and valid
  if (fallbackName && fallbackName !== "Assigned User" && fallbackName !== session?.name) {
    return fallbackName;
  }

  return fallbackName || null;
}
