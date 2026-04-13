import { Queue } from "bullmq";
import { redisConfig } from "@/lib/redis";

// One queue per job type — keeps jobs isolated and easy to monitor
export const scriptParseQueue = new Queue("script-parse", { connection: redisConfig });
export const imageGenerateQueue = new Queue("image-generate", { connection: redisConfig });
export const videoGenerateQueue = new Queue("video-generate", { connection: redisConfig });
export const voiceGenerateQueue = new Queue("voice-generate", { connection: redisConfig });
export const videoAssembleQueue = new Queue("video-assemble", { connection: redisConfig });
export const contentIdCheckQueue = new Queue("content-id-check", { connection: redisConfig });
export const sceneGenerateQueue = new Queue("scene-generate", { connection: redisConfig });

export type QueueName =
  | "script-parse"
  | "image-generate"
  | "video-generate"
  | "voice-generate"
  | "video-assemble"
  | "content-id-check"
  | "scene-generate";

export const queues: Record<QueueName, Queue> = {
  "script-parse": scriptParseQueue,
  "image-generate": imageGenerateQueue,
  "video-generate": videoGenerateQueue,
  "voice-generate": voiceGenerateQueue,
  "video-assemble": videoAssembleQueue,
  "content-id-check": contentIdCheckQueue,
  "scene-generate": sceneGenerateQueue,
};
