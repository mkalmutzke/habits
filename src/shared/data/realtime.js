import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'
import { TABLES } from './tables.js'
import { refreshWhenIdle } from './refresh.js'

// Live updates between devices: the database sends every change of this user's
// rows to the private topic "user:<id>" (migration v2_foundation). Only the
// owner may listen there (row level security on realtime.messages).
// On a message the affected table is simply loaded again.
//
// status: 'connecting' | 'live' | 'off'
export function useRealtime(userId) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('connecting')

  useEffect(() => {
    let channel
    let cancelled = false

    async function connect() {
      await supabase.realtime.setAuth()
      if (cancelled) return
      channel = supabase.channel(`user:${userId}`, { config: { private: true } })
      for (const event of ['INSERT', 'UPDATE', 'DELETE']) {
        channel.on('broadcast', { event }, ({ payload }) => {
          const table = payload?.table
          if (table in TABLES) refreshWhenIdle(queryClient, [table])
        })
      }
      channel.subscribe((state) => {
        if (state === 'SUBSCRIBED') {
          setStatus('live')
          // changes may have been missed while disconnected
          queryClient.invalidateQueries()
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
          setStatus('off')
        }
      })
    }

    connect()
    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [userId, queryClient])

  return status
}
