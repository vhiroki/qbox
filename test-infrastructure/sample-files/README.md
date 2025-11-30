# Sample Data Files for QBox Testing

This directory contains sample CSV and Excel files that complement the test database schemas for testing QBox file upload and query features.

## CSV Files

### 1. product_suppliers.csv
Supplier information that can be joined with the `inventory.products` table (PostgreSQL DB 1).

**Columns:**
- `supplier_id`, `supplier_name`, `contact_email`, `phone`, `country`, `rating`, `products_supplied`

**Sample Query:**
```sql
SELECT
    p.product_name,
    s.supplier_name,
    s.country,
    s.rating,
    p.stock_quantity
FROM inventory.products p
JOIN product_suppliers s ON p.supplier = s.supplier_name
ORDER BY s.rating DESC;
```

### 2. customer_segments.csv
Customer segmentation data that can be joined with `sales.customers` (PostgreSQL DB 1).

**Columns:**
- `segment_id`, `segment_name`, `min_purchase`, `max_purchase`, `discount_rate`, `customer_count`, `avg_lifetime_value`

**Sample Query:**
```sql
SELECT
    c.first_name || ' ' || c.last_name as customer_name,
    SUM(o.total_amount) as total_spent,
    s.segment_name,
    s.discount_rate
FROM sales.customers c
JOIN sales.orders o ON c.customer_id = o.customer_id
JOIN customer_segments s ON SUM(o.total_amount) BETWEEN s.min_purchase AND s.max_purchase
GROUP BY c.customer_id, c.first_name, c.last_name, s.segment_name, s.discount_rate;
```

### 3. sales_targets.csv
Monthly sales targets that can be compared with actual sales data.

**Columns:**
- `month`, `year`, `region`, `target_revenue`, `target_orders`, `achieved_revenue`, `achieved_orders`, `performance_pct`

**Sample Query:**
```sql
-- Compare targets vs actuals
SELECT
    month,
    region,
    target_revenue,
    achieved_revenue,
    achieved_revenue - target_revenue as variance,
    performance_pct
FROM sales_targets
WHERE year = 2024
ORDER BY performance_pct DESC;
```

### 4. employee_salaries.csv
Detailed compensation breakdown that extends `hr.employees` (PostgreSQL DB 2).

**Columns:**
- `employee_id`, `base_salary`, `bonus`, `commission`, `total_compensation`, `year`, `performance_rating`

**Sample Query:**
```sql
SELECT
    e.first_name || ' ' || e.last_name as employee_name,
    e.job_title,
    e.department,
    s.base_salary,
    s.bonus,
    s.total_compensation,
    s.performance_rating
FROM hr.employees e
JOIN employee_salaries s ON e.employee_id = s.employee_id
WHERE s.year = 2024
ORDER BY s.total_compensation DESC;
```

### 5. marketing_campaigns.csv
Marketing campaign performance data.

**Columns:**
- `campaign_id`, `campaign_name`, `start_date`, `end_date`, `budget`, `spent`, `leads_generated`, `conversions`, `roi_pct`

**Sample Query:**
```sql
SELECT
    campaign_name,
    budget,
    spent,
    leads_generated,
    conversions,
    ROUND(conversions::decimal / leads_generated * 100, 2) as conversion_rate,
    roi_pct
FROM marketing_campaigns
WHERE roi_pct > 200
ORDER BY roi_pct DESC;
```

## Excel Files

### 1. warehouse_inventory.xlsx
**Sheet:** Inventory

Detailed inventory levels across warehouses. Can be joined with `inventory.warehouses` and `inventory.products`.

**Columns:**
- `warehouse_id`, `product_id`, `product_name`, `stock_level`, `reorder_point`, `last_restock`, `status`

**Sample Query:**
```sql
SELECT
    w.name as warehouse_name,
    w.location,
    i.product_name,
    i.stock_level,
    i.reorder_point,
    i.status
FROM warehouse_inventory i
JOIN inventory.warehouses w ON i.warehouse_id = w.warehouse_id
WHERE i.status = 'Low'
ORDER BY w.name;
```

### 2. employee_performance.xlsx
**Sheet:** Performance

Quarterly employee performance metrics. Extends `hr.employees` data.

**Columns:**
- `employee_id`, `quarter`, `year`, `sales_target`, `sales_achieved`, `customer_satisfaction`, `projects_completed`, `rating`

**Sample Query:**
```sql
SELECT
    e.first_name || ' ' || e.last_name as employee_name,
    e.department,
    p.quarter,
    p.sales_achieved,
    p.customer_satisfaction,
    p.rating
FROM employee_performance p
JOIN hr.employees e ON p.employee_id = e.employee_id
WHERE p.rating = 'Exceeds'
ORDER BY p.sales_achieved DESC;
```

### 3. product_categories.xlsx
**Sheets:** Categories, Subcategories

Product taxonomy with multiple sheets demonstrating multi-sheet Excel support.

**Categories Columns:**
- `category_id`, `category_name`, `description`, `margin_pct`, `monthly_volume`

**Subcategories Columns:**
- `subcategory_id`, `category_id`, `subcategory_name`, `product_count`

**Sample Query:**
```sql
-- Join both sheets
SELECT
    c.category_name,
    s.subcategory_name,
    s.product_count,
    c.margin_pct
FROM product_categories_subcategories s
JOIN product_categories_categories c ON s.category_id = c.category_id
ORDER BY c.category_name, s.subcategory_name;
```

## Multi-Source Query Examples

### Cross-Database Join (PostgreSQL DB1 + CSV)
```sql
-- Orders with supplier information
SELECT
    o.order_id,
    oi.product_name,
    p.supplier,
    s.country as supplier_country,
    s.rating as supplier_rating,
    oi.quantity,
    oi.subtotal
FROM sales.orders o
JOIN sales.order_items oi ON o.order_id = oi.order_id
JOIN inventory.products p ON oi.product_name = p.product_name
JOIN product_suppliers s ON p.supplier = s.supplier_name
WHERE s.rating > 4.5
ORDER BY o.order_date DESC;
```

### Cross-Database Join (PostgreSQL DB1 + PostgreSQL DB2 + Excel)
```sql
-- Sales performance with employee data and compensation
SELECT
    e.first_name || ' ' || e.last_name as employee_name,
    p.sales_achieved,
    p.customer_satisfaction,
    s.total_compensation,
    s.performance_rating
FROM employee_performance p
JOIN hr.employees e ON p.employee_id = e.employee_id
JOIN employee_salaries s ON e.employee_id = s.employee_id
WHERE p.year = 2024
  AND p.rating = 'Exceeds'
ORDER BY s.total_compensation DESC;
```

### Triple Join (DB + CSV + Excel)
```sql
-- Complete inventory analysis with warehouse and supplier data
SELECT
    w.name as warehouse_name,
    i.product_name,
    i.stock_level,
    p.supplier,
    s.country as supplier_country,
    s.rating as supplier_rating
FROM warehouse_inventory i
JOIN inventory.warehouses w ON i.warehouse_id = w.warehouse_id
JOIN inventory.products p ON i.product_name = p.product_name
JOIN product_suppliers s ON p.supplier = s.supplier_name
WHERE i.status = 'Low'
ORDER BY s.rating DESC, i.stock_level ASC;
```

## Usage in QBox

1. **Upload CSV Files:**
   - Go to Data Sources → Files
   - Upload any CSV file from this directory
   - Files will be automatically registered and available for queries

2. **Upload Excel Files:**
   - Go to Data Sources → Files
   - Upload any XLSX file from this directory
   - Each sheet becomes a separate table

3. **Create Queries:**
   - Use the sample queries above in QBox
   - Combine data from PostgreSQL, CSV, and Excel files
   - Test multi-source joins and analytics

## Regenerating Excel Files

If you need to modify the Excel files:

```bash
cd test-infrastructure/sample-files
# Edit generate_excel.py
python3 generate_excel.py
```
