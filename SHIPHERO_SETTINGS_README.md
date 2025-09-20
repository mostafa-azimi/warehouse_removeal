# ShipHero Settings Component Package

A complete, drop-in ShipHero API management component that provides:

- ✅ **Refresh Token Input & Storage** - Secure local storage of refresh tokens
- ✅ **Automatic Access Token Generation** - Generate new 28-day access tokens
- ✅ **Live 28-Day Countdown Timer** - Real-time countdown with color-coded urgency
- ✅ **Connection Testing** - Test API connectivity and view warehouse data
- ✅ **Automatic Token Refresh** - Auto-refresh tokens before expiration
- ✅ **Multiple Storage Strategies** - localStorage, IndexedDB, cookies for persistence
- ✅ **Order Creation Tools** - Create sales orders and purchase orders
- ✅ **Complete UI Components** - All necessary shadcn/ui components included

## 🚀 Quick Start

### 1. Copy Files to Your Project

Copy all files from this package to your project:

```bash
# Copy the main component
cp components/ShipHeroSettings.tsx your-project/components/

# Copy UI components  
cp -r components/ui/ your-project/components/ui/

# Copy utilities
cp -r lib/ your-project/lib/

# Copy API routes
cp -r app/api/shiphero/ your-project/app/api/shiphero/

# Copy hooks
cp hooks/use-toast.ts your-project/hooks/
```

### 2. Install Dependencies

```bash
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-tabs
npm install lucide-react class-variance-authority clsx tailwind-merge
npm install @supabase/supabase-js  # If using Supabase
```

### 3. Use the Component

```tsx
import { ShipHeroSettings } from '@/components/ShipHeroSettings'

export default function SettingsPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <ShipHeroSettings />
    </div>
  )
}
```

## 📋 Features

### Core Functionality
- **Token Management**: Store and manage ShipHero refresh/access tokens
- **28-Day Countdown**: Live countdown timer showing exact time until token expiration
- **Auto-Refresh**: Automatically refresh tokens before they expire
- **Connection Testing**: Test API connectivity and view warehouse data
- **Order Creation**: Create sales orders and purchase orders directly

### UI Features
- **Responsive Design**: Works on desktop and mobile
- **Color-Coded Alerts**: Green (>7 days), Yellow (3-7 days), Red (<3 days)
- **Live Updates**: Real-time countdown that updates every second
- **Toast Notifications**: Success/error feedback for all actions
- **Detailed Error Display**: Expandable error details for debugging

### Storage Features
- **Multi-Strategy Persistence**: localStorage, IndexedDB, cookies
- **Cross-Domain Support**: Works across subdomains and deployments
- **Automatic Backup**: Multiple storage methods ensure tokens persist

## 🛠️ Configuration

### Environment Variables (Optional)

If using database storage, add to your `.env.local`:

```env
# Supabase (optional - for centralized token storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Database Setup (Optional)

If using Supabase for centralized token storage:

```sql
-- Create tokens table
CREATE TABLE IF NOT EXISTS shiphero_tokens (
  id BIGSERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (optional)
ALTER TABLE shiphero_tokens ENABLE ROW LEVEL SECURITY;
```

## 📁 File Structure

```
shiphero-settings-package/
├── README.md                           # This file
├── components/
│   ├── ShipHeroSettings.tsx           # Main component
│   └── ui/                            # UI components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── table.tsx
│       ├── textarea.tsx
│       └── toast.tsx
├── lib/
│   ├── utils.ts                       # Utility functions
│   └── shiphero/
│       ├── token-manager.ts           # Token management
│       └── database-token-service.ts  # Database integration
├── app/api/shiphero/
│   ├── refresh-token/
│   │   └── route.ts                   # Token refresh API
│   ├── access-token/
│   │   └── route.ts                   # Token storage API
│   ├── warehouses/
│   │   └── route.ts                   # Warehouses API
│   └── orders/
│       └── route.ts                   # Orders API
├── hooks/
│   └── use-toast.ts                   # Toast notifications
└── examples/
    └── usage-example.tsx              # Example implementation
```

## 🎯 Usage Examples

### Basic Usage
```tsx
import { ShipHeroSettings } from '@/components/ShipHeroSettings'

export default function Settings() {
  return <ShipHeroSettings />
}
```

### With Custom Styling
```tsx
import { ShipHeroSettings } from '@/components/ShipHeroSettings'

export default function Settings() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">ShipHero Integration</h1>
        <p className="text-muted-foreground">Manage your ShipHero API connection</p>
      </div>
      <ShipHeroSettings />
    </div>
  )
}
```

### Access Tokens Programmatically
```tsx
import { tokenManager } from '@/lib/shiphero/token-manager'

// Get valid access token (auto-refreshes if needed)
const accessToken = await tokenManager.getValidAccessToken()

// Check if token is valid
const isValid = tokenManager.hasValidAccessToken()

// Manually refresh token
const refreshed = await tokenManager.refreshAccessToken()
```

## 🔧 Customization

### Modify Countdown Colors
Edit `components/ShipHeroSettings.tsx`:

```tsx
// Change color thresholds
const getCountdownColor = (days: number) => {
  if (days <= 1) return 'text-red-600'      // Critical: 1 day
  if (days <= 5) return 'text-yellow-600'   // Warning: 5 days  
  return 'text-green-600'                   // Safe: >5 days
}
```

### Add Custom API Endpoints
Create additional routes in `app/api/shiphero/`:

```tsx
// app/api/shiphero/products/route.ts
export async function GET() {
  const token = await tokenManager.getValidAccessToken()
  // Your custom logic
}
```

### Extend Token Manager
Add custom methods to `lib/shiphero/token-manager.ts`:

```tsx
// Add custom token validation
public async validateTokenWithAPI(): Promise<boolean> {
  // Custom validation logic
}
```

## 🚨 Important Notes

1. **Security**: Refresh tokens are stored securely in multiple locations
2. **Persistence**: Tokens persist across deployments and browser sessions
3. **Auto-Refresh**: Tokens automatically refresh 2 days before expiration
4. **Error Handling**: Comprehensive error handling with detailed feedback
5. **Responsive**: Works on all device sizes

## 📞 Support

This is an exact carbon copy of the ShipHero settings functionality from the touring app. All features work identically:

- Same token management logic
- Same 28-day countdown timer
- Same storage strategies
- Same API integration
- Same UI/UX

Simply drop it into any Next.js application and it will work immediately!
