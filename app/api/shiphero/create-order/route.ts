import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    console.log('ShipHero create order API route called (POST)')
    
    const requestBody = await request.json()
    const { accessToken, orderData } = requestBody
    
    console.log('Access token received:', accessToken ? 'Present' : 'Missing')
    console.log('Order data received:', !!orderData)
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 401 })
    }

    if (!orderData) {
      return NextResponse.json({ error: 'Order data is required' }, { status: 400 })
    }

    const mutation = `
      mutation CreateOrder($data: CreateOrderInput!) {
        order_create(data: $data) {
          request_id
          complexity
          order {
            id
            legacy_id
            order_number
            fulfillment_status
            account_id
            line_items {
              edges {
                node {
                  id
                  sku
                  quantity
                  product_name
                }
              }
            }
          }
          user_errors {
            field
            message
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
        subtotal: orderData.subtotal.toString(),
        total_price: orderData.totalPrice.toString(),
        currency: "USD",
        email: orderData.customerEmail,
        ...(orderData.customerAccountId && { 
          account_id: orderData.customerAccountId // 3PL client account ID
        }),
        shipping_lines: {
          title: "Standard Shipping",
          price: "0.00",
          carrier: "USPS",
          method: "Ground"
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
        billing_address: {
          first_name: orderData.shippingAddress.firstName,
          last_name: orderData.shippingAddress.lastName,
          address1: orderData.shippingAddress.address1,
          address2: orderData.shippingAddress.address2,
          city: orderData.shippingAddress.city,
          state: orderData.shippingAddress.state,
          zip: orderData.shippingAddress.zip,
          country: orderData.shippingAddress.country,
        },
        line_items: orderData.lineItems.map((item: any, index: number) => ({
          sku: item.sku,
          quantity: item.quantity,
          price: item.price.toString(),
          product_name: item.productName || `Product ${item.sku}`,
          fulfillment_status: "pending",
          partner_line_item_id: `${item.sku}-${index}-${Date.now()}`, // Required unique identifier
        })),
      },
    };

    console.log('[CREATE ORDER API] Order creation variables:', JSON.stringify(variables, null, 2))

    const response = await fetch('https://public-api.shiphero.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: mutation, variables }),
    });

    console.log('[CREATE ORDER API] ShipHero response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.log('[CREATE ORDER API] ShipHero error response:', errorText)
      return NextResponse.json(
        { error: `ShipHero API error: ${response.status} ${response.statusText}`, details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    console.log('[CREATE ORDER API] ShipHero response:', data)

    if (data.errors && data.errors.length > 0) {
      console.log('[CREATE ORDER API] GraphQL errors found:', data.errors)
      return NextResponse.json(
        { error: 'GraphQL errors in response', details: data.errors },
        { status: 400 }
      )
    }

    // Check for user_errors in the response
    if (data.data?.order_create?.user_errors && data.data.order_create.user_errors.length > 0) {
      console.log('[CREATE ORDER API] User errors found:', data.data.order_create.user_errors)
      return NextResponse.json(
        { error: 'Order creation failed', details: data.data.order_create.user_errors },
        { status: 400 }
      )
    }

    const orderId = data.data.order_create.order.id
    const accountId = data.data.order_create.order.account_id
    console.log('[CREATE ORDER API] Created order with ID:', orderId)
    console.log('[CREATE ORDER API] Order created for account:', accountId)

    return NextResponse.json({
      success: true,
      orderId,
      orderNumber: data.data.order_create.order.order_number,
      accountId: accountId,
      data: data.data
    })

  } catch (error: any) {
    console.error('ShipHero create order API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
