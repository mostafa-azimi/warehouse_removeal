"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RefreshCw, TestTube, Plus, ShoppingCart, Package, Copy } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

export function ShipHeroSettings() {
  const [refreshToken, setRefreshToken] = useState("")
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null)
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  } | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [tokenSaved, setTokenSaved] = useState(false)

  const [isTesting, setIsTesting] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)
  const [showAdhocOrder, setShowAdhocOrder] = useState(false)
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [showAdhocPO, setShowAdhocPO] = useState(false)
  const [isCreatingPO, setIsCreatingPO] = useState(false)
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [hosts, setHosts] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [allProducts, setAllProducts] = useState<any[]>([])
  const [adhocOrderData, setAdhocOrderData] = useState({
    warehouseId: '',
    hostId: '',
    productIds: [] as string[],
    notes: '',
    orderDate: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]
  })
  const [adhocPOData, setAdhocPOData] = useState({
    warehouseId: '',
    hostId: '',
    productIds: [] as string[],
    productQuantities: {} as Record<string, number>,
    notes: '',
    poDate: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0]
  })
  const [lastError, setLastError] = useState<string | null>(null)
  const [lastOrderResponse, setLastOrderResponse] = useState<any>(null)
  const [lastPOResponse, setLastPOResponse] = useState<any>(null)

  const { toast } = useToast()

  // Filter products by selected warehouse
  const filterProductsByWarehouse = (warehouseId: string) => {
    if (!warehouseId || !allProducts.length) {
      setProducts([])
      return
    }

    const selectedWarehouse = warehouses.find(w => w.id === warehouseId)
    if (!selectedWarehouse) {
      setProducts([])
      return
    }

    const filteredProducts = allProducts.filter(product => {
      return product.warehouse_id === selectedWarehouse.shiphero_warehouse_id
    })

    console.log('🏭 Filtering products by warehouse:', {
      warehouseId,
      warehouseName: selectedWarehouse.name,
      shipHeroWarehouseId: selectedWarehouse.shiphero_warehouse_id,
      totalProducts: allProducts.length,
      filteredProducts: filteredProducts.length,
      sampleFiltered: filteredProducts.slice(0, 3).map(p => ({ sku: p.sku, available: p.available }))
    })

    setProducts(filteredProducts)
  }

  useEffect(() => {
    const savedToken = localStorage.getItem('shiphero_refresh_token') || ''
    const savedExpiresAt = localStorage.getItem('shiphero_token_expires_at')
    const savedAccessToken = localStorage.getItem('shiphero_access_token')
    
    setRefreshToken(savedToken)
    setTokenExpiresAt(savedExpiresAt)
    
    if (savedExpiresAt) {
      calculateCountdown(savedExpiresAt)
    }

    const autoRefreshToken = async () => {
      if (savedToken && savedExpiresAt) {
        const expirationDate = new Date(savedExpiresAt)
        const now = new Date()
        const minutesUntilExpiry = (expirationDate.getTime() - now.getTime()) / (1000 * 60)
        
        const oneDayInMinutes = 24 * 60
        if (minutesUntilExpiry < oneDayInMinutes) {
          try {
            await handleGenerateAccessToken()
          } catch (error) {
            console.error('Failed to auto-refresh access token:', error)
          }
        }
      }
    }

    if (savedAccessToken) {
      autoRefreshToken().then(() => {
        loadAdhocOrderData()
      })
    }
  }, [])

  useEffect(() => {
    if (!tokenExpiresAt) return

    const updateCountdown = () => {
      calculateCountdown(tokenExpiresAt)
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 1000)
    return () => clearInterval(interval)
  }, [tokenExpiresAt])

  const calculateCountdown = (expiresAt: string) => {
    const expirationDate = new Date(expiresAt)
    const now = new Date()
    const diffTime = expirationDate.getTime() - now.getTime()
    
    if (diffTime <= 0) {
      setCountdown({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true
      })
      setDaysRemaining(0)
      return
    }

    const days = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diffTime % (1000 * 60)) / 1000)

    setCountdown({
      days,
      hours,
      minutes,
      seconds,
      isExpired: false
    })
    
    setDaysRemaining(Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24))))
  }

  const loadAdhocOrderData = async () => {
    console.log('🔄 Loading adhoc order data...')
    const startTime = Date.now()
    
    try {
      const accessToken = localStorage.getItem('shiphero_access_token')
      
      if (!accessToken) {
        throw new Error('No ShipHero access token available. Please generate a new access token first.')
      }

      console.log('📡 Making parallel API calls...')
      const [warehousesResponse, productsResponse] = await Promise.all([
        fetch('/api/shiphero/warehouses', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }),
        
        fetch('/api/shiphero/inventory', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })
      ])

      // Process warehouses
      if (!warehousesResponse.ok) {
        throw new Error('Failed to fetch ShipHero warehouses')
      }
      const warehousesResult = await warehousesResponse.json()
      const shipHeroWarehouses = warehousesResult.data?.account?.data?.warehouses || []
      
      const transformedWarehouses = shipHeroWarehouses.map((warehouse: any) => ({
        id: warehouse.id,
        name: warehouse.address?.name || warehouse.identifier,
        code: warehouse.identifier || '',
        address: warehouse.address?.address1 || '',
        city: warehouse.address?.city || '',
        state: warehouse.address?.state || '',
        zip: warehouse.address?.zip || '',
        shiphero_warehouse_id: warehouse.id
      }))
      setWarehouses(transformedWarehouses)

      // Process products
      if (!productsResponse.ok) {
        throw new Error('Failed to fetch ShipHero products')
      }
      const productsResult = await productsResponse.json()
      const shipHeroProducts = productsResult.products || []
      
      const transformedProducts = shipHeroProducts
        .filter((product: any) => product.active)
        .map((product: any) => ({
          id: product.sku,
          name: product.name,
          sku: product.sku,
          available: product.inventory?.available || 0,
          warehouse_name: product.inventory?.warehouse_name || 'Unknown',
          warehouse_id: product.inventory?.warehouse_id || null
        }))
      
      setAllProducts(transformedProducts)
      setProducts([])

      // Set sample hosts for demo
      setHosts([
        { id: '1', first_name: 'John', last_name: 'Smith', email: 'john.smith@example.com' },
        { id: '2', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah.johnson@example.com' },
        { id: '3', first_name: 'Mike', last_name: 'Davis', email: 'mike.davis@example.com' }
      ])

      const loadTime = Date.now() - startTime
      console.log(`✅ Adhoc order data loaded in ${loadTime}ms`, {
        hosts: 3,
        warehouses: transformedWarehouses.length,
        products: transformedProducts.length
      })
      
    } catch (error: any) {
      const loadTime = Date.now() - startTime
      console.error(`❌ Error loading adhoc order data (${loadTime}ms):`, error)
      toast({
        title: "Error Loading Data",
        description: `Failed to load data: ${error.message}`,
        variant: "destructive",
      })
    }
  }

  const handleGenerateAccessToken = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch('/api/shiphero/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        })
      })

      if (response.ok) {
        const data = await response.json()
        console.log('🎉 ShipHero API response:', { 
          hasAccessToken: !!data.access_token, 
          expiresIn: data.expires_in,
          tokenStart: data.access_token ? data.access_token.substring(0, 20) + '...' : 'none'
        })
        const newAccessToken = data.access_token
        const expiresIn = data.expires_in
        
        if (newAccessToken) {
          localStorage.setItem('shiphero_access_token', newAccessToken)
          localStorage.setItem('shiphero_refresh_token', refreshToken)
          
          const expirationDate = new Date(Date.now() + (expiresIn * 1000))
          localStorage.setItem('shiphero_token_expires_at', expirationDate.toISOString())
          setTokenExpiresAt(expirationDate.toISOString())
          
          // Store in database if available
          try {
            console.log('💾 Storing tokens in database...')
            const dbResponse = await fetch('/api/shiphero/access-token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                access_token: newAccessToken,
                refresh_token: refreshToken,
                expires_in: expiresIn
              })
            })
            
            if (dbResponse.ok) {
              console.log('✅ Tokens stored in database successfully')
            } else {
              console.warn('⚠️ Failed to store tokens in database, but localStorage still works')
            }
          } catch (dbError) {
            console.warn('⚠️ Database token storage failed:', dbError)
          }
          
          calculateCountdown(expirationDate.toISOString())
          setShowSuccessModal(true)
        } else {
          throw new Error('No access token received from refresh')
        }
      } else {
        const errorData = await response.json()
        console.error('ShipHero refresh token error:', errorData)
        throw new Error(errorData.error || `Failed to refresh token (${response.status})`)
      }
    } catch (error: any) {
      toast({
        title: "Refresh Failed",
        description: error.message || "Failed to refresh token",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleConnectionTest = async () => {
    setIsTesting(true)
    try {
      if (!refreshToken) {
        throw new Error('No refresh token available. Please enter your refresh token first.')
      }
      
      const tokenResponse = await fetch('/api/shiphero/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        })
      })
      
      if (!tokenResponse.ok) {
        throw new Error('Failed to get access token from refresh token')
      }
      
      const tokenData = await tokenResponse.json()
      const accessToken = tokenData.access_token
      
      if (!accessToken) {
        throw new Error('No access token received from refresh token')
      }
      
      const warehousesResponse = await fetch('/api/shiphero/warehouses', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!warehousesResponse.ok) {
        throw new Error(`Warehouses query failed: ${warehousesResponse.status}`)
      }
      
      const warehousesResult = await warehousesResponse.json()
      setTestResults(warehousesResult)
      
      const warehouseCount = warehousesResult.data?.account?.data?.warehouses?.length || 0
      
      toast({
        title: "Connection Test Successful",
        description: `Connected to ShipHero API! Found ${warehouseCount} warehouse${warehouseCount !== 1 ? 's' : ''}`,
      })
    } catch (error: any) {
      setTestResults({ error: error.message })
      toast({
        title: "Connection Test Failed",
        description: error.message || "Failed to connect to ShipHero API",
        variant: "destructive",
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>ShipHero API Connection</CardTitle>
          <CardDescription>
            {refreshToken ? 
              "Connected to ShipHero API. Generate a new access token or test your connection." : 
              "Enter your ShipHero refresh token below to enable API access and tour finalization."
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Refresh Token Input Section */}
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="refreshToken">ShipHero Refresh Token</Label>
              <div className="flex gap-2">
                <Input
                  id="refreshToken"
                  type="password"
                  placeholder="Paste your ShipHero refresh token here"
                  value={refreshToken}
                  onChange={(e) => setRefreshToken(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => {
                    localStorage.setItem('shiphero_refresh_token', refreshToken)
                    localStorage.removeItem('shiphero_token_expires_at')
                    setTokenExpiresAt(null)
                    setDaysRemaining(null)
                    console.log('✅ Refresh token saved to localStorage')
                    
                    setTokenSaved(true)
                    setTimeout(() => setTokenSaved(false), 3000)
                    
                    toast({
                      title: "✅ Refresh Token Saved",
                      description: "Your ShipHero refresh token has been saved securely. Generate a new access token to start the 28-day countdown.",
                    })
                  }}
                  disabled={!refreshToken.trim()}
                  variant={tokenSaved ? "default" : "outline"}
                  className={tokenSaved 
                    ? "bg-green-600 hover:bg-green-700 text-white border-green-600" 
                    : "bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
                  }
                >
                  {tokenSaved ? "✅ Saved!" : "Save Token"}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Enter your ShipHero refresh token to enable API access. This token is stored locally and securely in your browser.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleGenerateAccessToken}
              disabled={isRefreshing || !refreshToken}
              variant="default"
              className="flex-1"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? "Generating..." : "Generate New Access Token"}
            </Button>
            
            <Button
              onClick={handleConnectionTest}
              disabled={isTesting || !refreshToken}
              variant="outline"
              className="flex-1"
            >
              <TestTube className={`h-4 w-4 mr-2 ${isTesting ? 'animate-pulse' : ''}`} />
              {isTesting ? "Testing..." : "Test Connection"}
            </Button>
          </div>
          
          {refreshToken && (
            <div className="text-sm bg-muted p-4 rounded-lg space-y-2">
              <p className="flex items-center gap-2">
                <span className="text-green-600">✅</span>
                <span>API credentials are configured and stored securely</span>
              </p>
              {countdown !== null ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2">
                    <span className={`text-lg ${countdown.days <= 3 ? 'text-red-600' : countdown.days <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                      ⏰
                    </span>
                    <span className={countdown.days <= 3 ? 'text-red-600 font-medium' : countdown.days <= 7 ? 'text-yellow-600' : 'text-green-600'}>
                      {countdown.isExpired ? 'Token has expired! Generate a new one immediately.' :
                       countdown.days === 0 ? 'Token expires today! Generate a new one immediately.' :
                       `Token expires in ${countdown.days} day${countdown.days !== 1 ? 's' : ''}`}
                    </span>
                  </p>
                  {!countdown.isExpired && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Live Countdown:</p>
                      <div className="flex items-center gap-4 font-mono text-lg">
                        <div className="text-center">
                          <div className={`font-bold ${countdown.days <= 3 ? 'text-red-600' : countdown.days <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {countdown.days.toString().padStart(2, '0')}
                          </div>
                          <div className="text-xs text-gray-500">DAYS</div>
                        </div>
                        <div className="text-gray-400">:</div>
                        <div className="text-center">
                          <div className={`font-bold ${countdown.days <= 3 ? 'text-red-600' : countdown.days <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {countdown.hours.toString().padStart(2, '0')}
                          </div>
                          <div className="text-xs text-gray-500">HOURS</div>
                        </div>
                        <div className="text-gray-400">:</div>
                        <div className="text-center">
                          <div className={`font-bold ${countdown.days <= 3 ? 'text-red-600' : countdown.days <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {countdown.minutes.toString().padStart(2, '0')}
                          </div>
                          <div className="text-xs text-gray-500">MINS</div>
                        </div>
                        <div className="text-gray-400">:</div>
                        <div className="text-center">
                          <div className={`font-bold ${countdown.days <= 3 ? 'text-red-600' : countdown.days <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {countdown.seconds.toString().padStart(2, '0')}
                          </div>
                          <div className="text-xs text-gray-500">SECS</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="flex items-center gap-2">
                  <span className="text-blue-600">💡</span>
                  <span>Generate a new access token to start the 28-day countdown</span>
                </p>
              )}
            </div>
          )}

          {testResults && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-3">Connection Test Results</h4>
              {testResults.error ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-sm">
                  <strong>Error:</strong> {testResults.error}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-blue-700">
                    <strong>Status:</strong> Connected successfully
                    {testResults.data?.account?.data?.warehouses && (
                      <span className="ml-2">
                        • <strong>{testResults.data.account.data.warehouses.length}</strong> warehouses found
                      </span>
                    )}
                  </div>
                  
                  {testResults.data?.account?.data?.warehouses && Array.isArray(testResults.data.account.data.warehouses) && testResults.data.account.data.warehouses.length > 0 && (
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Address</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {testResults.data.account.data.warehouses.map((warehouse: any, index: number) => {
                            if (!warehouse || typeof warehouse !== 'object') {
                              return (
                                <TableRow key={index}>
                                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                                    Invalid warehouse data
                                  </TableCell>
                                </TableRow>
                              )
                            }
                            
                            return (
                              <TableRow key={warehouse.id || index}>
                                <TableCell className="font-mono text-xs">{String(warehouse.id || '-')}</TableCell>
                                <TableCell className="font-medium">
                                  {String(
                                    warehouse.address?.name || 
                                    warehouse.name || 
                                    warehouse.title || 
                                    warehouse.display_name || 
                                    warehouse.identifier || 
                                    '-'
                                  )}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {warehouse.address ? (
                                    <div>
                                      {typeof warehouse.address === 'object' ? (
                                        <div>
                                          <div>{String(warehouse.address.address1 || warehouse.address.address || '-')}</div>
                                          {warehouse.address.address2 && (
                                            <div>{String(warehouse.address.address2)}</div>
                                          )}
                                          {warehouse.address.city && warehouse.address.state && (
                                            <div className="text-muted-foreground">
                                              {String(warehouse.address.city)}, {String(warehouse.address.state)} {String(warehouse.address.zip || '')}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div>{String(warehouse.address)}</div>
                                      )}
                                    </div>
                                  ) : '-'}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-green-600 text-2xl">🎉</span>
              Access Token Generated Successfully!
            </DialogTitle>
            <DialogDescription className="space-y-3">
              <p>Your new ShipHero access token has been generated and is now active.</p>
              
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-green-600 font-medium">✅ Token Details:</span>
                </div>
                <ul className="text-sm space-y-1 text-green-700 dark:text-green-300">
                  <li>• <strong>Validity:</strong> 28 days from now</li>
                  <li>• <strong>Expires:</strong> {tokenExpiresAt ? new Date(tokenExpiresAt).toLocaleDateString('en-US', { 
                    weekday: 'long',
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Unknown'}</li>
                  <li>• <strong>Status:</strong> Active & ready for use</li>
                </ul>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-blue-600 font-medium">⏰ Live Countdown:</span>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  The countdown timer has been reset and is now actively tracking your token expiration in real-time!
                </p>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400">
                You can now use all ShipHero features. Remember to generate a new token before this one expires!
              </p>
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex justify-end gap-2 mt-4">
            <Button 
              onClick={() => setShowSuccessModal(false)}
              className="bg-green-600 hover:bg-green-700"
            >
              Awesome! Let's Go 🚀
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
