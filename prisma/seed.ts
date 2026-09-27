import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function main() {
  console.log("🌱 Starting CRM database seed...");

  // 1. Create or Find Organization
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);

  const org = await prisma.organization.upsert({
    where: { slug: "demo-company" },
    update: {
      isDemo: true,
      website: "https://demo.roxx-crm.local",
    },
    create: {
      name: "Demo Company",
      slug: "demo-company",
      subscriptionPlan: "FREE_TRIAL",
      subscriptionStatus: "TRIAL",
      maxSeats: 20,
      trialEndsAt: trialEnd,
      billingEmail: "admin@roxx-crm.local",
      subscriptionNotes: "Default 30-day Free Trial (20 seats)",
      isDemo: true,
      website: "https://demo.roxx-crm.local",
    },
  });
  console.log(`✓ Organization ready: ${org.name} (${org.id}) [isDemo: ${org.isDemo}]`);

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
        "company:create", "company:read", "company:update", "company:delete",
        "contact:create", "contact:read", "contact:update", "contact:delete",
        "opportunity:create", "opportunity:read", "opportunity:update", "opportunity:delete",
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
        "lead:create", "lead:read", "lead:update", "lead:delete",
        "company:create", "company:read", "company:update", "company:delete",
        "contact:create", "contact:read", "contact:update", "contact:delete",
        "opportunity:create", "opportunity:read", "opportunity:update", "opportunity:delete",
        "task:create", "task:read", "task:update", "task:delete",
        "activity:create", "activity:read", "activity:update",
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
      isSuperAdmin: true,
    },
    {
      email: "manager@roxx-crm.local",
      name: "Sarah Manager",
      roleName: "MANAGER",
      isSuperAdmin: false,
    },
    {
      email: "sales@roxx-crm.local",
      name: "Alex Sales",
      roleName: "SALES_USER",
      isSuperAdmin: false,
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
        isSuperAdmin: u.isSuperAdmin,
      },
      create: {
        organizationId: org.id,
        email: u.email,
        name: u.name,
        passwordHash,
        roleId: roles[u.roleName],
        isActive: true,
        isSuperAdmin: u.isSuperAdmin,
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
 
  // 6. Seed SaaS Plans & Features
  const plansData = [
    {
      name: "Starter",
      slug: "starter",
      description: "Ideal for small sales teams getting started with structured CRM processes.",
      price: 29,
      currency: "USD",
      billingInterval: "MONTHLY",
      features: {
        users_limit: "3",
        leads_limit: "1000",
        companies_limit: "500",
        contacts_limit: "1000",
        opportunities_limit: "500",
        pipelines_limit: "1",
        advanced_reports: "false",
        export: "true",
        api_access: "false",
        ai_features: "false",
      },
    },
    {
      name: "Professional",
      slug: "professional",
      description: "For fast-growing revenue teams needing multiple pipelines and deep reporting.",
      price: 79,
      currency: "USD",
      billingInterval: "MONTHLY",
      features: {
        users_limit: "10",
        leads_limit: "10000",
        companies_limit: "5000",
        contacts_limit: "10000",
        opportunities_limit: "5000",
        pipelines_limit: "5",
        advanced_reports: "true",
        export: "true",
        api_access: "true",
        ai_features: "false",
      },
    },
    {
      name: "Business",
      slug: "business",
      description: "Maximum scale, unlimited pipelines, enterprise audit controls, and AI features.",
      price: 199,
      currency: "USD",
      billingInterval: "MONTHLY",
      features: {
        users_limit: "25",
        leads_limit: "50000",
        companies_limit: "25000",
        contacts_limit: "50000",
        opportunities_limit: "25000",
        pipelines_limit: "20",
        advanced_reports: "true",
        export: "true",
        api_access: "true",
        ai_features: "true",
      },
    },
    {
      name: "Enterprise",
      slug: "enterprise",
      description: "Custom volume and dedicated support for large organizations.",
      price: 499,
      currency: "USD",
      billingInterval: "MONTHLY",
      features: {
        users_limit: "100",
        leads_limit: "250000",
        companies_limit: "100000",
        contacts_limit: "250000",
        opportunities_limit: "100000",
        pipelines_limit: "100",
        advanced_reports: "true",
        export: "true",
        api_access: "true",
        ai_features: "true",
      },
    },
  ];

  let professionalPlanId: string | null = null;
  for (const p of plansData) {
    const plan = await prisma.plan.upsert({
      where: { slug: p.slug },
      update: {
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        billingInterval: p.billingInterval,
      },
      create: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        currency: p.currency,
        billingInterval: p.billingInterval,
      },
    });

    if (p.slug === "professional") {
      professionalPlanId = plan.id;
    }

    for (const [key, val] of Object.entries(p.features)) {
      await prisma.planFeature.upsert({
        where: {
          planId_featureKey: {
            planId: plan.id,
            featureKey: key,
          },
        },
        update: { featureValue: val },
        create: {
          planId: plan.id,
          featureKey: key,
          featureValue: val,
        },
      });
    }
  }
  console.log(`✓ 4 SaaS Subscription Plans configured with feature limits`);

  // 7. Seed Platform User (Super Admin)
  await prisma.platformUser.upsert({
    where: { email: "admin@roxx-crm.local" },
    update: {
      name: "Platform Super Admin",
      passwordHash,
      status: "ACTIVE",
    },
    create: {
      name: "Platform Super Admin",
      email: "admin@roxx-crm.local",
      passwordHash,
      status: "ACTIVE",
    },
  });
  console.log("✓ Platform Super Admin user ready (admin@roxx-crm.local)");

  // 8. Seed Demo Organization Subscription & Event
  if (professionalPlanId) {
    const sub = await prisma.subscription.upsert({
      where: { id: "sub_demo_company" },
      update: {
        planId: professionalPlanId,
        status: "TRIAL",
        trialEndDate: trialEnd,
      },
      create: {
        id: "sub_demo_company",
        organizationId: org.id,
        planId: professionalPlanId,
        status: "TRIAL",
        startDate: new Date(),
        trialStartDate: new Date(),
        trialEndDate: trialEnd,
        renewalDate: trialEnd,
        billingInterval: "MONTHLY",
      },
    });

    await prisma.subscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        organizationId: org.id,
        eventType: "CREATED",
        newPlanId: professionalPlanId,
        notes: "Initial 30-day Free Trial started automatically",
        createdBy: "SYSTEM",
      },
    }).catch(() => {});
    console.log("✓ Demo Organization Subscription initialized");
  }

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
