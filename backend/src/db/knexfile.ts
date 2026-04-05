import type { Knex } from "knex";
import path from "path";
import fs from "fs";
import os from "os";

const isCompiled = __filename.endsWith(".js");

const defaultDbPath =
  process.env.DATABASE_PATH || path.join(os.tmpdir(), "timeforge", "db.sqlite");
const dbDir = path.dirname(defaultDbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const config: Knex.Config = {
  client: "better-sqlite3",
  connection: {
    filename: defaultDbPath,
  },
  useNullAsDefault: true,
  pool: {
    afterCreate: (conn: any, done: any) => {
      conn.pragma("foreign_keys = ON");
      done(null, conn);
    },
  },
  migrations: {
    directory: path.resolve(__dirname, "migrations"),
    extension: isCompiled ? "js" : "ts",
  },
  seeds: {
    directory: path.resolve(__dirname, "seeds"),
    extension: isCompiled ? "js" : "ts",
  },
};

export default config;
