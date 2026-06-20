import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Seed ISO standards on startup (no-op if already seeded)
import { seedStandards } from "./seed";

seedStandards()
  .then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Error seeding standards");
    // Still start the server even if seeding fails
    app.listen(port, (err2) => {
      if (err2) {
        logger.error({ err2 }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening (without seed)");
    });
  });
