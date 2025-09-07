"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { QrCode, Search, FileText } from "lucide-react"
import type { InventoryItem } from "@/app/page"

interface QRGeneratorProps {
  inventoryData: InventoryItem[]
}

const generateQRCodeDataURL = (data: string): string => {
  // Simple QR code generation using a more reliable service with base64 encoding
  const size = 200
  const encodedData = encodeURIComponent(data)
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&format=png&data=${encodedData}`
}

const generatePDF = async (items: InventoryItem[], isAllItems = false) => {
  // Dynamic import of jsPDF to avoid SSR issues
  const { jsPDF } = await import("jspdf")

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "in",
    format: [4, 6], // 4x6 inch labels
  })

  let isFirstPage = true

  for (const item of items) {
    if (!isFirstPage) {
      pdf.addPage([4, 6])
    }
    isFirstPage = false

    // Generate QR code data
    const qrContent = JSON.stringify({
      sku: item.sku,
      quantity: item.units,
    })

    // Add item name at top
    pdf.setFontSize(14)
    pdf.setFont("helvetica", "bold")
    const itemName = item.item
    const lines = pdf.splitTextToSize(itemName, 3.6)
    let yPos = 0.5
    lines.forEach((line: string) => {
      pdf.text(line, 2, yPos, { align: "center" })
      yPos += 0.2
    })

    // Add QR code placeholder (we'll use a simple text representation)
    pdf.setFontSize(8)
    pdf.setFont("helvetica", "normal")
    pdf.text("QR CODE", 2, yPos + 1.2, { align: "center" })
    pdf.rect(1.25, yPos + 0.5, 1.5, 1.5) // QR code box

    // Add QR data as text for reference
    pdf.setFontSize(6)
    pdf.text(qrContent, 2, yPos + 2.2, { align: "center", maxWidth: 3.6 })

    // Add item details
    pdf.setFontSize(12)
    pdf.setFont("helvetica", "bold")
    yPos += 2.8
    pdf.text(`SKU: ${item.sku}`, 2, yPos, { align: "center" })
    pdf.text(`Location: ${item.location}`, 2, yPos + 0.3, { align: "center" })
    pdf.text(`Quantity: ${item.units}`, 2, yPos + 0.6, { align: "center" })
  }

  // Save the PDF
  const filename = isAllItems ? `QR_Labels_All_${items.length}_Items.pdf` : `QR_Label_${items[0].sku}.pdf`
  pdf.save(filename)
}

export function QRGenerator({ inventoryData }: QRGeneratorProps) {
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
  const [customQuantity, setCustomQuantity] = useState<string>("")
  const [searchTerm, setSearchTerm] = useState("")
  const [qrData, setQrData] = useState<string | null>(null)
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null)

  const filteredItems = inventoryData.filter(
    (item) =>
      item.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const generateQR = () => {
    if (!selectedItem) return

    const quantity = customQuantity ? Number.parseInt(customQuantity) : selectedItem.units
    const qrContent = JSON.stringify({
      sku: selectedItem.sku,
      quantity: quantity,
    })

    setQrData(qrContent)
    setQrImageUrl(generateQRCodeDataURL(qrContent))
  }

  const printLabel = async () => {
    if (!selectedItem) return
    await generatePDF([selectedItem])
  }

  const generateAllQRForPrint = async () => {
    if (inventoryData.length === 0) return
    await generatePDF(inventoryData, true)
  }

  return (
    <div className="space-y-6">
      {inventoryData.length === 0 ? (
        <Alert>
          <AlertDescription>Please import inventory data first to generate QR codes.</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">QR Code Generator</h2>
            <div className="flex gap-2">
              <Button onClick={generateAllQRForPrint} className="bg-blue-600 hover:bg-blue-700">
                <FileText className="mr-2 h-4 w-4" />
                Generate PDF ({inventoryData.length})
              </Button>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              Use "Generate PDF" to create a clean PDF file with all {inventoryData.length} QR code labels - no browser
              headers or footers!
            </AlertDescription>
          </Alert>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Items</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by item name, SKU, or location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-select">Select Item</Label>
              <Select
                onValueChange={(value) => {
                  const item = filteredItems.find((i) => i.sku === value)
                  setSelectedItem(item || null)
                  setQrData(null)
                  setQrImageUrl(null) // Reset QR image URL when selecting a new item
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an item to generate QR code" />
                </SelectTrigger>
                <SelectContent>
                  {filteredItems.map((item) => (
                    <SelectItem key={item.sku} value={item.sku}>
                      {item.item} - {item.sku} ({item.location})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedItem && (
              <div className="space-y-2">
                <Label htmlFor="quantity">Custom Quantity (optional)</Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder={`Default: ${selectedItem.units}`}
                  value={customQuantity}
                  onChange={(e) => setCustomQuantity(e.target.value)}
                />
              </div>
            )}

            <Button onClick={generateQR} disabled={!selectedItem} className="w-full">
              <QrCode className="mr-2 h-4 w-4" />
              Generate QR Code
            </Button>
          </div>

          {selectedItem && qrData && qrImageUrl && (
            <Card>
              <CardHeader>
                <CardTitle>Generated QR Code Label</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center space-y-4 p-6 border-2 border-dashed border-border rounded-lg">
                  <div className="text-center">
                    <h3 className="font-semibold text-lg">{selectedItem.item}</h3>
                  </div>

                  <img src={qrImageUrl || "/placeholder.svg"} alt="Generated QR Code" className="border" />

                  <div className="text-center space-y-1 text-sm">
                    <div>
                      <strong>SKU:</strong> {selectedItem.sku}
                    </div>
                    <div>
                      <strong>Location:</strong> {selectedItem.location}
                    </div>
                    <div>
                      <strong>Quantity:</strong> {customQuantity || selectedItem.units}
                    </div>
                  </div>
                </div>

                <Button onClick={printLabel} className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  Generate PDF Label
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
