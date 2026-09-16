/**
 * Single shared Supabase client, used by every service that needs the
 * database. Created once here rather than in each file that needs it.
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config/env');

const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

module.exports = supabase;
