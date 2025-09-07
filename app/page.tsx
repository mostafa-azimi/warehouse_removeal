"use client"

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataImport } from '@/components/data-import'
import { QRScanner } from '@/components/qr-scanner'
import { ManifestView } from '@/components/manifest-view'
// Simple Settings component that works without API calls
function SimpleSettings({ onConfigChange }: { onConfigChange?: (config: ShipHeroConfig) => void }) {
  const [refreshToken, setRefreshToken] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [savedConfig, setSavedConfig] = useState<ShipHeroConfig | null>(null)

  // Load saved config on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('shiphero-config')
      if (saved) {
        const config = JSON.parse(saved) as ShipHeroConfig
        setSavedConfig(config)
        setRefreshToken(config.refreshToken)
        setAccessToken(config.accessToken || "")
        onConfigChange?.(config)
      }
    } catch (error) {
      console.error('Error loading saved config:', error)
    }
  }, [])

  const saveConfig = () => {
    if (!refreshToken.trim()) {
      alert('Please enter a refresh token')
      return
    }

    const config: ShipHeroConfig = {
      refreshToken: refreshToken.trim(),
      accessToken: accessToken.trim() || undefined,
      tokenExpiry: accessToken.trim() ? new Date(Date.now() + 28 * 24 * 60 * 60 * 1000) : undefined // 28 days
    }

    try {
      localStorage.setItem('shiphero-config', JSON.stringify(config))
      setSavedConfig(config)
      onConfigChange?.(config)
      alert('ShipHero configuration saved successfully!')
    } catch (error) {
      alert('Error saving configuration')
      console.error('Save error:', error)
    }
  }

  const clearConfig = () => {
    localStorage.removeItem('shiphero-config')
    setSavedConfig(null)
    setRefreshToken("")
    setAccessToken("")
    onConfigChange?.(null)
    alert('Configuration cleared')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">ShipHero API Configuration</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Refresh Token *
            </label>
            <input
              type="text"
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
              placeholder="Enter your ShipHero refresh token"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Required: Get this from your ShipHero developer account
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Access Token (Optional)
            </label>
            <input
              type="text"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Enter your ShipHero access token (if you have one)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-sm text-gray-500 mt-1">
              Optional: If you already have an access token, you can enter it here
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={saveConfig}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Save Configuration
            </button>
            
            {savedConfig && (
              <button
                onClick={clearConfig}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Clear Configuration
              </button>
            )}
          </div>
        </div>

        {savedConfig && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <h3 className="text-lg font-medium text-green-800 mb-2">✅ Configuration Saved</h3>
            <div className="text-sm text-green-700 space-y-1">
              <p><strong>Refresh Token:</strong> {savedConfig.refreshToken.substring(0, 20)}...</p>
              {savedConfig.accessToken && (
                <p><strong>Access Token:</strong> {savedConfig.accessToken.substring(0, 20)}...</p>
              )}
              {savedConfig.tokenExpiry && (
                <p><strong>Token Expires:</strong> {new Date(savedConfig.tokenExpiry).toLocaleDateString()}</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="text-lg font-medium text-blue-800 mb-2">💡 How to Generate Access Tokens</h3>
          <div className="text-sm text-blue-700 space-y-2">
            <p>To generate an access token from your refresh token, use this curl command:</p>
            <div className="bg-blue-100 p-3 rounded font-mono text-xs overflow-x-auto">
              curl -X POST -H "Content-Type: application/json" -d<br/>
              '{`{"refresh_token": "YOUR_REFRESH_TOKEN"}`}' \<br/>
              https://public-api.shiphero.com/auth/refresh
            </div>
            <p className="text-xs">
              <strong>Note:</strong> Due to CORS restrictions, access token generation must be done server-side or via curl/Postman.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

import { ShipHeroConfig } from '@/lib/shiphero-api'

// Define types
export interface InventoryItem {
  item: string
  sku: string
  warehouse: string
  location: string
  type: string
  units: number
  activeItem: string
  pickable: string
  sellable: string
  creationDate: string
}

export interface BoxItem {
  sku: string
  quantity: number
  itemName: string
  location: string
}

export interface PackedBox {
  id: string
  items: BoxItem[]
  totalItems: number
  createdAt: string
}

export default function WarehouseApp() {
  const [activeTab, setActiveTab] = useState('data-import')
  const [shipheroConfig, setShipheroConfig] = useState<ShipHeroConfig | null>(null)
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([])
  const [currentBox, setCurrentBox] = useState<BoxItem[]>([])
  const [packedBoxes, setPackedBoxes] = useState<PackedBox[]>([])

  const handleConfigChange = (config: ShipHeroConfig) => {
    setShipheroConfig(config)
  }

  const handleDataImported = (data: InventoryItem[]) => {
    setInventoryData(data)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Warehouse Removal App</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="data-import">Data Import</TabsTrigger>
            <TabsTrigger value="qr-scanner">QR Scanner</TabsTrigger>
            <TabsTrigger value="manifest">Manifest</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="data-import" className="mt-6">
            <DataImport 
              onDataImported={handleDataImported}
              inventoryData={inventoryData}
            />
          </TabsContent>
          
          <TabsContent value="qr-scanner" className="mt-6">
            <QRScanner 
              currentBox={currentBox}
              setCurrentBox={setCurrentBox}
              packedBoxes={packedBoxes}
              setPackedBoxes={setPackedBoxes}
              inventoryData={inventoryData}
            />
          </TabsContent>
          
          <TabsContent value="manifest" className="mt-6">
            <ManifestView 
              shipheroConfig={shipheroConfig}
              packedBoxes={packedBoxes}
            />
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <SimpleSettings onConfigChange={handleConfigChange} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
