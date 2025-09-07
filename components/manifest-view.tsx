"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Package, FileText, Printer } from "lucide-react"
import type { PackedBox } from "@/app/page"

interface ManifestViewProps {
  packedBoxes: PackedBox[]
}

export function ManifestView({ packedBoxes }: ManifestViewProps) {
  const totalBoxes = packedBoxes.length
  const totalItems = packedBoxes.reduce((sum, box) => sum + box.totalItems, 0)
  const totalSKUs = new Set(packedBoxes.flatMap((box) => box.items.map((item) => item.sku))).size

  const exportManifest = () => {
    const manifestData = {
      exportDate: new Date().toISOString(),
      summary: {
        totalBoxes,
        totalItems,
        totalSKUs,
      },
      boxes: packedBoxes.map((box) => ({
        boxId: box.id,
        createdAt: box.createdAt,
        totalItems: box.totalItems,
        items: box.items,
      })),
    }

    const blob = new Blob([JSON.stringify(manifestData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `warehouse-manifest-${new Date().toISOString().split("T")[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportCSV = () => {
    const csvRows = [["Box ID", "Created At", "SKU", "Item Name", "Location", "Quantity"]]

    packedBoxes.forEach((box) => {
      box.items.forEach((item) => {
        csvRows.push([
          box.id,
          new Date(box.createdAt).toLocaleString(),
          item.sku,
          item.itemName,
          item.location,
          item.quantity.toString(),
        ])
      })
    })

    const csvContent = csvRows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `warehouse-manifest-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const exportPDF = () => {
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      let manifestHtml = `
        <div class="manifest-header">
          <h1>Warehouse Manifest</h1>
          <p>Export Date: ${new Date().toLocaleString()}</p>
          <div class="summary">
            <div>Total Boxes: ${totalBoxes}</div>
            <div>Total Items: ${totalItems}</div>
            <div>Unique SKUs: ${totalSKUs}</div>
          </div>
        </div>
        <div class="manifest-content">
      `

      packedBoxes.forEach((box) => {
        manifestHtml += `
          <div class="box-section">
            <h2>${box.id}</h2>
            <p>Created: ${new Date(box.createdAt).toLocaleString()}</p>
            <p>Total Items: ${box.totalItems}</p>
            <div class="box-contents">
              <h3>Contents:</h3>
              <ul>
        `

        box.items.forEach((item) => {
          manifestHtml += `
            <li>
              <strong>${item.itemName}</strong> - ${item.sku}<br>
              Qty: ${item.quantity} | Location: ${item.location}
            </li>
          `
        })

        manifestHtml += `
              </ul>
            </div>
          </div>
        `
      })

      manifestHtml += `</div>`

      printWindow.document.write(`
        <html>
          <head>
            <title>Warehouse Manifest - ${new Date().toISOString().split("T")[0]}</title>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              body { 
                font-family: Arial, sans-serif; 
                padding: 1in;
                line-height: 1.4;
                color: #333;
              }
              .manifest-header {
                text-align: center;
                margin-bottom: 2rem;
                border-bottom: 2px solid #333;
                padding-bottom: 1rem;
              }
              .manifest-header h1 {
                font-size: 2rem;
                margin-bottom: 0.5rem;
              }
              .summary {
                display: flex;
                justify-content: center;
                gap: 2rem;
                margin-top: 1rem;
                font-weight: bold;
              }
              .box-section {
                margin-bottom: 2rem;
                page-break-inside: avoid;
              }
              .box-section h2 {
                font-size: 1.5rem;
                color: #0891b2;
                margin-bottom: 0.5rem;
              }
              .box-section h3 {
                font-size: 1.1rem;
                margin: 1rem 0 0.5rem 0;
              }
              .box-contents ul {
                list-style: none;
                padding-left: 1rem;
              }
              .box-contents li {
                margin-bottom: 0.5rem;
                padding: 0.5rem;
                background: #f8f9fa;
                border-left: 3px solid #0891b2;
              }
              @media print {
                body { margin: 0; padding: 0.5in; }
                @page { margin: 0.5in; }
              }
            </style>
          </head>
          <body>
            ${manifestHtml}
          </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  const printManifest = () => {
    exportPDF()
    setTimeout(() => {
      const printWindow = window.open("", "_blank")
      if (printWindow) {
        printWindow.print()
      }
    }, 1000)
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totalBoxes}</p>
                <p className="text-sm text-muted-foreground">Total Boxes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-secondary" />
              <div>
                <p className="text-2xl font-bold">{totalItems}</p>
                <p className="text-sm text-muted-foreground">Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-accent" />
              <div>
                <p className="text-2xl font-bold">{totalSKUs}</p>
                <p className="text-sm text-muted-foreground">Unique SKUs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        <Button onClick={exportManifest} disabled={packedBoxes.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export JSON
        </Button>
        <Button onClick={exportCSV} disabled={packedBoxes.length === 0} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Button onClick={exportPDF} disabled={packedBoxes.length === 0} variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Export PDF
        </Button>
        <Button onClick={printManifest} disabled={packedBoxes.length === 0} variant="outline">
          <Printer className="mr-2 h-4 w-4" />
          Print Manifest
        </Button>
      </div>

      {packedBoxes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">No packed boxes yet. Start scanning items to create boxes.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Packed Boxes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Box ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>SKUs</TableHead>
                  <TableHead>Contents</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packedBoxes.map((box) => (
                  <TableRow key={box.id}>
                    <TableCell className="font-medium">{box.id}</TableCell>
                    <TableCell>{new Date(box.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{box.totalItems}</TableCell>
                    <TableCell>{box.items.length}</TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        {box.items.map((item, index) => (
                          <div key={index} className="text-sm">
                            {item.sku} ({item.quantity})
                          </div>
                        ))}
                      </div>
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
