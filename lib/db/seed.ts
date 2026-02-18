import { Client } from "pg";

const TEAM_ID = "00000000-0000-0000-0000-000000000001";

async function seed() {
  const client = new Client({
    host: "aws-1-us-east-1.pooler.supabase.com",
    port: 6543,
    user: "postgres.xaehuqpsmosztqhortdu",
    password: "VWJFmmOh1UF21Yz1",
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected to database");

  // Insert default team
  await client.query(
    `INSERT INTO teams (id, name, plan) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [TEAM_ID, "Default Team", "free"]
  );
  console.log("Seeded team:", TEAM_ID);

  // Insert agent definitions
  const agents = [
    { name: "Market Research", slug: "market-research", dependencies: [] },
    { name: "PMF", slug: "pmf", dependencies: [] },
    { name: "Positioning", slug: "positioning", dependencies: ["market-research", "pmf"] },
    { name: "Analytics", slug: "analytics", dependencies: ["market-research"] },
    { name: "Content", slug: "content", dependencies: ["positioning"] },
    { name: "Sales Enablement", slug: "sales-enablement", dependencies: ["positioning"] },
    { name: "Demand Gen", slug: "demand-gen", dependencies: ["positioning"] },
    { name: "Launch Planning", slug: "launch", dependencies: ["content", "sales-enablement", "demand-gen"] },
    { name: "CRM", slug: "crm", dependencies: [] },
  ];

  for (const agent of agents) {
    await client.query(
      `INSERT INTO agents (name, slug, dependencies) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING`,
      [agent.name, agent.slug, agent.dependencies]
    );
    console.log("Seeded agent:", agent.slug);
  }

  await client.end();
  console.log("Done!");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
