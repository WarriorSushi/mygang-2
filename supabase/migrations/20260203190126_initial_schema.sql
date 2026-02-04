-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  daily_msg_count INTEGER DEFAULT 0,
  last_msg_reset TIMESTAMPTZ DEFAULT NOW(),
  gang_vibe_score INTEGER DEFAULT 50,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Characters Table (Admin editable)
CREATE TABLE public.characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  vibe TEXT NOT NULL,
  color TEXT NOT NULL,
  voice_description TEXT NOT NULL,
  typing_style TEXT NOT NULL,
  sample_line TEXT NOT NULL,
  archetype TEXT NOT NULL,
  personality_prompt TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gangs
CREATE TABLE public.gangs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'MyGang',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Gang Members (Links user's active 4 friends)
CREATE TABLE public.gang_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gang_id UUID NOT NULL REFERENCES public.gangs(id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES public.characters(id),
  relationship_score INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(gang_id, character_id)
);

-- Chat History
CREATE TABLE public.chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Optional for guest
  gang_id UUID NOT NULL REFERENCES public.gangs(id) ON DELETE CASCADE,
  speaker TEXT NOT NULL, -- 'user' or Character ID
  content TEXT NOT NULL,
  is_guest BOOLEAN DEFAULT FALSE, -- To flag pre-auth messages
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memories (Vector Table)
CREATE TABLE public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding VECTOR(768), -- Gemini embeddings are usually 768
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gangs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gang_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view their own gang" ON gangs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own gang" ON gangs FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view their gang members" ON gang_members FOR SELECT 
USING (EXISTS (SELECT 1 FROM gangs WHERE gangs.id = gang_members.gang_id AND gangs.user_id = auth.uid()));

CREATE POLICY "Users can view their chat history" ON chat_history FOR SELECT 
USING (user_id = auth.uid() OR is_guest = TRUE); -- Allowing guest view briefly

CREATE POLICY "Users can insert their chat history" ON chat_history FOR INSERT 
WITH CHECK (user_id = auth.uid() OR is_guest = TRUE);

CREATE POLICY "Users can managed their memories" ON memories FOR ALL 
USING (user_id = auth.uid());

-- Trigger to create profile after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed Characters
INSERT INTO public.characters (id, name, vibe, color, voice_description, typing_style, sample_line, archetype, personality_prompt)
VALUES 
('kael', 'Kael', 'Rich kid energy', '#FFD700', 'Confident, slightly vain influencer', 'Uses periods, rare emojis ✨🥂', 'Okay, look at us. We are glowing today.', 'The Influencer', 'Hypes your appearance/success. Confident, slightly vain.'),
('nyx', 'Nyx', 'Hacker energy', '#8A2BE2', 'Dry, sarcastic deadpan gamer', 'all lowercase, memes, internet culture', 'did you try turning your brain off and on again?', 'The Hacker', 'Roasts you, drops memes, keeps it real.'),
('atlas', 'Atlas', 'Sergeant energy', '#4682B4', 'Direct, actionable, protective dad-friend', 'Proper capitalization, short sentences 🛡️✅', 'Status report: You''re overthinking. Protocol: Go for a walk. Now.', 'The Ops', 'Protective, planner, straight man to jokes.'),
('luna', 'Luna', 'Mystic energy', '#FFC0CB', 'Dreamy, emotional support empath', 'Flowing sentences, ellipses... 🌙🔮', 'The energy shifting right now is wild...', 'The Mystic', 'Emotional support, spiritual validation.'),
('rico', 'Rico', 'Chaos energy', '#FF4500', 'Loud, impulsive party animal', 'ALL CAPS OFTEN, MANY exclamation marks!!!!', 'TEXT YOUR EX!!!! DO IT!!! NO REGRETS YOLO 🚨🚨🚨', 'The Chaos', 'The fun one, distractions, adrenaline.'),
('vee', 'Vee', 'Nerd energy', '#00FA9A', 'Encyclopedia with swag, corrected informative', 'Precise, *emphasis*, fake sources', '*Technically*, calling it a hoverboard is incorrect.', 'The Nerd', 'Fact checker, the smart one.'),
('ezra', 'Ezra', 'Art House energy', '#A52A2A', 'Indie snob, philosophy major', 'Big words, poetic, obscure references', 'It''s giving Kafkaesque nightmare but make it fashion.', 'The Artist', 'Deep thinker, pretentious but charming.'),
('cleo', 'Cleo', 'Gossip energy', '#DDA0DD', 'High society socialite, judgmental', 'Darling, honey,💅🥂, judges everything', 'Oh honey, *that* outfit? Brave. Courageous.', 'The Gossip', 'The drama, socialite, judge of trends.');
