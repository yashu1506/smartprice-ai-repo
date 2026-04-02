import { MongoClient, type Db } from "mongodb";

const uriFromEnv = process.env.MONGODB_URI || "mongodb://localhost:27017";
if (!uriFromEnv) {
  throw new Error("Missing MONGODB_URI in environment");
}

const uri: string = uriFromEnv;
const dbName = process.env.MONGODB_DB ?? "smarterai";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectMongo(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export function getDb(): Db {
  if (!db) {
    throw new Error("MongoDB not connected. Call connectMongo() first.");
  }
  return db;
}
