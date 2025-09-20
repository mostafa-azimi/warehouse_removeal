"use client"

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataImport } from '@/components/data-import'
import { QRScanner } from '@/components/qr-scanner'
import { ManifestView } from '@/components/manifest-view'
import { ShipHeroConfig } from '@/lib/shiphero-api'
// Simple Settings component that works without API calls
interface Warehouse {
  id: string
  identifier: string
  name: string
  address: {
    name: string
    address1: string
    address2: string
    city: string
    state: string
    zip: string
    country: string
  }
  is_active: boolean
  decodedId: string
}

function SimpleSettings({ onConfigChange }: { onConfigChange?: (config: ShipHeroConfig) => void }) {
  const [refreshToken, setRefreshToken] = useState("")
  const [accessToken, setAccessToken] = useState("")
  const [savedConfig, setSavedConfig] = useState<ShipHeroConfig | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  
  // 3PL Customer Account functionality
  const [is3PLMode, setIs3PLMode] = useState(false)
  const [customerAccountId, setCustomerAccountId] = useState("")
  const [isLoadingProducts, setIsLoadingProducts] = useState(false)
  const [productLocations, setProductLocations] = useState<any[]>([])
  const [showProductData, setShowProductData] = useState(false)

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
    if (onConfigChange) onConfigChange(null as any)
    alert('Configuration cleared')
  }

  const generateAccessToken = async () => {
    console.log('[FRONTEND] Starting access token generation')
    
    if (!refreshToken.trim()) {
      console.log('[FRONTEND] ERROR: No refresh token provided')
      alert('Please enter a refresh token first')
      return
    }

    console.log('[FRONTEND] Refresh token length:', refreshToken.trim().length)
    setIsGenerating(true)
    
    try {
      console.log('[FRONTEND] Making request to /api/shiphero/refresh')
      const response = await fetch('/api/shiphero/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: refreshToken.trim()
        })
      })

      console.log('[FRONTEND] Response status:', response.status, response.statusText)

      if (!response.ok) {
        const error = await response.json()
        console.error('[FRONTEND] API error response:', error)
        throw new Error(error.error || 'Failed to generate access token')
      }

      const data = await response.json()
      console.log('[FRONTEND] Success! Received token data:', {
        access_token: data.access_token ? data.access_token.substring(0, 20) + '...' : 'undefined',
        expires_in: data.expires_in,
        token_type: data.token_type,
        scope: data.scope
      })
      
      // Update the access token field
      setAccessToken(data.access_token)
      
      // Save the updated configuration
      const config: ShipHeroConfig = {
        refreshToken: refreshToken.trim(),
        accessToken: data.access_token,
        tokenExpiry: new Date(Date.now() + data.expires_in * 1000) // expires_in is in seconds
      }

      console.log('[FRONTEND] Saving config to localStorage:', {
        refreshToken: config.refreshToken.substring(0, 20) + '...',
        accessToken: config.accessToken?.substring(0, 20) + '...',
        tokenExpiry: config.tokenExpiry?.toISOString()
      })

      localStorage.setItem('shiphero-config', JSON.stringify(config))
      setSavedConfig(config)
      onConfigChange?.(config)
      
      alert(`Access token generated successfully! Expires in ${Math.round(data.expires_in / (24 * 60 * 60))} days.`)
      
    } catch (error) {
      console.error('[FRONTEND] Error generating access token:', error)
      console.error('[FRONTEND] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`)
    } finally {
      console.log('[FRONTEND] Token generation complete, setting loading to false')
      setIsGenerating(false)
    }
  }

  const testConnection = async () => {
    console.log('[FRONTEND] Starting connection test')
    const currentAccessToken = accessToken || savedConfig?.accessToken
    
    console.log('[FRONTEND] Access token available:', !!currentAccessToken)
    console.log('[FRONTEND] Access token length:', currentAccessToken?.length || 'undefined')
    
    if (!currentAccessToken) {
      console.log('[FRONTEND] ERROR: No access token available')
      alert('Please generate an access token first')
      return
    }

    setIsTesting(true)
    setConnectionStatus('idle')
    
    try {
      console.log('[FRONTEND] Making request to /api/shiphero/warehouses')
      const response = await fetch('/api/shiphero/warehouses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: currentAccessToken
        })
      })

      console.log('[FRONTEND] Warehouses API response status:', response.status, response.statusText)

      if (!response.ok) {
        const error = await response.json()
        console.error('[FRONTEND] Warehouses API error response:', error)
        throw new Error(error.error || 'Failed to test connection')
      }

      const data = await response.json()
      console.log('[FRONTEND] Success! Received warehouse data:', data)
      console.log('[FRONTEND] Full data structure:', JSON.stringify(data, null, 2))
      
      // Extract warehouses from the correct GraphQL response structure based on documentation
      let warehouses = []
      if (data.data?.account?.data?.warehouses) {
        // Correct path based on ShipHero documentation: data.account.data.warehouses
        warehouses = data.data.account.data.warehouses
        console.log('[FRONTEND] Found warehouses at: data.data.account.data.warehouses (from GraphQL response)')
      } else if (data.account?.data?.warehouses) {
        // Alternative path if data wrapper is missing
        warehouses = data.account.data.warehouses
        console.log('[FRONTEND] Found warehouses at: data.account.data.warehouses')
      } else {
        console.log('[FRONTEND] Could not find warehouses in response. Available keys:', Object.keys(data))
        if (data.data) console.log('[FRONTEND] data.data keys:', Object.keys(data.data))
        if (data.account) console.log('[FRONTEND] data.account keys:', Object.keys(data.account))
        if (data.data?.account) console.log('[FRONTEND] data.data.account keys:', Object.keys(data.data.account))
        if (data.data?.account?.data) console.log('[FRONTEND] data.data.account.data keys:', Object.keys(data.data.account.data))
      }
      
      console.log('[FRONTEND] Extracted warehouses:', warehouses)
      console.log('[FRONTEND] Warehouse count:', warehouses.length)
      
      // Transform the warehouse data to match the expected format based on actual API response
      const transformedWarehouses = warehouses.map((warehouse: any) => ({
        id: warehouse.id,
        identifier: warehouse.identifier,
        name: warehouse.address?.name || warehouse.identifier, // Use address name or fallback to identifier
        address: {
          name: warehouse.address?.name || '',
          address1: warehouse.address?.address1 || '',
          address2: warehouse.address?.address2 || '',
          city: warehouse.address?.city || '',
          state: warehouse.address?.state || '',
          zip: warehouse.address?.zip || '',
          country: warehouse.address?.country || ''
        },
        is_active: true, // Assume active since it's returned from API
        decodedId: warehouse.legacy_id?.toString() || warehouse.id,
        // Additional fields from the actual API response
        account_id: warehouse.account_id,
        dynamic_slotting: warehouse.dynamic_slotting,
        invoice_email: warehouse.invoice_email,
        phone_number: warehouse.phone_number,
        profile: warehouse.profile
      }))
      
      setWarehouses(transformedWarehouses)
      setConnectionStatus('success')
      
    } catch (error) {
      console.error('[FRONTEND] Error testing connection:', error)
      console.error('[FRONTEND] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      setConnectionStatus('error')
      setWarehouses([])
      alert(`Connection test failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`)
    } finally {
      console.log('[FRONTEND] Connection test complete, setting testing to false')
      setIsTesting(false)
    }
  }

  const loadProductLocations = async () => {
    console.log('[FRONTEND] Starting product locations query')
    const currentAccessToken = accessToken || savedConfig?.accessToken
    
    if (!currentAccessToken) {
      alert('Please generate an access token first')
      return
    }

    if (!customerAccountId.trim()) {
      alert('Please enter a customer account ID')
      return
    }

    setIsLoadingProducts(true)
    setProductLocations([])
    
    try {
      console.log('[FRONTEND] Making request to /api/shiphero/product-locations')
      const response = await fetch('/api/shiphero/product-locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken: currentAccessToken,
          customerAccountId: customerAccountId.trim()
        })
      })

      console.log('[FRONTEND] Product locations API response status:', response.status, response.statusText)

      if (!response.ok) {
        const error = await response.json()
        console.error('[FRONTEND] Product locations API error response:', error)
        throw new Error(error.error || 'Failed to load product locations')
      }

      const data = await response.json()
      console.log('[FRONTEND] Success! Received product locations data:', data)
      
      // Extract products from the GraphQL response
      const products = data.data?.warehouse_products?.data?.edges?.map((edge: any) => edge.node) || []
      console.log('[FRONTEND] Extracted products:', products.length)
      
      setProductLocations(products)
      setShowProductData(true)
      
    } catch (error) {
      console.error('[FRONTEND] Error loading product locations:', error)
      alert(`Failed to load product locations: ${error instanceof Error ? error.message : 'Unknown error occurred'}`)
    } finally {
      setIsLoadingProducts(false)
    }
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
          
          <div className="flex flex-wrap gap-3 pt-4">
            <button
              onClick={saveConfig}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Save Configuration
            </button>
            
            <button
              onClick={generateAccessToken}
              disabled={!refreshToken.trim() || isGenerating}
              className={`px-4 py-2 text-white rounded-md focus:outline-none focus:ring-2 ${
                !refreshToken.trim() || isGenerating
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
              }`}
            >
              {isGenerating ? 'Generating...' : '🔄 Generate Access Token'}
            </button>
            
            <button
              onClick={testConnection}
              disabled={!(accessToken || savedConfig?.accessToken) || isTesting}
              className={`px-4 py-2 text-white rounded-md focus:outline-none focus:ring-2 ${
                !(accessToken || savedConfig?.accessToken) || isTesting
                  ? 'bg-gray-400 cursor-not-allowed'
                  : connectionStatus === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500'
                    : connectionStatus === 'error'
                      ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                      : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'
              }`}
            >
              {isTesting ? 'Testing...' : connectionStatus === 'success' ? '✅ Test Connection' : '🔗 Test Connection'}
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

        {warehouses.length > 0 && (
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">
              Connection Test Results
            </h3>
            <div className="mb-4">
              <span className="text-blue-700 font-medium">
                Status: Connected successfully • {warehouses.length} warehouses found
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-blue-200 bg-white rounded-lg shadow-sm">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-blue-900 uppercase tracking-wider">
                      Address
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-blue-100">
                  {warehouses.map((warehouse, index) => (
                    <tr key={warehouse.id} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                        {warehouse.decodedId}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {warehouse.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        <div className="space-y-1">
                          <div>{warehouse.address.address1}</div>
                          {warehouse.address.address2 && <div>{warehouse.address.address2}</div>}
                          <div className="text-gray-500">
                            {warehouse.address.city}, {warehouse.address.state} {warehouse.address.zip}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

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
