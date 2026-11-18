import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { localOnly, remove, update } from '../../shared/data/changes.js'
import { useSave, useTable } from '../../shared/data/hooks.js'
import { supabase } from '../../shared/data/supabaseClient.js'
import { latestReports } from './serverStatus.js'

// The address the health agent sends its reports to (Edge Function server-ingest).
export const INGEST_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/server-ingest`
// The installer, from this repository (public).
export const INSTALL_URL = 'https://raw.githubusercontent.com/mkalmutzke/habits/main/scripts/server-agent/install.sh'

// The user's servers (v3.8) and their reports (written by server-ingest; the
// app only reads them). Adding a server and a new agent token go through
// database functions, which hand the token back once.
export function useServers() {
  const serverRows = useTable('servers')
  const reportRows = useTable('server_reports')
  const save = useSave()
  const queryClient = useQueryClient()
  // in the order they were added
  const servers = useMemo(() => [...serverRows.rows].sort((a, b) => a.created_at.localeCompare(b.created_at)), [serverRows.rows])
  const latest = useMemo(() => latestReports(reportRows.rows), [reportRows.rows])

  // → { id, token } (the token only now), or throws
  async function addServer(name, provider) {
    const { data, error } = await supabase.rpc('add_server', { server_name: name, server_provider: provider })
    if (error) throw error
    await queryClient.invalidateQueries({ queryKey: ['servers'] })
    return data
  }

  // → the new token; the old one stops working at once
  async function renewToken(id) {
    const { data, error } = await supabase.rpc('renew_server_token', { server: id })
    if (error) throw error
    return data
  }

  // values: { name, provider, cpu_warn, memory_warn, disk_warn } (any of them)
  function editServer(id, values) {
    save(update('servers', id, values))
  }

  // its reports go with it (the database does that by itself)
  function deleteServer(id) {
    save([remove('servers', id), localOnly(remove('server_reports', { server_id: id }))])
  }

  return {
    servers,
    reports: reportRows.rows,
    latest,
    loading: serverRows.loading || reportRows.loading,
    addServer,
    renewToken,
    editServer,
    deleteServer,
  }
}
