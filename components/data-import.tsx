"use client"

import type React from "react"

import { useState, useMemo } from "react"
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Upload, CheckCircle, AlertCircle } from "lucide-react"
import type { InventoryItem } from "@/app/page"

interface DataImportProps {
  onDataImported: (data: InventoryItem[], accountId?: string) => void
  inventoryData: InventoryItem[]
}

export function DataImport({ onDataImported, inventoryData }: DataImportProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isGeneratingQR, setIsGeneratingQR] = useState(false)
  
  // 3PL API Import state
  const [accountId, setAccountId] = useState("")
  const [isApiLoading, setIsApiLoading] = useState(false)
  
  // SKU-filtered CSV import state
  const [isFilteredLoading, setIsFilteredLoading] = useState(false)
  const [skuQuantityMap, setSkuQuantityMap] = useState<Map<string, number>>(new Map())
  const [missingSKUs, setMissingSKUs] = useState<string[]>([])
  const [insufficientInventory, setInsufficientInventory] = useState<Array<{sku: string, requested: number, available: number}>>([])
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<'item' | 'sku' | 'location' | 'units' | 'pickable' | 'sellable' | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  
  // Display settings
  const [showZeroQuantity, setShowZeroQuantity] = useState(false)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const text = await file.text()
      const lines = text.split("\n")
      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))

      console.log("[v0] CSV Headers:", headers) // Debug log

      const data: InventoryItem[] = []

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))

        if (values.length >= headers.length) {
          const item: InventoryItem = {
            item: values[0] || "", // Item
            sku: values[1] || "", // Sku
            warehouse: values[2] || "", // Warehouse
            location: values[4] || "", // Location (skip Client column)
            type: values[5] || "", // Type
            units: Number.parseInt(values[6]) || 0, // Units (was index 5, now 6)
            activeItem: values[7] || "", // Active Item (was index 6, now 7)
            pickable: values[8] || "", // Pickable (was index 7, now 8)
            sellable: values[9] || "", // Sellable (was index 8, now 9)
            creationDate: values[14] || "", // Creation Date (last column)
          }
          console.log("[v0] Parsed item:", item) // Debug log
          data.push(item)
        }
      }

      data.sort((a, b) => a.location.localeCompare(b.location, undefined, { numeric: true, sensitivity: "base" }))

      onDataImported(data)
      setSuccess(true)
    } catch (err) {
      setError("Failed to parse CSV file. Please check the format.")
      console.error("CSV parsing error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUrlImport = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(
        "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/20250822120830_8ef815f53c6ed37972d4a939ed6914de-mFMlwZqUNeX6et5fAHDbUfRGWr6lot.csv",
      )
      const text = await response.text()

      const lines = text.split("\n")
      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))

      const data: InventoryItem[] = []

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))

        if (values.length >= headers.length) {
          const item: InventoryItem = {
            item: values[0] || "",
            sku: values[1] || "",
            warehouse: values[2] || "",
            location: values[4] || "",
            type: values[5] || "",
            units: Number.parseInt(values[6]) || 0,
            activeItem: values[7] || "",
            pickable: values[8] || "",
            sellable: values[9] || "",
            creationDate: values[14] || "",
          }
          data.push(item)
        }
      }

      data.sort((a, b) => a.location.localeCompare(b.location, undefined, { numeric: true, sensitivity: "base" }))

      onDataImported(data)
      setSuccess(true)
    } catch (err) {
      setError("Failed to load sample data.")
      console.error("Data loading error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFilteredCSVImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsFilteredLoading(true)
    setError(null)
    setSuccess(false)
    setMissingSKUs([])
    setInsufficientInventory([])

    try {
      // Parse the CSV to get SKU and Quantity columns
      const text = await file.text()
      const lines = text.split("\n")
      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, "").toLowerCase())

      console.log("[FILTERED CSV] Headers:", headers)

      const skuIndex = headers.findIndex(h => h.includes('sku'))
      const quantityIndex = headers.findIndex(h => h.includes('quantity') || h.includes('qty'))

      if (skuIndex === -1 || quantityIndex === -1) {
        setError("CSV must have both 'SKU' and 'Quantity' columns")
        return
      }

      const skuQuantities = new Map<string, number>()

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))
        const sku = values[skuIndex]
        const quantity = Number.parseInt(values[quantityIndex]) || 0

        if (sku && quantity > 0) {
          skuQuantities.set(sku, quantity)
        }
      }

      console.log(`[FILTERED CSV] Parsed ${skuQuantities.size} SKUs from CSV`)
      setSkuQuantityMap(skuQuantities)

      // Get saved ShipHero config
      const savedConfigStr = localStorage.getItem('shiphero-config')
      if (!savedConfigStr) {
        setError("No ShipHero configuration found. Please configure your API tokens first.")
        return
      }

      const savedConfig = JSON.parse(savedConfigStr)
      const accessToken = savedConfig.accessToken
      const customerAccountId = accountId.trim()

      if (!accessToken) {
        setError("No access token found. Please generate an access token first.")
        return
      }

      if (!customerAccountId) {
        setError("Please enter a customer account ID first.")
        return
      }

      console.log('[FILTERED CSV] Querying ShipHero for specific SKUs...')
      
      // Query ShipHero for each SKU to get location data
      const response = await fetch('/api/shiphero/product-locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          customerAccountId: customerAccountId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const apiData = await response.json()
      const productNodes = apiData?.data?.warehouse_products?.data?.edges || []

      console.log(`[FILTERED CSV] Received ${productNodes.length} products from ShipHero`)

      // Filter to only SKUs that are in our CSV
      const csvSKUs = Array.from(skuQuantities.keys())
      const foundSKUs = new Set<string>()
      const transformedData: InventoryItem[] = []
      const missing: string[] = []
      const insufficient: Array<{sku: string, requested: number, available: number}> = []

      productNodes.forEach((edge: any) => {
        const product = edge.node
        const productInfo = product.product
        const sku = productInfo?.sku
        
        // STRICT ACCOUNT VALIDATION: Decode Base64 account_id from ShipHero
        let productAccountId = null
        if (productInfo?.account_id) {
          try {
            const decoded = atob(productInfo.account_id) // Decode Base64
            productAccountId = decoded.split(':')[1] // Extract "74769" from "Account:74769"
          } catch (e) {
            console.error(`Failed to decode account_id for ${sku}:`, e)
          }
        }
        
        if (productAccountId && productAccountId !== customerAccountId) {
          console.warn(`⚠️ [FILTERED CSV] Skipping ${sku} - belongs to account ${productAccountId}, not ${customerAccountId}`)
          return
        }

        // Only process if this SKU is in our CSV
        if (sku && skuQuantities.has(sku)) {
          foundSKUs.add(sku)
          const requestedQty = skuQuantities.get(sku)!
          const availableQty = product.on_hand || 0

          // Validate quantity
          if (availableQty < requestedQty) {
            insufficient.push({
              sku: sku,
              requested: requestedQty,
              available: availableQty
            })
          }

          // Process all bin locations for this SKU - ONLY WITH QUANTITY > 0
          if (product.locations?.edges?.length > 0) {
            product.locations.edges.forEach((locationEdge: any) => {
              const locationNode = locationEdge.node
              const location = locationNode.location
              const quantity = locationNode.quantity || 0

              // STRICT FILTERING: Only include if quantity is explicitly greater than 0
              if (quantity > 0 && Number.isFinite(quantity)) {
                console.log(`[FILTERED CSV] Adding location for ${sku}: ${location?.name} with ${quantity} units`)
                transformedData.push({
                  item: productInfo?.name || 'Unknown Product',
                  sku: sku,
                  warehouse: 'Warehouse',
                  location: location?.name || 'Unknown Location',
                  type: 'product',
                  units: quantity,
                  activeItem: 'yes',
                  pickable: location?.pickable ? 'yes' : 'no',
                  sellable: location?.sellable ? 'yes' : 'no',
                  creationDate: new Date().toISOString().split('T')[0]
                })
              } else {
                console.log(`[FILTERED CSV] Skipping location for ${sku}: ${location?.name} - zero quantity`)
              }
            })
          } else if (product.inventory_bin && product.on_hand > 0) {
            // STRICT FILTERING: Only include if on_hand is explicitly greater than 0
            const onHand = product.on_hand || 0
            if (onHand > 0 && Number.isFinite(onHand)) {
              console.log(`[FILTERED CSV] Adding primary bin for ${sku}: ${product.inventory_bin} with ${onHand} units`)
              transformedData.push({
                item: productInfo?.name || 'Unknown Product',
                sku: sku,
                warehouse: 'Warehouse',
                location: product.inventory_bin,
                type: 'product',
                units: onHand,
                activeItem: 'yes',
                pickable: 'yes',
                sellable: 'yes',
                creationDate: new Date().toISOString().split('T')[0]
              })
            } else {
              console.log(`[FILTERED CSV] Skipping primary bin for ${sku}: ${product.inventory_bin} - zero quantity`)
            }
          }
        }
      })

      // Check for missing SKUs
      csvSKUs.forEach(sku => {
        if (!foundSKUs.has(sku)) {
          missing.push(sku)
        }
      })

      setMissingSKUs(missing)
      setInsufficientInventory(insufficient)

      // Sort by location
      transformedData.sort((a, b) => a.location.localeCompare(b.location, undefined, { numeric: true, sensitivity: "base" }))

      console.log(`[FILTERED CSV] Transformed ${transformedData.length} location entries`)
      console.log(`[FILTERED CSV] Missing SKUs: ${missing.length}`)
      console.log(`[FILTERED CSV] Insufficient inventory: ${insufficient.length}`)

      onDataImported(transformedData, customerAccountId)
      setSuccess(true)

    } catch (err) {
      console.error('[FILTERED CSV] Import error:', err)
      setError(`Failed to import filtered data: ${err instanceof Error ? err.message : 'Unknown error occurred'}`)
    } finally {
      setIsFilteredLoading(false)
    }
  }

  const handleApiImport = async () => {
    if (!accountId.trim()) {
      setError("Please enter a valid account ID")
      return
    }

    setIsApiLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Use the numeric account ID directly as a string (ShipHero API expects this format for 3PL queries)
      const customerAccountId = accountId.trim()
      console.log(`[DATA-IMPORT] Using customer account ID: ${customerAccountId}`)

      // Get saved ShipHero config
      const savedConfigStr = localStorage.getItem('shiphero-config')
      if (!savedConfigStr) {
        setError("No ShipHero configuration found. Please configure your API tokens first.")
        return
      }

      const savedConfig = JSON.parse(savedConfigStr)
      const accessToken = savedConfig.accessToken

      if (!accessToken) {
        setError("No access token found. Please generate an access token first.")
        return
      }

      console.log('[DATA-IMPORT] Making API request for product locations')
      const response = await fetch('/api/shiphero/product-locations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          customerAccountId: customerAccountId
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const apiData = await response.json()
      console.log('📊 [DATA-IMPORT] API response received')
      console.log('📊 [DATA-IMPORT] Total products in response:', apiData?.data?.warehouse_products?.data?.edges?.length || 0)
      
      // Log pagination metadata if available
      if (apiData._pagination) {
        console.log('🔄 [PAGINATION] Total Pages Fetched:', apiData._pagination.totalPages)
        console.log('🔄 [PAGINATION] Total Products:', apiData._pagination.totalProducts)
        console.log('🔄 [PAGINATION] Expected Products:', apiData._pagination.expectedProducts)
        console.log('🔄 [PAGINATION] Completed Successfully:', apiData._pagination.completedSuccessfully)
        
        if (apiData._pagination.stoppedEarly) {
          console.warn('⚠️ [PAGINATION] Stopped early - may not have all products!')
        }
        
        if (apiData._pagination.totalProducts < apiData._pagination.expectedProducts) {
          console.warn(`⚠️ [PAGINATION] Missing ${apiData._pagination.expectedProducts - apiData._pagination.totalProducts} products!`)
        }
      }
      
      console.log('📊 [DATA-IMPORT] Full response structure:', apiData)

      // Transform ShipHero API response using the exact function as instructed
      const transformApiData = (apiResponse: any) => {
        console.log('[TRANSFORM] Raw API response:', apiResponse);
        
        if (!apiResponse?.data?.warehouse_products?.data?.edges) {
          console.log('[TRANSFORM] No edges found in response');
          return [];
        }
        
        const edges = apiResponse.data.warehouse_products.data.edges;
        console.log('[TRANSFORM] Processing', edges.length, 'edges');
        
        const transformedItems: any[] = [];
        
        edges.forEach((edge: any, index: number) => {
          console.log(`[TRANSFORM] Processing edge ${index}:`, edge.node);
          
          const node = edge.node;
          const product = node.product;
          
          // STRICT ACCOUNT VALIDATION: Decode Base64 account_id from ShipHero
          // ShipHero returns account_id as Base64-encoded "Account:74769"
          let productAccountId = null
          if (product?.account_id) {
            try {
              const decoded = atob(product.account_id) // Decode Base64
              productAccountId = decoded.split(':')[1] // Extract "74769" from "Account:74769"
            } catch (e) {
              console.error(`Failed to decode account_id for ${product.sku}:`, e)
            }
          }
          
          console.log(`[TRANSFORM] SKU ${product.sku}: account_id=${productAccountId} (decoded from ${product.account_id}), expected=${apiResponse._accountId}`)
          
          // Skip products from wrong accounts
          if (productAccountId && apiResponse._accountId && productAccountId !== apiResponse._accountId) {
            console.warn(`⚠️ [TRANSFORM] FILTERED OUT ${product.sku} - belongs to account ${productAccountId}, not ${apiResponse._accountId}`)
            return
          }
          
          // Add debug logging as instructed
          console.log(`[TRANSFORM] Node locations:`, node.locations);
          console.log(`[TRANSFORM] Inventory bin:`, node.inventory_bin);
          console.log(`[TRANSFORM] On hand:`, node.on_hand);
          
          // Handle locations if they exist
          if (node.locations?.edges?.length > 0) {
            console.log(`[TRANSFORM] Found ${node.locations.edges.length} location(s)`);
            node.locations.edges.forEach((locationEdge: any, locIndex: number) => {
              console.log(`[TRANSFORM] Location ${locIndex}:`, locationEdge.node);
              const locationNode = locationEdge.node;
              const location = locationNode.location;
              const quantity = locationNode?.quantity || 0;
              
              // STRICT: Only add locations with quantity > 0
              if (quantity > 0 && Number.isFinite(quantity)) {
                transformedItems.push({
                  sku: product?.sku || 'N/A',
                  productName: product?.name || 'N/A',
                  binLocation: location?.name || node.inventory_bin || 'N/A',
                  quantity: quantity,
                  sellable: location?.sellable ?? true,
                  pickable: location?.pickable ?? true,
                  warehouseId: 'N/A'
                });
              } else {
                console.log(`[TRANSFORM] Skipping location ${locIndex} - zero or invalid quantity:`, quantity);
              }
            });
          } else {
            console.log(`[TRANSFORM] No locations found, checking inventory_bin`);
            const onHand = node.on_hand || 0;
            
            // STRICT: Only add if on_hand is explicitly greater than 0
            if (onHand > 0 && Number.isFinite(onHand) && node.inventory_bin) {
              console.log(`[TRANSFORM] Adding inventory_bin with ${onHand} units`);
              transformedItems.push({
                sku: product?.sku || 'N/A',
                productName: product?.name || 'N/A',
                binLocation: node.inventory_bin || 'N/A',
                quantity: onHand,
                sellable: true,
                pickable: true,
                warehouseId: 'N/A'
              });
            } else {
              console.log(`[TRANSFORM] Skipping inventory_bin - zero or invalid quantity:`, onHand);
            }
          }
        });
        
        console.log('[TRANSFORM] Final transformed items:', transformedItems);
        return transformedItems;
      };

      const rawTransformedData = transformApiData(apiData)
      
      // Convert to InventoryItem format for the existing UI
      // FINAL FILTER: Remove any items with zero or invalid quantities
      const transformedData: InventoryItem[] = rawTransformedData
        .filter((item: any) => item.quantity > 0 && Number.isFinite(item.quantity))
        .map((item: any) => ({
          item: item.productName,
          sku: item.sku,
          warehouse: 'Warehouse', // Default since we're focusing on locations
          location: item.binLocation,
          type: 'product',
          units: item.quantity,
          activeItem: (item.pickable && item.sellable) ? 'yes' : 'no',
          pickable: item.pickable ? 'yes' : 'no',
          sellable: item.sellable ? 'yes' : 'no',
          creationDate: new Date().toISOString().split('T')[0]
        }))
      
      console.log(`[DATA-IMPORT] Final filtered count: ${transformedData.length} items (all with quantity > 0)`)

      // Sort by location like the CSV import does
      transformedData.sort((a, b) => a.location.localeCompare(b.location, undefined, { numeric: true, sensitivity: "base" }))

      console.log(`[DATA-IMPORT] Transformed ${transformedData.length} items from API data`)
      onDataImported(transformedData, customerAccountId)
      setSuccess(true)

    } catch (err) {
      console.error('[DATA-IMPORT] API import error:', err)
      setError(`Failed to import from API: ${err instanceof Error ? err.message : 'Unknown error occurred'}`)
    } finally {
      setIsApiLoading(false)
    }
  }

  const exportToCSV = () => {
    if (inventoryData.length === 0) return

    // Create CSV with all the data
    const headers = ['Item', 'SKU', 'Warehouse', 'Bin Location', 'Quantity', 'Pickable', 'Sellable', 'Active', 'Type', 'Creation Date']
    const csvRows = [headers.join(',')]

    sortedDisplayData.forEach(item => {
      const row = [
        `"${item.item}"`,
        `"${item.sku}"`,
        `"${item.warehouse}"`,
        `"${item.location}"`,
        item.units,
        item.pickable,
        item.sellable,
        item.activeItem,
        `"${item.type}"`,
        `"${item.creationDate}"`
      ]
      csvRows.push(row.join(','))
    })

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `warehouse-inventory-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    console.log(`[EXPORT] Exported ${sortedDisplayData.length} items to CSV`)
  }

  const generateAllQRCodes = () => {
    if (inventoryData.length === 0) return

    setIsGeneratingQR(true)

    const sortedInventoryData = [...inventoryData].sort((a, b) =>
      a.location.localeCompare(b.location, undefined, { numeric: true, sensitivity: "base" }),
    )

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      let labelsHtml = ""

      sortedInventoryData.forEach((item) => {
        const qrContent = JSON.stringify({
          sku: item.sku,
          quantity: item.units,
          pickable: item.pickable,
          sellable: item.sellable,
          location: item.location
        })

        // Create status badges for the label
        const pickableStatus = item.pickable === 'yes' ? '✓ Pickable' : '✗ Not Pickable'
        const sellableStatus = item.sellable === 'yes' ? '✓ Sellable' : '✗ Not Sellable'
        const pickableColor = item.pickable === 'yes' ? '#10b981' : '#ef4444'
        const sellableColor = item.sellable === 'yes' ? '#10b981' : '#ef4444'

        labelsHtml += `
          <div class="label">
            <div class="item-name">${item.item}</div>
            <div class="qr-code">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrContent)}" alt="QR Code" />
            </div>
            <div class="item-info">
              <div><strong>SKU:</strong> ${item.sku}</div>
              <div><strong>Location:</strong> ${item.location}</div>
              <div><strong>Quantity:</strong> ${item.units}</div>
              <div class="status-badges">
                <span class="status-badge" style="color: ${pickableColor}; font-weight: bold;">${pickableStatus}</span>
                <span class="status-badge" style="color: ${sellableColor}; font-weight: bold;">${sellableStatus}</span>
              </div>
            </div>
          </div>
        `
      })

      printWindow.document.write(`
        <html>
          <head>
            <title>All QR Code Labels - ${inventoryData.length} Items</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: Arial, sans-serif; 
                margin: 0;
                padding: 0;
              }
              .label {
                width: 4in;
                height: 6in;
                border: none;
                padding: 0.2in;
                text-align: center;
                background: white;
                page-break-after: always;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
              }
              .label:last-child {
                page-break-after: avoid;
              }
              .qr-code {
                margin: 0.1in 0;
              }
              .qr-code img {
                width: 2.5in;
                height: 2.5in;
              }
              .item-info {
                margin: 0.1in 0;
                font-size: 14px;
                line-height: 1.2;
              }
              .item-name {
                font-weight: bold;
                font-size: 16px;
                margin-bottom: 0.1in;
                word-wrap: break-word;
                max-width: 3.6in;
              }
              .status-badges {
                margin-top: 0.1in;
                display: flex;
                flex-direction: column;
                gap: 2px;
              }
              .status-badge {
                font-size: 12px;
                font-weight: bold;
                padding: 2px 4px;
                border-radius: 3px;
                background-color: rgba(0,0,0,0.05);
              }
              @media print {
                body { margin: 0; padding: 0; }
                .label { 
                  width: 4in;
                  height: 6in;
                  margin: 0;
                  padding: 0.2in;
                }
              }
            </style>
          </head>
          <body>
            ${labelsHtml}
          </body>
        </html>
      `)
      printWindow.document.close()

      setTimeout(() => {
        printWindow.print()
        setIsGeneratingQR(false)
      }, 2000)
    } else {
      setIsGeneratingQR(false)
    }
  }

  const handleSort = (column: 'item' | 'sku' | 'location' | 'units' | 'pickable' | 'sellable') => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  const sortedDisplayData = React.useMemo(() => {
    let sorted = [...inventoryData]
    
    // Filter based on show zero quantity setting
    if (!showZeroQuantity) {
      sorted = sorted.filter(item => item.units > 0)
    }
    
    if (sortColumn) {
      sorted.sort((a, b) => {
        let aVal: any = a[sortColumn]
        let bVal: any = b[sortColumn]
        
        // Handle numeric sorting for units
        if (sortColumn === 'units') {
          aVal = Number(aVal)
          bVal = Number(bVal)
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
        }
        
        // String sorting for other columns
        const comparison = String(aVal).localeCompare(String(bVal), undefined, { 
          numeric: true, 
          sensitivity: 'base' 
        })
        
        return sortDirection === 'asc' ? comparison : -comparison
      })
    } else {
      // Default sort by location
      sorted.sort((a, b) =>
        a.location.localeCompare(b.location, undefined, { numeric: true, sensitivity: "base" })
      )
    }
    
    return sorted
  }, [inventoryData, sortColumn, sortDirection, showZeroQuantity])

  return (
    <div className="space-y-6">
      {/* 3PL API Import Section - Moved to top */}
      <div className="border-4 border-dashed border-purple-400 rounded-xl p-8 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-lg">
        <div className="text-center space-y-6">
          <div className="bg-purple-100 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
            <svg className="h-10 w-10 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-purple-900 mb-2">Import from ShipHero API (3PL Mode)</h2>
            <p className="text-base text-purple-700 max-w-md mx-auto">
              Enter a customer account ID to fetch their product locations directly from ShipHero
            </p>
          </div>
          <div className="space-y-4 max-w-md mx-auto">
            <div>
              <Label htmlFor="account-id" className="block text-sm font-medium text-purple-700 mb-2">
                Customer Account ID
              </Label>
              <Input
                id="account-id"
                type="number"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="e.g., 85879"
                disabled={isApiLoading}
                className="h-12 text-base border-2 border-purple-300 focus:border-purple-500 bg-white"
              />
              <p className="text-sm text-purple-600 mt-1">
                Enter the numeric account ID. Fetches individual bin locations (PS01-01, A02-02-A-03, etc.) with pickable/sellable status.
              </p>
            </div>
            <div className="pt-2">
              <Button
                onClick={handleApiImport}
                disabled={isApiLoading || !accountId.trim()}
                size="lg"
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg font-semibold"
              >
                <svg className="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                {isApiLoading ? 'Fetching Product Locations...' : 'Import from ShipHero API'}
              </Button>
            </div>
          </div>
          {isApiLoading && (
            <div className="bg-white rounded-lg p-4 border border-purple-200">
              <p className="text-base text-purple-600 font-medium">Querying ShipHero API for account {accountId}...</p>
              <div className="mt-2 text-sm text-purple-500">
                <div className="mb-2">Fetching all products with location data...</div>
                <div className="text-xs text-purple-400">
                  ⏱️ This process includes 20-second delays between pages to respect API credit limits
                </div>
                <div className="text-xs text-purple-400">
                  Expected time: ~2 minutes for complete data (worth the wait for 100% accuracy!)
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filtered CSV Upload Section - Target specific SKUs */}
      <div className="border-4 border-dashed border-green-400 rounded-xl p-8 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg">
        <div className="text-center space-y-6">
          <div className="bg-green-100 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
            <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-green-900 mb-2">Upload SKU List & Fetch Locations</h2>
            <p className="text-base text-green-700 max-w-md mx-auto">
              Upload a CSV with specific SKUs and quantities, then fetch their exact bin locations from ShipHero
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <Label htmlFor="account-id-filtered" className="block text-sm font-medium text-green-700 mb-2">
                Customer Account ID *
              </Label>
              <Input
                id="account-id-filtered"
                type="number"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="e.g., 90985"
                disabled={isFilteredLoading}
                className="max-w-lg mx-auto h-12 text-base border-2 border-green-300 focus:border-green-500 bg-white"
              />
            </div>
            <div>
              <Label htmlFor="filtered-csv-file" className="sr-only">
                Upload SKU List CSV
              </Label>
              <Input
                id="filtered-csv-file"
                type="file"
                accept=".csv"
                onChange={handleFilteredCSVImport}
                disabled={isFilteredLoading || !accountId.trim()}
                className="max-w-lg mx-auto h-12 text-base border-2 border-green-300 focus:border-green-500 bg-white"
              />
              <p className="text-sm text-green-600 mt-2">
                CSV must have "SKU" and "Quantity" columns. Only listed SKUs will be fetched with their bin locations.
              </p>
            </div>
          </div>
          {isFilteredLoading && (
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <p className="text-base text-green-600 font-medium">Processing CSV and querying ShipHero...</p>
            </div>
          )}
          
          {/* Validation Warnings */}
          {missingSKUs.length > 0 && (
            <Alert className="bg-yellow-50 border-yellow-300">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                <strong>⚠️ {missingSKUs.length} SKU(s) not found in ShipHero:</strong>
                <div className="mt-2 text-sm font-mono">
                  {missingSKUs.slice(0, 5).join(", ")}
                  {missingSKUs.length > 5 && ` ... and ${missingSKUs.length - 5} more`}
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {insufficientInventory.length > 0 && (
            <Alert className="bg-orange-50 border-orange-300">
              <AlertCircle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                <strong>⚠️ {insufficientInventory.length} SKU(s) have insufficient inventory:</strong>
                <div className="mt-2 text-sm space-y-1">
                  {insufficientInventory.slice(0, 3).map((item, idx) => (
                    <div key={idx} className="font-mono">
                      {item.sku}: Need {item.requested}, Available {item.available}
                    </div>
                  ))}
                  {insufficientInventory.length > 3 && <div>... and {insufficientInventory.length - 3} more</div>}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* CSV Upload Section - Moved below API Import */}
      <div className="border-4 border-dashed border-cyan-400 rounded-xl p-8 bg-gradient-to-br from-cyan-50 to-blue-50 shadow-lg">
        <div className="text-center space-y-6">
          <div className="bg-cyan-100 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
            <Upload className="h-10 w-10 text-cyan-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-cyan-900 mb-2">Upload Your Inventory CSV File</h2>
            <p className="text-base text-cyan-700 max-w-md mx-auto">
              Select your warehouse inventory CSV file to import all products and generate QR codes instantly
            </p>
          </div>
          <div className="space-y-4">
            <Label htmlFor="csv-file" className="sr-only">
              Upload CSV File
            </Label>
            <div className="relative">
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={isLoading}
                className="max-w-lg mx-auto h-12 text-base border-2 border-cyan-300 focus:border-cyan-500 bg-white"
              />
            </div>
            <div className="pt-2">
              <Button
                onClick={() => document.getElementById("csv-file")?.click()}
                disabled={isLoading}
                size="lg"
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-8 py-3 text-lg font-semibold"
              >
                <Upload className="mr-3 h-5 w-5" />
                Choose CSV File to Upload
              </Button>
            </div>
          </div>
          {isLoading && (
            <div className="bg-white rounded-lg p-4 border border-cyan-200">
              <p className="text-base text-cyan-600 font-medium">Processing your file...</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Successfully imported {inventoryData.length} items</AlertDescription>
        </Alert>
      )}

      {inventoryData.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Imported Data Preview</h3>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showZeroQuantity}
                  onChange={(e) => setShowZeroQuantity(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">Show zero quantity locations</span>
              </label>
              <Button
                onClick={exportToCSV}
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-50"
              >
                <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export CSV ({sortedDisplayData.length} items)
              </Button>
              <Button
                onClick={generateAllQRCodes}
                disabled={isGeneratingQR}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Upload className="mr-2 h-4 w-4" />
                {isGeneratingQR ? "Generating..." : `Generate All QR Codes (${inventoryData.length})`}
              </Button>
            </div>
          </div>

          <div className="rounded-md border max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-gray-50 z-10">
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('item')}
                  >
                    <div className="flex items-center gap-2">
                      Item
                      {sortColumn === 'item' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('sku')}
                  >
                    <div className="flex items-center gap-2">
                      SKU
                      {sortColumn === 'sku' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('location')}
                  >
                    <div className="flex items-center gap-2">
                      Bin Location
                      {sortColumn === 'location' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('units')}
                  >
                    <div className="flex items-center gap-2">
                      Quantity
                      {sortColumn === 'units' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('pickable')}
                  >
                    <div className="flex items-center gap-2">
                      Pickable
                      {sortColumn === 'pickable' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-100 select-none"
                    onClick={() => handleSort('sellable')}
                  >
                    <div className="flex items-center gap-2">
                      Sellable
                      {sortColumn === 'sellable' && (
                        <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDisplayData.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.item}</TableCell>
                    <TableCell className="font-mono">{item.sku}</TableCell>
                    <TableCell className="font-mono font-bold text-blue-600">{item.location}</TableCell>
                    <TableCell className="text-center font-semibold">{item.units}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          item.pickable === "yes" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.pickable === "yes" ? "✓ Yes" : "✗ No"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          item.sellable === "yes" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.sellable === "yes" ? "✓ Yes" : "✗ No"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          item.activeItem === "yes" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {item.activeItem === "yes" ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing {sortedDisplayData.length} of {inventoryData.length} items
            {!showZeroQuantity && sortedDisplayData.length < inventoryData.length && 
              ` (${inventoryData.length - sortedDisplayData.length} zero-quantity items hidden)`
            } • Click column headers to sort
          </p>
        </div>
      )}
    </div>
  )
}
