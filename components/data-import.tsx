"use client"

import type React from "react"

import { useState } from "react"
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
      console.log('[DATA-IMPORT] API response received:', apiData)

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
              const location = locationNode.location; // ← This is the key change!
              
              transformedItems.push({
                sku: product?.sku || 'N/A',
                productName: product?.name || 'N/A',
                binLocation: location?.name || node.inventory_bin || 'N/A', // ← Now using location.name
                quantity: locationNode?.quantity || 0, // ← quantity is on the locationNode
                sellable: location?.sellable ?? true,
                pickable: location?.pickable ?? true,
                warehouseId: 'N/A'
              });
            });
          } else {
            console.log(`[TRANSFORM] No locations found, using inventory_bin`);
            // No specific locations, use warehouse product data
            transformedItems.push({
              sku: product?.sku || 'N/A',
              productName: product?.name || 'N/A',
              binLocation: node.inventory_bin || 'N/A',
              quantity: node.on_hand || 0,
              sellable: true, // Default assumption
              pickable: true, // Default assumption
              warehouseId: 'N/A'
            });
          }
        });
        
        console.log('[TRANSFORM] Final transformed items:', transformedItems);
        return transformedItems;
      };

      const rawTransformedData = transformApiData(apiData)
      
      // Convert to InventoryItem format for the existing UI
      const transformedData: InventoryItem[] = rawTransformedData.map((item: any) => ({
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

  const sortedDisplayData = [...inventoryData].sort((a, b) =>
    a.location.localeCompare(b.location, undefined, { numeric: true, sensitivity: "base" }),
  )

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
                This may take a few moments depending on inventory size
              </div>
            </div>
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
            <Button
              onClick={generateAllQRCodes}
              disabled={isGeneratingQR}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isGeneratingQR ? "Generating..." : `Generate All QR Codes (${inventoryData.length})`}
            </Button>
          </div>

          <div className="rounded-md border max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Bin Location</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Pickable</TableHead>
                  <TableHead>Sellable</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDisplayData.slice(0, 10).map((item, index) => (
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
          {inventoryData.length > 10 && (
            <p className="text-sm text-muted-foreground">Showing 10 of {inventoryData.length} items</p>
          )}
        </div>
      )}
    </div>
  )
}
