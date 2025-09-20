/**
 * Centralized ShipHero Data Service
 * Provides caching, deduplication, and optimized data fetching
 */

interface CacheEntry<T = any> {
  data: T
  timestamp: number
  promise?: Promise<T>
}

interface ShipHeroProduct {
  sku: string
  name: string
  active: boolean
  price: string
  inventory: {
    available: number
    on_hand: number
    allocated: number
    warehouse_id: string | null
    warehouse_identifier: string | null
    warehouse_name: string
  }
}

interface ShipHeroWarehouse {
  id: string
  legacy_id: number
  identifier: string
  address: {
    name: string
    address1: string
    address2?: string
    city: string
    state: string
    country: string
    zip: string
    phone?: string
  }
}

class ShipHeroDataService {
  private cache = new Map<string, CacheEntry>()
  private readonly CACHE_DURATION = {
    inventory: 5 * 60 * 1000, // 5 minutes for inventory (changes frequently)
    warehouses: 10 * 60 * 1000, // 10 minutes for warehouses (changes less)
  }

  /**
   * Get access token from localStorage or token manager
   */
  private async getAccessToken(): Promise<string | null> {
    // First try localStorage (immediate)
    const localToken = localStorage.getItem('shiphero_access_token')
    if (localToken) return localToken

    // Fallback to token manager
    try {
      const { tokenManager } = await import('@/lib/shiphero/token-manager')
      return await tokenManager.getValidAccessToken()
    } catch (error) {
      console.error('Failed to get access token:', error)
      return null
    }
  }

  /**
   * Generic cache management
   */
  private getCacheKey(type: string, identifier: string = 'default'): string {
    return `${type}_${identifier}`
  }

  private isExpired(entry: CacheEntry, duration: number): boolean {
    return Date.now() - entry.timestamp > duration
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      // Use max duration for cleanup
      if (now - entry.timestamp > Math.max(...Object.values(this.CACHE_DURATION)) * 2) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Fetch ShipHero inventory with caching and deduplication
   */
  async getInventory(forceRefresh = false): Promise<ShipHeroProduct[]> {
    const cacheKey = this.getCacheKey('inventory')
    const cached = this.cache.get(cacheKey)

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && cached && !this.isExpired(cached, this.CACHE_DURATION.inventory)) {
      console.log('🚀 Returning cached inventory data')
      return cached.data
    }

    // If there's already a request in flight, wait for it (deduplication)
    if (cached?.promise) {
      console.log('⏳ Waiting for existing inventory request')
      return await cached.promise
    }

    // Create new request
    const promise = this.fetchInventoryFromAPI()
    
    // Store promise immediately for deduplication
    this.cache.set(cacheKey, {
      data: cached?.data || [],
      timestamp: cached?.timestamp || 0,
      promise
    })

    try {
      const data = await promise
      
      // Update cache with successful result
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      })

      this.cleanupExpiredEntries()
      return data
    } catch (error) {
      // Remove failed promise from cache
      if (cached) {
        this.cache.set(cacheKey, {
          data: cached.data,
          timestamp: cached.timestamp,
        })
      } else {
        this.cache.delete(cacheKey)
      }
      throw error
    }
  }

  /**
   * Fetch ShipHero warehouses with caching and deduplication
   */
  async getWarehouses(forceRefresh = false): Promise<ShipHeroWarehouse[]> {
    const cacheKey = this.getCacheKey('warehouses')
    const cached = this.cache.get(cacheKey)

    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && cached && !this.isExpired(cached, this.CACHE_DURATION.warehouses)) {
      console.log('🚀 Returning cached warehouse data')
      return cached.data
    }

    // If there's already a request in flight, wait for it (deduplication)
    if (cached?.promise) {
      console.log('⏳ Waiting for existing warehouse request')
      return await cached.promise
    }

    // Create new request
    const promise = this.fetchWarehousesFromAPI()
    
    // Store promise immediately for deduplication
    this.cache.set(cacheKey, {
      data: cached?.data || [],
      timestamp: cached?.timestamp || 0,
      promise
    })

    try {
      const data = await promise
      
      // Update cache with successful result
      this.cache.set(cacheKey, {
        data,
        timestamp: Date.now(),
      })

      this.cleanupExpiredEntries()
      return data
    } catch (error) {
      // Remove failed promise from cache
      if (cached) {
        this.cache.set(cacheKey, {
          data: cached.data,
          timestamp: cached.timestamp,
        })
      } else {
        this.cache.delete(cacheKey)
      }
      throw error
    }
  }

  /**
   * Get filtered inventory by warehouse
   */
  async getInventoryByWarehouse(warehouseId: string, forceRefresh = false): Promise<ShipHeroProduct[]> {
    const allInventory = await this.getInventory(forceRefresh)
    return allInventory.filter(product => product.inventory.warehouse_id === warehouseId)
  }

  /**
   * Get active products only
   */
  async getActiveProducts(forceRefresh = false): Promise<ShipHeroProduct[]> {
    const allInventory = await this.getInventory(forceRefresh)
    return allInventory.filter(product => product.active === true)
  }

  /**
   * Private method to fetch inventory from API
   */
  private async fetchInventoryFromAPI(): Promise<ShipHeroProduct[]> {
    const accessToken = await this.getAccessToken()
    if (!accessToken) {
      throw new Error('No ShipHero access token available')
    }

    console.log('📦 Fetching inventory from ShipHero API...')
    const response = await fetch('/api/shiphero/inventory', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch inventory: ${response.status}`)
    }

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch inventory')
    }

    return result.products || []
  }

  /**
   * Private method to fetch warehouses from API
   */
  private async fetchWarehousesFromAPI(): Promise<ShipHeroWarehouse[]> {
    const accessToken = await this.getAccessToken()
    if (!accessToken) {
      throw new Error('No ShipHero access token available')
    }

    console.log('🏭 Fetching warehouses from ShipHero API...')
    const response = await fetch('/api/shiphero/warehouses', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch warehouses: ${response.status}`)
    }

    const result = await response.json()
    return result.data?.account?.data?.warehouses || []
  }

  /**
   * Clear all cache (useful for logout or token refresh)
   */
  clearCache(): void {
    this.cache.clear()
    console.log('🗑️ ShipHero data cache cleared')
  }

  /**
   * Get cache stats for debugging
   */
  getCacheStats() {
    const stats = {
      entries: this.cache.size,
      keys: Array.from(this.cache.keys()),
      ages: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        ageSeconds: Math.round((Date.now() - entry.timestamp) / 1000),
        hasPromise: !!entry.promise
      }))
    }
    console.log('📊 Cache stats:', stats)
    return stats
  }
}

// Export singleton instance
export const shipHeroDataService = new ShipHeroDataService()
