UPDATE profiles SET subscription_tier = 'free' WHERE subscription_tier IS NULL;
ALTER TABLE profiles ALTER COLUMN subscription_tier SET NOT NULL;;
