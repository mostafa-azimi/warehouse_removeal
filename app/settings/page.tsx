import { ShipHeroSettings } from '@/components/ShipHeroSettings'

export default function SettingsPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">ShipHero Settings</h1>
        <p className="text-gray-600 mt-2">Manage your ShipHero API connection and tokens</p>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm">
        <ShipHeroSettings />
      </div>
    </div>
  )
}
