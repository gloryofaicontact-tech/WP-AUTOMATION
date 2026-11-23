# Enterprise NestJS Backend Starter Template

A production-ready, highly scalable, and modular backend starter template built with **NestJS**, **Prisma ORM**, and **TypeScript**. Designed for high security, multi-device session handling, and real-time capabilities out of the box.

---

## 🌟 Key Features

### 1. 🛡️ Authentication & Authorization (`src/modules/auth`)
- **JWT Authentication**: Short-lived access tokens (15m default) + rotatable refresh tokens.
- **Multi-Device Session Management**: Track active devices/IPs/user agents, revoke individual sessions, or logout all devices.
- **Account Protection**: Automatic account lockout after failed attempts, rate limiting via `@nestjs/throttler`.
- **Role-Based Access Control (RBAC)**: Support for `USER`, `ADMIN`, `SUPER_ADMIN` with `@Roles()` decorator and `RolesGuard`.
- **Password Management**: Bcrypt hashing (configurable salt rounds), password reset flows, secure password change.
- **Email Verification**: Cryptographic HMAC-based verification tokens without unnecessary external dependencies.

### 2. 👤 User Management (`src/modules/users`)
- User lifecycle management (`PENDING`, `ACTIVE`, `SUSPENDED`, `BANNED`, `DELETED`).
- Soft delete support (`deletedAt`).
- Profile retrieval, updates, and administrative management.

### 3. 🔔 Notifications (`src/modules/notifications`)
- In-app notification database storage with read/unread tracking.
- Real-time WebSocket gateway (`/notifications`) powered by Socket.IO.
- Notification categorization: `SYSTEM`, `ACCOUNT`, `SECURITY`.

### 4. 🩺 Health Checks (`src/modules/health`)
- Endpoints at `/health` powered by `@nestjs/terminus`.
- Comprehensive indicators: Prisma PostgreSQL connectivity, Redis cache connectivity, and WebSocket gateway status.

### 5. 🗄️ Database & Prisma ORM (`prisma/` & `src/infrastructure/database`)
- Optimized for PostgreSQL, Supabase, Neon, AWS RDS, or local Docker.
- Connection pooling support (`DATABASE_URL`) + Direct URL for migrations (`DIRECT_URL`).
- Built-in `AuditLog` model to track high-risk operations and administrative actions.
- Automatic `BigInt` serialization interceptor for JavaScript JSON compatibility.
- Super Admin database seeder included (`npm run seed` or `npx prisma db seed`).

### 6. ⚡ Infrastructure & Security
- **Caching**: Redis Cache Module with conditional activation.
- **WebSocket Scaling**: Redis IO Adapter for multi-instance horizontal scaling.
- **Security**: Helmet headers, CORS policies, rate limiting, and gzip/brotli compression.
- **Logging**: Structured logging using Winston with daily file rotation and sensitive data masking.
- **Validation**: Strict DTO validation with `class-validator`, `class-transformer`, and startup environment validation via `Joi`.

---

## 📁 Project Structure

```text
├── docs/                     # API documentation & architecture guides
├── prisma/
│   ├── migrations/           # Database migration files
│   ├── seeds/                # Seed scripts (e.g. Super Admin)
│   └── schema.prisma         # Enterprise database schema
├── src/
│   ├── common/               # Shared decorators, guards, filters, interceptors, utils
│   ├── config/               # Strongly-typed environment configs & Joi validations
│   ├── infrastructure/       # Database (Prisma), Cache (Redis), WebSocket adapters
│   ├── modules/
│   │   ├── auth/             # Login, register, JWT, sessions, password reset
│   │   ├── health/           # Health checks & system indicators
│   │   ├── notifications/    # In-app notifications & WebSocket gateway
│   │   └── users/            # User profile & administration
│   ├── app.module.ts         # Root module
│   └── main.ts               # Application entry point
├── .env.example              # Environment variables template
├── package.json
└── tsconfig.json
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+ or v20+ recommended)
- PostgreSQL database (Local, Supabase, Neon, etc.)
- Redis (Optional, recommended for WebSocket clustering and cache)

### 2. Installation
```bash
# Install dependencies
npm install
```

### 3. Environment Configuration
Copy the example environment file and adjust your settings:
```bash
cp .env.example .env
```

Ensure you configure your database connection in `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
DIRECT_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
JWT_SECRET="your-32-character-long-secret-key-here"
JWT_REFRESH_SECRET="your-32-character-long-refresh-key-here"
```

### 4. Database Setup & Seeding
```bash
# Push schema to database
npx prisma db push

# Or run migrations
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate

# Seed initial Super Admin
npx ts-node prisma/seed.ts
```

### 5. Running the Application
```bash
# Development mode
npm run start:dev

# Production build
npm run build
npm run start:prod
```

API will be available at: `http://localhost:3000/api/v1`  
Health check endpoint: `http://localhost:3000/api/v1/health`  
WebSocket gateway: `ws://localhost:3000/notifications`

---

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run test coverage
npm run test:cov

# Run e2e tests
npm run test:e2e
```

---

## 🔒 Security Best Practices Implemented
- **No plain text passwords**: Scrypt/Bcrypt hashing with configurable rounds.
- **Session invalidation**: Refresh tokens are stored hashed in database; revoking deletes session records.
- **Timing attack resistance**: Safe HMAC comparisons for OTP verification.
- **Rate limiting**: Specialized throttles on sensitive endpoints (`/auth/login`, `/auth/refresh`, etc.).
- **Audit Logging**: Sensitive actions (logins, password resets, staff updates) record IP, user-agent, and risk level.
