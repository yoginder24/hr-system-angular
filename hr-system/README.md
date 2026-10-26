# HR Management System (Angular 21 + JSON Server)

A learning / portfolio project: login, roles (Admin, HR, Employee), employees, departments,
attendance, leave approval, payroll, employee profile and role-based dashboards.

> **Demo only.** JSON Server has no real security. Route guards, hidden menu items and
> localStorage are for user experience, NOT protection. Anyone can open
> `http://localhost:3000/payroll` and read all data. A real product needs a trusted backend
> that checks passwords, sessions and permissions on every request.

## 1. Requirements

- Node.js **20.19+**, **22.12+** or **24+** (`node -v`)
- VS Code (recommended)

## 2. Install and run

```bash
npm install
```

Open **two terminals** in this folder:

```bash
# Terminal 1 - API on http://localhost:3000 (JSON Server + validated attendance endpoints)
npm run api

# Terminal 2 - Angular app (http://localhost:4200)
npm start
```

Then open http://localhost:4200

## 3. Demo accounts

| Role     | Email                       | Password   |
|----------|-----------------------------|------------|
| Admin    | aarav.sharma@company.com    | Admin@123  |
| HR       | priya.verma@company.com     | Hr@12345   |
| Employee | rohan.gupta@company.com     | Emp@12345  |
| Employee | sneha.iyer@company.com      | Emp@12345  |

The login page also has "Use Admin / HR / Employee" buttons.

## 4. Reset the sample data

Testing changes `db.json`. To restore the original data: stop JSON Server, then

```bash
cp db.backup.json db.json        # macOS / Linux
copy db.backup.json db.json      # Windows
```

## 5. Who can do what (src/app/core/auth/permissions.ts)

| Area        | Admin                    | HR                         | Employee            |
|-------------|--------------------------|----------------------------|---------------------|
| Employees   | view, add, edit, delete  | view, add, edit            | no access           |
| Departments | add, edit, delete        | add, edit (no delete)      | no access           |
| Attendance  | all, add, edit, delete   | all, add, edit (no delete) | own, read-only      |
| Mark Present| own account              | own account                | own account         |
| Leave       | all, approve / reject    | all, approve / reject      | own, apply          |
| Payroll     | all, add, edit, delete   | view only                  | own (no drafts)     |
| Profile     | any employee             | any employee               | own                 |
| Users       | add, edit, delete        | no access                  | no access           |

Nobody can approve their own leave request. Only Admin can create user accounts (Users page): one
account per employee, unique email, you cannot delete or change the role of your own account, and
at least one Admin must always remain. Change the rules in ONE file: `permissions.ts`.

## 5b. Mark Present (punch in) on the dashboard

Every logged-in user (Admin, HR, Employee) sees a **Today's attendance** card on the dashboard.

- **Mark Present** records the check-in for the logged-in user's OWN account only.
- The **server** decides the date, the time and the status (Present). The browser cannot send or fake them.
- One record per employee per day. A second click, a second tab, or the HR form cannot create a duplicate (HTTP 409).
- After check-in the button becomes **Checked In** and the check-in time is shown.
- Saved fields: employeeId, employeeName, date, checkIn, status, plus checkedInAt (exact server timestamp) and source ("self").
- Optional GPS: a **Share my location** box. It is off by default, the browser asks permission, and the real
  position is saved. Nothing is invented.
- Admin and HR see these records (with a person icon for self punch-in and a pin icon when location was shared)
  on the Attendance page.

Server endpoints (server.js):

| Method | URL                            | What it does |
|--------|--------------------------------|--------------|
| GET    | /attendance/today?employeeId=3 | Today's record by the SERVER date |
| POST   | /attendance/punch-in           | Body: { employeeId, location? }. Returns 201, or 400 / 403 / 404 / 409 with { message, code } |
| POST/PUT/PATCH | /attendance            | Normal JSON Server API, now with a duplicate guard (409) |

Optional server settings (environment variables):

```bash
# block Sundays (0 = Sunday ... 6 = Saturday). Default: every day is allowed
NON_WORKING_WEEKDAYS=0 npm run api

# require the employee to be inside the office radius (turns location ON for everybody)
OFFICE_LAT=28.6139 OFFICE_LNG=77.2090 OFFICE_RADIUS_METERS=200 npm run api
```

Use `npm run api` (not `npm run api:basic`, which is plain JSON Server without punch-in).
No database migration is needed: the new fields are optional and old records keep working.

Honest limits: JSON Server has no login or tokens, so the server cannot prove WHO is calling. The app always sends the
id of the logged-in user, but a real system must read the identity from a signed token (JWT). Browser GPS can be
spoofed with device tools, so a geofence is a convenience check, not proof. "Working day" is any day unless you set
NON_WORKING_WEEKDAYS (there is no holiday calendar), and the status is always Present (no late cut-off).

## 6. Folder structure

```
db.json                     fake database (JSON Server)
server.js                   API server (JSON Server + validated attendance endpoints)
src/app/
  app.ts / app.config.ts / app.routes.ts
  core/
    config/api.config.ts    API address (one place)
    auth/                   auth.service, auth.guard, role.guard, permissions
    models/                 TypeScript interfaces
    services/               employee, department, attendance, leave, payroll, user, notification
    utils/                  date, payroll, status and summary helpers
  features/                 auth/login, dashboard, employees, departments,
                            attendance, leave, payroll, profile, users, unauthorized
  shared/                   confirm-dialog, punch-card, layout (main-layout, sidebar, navbar)
```

## 7. Useful commands

```bash
npm start            # run the app
npm run api          # run the API (JSON Server + punch-in endpoints)
npm run api:basic    # plain JSON Server only
npm run build        # production build
npm test             # unit test (Vitest)
```

## 8. Known limitations (demo)

- Passwords are plain text in db.json and visible through the API.
- Attendance is typed in by Admin/HR. No location, biometric or automatic tracking.
- Payroll is simple (Net = Basic + Allowances - Deductions). No tax, PF/ESI or payslips.
- Leave allowance (18 days) is a labeled demo value. Days are calendar days.
- Deleting an employee removes the login account but not their old attendance/leave/payroll rows.
