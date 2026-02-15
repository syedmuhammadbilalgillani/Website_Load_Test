import { getRedis } from "./redis";

const WINDOW_SEC = 60;
const MAX_CREATE_JOB_PER_MINUTE = 10;

export async function checkCreateJobRateLimit(userId: string): Promise<boolean> {
  const redis = getRedis();
  const key = `ratelimit:createjob:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, WINDOW_SEC);
  return count <= MAX_CREATE_JOB_PER_MINUTE;
}
