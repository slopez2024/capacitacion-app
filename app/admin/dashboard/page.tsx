'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Event } from '@/lib/types'
import { Plus, LogOut, Zap, Monitor, Edit2, Trash2, Users, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [maxAttendees, setMaxAttendees] = useState(100)
  const [creating, setCreating] = useState(false)

  const loadEvents = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/admin'); return }
    const { data } = await supabase.from('events').select('*').eq('created_by', user.id).order('created_at', { ascending: false })
    setEvents(data || [])
    setLoading(false)
  }, [router])

  useEffect(() => { loadEvents() }, [loadEvents])

  const createEvent = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const code = Math.floor(1000 + Math.random() * 9000)
    const { error } = await supabase.from('events').insert({ title: newTitle.trim(), code, created_by: user.id, max_attendees: maxAttendees })
    if (error) { toast.error('Error al crear el evento'); setCreating(false); return }
    toast.success('Evento creado!')
    setNewTitle('')
    setShowCreate(false)
    setCreating(false)
    loadEvents()
  }

  const deleteEvent = async (id: string) => {
    if (!confirm('¿Eliminar este evento? Se borrarán todos los datos.')) return
    const supabase = createClient()
    await supabase.from('events').delete().eq('id', id)
    toast.success('Evento eliminado')
    loadEvents()
  }

  const logout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" fill="white" />
            </div>
            <h1 className="font-display text-xl font-bold text-gray-900">Mis Eventos</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm">
              <Plus className="w-4 h-4" />Nuevo evento
            </button>
            <button onClick={logout} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-gray-900">Nuevo Evento</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nombre del evento</label>
                <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createEvent()}
                  placeholder="Ej: Seguridad Industrial 2025"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Máx. asistentes</label>
                <input type="number" value={maxAttendees} onChange={(e) => setMaxAttendees(parseInt(e.target.value) || 100)} min={1} max={500}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-sm font-medium">Cancelar</button>
              <button onClick={createEvent} disabled={creating || !newTitle.trim()}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold">
                {creating ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events list */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="font-display text-lg font-semibold text-gray-800">Sin eventos aún</h3>
            <p className="text-gray-500 text-sm mt-1">Creá tu primer evento de capacitación</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <div key={event.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-6 group">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-display font-semibold text-gray-900 line-clamp-2">{event.title}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-2xl font-display font-bold text-indigo-600">{event.code}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${event.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {event.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 mb-4">
                  <Users className="w-3.5 h-3.5" />
                  <span>Hasta {event.max_attendees} asistentes</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => router.push(`/admin/eventos/${event.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 py-2 rounded-xl text-sm font-medium transition-all">
                    <Edit2 className="w-3.5 h-3.5" />Gestionar
                  </button>
                  <button onClick={() => router.push(`/proyector/${event.id}`)}
                    className="flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 px-3 rounded-xl text-sm font-medium transition-all">
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteEvent(event.id)}
                    className="flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 py-2 px-3 rounded-xl text-sm transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
