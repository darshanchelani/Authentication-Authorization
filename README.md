# 🔐 Node.js Authentication & Authorization API

A production-ready RESTful authentication and authorization backend built with **Node.js**, **Express**, **MongoDB**, and **JWT**. Features include user registration with email verification, login with dual-token strategy, role-based access control, and password reset via email.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Endpoints](#-api-endpoints)
- [Authentication Flow](#-authentication-flow)
- [Concepts Reference](#-concepts-reference)
- [License](#-license)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **User Registration** | Sign up with name, email, password, and role |
| **Email Verification** | SHA-256 hashed token sent via email; must verify before login |
| **Login (JWT)** | Returns short-lived access token + long-lived refresh token |
| **Refresh Token Rotation** | Securely issue new access tokens using httpOnly cookies |
| **Password Reset** | Forgot password → email link → reset with new password |
| **Role-Based Access Control** | `customer`, `seller`, `admin` roles with middleware guards |
| **Input Validation** | Joi schemas via DTO pattern for all endpoints |
| **Global Error Handling** | Centralised error handler for ApiError, Mongoose, JWT errors |
| **Secure Cookies** | httpOnly, secure, sameSite flags on refresh token |
| **Password Hashing** | bcrypt with 12 salt rounds |

---

## 🛠 Tech Stack

| Technology | Purpose |
|-----------|---------|
| [Node.js](https://nodejs.org/) | JavaScript runtime |
| [Express](https://expressjs.com/) | Web framework |
| [MongoDB](https://www.mongodb.com/) | NoSQL database |
| [Mongoose](https://mongoosejs.com/) | MongoDB ODM |
| [JWT](https://jwt.io/) | Stateless authentication tokens |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js) | Password hashing |
| [Joi](https://joi.dev/) | Schema-based request validation |
| [Nodemailer](https://nodemailer.com/) | Transactional emails |
| [dotenv](https://github.com/motdotla/dotenv) | Environment variable management |
| [cookie-parser](https://github.com/expressjs/cookie-parser) | Cookie handling |

---

## 📁 Project Structure

```
├── server.js                        # Entry point — connects DB & starts server
├── src/
│   ├── app.js                       # Express app — middleware & route mounting
│   ├── common/                      # Shared utilities across all modules
│   │   ├── config/
│   │   │   ├── db.js                # MongoDB connection
│   │   │   └── email.js             # Nodemailer transport & email helpers
│   │   ├── dto/
│   │   │   └── base.dto.js          # Abstract base DTO (Joi validation)
│   │   ├── middleware/
│   │   │   ├── async-handler.js     # Wraps async handlers for error catching
│   │   │   ├── error-handler.js     # Global error handler middleware
│   │   │   └── validate.middleware.js # DTO validation middleware factory
│   │   └── utils/
│   │       ├── api-error.js         # Custom ApiError class (400, 401, 403, 404, 409)
│   │       ├── api-response.js      # Standardised success response class
│   │       └── jwt.utils.js         # JWT & crypto token utilities
│   └── modules/
│       └── auth/                    # Authentication module
│           ├── auth.controller.js   # HTTP handlers (thin layer)
│           ├── auth.middleware.js   # authenticate & authorize middleware
│           ├── auth.model.js        # Mongoose User schema
│           ├── auth.routes.js       # Route definitions
│           ├── auth.service.js      # Business logic (no HTTP objects)
│           └── dto/
│               ├── register.dto.js
│               ├── login.dto.js
│               ├── forgot-password.dto.js
│               └── reset-password.dto.js
├── concept.md                       # Detailed guide on all concepts used
├── env.example                      # Template for environment variables
├── package.json
└── package-lock.json
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+
- **MongoDB** (local or [MongoDB Atlas](https://www.mongodb.com/atlas))
- **SMTP server** for emails (or use [Mailtrap](https://mailtrap.io) / [Ethereal](https://ethereal.email) for testing)

### Installation

```bash
# Clone the repository
git clone https://github.com/<your-username>/<repo-name>.git
cd <repo-name>

# Install dependencies
npm install

# Create your .env file from the template
cp env.example .env
# Edit .env with your actual values

# Start the server
npm start
```

The server will start at `http://localhost:5000` (or your configured `PORT`).

---

## 🔧 Environment Variables

Create a `.env` file in the project root (refer to `env.example`):

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment mode | `development` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/auth_app` |
| `JWT_ACCESS_SECRET` | Secret key for access tokens | `your_access_secret` |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime | `15m` |
| `JWT_REFRESH_SECRET` | Secret key for refresh tokens | `your_refresh_secret` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime | `7d` |
| `SMTP_HOST` | SMTP server host | `smtp.mailtrap.io` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SMTP_USER` | SMTP username | `your_smtp_user` |
| `SMTP_PASS` | SMTP password | `your_smtp_pass` |
| `SMTP_FROM_EMAIL` | Sender email address | `noreply@example.com` |
| `FRONTEND_URL` | Frontend URL for email links | `http://localhost:3000` |

---

## 📡 API Endpoints

### Base URL: `/api/auth`

| Method | Endpoint | Auth | Body | Description |
|--------|----------|------|------|-------------|
| `POST` | `/register` | ❌ | `{ name, email, password, role? }` | Register a new user |
| `POST` | `/login` | ❌ | `{ email, password }` | Login & receive tokens |
| `POST` | `/logout` | ✅ | — | Logout & clear refresh token |
| `POST` | `/refresh-token` | 🍪 | — | Get new access token (uses cookie) |
| `GET` | `/verify-email/:token` | ❌ | — | Verify email address |
| `POST` | `/forgot-password` | ❌ | `{ email }` | Send password reset email |
| `POST` | `/reset-password/:token` | ❌ | `{ password, confirmPassword }` | Reset password |
| `GET` | `/me` | ✅ | — | Get current user profile |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |

**Legend:** ✅ = Bearer token required · 🍪 = Cookie required · ❌ = Public

### Example Requests

#### Register

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com","password":"password123"}'
```

#### Login

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'
```

#### Access Protected Route

```bash
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer <access_token>"
```

---

## 🔄 Authentication Flow

```
                    ┌──────────────┐
                    │   Register   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Verification │──── Email with token
                    │   Email Sent │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Verify Email │──── GET /verify-email/:token
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │    Login     │──── Returns accessToken + refreshToken (cookie)
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐ ┌──▼────┐ ┌─────▼──────┐
       │  API Calls   │ │Refresh│ │   Logout   │
       │ (Bearer JWT) │ │ Token │ │(Clear all) │
       └──────────────┘ └───────┘ └────────────┘
```

---

## 📚 Concepts Reference

See [**concept.md**](./concept.md) for an in-depth explanation of all 20 concepts used in this project, including:

- JWT access & refresh token strategy
- bcrypt password hashing
- Mongoose hooks & `select: false`
- DTO validation pattern with Joi
- Role-based authorization middleware
- Crypto token hashing (SHA-256)
- Global error handling
- And more...

---

## 📄 License

This project is licensed under the [ISC License](https://opensource.org/licenses/ISC).
