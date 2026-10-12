import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import logger from "../utils/logger";

class Database {
  public sql: postgres.Sql<{}>;
  public db: PostgresJsDatabase<Record<string, never>>;
  private interval: ReturnType<typeof setInterval> | null = null;
  private retryCount: number = 0;
  private maxRetries: number = 5;

  constructor(url: string) {
    this.sql = postgres(url, {
      max: 20,
      idle_timeout: 60,
      connection: {
        application_name: "Selena"
      }
    });
    this.db = drizzle(this.sql);
  }

  async connect() {
    try {
      const result = await this.sql`SELECT 1`;
      if (result.length === 0) {
        throw new Error("Failed to connect to database");
      }
      
      logger.Iris("Connected to database");
      this.retryCount = 0;
      this.startHeartbeat();
    } catch (error) {
      logger.error("Connection failed:", error);
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        logger.debug(
          `Retrying connection (${this.retryCount}/${this.maxRetries})...`
        );
        await this.delay(2000);
        await this.connect();
      } else {
        logger.error("Max retry attempts reached.");
      }
    }
  }

  private startHeartbeat() {
    this.interval = setInterval(async () => {
      try {
        await this.sql`SELECT 1`;
      } catch (error) {
        logger.error("Heartbeat failed:", error);
        
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          logger.debug(`Retrying (${this.retryCount}/${this.maxRetries})...`);
          await this.connect();
        } else {
          logger.error("Max retry attempts reached");
        }
      }
    }, 60 * 1000);
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async end() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    await this.sql.end();
  }
}

export default Database;