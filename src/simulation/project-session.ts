import { canonicalizeOnelab, restoreReadOnlyValues, setParameterValue } from './onelab-db'
import type { MicrostripResult, ProjectDescriptor, ProjectEnvelope, ProjectFile, ProjectResponse } from './types'
import type { PhysicalGroupSidecar } from './physical-groups'

export class ProjectSession {
  readonly projectId: string
  private _files: ProjectFile[] = []
  private _defaults = ''
  private _database = ''
  private _revision = 0
  private _lastResult?: MicrostripResult
  private _descriptor?: ProjectDescriptor

  constructor(projectId = crypto.randomUUID()) { this.projectId = projectId }

  get files() { return this._files.map(({ path, bytes }) => ({ path, bytes: bytes.slice() })) }
  get defaults() { return this._defaults }
  get database() { return this._database }
  get revision() { return this._revision }
  get lastResult() { return this._lastResult }
  get ready() { return Boolean(this._database) }

  open(files: ProjectFile[], defaults: string, descriptor?: ProjectDescriptor) {
    this._files = files.map(({ path, bytes }) => ({ path, bytes: bytes.slice() }))
    this._defaults = canonicalizeOnelab(defaults)
    this._database = this._defaults
    this._revision = 0
    this._lastResult = undefined
    this._descriptor = descriptor
  }

  edit(name: string, value: number | string) {
    this._database = setParameterValue(this._database, name, value)
    this._revision++
  }

  envelope(action: ProjectEnvelope['action'], sidecar?: PhysicalGroupSidecar): ProjectEnvelope {
    if (!this.ready) throw new Error('project session is not open')
    return {
      schema: 3,
      action,
      projectId: this.projectId,
      revision: this._revision,
      files: this.files,
      database: action === 'reset' ? '' : restoreReadOnlyValues(this._database, this._defaults),
      defaults: this._defaults,
      descriptor: this._descriptor ?? {
        id: 'microstrip', title: 'Electrostatic microstrip', kind: 'solve', source: '', directory: 'microstrip',
        files: ['microstrip.geo', 'microstrip.pro'], geometry: 'microstrip.geo', problem: 'microstrip.pro', dimension: 2,
        scalarType: 'real-double', resolution: 'Ele', postOperations: ['Map'], setNumbers: {}, parameterNames: {},
      },
      sidecar: sidecar ?? { schema: 1, projectId: this._descriptor?.id ?? 'microstrip', groups: [] },
    }
  }

  commit(response: ProjectResponse): { committed: true } | { committed: false; reason: 'foreign-project' | 'stale-revision' } {
    if (response.projectId !== this.projectId) return { committed: false, reason: 'foreign-project' }
    if (response.revision !== this._revision) return { committed: false, reason: 'stale-revision' }
    this._database = canonicalizeOnelab(response.database)
    if (response.action === 'reset') this._defaults = this._database
    if (response.result) this._lastResult = response.result
    return { committed: true }
  }
}
