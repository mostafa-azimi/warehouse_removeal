export interface ShipHeroConfig {
  refreshToken: string;
  accessToken?: string;
  tokenExpiry?: Date;
}

export interface Warehouse {
  id: string;
  name: string;
  address: string;
  decodedId: string;
}

export interface ShipHeroAuthResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface ShipHeroError {
  message: string;
  extensions?: {
    code?: string;
  };
}

export class ShipHeroAPI {
  private config: ShipHeroConfig;
  private refreshPromise: Promise<string> | null = null;

  constructor(config: ShipHeroConfig) {
    this.config = config;
  }

  private async refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();
    return this.refreshPromise;
  }

  private async performTokenRefresh(): Promise<string> {
    console.log('[SHIPHERO API] Starting token refresh')
    
    try {
      console.log('[SHIPHERO API] Making token refresh request to ShipHero')
      const response = await fetch('https://public-api.shiphero.com/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: this.config.refreshToken,
        }),
      });

      console.log('[SHIPHERO API] Token refresh response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[SHIPHERO API] Token refresh failed with response:', errorText)
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }

      const data: ShipHeroAuthResponse = await response.json();
      console.log('[SHIPHERO API] Token refresh successful:', {
        access_token: data.access_token ? data.access_token.substring(0, 20) + '...' : 'undefined',
        expires_in: data.expires_in,
        token_type: data.token_type,
        scope: data.scope
      })
      
      this.config.accessToken = data.access_token;
      this.config.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
      
      // Store in localStorage for persistence
      const configToStore = {
        refreshToken: this.config.refreshToken,
        accessToken: data.access_token,
        tokenExpiry: this.config.tokenExpiry.toISOString(),
      }
      console.log('[SHIPHERO API] Storing updated config in localStorage:', {
        refreshToken: configToStore.refreshToken.substring(0, 20) + '...',
        accessToken: configToStore.accessToken.substring(0, 20) + '...',
        tokenExpiry: configToStore.tokenExpiry
      })
      
      localStorage.setItem('shiphero_config', JSON.stringify(configToStore));

      this.refreshPromise = null;
      return data.access_token;
    } catch (error) {
      console.error('[SHIPHERO API] Token refresh error:', error)
      console.error('[SHIPHERO API] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
      this.refreshPromise = null;
      throw new Error(`Failed to refresh ShipHero token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async getValidAccessToken(): Promise<string> {
    const now = new Date();
    
    // If no token or token expires within 1 hour, refresh
    if (!this.config.accessToken || !this.config.tokenExpiry || this.config.tokenExpiry <= new Date(now.getTime() + 60 * 60 * 1000)) {
      return await this.refreshAccessToken();
    }
    
    return this.config.accessToken;
  }

  private async makeGraphQLRequest(query: string, variables: any = {}): Promise<any> {
    console.log('[SHIPHERO API] Making GraphQL request')
    console.log('[SHIPHERO API] Query:', query.substring(0, 200) + '...')
    console.log('[SHIPHERO API] Variables:', JSON.stringify(variables, null, 2))
    
    const accessToken = await this.getValidAccessToken();
    console.log('[SHIPHERO API] Using access token:', accessToken.substring(0, 20) + '...')
    
    const requestBody = {
      query,
      variables,
    }
    console.log('[SHIPHERO API] Request body size:', JSON.stringify(requestBody).length, 'characters')
    
    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[SHIPHERO API] GraphQL response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[SHIPHERO API] GraphQL request failed with response:', errorText)
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[SHIPHERO API] GraphQL response structure:', {
      hasData: !!data.data,
      hasErrors: !!data.errors,
      errorCount: data.errors?.length || 0,
      dataKeys: data.data ? Object.keys(data.data) : []
    })
    
    if (data.errors && data.errors.length > 0) {
      console.error('[SHIPHERO API] GraphQL errors:', JSON.stringify(data.errors, null, 2))
      throw new Error(`GraphQL errors: ${data.errors.map((e: ShipHeroError) => e.message).join(', ')}`);
    }

    console.log('[SHIPHERO API] GraphQL request successful')
    return data.data;
  }

  async testConnection(): Promise<Warehouse[]> {
    console.log('[SHIPHERO API] Testing connection by fetching warehouses')
    
    const query = `
      query {
        warehouses {
          id
          name
          address {
            address1
            address2
            city
            state
            zip
            country
          }
        }
      }
    `;

    try {
      const data = await this.makeGraphQLRequest(query);
      console.log('[SHIPHERO API] Warehouse query successful, received data:', data)
      
      const warehouses = data.warehouses.map((warehouse: any) => ({
        id: warehouse.id,
        name: warehouse.name,
        address: this.formatAddress(warehouse.address),
        decodedId: this.decodeBase64(warehouse.id),
      }));
      
      console.log('[SHIPHERO API] Processed', warehouses.length, 'warehouses')
      return warehouses;
    } catch (error) {
      console.error('[SHIPHERO API] Failed to fetch warehouses:', error)
      throw new Error(`Failed to fetch warehouses: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createSalesOrder(orderData: {
    orderNumber: string;
    customerEmail: string;
    lineItems: Array<{
      sku: string;
      quantity: number;
      price: number;
      productName?: string;
    }>;
    shippingAddress: {
      firstName: string;
      lastName: string;
      address1: string;
      address2?: string;
      city: string;
      state: string;
      zip: string;
      country: string;
      email?: string;
      phone?: string;
    };
    subtotal: number;
    totalPrice: number;
    shopName?: string;
    customerAccountId?: string;
  }): Promise<string> {
    console.log('[SHIPHERO API] Creating sales order:', {
      orderNumber: orderData.orderNumber,
      customerEmail: orderData.customerEmail,
      lineItemsCount: orderData.lineItems.length,
      subtotal: orderData.subtotal,
      totalPrice: orderData.totalPrice,
      shopName: orderData.shopName,
      customerAccountId: orderData.customerAccountId
    })
    console.log('[SHIPHERO API] Line items:', orderData.lineItems)
    console.log('[SHIPHERO API] Shipping address:', orderData.shippingAddress)
    
    const mutation = `
      mutation CreateOrder($data: CreateOrderInput!) {
        order_create(data: $data) {
          request_id
          complexity
          order {
            id
            order_number
            fulfillment_status
          }
        }
      }
    `;

    const variables = {
      data: {
        order_number: orderData.orderNumber,
        shop_name: orderData.shopName || "Warehouse Removal",
        fulfillment_status: "pending",
        order_date: new Date().toISOString(),
        subtotal: orderData.subtotal,
        total_price: orderData.totalPrice,
        currency: "USD",
        email: orderData.customerEmail,
        shipping_lines: {
          title: "Standard Shipping",
          price: "0.00"
        },
        shipping_address: {
          first_name: orderData.shippingAddress.firstName,
          last_name: orderData.shippingAddress.lastName,
          address1: orderData.shippingAddress.address1,
          address2: orderData.shippingAddress.address2,
          city: orderData.shippingAddress.city,
          state: orderData.shippingAddress.state,
          zip: orderData.shippingAddress.zip,
          country: orderData.shippingAddress.country,
          email: orderData.shippingAddress.email || orderData.customerEmail,
          phone: orderData.shippingAddress.phone,
        },
        line_items: orderData.lineItems.map(item => ({
          sku: item.sku,
          quantity: item.quantity,
          price: item.price.toString(),
          product_name: item.productName || `Product ${item.sku}`,
          fulfillment_status: "pending",
        })),
      },
    };

    console.log('[SHIPHERO API] Order creation variables:', JSON.stringify(variables, null, 2))

    try {
      console.log('🚀 [BROWSER DEBUG] Starting order creation...')
      console.log('🚀 [BROWSER DEBUG] Order data:', JSON.stringify(orderData, null, 2))
      
      const accessToken = await this.getValidAccessToken();
      console.log('🚀 [BROWSER DEBUG] Got access token, length:', accessToken.length)
      
      const requestPayload = {
        accessToken,
        orderData
      }
      console.log('🚀 [BROWSER DEBUG] Sending request payload:', JSON.stringify(requestPayload, null, 2))
      
      const response = await fetch('/api/shiphero/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      console.log('🚀 [BROWSER DEBUG] Response status:', response.status)
      console.log('🚀 [BROWSER DEBUG] Response ok:', response.ok)

      if (!response.ok) {
        const errorData = await response.json()
        console.error('🚨 [BROWSER DEBUG] API request failed:', errorData)
        console.error('🚨 [BROWSER DEBUG] Full error response:', JSON.stringify(errorData, null, 2))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      console.log('✅ [BROWSER DEBUG] Raw API response:', JSON.stringify(data, null, 2))
      
      if (!data.success) {
        console.error('🚨 [BROWSER DEBUG] Response missing success flag:', data)
        throw new Error('Invalid response from create order API - no success flag')
      }
      
      if (!data.orderId) {
        console.error('🚨 [BROWSER DEBUG] Response missing orderId:', data)
        throw new Error('Invalid response from create order API - no orderId')
      }
      
      console.log('🎉 [BROWSER DEBUG] Order created successfully!')
      console.log('🎉 [BROWSER DEBUG] Order ID:', data.orderId)
      console.log('🎉 [BROWSER DEBUG] Order Number:', data.orderNumber)
      console.log('🎉 [BROWSER DEBUG] Account ID:', data.accountId)
      
      return data.orderId;
    } catch (error) {
      console.error('[SHIPHERO API] Failed to create sales order:', error)
      throw new Error(`Failed to create sales order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatAddress(address: any): string {
    const parts = [
      address.address1,
      address.address2,
      address.city,
      address.state,
      address.zip,
      address.country,
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  private decodeBase64(str: string): string {
    try {
      return atob(str);
    } catch {
      return str; // Return original if not valid base64
    }
  }

  getTokenExpiry(): Date | null {
    return this.config.tokenExpiry || null;
  }

  getDaysUntilExpiry(): number {
    if (!this.config.tokenExpiry) return 0;
    
    const now = new Date();
    const diffTime = this.config.tokenExpiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  static loadFromStorage(): ShipHeroConfig | null {
    try {
      const stored = localStorage.getItem('shiphero_config');
      if (!stored) return null;
      
      const config = JSON.parse(stored);
      return {
        refreshToken: config.refreshToken,
        accessToken: config.accessToken,
        tokenExpiry: config.tokenExpiry ? new Date(config.tokenExpiry) : undefined,
      };
    } catch {
      return null;
    }
  }

  static saveToStorage(config: ShipHeroConfig): void {
    localStorage.setItem('shiphero_config', JSON.stringify({
      refreshToken: config.refreshToken,
      accessToken: config.accessToken,
      tokenExpiry: config.tokenExpiry?.toISOString(),
    }));
  }
}
