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
  companyName: string;
  primaryContactId: string | null;
  primaryContactName: string | null;
  leadId: string | null;
  pipelineId: string;
  stageId: string;
  stageName: string;
  probability: number;
  ownerId: string;
  ownerName: string;
  status: "OPEN" | "WON" | "LOST";
  lossReason: string | null;
  description: string | null;
  expectedCloseDate: string | null;
  closedAt: string | null;
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

export interface MockTask {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  assignedToId: string;
  assignedToName: string;
  createdById: string;
  createdByName: string;
  leadId: string | null;
  leadName: string | null;
  companyId: string | null;
  companyName: string | null;
  contactId: string | null;
  contactName: string | null;
  opportunityId: string | null;
  opportunityName: string | null;
  dueAt: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  completedAt: string | null;
  createdAt: string;
}

export interface MockActivity {
  id: string;
  organizationId: string;
  type: "CALL" | "EMAIL" | "MEETING" | "WHATSAPP" | "NOTE" | "OTHER";
  subject: string;
  description: string | null;
  leadId: string | null;
  leadName: string | null;
  companyId: string | null;
  companyName: string | null;
  contactId: string | null;
  contactName: string | null;
  opportunityId: string | null;
  opportunityName: string | null;
  userId: string;
  userName: string;
  activityAt: string;
  durationMinutes: number | null;
  outcome: string | null;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// Global in-memory storage arrays shared across server action modules
// ----------------------------------------------------------------------------

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

export const mockOpportunitiesStore: MockOpportunity[] = [
  {
    id: "opp_1",
    organizationId: "demo-org-123",
    name: "Acme - Cloud Migration Project",
    amount: 85000,
    currency: "USD",
    companyId: "comp_1",
    companyName: "Acme Technologies",
    primaryContactId: "cont_1",
    primaryContactName: "Sarah Connor",
    leadId: null,
    pipelineId: "pipe_default",
    stageId: "stage_proposal",
    stageName: "Proposal",
    probability: 60,
    ownerId: "usr_alex",
    ownerName: "Alex Sales",
    status: "OPEN",
    lossReason: null,
    description: "Migrating on-prem database workloads to AWS & Neon with 50 engineer seats.",
    expectedCloseDate: new Date(Date.now() + 2592000000).toISOString().split("T")[0],
    closedAt: null,
    createdAt: new Date(Date.now() - 432000000).toISOString(),
  },
  {
    id: "opp_2",
    organizationId: "demo-org-123",
    name: "Apex Global - Fleet Tracking Integration",
    amount: 45000,
    currency: "USD",
    companyId: "comp_2",
    companyName: "Apex Global Logistics",
    primaryContactId: "cont_3",
    primaryContactName: "David Miller",
    leadId: null,
    pipelineId: "pipe_default",
    stageId: "stage_discovery",
    stageName: "Discovery",
    probability: 40,
    ownerId: "usr_alex",
    ownerName: "Alex Sales",
    status: "OPEN",
    lossReason: null,
    description: "Telemetry and driver log integration into CRM pipeline.",
    expectedCloseDate: new Date(Date.now() + 3888000000).toISOString().split("T")[0],
    closedAt: null,
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: "opp_3",
    organizationId: "demo-org-123",
    name: "Starlight - Brand Campaign CRM Suite",
    amount: 24000,
    currency: "USD",
    companyId: "comp_3",
    companyName: "Starlight Media",
    primaryContactId: null,
    primaryContactName: null,
    leadId: null,
    pipelineId: "pipe_default",
    stageId: "stage_qualified",
    stageName: "Qualified",
    probability: 25,
    ownerId: "usr_sarah",
    ownerName: "Sarah Manager",
    status: "OPEN",
    lossReason: null,
    description: "Marketing lead capture and campaign automation package.",
    expectedCloseDate: new Date(Date.now() + 5184000000).toISOString().split("T")[0],
    closedAt: null,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "opp_4",
    organizationId: "demo-org-123",
    name: "Solar Dynamics - Grid Infrastructure Deal",
    amount: 65000,
    currency: "USD",
    companyId: "comp_1",
    companyName: "Solar Dynamics",
    primaryContactId: null,
    primaryContactName: "Sofia Castillo",
    leadId: "lead_3",
    pipelineId: "pipe_default",
    stageId: "stage_negotiation",
    stageName: "Negotiation",
    probability: 80,
    ownerId: "usr_alex",
    ownerName: "Alex Sales",
    status: "OPEN",
    lossReason: null,
    description: "Derived from qualified lead. Terms reviewed by procurement.",
    expectedCloseDate: new Date(Date.now() + 1296000000).toISOString().split("T")[0],
    closedAt: null,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "opp_5",
    organizationId: "demo-org-123",
    name: "Acme - SOC 2 Compliance Package",
    amount: 110000,
    currency: "USD",
    companyId: "comp_1",
    companyName: "Acme Technologies",
    primaryContactId: "cont_2",
    primaryContactName: "Michael Chang",
    leadId: null,
    pipelineId: "pipe_default",
    stageId: "stage_won",
    stageName: "Won",
    probability: 100,
    ownerId: "usr_alex",
    ownerName: "Alex Sales",
    status: "WON",
    lossReason: null,
    description: "Signed multi-year enterprise license.",
    expectedCloseDate: new Date().toISOString().split("T")[0],
    closedAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 864000000).toISOString(),
  },
  {
    id: "opp_6",
    organizationId: "demo-org-123",
    name: "Nexus Supply - Global ERP Connector",
    amount: 32000,
    currency: "USD",
    companyId: "comp_2",
    companyName: "Apex Global Logistics",
    primaryContactId: "cont_3",
    primaryContactName: "David Miller",
    leadId: null,
    pipelineId: "pipe_default",
    stageId: "stage_lost",
    stageName: "Lost",
    probability: 0,
    ownerId: "usr_sarah",
    ownerName: "Sarah Manager",
    status: "LOST",
    lossReason: "Pricing / Budget Constraints",
    description: "Client decided to delay deployment until next fiscal year.",
    expectedCloseDate: new Date(Date.now() - 172800000).toISOString().split("T")[0],
    closedAt: new Date(Date.now() - 172800000).toISOString(),
    createdAt: new Date(Date.now() - 1209600000).toISOString(),
  },
];

export const mockTasksStore: MockTask[] = [
  {
    id: "task_1",
    organizationId: "demo-org-123",
    title: "Send revised cloud proposal to Sarah Connor",
    description: "Include Neon PostgreSQL serverless pooling pricing and SLA tier.",
    assignedToId: "usr_alex",
    assignedToName: "Alex Sales",
    createdById: "usr_alex",
    createdByName: "Alex Sales",
    leadId: null,
    leadName: null,
    companyId: "comp_1",
    companyName: "Acme Technologies",
    contactId: "cont_1",
    contactName: "Sarah Connor",
    opportunityId: "opp_1",
    opportunityName: "Acme - Cloud Migration Project",
    dueAt: new Date().toISOString().split("T")[0], // Due today
    priority: "HIGH",
    status: "PENDING",
    completedAt: null,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "task_2",
    organizationId: "demo-org-123",
    title: "Follow up with Sofia Castillo on grid terms",
    description: "Check if legal review has cleared the indemnification clause.",
    assignedToId: "usr_alex",
    assignedToName: "Alex Sales",
    createdById: "usr_alex",
    createdByName: "Alex Sales",
    leadId: "lead_3",
    leadName: "Sofia Castillo",
    companyId: "comp_1",
    companyName: "Solar Dynamics",
    contactId: null,
    contactName: "Sofia Castillo",
    opportunityId: "opp_4",
    opportunityName: "Solar Dynamics - Grid Infrastructure Deal",
    dueAt: new Date(Date.now() + 86400000).toISOString().split("T")[0], // Due tomorrow
    priority: "URGENT",
    status: "PENDING",
    completedAt: null,
    createdAt: new Date(Date.now() - 36000000).toISOString(),
  },
  {
    id: "task_3",
    organizationId: "demo-org-123",
    title: "Review Q4 fleet tracking specs with logistics team",
    description: "Align with engineering team on webhook payload format.",
    assignedToId: "usr_sarah",
    assignedToName: "Sarah Manager",
    createdById: "usr_sarah",
    createdByName: "Sarah Manager",
    leadId: null,
    leadName: null,
    companyId: "comp_2",
    companyName: "Apex Global Logistics",
    contactId: "cont_3",
    contactName: "David Miller",
    opportunityId: "opp_2",
    opportunityName: "Apex Global - Fleet Tracking Integration",
    dueAt: new Date(Date.now() - 172800000).toISOString().split("T")[0], // Overdue by 2 days
    priority: "MEDIUM",
    status: "PENDING",
    completedAt: null,
    createdAt: new Date(Date.now() - 345600000).toISOString(),
  },
  {
    id: "task_4",
    organizationId: "demo-org-123",
    title: "Onboard Michael Chang to enterprise procurement portal",
    description: "Credentials generated and verified.",
    assignedToId: "usr_alex",
    assignedToName: "Alex Sales",
    createdById: "usr_alex",
    createdByName: "Alex Sales",
    leadId: null,
    leadName: null,
    companyId: "comp_1",
    companyName: "Acme Technologies",
    contactId: "cont_2",
    contactName: "Michael Chang",
    opportunityId: "opp_5",
    opportunityName: "Acme - SOC 2 Compliance Package",
    dueAt: new Date(Date.now() - 86400000).toISOString().split("T")[0],
    priority: "LOW",
    status: "COMPLETED",
    completedAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
];

export const mockActivitiesStore: MockActivity[] = [
  {
    id: "act_1",
    organizationId: "demo-org-123",
    type: "CALL",
    subject: "Discovery Call: Requirements & Seat Sizing",
    description: "Discussed 50+ sales rep requirements, integration with Neon DB, and role hierarchy.",
    leadId: "lead_1",
    leadName: "Elena Rostova",
    companyId: null,
    companyName: "Cyberdyne Systems",
    contactId: null,
    contactName: "Elena Rostova",
    opportunityId: null,
    opportunityName: null,
    userId: "usr_alex",
    userName: "Alex Sales",
    activityAt: new Date(Date.now() - 3600000).toISOString(),
    durationMinutes: 25,
    outcome: "Qualified - Moving to evaluation",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "act_2",
    organizationId: "demo-org-123",
    type: "MEETING",
    subject: "Product Demo & Technical Architecture Review",
    description: "Walked through multi-tenant security, audit logs, and permission matrix with CTO.",
    leadId: null,
    leadName: null,
    companyId: "comp_1",
    companyName: "Acme Technologies",
    contactId: "cont_1",
    contactName: "Sarah Connor",
    opportunityId: "opp_1",
    opportunityName: "Acme - Cloud Migration Project",
    userId: "usr_alex",
    userName: "Alex Sales",
    activityAt: new Date(Date.now() - 86400000).toISOString(),
    durationMinutes: 45,
    outcome: "Very positive - Proposal requested",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "act_3",
    organizationId: "demo-org-123",
    type: "EMAIL",
    subject: "Sent Formal Proposal: Acme Cloud Migration $85,000",
    description: "Attached detailed scope of work and enterprise SLA document.",
    leadId: null,
    leadName: null,
    companyId: "comp_1",
    companyName: "Acme Technologies",
    contactId: "cont_1",
    contactName: "Sarah Connor",
    opportunityId: "opp_1",
    opportunityName: "Acme - Cloud Migration Project",
    userId: "usr_alex",
    userName: "Alex Sales",
    activityAt: new Date(Date.now() - 172800000).toISOString(),
    durationMinutes: 10,
    outcome: "Delivered & Acknowledged",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "act_4",
    organizationId: "demo-org-123",
    type: "NOTE",
    subject: "Procurement Legal Review Note",
    description: "Customer legal counsel approved standard mutual NDA. Contract ready for signature.",
    leadId: "lead_3",
    leadName: "Sofia Castillo",
    companyId: "comp_1",
    companyName: "Solar Dynamics",
    contactId: null,
    contactName: "Sofia Castillo",
    opportunityId: "opp_4",
    opportunityName: "Solar Dynamics - Grid Infrastructure Deal",
    userId: "usr_sarah",
    userName: "Sarah Manager",
    activityAt: new Date(Date.now() - 259200000).toISOString(),
    durationMinutes: null,
    outcome: null,
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
];

export interface MockAuditLog {
  id: string;
  organizationId: string;
  userId: string | null;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export const mockAuditLogsStore: MockAuditLog[] = [
  {
    id: "audit_1",
    organizationId: "demo-org-123",
    userId: "usr_admin",
    userName: "Admin User",
    action: "USER_LOGIN",
    entityType: "User",
    entityId: "usr_admin",
    oldValues: null,
    newValues: { email: "admin@roxx-crm.local", role: "ADMIN" },
    ipAddress: "127.0.0.1",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "audit_2",
    organizationId: "demo-org-123",
    userId: "usr_alex",
    userName: "Alex Sales",
    action: "LEAD_CONVERTED",
    entityType: "Lead",
    entityId: "lead_3",
    oldValues: { status: "Qualified" },
    newValues: {
      status: "Converted",
      companyName: "Solar Dynamics",
      opportunityName: "Solar Dynamics - Grid Infrastructure Deal",
      amount: 65000,
    },
    ipAddress: "192.168.1.104",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "audit_3",
    organizationId: "demo-org-123",
    userId: "usr_alex",
    userName: "Alex Sales",
    action: "OPPORTUNITY_STAGE_CHANGED",
    entityType: "Opportunity",
    entityId: "opp_1",
    oldValues: { stage: "Discovery", probability: 40 },
    newValues: { stage: "Proposal", probability: 60 },
    ipAddress: "192.168.1.104",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: "audit_4",
    organizationId: "demo-org-123",
    userId: "usr_sarah",
    userName: "Sarah Manager",
    action: "BULK_IMPORT",
    entityType: "Lead",
    entityId: "batch_402",
    oldValues: null,
    newValues: { totalRows: 15, importedCount: 15, failedCount: 0 },
    ipAddress: "192.168.1.112",
    createdAt: new Date(Date.now() - 259200000).toISOString(),
  },
];

export interface MockUser {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "SALES_USER" | "READ_ONLY";
  isActive: boolean;
  isSuperAdmin?: boolean;
  avatarUrl: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

export const mockUsersStore: MockUser[] = [
  {
    id: "usr_admin",
    organizationId: "demo-org-123",
    name: "Admin User",
    email: "admin@roxx-crm.local",
    role: "ADMIN",
    isActive: true,
    isSuperAdmin: true,
    avatarUrl: null,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    lastLoginAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: "usr_sarah",
    organizationId: "demo-org-123",
    name: "Sarah Manager",
    email: "manager@roxx-crm.local",
    role: "MANAGER",
    isActive: true,
    isSuperAdmin: false,
    avatarUrl: null,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    lastLoginAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: "usr_alex",
    organizationId: "demo-org-123",
    name: "Alex Sales",
    email: "sales@roxx-crm.local",
    role: "SALES_USER",
    isActive: true,
    isSuperAdmin: false,
    avatarUrl: null,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    lastLoginAt: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: "usr_auditor",
    organizationId: "demo-org-123",
    name: "Rachel Auditor",
    email: "auditor@roxx-crm.local",
    role: "READ_ONLY",
    isActive: true,
    isSuperAdmin: false,
    avatarUrl: null,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    lastLoginAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

export interface MockOrgSettings {
  name: string;
  timezone: string;
  defaultCurrency: string;
  fiscalYearStart: string;
  dateFormat: string;
}

export const mockOrgSettingsStore: MockOrgSettings = {
  name: "Roxx Technologies Inc.",
  timezone: "America/New_York (EST)",
  defaultCurrency: "USD",
  fiscalYearStart: "January",
  dateFormat: "YYYY-MM-DD",
};

export interface MockPipelineStage {
  id: string;
  name: string;
  order: number;
  probability: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
}

export const mockPipelineStagesStore: MockPipelineStage[] = [
  { id: "stage_disc", name: "Discovery", order: 1, probability: 10, color: "#6366f1", isWon: false, isLost: false },
  { id: "stage_qual", name: "Qualification", order: 2, probability: 30, color: "#3b82f6", isWon: false, isLost: false },
  { id: "stage_prop", name: "Proposal", order: 3, probability: 60, color: "#eab308", isWon: false, isLost: false },
  { id: "stage_nego", name: "Negotiation", order: 4, probability: 80, color: "#f97316", isWon: false, isLost: false },
  { id: "stage_won", name: "Closed Won", order: 5, probability: 100, color: "#22c55e", isWon: true, isLost: false },
  { id: "stage_lost", name: "Closed Lost", order: 6, probability: 0, color: "#ef4444", isWon: false, isLost: true },
];

export interface MockOrganization {
  id: string;
  name: string;
  slug: string;
  subscriptionPlan: "FREE_TRIAL" | "STARTER_20" | "GROWTH_50" | "ENTERPRISE";
  subscriptionStatus: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED";
  maxSeats: number;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  billingEmail: string | null;
  billingPhone: string | null;
  subscriptionNotes: string | null;
  createdAt: string;
}

export const mockOrganizationsStore: MockOrganization[] = [
  {
    id: "demo-org-123",
    name: "Demo Company",
    slug: "demo-company",
    subscriptionPlan: "FREE_TRIAL",
    subscriptionStatus: "TRIAL",
    maxSeats: 20,
    trialEndsAt: new Date(Date.now() + 24 * 86400000).toISOString(),
    subscriptionEndsAt: null,
    billingEmail: "admin@roxx-crm.local",
    billingPhone: "+91 98765 43210",
    subscriptionNotes: "Registered via standard 30-day Free Trial (20 seats)",
    createdAt: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
];

