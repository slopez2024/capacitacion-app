export interface Event {
  id: string
  title: string
  code: number
  is_active: boolean
  created_by: string
  max_attendees: number
  created_at: string
}

export interface Attendee {
  id: string
  event_id: string
  legajo: string
  dni: string
  nombre: string
  apellido: string
  created_at: string
}

export interface Question {
  id: string
  event_id: string
  text: string
  type: 'true_false' | 'multiple_choice'
  image_url: string | null
  time_limit_seconds: number
  is_active: boolean
  is_closed: boolean
  order_num: number
  created_at: string
  question_options?: QuestionOption[]
}

export interface QuestionOption {
  id: string
  question_id: string
  text: string
  is_correct: boolean
  order_num: number
}

export interface Answer {
  id: string
  question_id: string
  attendee_id: string
  event_id: string
  option_id: string | null
  answer_text: string | null
  response_time_ms: number
  created_at: string
}

export interface Winner {
  id: string
  event_id: string
  attendee_id: string
  created_at: string
  attendees?: Attendee
}

export interface LeaderboardEntry {
  attendee_id: string
  nombre: string
  apellido: string
  legajo: string
  total_points: number
  correct_answers: number
}
