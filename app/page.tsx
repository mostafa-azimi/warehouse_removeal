"use client"

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataImport } from '@/components/data-import'
import { QRScanner } from '@/components/qr-scanner'
import { ManifestView } from '@/components/manifest-view'
import { SettingsComponent } from '@/components/settings'
import { ShipHeroConfig } from '@/lib/shiphero-api'

export default function WarehouseApp() {
  const [activeTab, setActiveTab] = useState('data-import')
  const [shipheroConfig, setShipheroConfig] = useState<ShipHeroConfig | null>(null)

  const handleConfigChange = (config: ShipHeroConfig) => {
    setShipheroConfig(config)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Warehouse Removal App</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="data-import">Data Import</TabsTrigger>
            <TabsTrigger value="qr-scanner">QR Scanner</TabsTrigger>
            <TabsTrigger value="manifest">Manifest</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="data-import" className="mt-6">
            <DataImport />
          </TabsContent>
          
          <TabsContent value="qr-scanner" className="mt-6">
            <QRScanner />
          </TabsContent>
          
          <TabsContent value="manifest" className="mt-6">
            <ManifestView shipheroConfig={shipheroConfig} />
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <SettingsComponent onConfigChange={handleConfigChange} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
