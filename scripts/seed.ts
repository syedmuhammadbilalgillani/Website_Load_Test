import "dotenv/config";
import { db } from "../db/db";
import { plans } from "../db/schema";

async function seed() {
  await db.insert(plans).values([
    {
      id: "free",
      name: "Free",
      maxConcurrency: 100,
      maxDurationSeconds: 60,
      maxJobsPerDay: 10,
      maxTestsPerMonth: 100,
    },
    {
      id: "pro",
      name: "Pro",
      maxConcurrency: 2000,
      maxDurationSeconds: 300,
      maxJobsPerDay: 50,
      maxTestsPerMonth: 1000,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      maxConcurrency: 10000,
      maxDurationSeconds: 1800,
      maxJobsPerDay: 500,
      maxTestsPerMonth: null,
    },
  ]).onConflictDoNothing({ target: plans.id });

  console.log("Plans seeded.");
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
