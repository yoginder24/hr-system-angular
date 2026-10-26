# HR Management System (HRMS)

A portfolio project built with **Angular 21**, **TypeScript**, **Bootstrap 5**, and a **JSON Server mock API**. It demonstrates common HR workflows such as employee and department management, attendance, leave requests, payroll, user roles, and dashboards.

> **Project status:** Frontend + mock API demo. This is not a production-secure HR system. See [Security Notes](#security-notes) before using real employee data.

## Features

- **Authentication demo** with Admin, HR, and Employee roles
- **Role-based access rules** using route guards and a central permissions file
- **Dashboard views** for HR workflows and summary information
- **Employee management** — list, create, edit, and view employee details
- **Department management** — manage department records
- **Attendance management** — view and manage attendance records
- **Self check-in** — mark today's attendance from the dashboard
- **Leave management** — apply for leave and review/approve requests according to role permissions
- **Payroll management** — maintain payroll records and calculate demo net pay
- **User management** — Admin-managed user accounts
- **Employee profile** pages
- **Reusable layout/components** including navbar, sidebar, confirmation dialog, and punch-in card
- **Mock REST API** backed by `db.json`, with custom attendance validation in `server.js`

## Tech Stack

| Technology | Purpose |
|---|---|
| Angular 21 | Frontend framework |
| TypeScript | Application logic and types |
| Angular Router | Navigation and route guards |
| Angular Forms | Form handling |
| RxJS | Asynchronous data flows |
| Bootstrap 5 | UI styling/components |
| Bootstrap Icons | Icons |
| JSON Server 0.17 | Mock REST API |
| Node.js | Runs the custom API server |
| Vitest / Angular test tooling | Unit-test setup |

## Screens / Modules

- Login
- Dashboard
- Employees
- Departments
- Attendance
- Leave
- Payroll
- Users
- Profile
- Unauthorized access page

## Requirements

Install the following before running the project:

- **Node.js**: 20.19+, 22.12+, or 24+
- **npm**: compatible with your installed Node.js version
- **Visual Studio Code** (recommended)

Check your installed versions:

```bash
node -v
npm -v
```

## Run Locally

### 1. Download or clone the repository

If you are cloning from GitHub:

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd hr-system
```

If you downloaded the ZIP, extract it and open the `hr-system` folder in VS Code.

### 2. Install dependencies

Run this command from the folder containing `package.json`:

```bash
npm install
```

### 3. Start the mock API

Open a terminal in VS Code:

```bash
npm run api
```

The API runs at:

- `http://localhost:3000`

Keep this terminal running.

### 4. Start Angular

Open a **second terminal** in the same project folder:

```bash
npm start
```

Open the app at:

- `http://localhost:4200`

Keep both terminals running while using the application.

### Other useful commands

```bash
npm run build       # Build the Angular app
npm test            # Run the configured tests
npm run api:basic   # Run plain JSON Server without custom punch-in endpoints
npm start           # Start Angular development server
```

## Demo Login Accounts

The sample database includes these demo accounts:

| Role | Email | Password |
|---|---|---|
| Admin | `aarav.sharma@company.com` | `Admin@123` |
| HR | `priya.verma@company.com` | `Hr@12345` |
| Employee | `rohan.gupta@company.com` | `Emp@12345` |
| Employee | `sneha.iyer@company.com` | `Emp@12345` |

These credentials are for local demonstration only. Do not reuse them in a real system.

## Role Permissions

The application centralizes its role/permission rules in `src/app/core/auth/permissions.ts`. The intended demo permissions are:

| Module | Admin | HR | Employee |
|---|---|---|---|
| Employees | View and manage | View, add, edit | No access |
| Departments | Full management | Add/edit | No access |
| Attendance | Manage all records | View/manage records with restrictions | View own records; self check-in |
| Leave | Review all requests | Review all requests | Apply and view own requests |
| Payroll | Manage all records | View only | View own records |
| Profile | View employee profiles | View employee profiles | View own profile |
| Users | Manage user accounts | No access | No access |

The actual behavior is defined by the permission configuration and route/component logic in the repository.

## Self Check-In API

The custom API in `server.js` adds validation for self check-in:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/attendance/today?employeeId=3` | Get today's record for an employee using the server's date |
| `POST` | `/attendance/punch-in` | Create today's self check-in |
| `GET` | `/attendance` | Read attendance records through JSON Server |
| `POST` / `PUT` / `PATCH` | `/attendance` | Standard JSON Server writes, with a duplicate check |

Example request body for `POST /attendance/punch-in`:

```json
{
  "employeeId": 3
}
```

An optional `location` object may be sent when the user explicitly chooses to share their location. The server validates location values and can optionally enforce an office-radius check.

The punch-in endpoint may return `201` on success, or an error such as `400`, `403`, `404`, or `409` with a message and code. Duplicate check-ins for the same employee and date are rejected.

### Optional API settings

The API can be configured with environment variables:

```bash
# Example: block Sundays
NON_WORKING_WEEKDAYS=0 npm run api

# Example office geofence (replace with your office coordinates and radius)
OFFICE_LAT=28.6139 OFFICE_LNG=77.2090 OFFICE_RADIUS_METERS=200 npm run api
```

Only use real office coordinates when appropriate and with permission. Environment-variable syntax may differ between Windows PowerShell and macOS/Linux shells.

## Project Structure

```text
hr-system/
├── db.json                         # Mock database used by JSON Server
├── db.backup.json                  # Backup sample data for reset
├── server.js                       # JSON Server + custom attendance endpoints
├── package.json                    # Scripts and dependencies
├── angular.json                    # Angular CLI configuration
├── public/
│   └── favicon.ico
└── src/
    ├── index.html
    ├── main.ts
    ├── styles.css
    └── app/
        ├── app.ts
        ├── app.config.ts
        ├── app.routes.ts
        ├── core/
        │   ├── auth/               # Auth service, guards, permissions
        │   ├── config/             # API URL configuration
        │   ├── models/             # TypeScript data models
        │   ├── services/           # Employee, attendance, leave, payroll, etc.
        │   └── utils/               # Date, status, payroll, summary helpers
        ├── features/
        │   ├── auth/
        │   ├── dashboard/
        │   ├── employees/
        │   ├── departments/
        │   ├── attendance/
        │   ├── leave/
        │   ├── payroll/
        │   ├── profile/
        │   ├── users/
        │   └── unauthorized/
        └── shared/
            ├── components/         # Punch card, confirmation dialog
            └── layout/             # Main layout, navbar, sidebar
```

## Reset Demo Data

Actions in the application can modify `db.json`. To restore the original sample data, stop the API server first.

**Windows Command Prompt:**

```bat
copy db.backup.json db.json
```

**PowerShell:**

```powershell
Copy-Item db.backup.json db.json -Force
```

**macOS / Linux:**

```bash
cp db.backup.json db.json
```

Restart the API after resetting the data.

## Security Notes

This repository is intended for learning and portfolio demonstration only.

- JSON Server is a mock API, not a production backend.
- Demo passwords are stored as plain text in `db.json`; never store real credentials this way.
- Client-side route guards, role-based menus, and local storage do **not** secure API data.
- The custom API does not authenticate requests with signed JWTs. The supplied employee ID is not proof of identity.
- Do not use real employee, salary, attendance, or other confidential personal data.
- A production version should use a trusted backend, password hashing, authenticated sessions or validated JWTs, server-side authorization, input validation, audit logs, HTTPS, and a real database.
- Payroll calculations are simplified demo calculations and do not implement statutory tax, PF/ESI, or jurisdiction-specific payroll rules.
- GPS/geofence checks are convenience checks and are not proof of a person's identity or physical presence.

## Build for Production

To create an Angular production build:

```bash
npm run build
```

The generated build output is created by Angular CLI. This command builds the frontend only; it does not convert the JSON Server mock API into a production backend.

## Future Improvements

Potential next steps for turning this portfolio demo into a more realistic HRMS:

- Replace JSON Server with a backend API and a relational database
- Add secure authentication and server-side role/permission enforcement
- Add automated tests for critical workflows
- Add pagination, filtering, and sorting for larger datasets
- Add audit history for employee, leave, attendance, and payroll changes
- Add validated payslip generation and configurable payroll rules
- Add environment-based API configuration for development and deployment
- Add CI checks for linting, tests, and production builds

## Contributing

This is a learning/portfolio project. If you fork it, create a feature branch and describe your changes in a pull request.

## License

No license is specified in this repository yet. Add a `LICENSE` file before presenting the project as open source.
