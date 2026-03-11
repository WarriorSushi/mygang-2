ALTER TABLE profiles ADD CONSTRAINT chk_chat_wallpaper CHECK (chat_wallpaper IS NULL OR length(chat_wallpaper) <= 50);
ALTER TABLE profiles ADD CONSTRAINT chk_chat_mode CHECK (chat_mode IS NULL OR chat_mode IN ('ecosystem', 'gang_focus'));
ALTER TABLE profiles ADD CONSTRAINT chk_theme CHECK (theme IS NULL OR theme IN ('light', 'dark', 'system'));;
