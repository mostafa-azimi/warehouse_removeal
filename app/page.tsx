"use client"

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ShipHeroConfig, ShipHeroAPI } from '@/lib/shiphero-api'

// Step-by-step Settings component for debugging
function MinimalSettings({ onConfigChange }: { onConfigChange?: (config: ShipHeroConfig) => void }) {
  const [token, setToken] = useState("")
  const [api, setApi] = useState<ShipHeroAPI | null>(null)
  
  // Step 3: Add ShipHero API initialization
  useEffect(() => {
    console.log('useEffect running - loading from localStorage')
    const config = loadFromStorage()
    if (config) {
      console.log('Auto-loaded config:', config)
      
      // Initialize ShipHero API
      try {
        console.log('Creating ShipHero API instance...')
        const apiInstance = new ShipHeroAPI(config)
        setApi(apiInstance)
        console.log('ShipHero API instance created successfully')
        onConfigChange?.(config)
      } catch (error) {
        console.error('Error creating ShipHero API instance:', error)
      }
    }
  }, []) // Empty dependency array - should only run once
  
  // Step 1: Add localStorage operations
  const saveToStorage = (config: ShipHeroConfig) => {
    try {
      localStorage.setItem('shiphero-config', JSON.stringify(config))
      console.log('Saved to localStorage:', config)
    } catch (error) {
      console.error('localStorage save error:', error)
    }
  }
  
  const loadFromStorage = () => {
    try {
      const saved = localStorage.getItem('shiphero-config')
      if (saved) {
        const config = JSON.parse(saved) as ShipHeroConfig
        setToken(config.refreshToken)
        console.log('Loaded from localStorage:', config)
        return config
      }
    } catch (error) {
      console.error('localStorage load error:', error)
    }
    return null
  }
  
  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-4">
      <h2 className="text-xl font-semibold">ShipHero Settings - Step 3: API Init</h2>
      
      <div className="space-y-2">
        <label className="block text-sm font-medium">Refresh Token:</label>
        <input
          type="text"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Enter your ShipHero refresh token"
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        />
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (token.trim()) {
              const config = { refreshToken: token.trim() }
              saveToStorage(config)
              
              // Initialize API when saving
              try {
                console.log('Creating ShipHero API instance on save...')
                const apiInstance = new ShipHeroAPI(config)
                setApi(apiInstance)
                console.log('API instance created on save')
                onConfigChange?.(config)
                alert('Token saved and API initialized!')
              } catch (error) {
                console.error('Error creating API instance on save:', error)
                alert('Token saved but API initialization failed')
              }
            } else {
              alert('Please enter a token')
            }
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Save Token
        </button>
        
        <button
          onClick={() => {
            const config = loadFromStorage()
            if (config) {
              alert('Token loaded from localStorage!')
            } else {
              alert('No saved token found')
            }
          }}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
        >
          Load Token
        </button>
      </div>
    </div>
  )
}

export default function WarehouseApp() {
  const [activeTab, setActiveTab] = useState('test')
  const [shipheroConfig, setShipheroConfig] = useState<ShipHeroConfig | null>(null)

  const handleConfigChange = (config: ShipHeroConfig) => {
    setShipheroConfig(config)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Warehouse Removal App - Testing</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="test">Test Tab</TabsTrigger>
            <TabsTrigger value="data-import">Data Import</TabsTrigger>
            <TabsTrigger value="qr-scanner">QR Scanner</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="test" className="mt-6">
            <div className="p-6 bg-white rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Test Tab - Working!</h2>
              <p>If you can see this and switch tabs, the basic structure works.</p>
              <button 
                onClick={() => alert('Tab system works!')}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Test Button
              </button>
            </div>
          </TabsContent>
          
          <TabsContent value="data-import" className="mt-6">
            <div className="p-6 bg-white rounded-lg shadow">
              <p>Data Import tab - placeholder</p>
            </div>
          </TabsContent>
          
          <TabsContent value="qr-scanner" className="mt-6">
            <div className="p-6 bg-white rounded-lg shadow">
              <p>QR Scanner tab - placeholder</p>
            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <MinimalSettings onConfigChange={handleConfigChange} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
