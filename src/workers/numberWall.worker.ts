/// <reference lib="webworker" />

import { simulateNumberWall, WallCancelledError } from "../engine/numberWall.js";
import type { WallWorkerMessage, WallWorkerResponse, WorkerRequestId } from "../types/workers.js";

const worker = self as unknown as DedicatedWorkerGlobalScope;
const cancelled = new Set<WorkerRequestId>();

worker.addEventListener("message", (event: MessageEvent<WallWorkerMessage>) => {
  const message = event.data;
  if (message.type === "cancel") {
    cancelled.add(message.requestId);
    return;
  }
  const { requestId } = message;
  setTimeout(() => {
    try {
      if (cancelled.delete(requestId)) {
        worker.postMessage({ type: "cancelled", requestId } satisfies WallWorkerResponse);
        return;
      }
      const result = simulateNumberWall(message.payload, {
        ...message.options,
        shouldCancel: () => cancelled.has(requestId),
      });
      if (cancelled.delete(requestId)) worker.postMessage({ type: "cancelled", requestId } satisfies WallWorkerResponse);
      else worker.postMessage({ type: "result", requestId, result } satisfies WallWorkerResponse);
    } catch (error) {
      if (error instanceof WallCancelledError) worker.postMessage({ type: "cancelled", requestId } satisfies WallWorkerResponse);
      else worker.postMessage({ type: "error", requestId, error: error instanceof Error ? error.message : String(error) } satisfies WallWorkerResponse);
    }
  }, 0);
});
