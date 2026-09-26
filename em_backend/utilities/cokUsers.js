const mongoose = require('mongoose');
const { cokCollection } = require('./cokDb');
const { phoneVariants } = require('./phone');

// Only what the attendance flow needs; the whole user document never leaves this module
const USER_PROJECTION = { full_name: 1, email: 1, telephone: 1 };

// A staff match is only ever by a contact the account itself holds, never by a typed name
const ACTIVE_USER_FILTER = { is_account_activated: true, 'access_control.is_locked': { $ne: true } };

function toObjectId(value) {
  if (!mongoose.Types.ObjectId.isValid(String(value))) return null;
  return new mongoose.Types.ObjectId(String(value));
}

/** Resolves { user, matchedBy: 'email' | 'phone' } for an active, unlocked account, or null. */
async function findSystemUserByContact({ email, phone } = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const variants = phoneVariants(phone);
  const or = [
    ...(cleanEmail ? [{ email: cleanEmail }] : []),
    ...(variants.length ? [{ telephone: { $in: variants } }] : []),
  ];
  if (or.length === 0) return null;

  const users = await cokCollection('users');
  const user = await users.findOne({ ...ACTIVE_USER_FILTER, $or: or }, { projection: USER_PROJECTION });
  if (!user) return null;

  const matchedBy = cleanEmail && String(user.email || '').toLowerCase() === cleanEmail ? 'email' : 'phone';
  return { user, matchedBy };
}

async function findSystemUserById(id) {
  const objectId = toObjectId(id);
  if (!objectId) return null;
  const users = await cokCollection('users');
  return users.findOne({ _id: objectId }, { projection: USER_PROJECTION });
}

/** The main system's signing profile (pinned certificate + signature image) for one account. */
async function findSigningProfile(userId) {
  const objectId = toObjectId(userId);
  if (!objectId) return null;
  const profiles = await cokCollection('user_signing_profiles');
  return profiles.findOne({ user_id: objectId });
}

module.exports = { findSystemUserByContact, findSystemUserById, findSigningProfile };
