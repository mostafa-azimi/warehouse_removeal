/**
 * ShipHero Token Management Utility
 * Handles automatic token refresh and persistence across deployments
 */

interface TokenData {
  accessToken: string
  refreshToken: string
  expiresAt: string
  createdAt: string
}

export class ShipHeroTokenManager {
  private static instance: ShipHeroTokenManager
  private refreshInterval: NodeJS.Timeout | null = null
  private readonly STORAGE_KEY = 'shiphero_tokens'

  private constructor() {}

  public static getInstance(): ShipHeroTokenManager {
    if (!ShipHeroTokenManager.instance) {
      ShipHeroTokenManager.instance = new ShipHeroTokenManager()
    }
    return ShipHeroTokenManager.instance
  }

  /**
   * Store tokens with multiple persistence strategies
   */
  private storeTokens(tokenData: TokenData): void {
    try {
      // Strategy 1: localStorage (works within same domain)
      localStorage.setItem('shiphero_access_token', tokenData.accessToken)
      localStorage.setItem('shiphero_refresh_token', tokenData.refreshToken)
      localStorage.setItem('shiphero_token_expires_at', tokenData.expiresAt)
      
      // Strategy 2: Consolidated storage (easier to manage)
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(tokenData))
      
      // Strategy 3: IndexedDB for cross-domain persistence (more robust)
      this.storeInIndexedDB(tokenData)
      
      // Strategy 4: Cookie for cross-subdomain access
      this.storeInCookie(tokenData)
      
    } catch (error) {
      console.error('❌ Failed to store tokens:', error)
    }
  }

  /**
   * Retrieve tokens with fallback strategies
   */
  private getStoredTokens(): TokenData | null {
    try {
      // Strategy 1: Try consolidated localStorage first
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const tokenData = JSON.parse(stored)
        if (this.isValidTokenData(tokenData)) {
          return tokenData
        }
      }

      // Strategy 2: Try legacy localStorage format
      const accessToken = localStorage.getItem('shiphero_access_token')
      const refreshToken = localStorage.getItem('shiphero_refresh_token')
      const expiresAt = localStorage.getItem('shiphero_token_expires_at')
      
      if (accessToken && refreshToken && expiresAt) {
        return {
          accessToken,
          refreshToken,
          expiresAt,
          createdAt: new Date().toISOString()
        }
      }

      // Strategy 3: Try IndexedDB (for cross-deployment persistence)
      // This would be async, so we'll handle it separately
      
      // Strategy 4: Try cookie
      const cookieData = this.getFromCookie()
      if (cookieData) {
        return cookieData
      }

    } catch (error) {
      console.error('❌ Failed to retrieve tokens:', error)
    }

    return null
  }

  /**
   * Store tokens in IndexedDB for better persistence
   */
  private async storeInIndexedDB(tokenData: TokenData): Promise<void> {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) return

      const request = indexedDB.open('ShipHeroTokens', 1)
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('tokens')) {
          db.createObjectStore('tokens')
        }
      }

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const transaction = db.transaction(['tokens'], 'readwrite')
        const store = transaction.objectStore('tokens')
        store.put(tokenData, 'current')
      }
    } catch (error) {
      // IndexedDB not critical, just log error
      console.warn('⚠️ IndexedDB storage failed:', error)
    }
  }

  /**
   * Store tokens in cookie for cross-subdomain access
   */
  private storeInCookie(tokenData: TokenData): void {
    try {
      if (typeof document === 'undefined') return

      // Only store refresh token in cookie for security
      const cookieData = {
        refreshToken: tokenData.refreshToken,
        expiresAt: tokenData.expiresAt,
        createdAt: tokenData.createdAt
      }

      const cookieValue = btoa(JSON.stringify(cookieData))
      const expirationDate = new Date(tokenData.expiresAt)
      
      // Set cookie with proper domain and security settings
      document.cookie = `shiphero_refresh=${cookieValue}; expires=${expirationDate.toUTCString()}; path=/; SameSite=Strict; Secure`
    } catch (error) {
      console.warn('⚠️ Cookie storage failed:', error)
    }
  }

  /**
   * Get tokens from cookie
   */
  private getFromCookie(): TokenData | null {
    try {
      if (typeof document === 'undefined') return null

      const cookies = document.cookie.split(';')
      const shipheroRefresh = cookies.find(cookie => cookie.trim().startsWith('shiphero_refresh='))
      
      if (shipheroRefresh) {
        const cookieValue = shipheroRefresh.split('=')[1]
        const decodedData = JSON.parse(atob(cookieValue))
        
        if (decodedData.refreshToken && decodedData.expiresAt) {
          return {
            accessToken: '', // Will need to be refreshed
            refreshToken: decodedData.refreshToken,
            expiresAt: decodedData.expiresAt,
            createdAt: decodedData.createdAt
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Cookie retrieval failed:', error)
    }

    return null
  }

  /**
   * Validate token data structure
   */
  private isValidTokenData(data: any): data is TokenData {
    return data && 
           typeof data.accessToken === 'string' && 
           typeof data.refreshToken === 'string' && 
           typeof data.expiresAt === 'string'
  }

  /**
   * Check if access token exists and is valid
   */
  public hasValidAccessToken(): boolean {
    const tokenData = this.getStoredTokens()
    
    if (!tokenData || !tokenData.accessToken) {
      return false
    }

    const expirationDate = new Date(tokenData.expiresAt)
    const now = new Date()
    const minutesUntilExpiry = (expirationDate.getTime() - now.getTime()) / (1000 * 60)
    
    // Consider token invalid if it expires in less than 1 day (since tokens last 28 days)
    return minutesUntilExpiry > (24 * 60) // 1 day in minutes
  }

  /**
   * Get access token, refreshing if necessary
   */
  public async getValidAccessToken(): Promise<string | null> {
    const tokenData = this.getStoredTokens()
    
    // If we have a valid access token, return it
    if (tokenData?.accessToken && this.hasValidAccessToken()) {
      return tokenData.accessToken
    }

    // If we have a refresh token but no/expired access token, try to refresh
    if (tokenData?.refreshToken) {
      const refreshed = await this.refreshAccessToken()
      if (refreshed) {
        const newTokenData = this.getStoredTokens()
        return newTokenData?.accessToken || null
      }
    }

    return null
  }

  /**
   * Refresh the access token using the refresh token
   */
  public async refreshAccessToken(): Promise<boolean> {
    const tokenData = this.getStoredTokens()
    
    if (!tokenData?.refreshToken) {
      console.error('❌ No refresh token available for auto-refresh')
      return false
    }

    try {
      const response = await fetch('/api/shiphero/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: tokenData.refreshToken }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.access_token) {
        // Calculate and store expiration (ShipHero tokens last 28 days)
        const expirationDate = new Date()
        expirationDate.setDate(expirationDate.getDate() + 28)
        
        const newTokenData: TokenData = {
          accessToken: data.access_token,
          refreshToken: tokenData.refreshToken, // Keep existing refresh token
          expiresAt: expirationDate.toISOString(),
          createdAt: new Date().toISOString()
        }
        
        // Store with all persistence strategies
        this.storeTokens(newTokenData)
        
        return true
      } else {
        throw new Error('No access token in response')
      }
    } catch (error) {
      console.error('❌ Failed to auto-refresh access token:', error)
      return false
    }
  }

  /**
   * Store new tokens (called when user manually enters refresh token)
   */
  public storeNewTokens(accessToken: string, refreshToken: string): void {
    const expirationDate = new Date()
    expirationDate.setDate(expirationDate.getDate() + 28)
    
    const tokenData: TokenData = {
      accessToken,
      refreshToken,
      expiresAt: expirationDate.toISOString(),
      createdAt: new Date().toISOString()
    }
    
    this.storeTokens(tokenData)
  }

  /**
   * Start automatic token refresh monitoring
   */
  public startAutoRefresh(): void {
    // Clear existing interval
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
    }

    // Check every hour (since tokens last 28 days)
    this.refreshInterval = setInterval(async () => {
      const tokenData = this.getStoredTokens()
      if (tokenData?.expiresAt) {
        const expirationDate = new Date(tokenData.expiresAt)
        const now = new Date()
        const minutesUntilExpiry = (expirationDate.getTime() - now.getTime()) / (1000 * 60)
        
        // Refresh if expires in less than 2 days (since tokens last 28 days)
        const twoDaysInMinutes = 2 * 24 * 60
        if (minutesUntilExpiry < twoDaysInMinutes && minutesUntilExpiry > 0) {
          await this.refreshAccessToken()
        }
      }
    }, 60 * 60 * 1000) // Check every hour

  }

  /**
   * Stop automatic token refresh monitoring
   */
  public stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval)
      this.refreshInterval = null
    }
  }
}

// Export singleton instance
export const tokenManager = ShipHeroTokenManager.getInstance()
