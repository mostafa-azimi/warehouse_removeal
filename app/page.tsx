"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Upload, Scan, Package, FileText, Settings } from "lucide-react"
import { DataImport } from "@/components/data-import"
import { QRScanner } from "@/components/qr-scanner"
import { ManifestView } from "@/components/manifest-view"
import { Settings as SettingsComponent } from "@/components/settings"
import { ShipHeroConfig } from "@/lib/shiphero-api"

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
  const [inventoryData, setInventoryData] = useState<InventoryItem[]>([])
  const [packedBoxes, setPackedBoxes] = useState<PackedBox[]>([])
  const [currentBox, setCurrentBox] = useState<BoxItem[]>([])
  const [activeTab, setActiveTab] = useState("import")
  const [shipheroConfig, setShipheroConfig] = useState<ShipHeroConfig | null>(null)

  // Debug logging in useEffect to avoid render loop
  useEffect(() => {
    console.log("[WAREHOUSE_APP] Component rendered")
    console.log("[WAREHOUSE_APP] Current active tab:", activeTab)
    console.log("[WAREHOUSE_APP] Inventory data length:", inventoryData.length)
    console.log("[WAREHOUSE_APP] Current box items:", currentBox.length)
    console.log("[WAREHOUSE_APP] ShipHero config:", shipheroConfig ? "configured" : "not configured")
  })

  const handleTabChange = (newTab: string) => {
    console.log("[WAREHOUSE_APP] Tab change requested:", newTab)
    console.log("[WAREHOUSE_APP] Previous tab:", activeTab)
    setActiveTab(newTab)
    console.log("[WAREHOUSE_APP] Tab state updated to:", newTab)
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <Package className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Warehouse Removal</h1>
              <p className="text-muted-foreground">Generate QR codes, scan items, and manage inventory removal with ShipHero integration</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger 
              value="import" 
              className="flex items-center gap-2"
              onClick={() => console.log("[TAB_TRIGGER] Import tab clicked")}
            >
              <Upload className="h-4 w-4" />
              Import Data
            </TabsTrigger>
            <TabsTrigger 
              value="scan" 
              className="flex items-center gap-2"
              onClick={() => console.log("[TAB_TRIGGER] Scan tab clicked")}
            >
              <Scan className="h-4 w-4" />
              Scan & Pack
            </TabsTrigger>
            <TabsTrigger 
              value="manifest" 
              className="flex items-center gap-2"
              onClick={() => console.log("[TAB_TRIGGER] Manifest tab clicked")}
            >
              <FileText className="h-4 w-4" />
              Manifest
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="flex items-center gap-2"
              onClick={() => console.log("[TAB_TRIGGER] Settings tab clicked")}
            >
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="import">
            <Card>
              <CardHeader>
                <CardTitle>Import Inventory Data</CardTitle>
                <CardDescription>Upload your CSV file to import warehouse inventory data</CardDescription>
              </CardHeader>
              <CardContent>
                <DataImport onDataImported={setInventoryData} inventoryData={inventoryData} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scan">
            <Card>
              <CardHeader>
                <CardTitle>Scan QR Codes & Build Boxes</CardTitle>
                <CardDescription>Scan QR codes to add items to boxes and generate packing labels</CardDescription>
              </CardHeader>
              <CardContent>
                {inventoryData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Scan className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Please import inventory data first to enable scanning</p>
                  </div>
                ) : (
                  <QRScanner
                    currentBox={currentBox}
                    setCurrentBox={setCurrentBox}
                    packedBoxes={packedBoxes}
                    setPackedBoxes={setPackedBoxes}
                    inventoryData={inventoryData}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manifest">
            <Card>
              <CardHeader>
                <CardTitle>Shipping Manifest</CardTitle>
                <CardDescription>View and export your packing manifest</CardDescription>
              </CardHeader>
              <CardContent>
                <ManifestView packedBoxes={packedBoxes} shipheroConfig={shipheroConfig} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <SettingsComponent onConfigChange={setShipheroConfig} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
