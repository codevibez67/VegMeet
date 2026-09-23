// ============================================================================
// SMS GATEWAY ABSTRACTION
// ----------------------------------------------------------------------------
// This is the ONLY file/function that talks to the "outside world" for
// sending a message to a farmer/buyer's phone. Right now it just records the
// message in an in-memory outbox that the frontend polls/reads, simulating
// an SMS thread in the browser.
//
// FUTURE WORK (out of scope for this prototype):
// To go live with a real SMS gateway (Twilio, Textlocal, a telecom API,
// etc.), replace the body of `sendMessage` below with a real API call, e.g.
//
//   const twilioClient = require('twilio')(accountSid, authToken);
//   async function sendMessage(phone, text) {
//     await twilioClient.messages.create({ to: phone, from: FROM_NUMBER, body: text });
//   }
//
// No other file in this codebase needs to change - every other module only
// ever calls sendMessage(phone, text) and never talks to a transport
// directly.
// ============================================================================

const outbox = {}; // phone -> array of { text, direction: 'out', ts }

function sendMessage(phone, text) {
  if (!outbox[phone]) outbox[phone] = [];
  outbox[phone].push({ text, direction: 'out', ts: Date.now() });
  return true;
}

function getOutbox(phone) {
  return outbox[phone] || [];
}

module.exports = { sendMessage, getOutbox };
