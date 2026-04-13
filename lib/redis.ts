import Redis from "ioredis";

const redisConfig = {
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // required by BullMQ
};

// Singleton for BullMQ connections (must not be shared with subscriber connections)
const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(redisConfig);

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export { redisConfig };
