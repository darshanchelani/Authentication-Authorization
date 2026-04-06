# 🔐 Authentication & Authorisation — Concepts Guide

This document explains every core concept used in this Node.js + Express + MongoDB authentication system, with code examples taken directly from the project.

---

## Table of Contents

1. [Project Architecture (Modular MVC)](#1-project-architecture-modular-mvc)
2. [Environment Variables & dotenv](#2-environment-variables--dotenv)
3. [Express Middleware Pipeline](#3-express-middleware-pipeline)
4. [MongoDB & Mongoose](#4-mongodb--mongoose)
5. [Password Hashing with bcrypt](#5-password-hashing-with-bcrypt)
6. [JWT (JSON Web Tokens)](#6-jwt-json-web-tokens)
7. [Access Token vs Refresh Token](#7-access-token-vs-refresh-token)
8. [HTTP-Only Cookies](#8-http-only-cookies)
9. [Authentication Middleware](#9-authentication-middleware)
10. [Role-Based Authorisation](#10-role-based-authorisation)
11. [Email Verification Flow](#11-email-verification-flow)
12. [Password Reset Flow](#12-password-reset-flow)
13. [DTO & Joi Validation](#13-dto--joi-validation)
14. [Custom Error Handling (ApiError)](#14-custom-error-handling-apierror)
15. [Async Handler Pattern](#15-async-handler-pattern)
16. [Global Error Handler](#16-global-error-handler)
17. [Crypto Token Hashing (SHA-256)](#17-crypto-token-hashing-sha-256)
18. [Nodemailer (Transactional Emails)](#18-nodemailer-transactional-emails)
19. [Mongoose Hooks (Pre-save)](#19-mongoose-hooks-pre-save)
20. [select: false (Field-Level Security)](#20-select-false-field-level-security)

---

## 1. Project Architecture (Modular MVC)

The project follows a **modular MVC** (Model-View-Controller) pattern where each feature (auth, cart, etc.) is a self-contained module.

```
project/
├── server.js              ← Entry point: loads env, connects DB, starts server
├── src/
│   ├── app.js             ← Express app config: middleware + routes
│   ├── common/            ← Shared utilities used across all modules
│   │   ├── config/        ← DB connection, email transport
│   │   ├── dto/           ← Base validation class
│   │   ├── middleware/     ← Reusable middleware (validate, error-handler)
│   │   └── utils/         ← ApiError, ApiResponse, JWT helpers
│   └── modules/
│       └── auth/          ← Auth feature module
│           ├── auth.model.js       ← Mongoose schema (Model)
│           ├── auth.service.js     ← Business logic (Service)
│           ├── auth.controller.js  ← HTTP handler (Controller)
│           ├── auth.routes.js      ← Route definitions
│           ├── auth.middleware.js   ← Auth-specific middleware
│           └── dto/                ← Input validation schemas
```

### Why this structure?

- **Separation of Concerns**: Each layer has a single responsibility.
- **Scalability**: Adding a new feature = adding a new folder under `modules/`.
- **Testability**: Services can be tested without HTTP, controllers without a database.

---

## 2. Environment Variables & dotenv

Sensitive configuration (DB URI, JWT secrets, SMTP credentials) must **never** be hard-coded. The `dotenv` package reads a `.env` file and injects the values into `process.env`.

```js
// server.js — this single import loads .env automatically
import "dotenv/config";

// Now you can access variables anywhere:
const PORT = process.env.PORT || 5000;
const dbUri = process.env.MONGODB_URI;
```

### `.env` file example:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/auth_app
JWT_ACCESS_SECRET=my_super_secret_key
JWT_REFRESH_SECRET=another_secret_key
```

> ⚠️ **Never commit `.env` to Git.** Use `.env.example` to document required variables.

---

## 3. Express Middleware Pipeline

Express processes requests through a **middleware chain**. Each middleware can:
- Read/modify `req` and `res`
- Call `next()` to pass control to the next middleware
- Send a response (ending the chain)

```js
// src/app.js
const app = express();

// 1. Parse JSON body → req.body is now available
app.use(express.json());

// 2. Parse URL-encoded data (HTML forms)
app.use(express.urlencoded({ extended: true }));

// 3. Parse cookies → req.cookies is now available
app.use(cookieParser());

// 4. Mount routes
app.use("/api/auth", authRoute);

// 5. Global error handler (MUST be last)
app.use(errorHandler);
```

**Request flow:**
```
Client Request
    → express.json()
    → cookieParser()
    → Route Handler (controller)
    → Response sent to client
    
If error is thrown:
    → errorHandler middleware
    → Error response sent to client
```

---

## 4. MongoDB & Mongoose

**MongoDB** is a NoSQL document database. **Mongoose** is an ODM (Object Document Mapper) that provides:
- **Schemas** — define the shape and validation of documents.
- **Models** — provide CRUD methods (`find`, `create`, `findByIdAndUpdate`, etc.).
- **Middleware** — hooks that run before/after lifecycle events.

### Connecting to MongoDB:

```js
// src/common/config/db.js
import mongoose from "mongoose";

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGODB_URI);
  console.log(`MongoDB connected: ${conn.connection.host}`);
};
```

### Defining a Schema:

```js
// src/modules/auth/auth.model.js
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Name is required"] },
    email: { type: String, unique: true, lowercase: true },
    password: { type: String, select: false },
    role: { type: String, enum: ["customer", "seller", "admin"], default: "customer" },
  },
  { timestamps: true }  // Adds createdAt & updatedAt fields automatically
);

// Create and export the Model
export default mongoose.model("User", userSchema);
```

### Common Mongoose Methods used in the project:

| Method | Purpose | Example |
|--------|---------|---------|
| `Model.create(data)` | Create a new document | `User.create({ name, email, password })` |
| `Model.findOne(filter)` | Find first matching doc | `User.findOne({ email })` |
| `Model.findById(id)` | Find by `_id` | `User.findById(userId)` |
| `Model.findByIdAndUpdate(id, update)` | Update by `_id` | `User.findByIdAndUpdate(id, { refreshToken: null })` |
| `doc.save()` | Save changes to a document | `user.save({ validateBeforeSave: false })` |
| `.select("+field")` | Include a `select: false` field | `User.findOne({ email }).select("+password")` |

---

## 5. Password Hashing with bcrypt

**Why?** Storing plain-text passwords is a critical security flaw. If the database is compromised, all passwords are exposed.

**bcrypt** is a one-way hashing algorithm that:
1. Adds a random **salt** (preventing rainbow-table attacks).
2. Is intentionally **slow** (configurable via salt rounds).
3. Cannot be reversed — you can only *compare*, not *decrypt*.

### Hashing (during registration):

```js
// In the Mongoose pre-save hook
userSchema.pre("save", async function (next) {
  // Only hash if the password was changed
  if (!this.isModified("password")) return next();
  
  // Hash with 12 salt rounds
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
```

### Comparing (during login):

```js
// Instance method on the User model
userSchema.methods.comparePassword = async function (clearTextPassword) {
  // bcrypt extracts the salt from the stored hash and uses it to hash
  // the input, then compares the two hashes
  return bcrypt.compare(clearTextPassword, this.password);
};

// Usage in the login service:
const isMatch = await user.comparePassword(password);
if (!isMatch) throw ApiError.unauthorized("Invalid email or password");
```

---

## 6. JWT (JSON Web Tokens)

A **JWT** is a self-contained token that encodes a payload (claims) and is signed with a secret key. The server can verify it without a database query.

### Structure:

```
Header.Payload.Signature
eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjY1ZiIsInJvbGUiOiJjdXN0b21lciJ9.abc123signature
```

- **Header**: Algorithm + token type (e.g. `{ "alg": "HS256", "typ": "JWT" }`)
- **Payload**: Data you encode (e.g. `{ "id": "65f...", "role": "customer" }`)
- **Signature**: `HMAC_SHA256(header + "." + payload, secret)` — tamper detection

### Creating a Token:

```js
import jwt from "jsonwebtoken";

const generateAccessToken = (payload) => {
  return jwt.sign(
    payload,                          // { id, role }
    process.env.JWT_ACCESS_SECRET,    // Secret key
    { expiresIn: "15m" }             // Auto-expires after 15 minutes
  );
};
```

### Verifying a Token:

```js
const verifyAccessToken = (token) => {
  // Throws JsonWebTokenError or TokenExpiredError on failure
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};
```

---

## 7. Access Token vs Refresh Token

This project uses a **dual-token strategy**:

| Property | Access Token | Refresh Token |
|----------|-------------|---------------|
| **Purpose** | Authenticate API requests | Get new access tokens |
| **Lifetime** | Short (15 min) | Long (7 days) |
| **Stored in** | Client memory / JS variable | httpOnly cookie |
| **Sent via** | `Authorization: Bearer <token>` header | Cookie (automatic) |
| **Contains** | `{ id, role }` | `{ id }` |

### Why two tokens?

- **Access Token** is short-lived → if stolen, the damage window is small.
- **Refresh Token** is httpOnly → JavaScript can't read it (XSS-safe).
- When the access token expires, the client calls `/refresh-token` to get a new one.

### Flow:

```
1. Login → Server returns { accessToken } + sets refreshToken cookie
2. API calls → Client sends accessToken in Authorization header
3. Token expires → Client calls POST /refresh-token
4. Server reads cookie → Verifies → Returns new accessToken
5. Logout → Server clears refreshToken from DB + cookie
```

### Refresh Token Rotation:

```js
// During login, the refresh token is hashed before storage
user.refreshToken = hashToken(refreshToken);
await user.save();

// During refresh, the incoming token is hashed and compared
if (user.refreshToken !== hashToken(token)) {
  throw ApiError.unauthorized("Invalid refresh token");
}
```

This detects token reuse — if a stolen token is used after the real user refreshed, the hashes won't match.

---

## 8. HTTP-Only Cookies

Cookies with `httpOnly: true` are **invisible to JavaScript**. The browser sends them automatically with every request, but `document.cookie` cannot read them.

```js
// Setting the refresh token cookie (during login)
res.cookie("refreshToken", refreshToken, {
  httpOnly: true,     // JS cannot access it (XSS protection)
  secure: true,       // Only sent over HTTPS (not HTTP)
  sameSite: "strict", // Not sent with cross-origin requests (CSRF protection)
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
});

// Reading the cookie (during refresh)
const token = req.cookies.refreshToken;

// Clearing the cookie (during logout)
res.clearCookie("refreshToken");
```

### Security benefits:

| Flag | Protects Against |
|------|-----------------|
| `httpOnly` | XSS (Cross-Site Scripting) |
| `secure` | Man-in-the-Middle attacks |
| `sameSite: "strict"` | CSRF (Cross-Site Request Forgery) |

---

## 9. Authentication Middleware

The `authenticate` middleware runs **before** protected route handlers. It verifies the access token and attaches user info to `req.user`.

```js
const authenticate = async (req, res, next) => {
  let token;
  
  // Extract token from "Bearer <token>" header
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) throw ApiError.unauthorized("Not authenticated");

  // Verify the JWT
  const decoded = verifyAccessToken(token);  // { id, role, iat, exp }

  // Confirm user still exists in the database
  const user = await User.findById(decoded.id);
  if (!user) throw ApiError.unauthorized("User no longer exists");

  // Attach user info for downstream handlers
  req.user = {
    id: user._id,
    role: user.role,
    name: user.name,
    email: user.email,
  };

  next();  // Pass control to the next middleware/handler
};
```

### Usage in routes:

```js
// Protected route — authenticate runs first
router.get("/me", authenticate, controller.getMe);

// In the controller, req.user is guaranteed to exist
const getMe = async (req, res) => {
  const user = await authService.getMe(req.user.id);  // ← req.user.id
};
```

---

## 10. Role-Based Authorisation

**Authentication** = "Who are you?"  
**Authorisation** = "What are you allowed to do?"

The `authorize` middleware is a **factory function** — it takes allowed roles and returns a middleware.

```js
const authorize = (...roles) => {     // e.g. authorize("admin", "seller")
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden("You do not have permission");
    }
    next();
  };
};
```

### Usage in routes:

```js
// Only admins can access this route
router.delete("/users/:id", authenticate, authorize("admin"), controller.deleteUser);

// Admins and sellers can access this route
router.post("/products", authenticate, authorize("admin", "seller"), controller.createProduct);
```

### How the middleware chain works:

```
Request → authenticate → authorize("admin") → controller
             ↓                  ↓
         Sets req.user     Checks req.user.role
```

---

## 11. Email Verification Flow

Prevents users from registering with fake email addresses.

### Flow diagram:

```
1. User registers
   → Server generates random token (rawToken + hashedToken)
   → hashedToken stored in DB (user.verificationToken)
   → rawToken sent to user's email as a link

2. User clicks the link: GET /api/auth/verify-email/:rawToken
   → Server hashes the rawToken
   → Finds user where verificationToken === hashedToken
   → Sets isVerified = true, clears verificationToken

3. Login check:
   → If !user.isVerified → reject with "Please verify your email"
```

### Code:

```js
// Registration — generate and store token
const { rawToken, hashedToken } = generateResetToken();
await User.create({ ...data, verificationToken: hashedToken });
await sendVerificationEmail(email, rawToken);

// Verification — hash incoming token and match
const verifyEmail = async (token) => {
  const hashedToken = hashToken(token);
  const user = await User.findOne({ verificationToken: hashedToken });
  if (!user) throw ApiError.badRequest("Invalid verification token");
  
  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save();
};
```

---

## 12. Password Reset Flow

Allows users to recover their account when they forget their password.

### Flow diagram:

```
1. POST /api/auth/forgot-password  { email }
   → Generate random token pair
   → Store hashedToken + expiry (15 min) in DB
   → Email the rawToken to the user

2. POST /api/auth/reset-password/:rawToken  { password, confirmPassword }
   → Hash the rawToken
   → Find user where resetPasswordToken === hash AND expiry > now
   → Set new password (pre-save hook hashes it)
   → Clear reset fields
```

### Code:

```js
// Forgot password
const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  const { rawToken, hashedToken } = generateResetToken();
  
  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;  // 15 min
  await user.save();
  
  await sendPasswordResetEmail(email, rawToken);
};

// Reset password
const resetPassword = async (token, newPassword) => {
  const hashedToken = hashToken(token);
  
  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },  // Must not be expired
  });
  
  if (!user) throw ApiError.badRequest("Token is invalid or expired");
  
  user.password = newPassword;  // Pre-save hook hashes it
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
};
```

---

## 13. DTO & Joi Validation

**DTO** (Data Transfer Object) defines the expected shape of incoming data. **Joi** is a schema validation library.

### Base DTO (inherited by all DTOs):

```js
class BaseDto {
  static schema = Joi.object({});

  static validate(data) {
    const { error, value } = this.schema.validate(data, {
      abortEarly: false,   // Collect ALL errors, not just the first
      stripUnknown: true,  // Remove fields not in the schema
    });

    if (error) {
      const errors = error.details.map((d) => d.message);
      return { errors, value: null };
    }
    return { errors: null, value };
  }
}
```

### Registration DTO:

```js
class RegisterDto extends BaseDto {
  static schema = Joi.object({
    name: Joi.string().trim().min(2).max(50).required(),
    email: Joi.string().email().lowercase().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid("customer", "seller").default("customer"),
  });
}
```

### Validation middleware:

```js
// Runs BEFORE the controller — rejects bad data early
const validate = (DtoClass) => {
  return (req, res, next) => {
    const { errors, value } = DtoClass.validate(req.body);
    if (errors) throw ApiError.badRequest(errors.join("; "));
    
    req.body = value;  // Replace with sanitised data
    next();
  };
};

// Usage:
router.post("/register", validate(RegisterDto), controller.register);
```

### Benefits:

- **Security**: Strips unknown fields (prevents mass-assignment attacks).
- **Clean data**: Controllers receive validated, typed, trimmed data.
- **Early rejection**: Invalid requests never reach the service layer.

---

## 14. Custom Error Handling (ApiError)

Instead of scattering `res.status(400).json(...)` everywhere, we throw typed errors that a global handler catches.

```js
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg)    { return new ApiError(400, msg); }
  static unauthorized(msg)  { return new ApiError(401, msg); }
  static forbidden(msg)     { return new ApiError(403, msg); }
  static notFound(msg)      { return new ApiError(404, msg); }
  static conflict(msg)      { return new ApiError(409, msg); }
}
```

### Usage:

```js
// In any service or middleware:
if (!user) throw ApiError.notFound("User not found");
// → The global error handler sends: { success: false, message: "User not found" } with status 404
```

---

## 15. Async Handler Pattern

Express does **not** catch errors from `async` functions by default. Without wrapping, an unhandled rejection would crash the server.

```js
// ❌ Without asyncHandler — unhandled promise rejection!
router.get("/me", async (req, res) => {
  const user = await User.findById(req.user.id);  // What if this throws?
  res.json(user);
});

// ✅ With asyncHandler — errors are forwarded to the error handler
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

router.get("/me", asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);  // If this throws → next(err)
  res.json(user);
}));
```

### How it works:

1. `asyncHandler` wraps the async function.
2. If the function rejects (throws), `.catch(next)` passes the error to Express.
3. Express invokes the global error handler.

---

## 16. Global Error Handler

A centralised place to handle **all** errors — no try-catch blocks in controllers.

```js
// Express knows this is an error handler because it has 4 parameters
const errorHandler = (err, req, res, next) => {
  // Known ApiError → use its status code
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Mongoose validation error
  if (err.name === "ValidationError") {
    return res.status(400).json({ ... });
  }

  // Mongoose duplicate key (e.g. duplicate email)
  if (err.code === 11000) {
    return res.status(409).json({ ... });
  }

  // JWT errors
  if (err.name === "TokenExpiredError") {
    return res.status(401).json({ ... });
  }

  // Fallback
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
```

> ⚠️ The error handler **must** be the last `app.use()` call in `app.js`.

---

## 17. Crypto Token Hashing (SHA-256)

For email verification and password reset, we use **random tokens** (not JWTs) because:
- They're single-use (deleted after verification).
- They don't need to carry payload data.
- They can be invalidated by simply deleting from DB.

### Why hash before storing?

If the DB is compromised, the attacker sees hashes — not raw tokens. They can't use the hashes to verify emails or reset passwords.

```js
import crypto from "crypto";

const generateResetToken = () => {
  // Generate 32 random bytes → 64-char hex string
  const rawToken = crypto.randomBytes(32).toString("hex");
  
  // Hash with SHA-256 for storage
  const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
  
  return { rawToken, hashedToken };
  // rawToken → sent to user via email
  // hashedToken → stored in database
};

// When verifying, hash the incoming token and compare:
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");
```

---

## 18. Nodemailer (Transactional Emails)

**Nodemailer** is a Node.js library for sending emails via SMTP.

```js
import nodemailer from "nodemailer";

// Create a reusable transporter with SMTP credentials
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,  // Use STARTTLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Send an email
const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/api/auth/verify-email/${token}`;
  
  await transporter.sendMail({
    from: process.env.SMTP_FROM_EMAIL,
    to: email,
    subject: "Verify your email address",
    html: `<a href="${verifyUrl}">Click here to verify</a>`,
  });
};
```

> 💡 For development, you can use [Mailtrap](https://mailtrap.io) or [Ethereal](https://ethereal.email) as a fake SMTP server.

---

## 19. Mongoose Hooks (Pre-save)

Mongoose **hooks** (also called middleware) run at specific lifecycle events. The `pre("save")` hook runs before a document is saved to the database.

```js
userSchema.pre("save", async function (next) {
  // `this` refers to the document being saved
  
  // Only hash the password if it was modified
  // (prevents re-hashing on unrelated updates)
  if (!this.isModified("password")) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
```

### Key points:

- **Arrow functions won't work** here because `this` must bind to the document.
- `isModified("field")` returns `true` if the field was changed (new doc OR explicit update).
- `next()` passes control to the next hook or the save operation.

---

## 20. select: false (Field-Level Security)

By marking fields with `select: false` in the schema, Mongoose **excludes** them from query results by default.

```js
const userSchema = new mongoose.Schema({
  password:      { type: String, select: false },
  refreshToken:  { type: String, select: false },
  verificationToken: { type: String, select: false },
});
```

### When you need the field, explicitly include it:

```js
// Default query — password is NOT included
const user = await User.findOne({ email });
console.log(user.password); // undefined

// Explicit select — password IS included
const user = await User.findOne({ email }).select("+password");
console.log(user.password); // "$2b$12$..."
```

### Why?

- **API responses** never accidentally leak passwords, tokens, or secrets.
- You must *consciously* opt-in to include sensitive fields.

---

## 🔄 Complete Authentication Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    REGISTRATION FLOW                         │
├─────────────────────────────────────────────────────────────┤
│ 1. Client → POST /register { name, email, password }        │
│ 2. Validate input (RegisterDto)                              │
│ 3. Check if email exists                                     │
│ 4. Hash password (bcrypt pre-save hook)                      │
│ 5. Generate verification token                               │
│ 6. Store user + hashed token in DB                           │
│ 7. Send verification email with raw token                    │
│ 8. Return user info (without password)                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 EMAIL VERIFICATION FLOW                       │
├─────────────────────────────────────────────────────────────┤
│ 1. User clicks link → GET /verify-email/:token               │
│ 2. Hash the raw token                                        │
│ 3. Find user with matching verificationToken                 │
│ 4. Set isVerified = true, clear token                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      LOGIN FLOW                              │
├─────────────────────────────────────────────────────────────┤
│ 1. Client → POST /login { email, password }                  │
│ 2. Find user, compare password (bcrypt)                      │
│ 3. Check isVerified                                          │
│ 4. Generate accessToken (JWT, 15 min)                        │
│ 5. Generate refreshToken (JWT, 7 days)                       │
│ 6. Store hashed refreshToken in DB                           │
│ 7. Set refreshToken as httpOnly cookie                       │
│ 8. Return { user, accessToken }                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                 AUTHENTICATED REQUEST                        │
├─────────────────────────────────────────────────────────────┤
│ 1. Client sends: Authorization: Bearer <accessToken>         │
│ 2. authenticate middleware verifies JWT                      │
│ 3. Looks up user in DB                                       │
│ 4. Attaches req.user = { id, role, name, email }             │
│ 5. authorize middleware checks role (if applicable)          │
│ 6. Controller handles the request                            │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                   TOKEN REFRESH FLOW                         │
├─────────────────────────────────────────────────────────────┤
│ 1. Access token expires                                      │
│ 2. Client → POST /refresh-token (cookie sent automatically)  │
│ 3. Verify refresh JWT                                        │
│ 4. Compare hash against stored DB value                      │
│ 5. Issue new accessToken                                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  PASSWORD RESET FLOW                         │
├─────────────────────────────────────────────────────────────┤
│ 1. POST /forgot-password { email }                           │
│ 2. Generate reset token, store hash + expiry in DB           │
│ 3. Email raw token link to user                              │
│ 4. POST /reset-password/:token { password, confirmPassword } │
│ 5. Hash incoming token, find user, check expiry              │
│ 6. Update password (pre-save hook hashes it)                 │
│ 7. Clear reset fields                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📚 Libraries Used

| Library | Purpose |
|---------|---------|
| `express` | Web framework — routing, middleware, HTTP handling |
| `mongoose` | MongoDB ODM — schemas, models, validation, hooks |
| `bcryptjs` | Password hashing — one-way hash with salt |
| `jsonwebtoken` | JWT creation & verification |
| `dotenv` | Load `.env` variables into `process.env` |
| `cookie-parser` | Parse `Cookie` header → `req.cookies` |
| `joi` | Schema-based request validation |
| `nodemailer` | Send transactional emails via SMTP |
| `crypto` (built-in) | SHA-256 hashing for tokens |
