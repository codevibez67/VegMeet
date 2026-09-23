// In-memory session store keyed by a fake "phone number". No database - a
// session lives as long as the server process runs, which is fine for a
// demo prototype (see README "future work").

const sessions = {};
let counter = 1000;

function generatePhone() {
  counter += 1;
  return `9${String(100000000 + counter).slice(0, 9)}`;
}

function createSession() {
  const phone = generatePhone();
  const session = {
    phone,
    lang: null,
    langPage: 0,
    state: 'LANG_SELECT',
    ctx: {},
    myListingIds: [],
    myOfferIdsMade: [],
    createdAt: Date.now(),
  };
  sessions[phone] = session;
  return session;
}

function getSession(phone) {
  return sessions[phone];
}

function allSessions() {
  return Object.values(sessions);
}

module.exports = { createSession, getSession, allSessions };
