import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const velocityLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 s"), // 5 requests/sec per identifier
    analytics: false, // skip extra tracking commands — conserves free-tier command budget
});