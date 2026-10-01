import { Metadata } from "next";
import { InboxView } from "@/features/inbox/components/inbox-view";

export const metadata: Metadata = {
  title: "Inbox | Roxx CRM",
  description: "View synchronized incoming client emails and reply to leads directly.",
};

export default function InboxPage() {
  return <InboxView />;
}
