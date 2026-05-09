-- ============================================
-- CAPACITACIONES APP - SUPABASE MIGRATION
-- Run this in the Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  code int4 UNIQUE NOT NULL,
  is_active bool DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  max_attendees int4 DEFAULT 100,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendees (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  legajo text NOT NULL,
  dni text NOT NULL,
  nombre text NOT NULL,
  apellido text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, dni),
  UNIQUE(event_id, legajo)
);

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  text text NOT NULL,
  type text NOT NULL CHECK (type IN ('true_false', 'multiple_choice')),
  image_url text,
  time_limit_seconds int4 DEFAULT 60,
  is_active bool DEFAULT false,
  is_closed bool DEFAULT false,
  order_num int4 DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS question_options (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_correct bool DEFAULT false,
  order_num int4 DEFAULT 0
);

CREATE TABLE IF NOT EXISTS answers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  attendee_id uuid REFERENCES attendees(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  option_id uuid REFERENCES question_options(id) ON DELETE SET NULL,
  answer_text text,
  response_time_ms int4 DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(question_id, attendee_id)
);

CREATE TABLE IF NOT EXISTS winners (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  attendee_id uuid REFERENCES attendees(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE winners ENABLE ROW LEVEL SECURITY;

-- EVENTS policies
CREATE POLICY "anon can read events" ON events FOR SELECT TO anon USING (true);
CREATE POLICY "auth can manage own events" ON events FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- ATTENDEES policies
CREATE POLICY "anon can read attendees" ON attendees FOR SELECT TO anon USING (true);
CREATE POLICY "anon can insert attendees" ON attendees FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "auth can manage attendees" ON attendees FOR ALL TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE created_by = auth.uid()));

-- QUESTIONS policies
CREATE POLICY "anon can read questions" ON questions FOR SELECT TO anon USING (true);
CREATE POLICY "auth can manage questions" ON questions FOR ALL TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE created_by = auth.uid()))
  WITH CHECK (event_id IN (SELECT id FROM events WHERE created_by = auth.uid()));

-- QUESTION_OPTIONS policies
CREATE POLICY "anon can read options" ON question_options FOR SELECT TO anon USING (true);
CREATE POLICY "auth can manage options" ON question_options FOR ALL TO authenticated
  USING (question_id IN (
    SELECT q.id FROM questions q
    JOIN events e ON q.event_id = e.id
    WHERE e.created_by = auth.uid()
  ));

-- ANSWERS policies
CREATE POLICY "anon can insert answers" ON answers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "anon can read own answers" ON answers FOR SELECT TO anon USING (true);
CREATE POLICY "auth can manage answers" ON answers FOR ALL TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE created_by = auth.uid()));

-- WINNERS policies
CREATE POLICY "anon can read winners" ON winners FOR SELECT TO anon USING (true);
CREATE POLICY "auth can manage winners" ON winners FOR ALL TO authenticated
  USING (event_id IN (SELECT id FROM events WHERE created_by = auth.uid()));

-- ============================================
-- STORAGE BUCKET
-- ============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('question-images', 'question-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view question images" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'question-images');

CREATE POLICY "Authenticated can upload question images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'question-images');

CREATE POLICY "Authenticated can delete question images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'question-images');
