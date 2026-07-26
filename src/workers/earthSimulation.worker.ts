/// <reference lib="webworker" />

import {
  EarthCancellationError,
  runEarthMethod,
  type EarthSimulationInputs,
} from "../engine/earth/index.js";
import type {
  EarthWorkerRequest,
  EarthWorkerRequestId,
  EarthWorkerResponse,
  EarthWorkerRunRequest,
} from "../types/earthWorkers.js";

const worker = self as unknown as DedicatedWorkerGlobalScope;
const cancelled = new Set<EarthWorkerRequestId>();

function post(response: EarthWorkerResponse): void {
  worker.postMessage(response);
}

function execute(message: EarthWorkerRunRequest): void {
  const { programId, methodId, inputs, requestId } = message;
  if (cancelled.delete(requestId)) {
    post({ type: "cancelled", requestId, programId, methodId });
    return;
  }

  try {
    post({ type: "progress", requestId, programId, methodId, progress: 20 });
    const result = runEarthMethod(
      programId,
      methodId,
      inputs as EarthSimulationInputs[typeof programId],
      { isCancelled: () => cancelled.has(requestId) },
    );
    if (cancelled.delete(requestId)) post({ type: "cancelled", requestId, programId, methodId });
    else post({ type: "completed", requestId, programId, methodId, result });
  } catch (error) {
    const wasCancelled = cancelled.delete(requestId) || error instanceof EarthCancellationError;
    if (wasCancelled) post({ type: "cancelled", requestId, programId, methodId });
    else post({
      type: "failed",
      requestId,
      programId,
      methodId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

worker.addEventListener("message", (event: MessageEvent<EarthWorkerRequest>) => {
  const message = event.data;
  if (message.type === "cancel") {
    cancelled.add(message.requestId);
    return;
  }
  setTimeout(() => execute(message), 0);
});
