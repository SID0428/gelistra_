# Gelistra — Backend Setup Guide
## MySQL + Node.js/Express API + PDF + Admin Portal

---

## STEP 1 — Install MySQL

1. Install MySQL 8+ on your machine (or use a cloud provider)
2. Create a database called `gelistraDB`:

```sql
CREATE DATABASE gelistraDB;
USE gelistraDB;
```

3. Run the schema from `backend/schema.sql` to create all required tables

---

## STEP 2 — Configure the Backend

1. Navigate to the `backend/` directory
2. Copy or edit `.env` with your MySQL credentials:

```env
DB_HOST=localhost
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=gelistraDB
PORT=3000
AUTH_SECRET=replace_with_a_long_random_secret
ADMIN_SETUP_KEY=replace_with_one_time_admin_setup_key
```

3. Install dependencies:

```bash
cd backend
npm install
```

4. Start the server:

```bash
node server.js
```

The API will be live at `http://localhost:3000`

---

## STEP 3 — Create an Admin Account

Use the one-time setup endpoint to create your admin login:

```bash
curl -X POST http://localhost:3000/api/admin/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Your Name",
    "email": "admin@gelistra.com",
    "password": "your_secure_password",
    "setupKey": "replace_with_one_time_admin_setup_key"
  }'
```

---

## STEP 4 — Open the Frontend

The backend now serves the frontend static files too, so one process is enough.

Open:

`http://localhost:3000`

---

## STEP 5 — Access the Admin Portal

1. Open `http://your-domain.com/admin.html`
2. Sign in with the admin email/password you created in Step 3
3. All form submissions appear in the dashboard

---

## FILE SUMMARY

| File                     | Purpose                                           |
|--------------------------|---------------------------------------------------|
| `db-adapter.js`          | Thin wrapper — imports the MySQL adapter           |
| `mysql-adapter.js`       | MySQL REST API client (frontend → backend)         |
| `pdf-generator.js`       | Branded PDF for inquiry + requirements forms       |
| `script.js`              | Form submit → DB save + PDF auto-download          |
| `admin.html`             | Password-protected admin portal                    |
| `admin.js`               | Admin portal logic (talks directly to backend API) |
| `contact.html`           | Project inquiry form                               |
| `requirements-form.html` | Full requirements form                             |
| `backend/server.js`      | Node.js/Express API server (MySQL)                 |
| `backend/schema.sql`     | MySQL table definitions                            |

---

## WHAT HAPPENS ON FORM SUBMIT

1. User fills `contact.html` or `requirements-form.html`
2. On submit:
   - Data is sent to the Node.js backend via REST API
   - Backend saves it to MySQL (inquiries or requirements table)
   - A branded PDF is generated in the browser
   - PDF **auto-downloads** to the user's device (their copy)
   - A "Download Your PDF" button appears on the success screen (re-download)
3. You log into `admin.html` with your admin email/password
4. See all submissions in a table with filters, search, and status management
5. Click any row to open a detail drawer with all fields
6. Download any submission's PDF from the drawer

---

*Last updated: Gelistra project setup — gelistra.com*
