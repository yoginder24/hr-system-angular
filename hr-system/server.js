/**
 * HRMS mock API = the same JSON Server as before + a few validated attendance endpoints.
 *
 *   npm run api          -> this file (use it for the Mark Present feature)
 *   npm run api:basic    -> plain json-server (no punch-in endpoint)
 *
 * Why this file exists: plain JSON Server cannot run any rules. Here the SERVER decides the
 * date and time of a punch-in (the browser cannot fake it), validates the request, and
 * refuses duplicates.
 *
 * IMPORTANT (demo limits): JSON Server has no login/token system, so this server cannot prove
 * WHO is calling. The Angular app sends the employeeId of the logged-in user, but a real
 * product must read the identity from a signed token (JWT) on a trusted backend.
 */
const fs = require('fs');
const path = require('path');
const jsonServer = require('json-server');

// ---------------- Settings (change with environment variables) ----------------
const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = path.resolve(process.env.DB_FILE || path.join(__dirname, 'db.json'));

// Days when "Mark Present" is not allowed. 0 = Sunday ... 6 = Saturday.
// Example: NON_WORKING_WEEKDAYS=0   (blocks Sundays). Default: every day is allowed.
const NON_WORKING_WEEKDAYS = (process.env.NON_WORKING_WEEKDAYS || '')
  .split(',')
  .map((s) => s.trim())
  .filter((s) => s !== '')
  .map(Number)
  .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

// Optional office geofence. Set all three values to turn it ON. When ON, employees must
// share their location and be inside the radius. Example:
//   OFFICE_LAT=28.6139 OFFICE_LNG=77.2090 OFFICE_RADIUS_METERS=200 npm run api
const OFFICE = (() => {
  const lat = Number(process.env.OFFICE_LAT);
  const lng = Number(process.env.OFFICE_LNG);
  const radius = Number(process.env.OFFICE_RADIUS_METERS);
  const complete = process.env.OFFICE_LAT && process.env.OFFICE_LNG && process.env.OFFICE_RADIUS_METERS;
  return complete && Number.isFinite(lat) && Number.isFinite(lng) && radius > 0 ? { lat, lng, radius } : null;
})();

// A location reading worse than this is rejected (GPS was too inaccurate to trust).
const MAX_ACCURACY_METERS = 1000;

// ---------------- Setup ----------------
const server = jsonServer.create();
const router = jsonServer.router(DB_FILE);
server.use(jsonServer.defaults({ bodyParser: true }));

// Re-read db.json when somebody edits it by hand (the old --watch behaviour).
let reloadTimer;
fs.watchFile(DB_FILE, { interval: 500 }, () => {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    try {
      router.db.read();
    } catch (error) {
      console.error('Could not reload db.json:', error.message);
    }
  }, 100);
});

// ---------------- Helpers ----------------
const db = () => router.db;

function fail(res, status, message, code) {
  return res.status(status).json({ message, code });
}

// The server's own clock. The browser is never trusted for the date or the time.
function serverNow() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return {
    iso: now.toISOString(),
    weekday: now.getDay(),
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function findAttendance(employeeId, date, excludeId) {
  return db()
    .get('attendance')
    .value()
    .find((r) => r.employeeId === employeeId && r.date === date && r.id !== excludeId);
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Checks the location the browser sent. Returns { value } or { error }.
function parseLocation(raw) {
  if (raw === undefined || raw === null) {
    return { value: null };
  }
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  const accuracy = Number(raw.accuracy);

  const validNumbers =
    Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(accuracy) && accuracy >= 0;
  if (!validNumbers || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: 'The location data is not valid.' };
  }
  if (accuracy > MAX_ACCURACY_METERS) {
    return {
      error: `Your location is too inaccurate (about ${Math.round(accuracy)} m). Move to an open area and try again.`,
    };
  }
  return {
    value: {
      lat: Math.round(lat * 1e6) / 1e6,
      lng: Math.round(lng * 1e6) / 1e6,
      accuracy: Math.round(accuracy),
    },
  };
}

// ---------------- GET /attendance/today?employeeId=3 ----------------
// Today's record by the SERVER date (so a wrong browser clock cannot confuse the screen).
server.get('/attendance/today', (req, res) => {
  const employeeId = toPositiveInt(req.query.employeeId);
  if (!employeeId) {
    return fail(res, 400, 'employeeId is required.', 'BAD_REQUEST');
  }
  const { date } = serverNow();
  res.json({ date, record: findAttendance(employeeId, date) || null, officeLocationRequired: OFFICE !== null });
});

// ---------------- POST /attendance/punch-in ----------------
server.post('/attendance/punch-in', (req, res) => {
  const body = req.body || {};
  const employeeId = toPositiveInt(body.employeeId);
  if (!employeeId) {
    return fail(res, 400, 'A valid employeeId is required.', 'BAD_REQUEST');
  }

  const employee = db().get('employees').find({ id: employeeId }).value();
  if (!employee) {
    return fail(res, 404, 'Employee not found.', 'EMPLOYEE_NOT_FOUND');
  }
  if (employee.employmentStatus === 'Inactive') {
    return fail(res, 403, 'Inactive employees cannot mark attendance.', 'EMPLOYEE_INACTIVE');
  }
  if (!db().get('users').find({ employeeId }).value()) {
    return fail(res, 403, 'This employee has no login account.', 'NO_ACCOUNT');
  }

  const now = serverNow();
  if (NON_WORKING_WEEKDAYS.includes(now.weekday)) {
    return fail(res, 400, 'Today is not a working day, so attendance cannot be marked.', 'NON_WORKING_DAY');
  }

  // One record per employee per day. This check and the save below run together
  // (Node handles one request at a time here), so two quick clicks cannot both succeed.
  const existing = findAttendance(employeeId, now.date);
  if (existing) {
    return res.status(409).json({
      message: 'Attendance is already marked for today.',
      code: 'ALREADY_MARKED',
      record: existing,
    });
  }

  const parsed = parseLocation(body.location);
  if (parsed.error) {
    return fail(res, 400, parsed.error, 'BAD_LOCATION');
  }
  if (OFFICE) {
    if (!parsed.value) {
      return fail(res, 400, 'Location is required. Tick "Share my location" and allow access.', 'LOCATION_REQUIRED');
    }
    const away = distanceMeters(parsed.value.lat, parsed.value.lng, OFFICE.lat, OFFICE.lng);
    if (away > OFFICE.radius) {
      return fail(
        res,
        403,
        `You are about ${Math.round(away)} m from the office. You must be within ${OFFICE.radius} m.`,
        'OUTSIDE_OFFICE',
      );
    }
  }

  const list = db().get('attendance').value();
  const nextId = list.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;

  const record = {
    id: nextId,
    employeeId,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    date: now.date,
    checkIn: now.time,
    checkOut: '',
    status: 'Present',
    checkedInAt: now.iso,
    source: 'self',
  };
  if (parsed.value) {
    record.location = parsed.value;
  }

  db().get('attendance').push(record).write();
  return res.status(201).json(record);
});

// ---------------- Duplicate guard for the normal attendance API ----------------
// The HR "Add / Edit attendance" form also goes through here, so duplicates are blocked
// on the server too (not only in the browser).
function guardDuplicates(req, res, next) {
  const body = req.body || {};
  let employeeId = Number(body.employeeId);
  let date = body.date;
  let excludeId;

  if (req.params.id) {
    excludeId = Number(req.params.id);
    const current = db().get('attendance').find({ id: excludeId }).value();
    if (current) {
      employeeId = body.employeeId !== undefined ? Number(body.employeeId) : current.employeeId;
      date = body.date !== undefined ? body.date : current.date;
    }
  }

  if (Number.isInteger(employeeId) && date && findAttendance(employeeId, date, excludeId)) {
    return fail(res, 409, 'This employee already has an attendance record for this date.', 'DUPLICATE');
  }
  next();
}
server.post('/attendance', guardDuplicates);
server.put('/attendance/:id', guardDuplicates);
server.patch('/attendance/:id', guardDuplicates);

// ---------------- Everything else = normal JSON Server ----------------
server.use(router);

server.listen(PORT, () => {
  console.log(`HRMS API running on http://localhost:${PORT}  (db: ${DB_FILE})`);
  console.log(
    `  Non-working weekdays: ${NON_WORKING_WEEKDAYS.length ? NON_WORKING_WEEKDAYS.join(',') : 'none'} | ` +
      `Office geofence: ${OFFICE ? `ON (${OFFICE.radius} m)` : 'off'}`,
  );
});
