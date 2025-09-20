import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('ShipHero create order API route called (POST)')

    const requestBody = await request.json()
    const { accessToken, orderData } = requestBody

    console.log('Access token received:', accessToken ? 'Present' : 'Missing')
    console.log('Order data received:', JSON.stringify(orderData, null, 2))

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 401 })
    }

    if (!orderData) {
      return NextResponse.json({ error: 'Order data is required' }, { status: 400 })
    }

    // FIXED: Removed user_errors and used direct mutation structure
    const mutation = `
      mutation {
        order_create(
          data: {
            order_number: "${orderData.orderNumber}"
            shop_name: "${orderData.shopName || 'Warehouse Removal'}"
            fulfillment_status: "pending"
            order_date: "${new Date().toISOString().split('T')[0]}"
            total_tax: "0.00"
            subtotal: "${orderData.subtotal || '0.00'}"
            total_discounts: "0.00"
            total_price: "${orderData.totalPrice || '0.00'}"
            ${orderData.customerAccountId ? `account_id: "${orderData.customerAccountId}"` : ''}
            email: "${orderData.customerEmail}"
            shipping_lines: {
              title: "Standard Shipping"
              price: "0.00"
              carrier: "USPS"
              method: "Ground"
            }
            shipping_address: {
              first_name: "${orderData.shippingAddress.firstName}"
              last_name: "${orderData.shippingAddress.lastName}"
              address1: "${orderData.shippingAddress.address1}"
              ${orderData.shippingAddress.address2 ? `address2: "${orderData.shippingAddress.address2}"` : ''}
              city: "${orderData.shippingAddress.city}"
              state: "${orderData.shippingAddress.state}"
              zip: "${orderData.shippingAddress.zip}"
              country: "${orderData.shippingAddress.country || 'US'}"
              country_code: "${orderData.shippingAddress.country || 'US'}"
              email: "${orderData.customerEmail}"
              ${orderData.shippingAddress.phone ? `phone: "${orderData.shippingAddress.phone}"` : ''}
            }
            billing_address: {
              first_name: "${orderData.shippingAddress.firstName}"
              last_name: "${orderData.shippingAddress.lastName}"
              address1: "${orderData.shippingAddress.address1}"
              ${orderData.shippingAddress.address2 ? `address2: "${orderData.shippingAddress.address2}"` : ''}
              city: "${orderData.shippingAddress.city}"
              state: "${orderData.shippingAddress.state}"
              zip: "${orderData.shippingAddress.zip}"
              country: "${orderData.shippingAddress.country || 'US'}"
              country_code: "${orderData.shippingAddress.country || 'US'}"
              email: "${orderData.customerEmail}"
              ${orderData.shippingAddress.phone ? `phone: "${orderData.shippingAddress.phone}"` : ''}
            }
            line_items: [
              ${orderData.lineItems.map((item: any, index: number) => `
                {
                  sku: "${item.sku}"
                  partner_line_item_id: "${Date.now()}-${index}"
                  quantity: ${item.quantity}
                  price: "${item.price || '0.00'}"
                  product_name: "${item.productName}"
                  fulfillment_status: "pending"
                  quantity_pending_fulfillment: ${item.quantity}
                }
              `).join(',')}
            ]
          }
        ) {
          request_id
          complexity
          order {
            id
            legacy_id
            order_number
            fulfillment_status
            account_id
            email
          }
        }
      }
    `;

    console.log('GraphQL Mutation:', mutation)

    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation
      } )
    })

    const responseText = await response.text()
    console.log('ShipHero Response Status:', response.status)
    console.log('ShipHero Response Body:', responseText)

    if (!response.ok) {
      throw new Error(`ShipHero API error: ${response.status} ${response.statusText}`)
    }

    const data = JSON.parse(responseText)

    if (data.errors) {
      console.error('GraphQL Errors:', data.errors)
      return NextResponse.json({ 
        error: 'ShipHero GraphQL error',
        details: data.errors
      }, { status: 400 })
    }

    return NextResponse.json(data)

  } catch (error) {
    console.error('Create order API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: (error as Error).message
    }, { status: 500 })
  }
}
