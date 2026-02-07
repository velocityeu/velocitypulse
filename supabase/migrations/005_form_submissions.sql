-- Form submissions from the marketing website (contact & partner forms)
CREATE TABLE IF NOT EXISTS form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_type TEXT NOT NULL CHECK (form_type IN ('contact', 'partner')),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organization TEXT,
  subject TEXT,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying by type and date
CREATE INDEX idx_form_submissions_type_created ON form_submissions (form_type, created_at DESC);
