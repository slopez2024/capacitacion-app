'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Question, QuestionOption, Attendee } from '@/lib/types'
import { Check, X, Clock, Trophy, Star, Zap } from 'lucide-react'

const OPTION_COLORS = [
  { bg: 'bg-red-500 hover:bg-red-600', light: 'bg-red-100', text: 'text-red-700', border: 'border-red-500' },
  { bg: 'bg-blue-500 hover:bg-blue-600', light: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-500' },
  { bg: 'bg-yellow-500 hover:bg-yellow-600', light: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-500' },
  { bg: 'bg-green-500 hover:bg-green-600', light: 'bg-green-100', text: 'text-green-700', border: 'border-green-500' },
]

const OPTION_SHAPES = ['▲', '◆', '●', '■']

interface LeaderboardEntry {
  attendee_id: string
  nombre: string
  apellido: string
  total_points: number
}

export default function JuegoPage() {
  const router = useRouter()
  const params = useParams()
  const eventId = params.eventId as string

  const [attendee, setAttendee] = useState<Attendee | null>(null)
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null)
  const [answered, setAnswered] = useState<string | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const [startTime, setStartTime] = useState<number>(0)
  const [gameEnded, setGameEnded] = useState(false)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [waiting, setWaiting] = useState(true)
  const [questionClosed, setQuestionClosed] = useState(false)
  const [totalPoints, setTotalPoints] = useState(0)
  const lastQuestionIdRef = useRef<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem(`attendee_${eventId}`)
    if (!stored) { router.push(`/evento/${eventId}`); return }
    setAttendee(JSON.parse(stored))
  }, [eventId, router])

  const calculatePoints = useCallback((responseMs: number, timeLimitSeconds: number) => {
    const maxPoints = 1000
    const minPoints = 100
    const ratio = Math.max(0, 1 - responseMs / (timeLimitSeconds * 1000))
    return Math.round(minPoints + (maxPoints - minPoints) * ratio)
  }, [])

  const poll = useCallback(async () => {
    if (!attendee) return
    const supabase = createClient()

    const { data: eventData } = await supabase.from('events').select('is_active').eq('id', eventId).single()
    if (!eventData?.is_active && lastQuestionIdRef.current !== null) {
      // Event ended - load leaderboard
      const { data: answers } = await supabase.from('answers').select('attendee_id, response_time_ms, question_id').eq('event_id', eventId)
      const { data: attendees } = await supabase.from('attendees').select('id, nombre, apellido').eq('event_id', eventId)
      const { data: questions } = await supabase.from('questions').select('id, time_limit_seconds').eq('event_id', eventId)
      const { data: options } = await supabase.from('question_options').select('id, question_id, is_correct').in('question_id', (questions || []).map(q => q.id))

      const scoreMap: Record<string, number> = {}
      for (const ans of (answers || [])) {
        const q = (questions || []).find(q => q.id === ans.question_id)
        const correctOpt = (options || []).find(o => o.question_id === ans.question_id && o.is_correct)
        const attendeeAnswer = await supabase.from('answers').select('option_id').eq('question_id', ans.question_id).eq('attendee_id', ans.attendee_id).single()
        if (correctOpt && attendeeAnswer.data?.option_id === correctOpt.id && q) {
          scoreMap[ans.attendee_id] = (scoreMap[ans.attendee_id] || 0) + calculatePoints(ans.response_time_ms, q.time_limit_seconds)
        }
      }

      const board = (attendees || []).map(a => ({ attendee_id: a.id, nombre: a.nombre, apellido: a.apellido, total_points: scoreMap[a.id] || 0 }))
        .sort((a, b) => b.total_points - a.total_points).slice(0, 5)
      setLeaderboard(board)
      setGameEnded(true)
      if (pollRef.current) clearInterval(pollRef.current)
      return
    }

    const { data: question } = await supabase.from('questions').select('*, question_options(*)').eq('event_id', eventId).eq('is_active', true).single()

    if (question && question.id !== lastQuestionIdRef.current) {
      lastQuestionIdRef.current = question.id
      setActiveQuestion(question)
      setAnswered(null)
      setIsCorrect(null)
      setCorrectOptionId(null)
      setQuestionClosed(false)
      setWaiting(false)
      setTimeLeft(question.time_limit_seconds)
      setStartTime(Date.now())
    } else if (!question) {
      // Check if a question was just closed
      const { data: closedQ } = await supabase.from('questions').select('*, question_options(*)').eq('event_id', eventId).eq('is_closed', true).order('created_at', { ascending: false }).limit(1).single()
      if (closedQ && closedQ.id === lastQuestionIdRef.current && !questionClosed) {
        const correct = closedQ.question_options?.find((o: QuestionOption) => o.is_correct)
        setCorrectOptionId(correct?.id || null)
        setQuestionClosed(true)
        setWaiting(true)
      } else if (!closedQ && lastQuestionIdRef.current === null) {
        setWaiting(true)
      }
    }
  }, [attendee, eventId, questionClosed, calculatePoints])

  useEffect(() => {
    if (!attendee) return
    poll()
    pollRef.current = setInterval(poll, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [attendee, poll])

  // Timer countdown
  useEffect(() => {
    if (!activeQuestion || answered || questionClosed) return
    if (timeLeft <= 0) return
    const timer = setTimeout(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearTimeout(timer)
  }, [timeLeft, activeQuestion, answered, questionClosed])

  const submitAnswer = async (optionId: string) => {
    if (answered || !activeQuestion || !attendee) return
    const responseMs = Date.now() - startTime
    setAnswered(optionId)

    const supabase = createClient()
    const { error } = await supabase.from('answers').insert({
      question_id: activeQuestion.id, attendee_id: attendee.id, event_id: eventId,
      option_id: optionId, response_time_ms: responseMs
    })

    if (!error) {
      const correct = activeQuestion.question_options?.find(o => o.id === optionId)
      const isC = correct?.is_correct || false
      setIsCorrect(isC)
      if (isC) {
        const pts = calculatePoints(responseMs, activeQuestion.time_limit_seconds)
        setTotalPoints(p => p + pts)
      }
    }
  }

  const timerPercent = activeQuestion ? (timeLeft / activeQuestion.time_limit_seconds) * 100 : 0
  const timerColor = timerPercent > 50 ? 'bg-green-400' : timerPercent > 25 ? 'bg-yellow-400' : 'bg-red-400'

  // GAME ENDED - PODIUM
  if (gameEnded) {
    const myRank = leaderboard.findIndex(e => e.attendee_id === attendee?.id) + 1
    return (
      <div className="min-h-screen bg-game-gradient flex flex-col items-center justify-center p-6 text-white">
        <div className="animate-bounce-in text-center w-full max-w-sm">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-300" fill="currentColor" />
          <h1 className="font-display text-3xl font-bold mb-2">¡Fin!</h1>
          {myRank > 0 && myRank <= 5 && (
            <div className="glass rounded-2xl px-6 py-4 mb-6 inline-block">
              <p className="text-white/70 text-sm">Tu posición</p>
              <p className="font-display text-4xl font-bold text-yellow-300">#{myRank}</p>
              <p className="text-white/70 text-sm mt-1">{totalPoints} puntos</p>
            </div>
          )}
          <div className="glass rounded-2xl p-4 space-y-2">
            <p className="text-white/60 text-xs uppercase tracking-wider font-medium mb-3">Top 5</p>
            {leaderboard.map((entry, i) => (
              <div key={entry.attendee_id} className={`flex items-center gap-3 py-2 px-3 rounded-xl ${entry.attendee_id === attendee?.id ? 'bg-white/20' : 'bg-white/5'}`}>
                <span className={`text-lg font-bold w-8 text-center ${i === 0 ? 'text-yellow-300' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-300' : 'text-white/60'}`}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`}</span>
                <span className="flex-1 text-sm font-medium">{entry.nombre} {entry.apellido}</span>
                <span className="text-sm font-bold text-yellow-300">{entry.total_points.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <button onClick={() => router.push('/')} className="mt-6 text-white/60 hover:text-white text-sm transition-colors">Volver al inicio</button>
        </div>
      </div>
    )
  }

  // WAITING
  if (waiting && !activeQuestion) {
    return (
      <div className="min-h-screen bg-game-gradient flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="animate-scale-in">
          <div className="w-20 h-20 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-6">
            <Zap className="w-10 h-10 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">
            {attendee ? `¡Hola, ${attendee.nombre}!` : 'Conectando...'}
          </h1>
          <p className="text-white/60">Esperando que el capacitador inicie una pregunta...</p>
          <div className="flex gap-1.5 justify-center mt-6">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-white/40" style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }} />
            ))}
          </div>
          {totalPoints > 0 && <p className="mt-6 text-white/60 text-sm">Tus puntos: <span className="font-bold text-yellow-300">{totalPoints.toLocaleString()}</span></p>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-game-gradient flex flex-col p-4 text-white">
      {/* Timer bar */}
      {!questionClosed && (
        <div className="w-full bg-white/20 rounded-full h-2 mb-4">
          <div className={`h-2 rounded-full transition-all duration-1000 ${timerColor}`} style={{ width: `${timerPercent}%` }} />
        </div>
      )}

      {/* Question */}
      {activeQuestion && (
        <div className="flex-1 flex flex-col">
          {activeQuestion.image_url && (
            <div className="mb-4 rounded-2xl overflow-hidden max-h-40">
              <img src={activeQuestion.image_url} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="glass rounded-2xl p-5 mb-4 text-center">
            {!questionClosed && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-white/60" />
                <span className="font-display font-bold text-2xl">{timeLeft}</span>
              </div>
            )}
            <p className="font-medium text-lg leading-snug">{activeQuestion.text}</p>
          </div>

          {/* Result after closed */}
          {(questionClosed || answered) && isCorrect !== null && (
            <div className={`rounded-2xl p-4 mb-4 text-center animate-bounce-in ${isCorrect ? 'bg-green-500/30 border border-green-400/50' : 'bg-red-500/30 border border-red-400/50'}`}>
              {isCorrect ? (
                <><div className="text-3xl mb-1">🎉</div><p className="font-bold">¡Correcto! +{calculatePoints(Date.now() - startTime, activeQuestion.time_limit_seconds)} pts</p></>
              ) : (
                <><div className="text-3xl mb-1">❌</div><p className="font-bold">Incorrecto</p></>
              )}
            </div>
          )}

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            {(activeQuestion.question_options || []).sort((a, b) => a.order_num - b.order_num).map((opt, idx) => {
              const color = OPTION_COLORS[idx % OPTION_COLORS.length]
              const isSelected = answered === opt.id
              const isThisCorrect = opt.is_correct && (questionClosed || answered)

              let classes = `answer-option rounded-2xl p-4 text-center font-semibold text-white text-sm transition-all min-h-[80px] flex flex-col items-center justify-center gap-2 `
              if (isThisCorrect) classes += 'bg-green-500 ring-4 ring-green-300 scale-105 '
              else if (isSelected && !opt.is_correct) classes += 'bg-red-500 ring-4 ring-red-300 '
              else if (answered || questionClosed) classes += `${color.bg.split(' ')[0]} opacity-50 `
              else classes += `${color.bg} active:scale-95 cursor-pointer `

              return (
                <button key={opt.id} onClick={() => submitAnswer(opt.id)} disabled={!!answered || questionClosed} className={classes}>
                  <span className="text-2xl">{OPTION_SHAPES[idx]}</span>
                  <span>{opt.text}</span>
                  {isThisCorrect && <Check className="w-5 h-5" />}
                  {isSelected && !opt.is_correct && <X className="w-5 h-5" />}
                </button>
              )
            })}
          </div>

          {!answered && !questionClosed && timeLeft === 0 && (
            <div className="mt-4 text-center glass rounded-2xl p-4">
              <p className="font-bold text-lg">⏰ ¡Se acabó el tiempo!</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
