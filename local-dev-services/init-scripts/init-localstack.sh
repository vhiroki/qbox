#!/bin/bash

# QBox LocalStack S3 Initialization Script
# Creates test S3 buckets and uploads sample data

set -e

echo "Initializing LocalStack S3 for QBox testing..."

# Wait for LocalStack to be fully ready
sleep 5

# Create test buckets
awslocal s3 mb s3://qbox-test-data
awslocal s3 mb s3://qbox-sales-reports
awslocal s3 mb s3://qbox-analytics

# Create sample CSV files
cat > /tmp/customers.csv << 'EOF'
customer_id,name,email,city,country,lifetime_value
1,John Smith,john.smith@example.com,New York,USA,2500.00
2,Emma Wilson,emma.wilson@example.com,London,UK,3200.00
3,Michael Chen,michael.chen@example.com,Singapore,Singapore,4100.00
4,Sophie Martin,sophie.martin@example.com,Paris,France,1800.00
5,Ahmed Hassan,ahmed.hassan@example.com,Dubai,UAE,5500.00
EOF

cat > /tmp/transactions.csv << 'EOF'
transaction_id,customer_id,transaction_date,amount,product_category,status
T001,1,2024-01-15,299.99,Electronics,completed
T002,2,2024-01-16,149.50,Clothing,completed
T003,1,2024-01-18,450.00,Electronics,completed
T004,3,2024-01-20,89.99,Books,completed
T005,4,2024-01-22,199.99,Home,processing
T006,5,2024-01-23,750.00,Electronics,shipped
T007,2,2024-01-25,320.00,Clothing,completed
EOF

cat > /tmp/monthly_summary.csv << 'EOF'
month,region,revenue,orders,avg_order_value,customer_count
2024-01,North America,450000.00,1250,360.00,450
2024-01,Europe,320000.00,890,359.55,320
2024-01,Asia Pacific,580000.00,1450,400.00,520
2024-02,North America,475000.00,1300,365.38,465
2024-02,Europe,340000.00,920,369.57,335
2024-02,Asia Pacific,610000.00,1500,406.67,540
EOF

# Upload files to buckets
awslocal s3 cp /tmp/customers.csv s3://qbox-test-data/customers.csv
awslocal s3 cp /tmp/transactions.csv s3://qbox-test-data/transactions.csv
awslocal s3 cp /tmp/monthly_summary.csv s3://qbox-sales-reports/2024/monthly_summary.csv

# Create additional test files in different folders
awslocal s3 cp /tmp/customers.csv s3://qbox-analytics/raw/customers.csv
awslocal s3 cp /tmp/transactions.csv s3://qbox-analytics/raw/transactions.csv

# List buckets and files
echo "Created buckets:"
awslocal s3 ls

echo ""
echo "Files in qbox-test-data:"
awslocal s3 ls s3://qbox-test-data/ --recursive

echo ""
echo "Files in qbox-sales-reports:"
awslocal s3 ls s3://qbox-sales-reports/ --recursive

echo ""
echo "Files in qbox-analytics:"
awslocal s3 ls s3://qbox-analytics/ --recursive

echo ""
echo "LocalStack S3 initialization complete!"
echo "S3 endpoint: http://localhost:4566"
echo "Access Key: test"
echo "Secret Key: test"
echo "Region: us-east-1"
