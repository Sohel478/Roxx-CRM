export interface MockCompany {
  id: string;
  organizationId: string;
  name: string;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  address?: string | null;
  city: string | null;
  state?: string | null;
  country: string | null;
  postalCode?: string | null;
  status: string;
  createdAt: string;
  contactCount: number;
  description?: string | null;
}

export interface MockContact {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  alternatePhone?: string | null;
  jobTitle: string | null;
  department: string | null;
  linkedinUrl?: string | null;
  companyId: string | null;
  companyName: string | null;
  address?: string | null;
  createdAt: string;
}

export interface MockOpportunity {
  id: string;
  organizationId: string;
  name: string;
  amount: number;
  currency: string;
  companyId: string;
  companyName?: string | null;
  primaryContactId?: string | null;
  primaryContactName?: string | null;
  leadId?: string | null;
  pipelineId: string;
  stageId: string;
  stageName: string;
  ownerId: string;
  ownerName: string;
  status: string; // OPEN, WON, LOST
  expectedCloseDate?: string | null;
  createdAt: string;
}

export interface MockLead {
  id: string;
  organizationId: string;
  leadNumber: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  jobTitle: string | null;
  source: string;
  sourceDetail?: string | null;
  status: string;
  rating: string;
  estimatedValue: number;
  currency: string;
  ownerName: string | null;
  createdAt: string;
  description?: string | null;
  convertedAt?: string | null;
  convertedCompanyId?: string | null;
  convertedContactId?: string | null;
  convertedOpportunityId?: string | null;
  convertedInfo?: {
    companyId?: string | null;
    companyName?: string | null;
    contactId?: string | null;
    contactName?: string | null;
    opportunityId?: string | null;
    opportunityName?: string | null;
    opportunityAmount?: number | null;
  } | null;
}

// Global in-memory storage arrays shared across server action modules
export const mockCompaniesStore: MockCompany[] = [
  {
    id: "comp_1",
    organizationId: "demo-org-123",
    name: "Acme Technologies",
    industry: "Enterprise Software",
    website: "https://acme-tech.local",
    email: "contact@acme-tech.local",
    phone: "+1 (555) 234-5678",
    city: "San Francisco",
    country: "USA",
    status: "Customer",
    createdAt: new Date().toISOString(),
    contactCount: 2,
    description: "Leading cloud computing and DevOps enterprise customer.",
  },
  {
    id: "comp_2",
    organizationId: "demo-org-123",
    name: "Apex Global Logistics",
    industry: "Supply Chain",
    website: "https://apex-logistics.local",
    email: "info@apex-logistics.local",
    phone: "+1 (555) 876-5432",
    city: "Chicago",
    country: "USA",
    status: "Prospect",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    contactCount: 1,
    description: "Multi-national shipping and freight forwarder looking for CRM integration.",
  },
  {
    id: "comp_3",
    organizationId: "demo-org-123",
    name: "Starlight Media",
    industry: "Digital Marketing",
    website: "https://starlight.local",
    email: "hello@starlight.local",
    phone: "+44 20 7946 0912",
    city: "London",
    country: "UK",
    status: "Active",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    contactCount: 1,
    description: "Creative design and video marketing studio.",
  },
];

export const mockContactsStore: MockContact[] = [
  {
    id: "cont_1",
    organizationId: "demo-org-123",
    firstName: "Sarah",
    lastName: "Connor",
    fullName: "Sarah Connor",
    email: "s.connor@acme-tech.local",
    phone: "+1 (555) 019-2831",
    jobTitle: "VP of Engineering",
    department: "Engineering",
    companyId: "comp_1",
    companyName: "Acme Technologies",
    createdAt: new Date().toISOString(),
  },
  {
    id: "cont_2",
    organizationId: "demo-org-123",
    firstName: "Michael",
    lastName: "Chang",
    fullName: "Michael Chang",
    email: "m.chang@acme-tech.local",
    phone: "+1 (555) 019-2832",
    jobTitle: "Head of Procurement",
    department: "Operations",
    companyId: "comp_1",
    companyName: "Acme Technologies",
    createdAt: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: "cont_3",
    organizationId: "demo-org-123",
    firstName: "David",
    lastName: "Miller",
    fullName: "David Miller",
    email: "dmiller@apex-logistics.local",
    phone: "+1 (555) 732-9104",
    jobTitle: "Chief Operations Officer",
    department: "Executive",
    companyId: "comp_2",
    companyName: "Apex Global Logistics",
    createdAt: new Date(Date.now() - 129600000).toISOString(),
  },
];

export const mockLeadsStore: MockLead[] = [
  {
    id: "lead_1",
    organizationId: "demo-org-123",
    leadNumber: "LEAD-1001",
    firstName: "Elena",
    lastName: "Rostova",
    fullName: "Elena Rostova",
    email: "elena.rostova@cyberdynesys.local",
    phone: "+1 (555) 492-8172",
    companyName: "Cyberdyne Systems",
    jobTitle: "Director of IT Operations",
    source: "Website",
    status: "New",
    rating: "Hot",
    estimatedValue: 45000,
    currency: "USD",
    ownerName: "Alex Sales",
    createdAt: new Date().toISOString(),
    description: "Inquired about enterprise CRM with 50+ sales seats. Immediate evaluation required.",
  },
  {
    id: "lead_2",
    organizationId: "demo-org-123",
    leadNumber: "LEAD-1002",
    firstName: "Marcus",
    lastName: "Vance",
    fullName: "Marcus Vance",
    email: "mvance@vanguardsec.local",
    phone: "+1 (555) 381-9021",
    companyName: "Vanguard Security",
    jobTitle: "VP Sales & Partnerships",
    source: "LinkedIn",
    status: "Contacted",
    rating: "Warm",
    estimatedValue: 28000,
    currency: "USD",
    ownerName: "Sarah Manager",
    createdAt: new Date(Date.now() - 36000000).toISOString(),
    description: "Introductory phone call completed. Budget approved for Q4.",
  },
  {
    id: "lead_3",
    organizationId: "demo-org-123",
    leadNumber: "LEAD-1003",
    firstName: "Sofia",
    lastName: "Castillo",
    fullName: "Sofia Castillo",
    email: "sofia@solardynamics.local",
    phone: "+1 (555) 923-1184",
    companyName: "Solar Dynamics",
    jobTitle: "Procurement Manager",
    source: "Referral",
    status: "Qualified",
    rating: "Hot",
    estimatedValue: 65000,
    currency: "USD",
    ownerName: "Alex Sales",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    description: "Met technical criteria and budget. Ready for proposal & opportunity creation.",
  },
  {
    id: "lead_4",
    organizationId: "demo-org-123",
    leadNumber: "LEAD-1004",
    firstName: "Liam",
    lastName: "O'Connor",
    fullName: "Liam O'Connor",
    email: "liam@horizonenergy.local",
    phone: "+1 (555) 120-9482",
    companyName: "Horizon Energy",
    jobTitle: "Operations Analyst",
    source: "Google",
    status: "Nurture",
    rating: "Cold",
    estimatedValue: 15000,
    currency: "USD",
    ownerName: "Admin User",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    description: "Revisit in 6 months when their new regional branch opens.",
  },
];

export const mockOpportunitiesStore: MockOpportunity[] = [];
