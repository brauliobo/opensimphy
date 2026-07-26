import type { EarthMethodId, EarthProgramId, EarthResult } from "../engine/earth/index.js";

export type EarthWorkerRequestId = string;
export type EarthWorkerProgress = 5 | 20 | 100;

export interface EarthWorkerRunRequest<
  ProgramId extends EarthProgramId = EarthProgramId,
  MethodId extends EarthMethodId = EarthMethodId,
> {
  type: "run";
  requestId: EarthWorkerRequestId;
  programId: ProgramId;
  methodId: MethodId;
  inputs: unknown;
}

export interface EarthWorkerCancelRequest {
  type: "cancel";
  requestId: EarthWorkerRequestId;
}

export type EarthWorkerRequest = EarthWorkerRunRequest | EarthWorkerCancelRequest;

export interface EarthWorkerProgressResponse<
  ProgramId extends EarthProgramId = EarthProgramId,
  MethodId extends EarthMethodId = EarthMethodId,
> {
  type: "progress";
  requestId: EarthWorkerRequestId;
  programId: ProgramId;
  methodId: MethodId;
  progress: 20;
}

export interface EarthWorkerCompletedResponse<
  ProgramId extends EarthProgramId = EarthProgramId,
  MethodId extends EarthMethodId = EarthMethodId,
> {
  type: "completed";
  requestId: EarthWorkerRequestId;
  programId: ProgramId;
  methodId: MethodId;
  result: EarthResult<ProgramId>;
}

export interface EarthWorkerCancelledResponse<
  ProgramId extends EarthProgramId = EarthProgramId,
  MethodId extends EarthMethodId = EarthMethodId,
> {
  type: "cancelled";
  requestId: EarthWorkerRequestId;
  programId: ProgramId;
  methodId: MethodId;
}

export interface EarthWorkerFailedResponse<
  ProgramId extends EarthProgramId = EarthProgramId,
  MethodId extends EarthMethodId = EarthMethodId,
> {
  type: "failed";
  requestId: EarthWorkerRequestId;
  programId: ProgramId;
  methodId: MethodId;
  error: string;
}

export type EarthWorkerResponse<
  ProgramId extends EarthProgramId = EarthProgramId,
  MethodId extends EarthMethodId = EarthMethodId,
> =
  | EarthWorkerProgressResponse<ProgramId, MethodId>
  | EarthWorkerCompletedResponse<ProgramId, MethodId>
  | EarthWorkerCancelledResponse<ProgramId, MethodId>
  | EarthWorkerFailedResponse<ProgramId, MethodId>;

export type EarthWorkerCompletedExecution<
  ProgramId extends EarthProgramId = EarthProgramId,
  MethodId extends EarthMethodId = EarthMethodId,
> = EarthResult<ProgramId> & { methodId: MethodId };

export interface EarthWorkerCancelledExecution<
  ProgramId extends EarthProgramId = EarthProgramId,
  MethodId extends EarthMethodId = EarthMethodId,
> {
  schemaVersion: 2;
  programId: ProgramId;
  methodId: MethodId;
  executionStatus: "cancelled";
  id: ProgramId;
  status: "cancelled";
}

export interface EarthWorkerFailedExecution<
  ProgramId extends EarthProgramId = EarthProgramId,
  MethodId extends EarthMethodId = EarthMethodId,
> {
  schemaVersion: 2;
  programId: ProgramId;
  methodId: MethodId;
  executionStatus: "failed";
  id: ProgramId;
  status: "failed";
  error: string;
}

export type EarthWorkerExecution<
  ProgramId extends EarthProgramId = EarthProgramId,
  MethodId extends EarthMethodId = EarthMethodId,
> =
  | EarthWorkerCompletedExecution<ProgramId, MethodId>
  | EarthWorkerCancelledExecution<ProgramId, MethodId>
  | EarthWorkerFailedExecution<ProgramId, MethodId>;
