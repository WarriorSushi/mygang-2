UPDATE profiles SET onboarding_completed = false WHERE onboarding_completed IS NULL;
ALTER TABLE profiles ALTER COLUMN onboarding_completed SET NOT NULL;

UPDATE profiles SET daily_msg_count = 0 WHERE daily_msg_count IS NULL;
ALTER TABLE profiles ALTER COLUMN daily_msg_count SET NOT NULL;

UPDATE profiles SET abuse_score = 0 WHERE abuse_score IS NULL;
ALTER TABLE profiles ALTER COLUMN abuse_score SET NOT NULL;;
