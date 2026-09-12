// Persisted source identity also protects reopened projects before reconnection.
export function isLocalReportSource(connection, spec) {
  return connection?.kind === 'local-pbip'
    || connection?.localSource?.kind === 'local-pbip'
    || !!spec?._localSource
    || String(connection?.datasetId || '').startsWith('local:')
}
