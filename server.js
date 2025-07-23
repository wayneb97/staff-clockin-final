const express = require('express');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const dayjs = require('dayjs');
const app = express();
const PORT = process.env.PORT || 3000;

// Supabase credentials
const SUPABASE_URL = 'https://mfnygtlmqnxnagfswbip.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1mbnlndGxtcW54bmFnZnN3YmlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyODA2MTIsImV4cCI6MjA2ODg1NjYxMn0.SdLDveglV8NhtrwplsVZHN6FNCwl678I-2z3DeRjLKU';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

app.use(bodyParser.json());
app.use(express.static('public'));

function getToday() {
  return dayjs().format('YYYY-MM-DD');
}

// ✅ Clock In
app.post('/api/clockin', async (req, res) => {
  const { pin } = req.body;
  const { data: staffList } = await supabase.from('staff').select('*').eq('pin', pin);
  const user = staffList?.[0];
  if (!user) return res.status(403).send('Invalid PIN');

  const today = getToday();
  const { data: existing } = await supabase
    .from('logs')
    .select('*')
    .eq('staff_id', user.id)
    .eq('date', today)
    .order('clock_in', { ascending: false })
    .limit(1);

  const last = existing?.[0];
  if (last && !last.clock_out) {
    return res.status(400).send('Already clocked in. Please clock out first.');
  }

  await supabase.from('logs').insert({
    staff_id: user.id,
    date: today,
    clock_in: new Date().toISOString(),
    break_mins: 0,
  });

  res.send('Clocked in successfully.');
});

// ✅ Clock Out
app.post('/api/clockout', async (req, res) => {
  const { pin } = req.body;
  const { data: staffList } = await supabase.from('staff').select('*').eq('pin', pin);
  const user = staffList?.[0];
  if (!user) return res.status(403).send('Invalid PIN');

  const today = getToday();
  const { data: logs } = await supabase
    .from('logs')
    .select('*')
    .eq('staff_id', user.id)
    .eq('date', today)
    .order('clock_in', { ascending: false });

  const last = logs?.find(l => !l.clock_out);
  if (!last) return res.status(400).send('You must clock in first.');

  await supabase
    .from('logs')
    .update({ clock_out: new Date().toISOString() })
    .eq('id', last.id);

  res.send('Clocked out successfully.');
});

// ✅ Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { email, password } = req.body;
  const { data } = await supabase.from('staff').select('*').eq('pin', email);
  const admin = data?.[0];

  if (admin && admin.password === password && (admin.role === 'admin' || admin.role === 'superadmin')) {
    res.json({ success: true, role: admin.role });
  } else {
    res.json({ success: false });
  }
});

// ✅ Get Staff List
app.get('/api/admin/staff', async (req, res) => {
  const { data } = await supabase.from('staff').select('*');
  res.json(data);
});

// ✅ Add/Edit Staff
app.post('/api/admin/staff', async (req, res) => {
  const staff = req.body;
  if (staff.id) {
    await supabase.from('staff').update(staff).eq('id', staff.id);
  } else {
    await supabase.from('staff').insert(staff);
  }
  res.json({ success: true });
});

// ✅ Save Takings
app.post('/api/admin/takings', async (req, res) => {
  const { date, amount } = req.body;
  const { data } = await supabase.from('takings').select('*').eq('date', date);

  if (data.length > 0) {
    await supabase.from('takings').update({ amount }).eq('date', date);
  } else {
    await supabase.from('takings').insert({ date, amount });
  }

  res.json({ success: true });
});

// ✅ Load Logs
app.get('/api/admin/logs', async (req, res) => {
  const { data: logs } = await supabase.from('logs').select('*');
  const { data: staff } = await supabase.from('staff').select('*');

  const merged = logs.map(log => {
    const user = staff.find(s => s.id === log.staff_id);
    return {
      ...log,
      name: user?.name || 'Unknown',
      pin: user?.pin || 'N/A',
      wage: user?.wage || 0,
    };
  });

  res.json(merged);
});

// ✅ Load Takings
app.get('/api/admin/settings', async (req, res) => {
  const { data } = await supabase.from('takings').select('*');
  const settings = {
    takings: {}
  };
  data.forEach(row => {
    settings.takings[row.date] = row.amount;
  });
  res.json(settings);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
