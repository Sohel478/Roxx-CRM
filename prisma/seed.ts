import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function main() {
  console.log("🌱 Starting CRM database seed...");

  // 1. Create or Find Organization
  const org = await prisma.organization.upsert({
    where: { slug: "demo-company" },
    update: {},
    create: {
      name: "Demo Company",
      slug: "demo-company",
    },
  });
  console.log(`✓ Organization ready: ${org.name} (${org.id})`);

  // 2. Define System Permissions
  const permissionsData = [
    // Leads
    { key: "lead:create", module: "leads", description: "Create new leads" },
    { key: "lead:read", module: "leads", description: "View leads" },
    { key: "lead:update", module: "leads", description: "Edit leads" },
    { key: "lead:delete", module: "leads", description: "Delete leads" },
    { key: "lead:assign", module: "leads", description: "Assign lead owner" },
    // Companies
    { key: "company:create", module: "companies", description: "Create company accounts" },
    { key: "company:read", module: "companies", description: "View companies" },
    { key: "company:update", module: "companies", description: "Edit companies" },
    { key: "company:delete", module: "companies", description: "Delete companies" },
    // Contacts
    { key: "contact:create", module: "contacts", description: "Create contacts" },
    { key: "contact:read", module: "contacts", description: "View contacts" },
    { key: "contact:update", module: "contacts", description: "Edit contacts" },
    { key: "contact:delete", module: "contacts", description: "Delete contacts" },
    // Opportunities
    { key: "opportunity:create", module: "opportunities", description: "Create opportunities" },
    { key: "opportunity:read", module: "opportunities", description: "View opportunities" },
    { key: "opportunity:update", module: "opportunities", description: "Edit opportunities" },
    { key: "opportunity:delete", module: "opportunities", description: "Delete opportunities" },
    // Tasks
    { key: "task:create", module: "tasks", description: "Create tasks & follow-ups" },
    { key: "task:read", module: "tasks", description: "View tasks" },
    { key: "task:update", module: "tasks", description: "Edit & complete tasks" },
    { key: "task:delete", module: "tasks", description: "Delete tasks" },
    // Activities
    { key: "activity:create", module: "activities", description: "Log activities" },
    { key: "activity:read", module: "activities", description: "View activity history" },
    { key: "activity:update", module: "activities", description: "Edit logged activities" },
    // Reports
    { key: "report:view", module: "reports", description: "View sales dashboards & reports" },
    { key: "report:export", module: "reports", description: "Export report data to CSV" },
    // Users & Roles
    { key: "user:create", module: "users", description: "Invite new team users" },
    { key: "user:read", module: "users", description: "View team members" },
    { key: "user:update", module: "users", description: "Edit users and roles" },
    { key: "user:delete", module: "users", description: "Deactivate users" },
    // Settings
    { key: "settings:read", module: "settings", description: "View CRM settings" },
    { key: "settings:update", module: "settings", description: "Update CRM configurations" },
  ];

  const permissions: Record<string, string> = {};
  for (const perm of permissionsData) {
    const created = await prisma.permission.upsert({
      where: { key: perm.key },
      update: { description: perm.description, module: perm.module },
      create: perm,
    });
    permissions[perm.key] = created.id;
  }
  console.log(`✓ ${Object.keys(permissions).length} Permissions registered`);

  // 3. Define Roles
  const rolesDef = [
    {
      name: "ADMIN",
      description: "Full administrative access to all CRM resources and settings",
      permissions: Object.keys(permissions),
    },
    {
      name: "MANAGER",
      description: "Can view and manage team records, assign leads, and inspect reports",
      permissions: [
        "lead:create", "lead:read", "lead:update", "lead:delete", "lead:assign",
        "company:create", "company:read", "company:update",
        "contact:create", "contact:read", "contact:update",
        "opportunity:create", "opportunity:read", "opportunity:update",
        "task:create", "task:read", "task:update", "task:delete",
        "activity:create", "activity:read", "activity:update",
        "report:view", "report:export",
        "user:read",
        "settings:read",
      ],
    },
    {
      name: "SALES_USER",
      description: "Manages assigned leads, contacts, opportunities, and activities",
      permissions: [
        "lead:create", "lead:read", "lead:update",
        "company:create", "company:read",
        "contact:create", "contact:read", "contact:update",
        "opportunity:create", "opportunity:read", "opportunity:update",
        "task:create", "task:read", "task:update",
        "activity:create", "activity:read",
        "report:view",
      ],
    },
    {
      name: "READ_ONLY",
      description: "Read-only inspection of CRM data",
      permissions: [
        "lead:read", "company:read", "contact:read", "opportunity:read",
        "task:read", "activity:read", "report:view",
      ],
    },
  ];

  const roles: Record<string, string> = {};
  for (const r of rolesDef) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_name: {
          organizationId: org.id,
          name: r.name,
        },
      },
      update: { description: r.description },
      create: {
        organizationId: org.id,
        name: r.name,
        description: r.description,
      },
    });
    roles[r.name] = role.id;

    // Associate permissions
    for (const permKey of r.permissions) {
      const permId = permissions[permKey];
      if (permId) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permId,
            },
          },
          update: {},
          create: {
            roleId: role.id,
            permissionId: permId,
          },
        });
      }
    }
  }
  console.log("✓ Roles and permissions associated");

  // 4. Create Seed Users
  const passwordHash = await bcrypt.hash("password123", 10);

  const usersData = [
    {
      email: "admin@roxx-crm.local",
      name: "Admin User",
      roleName: "ADMIN",
    },
    {
      email: "manager@roxx-crm.local",
      name: "Sarah Manager",
      roleName: "MANAGER",
    },
    {
      email: "sales@roxx-crm.local",
      name: "Alex Sales",
      roleName: "SALES_USER",
    },
  ];

  for (const u of usersData) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        passwordHash,
        roleId: roles[u.roleName],
        isActive: true,
      },
      create: {
        organizationId: org.id,
        email: u.email,
        name: u.name,
        passwordHash,
        roleId: roles[u.roleName],
        isActive: true,
      },
    });
  }
  console.log("✓ Seed users created with password: password123");

  // 5. Default Sales Pipeline & Stages
  const pipeline = await prisma.pipeline.upsert({
    where: { id: `${org.id}-default-pipeline` },
    update: {},
    create: {
      id: `${org.id}-default-pipeline`,
      organizationId: org.id,
      name: "Standard Sales Pipeline",
      isDefault: true,
    },
  });

  const stagesData = [
    { name: "New", order: 1, probability: 10, color: "#3B82F6", isWon: false, isLost: false },
    { name: "Qualified", order: 2, probability: 25, color: "#8B5CF6", isWon: false, isLost: false },
    { name: "Discovery", order: 3, probability: 40, color: "#6366F1", isWon: false, isLost: false },
    { name: "Proposal", order: 4, probability: 60, color: "#F59E0B", isWon: false, isLost: false },
    { name: "Negotiation", order: 5, probability: 80, color: "#EC4899", isWon: false, isLost: false },
    { name: "Won", order: 6, probability: 100, color: "#059669", isWon: true, isLost: false },
    { name: "Lost", order: 7, probability: 0, color: "#EF4444", isWon: false, isLost: true },
  ];

  for (const s of stagesData) {
    await prisma.pipelineStage.upsert({
      where: {
        pipelineId_name: {
          pipelineId: pipeline.id,
          name: s.name,
        },
      },
      update: {
        order: s.order,
        probability: s.probability,
        color: s.color,
        isWon: s.isWon,
        isLost: s.isLost,
      },
      create: {
        pipelineId: pipeline.id,
        name: s.name,
        order: s.order,
        probability: s.probability,
        color: s.color,
        isWon: s.isWon,
        isLost: s.isLost,
      },
    });
  }
  console.log("✓ Default pipeline and 7 stages configured");

  // 6. Lead Sources
  const sources = [
    "Website", "Referral", "LinkedIn", "Cold Email", "Google", "Facebook", "Instagram", "Upwork", "Other"
  ];
  for (const name of sources) {
    await prisma.leadSource.upsert({
      where: {
        organizationId_name: {
          organizationId: org.id,
          name,
        },
      },
      update: {},
      create: {
        organizationId: org.id,
        name,
        isDefault: name === "Website",
      },
    });
  }
  console.log("✓ Lead sources configured");

  // 7. Lead Statuses
  const statuses = [
    { name: "New", order: 1, isDefault: true, isConverted: false },
    { name: "Contacted", order: 2, isDefault: false, isConverted: false },
    { name: "Qualified", order: 3, isDefault: false, isConverted: false },
    { name: "Unqualified", order: 4, isDefault: false, isConverted: false },
    { name: "Nurture", order: 5, isDefault: false, isConverted: false },
    { name: "Converted", order: 6, isDefault: false, isConverted: true },
    { name: "Lost", order: 7, isDefault: false, isConverted: false },
  ];
  for (const s of statuses) {
    await prisma.leadStatus.upsert({
      where: {
        organizationId_name: {
          organizationId: org.id,
          name: s.name,
        },
      },
      update: {
        order: s.order,
        isDefault: s.isDefault,
        isConverted: s.isConverted,
      },
      create: {
        organizationId: org.id,
        name: s.name,
        order: s.order,
        isDefault: s.isDefault,
        isConverted: s.isConverted,
      },
    });
  }
  console.log("✓ Lead statuses configured");

  console.log("🎉 Database seed completed successfully!");
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error("❌ Seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
