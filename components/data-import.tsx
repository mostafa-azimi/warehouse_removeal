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
  onDataImported: (data: InventoryItem[]) => void
  inventoryData: InventoryItem[]
}

export function DataImport({ onDataImported, inventoryData }: DataImportProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isGeneratingQR, setIsGeneratingQR] = useState(false)

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
        })

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
                  <TableHead>Location</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDisplayData.slice(0, 10).map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.item}</TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell>{item.location}</TableCell>
                    <TableCell>{item.units}</TableCell>
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
