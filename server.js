const express = require('express');
const path = require('path');
const { createSession, getSession } = require('./src/sessionStore');
const { renderCurrentScreen } = require('./src/screens');
const { handleInput } = require('./src/transitions');
const { sendMessage } = require('./src/smsGateway');
const webApi = require('./src/webApi');

const app = express();
app.use(express.json());

// Two front-facing channels, one shared backend (src/core.js + src/seedData.js):
//   /sms-view  -> Button Phone channel (numeric SMS-style simulator)
//   /app-view  -> Smartphone/Web channel (full dashboard)
app.use('/sms-view', express.static(path.join(__dirname, 'public', 'sms')));
app.use('/app-view', express.static(path.join(__dirname, 'public', 'app')));
app.get('/', (req, res) => res.redirect('/app-view'));

// -------------------- Button Phone channel routes --------------------
// Start a new simulated SMS thread (a new fake phone number/session).
app.post('/api/session', (req, res) => {
  const session = createSession();
  const message = renderCurrentScreen(session);
  sendMessage(session.phone, message);
  res.json({ phone: session.phone, message });
});

// Farmer/buyer presses a digit and hits send -> one SMS reply comes back.
app.post('/api/input', (req, res) => {
  const { phone, digit } = req.body;
  const session = getSession(phone);
  if (!session) {
    return res.status(404).json({ error: 'Session not found. Start a new conversation.' });
  }
  const message = handleInput(session, String(digit));
  sendMessage(session.phone, message);
  res.json({ phone: session.phone, message });
});

// Resend current screen (e.g. after page refresh) without transitioning state.
app.get('/api/session/:phone', (req, res) => {
  const session = getSession(req.params.phone);
  if (!session) {
    return res.status(404).json({ error: 'Session not found.' });
  }
  const message = renderCurrentScreen(session);
  res.json({ phone: session.phone, message });
});

// -------------------- Smartphone/Web channel routes --------------------
// Every route here is a thin wrapper over src/core.js - see src/webApi.js.
app.use('/api/web', webApi);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Vegmeet running at http://localhost:${PORT}`);
  console.log(`  Button Phone channel: http://localhost:${PORT}/sms-view`);
  console.log(`  Web App channel:      http://localhost:${PORT}/app-view`);
});
