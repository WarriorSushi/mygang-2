ALTER TABLE chat_history ADD CONSTRAINT chat_content_max_length CHECK (length(content) <= 5000);
ALTER TABLE chat_history ADD CONSTRAINT chat_speaker_max_length CHECK (length(speaker) <= 100);
ALTER TABLE memories ADD CONSTRAINT memory_content_max_length CHECK (length(content) <= 10000);
ALTER TABLE profiles ADD CONSTRAINT username_max_length CHECK (length(username) <= 100);
ALTER TABLE gangs ADD CONSTRAINT gang_name_max_length CHECK (length(name) <= 100);;
