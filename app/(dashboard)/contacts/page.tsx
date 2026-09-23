"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContactTable } from "@/features/contacts/components/contact-table";
import { ContactModal } from "@/features/contacts/components/contact-modal";
import {
  getContactsAction,
  deleteContactAction,
  ContactItem,
  ContactFormData,
} from "@/actions/contacts";

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [contactToEdit, setContactToEdit] = useState<(ContactFormData & { id: string }) | null>(null);
  const [, startTransition] = useTransition();

  const loadContacts = useCallback(
    (page = 1, query = search) => {
      startTransition(async () => {
        const res = await getContactsAction({ page, limit: 10, search: query });
        if (res.success && res.data) {
          setContacts(res.data.items);
          setMeta(res.data.meta);
        }
      });
    },
    [search]
  );

  useEffect(() => {
    loadContacts(1, search);
  }, [loadContacts, search]);

  const handleEdit = (contact: ContactItem) => {
    setContactToEdit({
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      jobTitle: contact.jobTitle || "",
      department: contact.department || "",
      companyId: contact.companyId || "",
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteContactAction(id);
      loadContacts();
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Contacts</h1>
          <p className="text-sm text-slate-500">
            People, champions, and decision-makers across your client accounts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const csvContent =
                "data:text/csv;charset=utf-8,Name,Company,Title,Email,Phone\n" +
                contacts
                  .map((c) => `"${c.fullName}","${c.companyName || ""}","${c.jobTitle || ""}","${c.email || ""}","${c.phone || ""}"`)
                  .join("\n");
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", "contacts.csv");
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
          >
            <Download className="w-4 h-4 mr-1.5 text-slate-500" />
            <span>Export</span>
          </Button>
          <Button
            type="button"
            onClick={() => {
              setContactToEdit(null);
              setIsModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Add Contact</span>
          </Button>
        </div>
      </div>

      {/* Table Component */}
      <ContactTable
        contacts={contacts}
        meta={meta}
        onSearchChange={(q) => setSearch(q)}
        onPageChange={(p) => loadContacts(p)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Contact Modal Dialog */}
      <ContactModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setContactToEdit(null);
        }}
        onSuccess={() => loadContacts()}
        contactToEdit={contactToEdit}
      />
    </div>
  );
}
