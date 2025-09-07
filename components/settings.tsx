"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ShipHeroAPI, ShipHeroConfig, Warehouse } from "@/lib/shiphero-api"
import { Settings, TestTube, CheckCircle, XCircle, Clock, RefreshCw } from "lucide-react"

interface SettingsProps {
  onConfigChange?: (config: ShipHeroConfig | null) => void;
}

export function Settings({ onConfigChange }: SettingsProps) {
  const [refreshToken, setRefreshToken] = useState("")
  const [api, setApi] = useState<ShipHeroAPI | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [errorMessage, setErrorMessage] = useState("")
  const [daysUntilExpiry, setDaysUntilExpiry] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    // Load existing configuration from localStorage
    const savedConfig = ShipHeroAPI.loadFromStorage()
    if (savedConfig) {
      setRefreshToken(savedConfig.refreshToken)
      const apiInstance = new ShipHeroAPI(savedConfig)
      setApi(apiInstance)
      setDaysUntilExpiry(apiInstance.getDaysUntilExpiry())
      onConfigChange?.(savedConfig)
    }
  }, [onConfigChange])

  const handleSaveConfig = async () => {
    if (!refreshToken.trim()) {
      setErrorMessage("Please enter a refresh token")
      return
    }

    setIsLoading(true)
    setErrorMessage("")

    try {
      const config: ShipHeroConfig = { refreshToken: refreshToken.trim() }
      const apiInstance = new ShipHeroAPI(config)
      
      // Test the connection immediately
      await apiInstance.testConnection()
      
      setApi(apiInstance)
      setConnectionStatus('success')
      setDaysUntilExpiry(apiInstance.getDaysUntilExpiry())
      onConfigChange?.(config)
      
      // Save to localStorage
      ShipHeroAPI.saveToStorage(config)
      
    } catch (error) {
      setConnectionStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Failed to connect to ShipHero API')
    } finally {
      setIsLoading(false)
    }
  }

  const handleTestConnection = async () => {
    if (!api) {
      setErrorMessage("Please save your configuration first")
      return
    }

    setConnectionStatus('testing')
    setErrorMessage("")

    try {
      const warehouses = await api.testConnection()
      setWarehouses(warehouses)
      setConnectionStatus('success')
      setDaysUntilExpiry(api.getDaysUntilExpiry())
    } catch (error) {
      setConnectionStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Connection test failed')
    }
  }

  const handleRefreshToken = async () => {
    if (!api) return

    setIsRefreshing(true)
    setErrorMessage("")

    try {
      await api.testConnection() // This will refresh the token
      setDaysUntilExpiry(api.getDaysUntilExpiry())
      setConnectionStatus('success')
    } catch (error) {
      setConnectionStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Token refresh failed')
    } finally {
      setIsRefreshing(false)
    }
  }

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'testing':
        return <RefreshCw className="h-4 w-4 animate-spin" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Settings className="h-4 w-4" />
    }
  }

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'testing':
        return "Testing connection..."
      case 'success':
        return "Connected successfully"
      case 'error':
        return "Connection failed"
      default:
        return "Not configured"
    }
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'success':
        return "text-green-600"
      case 'error':
        return "text-red-600"
      default:
        return "text-gray-600"
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            ShipHero API Configuration
          </CardTitle>
          <CardDescription>
            Configure your ShipHero API credentials to enable automated order creation and warehouse management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refresh-token">Refresh Token</Label>
            <Input
              id="refresh-token"
              type="password"
              placeholder="Enter your ShipHero refresh token"
              value={refreshToken}
              onChange={(e) => setRefreshToken(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Get your refresh token from the ShipHero Developer Portal
            </p>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleSaveConfig}
              disabled={isLoading || !refreshToken.trim()}
            >
              {isLoading ? "Saving..." : "Save Configuration"}
            </Button>
            
            {api && (
              <Button 
                variant="outline" 
                onClick={handleTestConnection}
                disabled={connectionStatus === 'testing'}
              >
                <TestTube className="h-4 w-4 mr-2" />
                Test Connection
              </Button>
            )}
          </div>

          {errorMessage && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-2 text-sm">
            {getStatusIcon()}
            <span className={getStatusColor()}>{getStatusText()}</span>
          </div>
        </CardContent>
      </Card>

      {api && connectionStatus === 'success' && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Token Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Days until token expiry:</span>
                  <span className={`font-mono ${daysUntilExpiry <= 3 ? 'text-red-600' : daysUntilExpiry <= 7 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {daysUntilExpiry} days
                  </span>
                </div>
                
                {daysUntilExpiry <= 7 && (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      Your access token will expire in {daysUntilExpiry} days. 
                      {daysUntilExpiry <= 3 && " Please refresh your token soon to avoid service interruption."}
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  variant="outline" 
                  onClick={handleRefreshToken}
                  disabled={isRefreshing}
                  className="w-full"
                >
                  {isRefreshing ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Refreshing Token...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh Access Token
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {warehouses.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Warehouse Information</CardTitle>
                <CardDescription>
                  Connected warehouses from your ShipHero account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Warehouse Name</TableHead>
                      <TableHead>ID (Base64)</TableHead>
                      <TableHead>ID (Decoded)</TableHead>
                      <TableHead>Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {warehouses.map((warehouse, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{warehouse.name}</TableCell>
                        <TableCell className="font-mono text-xs">{warehouse.id}</TableCell>
                        <TableCell className="font-mono text-xs">{warehouse.decodedId}</TableCell>
                        <TableCell className="text-sm">{warehouse.address}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
