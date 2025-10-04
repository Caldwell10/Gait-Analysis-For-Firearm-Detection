# Thermal Gait Screening PWA

Next.js Progressive Web App for the thermal gait surveillance authentication system.

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
cd frontend
npm install
```

### Environment Variables
Create a `.env.local` file in the `frontend` directory:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Development
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build
```bash
npm run build
npm start
```

### Testing
```bash
npm test
```

## Project Structure
```
frontend/
├── src/
│   ├── lib/              # API client and session management
│   ├── components/ui/    # Reusable UI components
│   └── __tests__/        # Unit tests
├── app/                  # Next.js 13+ app directory
│   ├── (auth)/          # Authentication routes
│   ├── dashboard/       # Protected dashboard
│   └── layout.tsx       # Root layout
```

## Authentication Flow
1. **Signup** → **Login**
2. **Login** → **2FA Setup** (new users) or **2FA Verify** (existing users)
3. **2FA Verification** → **Dashboard**

## Security Features
- HttpOnly cookies for session management
- 2FA with TOTP (manual secret setup)
- Client-side route protection
- Form validation with Zod
- Accessible UI components
