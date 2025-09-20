# ShipHero API Queries for Product Locations

Based on my research of the ShipHero GraphQL API documentation and community discussions, here are the queries you need to retrieve product location information by customer account ID.

## Authentication

First, you'll need to authenticate and get an access token:

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "refresh_token": "YOUR_REFRESH_TOKEN"
}' "https://public-api.shiphero.com/auth/refresh"
```

## Main Query: Get Product Locations by Customer Account ID

This query retrieves all products for a specific customer account with their bin locations, quantities, and location properties:

```graphql
query GetProductLocationsByAccount($customer_account_id: String!, $first: Int = 100) {
  warehouse_products(customer_account_id: $customer_account_id) {
    request_id
    complexity
    data(first: $first) {
      edges {
        node {
          id
          account_id
          on_hand
          inventory_bin
          reserve_inventory
          reorder_amount
          reorder_level
          custom
          warehouse {
            id
            profile
            dynamic_slotting
          }
          product {
            id
            name
            sku
            barcode
          }
          locations(first: 50) {
            edges {
              node {
                id
                name
                quantity
                pickable
                sellable
                warehouse_id
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
```

### Variables:
```json
{
  "customer_account_id": "YOUR_CUSTOMER_ACCOUNT_ID",
  "first": 100
}
```

## Alternative Query: Get Specific SKU Locations

If you want to query for a specific SKU:

```graphql
query GetSKULocations($sku: String!, $customer_account_id: String!) {
  warehouse_products(sku: $sku, customer_account_id: $customer_account_id) {
    request_id
    complexity
    data(first: 10) {
      edges {
        node {
          id
          on_hand
          inventory_bin
          product {
            sku
            name
          }
          warehouse {
            id
          }
          locations(first: 20) {
            edges {
              node {
                id
                name
                quantity
                pickable
                sellable
              }
            }
          }
        }
      }
    }
  }
}
```

## Query for Location Details with Filters

To get locations with specific sellable/pickable status:

```graphql
query GetLocationsByStatus($warehouse_id: String, $pickable: Boolean, $sellable: Boolean) {
  locations(warehouse_id: $warehouse_id, pickable: $pickable, sellable: $sellable) {
    request_id
    complexity
    data(first: 100) {
      edges {
        node {
          id
          name
          pickable
          sellable
          warehouse_id
          # Note: To get inventory quantities, you'll need to cross-reference with warehouse_products
        }
      }
    }
  }
}
```

## Expected Response Format

The response will contain data in this structure:

```json
{
  "data": {
    "warehouse_products": {
      "request_id": "unique_request_id",
      "complexity": 25,
      "data": {
        "edges": [
          {
            "node": {
              "id": "encoded_product_id",
              "account_id": "customer_account_id",
              "on_hand": 50,
              "inventory_bin": "A1-B2-C3",
              "product": {
                "sku": "PRODUCT-SKU-123",
                "name": "Product Name"
              },
              "locations": {
                "edges": [
                  {
                    "node": {
                      "id": "location_id",
                      "name": "A1-B2-C3",
                      "quantity": 25,
                      "pickable": true,
                      "sellable": true
                    }
                  }
                ]
              }
            }
          }
        ]
      }
    }
  }
}
```

## Data Fields Explanation

| Field | Description |
|-------|-------------|
| `sku` | Product SKU identifier |
| `product.name` | Product name |
| `inventory_bin` | Primary bin location (may be null for dynamic slotting) |
| `locations[].name` | Specific bin location name |
| `locations[].quantity` | Quantity in that specific bin |
| `locations[].sellable` | Whether the bin is available for sales |
| `locations[].pickable` | Whether the bin is available for picking |
| `on_hand` | Total quantity on hand across all locations |

## API Endpoint

All queries should be sent to: `https://public-api.shiphero.com/graphql`

## Headers Required

```
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

## Notes

1. **Pagination**: Use the `first` parameter and `pageInfo.hasNextPage` to handle large datasets
2. **Complexity**: Each query has a complexity score that affects your API quota
3. **Dynamic Slotting**: For warehouses using dynamic slotting, `inventory_bin` may be null, and you'll need to rely on the `locations` array
4. **Customer Account ID**: This is required for 3PL users to specify which customer's data to retrieve

This should give you all the data you need for your dashboard application!
