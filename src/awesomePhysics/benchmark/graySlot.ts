export const GRAY_MOTOR_PLUGIN_ID = 'gray-motor-v1' as const
export const GRAY_MOTOR_HARNESS_REVOLUTIONS = 100

export interface GrayMotorPluginResultV1 {
  pluginId: typeof GRAY_MOTOR_PLUGIN_ID
  motors: Array<{
    motorId: string
    completedRevolutions: number
    wholeSystemCop: number
    normalizedResidual: number
    energyInJ: number
    energyOutJ: number
  }>
}

export interface GrayMotorPluginV1 {
  pluginId: typeof GRAY_MOTOR_PLUGIN_ID
  run: (signal?: AbortSignal) => Promise<GrayMotorPluginResultV1>
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  const error = signal.reason instanceof Error ? signal.reason : new Error('The Gray motor harness run was aborted')
  error.name = 'AbortError'
  throw error
}

export async function loadGrayMotorPlugin(): Promise<GrayMotorPluginV1> {
  const engine = await import('../../edwin-gray/edwinGrayEngine')
  return {
    pluginId: GRAY_MOTOR_PLUGIN_ID,
    async run(signal) {
      throwIfAborted(signal)
      const motors = []
      for (const motorId of engine.GRAY_MOTOR_IDS) {
        throwIfAborted(signal)
        const preset = engine.GRAY_PRESETS[motorId]
        const profile = Object.values(engine.GRAY_ENGINE_PROFILES).find((entry) => entry.motorId === motorId)
        if (profile === undefined) throw new Error(`Gray engine profile missing for ${motorId}`)
        const result = engine.evaluateGrayFullMotor({
          ...preset,
          machineContractId: profile.contractId,
          revolutions: GRAY_MOTOR_HARNESS_REVOLUTIONS,
          mode: 'prescribed-diagnostic',
          machineMode: 'modified-electronic-v1',
        })
        motors.push({
          motorId,
          completedRevolutions: result.completedRevolutions,
          wholeSystemCop: result.ledger.wholeSystemCop,
          normalizedResidual: result.ledger.normalizedResidual,
          energyInJ: result.ledger.totalDeclaredInputJ,
          energyOutJ: result.ledger.loadWorkJ,
        })
      }
      return { pluginId: GRAY_MOTOR_PLUGIN_ID, motors }
    },
  }
}
