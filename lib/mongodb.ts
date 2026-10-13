import "@/lib/env";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI environment variable");
}
const mongoUri: string = MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

function resetCache() {
  cache.conn = null;
  cache.promise = null;
}

export async function connectToDatabase() {
  // Drop a dead connection so cold starts / Atlas blips can recover without a full redeploy.
  if (cache.conn && mongoose.connection.readyState === 1) {
    return cache.conn;
  }
  if (cache.conn && mongoose.connection.readyState !== 1) {
    resetCache();
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(mongoUri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 15000,
      })
      .catch((err) => {
        resetCache();
        throw err;
      });
  }

  try {
    cache.conn = await cache.promise;
    return cache.conn;
  } catch (err) {
    resetCache();
    throw err;
  }
}
