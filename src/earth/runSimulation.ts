import EarthSimulationWorker from "../workers/earthSimulation.worker?worker";
import {
  getDefaultEarthMethodId,
  type EarthMethodId,
  type EarthProgramId,
  type EarthResult,
} from "../engine/earth/index.js";
import type {
  EarthWorkerCancelledExecution,
  EarthWorkerExecution,
  EarthWorkerFailedExecution,
  EarthWorkerProgress,
  EarthWorkerRequest,
  EarthWorkerRequestId,
  EarthWorkerResponse,
} from "../types/earthWorkers.js";

export interface EarthMethodWorkerOptions {
  signal?: AbortSignal;
  onProgress?: (progress: EarthWorkerProgress) => void;
}

export type EarthSimulationWorkerOptions = EarthMethodWorkerOptions;

export interface EarthMethodRunnerDependencies {
  createWorker?: () => Worker;
  createRequestId?: () => EarthWorkerRequestId;
}

export type EarthSimulationRunnerDependencies = EarthMethodRunnerDependencies;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createDefaultRequestId(): EarthWorkerRequestId {
  return `earth-${crypto.randomUUID()}`;
}

export function createEarthMethodRunner(
  dependencies: EarthMethodRunnerDependencies = {},
): <ProgramId extends EarthProgramId, MethodId extends EarthMethodId>(
  programId: ProgramId,
  methodId: MethodId,
  inputs: unknown,
  options?: EarthMethodWorkerOptions,
) => Promise<EarthWorkerExecution<ProgramId, MethodId>> {
  const createWorker = dependencies.createWorker ?? (() => new EarthSimulationWorker());
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;

  return function runEarthMethodInDedicatedWorker<
    ProgramId extends EarthProgramId,
    MethodId extends EarthMethodId,
  >(
    programId: ProgramId,
    methodId: MethodId,
    inputs: unknown,
    { signal, onProgress }: EarthMethodWorkerOptions = {},
  ): Promise<EarthWorkerExecution<ProgramId, MethodId>> {
    const cancelledExecution = (): EarthWorkerCancelledExecution<ProgramId, MethodId> => ({
      schemaVersion: 2,
      programId,
      methodId,
      executionStatus: "cancelled",
      id: programId,
      status: "cancelled",
    });
    const failedExecution = (error: unknown): EarthWorkerFailedExecution<ProgramId, MethodId> => ({
      schemaVersion: 2,
      programId,
      methodId,
      executionStatus: "failed",
      id: programId,
      status: "failed",
      error: errorMessage(error),
    });

    if (signal?.aborted) return Promise.resolve(cancelledExecution());

    let requestId: EarthWorkerRequestId;
    let worker: Worker;
    try {
      requestId = createRequestId();
      worker = createWorker();
    } catch (error) {
      return Promise.resolve(failedExecution(error));
    }

    return new Promise((resolve) => {
      let settled = false;

      const finish = (execution: EarthWorkerExecution<ProgramId, MethodId>) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", abort);
        worker.removeEventListener("message", receive);
        worker.removeEventListener("error", fail);
        worker.terminate();
        if (execution.status === "completed") {
          try {
            onProgress?.(100);
          } catch (error) {
            resolve(failedExecution(error));
            return;
          }
        }
        resolve(execution);
      };

      const abort = () => {
        if (settled) return;
        try {
          worker.postMessage({ type: "cancel", requestId } satisfies EarthWorkerRequest);
        } catch {
          // Termination below remains authoritative if the worker cannot receive cancellation.
        }
        finish(cancelledExecution());
      };

      const receive = (event: MessageEvent<EarthWorkerResponse>) => {
        const response = event.data;
        if (settled || response.requestId !== requestId) return;
        if (response.type === "progress") {
          try {
            onProgress?.(response.progress);
          } catch (error) {
            finish(failedExecution(error));
          }
          return;
        }
        if (response.type === "completed") {
          finish(response.result as EarthResult<ProgramId> & { methodId: MethodId });
          return;
        }
        if (response.type === "cancelled") {
          finish(cancelledExecution());
          return;
        }
        finish(failedExecution(response.error));
      };

      const fail = (event: ErrorEvent) => {
        finish(failedExecution(event.message || "EARTH simulation worker failed"));
      };

      worker.addEventListener("message", receive);
      worker.addEventListener("error", fail);
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) {
        abort();
        return;
      }

      try {
        worker.postMessage({ type: "run", requestId, programId, methodId, inputs } satisfies EarthWorkerRequest);
        onProgress?.(5);
      } catch (error) {
        finish(failedExecution(error));
      }
    });
  };
}

export const runEarthMethodInWorker = createEarthMethodRunner();

export function createEarthSimulationRunner(
  dependencies: EarthSimulationRunnerDependencies = {},
): <ProgramId extends EarthProgramId>(
  programId: ProgramId,
  inputs: unknown,
  options?: EarthSimulationWorkerOptions,
) => Promise<EarthWorkerExecution<ProgramId>> {
  const runMethod = createEarthMethodRunner(dependencies);
  return function runEarthSimulationInDedicatedWorker<ProgramId extends EarthProgramId>(
    programId: ProgramId,
    inputs: unknown,
    options?: EarthSimulationWorkerOptions,
  ): Promise<EarthWorkerExecution<ProgramId>> {
    return runMethod(programId, getDefaultEarthMethodId(programId), inputs, options);
  };
}

export const runEarthSimulationInWorker = createEarthSimulationRunner();
