import { ShipHeroSettings } from '@/components/ShipHeroSettings'
import { tokenManager } from '@/lib/shiphero/token-manager'
import { useEffect, useState } from 'react'

// Example 1: Basic Usage
export function BasicUsage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">ShipHero Settings</h1>
      <ShipHeroSettings />
    </div>
  )
}

// Example 2: With Custom Styling
export function CustomStyledUsage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ShipHero Integration</h1>
          <p className="text-gray-600 mt-2">Manage your ShipHero API connection and tokens</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm">
          <ShipHeroSettings />
        </div>
      </div>
    </div>
  )
}

// Example 3: Programmatic Token Access
export function ProgrammaticUsage() {
  const [tokenStatus, setTokenStatus] = useState<{
    hasToken: boolean
    isValid: boolean
    expiresAt?: string
  }>({ hasToken: false, isValid: false })

  useEffect(() => {
    const checkTokenStatus = async () => {
      const hasValid = tokenManager.hasValidAccessToken()
      const token = await tokenManager.getValidAccessToken()
      
      setTokenStatus({
        hasToken: !!token,
        isValid: hasValid,
        expiresAt: localStorage.getItem('shiphero_token_expires_at') || undefined
      })
    }

    checkTokenStatus()
    
    // Check every minute
    const interval = setInterval(checkTokenStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  const handleApiCall = async () => {
    try {
      const accessToken = await tokenManager.getValidAccessToken()
      
      if (!accessToken) {
        alert('No valid access token available. Please configure ShipHero settings first.')
        return
      }

      // Make your API call
      const response = await fetch('/api/shiphero/warehouses', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('API call successful:', data)
        alert('API call successful! Check console for data.')
      } else {
        throw new Error(`API call failed: ${response.status}`)
      }
    } catch (error) {
      console.error('API call error:', error)
      alert(`API call failed: ${error}`)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">ShipHero Integration with Programmatic Access</h1>
      
      {/* Token Status Display */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Token Status</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${tokenStatus.hasToken ? 'bg-green-500' : 'bg-red-500'}`}></span>
            <span>Token Available: {tokenStatus.hasToken ? 'Yes' : 'No'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${tokenStatus.isValid ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
            <span>Token Valid: {tokenStatus.isValid ? 'Yes' : 'No (will auto-refresh)'}</span>
          </div>
          {tokenStatus.expiresAt && (
            <div className="text-sm text-gray-600">
              Expires: {new Date(tokenStatus.expiresAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* Test API Call Button */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-3">Test API Access</h2>
        <button
          onClick={handleApiCall}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          disabled={!tokenStatus.hasToken}
        >
          Test ShipHero API Call
        </button>
        <p className="text-sm text-gray-600 mt-2">
          This will make a test call to the ShipHero warehouses API using the stored token.
        </p>
      </div>

      {/* Settings Component */}
      <ShipHeroSettings />
    </div>
  )
}

// Example 4: In a Tab Layout
export function TabLayoutUsage() {
  const [activeTab, setActiveTab] = useState('shiphero')

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Application Settings</h1>
      
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'general', name: 'General' },
            { id: 'shiphero', name: 'ShipHero' },
            { id: 'notifications', name: 'Notifications' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === 'general' && (
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">General Settings</h2>
            <p className="text-gray-600">Your general application settings would go here.</p>
          </div>
        )}
        
        {activeTab === 'shiphero' && <ShipHeroSettings />}
        
        {activeTab === 'notifications' && (
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Notification Settings</h2>
            <p className="text-gray-600">Your notification settings would go here.</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Export all examples
export default {
  BasicUsage,
  CustomStyledUsage,
  ProgrammaticUsage,
  TabLayoutUsage
}
