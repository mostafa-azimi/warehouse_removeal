# ShipHero Settings Component - Installation Guide

## 🚀 Quick Installation

### Step 1: Copy Files to Your Project

Copy all the files from this package to your Next.js project:

```bash
# Navigate to your project root
cd your-nextjs-project/

# Copy the main component
cp path/to/package/components/ShipHeroSettings.tsx src/components/
# or
cp path/to/package/components/ShipHeroSettings.tsx components/

# Copy UI components (if you don't already have them)
cp -r path/to/package/components/ui/ src/components/ui/
# or
cp -r path/to/package/components/ui/ components/ui/

# Copy utilities and services
cp -r path/to/package/lib/ src/lib/
# or  
cp -r path/to/package/lib/ lib/

# Copy API routes
cp -r path/to/package/app/api/shiphero/ src/app/api/shiphero/
# or
cp -r path/to/package/app/api/shiphero/ app/api/shiphero/

# Copy hooks
cp path/to/package/hooks/use-toast.ts src/hooks/use-toast.ts
# or
cp path/to/package/hooks/use-toast.ts hooks/use-toast.ts
```

### Step 2: Install Required Dependencies

```bash
# Core dependencies
npm install @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-tabs
npm install lucide-react class-variance-authority clsx tailwind-merge

# Optional: If using Supabase for database storage
npm install @supabase/supabase-js
```

### Step 3: Configure Tailwind CSS

Make sure your `tailwind.config.js` includes the component paths:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}', // Add this if using src directory
  ],
  theme: {
    extend: {
      // Your theme extensions
    },
  },
  plugins: [],
}
```

### Step 4: Use the Component

```tsx
// pages/settings.tsx or app/settings/page.tsx
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

## 🛠️ Advanced Configuration

### Database Storage (Optional)

If you want centralized token storage using Supabase:

1. **Set up environment variables** in `.env.local`:

```env
# Supabase configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

2. **Create the database table**:

```sql
-- Run this in your Supabase SQL editor
CREATE TABLE IF NOT EXISTS shiphero_tokens (
  id BIGSERIAL PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: Enable Row Level Security
ALTER TABLE shiphero_tokens ENABLE ROW LEVEL SECURITY;

-- Optional: Create a policy (adjust as needed)
CREATE POLICY "Allow all operations" ON shiphero_tokens FOR ALL USING (true);
```

### Without Database Storage

If you don't want to use Supabase, the component will work perfectly with just localStorage. Simply don't set up the database and the component will use local storage only.

## 📁 File Structure After Installation

Your project should have these files:

```
your-project/
├── components/
│   ├── ShipHeroSettings.tsx          ← Main component
│   └── ui/                           ← UI components
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
│   ├── utils.ts                      ← Utility functions
│   └── shiphero/
│       ├── token-manager.ts          ← Token management
│       └── database-token-service.ts ← Database integration
├── app/api/shiphero/                 ← API routes
│   ├── refresh-token/route.ts
│   ├── access-token/route.ts
│   ├── warehouses/route.ts
│   └── orders/route.ts
├── hooks/
│   └── use-toast.ts                  ← Toast notifications
└── .env.local                        ← Environment variables
```

## 🔧 Customization

### Change Countdown Colors

Edit `components/ShipHeroSettings.tsx` to modify the color scheme:

```tsx
// Find this section and modify the color classes
const getCountdownColor = (days: number) => {
  if (days <= 3) return 'text-red-600'      // Critical
  if (days <= 7) return 'text-yellow-600'   // Warning  
  return 'text-green-600'                   // Safe
}
```

### Add Custom API Endpoints

Create additional API routes in `app/api/shiphero/`:

```tsx
// app/api/shiphero/custom/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { tokenManager } from '@/lib/shiphero/token-manager'

export async function GET(request: NextRequest) {
  try {
    const accessToken = await tokenManager.getValidAccessToken()
    
    if (!accessToken) {
      return NextResponse.json({ error: 'No valid access token' }, { status: 401 })
    }

    // Your custom ShipHero API call
    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'your custom GraphQL query'
      })
    })

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    return NextResponse.json({ error: 'API call failed' }, { status: 500 })
  }
}
```

### Modify Storage Strategy

Edit `lib/shiphero/token-manager.ts` to customize storage behavior:

```tsx
// Modify storage strategies
private storeTokens(tokenData: TokenData): void {
  try {
    // Strategy 1: localStorage (always enabled)
    localStorage.setItem('shiphero_access_token', tokenData.accessToken)
    
    // Strategy 2: sessionStorage (add this for session-only storage)
    sessionStorage.setItem('shiphero_session_token', tokenData.accessToken)
    
    // Strategy 3: IndexedDB (already included)
    this.storeInIndexedDB(tokenData)
    
    // Strategy 4: Custom storage (add your own)
    this.storeInCustomStorage(tokenData)
    
  } catch (error) {
    console.error('❌ Failed to store tokens:', error)
  }
}
```

## 🚨 Troubleshooting

### Common Issues

1. **"Cannot find module '@/components/ui/button'"**
   - Make sure you copied all UI components
   - Check your tsconfig.json has the correct path mapping

2. **"API route not found"**
   - Ensure you copied all API routes to the correct directory
   - Check your Next.js app directory structure (app/ vs pages/)

3. **Toast notifications not working**
   - Make sure you copied the `use-toast.ts` hook
   - Ensure Radix UI dependencies are installed

4. **Styles not applying**
   - Check Tailwind CSS is configured correctly
   - Ensure component paths are in tailwind.config.js

### Path Mapping

Make sure your `tsconfig.json` has the correct path mapping:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"]
    }
  }
}
```

Or if not using src directory:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"],
      "@/components/*": ["./components/*"],
      "@/lib/*": ["./lib/*"],
      "@/hooks/*": ["./hooks/*"]
    }
  }
}
```

## ✅ Verification

After installation, test the component:

1. **Start your development server**: `npm run dev`
2. **Navigate to your settings page**
3. **Paste a ShipHero refresh token**
4. **Click "Generate New Access Token"**
5. **Verify the 28-day countdown appears**
6. **Test the connection with "Test Connection"**

If everything works, you should see:
- ✅ Token saved successfully
- ✅ 28-day countdown timer
- ✅ Connection test shows your warehouses
- ✅ No console errors

## 📞 Support

This component is an exact replica of the ShipHero settings functionality. If you encounter issues:

1. Check the console for error messages
2. Verify all files were copied correctly
3. Ensure dependencies are installed
4. Check your environment configuration

The component includes comprehensive error handling and logging to help debug any issues.
