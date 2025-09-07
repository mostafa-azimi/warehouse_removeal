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
    try {
      const response = await fetch('https://public-api.shiphero.com/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: this.config.refreshToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
      }

      const data: ShipHeroAuthResponse = await response.json();
      
      this.config.accessToken = data.access_token;
      this.config.tokenExpiry = new Date(Date.now() + data.expires_in * 1000);
      
      // Store in localStorage for persistence
      localStorage.setItem('shiphero_config', JSON.stringify({
        refreshToken: this.config.refreshToken,
        accessToken: data.access_token,
        tokenExpiry: this.config.tokenExpiry.toISOString(),
      }));

      this.refreshPromise = null;
      return data.access_token;
    } catch (error) {
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
    const accessToken = await this.getValidAccessToken();
    
    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.errors && data.errors.length > 0) {
      throw new Error(`GraphQL errors: ${data.errors.map((e: ShipHeroError) => e.message).join(', ')}`);
    }

    return data.data;
  }

  async testConnection(): Promise<Warehouse[]> {
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
      
      return data.warehouses.map((warehouse: any) => ({
        id: warehouse.id,
        name: warehouse.name,
        address: this.formatAddress(warehouse.address),
        decodedId: this.decodeBase64(warehouse.id),
      }));
    } catch (error) {
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
  }): Promise<string> {
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

    try {
      const data = await this.makeGraphQLRequest(mutation, variables);
      return data.order_create.order.id;
    } catch (error) {
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
