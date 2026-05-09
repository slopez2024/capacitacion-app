'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Event, Question, QuestionOption, Attendee, Answer, Winner } from '@/lib/types'
import { ArrowLeft, Plus, Trash2, Edit2, Monitor, Download, Shuffle, Play, Square, ChevronUp, ChevronDown, Image as ImageIcon, X, Check, RotateCcw, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'
import Papa from 'papaparse'

type Tab = 'preguntas' | 'asistentes' | 'exportar' | 'sorteo'

export default function EventoAdminPage() {
  const router = useRouter()
  const params = useParams()
  const eventId = params.eventId as string

  const [event, setEvent] = useState<Event | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [winners, setWinners] = useState<Winner[]>([])
  const [tab, setTab] = useState<Tab>('preguntas')
  const [loading, setLoading] = useState(true)
  const [showQuestionForm, setShowQuestionForm] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null)
  const [spinningWinner, setSpinningWinner] = useState(false)
  const [lastWinner, setLastWinner] = useState<Attendee | null>(null)

  // Question form state
  const [qText, setQText] = useState('')
  const [qType, setQType] = useState<'true_false' | 'multiple_choice'>('multiple_choice')
  const [qTime, setQTime] = useState(2)
  const [qOptions, setQOptions] = useState([
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
    { text: '', is_correct: false },
  ])
  const [qImage, setQImage] = useState<File | null>(null)
  const [qImageUrl, setQImageUrl] = useState('')
  const [savingQ, setSavingQ] = useState(false)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const [evRes, qRes, atRes, anRes, wRes] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).single(),
      supabase.from('questions').select('*, question_options(*)').eq('event_id', eventId).order('order_num'),
      supabase.from('attendees').select('*').eq('event_id', eventId).order('legajo'),
      supabase.from('answers').select('*').eq('event_id', eventId),
      supabase.from('winners').select('*, attendees(*)').eq('event_id', eventId),
    ])
    setEvent(evRes.data)
    setQuestions(qRes.data || [])
    setAttendees(atRes.data || [])
    setAnswers(anRes.data || [])
    setWinners(wRes.data || [])
    setLoading(false)
  }, [eventId])

  useEffect(() => { loadData() }, [loadData])

  const resetQuestionForm = () => {
    setQText(''); setQType('multiple_choice'); setQTime(2); setQImageUrl(''); setQImage(null)
    setQOptions([{ text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }])
    setEditingQuestion(null)
  }

  const openEditQuestion = (q: Question) => {
    setEditingQuestion(q)
    setQText(q.text)
    setQType(q.type)
    setQTime(q.time_limit_seconds / 60)
    setQImageUrl(q.image_url || '')
    if (q.type === 'true_false') {
      setQOptions([
        { text: 'Verdadero', is_correct: q.question_options?.find(o => o.text === 'Verdadero')?.is_correct || false },
        { text: 'Falso', is_correct: q.question_options?.find(o => o.text === 'Falso')?.is_correct || false },
      ])
    } else {
      const opts = (q.question_options || []).sort((a, b) => a.order_num - b.order_num)
      setQOptions(opts.length ? opts.map(o => ({ text: o.text, is_correct: o.is_correct })) : [{ text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }])
    }
    setShowQuestionForm(true)
  }

  const handleTypeChange = (type: 'true_false' | 'multiple_choice') => {
    setQType(type)
    if (type === 'true_false') {
      setQOptions([{ text: 'Verdadero', is_correct: false }, { text: 'Falso', is_correct: false }])
    } else {
      setQOptions([{ text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }, { text: '', is_correct: false }])
    }
  }

  const saveQuestion = async () => {
    if (!qText.trim()) { toast.error('Ingresá el texto de la pregunta'); return }
    const validOptions = qType === 'true_false' ? qOptions : qOptions.filter(o => o.text.trim())
    if (validOptions.length < 2) { toast.error('Necesitás al menos 2 opciones'); return }
    if (!validOptions.some(o => o.is_correct)) { toast.error('Marcá la respuesta correcta'); return }

    setSavingQ(true)
    const supabase = createClient()
    let imageUrl = qImageUrl

    if (qImage) {
      const ext = qImage.name.split('.').pop()
      const path = `${eventId}/${Date.now()}.${ext}`
      const { data: uploadData } = await supabase.storage.from('question-images').upload(path, qImage)
      if (uploadData) {
        const { data: { publicUrl } } = supabase.storage.from('question-images').getPublicUrl(path)
        imageUrl = publicUrl
      }
    }

    if (editingQuestion) {
      await supabase.from('questions').update({ text: qText.trim(), type: qType, time_limit_seconds: qTime * 60, image_url: imageUrl || null }).eq('id', editingQuestion.id)
      await supabase.from('question_options').delete().eq('question_id', editingQuestion.id)
      const opts = (qType === 'true_false' ? qOptions : validOptions).map((o, i) => ({ question_id: editingQuestion.id, text: o.text, is_correct: o.is_correct, order_num: i }))
      await supabase.from('question_options').insert(opts)
      toast.success('Pregunta actualizada')
    } else {
      const maxOrder = questions.length > 0 ? Math.max(...questions.map(q => q.order_num)) + 1 : 0
      const { data: newQ } = await supabase.from('questions').insert({ event_id: eventId, text: qText.trim(), type: qType, time_limit_seconds: qTime * 60, image_url: imageUrl || null, order_num: maxOrder }).select().single()
      if (newQ) {
        const opts = (qType === 'true_false' ? qOptions : validOptions).map((o, i) => ({ question_id: newQ.id, text: o.text, is_correct: o.is_correct, order_num: i }))
        await supabase.from('question_options').insert(opts)
      }
      toast.success('Pregunta creada')
    }

    resetQuestionForm()
    setShowQuestionForm(false)
    setSavingQ(false)
    loadData()
  }

  const deleteQuestion = async (id: string) => {
    if (!confirm('¿Eliminar esta pregunta?')) return
    const supabase = createClient()
    await supabase.from('questions').delete().eq('id', id)
    toast.success('Pregunta eliminada')
    loadData()
  }

  const activateQuestion = async (q: Question) => {
    const supabase = createClient()
    await supabase.from('questions').update({ is_active: false, is_closed: false }).eq('event_id', eventId)
    await supabase.from('questions').update({ is_active: true, is_closed: false }).eq('id', q.id)
    await supabase.from('events').update({ is_active: true }).eq('id', eventId)
    toast.success(`Pregunta "${q.text.substring(0, 30)}..." activada`)
    loadData()
  }

  const closeQuestion = async (q: Question) => {
    const supabase = createClient()
    await supabase.from('questions').update({ is_active: false, is_closed: true }).eq('id', q.id)
    toast.success('Pregunta cerrada')
    loadData()
  }

  const endEvent = async () => {
    if (!confirm('¿Finalizar la capacitación? Se mostrará el podio.')) return
    const supabase = createClient()
    await supabase.from('questions').update({ is_active: false }).eq('event_id', eventId)
    await supabase.from('events').update({ is_active: false }).eq('id', eventId)
    toast.success('Capacitación finalizada')
    loadData()
  }

  const resetEvent = async () => {
    if (!confirm('¿Resetear el evento? Se borrarán todas las respuestas, asistentes y ganadores.')) return
    const supabase = createClient()
    await supabase.from('answers').delete().eq('event_id', eventId)
    await supabase.from('attendees').delete().eq('event_id', eventId)
    await supabase.from('winners').delete().eq('event_id', eventId)
    await supabase.from('questions').update({ is_active: false, is_closed: false }).eq('event_id', eventId)
    await supabase.from('events').update({ is_active: false }).eq('id', eventId)
    toast.success('Evento reseteado')
    loadData()
  }

  const spinWinner = async () => {
    const existingWinnerIds = winners.map(w => w.attendee_id)
    const eligible = attendees.filter(a => !existingWinnerIds.includes(a.id))
    if (eligible.length === 0) { toast.error('No hay más asistentes sin premio'); return }
    setSpinningWinner(true)
    await new Promise(r => setTimeout(r, 2000))
    const winner = eligible[Math.floor(Math.random() * eligible.length)]
    const supabase = createClient()
    await supabase.from('winners').insert({ event_id: eventId, attendee_id: winner.id })
    setLastWinner(winner)
    setSpinningWinner(false)
    toast.success(`🎉 Ganador: ${winner.nombre} ${winner.apellido}`)
    loadData()
  }

  const exportCSV = () => {
    const rows = attendees.map(a => {
      const aAnswers = answers.filter(ans => ans.attendee_id === a.id)
      return { Legajo: a.legajo, DNI: a.dni, Nombre: a.nombre, Apellido: a.apellido, Respuestas: aAnswers.length, Fecha: new Date(a.created_at).toLocaleDateString('es-AR') }
    })
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${event?.title}_asistentes.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
  if (!event) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-500">Evento no encontrado</p></div>

  const optionColors = ['bg-red-500', 'bg-blue-500', 'bg-yellow-500', 'bg-green-500']

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/admin/dashboard')} className="p-2 hover:bg-gray-100 rounded-xl transition-all">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="font-display text-lg font-bold text-gray-900">{event.title}</h1>
                <p className="text-sm text-gray-500">Código: <span className="font-bold text-indigo-600">{event.code}</span> · {attendees.length} asistentes</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => window.open(`/proyector/${eventId}`, '_blank')}
                className="flex items-center gap-1.5 bg-gray-900 hover:bg-gray-800 text-white px-3 py-2 rounded-xl text-sm font-medium">
                <Monitor className="w-4 h-4" />Proyector
              </button>
              <button onClick={endEvent} className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-xl text-sm font-medium">
                <Square className="w-4 h-4" />Finalizar
              </button>
              <button onClick={resetEvent} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* Tabs */}
          <div className="flex gap-1">
            {(['preguntas', 'asistentes', 'exportar', 'sorteo'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${tab === t ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
                {t === 'preguntas' ? `Preguntas (${questions.length})` : t === 'asistentes' ? `Asistentes (${attendees.length})` : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* PREGUNTAS TAB */}
        {tab === 'preguntas' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-lg font-semibold text-gray-800">Preguntas</h2>
              <button onClick={() => { resetQuestionForm(); setShowQuestionForm(true) }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold">
                <Plus className="w-4 h-4" />Agregar pregunta
              </button>
            </div>
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div key={q.id} className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${q.is_active ? 'border-indigo-300 shadow-indigo-100' : q.is_closed ? 'border-gray-200 opacity-75' : 'border-gray-100'}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${q.is_active ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{idx + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 flex-1">{q.text}</p>
                        {q.is_active && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">● Activa</span>}
                        {q.is_closed && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Cerrada</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span>{q.type === 'true_false' ? 'Verdadero/Falso' : 'Opción múltiple'}</span>
                        <span>·</span>
                        <span>{q.time_limit_seconds / 60} min</span>
                        {q.image_url && <><span>·</span><span className="flex items-center gap-1"><ImageIcon className="w-3 h-3" />Con imagen</span></>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {q.question_options?.map(opt => (
                          <span key={opt.id} className={`text-xs px-2 py-0.5 rounded-lg ${opt.is_correct ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-100 text-gray-500'}`}>
                            {opt.is_correct && <Check className="w-3 h-3 inline mr-0.5" />}{opt.text}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!q.is_active && !q.is_closed && (
                        <button onClick={() => activateQuestion(q)} className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-xl transition-all" title="Activar">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {q.is_active && (
                        <button onClick={() => closeQuestion(q)} className="p-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-xl transition-all" title="Cerrar">
                          <Square className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => openEditQuestion(q)} className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-600 rounded-xl transition-all">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteQuestion(q.id)} className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {questions.length === 0 && (
                <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
                  <p className="text-gray-400 text-sm">Sin preguntas todavía. Agregá la primera.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ASISTENTES TAB */}
        {tab === 'asistentes' && (
          <div>
            <h2 className="font-display text-lg font-semibold text-gray-800 mb-4">Asistentes ({attendees.length})</h2>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {attendees.length === 0 ? (
                <div className="text-center py-16"><p className="text-gray-400 text-sm">Aún no hay asistentes registrados</p></div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Legajo', 'DNI', 'Nombre', 'Apellido', 'Respuestas'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {attendees.map(a => (
                      <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.legajo}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{a.dni}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{a.nombre}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{a.apellido}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{answers.filter(ans => ans.attendee_id === a.id).length}/{questions.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* EXPORTAR TAB */}
        {tab === 'exportar' && (
          <div>
            <h2 className="font-display text-lg font-semibold text-gray-800 mb-4">Exportar datos</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                  <Download className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Asistentes</h3>
                <p className="text-sm text-gray-500 mb-4">Lista de todos los asistentes con sus datos y cantidad de respuestas.</p>
                <button onClick={exportCSV} className="w-full bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl text-sm font-medium">
                  Descargar CSV
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <Download className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Respuestas</h3>
                <p className="text-sm text-gray-500 mb-4">Detalle de todas las respuestas por asistente y pregunta.</p>
                <button onClick={() => {
                  const rows = answers.map(a => {
                    const att = attendees.find(at => at.id === a.attendee_id)
                    const q = questions.find(q => q.id === a.question_id)
                    return { Legajo: att?.legajo, Nombre: att?.nombre, Apellido: att?.apellido, Pregunta: q?.text, Respuesta: a.answer_text || a.option_id, TiempoMs: a.response_time_ms }
                  })
                  const csv = Papa.unparse(rows)
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const link = document.createElement('a')
                  link.href = url; link.download = `${event?.title}_respuestas.csv`; link.click()
                }} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-medium">
                  Descargar CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SORTEO TAB */}
        {tab === 'sorteo' && (
          <div>
            <h2 className="font-display text-lg font-semibold text-gray-800 mb-4">Sorteo de Ganadores</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm text-center">
                {spinningWinner ? (
                  <div className="py-8">
                    <div className="w-20 h-20 mx-auto mb-4 relative">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 animate-spin-slow flex items-center justify-center">
                        <Shuffle className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <p className="font-display font-bold text-xl text-gray-800">Sorteando...</p>
                    <p className="text-gray-400 text-sm mt-1">{attendees.length - winners.length} participantes elegibles</p>
                  </div>
                ) : lastWinner ? (
                  <div className="py-4 animate-bounce-in">
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-200">
                      <Trophy className="w-10 h-10 text-white" />
                    </div>
                    <p className="text-gray-500 text-sm mb-1">¡Ganador!</p>
                    <p className="font-display font-bold text-2xl text-gray-900">{lastWinner.nombre} {lastWinner.apellido}</p>
                    <p className="text-indigo-600 font-medium mt-1">Legajo: {lastWinner.legajo}</p>
                  </div>
                ) : (
                  <div className="py-8">
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                      <Shuffle className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="font-display font-bold text-xl text-gray-800">Sorteo de premios</p>
                    <p className="text-gray-400 text-sm mt-1">{attendees.length} asistentes · {winners.length} ya ganaron</p>
                  </div>
                )}
                <button onClick={spinWinner} disabled={spinningWinner || attendees.length === 0 || attendees.length === winners.length}
                  className="mt-4 w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50 transition-all shadow-lg shadow-indigo-200">
                  {spinningWinner ? 'Sorteando...' : '🎲 Sortear Ganador'}
                </button>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-800 mb-3">Ganadores anteriores ({winners.length})</h3>
                {winners.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">Sin ganadores aún</p>
                ) : (
                  <div className="space-y-2">
                    {(winners as any[]).map((w, i) => (
                      <div key={w.id} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-xl">
                        <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <span className="text-sm font-medium text-gray-800">{w.attendees?.nombre} {w.attendees?.apellido}</span>
                        <span className="text-xs text-gray-400 ml-auto">Leg. {w.attendees?.legajo}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Question Form Modal */}
      {showQuestionForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl my-8 animate-scale-in">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-display text-xl font-bold text-gray-900">{editingQuestion ? 'Editar pregunta' : 'Nueva pregunta'}</h2>
              <button onClick={() => { setShowQuestionForm(false); resetQuestionForm() }} className="p-2 hover:bg-gray-100 rounded-xl"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Type selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de pregunta</label>
                <div className="grid grid-cols-2 gap-2">
                  {[['multiple_choice', 'Opción múltiple'], ['true_false', 'Verdadero / Falso']].map(([v, l]) => (
                    <button key={v} onClick={() => handleTypeChange(v as any)}
                      className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${qType === v ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Question text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pregunta</label>
                <textarea value={qText} onChange={(e) => setQText(e.target.value)} rows={2}
                  placeholder="Escribí la pregunta..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none" />
              </div>
              {/* Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tiempo ({qTime} minuto{qTime !== 1 ? 's' : ''})</label>
                <input type="range" min={1} max={10} value={qTime} onChange={(e) => setQTime(parseInt(e.target.value))}
                  className="w-full accent-indigo-600" />
                <div className="flex justify-between text-xs text-gray-400 mt-1"><span>1 min</span><span>10 min</span></div>
              </div>
              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Imagen (opcional)</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-gray-100 border border-gray-200 px-4 py-2.5 rounded-xl text-sm text-gray-600 transition-all">
                    <ImageIcon className="w-4 h-4" />Subir imagen
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) { setQImage(e.target.files[0]); setQImageUrl(URL.createObjectURL(e.target.files[0])) } }} />
                  </label>
                  {qImageUrl && <img src={qImageUrl} alt="" className="h-10 w-16 object-cover rounded-lg border border-gray-200" />}
                  {qImageUrl && <button onClick={() => { setQImage(null); setQImageUrl('') }} className="text-red-400 hover:text-red-600 p-1"><X className="w-4 h-4" /></button>}
                </div>
              </div>
              {/* Options */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Opciones (marcá la correcta)</label>
                  {qType === 'multiple_choice' && qOptions.length < 6 && (
                    <button onClick={() => setQOptions([...qOptions, { text: '', is_correct: false }])} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">+ Agregar opción</button>
                  )}
                </div>
                <div className="space-y-2">
                  {qOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${optionColors[idx % optionColors.length]}`}>{String.fromCharCode(65 + idx)}</div>
                      <input value={opt.text} onChange={(e) => { const n = [...qOptions]; n[idx].text = e.target.value; setQOptions(n) }}
                        placeholder={qType === 'true_false' ? opt.text : `Opción ${String.fromCharCode(65 + idx)}`}
                        disabled={qType === 'true_false'}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50" />
                      <button onClick={() => { const n = [...qOptions]; n[idx].is_correct = !n[idx].is_correct; setQOptions(n) }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${opt.is_correct ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                        <Check className="w-4 h-4" />
                      </button>
                      {qType === 'multiple_choice' && qOptions.length > 2 && (
                        <button onClick={() => setQOptions(qOptions.filter((_, i) => i !== idx))} className="text-gray-300 hover:text-red-400 transition-colors"><X className="w-4 h-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => { setShowQuestionForm(false); resetQuestionForm() }} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 text-sm font-medium">Cancelar</button>
              <button onClick={saveQuestion} disabled={savingQ}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-semibold">
                {savingQ ? 'Guardando...' : editingQuestion ? 'Actualizar' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
