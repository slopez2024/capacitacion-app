'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Event } from '@/lib/types'
import { User, CreditCard, Hash, ChevronRight, Zap } from 'lucide-react'

export default function EventoRegistroPage() {
  const router = useRouter()
  const params = useParams()
  const eventId = params.eventId as string

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ legajo: '', dni: '', nombre: '', apellido: '' })

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('events').select('*').eq('id', eventId).single()
      setEvent(data)
      setLoading(false)
    }
    load()
  }, [eventId])

  const handleRegister = async () => {
    if (!form.legajo.trim() || !form.dni.trim() || !form.nombre.trim() || !form.apellido.trim()) {
      setError('Completá todos los campos'); return
    }
    setSubmitting(true)
    setError('')
    const supabase = createClient()
    const { data, error: err } = await supabase.from('attendees').insert({
      event_id: eventId, legajo: form.legajo.trim(), dni: form.dni.trim(),
      nombre: form.nombre.trim(), apellido: form.apellido.trim()
    }).select().single()

    if (err) {
      if (err.code === '23505') setError('Ya estás registrado en este evento con ese DNI o legajo')
      else setError('Error al registrarse. Intentá de nuevo.')
      setSubmitting(false)
      return
    }

    // Store attendee in sessionStorage for game screen
    sessionStorage.setItem(`attendee_${eventId}`, JSON.stringify(data))
    router.push(`/evento/${eventId}/juego`)
  }

  if (loading) return (
    <div className="min-h-screen bg-game-gradient flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
    </div>
  )

  if (!event) return (
    <div className="min-h-screen bg-game-gradient flex items-center justify-center p-6">
      <div className="glass rounded-3xl p-8 text-center">
        <p className="text-white text-lg font-semibold">Evento no encontrado</p>
        <button onClick={() => router.push('/')} className="mt-4 text-white/70 hover:text-white text-sm">Volver al inicio</button>
      </div>
    </div>
  )

  const fields = [
    { key: 'legajo', label: 'Legajo', placeholder: 'Tu número de legajo', icon: Hash, type: 'text' },
    { key: 'dni', label: 'DNI', placeholder: 'Sin puntos ni espacios', icon: CreditCard, type: 'tel' },
    { key: 'nombre', label: 'Nombre', placeholder: 'Tu nombre', icon: User, type: 'text' },
    { key: 'apellido', label: 'Apellido', placeholder: 'Tu apellido', icon: User, type: 'text' },
  ]

  return (
    <div className="min-h-screen bg-game-gradient flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-900/20 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/15 backdrop-blur mb-3">
            <Zap className="w-6 h-6 text-white" fill="white" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">{event.title}</h1>
          <p className="text-white/60 text-sm mt-1">Registrate para participar</p>
        </div>

        <div className="glass rounded-3xl p-6 shadow-2xl">
          <div className="space-y-3">
            {fields.map(({ key, label, placeholder, icon: Icon, type }) => (
              <div key={key}>
                <label className="block text-white/70 text-xs font-medium mb-1">{label}</label>
                <div className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input type={type} inputMode={type === 'tel' ? 'numeric' : 'text'} value={form[key as keyof typeof form]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full pl-9 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-white/50 text-sm transition-all" />
                </div>
              </div>
            ))}
          </div>
          {error && <p className="text-red-300 text-sm mt-3 text-center">{error}</p>}
          <button onClick={handleRegister} disabled={submitting}
            className="w-full mt-5 bg-white text-indigo-600 font-display font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-white/90 transition-all disabled:opacity-50 text-base">
            {submitting ? <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /> : <><span>¡Participar!</span><ChevronRight className="w-5 h-5" /></>}
          </button>
        </div>
      </div>
    </div>
  )
}
