'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Zap, ChevronRight, Shield } from 'lucide-react'

export default function HomePage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async () => {
    if (code.length !== 4) { setError('El código debe tener 4 dígitos'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data } = await supabase.from('events').select('id').eq('code', parseInt(code)).single()
    if (!data) { setError('Código inválido. Verificá con tu capacitador.'); setLoading(false); return }
    router.push(`/evento/${data.id}`)
  }

  return (
    <div className="min-h-screen bg-game-gradient flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-purple-900/30 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/15 backdrop-blur mb-4 shadow-lg">
            <Zap className="w-8 h-8 text-white" fill="white" />
          </div>
          <h1 className="font-display text-3xl font-bold text-white tracking-tight">Capacitaciones</h1>
          <p className="text-white/60 mt-1 text-sm">Ingresá el código de tu capacitación</p>
        </div>
        <div className="glass rounded-3xl p-8 shadow-2xl shadow-black/20">
          <label className="block text-white/70 text-sm font-medium mb-3 text-center">Código de evento</label>
          <input
            type="tel" inputMode="numeric" maxLength={4} value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="0000"
            className="w-full text-center text-5xl font-display font-bold text-white bg-white/10 border-2 border-white/20 rounded-2xl py-5 px-4 placeholder-white/20 focus:outline-none focus:border-white/50 tracking-[0.3em] transition-all"
          />
          {error && <p className="text-red-300 text-sm text-center mt-3">{error}</p>}
          <button onClick={handleJoin} disabled={loading || code.length !== 4}
            className="w-full mt-5 bg-white text-indigo-600 font-display font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:bg-white/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 text-lg">
            {loading ? <div className="w-5 h-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /> : <><span>Ingresar</span><ChevronRight className="w-5 h-5" /></>}
          </button>
        </div>
        <div className="mt-8 text-center">
          <button onClick={() => router.push('/admin')}
            className="inline-flex items-center gap-2 text-white/50 hover:text-white/80 transition-colors text-sm py-2 px-4 rounded-xl hover:bg-white/5">
            <Shield className="w-4 h-4" />Soy capacitador
          </button>
        </div>
      </div>
    </div>
  )
}
