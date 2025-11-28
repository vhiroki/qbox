# QBox Test Infrastructure

This directory contains Docker Compose configuration to simulate data sources for testing QBox connections.

## Purpose

Provides local test environments for:
- **PostgreSQL databases** (2 instances with sample data)
- **S3 buckets** (via LocalStack with sample CSV files)
- **Sample CSV and Excel files** (for file upload testing)

Use this infrastructure to test QBox connection management, query building, and multi-source queries without needing production databases or AWS accounts.

## What's Included

- **Docker Services**: PostgreSQL (x2) + LocalStack S3
- **Sample Files**: [sample-files/](sample-files/) directory with 5 CSV files and 3 Excel files
- **Init Scripts**: Automatic database population and S3 bucket creation
- **Full Documentation**: Complete setup and query examples

## Services

### PostgreSQL Database 1 (Port 5432)
- **Container**: `qbox-test-postgres`
- **Credentials**: `testuser` / `testpass`
- **Database**: `testdb`
- **Schemas**: `sales`, `inventory`
- **Sample Data**: Customers, orders, products, warehouses

### PostgreSQL Database 2 (Port 5433)
- **Container**: `qbox-test-postgres2`
- **Credentials**: `testuser2` / `testpass2`
- **Database**: `testdb2`
- **Schemas**: `hr`, `analytics`
- **Sample Data**: Employees, departments, attendance, sales metrics

### LocalStack S3 (Port 4566)
- **Container**: `qbox-test-localstack`
- **Endpoint**: `http://localhost:4566`
- **Access Key**: `test`
- **Secret Key**: `test`
- **Region**: `us-east-1`
- **Buckets**:
  - `qbox-test-data`: Sample customer and transaction CSV files
  - `qbox-sales-reports`: Monthly sales summary reports
  - `qbox-analytics`: Raw analytics data files

## Quick Start

### Start All Services
```bash
cd test-infrastructure
docker compose up -d
```

### Check Status
```bash
docker compose ps
```

### View Logs
```bash
docker compose logs -f
```

### Stop All Services
```bash
docker compose down
```

### Stop and Remove Data
```bash
docker compose down -v
```

## Testing Connections in QBox

### PostgreSQL Connection 1
1. Open QBox
2. Add new PostgreSQL connection
3. Use these settings:
   - **Host**: `localhost`
   - **Port**: `5432`
   - **Database**: `testdb`
   - **Username**: `testuser`
   - **Password**: `testpass`
   - **Alias**: `sales_db` (or any name you prefer)

### PostgreSQL Connection 2
1. Add another PostgreSQL connection
2. Use these settings:
   - **Host**: `localhost`
   - **Port**: `5433`
   - **Database**: `testdb2`
   - **Username**: `testuser2`
   - **Password**: `testpass2`
   - **Alias**: `hr_db` (or any name you prefer)

### S3 Connection
1. Add S3 connection in QBox
2. Use these settings:
   - **Endpoint**: `http://localhost:4566`
   - **Access Key**: `test`
   - **Secret Key**: `test`
   - **Region**: `us-east-1`
   - **Bucket**: `qbox-test-data` (or any of the created buckets)

## Sample Queries to Test

### Single Source Query (PostgreSQL 1)
```sql
SELECT
    c.first_name,
    c.last_name,
    COUNT(o.order_id) as total_orders,
    SUM(o.total_amount) as total_spent
FROM sales.customers c
LEFT JOIN sales.orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.first_name, c.last_name
ORDER BY total_spent DESC;
```

### Multi-Source Query (Both PostgreSQL Databases)
```sql
-- Join sales data with employee data
SELECT
    o.order_id,
    o.total_amount,
    e.first_name || ' ' || e.last_name as employee_name,
    e.department
FROM pg_db1.sales.orders o
CROSS JOIN pg_db2.hr.employees e
WHERE e.department = 'Sales'
LIMIT 10;
```

### S3 + PostgreSQL Query
```sql
-- Join S3 customer data with PostgreSQL order data
SELECT
    s3.name,
    s3.email,
    COUNT(o.order_id) as order_count
FROM 's3://qbox-test-data/customers.csv' s3
LEFT JOIN sales.orders o ON s3.customer_id = o.customer_id
GROUP BY s3.name, s3.email;
```

## Troubleshooting

### Services not starting
```bash
# Check logs for specific service
docker compose logs postgres
docker compose logs localstack

# Restart services
docker compose restart
```

### Port already in use
If ports 5432, 5433, or 4566 are already in use, either:
1. Stop the conflicting service
2. Edit `docker-compose.yml` to use different ports

### PostgreSQL connection refused
Wait for health check to pass:
```bash
docker compose ps
# Look for "healthy" status
```

### LocalStack S3 not ready
LocalStack takes ~10 seconds to initialize. Check logs:
```bash
docker compose logs localstack | grep "initialization complete"
```

## Data Persistence

Data is stored in Docker volumes:
- `postgres_data`: PostgreSQL 1 data
- `postgres2_data`: PostgreSQL 2 data
- `localstack_data`: LocalStack S3 data

To reset all data:
```bash
docker compose down -v
docker compose up -d
```

## Sample Files

The [sample-files/](sample-files/) directory contains ready-to-use CSV and Excel files for testing QBox file upload and multi-source queries:

**CSV Files (5):**
- `product_suppliers.csv` - Supplier data (joins with inventory.products)
- `customer_segments.csv` - Customer segmentation (joins with sales.customers)
- `sales_targets.csv` - Monthly sales targets and actuals
- `employee_salaries.csv` - Detailed compensation (joins with hr.employees)
- `marketing_campaigns.csv` - Campaign performance metrics

**Excel Files (3):**
- `warehouse_inventory.xlsx` - Inventory levels by warehouse
- `employee_performance.xlsx` - Quarterly performance metrics
- `product_categories.xlsx` - Product taxonomy (multi-sheet)

See [sample-files/README.md](sample-files/README.md) for detailed schemas and sample queries.

## Development Notes

- Init scripts run only on first container creation
- To modify sample data, edit files in `init-scripts/` and recreate containers
- LocalStack S3 endpoint must be `http://localhost:4566` (not `127.0.0.1`)
- All services have health checks for reliable startup
- Sample files can be uploaded directly to QBox for testing
