"use client"

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings } from '@/components/settings'
import { ShipHeroConfig } from '@/lib/shiphero-api'

export default function WarehouseApp() {
  const [activeTab, setActiveTab] = useState('test')
  const [shipheroConfig, setShipheroConfig] = useState<ShipHeroConfig | null>(null)

  const handleConfigChange = (config: ShipHeroConfig) => {
    setShipheroConfig(config)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">Warehouse Removal App - Testing</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="test">Test Tab</TabsTrigger>
            <TabsTrigger value="data-import">Data Import</TabsTrigger>
            <TabsTrigger value="qr-scanner">QR Scanner</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="test" className="mt-6">
            <div className="p-6 bg-white rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Test Tab - Working!</h2>
              <p>If you can see this and switch tabs, the basic structure works.</p>
              <button 
                onClick={() => alert('Tab system works!')}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Test Button
              </button>
            </div>
          </TabsContent>
          
          <TabsContent value="data-import" className="mt-6">
            <div className="p-6 bg-white rounded-lg shadow">
              <p>Data Import tab - placeholder</p>
            </div>
          </TabsContent>
          
          <TabsContent value="qr-scanner" className="mt-6">
            <div className="p-6 bg-white rounded-lg shadow">
              <p>QR Scanner tab - placeholder</p>
            </div>
          </TabsContent>
          
          <TabsContent value="settings" className="mt-6">
            <div className="p-6 bg-white rounded-lg shadow">
              <h2 className="text-xl font-semibold mb-4">Settings - Debug Mode</h2>
              <p>Testing if Settings component itself is the issue...</p>
              <button 
                onClick={() => alert('Settings placeholder works!')}
                className="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Test Settings Button
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
