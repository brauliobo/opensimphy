import type { PrimitiveSymbolSource, RecipeBatchResult, RecipeSource, WallPayload, WallSimulation, WallSimulationOptions } from "./engine.js";
import type { CoreCase, CoreEvaluation } from "../engine/core.js";

export type WorkerRequestId = string | number;

export interface CancelWorkerRequest {
  type: "cancel";
  requestId: WorkerRequestId;
}

export interface WallWorkerRequest {
  type: "simulate-wall";
  requestId: WorkerRequestId;
  payload: WallPayload;
  options?: Omit<WallSimulationOptions, "shouldCancel">;
}

export interface RecipeWorkerRequest {
  type: "evaluate-recipes";
  requestId: WorkerRequestId;
  recipes: RecipeSource[];
  symbols: PrimitiveSymbolSource[];
}

export interface CoreWorkerRequest {
  type: "evaluate-core";
  requestId: WorkerRequestId;
  cases?: CoreCase[];
}

export type WallWorkerMessage = WallWorkerRequest | CancelWorkerRequest;
export type SimulationWorkerMessage = RecipeWorkerRequest | CoreWorkerRequest | CancelWorkerRequest;

export type WorkerResponse<T> =
  | { type: "result"; requestId: WorkerRequestId; result: T }
  | { type: "cancelled"; requestId: WorkerRequestId }
  | { type: "error"; requestId: WorkerRequestId; error: string };

export type WallWorkerResponse = WorkerResponse<WallSimulation>;
export type SimulationWorkerResponse = WorkerResponse<RecipeBatchResult | CoreEvaluation[]>;
