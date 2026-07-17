/// <reference lib="webworker" />

import { evaluateCoreRegistry } from "../engine/core.js";
import { evaluateRecipes } from "../engine/recipes.js";
import type { SimulationWorkerMessage, SimulationWorkerResponse, WorkerRequestId } from "../types/workers.js";

const worker = self as unknown as DedicatedWorkerGlobalScope;
const cancelled = new Set<WorkerRequestId>();

worker.addEventListener("message", (event: MessageEvent<SimulationWorkerMessage>) => {
  const message = event.data;
  if (message.type === "cancel") {
    cancelled.add(message.requestId);
    return;
  }
  const { requestId } = message;
  setTimeout(() => {
    try {
      if (cancelled.delete(requestId)) {
        worker.postMessage({ type: "cancelled", requestId } satisfies SimulationWorkerResponse);
        return;
      }
      const result = message.type === "evaluate-recipes"
        ? evaluateRecipes(message.recipes, message.symbols)
        : evaluateCoreRegistry(message.cases);
      if (cancelled.delete(requestId)) worker.postMessage({ type: "cancelled", requestId } satisfies SimulationWorkerResponse);
      else worker.postMessage({ type: "result", requestId, result } satisfies SimulationWorkerResponse);
    } catch (error) {
      cancelled.delete(requestId);
      worker.postMessage({ type: "error", requestId, error: error instanceof Error ? error.message : String(error) } satisfies SimulationWorkerResponse);
    }
  }, 0);
});
