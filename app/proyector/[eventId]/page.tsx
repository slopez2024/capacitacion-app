'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Event, Question, Attendee, Answer } from '@/lib/types'
import { QRCodeSVG } from 'qrcode.react'
import { Trophy, Users, Clock, Zap } from 'lucide-react'

const OPTION_COLORS = ['#EF4444', '#3B82F6', '#EAB308', '#22C55E']
const OPTION_SHAPES = ['▲', '◆', '●', '■']
const OPTION_LABELS = ['A', 'B', 'C', 'D']

interface LeaderboardEntry {
  attendee_id: string
  nombre: string
  apellido: string
  total_points: number
  correct_answers: number
}

export default function ProyectorPage() {
  const params = useParams()
  const eventId = params.eventId as string

  const [event, setEvent] = useState<Event | null>(null)
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [timeLeft, setTimeLeft] = useState(0)
  const [gameEnded, setGameEnded] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [showResults, setShowResults] = useState(false)
  const [answerCounts, setAnswerCounts] = useState<Record<string, number>>({})
  const lastQuestionIdRef = useRef<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const baseUrl = 'https://capacitacionapp.vercel.app'
  const eventUrl = `${baseUrl}/evento/${eventId}`

  const calculatePoints = (responseMs: number, timeLimitSeconds: number) => {
    const maxPoints = 1000; const minPoints = 100
    const ratio = Math.max(0, 1 - responseMs / (timeLimitSeconds * 1000))
    return Math.round(minPoints + (maxPoints - minPoints) * ratio)
  }

  const buildLeaderboard = useCallback(async (answersData: Answer[], questionsData: Question[]) => {
    const supabase = createClient()
    const { data: attendeesData } = await supabase.from('attendees').select('*').eq('event_id', eventId)
    const { data: optionsData } = await supabase.from('question_options').select('*').in('question_id', questionsData.map(q => q.id))

    const scoreMap: Record<string, { points: number; correct: number }> = {}
    for (const ans of answersData) {
      if (!scoreMap[ans.attendee_id]) scoreMap[ans.attendee_id] = { points: 0, correct: 0 }
      const correctOpt = (optionsData || []).find(o => o.question_id === ans.question_id && o.is_correct)
      if (correctOpt && ans.option_id === correctOpt.id) {
        const q = questionsData.find(q => q.id === ans.question_id)
        if (q) {
          scoreMap[ans.attendee_id].points += calculatePoints(ans.response_time_ms, q.time_limit_seconds)
          scoreMap[ans.attendee_id].correct++
        }
      }
    }

    return (attendeesData || []).map(a => ({
      attendee_id: a.id, nombre: a.nombre, apellido: a.apellido,
      total_points: scoreMap[a.id]?.points || 0, correct_answers: scoreMap[a.id]?.correct || 0
    })).sort((a, b) => b.total_points - a.total_points).slice(0, 5)
  }, [eventId])

  const poll = useCallback(async () => {
    const supabase = createClient()
    const { data: eventData } = await supabase.from('events').select('*').eq('id', eventId).single()
    setEvent(eventData)

    const { data: atts } = await supabase.from('attendees').select('*').eq('event_id', eventId).order('legajo')
    setAttendees(atts || [])

    if (!eventData?.is_active && lastQuestionIdRef.current !== null) {
      // Event ended
      const { data: allAnswers } = await supabase.from('answers').select('*').eq('event_id', eventId)
      const { data: allQuestions } = await supabase.from('questions').select('*').eq('event_id', eventId)
      const board = await buildLeaderboard(allAnswers || [], allQuestions || [])
      setLeaderboard(board)
      setGameEnded(true)
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    const { data: question } = await supabase.from('questions').select('*, question_options(*)').eq('event_id', eventId).eq('is_active', true).single()

    if (question && question.id !== lastQuestionIdRef.current) {
      lastQuestionIdRef.current = question.id
      setActiveQuestion(question)
      setShowResults(false)
      setAnswerCounts({})
      setTimeLeft(question.time_limit_seconds)
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current!); return 0 } return t - 1 }), 1000)
    } else if (!question && lastQuestionIdRef.current) {
      // Question closed - show results
      const { data: closedQ } = await supabase.from('questions').select('*, question_options(*)').eq('id', lastQuestionIdRef.current).single()
      if (closedQ?.is_closed) {
        const { data: qAnswers } = await supabase.from('answers').select('*').eq('question_id', lastQuestionIdRef.current)
        const counts: Record<string, number> = {}
        for (const ans of (qAnswers || [])) { if (ans.option_id) counts[ans.option_id] = (counts[ans.option_id] || 0) + 1 }
        setAnswerCounts(counts)
        setShowResults(true)
        setActiveQuestion(closedQ)
        if (timerRef.current) clearInterval(timerRef.current)
      }
    }

    // Live answer count
    if (question) {
      const { data: qAnswers } = await supabase.from('answers').select('option_id').eq('question_id', question.id)
      const counts: Record<string, number> = {}
      for (const ans of (qAnswers || [])) { if (ans.option_id) counts[ans.option_id] = (counts[ans.option_id] || 0) + 1 }
      setAnswerCounts(counts)
    }
  }, [eventId, buildLeaderboard])

  useEffect(() => {
    poll()
    pollRef.current = setInterval(poll, 2000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [poll])

  const timerPercent = activeQuestion ? (timeLeft / activeQuestion.time_limit_seconds) * 100 : 0
  const totalAnswers = Object.values(answerCounts).reduce((a, b) => a + b, 0)

  // LOBBY
  if (!activeQuestion && !gameEnded) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex">
        {/* Left: QR & Code */}
        <div className="w-1/3 border-r border-white/10 flex flex-col items-center justify-center p-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 mb-4">
              <Zap className="w-6 h-6 text-white" fill="white" />
            </div>
            <h1 className="font-display text-3xl font-bold">{event?.title || 'Cargando...'}</h1>
          </div>
          <div className="bg-white p-4 rounded-2xl mb-6 shadow-2xl shadow-indigo-900/30">
            <QRCodeSVG value={eventUrl} size={200} />
          </div>
          <p className="text-white/40 text-sm mb-2 uppercase tracking-wider">Código de acceso</p>
          <div className="font-display text-7xl font-bold text-white tracking-widest">{event?.code || '----'}</div>
          <p className="text-white/30 text-sm mt-4">Escaneá el QR o ingresá el código</p>
        </div>

        {/* Right: Attendee list */}
        <div className="flex-1 flex flex-col p-8">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="font-display text-xl font-semibold text-white/80">Asistentes registrados</h2>
            <span className="ml-auto text-4xl font-display font-bold text-indigo-400">{attendees.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2 content-start">
            {attendees.map((a) => (
              <div key={a.id} className="glass rounded-xl px-3 py-2 flex items-center gap-2 animate-fade-up">
                <div className="w-7 h-7 rounded-lg bg-indigo-600/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-indigo-300">{a.nombre.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{a.nombre} {a.apellido}</p>
                  <p className="text-xs text-white/40">Leg. {a.legajo}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // PODIUM
  if (gameEnded) {
    const medals = ['🥇', '🥈', '🥉']
    const podiumOrder = [1, 0, 2] // 2nd, 1st, 3rd display order
    const heights = ['h-36', 'h-48', 'h-28']
    const podiumColors = ['from-gray-400 to-gray-500', 'from-yellow-400 to-yellow-600', 'from-orange-400 to-orange-600']

    return (
      <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="absolute text-2xl animate-bounce" style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 2}s`, opacity: 0.3 }}>
              {['⭐', '🎉', '✨', '🏆'][Math.floor(Math.random() * 4)]}
            </div>
          ))}
        </div>
        <Trophy className="w-16 h-16 text-yellow-400 mb-4 animate-bounce-in" fill="currentColor" />
        <h1 className="font-display text-5xl font-bold mb-12 text-center">¡Top 5 Ganadores!</h1>
        
        {/* Podium */}
        <div className="flex items-end gap-4 mb-12">
          {podiumOrder.map((rankIdx, position) => {
            const entry = leaderboard[rankIdx]
            if (!entry) return <div key={position} className="w-40" />
            return (
              <div key={entry.attendee_id} className="flex flex-col items-center w-40">
                <div className="text-4xl mb-2 animate-bounce-in" style={{ animationDelay: `${position * 0.2}s` }}>{medals[rankIdx]}</div>
                <p className="text-sm font-semibold text-white text-center mb-1">{entry.nombre}</p>
                <p className="text-xs text-white/40 text-center mb-2">{entry.apellido}</p>
                <p className="font-display font-bold text-yellow-400 text-lg mb-2">{entry.total_points.toLocaleString()}</p>
                <div className={`w-full ${heights[position]} rounded-t-2xl bg-gradient-to-b ${podiumColors[position]} flex items-center justify-center`}>
                  <span className="font-display font-bold text-4xl text-white">{rankIdx + 1}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Positions 4-5 */}
        <div className="flex gap-4">
          {leaderboard.slice(3).map((entry, i) => (
            <div key={entry.attendee_id} className="glass rounded-2xl px-6 py-3 text-center">
              <p className="text-white/40 text-sm">#{i + 4}</p>
              <p className="font-semibold">{entry.nombre} {entry.apellido}</p>
              <p className="text-indigo-400 font-bold">{entry.total_points.toLocaleString()}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ACTIVE QUESTION
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white flex flex-col p-6">
      {/* Top bar */}
      <div className="flex items-center gap-4 mb-4">
        <div className="glass rounded-xl px-4 py-2 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold">{attendees.length} jugadores</span>
        </div>
        <div className="flex-1 bg-white/10 rounded-full h-3">
          <div className={`h-3 rounded-full transition-all duration-1000 ${timerPercent > 50 ? 'bg-green-500' : timerPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${timerPercent}%` }} />
        </div>
        <div className="glass rounded-xl px-4 py-2 flex items-center gap-2">
          <Clock className="w-4 h-4 text-white/60" />
          <span className="font-display font-bold text-3xl">{timeLeft}</span>
        </div>
      </div>

      {/* Question */}
      <div className="glass rounded-2xl p-6 mb-4 text-center">
        {activeQuestion?.image_url && (
          <img src={activeQuestion.image_url} alt="" className="max-h-48 mx-auto rounded-xl mb-4 object-contain" />
        )}
        <p className="font-display text-3xl font-bold leading-tight">{activeQuestion?.text}</p>
        <div className="flex items-center justify-center gap-3 mt-3 text-white/40 text-sm">
          <span>{totalAnswers} respuestas</span>
          {showResults && <span className="text-green-400 font-medium">● Cerrada</span>}
        </div>
      </div>

      {/* Options */}
      <div className="grid grid-cols-2 gap-4 flex-1">
        {(activeQuestion?.question_options || []).sort((a, b) => a.order_num - b.order_num).map((opt, idx) => {
          const count = answerCounts[opt.id] || 0
          const percent = totalAnswers > 0 ? (count / totalAnswers) * 100 : 0
          const isCorrect = showResults && opt.is_correct

          return (
            <div key={opt.id} className={`rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between transition-all ${isCorrect ? 'ring-4 ring-green-400' : ''}`}
              style={{ backgroundColor: OPTION_COLORS[idx % OPTION_COLORS.length] + '33', borderColor: OPTION_COLORS[idx % OPTION_COLORS.length], border: '2px solid' }}>
              {/* Bar fill */}
              <div className="absolute inset-0 rounded-2xl transition-all duration-500 ease-out opacity-40"
                style={{ backgroundColor: OPTION_COLORS[idx % OPTION_COLORS.length], width: `${percent}%` }} />
              <div className="relative flex items-center gap-3">
                <span className="text-3xl">{OPTION_SHAPES[idx]}</span>
                <span className="font-semibold text-xl flex-1">{opt.text}</span>
                {isCorrect && <span className="text-3xl">✓</span>}
              </div>
              <div className="relative flex items-center justify-between mt-3">
                <span className="text-white/60 text-sm">{count} resp.</span>
                <span className="font-display font-bold text-2xl">{Math.round(percent)}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
 
