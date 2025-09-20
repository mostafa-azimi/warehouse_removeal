"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Scan, Package, Trash2, Printer, Edit3, Check, X } from "lucide-react"
import type { BoxItem, PackedBox, InventoryItem } from "@/app/page"

interface QRScannerProps {
  currentBox: BoxItem[]
  setCurrentBox: (box: BoxItem[]) => void
  packedBoxes: PackedBox[]
  setPackedBoxes: (boxes: PackedBox[]) => void
  inventoryData: InventoryItem[]
  scannedCombinations: Set<string>
  setScannedCombinations: (combinations: Set<string>) => void
}

export function QRScanner({ currentBox, setCurrentBox, packedBoxes, setPackedBoxes, inventoryData, scannedCombinations, setScannedCombinations }: QRScannerProps) {
  const [qrInput, setQrInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [nextBoxNumber, setNextBoxNumber] = useState(1)
  const [customBoxNumber, setCustomBoxNumber] = useState("")
  const [inputBuffer, setInputBuffer] = useState("")
  const [bufferTimeout, setBufferTimeout] = useState<NodeJS.Timeout | null>(null)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [editQuantity, setEditQuantity] = useState("")
  const [editingBox, setEditingBox] = useState<string | null>(null)
  const [editingBoxName, setEditingBoxName] = useState("")
  const [editingBoxItems, setEditingBoxItems] = useState<BoxItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Helper function to generate unique scan key
  const generateScanKey = (sku: string, location: string, quantity: number) => {
    return `${sku}-${location}-${quantity}`
  }

  // Auto-focus input on component mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  useEffect(() => {
    if (packedBoxes.length > 0) {
      const boxNumbers = packedBoxes
        .map((box) => {
          const match = box.id.match(/Box (\d+)/)
          return match ? Number.parseInt(match[1]) : 0
        })
        .filter((num) => num > 0)

      if (boxNumbers.length > 0) {
        setNextBoxNumber(Math.max(...boxNumbers) + 1)
      }
    }
  }, [packedBoxes])

  // Simplified: Just try to parse on every input change
  useEffect(() => {
    if (bufferTimeout) {
      clearTimeout(bufferTimeout)
    }

    if (inputBuffer.trim()) {
      // Simple approach: try immediate parsing, then short delay
      const tryParse = () => {
        try {
          const parsedData = JSON.parse(inputBuffer)
          if (parsedData.sku && parsedData.quantity) {
            console.log("[v0] Successfully parsed QR:", inputBuffer)
            processScan(inputBuffer)
            setInputBuffer("")
            return true
          }
        } catch {
          return false
        }
        return false
      }

      // Try immediate parsing
      if (tryParse()) return

      // If not ready, wait just 10ms (minimal delay)
      const timeout = setTimeout(() => {
        tryParse()
      }, 10)

      setBufferTimeout(timeout)
    }

    return () => {
      if (bufferTimeout) {
        clearTimeout(bufferTimeout)
      }
    }
  }, [inputBuffer])

  const processScan = (scanData?: string) => {
    const dataToProcess = scanData || qrInput
    console.log("[v0] Processing scan data:", dataToProcess)

    if (!dataToProcess.trim()) {
      setError("Please enter QR code data")
      return
    }

    try {
      const parsedData = JSON.parse(dataToProcess)
      console.log("[v0] Parsed QR data:", parsedData)

      if (!parsedData.sku || !parsedData.quantity) {
        setError("Invalid QR code format. Expected SKU and quantity.")
        return
      }

      // Pre-find inventory item for efficiency
      const inventoryItem = inventoryData.find((item) => item.sku === parsedData.sku)
      const quantity = Number.parseInt(parsedData.quantity)
      const location = parsedData.location || inventoryItem?.location || "Unknown Location"

      // Check for duplicate scan
      const scanKey = generateScanKey(parsedData.sku, location, quantity)
      if (scannedCombinations.has(scanKey)) {
        setError(`⚠️ Already scanned: ${parsedData.sku} from ${location} (${quantity} units). This exact combination was already processed.`)
        return
      }

      // Check if item already exists in current box
      const existingIndex = currentBox.findIndex((item) => item.sku === parsedData.sku)
      
      if (existingIndex >= 0) {
        // Update existing item
        const updatedBox = [...currentBox]
        updatedBox[existingIndex].quantity += quantity
        console.log("[v0] Updated existing item, new quantity:", updatedBox[existingIndex].quantity)
        setCurrentBox(updatedBox)
      } else {
        // Add new item
        const newItem: BoxItem = {
          sku: parsedData.sku,
          quantity: quantity,
          itemName: inventoryItem?.item || "Unknown Item",
          location: location,
        }
        console.log("[v0] Adding new item:", newItem.sku, "qty:", newItem.quantity)
        setCurrentBox([...currentBox, newItem])
      }

      // Add to scanned combinations to prevent duplicates
      setScannedCombinations(new Set([...scannedCombinations, scanKey]))
      console.log("[v0] Added scan key to combinations:", scanKey)

      // Clear inputs immediately and focus back to input
      setQrInput("")
      setInputBuffer("")
      setError(null)
      
      // Auto-focus back to input for rapid scanning
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
        }
      }, 10)
      
    } catch (err) {
      console.log("[v0] Error parsing QR data:", err)
      setError("Invalid QR code format. Please scan a valid QR code.")
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQrInput(value)
    setInputBuffer(value) // This triggers the useEffect parsing
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && qrInput.trim()) {
      console.log("[v0] Enter pressed, processing scan:", qrInput)
      processScan()
    }
  }

  const startEditingQuantity = (sku: string, currentQuantity: number) => {
    setEditingItem(sku)
    setEditQuantity(currentQuantity.toString())
  }

  const saveQuantityEdit = (sku: string) => {
    const newQuantity = Number.parseInt(editQuantity)
    if (isNaN(newQuantity) || newQuantity <= 0) {
      setError("Please enter a valid quantity")
      return
    }

    const updatedBox = currentBox.map((item) => (item.sku === sku ? { ...item, quantity: newQuantity } : item))
    setCurrentBox(updatedBox)
    setEditingItem(null)
    setEditQuantity("")
    setError(null)
  }

  const cancelQuantityEdit = () => {
    setEditingItem(null)
    setEditQuantity("")
  }

  const removeFromBox = (sku: string) => {
    setCurrentBox(currentBox.filter((item) => item.sku !== sku))
  }

  const completeBox = () => {
    if (currentBox.length === 0) {
      setError("Cannot complete an empty box")
      return
    }

    const boxNumber = customBoxNumber.trim() || nextBoxNumber.toString()

    const newBox: PackedBox = {
      id: `Box ${boxNumber}`,
      items: [...currentBox],
      totalItems: currentBox.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: new Date().toISOString(),
    }

    setPackedBoxes([...packedBoxes, newBox])
    setCurrentBox([])
    setError(null)

    const currentBoxNum = Number.parseInt(boxNumber) || nextBoxNumber
    setNextBoxNumber(currentBoxNum + 1)
    setCustomBoxNumber("")
  }

  const startEditingBox = (box: PackedBox) => {
    setEditingBox(box.id)
    setEditingBoxName(box.id)
    setEditingBoxItems([...box.items])
  }

  const saveBoxEdit = () => {
    if (!editingBox) return

    const updatedBoxes = packedBoxes.map((box) => {
      if (box.id === editingBox) {
        return {
          ...box,
          id: editingBoxName,
          items: [...editingBoxItems],
          totalItems: editingBoxItems.reduce((sum, item) => sum + item.quantity, 0),
        }
      }
      return box
    })

    setPackedBoxes(updatedBoxes)
    setEditingBox(null)
    setEditingBoxName("")
    setEditingBoxItems([])
  }

  const cancelBoxEdit = () => {
    setEditingBox(null)
    setEditingBoxName("")
    setEditingBoxItems([])
  }

  const updateBoxItemQuantity = (sku: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setEditingBoxItems(editingBoxItems.filter((item) => item.sku !== sku))
    } else {
      setEditingBoxItems(editingBoxItems.map((item) => (item.sku === sku ? { ...item, quantity: newQuantity } : item)))
    }
  }

  const removeBoxItem = (sku: string) => {
    setEditingBoxItems(editingBoxItems.filter((item) => item.sku !== sku))
  }

  const printBoxLabel = (box: PackedBox) => {
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Box Label</title>
            <style>
              @page {
                margin: 0;
                size: 4in 6in;
              }
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body { 
                font-family: Arial, sans-serif; 
                width: 4in;
                height: 6in;
                display: flex;
                align-items: center;
                justify-content: center;
                background: white;
              }
              .label {
                width: 100%;
                height: 100%;
                padding: 0.3in;
                display: flex;
                flex-direction: column;
                justify-content: center;
                text-align: center;
              }
              .box-id {
                font-size: 32px;
                font-weight: bold;
                margin-bottom: 0.3in;
                color: #164e63;
              }
              .summary {
                margin-bottom: 0.3in;
                font-size: 16px;
                line-height: 1.4;
              }
              .contents-title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 0.2in;
                color: #164e63;
              }
              .items-list {
                text-align: left;
              }
              .item {
                margin: 0.1in 0;
                padding: 0.1in;
                border-left: 3px solid #f97316;
                background: #f9f9f9;
              }
              .item-sku {
                font-weight: bold;
                font-size: 14px;
              }
              .item-details {
                font-size: 12px;
                color: #666;
                margin-top: 2px;
              }
            </style>
          </head>
          <body>
            <div class="label">
              <div class="box-id">${box.id}</div>
              <div class="summary">
                <div><strong>Total Items:</strong> ${box.totalItems}</div>
                <div><strong>SKUs:</strong> ${box.items.length}</div>
              </div>
              <div class="contents-title">Contents:</div>
              <div class="items-list">
                ${box.items
                  .map(
                    (item) => `
                  <div class="item">
                    <div class="item-sku">${item.sku} - ${item.itemName}</div>
                    <div class="item-details">Qty: ${item.quantity} | Location: ${item.location}</div>
                  </div>
                `,
                  )
                  .join("")}
              </div>
            </div>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  const printAllBoxLabels = () => {
    if (packedBoxes.length === 0) return

    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>All Box Labels</title>
            <style>
              @page {
                margin: 0;
                size: 4in 6in;
              }
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body { 
                font-family: Arial, sans-serif; 
                background: white;
              }
              .label {
                width: 4in;
                height: 6in;
                padding: 0.3in;
                display: flex;
                flex-direction: column;
                justify-content: center;
                text-align: center;
                page-break-after: always;
              }
              .label:last-child {
                page-break-after: auto;
              }
              .box-id {
                font-size: 32px;
                font-weight: bold;
                margin-bottom: 0.3in;
                color: #164e63;
              }
              .summary {
                margin-bottom: 0.3in;
                font-size: 16px;
                line-height: 1.4;
              }
              .contents-title {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 0.2in;
                color: #164e63;
              }
              .items-list {
                text-align: left;
              }
              .item {
                margin: 0.1in 0;
                padding: 0.1in;
                border-left: 3px solid #f97316;
                background: #f9f9f9;
              }
              .item-sku {
                font-weight: bold;
                font-size: 14px;
              }
              .item-details {
                font-size: 12px;
                color: #666;
                margin-top: 2px;
              }
            </style>
          </head>
          <body>
            ${packedBoxes
              .map(
                (box) => `
              <div class="label">
                <div class="box-id">${box.id}</div>
                <div class="summary">
                  <div><strong>Total Items:</strong> ${box.totalItems}</div>
                  <div><strong>SKUs:</strong> ${box.items.length}</div>
                </div>
                <div class="contents-title">Contents:</div>
                <div class="items-list">
                  ${box.items
                    .map(
                      (item) => `
                    <div class="item">
                      <div class="item-sku">${item.sku} - ${item.itemName}</div>
                      <div class="item-details">Qty: ${item.quantity} | Location: ${item.location}</div>
                    </div>
                  `,
                    )
                    .join("")}
                </div>
              </div>
            `,
              )
              .join("")}
          </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <Label className="text-lg font-semibold">QR Code Scanner</Label>

        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              placeholder='{"sku":"ITEM-001","quantity":5}'
              value={qrInput}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              className="flex-1"
              autoComplete="off"
            />
            <Button onClick={() => processScan()} disabled={!qrInput.trim()} size="lg">
              <Scan className="mr-2 h-4 w-4" />
              Add to Box
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Scan QR code (auto-processes) or paste data and click "Add to Box"
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Current Box
            <span className="text-sm font-normal text-muted-foreground">
              {currentBox.reduce((sum, item) => sum + item.quantity, 0)} items
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentBox.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Scan QR codes to add items to this box</p>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentBox.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.itemName}</TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>{item.location}</TableCell>
                      <TableCell>
                        {editingItem === item.sku ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              value={editQuantity}
                              onChange={(e) => setEditQuantity(e.target.value)}
                              className="w-16 h-8"
                              min="1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => saveQuantityEdit(item.sku)}
                              className="h-8 w-8 p-0"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={cancelQuantityEdit} className="h-8 w-8 p-0">
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span>{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditingQuantity(item.sku, item.quantity)}
                              className="h-6 w-6 p-0"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeFromBox(item.sku)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="box-number" className="text-sm">
                    Box Number (optional override)
                  </Label>
                  <Input
                    id="box-number"
                    placeholder={`Box ${nextBoxNumber}`}
                    value={customBoxNumber}
                    onChange={(e) => setCustomBoxNumber(e.target.value)}
                  />
                </div>
                <Button onClick={completeBox} className="flex-1">
                  <Package className="mr-2 h-4 w-4" />
                  Complete {customBoxNumber.trim() || `Box ${nextBoxNumber}`}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {packedBoxes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Packed Boxes ({packedBoxes.length})
              <Button variant="outline" onClick={printAllBoxLabels}>
                <Printer className="mr-2 h-4 w-4" />
                Print All Labels
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {packedBoxes
                .slice()
                .reverse()
                .map((box) => (
                  <div key={box.id}>
                    {editingBox === box.id ? (
                      <div className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center gap-2">
                          <Input
                            value={editingBoxName}
                            onChange={(e) => setEditingBoxName(e.target.value)}
                            className="flex-1"
                          />
                          <Button onClick={saveBoxEdit} size="sm">
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button onClick={cancelBoxEdit} variant="outline" size="sm">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Item</TableHead>
                              <TableHead>SKU</TableHead>
                              <TableHead>Qty</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {editingBoxItems.map((item, index) => (
                              <TableRow key={index}>
                                <TableCell>{item.itemName}</TableCell>
                                <TableCell>{item.sku}</TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      updateBoxItemQuantity(item.sku, Number.parseInt(e.target.value) || 0)
                                    }
                                    className="w-20"
                                    min="0"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm" onClick={() => removeBoxItem(item.sku)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{box.id}</div>
                          <div className="text-sm text-muted-foreground">
                            {box.totalItems} items • {box.items.length} SKUs
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => startEditingBox(box)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => printBoxLabel(box)}>
                            Print Label
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
