"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ShipHeroAPI, ShipHeroConfig } from "@/lib/shiphero-api"
import { ShoppingCart, Plus, CheckCircle, XCircle, Loader2 } from "lucide-react"
import type { PackedBox } from "@/app/page"

interface SalesOrderIntegrationProps {
  packedBoxes: PackedBox[]
  shipheroConfig: ShipHeroConfig | null
  customerAccountId?: string | null
}

interface SalesOrderForm {
  customerEmail: string
  shippingFirstName: string
  shippingLastName: string
  shippingAddress1: string
  shippingAddress2: string
  shippingCity: string
  shippingState: string
  shippingZip: string
  shippingCountry: string
  shippingPhone: string
  shopName: string
}

export function SalesOrderIntegration({ packedBoxes, shipheroConfig, customerAccountId }: SalesOrderIntegrationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createdOrders, setCreatedOrders] = useState<Array<{ boxId: string; orderId: string; createdAt: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [formData, setFormData] = useState<SalesOrderForm>({
    customerEmail: "",
    shippingFirstName: "",
    shippingLastName: "",
    shippingAddress1: "",
    shippingAddress2: "",
    shippingCity: "",
    shippingState: "",
    shippingZip: "",
    shippingCountry: "US",
    shippingPhone: "",
    shopName: "Warehouse Removal",
  })

  const handleInputChange = (field: keyof SalesOrderForm, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const createSalesOrder = async (box: PackedBox) => {
    if (!shipheroConfig) {
      setError("ShipHero API not configured. Please set up your API credentials in Settings.")
      return
    }

    setIsCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const api = new ShipHeroAPI(shipheroConfig)
      
      // Convert box items to line items with pricing
      const lineItems = box.items.map(item => ({
        sku: item.sku,
        quantity: item.quantity,
        price: 0.00, // Default price for removal items
        productName: item.itemName,
      }))

      // Calculate totals
      const subtotal = lineItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      const totalPrice = subtotal // No tax or shipping for removal orders

      // Create sales order
      const orderId = await api.createSalesOrder({
        orderNumber: `${box.id}-${Date.now()}`,
        customerEmail: formData.customerEmail,
        lineItems,
        shippingAddress: {
          firstName: formData.shippingFirstName,
          lastName: formData.shippingLastName,
          address1: formData.shippingAddress1,
          address2: formData.shippingAddress2 || undefined,
          city: formData.shippingCity,
          state: formData.shippingState,
          zip: formData.shippingZip,
          country: formData.shippingCountry,
          email: formData.customerEmail,
          phone: formData.shippingPhone,
        },
        subtotal,
        totalPrice,
        shopName: formData.shopName,
      })

      // Track created order
      setCreatedOrders(prev => [...prev, {
        boxId: box.id,
        orderId,
        createdAt: new Date().toISOString(),
      }])

      setSuccess(`Sales order created successfully for ${box.id}! Order ID: ${orderId}`)
      
      // Reset form for next order
      setFormData(prev => ({
        ...prev,
        customerEmail: "", // Keep other fields for convenience
      }))

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sales order')
    } finally {
      setIsCreating(false)
    }
  }

  const createConsolidatedSalesOrder = async () => {
    if (!shipheroConfig) {
      setError("ShipHero API not configured. Please set up your API credentials in Settings.")
      return
    }

    setIsCreating(true)
    setError(null)
    setSuccess(null)

    try {
      const api = new ShipHeroAPI(shipheroConfig)
      
      // Consolidate all items from all boxes into a single line item map
      const consolidatedItems = new Map<string, { 
        sku: string; 
        quantity: number; 
        price: number; 
        productName: string; 
      }>()
      
      // Process all boxes and consolidate items by SKU
      packedBoxes.forEach(box => {
        box.items.forEach(item => {
          const existingItem = consolidatedItems.get(item.sku)
          if (existingItem) {
            // Add to existing quantity
            existingItem.quantity += item.quantity
          } else {
            // Add new item
            consolidatedItems.set(item.sku, {
              sku: item.sku,
              quantity: item.quantity,
              price: 0.00, // Default price for removal items
              productName: item.itemName,
            })
          }
        })
      })

      const lineItems = Array.from(consolidatedItems.values())
      const subtotal = lineItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      const totalPrice = subtotal // No tax or shipping for removal orders
      
      console.log('[SALES ORDER] Creating consolidated order with', lineItems.length, 'unique SKUs')
      console.log('[SALES ORDER] Total items from', packedBoxes.length, 'boxes')

      // Create single consolidated sales order
      const orderId = await api.createSalesOrder({
        orderNumber: `CONSOLIDATED-${Date.now()}`,
        customerEmail: formData.customerEmail,
        lineItems,
        shippingAddress: {
          firstName: formData.shippingFirstName,
          lastName: formData.shippingLastName,
          address1: formData.shippingAddress1,
          address2: formData.shippingAddress2 || undefined,
          city: formData.shippingCity,
          state: formData.shippingState,
          zip: formData.shippingZip,
          country: formData.shippingCountry,
          email: formData.customerEmail,
          phone: formData.shippingPhone,
        },
        subtotal,
        totalPrice,
        shopName: formData.shopName,
        customerAccountId: customerAccountId || undefined, // Pass the customer account ID
      })

      // Track the consolidated order for all boxes
      setCreatedOrders(prev => [
        ...prev,
        {
          boxId: 'CONSOLIDATED',
          orderId,
          createdAt: new Date().toISOString(),
        }
      ])

      setSuccess(`Successfully created consolidated sales order! Order ID: ${orderId} (${lineItems.length} unique SKUs from ${packedBoxes.length} boxes)`)
      
      // Reset form
      setFormData(prev => ({
        ...prev,
        customerEmail: "", // Keep other fields for convenience
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sales orders')
    } finally {
      setIsCreating(false)
    }
  }

  const isOrderCreated = (boxId: string) => {
    return createdOrders.some(order => order.boxId === boxId)
  }

  const getOrderId = (boxId: string) => {
    const order = createdOrders.find(order => order.boxId === boxId)
    return order?.orderId
  }

  if (!shipheroConfig) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <ShoppingCart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">ShipHero Integration Required</h3>
          <p className="text-muted-foreground mb-4">
            Configure your ShipHero API credentials in Settings to create sales orders.
          </p>
          <Button onClick={() => setIsOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Configure ShipHero
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Create Sales Orders
          </CardTitle>
          <CardDescription>
            Convert your packed boxes into ShipHero sales orders for automated fulfillment
            {customerAccountId && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                <span className="text-sm font-medium text-blue-800">
                  Customer Account: {customerAccountId}
                </span>
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer-email">Customer Email *</Label>
              <Input
                id="customer-email"
                type="email"
                placeholder="customer@example.com"
                value={formData.customerEmail}
                onChange={(e) => handleInputChange('customerEmail', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shop-name">Shop Name *</Label>
              <Input
                id="shop-name"
                placeholder="Warehouse Removal"
                value={formData.shopName}
                onChange={(e) => handleInputChange('shopName', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping-first-name">First Name *</Label>
              <Input
                id="shipping-first-name"
                placeholder="John"
                value={formData.shippingFirstName}
                onChange={(e) => handleInputChange('shippingFirstName', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping-last-name">Last Name *</Label>
              <Input
                id="shipping-last-name"
                placeholder="Doe"
                value={formData.shippingLastName}
                onChange={(e) => handleInputChange('shippingLastName', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping-address1">Address Line 1 *</Label>
              <Input
                id="shipping-address1"
                placeholder="123 Main St"
                value={formData.shippingAddress1}
                onChange={(e) => handleInputChange('shippingAddress1', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping-address2">Address Line 2</Label>
              <Input
                id="shipping-address2"
                placeholder="Apt 4B"
                value={formData.shippingAddress2}
                onChange={(e) => handleInputChange('shippingAddress2', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping-city">City *</Label>
              <Input
                id="shipping-city"
                placeholder="New York"
                value={formData.shippingCity}
                onChange={(e) => handleInputChange('shippingCity', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping-state">State *</Label>
              <Input
                id="shipping-state"
                placeholder="NY"
                value={formData.shippingState}
                onChange={(e) => handleInputChange('shippingState', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping-zip">ZIP Code *</Label>
              <Input
                id="shipping-zip"
                placeholder="10001"
                value={formData.shippingZip}
                onChange={(e) => handleInputChange('shippingZip', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping-country">Country *</Label>
              <Input
                id="shipping-country"
                placeholder="US"
                value={formData.shippingCountry}
                onChange={(e) => handleInputChange('shippingCountry', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="shipping-phone">Phone</Label>
              <Input
                id="shipping-phone"
                placeholder="+1 (555) 123-4567"
                value={formData.shippingPhone}
                onChange={(e) => handleInputChange('shippingPhone', e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={createConsolidatedSalesOrder}
              disabled={isCreating || packedBoxes.length === 0}
              className="flex-1"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating Consolidated Order...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Consolidated Order ({packedBoxes.length} boxes)
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {packedBoxes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Packed Boxes & Orders</CardTitle>
            <CardDescription>
              Individual box management and order creation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Box ID</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packedBoxes.map((box) => (
                  <TableRow key={box.id}>
                    <TableCell className="font-medium">{box.id}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {box.totalItems} items • {box.items.length} SKUs
                      </div>
                    </TableCell>
                    <TableCell>
                      {isOrderCreated(box.id) ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          Created
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <XCircle className="h-4 w-4" />
                          Pending
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {getOrderId(box.id) || '-'}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => createSalesOrder(box)}
                        disabled={isCreating || isOrderCreated(box.id)}
                      >
                        {isCreating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isOrderCreated(box.id) ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <Plus className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
