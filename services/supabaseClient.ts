
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rwibgiljzkhgblsxwyjj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3aWJnaWxqemtoZ2Jsc3h3eWpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3OTY3OTIsImV4cCI6MjA4MTM3Mjc5Mn0.OKd7M8df7g7C4r5seeNSv6ivF_Tckb4ixmn6BaLP_oI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
