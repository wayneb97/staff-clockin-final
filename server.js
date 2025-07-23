const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
const dayjs = require('dayjs');
const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'data', 'staff.json');
const LOGS_FILE = path.join(__dirname, 'data', 'logs.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');

app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize files if missing
if (!fs.existsSync(DATA_FILE)) fs.writeJsonSync(DATA_FILE, []);
if (!fs.existsSync(LOGS_FILE)) fs.writeJsonSync(LOGS_FILE, []);
if (!fs.existsSync(SETTINGS_FILE)) fs.writeJsonSync(SETTINGS_FILE, {});

function load(file) {
  return fs.readJsonSync(file);
}
function save(file, data) {
  fs.writeJsonSync(file, data, { spaces: 2 });
}

function getToday() {
  return dayjs().format('YYYY-MM-DD');
}

// Clock In - allow multiple sessions
app.post('/api/clockin', (req, res) => {
  const { pin } = req.body;
  const staff = load(DATA_FILE);
  const logs = load(LOGS_FILE);
  const user = staff.find(s => s.pin === pin);
  if (!user) return res.status(403).send('Invalid PIN');

  // Prevent multiple clock-ins without clocking out first
  const today = getToday();
  const openSession = logs.find(l => l.pin === pin && l.date === today && !l.clockOut);
  if (openSession) return res.status(400).send('Already clocked in. Please clock out first.');

  logs.push({
    pin,
    name: user.name,
    date: today,
    clockIn: new Date().toISOString(),
    break: 0
  });

  save(LOGS_FILE, logs);
  res.send('Clocked in successfully.');
});

// Clock Out - closes the latest open session
app.post('/api/clockout', (req, res) => {
  const { pin } = req.body;
  const logs = load(LOGS_FILE);
  const today = getToday();

  const session = logs
    .filter(l => l.pin === pin && l.date === today && l.clockIn && !l.clockOut)
    .pop(); // get the latest open one

  if (!session) return res.status(400).send('No active session to clock out from.');

  session.clockOut = new Date().toISOString();
  save(LOGS_FILE, logs);
  res.send('Clocked out successfully.');
});

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { user, password } = req.body;
  const settings = load(SETTINGS_FILE);

  const matched = Object.entries(settings).find(([key, val]) =>
    (val.email === user || key === user) && val.password === password
  );

  if (!matched) return res.json({ success: false });

  const [key, val] = matched;
  res.json({
    success: true,
    user: { name: val.name || key, email: val.email || key, role: val.role }
  });
});

// Get all staff
app.get('/api/admin/staff', (req, res) => {
  const staff = load(DATA_FILE);
  res.json(staff);
});

// Add a new staff
app.post('/api/admin/staff', (req, res) => {
  const staff = load(DATA_FILE);
  staff.push(req.body);
  save(DATA_FILE, staff);
  res.json({ success: true });
});

// Add or update takings
app.post('/api/admin/takings', (req, res) => {
  const { date, amount } = req.body;
  const settings = load(SETTINGS_FILE);
  settings.takings = settings.takings || {};
  settings.takings[date] = amount;
  save(SETTINGS_FILE, settings);
  res.json({ success: true });
});

// Get all logs
app.get('/api/admin/logs', (req, res) => {
  const logs = load(LOGS_FILE);
  res.json(logs);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
