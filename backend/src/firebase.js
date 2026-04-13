const logger = require("firebase-functions/logger");
const { getApp, getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");

let cachedApp = null;
let cachedDb = null;

// this gets or creates the firebase admin app once
function getAdminApp() {
  if (cachedApp) return cachedApp;
  const defaultApp = getApps().find((app) => app.name === "[DEFAULT]");
  cachedApp = defaultApp || initializeApp();
  return cachedApp;
}

// this gets firestore from the admin app once
function getDb() {
  if (cachedDb) return cachedDb;
  cachedDb = getFirestore(getAdminApp());
  return cachedDb;
}

// this gets firebase auth admin from the shared app
function getAdminAuth() {
  return getAuth(getAdminApp());
}

// this gives firestore server timestamp without creating dates by hand
function serverTimestamp() {
  return FieldValue.serverTimestamp();
}

// this turns js date into firestore timestamp when needed
function timestampFromDate(date) {
  return Timestamp.fromDate(date);
}

module.exports = {
  getAdminApp,
  getAdminAuth,
  getDb,
  serverTimestamp,
  timestampFromDate,
  logger,
};
