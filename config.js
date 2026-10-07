// Supabase Configuration
// You can either enter your Supabase URL & Anon Key here, OR configure them directly in the app.

window.APP_CONFIG = {
  // Live Supabase Project Credentials
  SUPABASE_URL: "https://itsgtoippjfkvspooodb.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0c2d0b2lwcGpma3ZzcG9vb2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzOTg0ODAsImV4cCI6MjEwNjk3NDQ4MH0.NbxIoBeBizj3uobMgbRjrGvi3EAhvMEtcwIVWg8cJBk"
};

// Check if credentials exist in config or localStorage
window.getSupabaseConfig = function() {
  const localSaved = localStorage.getItem('YOC_ATTENDANCE_SUPABASE_CONFIG');
  if (localSaved) {
    try {
      const parsed = JSON.parse(localSaved);
      if (parsed.url && parsed.anonKey) {
        return {
          url: parsed.url.trim(),
          anonKey: parsed.anonKey.trim(),
          isConfigured: true
        };
      }
    } catch (e) {}
  }

  const fileUrl = (window.APP_CONFIG.SUPABASE_URL || '').trim();
  const fileKey = (window.APP_CONFIG.SUPABASE_ANON_KEY || '').trim();

  const isConfigured = Boolean(
    fileUrl && 
    fileKey && 
    fileUrl.startsWith('https://') && 
    !fileUrl.includes('your-project-id')
  );

  return {
    url: fileUrl,
    anonKey: fileKey,
    isConfigured: isConfigured
  };
};

window.saveSupabaseConfig = function(url, anonKey) {
  if (!url || !anonKey) return false;
  localStorage.setItem('YOC_ATTENDANCE_SUPABASE_CONFIG', JSON.stringify({
    url: url.trim(),
    anonKey: anonKey.trim()
  }));
  return true;
};

window.clearSupabaseConfig = function() {
  localStorage.removeItem('YOC_ATTENDANCE_SUPABASE_CONFIG');
};
