ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS purchase_celebration_pending boolean DEFAULT false;;
