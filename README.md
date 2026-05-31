# 🎤 VoiceOPD — Voice Assisted OPD Management System

A production-ready **MEAN stack** SaaS application for clinic OPD management using voice commands in **Marathi**, **Hindi**, and **English**.

---

## 📁 Project Structure

```
voiceopd/
├── backend/                    # Node.js + Express + MongoDB API
│   ├── config/
│   │   └── database.js         # MongoDB connection
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── patient.controller.js
│   │   ├── token.controller.js
│   │   ├── prescription.controller.js
│   │   ├── visit.controller.js
│   │   ├── report.controller.js
│   │   └── clinic.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js   # JWT protect + role authorize
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── Doctor.model.js
│   │   ├── Clinic.model.js
│   │   ├── Patient.model.js
│   │   ├── Token.model.js
│   │   ├── Prescription.model.js
│   │   └── Visit.model.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── patient.routes.js
│   │   ├── token.routes.js
│   │   ├── prescription.routes.js
│   │   ├── visit.routes.js
│   │   ├── report.routes.js
│   │   └── clinic.routes.js
│   ├── utils/
│   │   ├── logger.js            # Winston logger
│   │   └── seeder.js            # Dev seed data
│   ├── server.js                # Entry point + Socket.IO
│   └── .env.example
│
└── frontend/                   # Angular 17 SPA
    └── src/app/
        ├── components/
        │   ├── auth/            # Login + Register
        │   ├── dashboard/       # Dashboard with live stats
        │   ├── patients/        # Patient list + detail
        │   ├── tokens/          # Live token queue
        │   ├── prescriptions/   # Rx list + form with voice
        │   ├── visits/          # Visit history
        │   ├── reports/         # Analytics charts
        │   ├── settings/        # Clinic & voice settings
        │   └── shared/          # Sidebar, Navbar, VoiceModal
        ├── services/            # API + Socket services
        ├── models/              # TypeScript interfaces
        ├── interceptors/        # JWT + Error interceptors
        └── guards/              # Auth + Guest guards
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- MongoDB Atlas account (free tier works)
- Angular CLI: `npm install -g @angular/cli`

### 1. Clone & install

```bash
git clone https://github.com/yourname/voiceopd.git
cd voiceopd

# Backend
cd backend
cp .env.example .env
# Edit .env — set MONGO_URI, JWT_SECRET
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Configure `.env`

```env
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/voiceopd
JWT_SECRET=your_super_secret_32_char_minimum_key
JWT_REFRESH_SECRET=another_secret_key_here
CLIENT_URL=http://localhost:4200
```

### 3. Seed the database (optional)

```bash
cd backend
npm run seed
# Creates demo doctor: doctor@voiceopd.com / password123
```

### 4. Run in development

```bash
# Terminal 1 — Backend
cd backend
npm run dev        # Runs on http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm start          # Runs on http://localhost:4200
```

---

## 🌐 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register doctor + clinic |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh access token |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/patients` | List patients (search + pagination) |
| POST | `/api/patients` | Register patient + auto-issue token |
| GET | `/api/patients/:id/history` | Full patient history |
| GET | `/api/tokens/today` | Today's token queue with stats |
| POST | `/api/tokens/next` | Call next patient |
| POST | `/api/tokens/:id/call` | Call specific token |
| POST | `/api/tokens/:id/skip` | Skip token |
| GET | `/api/prescriptions` | List prescriptions |
| POST | `/api/prescriptions` | Create prescription + visit |
| POST | `/api/prescriptions/:id/whatsapp` | Send via WhatsApp |
| GET | `/api/visits` | Visit history |
| GET | `/api/reports/dashboard` | Live dashboard stats |
| GET | `/api/reports/weekly` | 7-day patient + revenue chart |
| GET | `/api/reports/top-medicines` | Most prescribed medicines |
| PUT | `/api/clinic` | Update clinic settings |

---

## 🎤 Voice Features

Uses the **Web Speech API** (Chrome/Edge). Supported utterances:

- **Marathi:** `"नवीन रुग्ण गणेश शेलार, वय ४५, ताप आणि खोकला"`
- **Hindi:** `"नया मरीज गणेश शेलार, उम्र 45, बुखार"`
- **English:** `"New patient Ganesh Shelar age 45 fever and cough"`

---

## 📡 Real-Time (Socket.IO)

The frontend connects to the backend Socket.IO server and joins a clinic room. Events:

| Event | Trigger |
|-------|---------|
| `token:new` | Patient registered → token issued |
| `token:called` | Doctor calls a token |
| `token:next` | Next in queue called |
| `token:skipped` | Token skipped |
| `token:completed` | Consultation done |

---

## 📱 WhatsApp Integration

Requires [Twilio](https://www.twilio.com) account with WhatsApp sandbox:

```env
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```

---

## 🏗 Production Deployment

```bash
# Build Angular
cd frontend
npm run build       # Output: dist/voiceopd-frontend/

# Serve with Express (add to server.js)
app.use(express.static(path.join(__dirname, '../frontend/dist/voiceopd-frontend/browser')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/dist/voiceopd-frontend/browser/index.html')));
```

**Recommended:** Deploy on [Render](https://render.com) or [Railway](https://railway.app) with MongoDB Atlas.

---

## 💰 SaaS Pricing Plans

| Plan | Price | Patients/day | WhatsApp |
|------|-------|-------------|----------|
| Trial | Free 14 days | Unlimited | ❌ |
| Basic | ₹999/mo | 50 | ❌ |
| Pro | ₹1999/mo | Unlimited | ✅ |
| Enterprise | ₹4999/mo | Unlimited | ✅ + SMS |

---

## 🛡 Security Features

- **JWT** access + refresh token rotation
- **Bcrypt** password hashing (12 rounds)
- **Helmet** HTTP security headers
- **Rate limiting** (100 req/15min)
- **CORS** locked to client URL
- **Multi-tenant** — all data scoped to `clinicId`
- **Role-based** access control (admin / doctor / receptionist)
