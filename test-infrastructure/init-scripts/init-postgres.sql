-- QBox Test PostgreSQL Database 1
-- Sample data for testing connections and queries

-- Create schemas
CREATE SCHEMA IF NOT EXISTS sales;
CREATE SCHEMA IF NOT EXISTS inventory;

-- Sales schema tables
CREATE TABLE sales.customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    city VARCHAR(100),
    state VARCHAR(50),
    country VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sales.orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES sales.customers(customer_id),
    order_date DATE NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sales.order_items (
    item_id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES sales.orders(order_id),
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL
);

-- Inventory schema tables
CREATE TABLE inventory.products (
    product_id SERIAL PRIMARY KEY,
    product_name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INTEGER NOT NULL,
    supplier VARCHAR(255),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory.warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    capacity INTEGER,
    manager_name VARCHAR(100)
);

-- Insert sample data
INSERT INTO sales.customers (first_name, last_name, email, phone, city, state, country) VALUES
    ('John', 'Doe', 'john.doe@example.com', '555-0101', 'New York', 'NY', 'USA'),
    ('Jane', 'Smith', 'jane.smith@example.com', '555-0102', 'Los Angeles', 'CA', 'USA'),
    ('Bob', 'Johnson', 'bob.johnson@example.com', '555-0103', 'Chicago', 'IL', 'USA'),
    ('Alice', 'Williams', 'alice.williams@example.com', '555-0104', 'Houston', 'TX', 'USA'),
    ('Charlie', 'Brown', 'charlie.brown@example.com', '555-0105', 'Phoenix', 'AZ', 'USA');

INSERT INTO sales.orders (customer_id, order_date, total_amount, status) VALUES
    (1, '2024-01-15', 299.99, 'completed'),
    (2, '2024-01-16', 149.50, 'completed'),
    (1, '2024-01-20', 450.00, 'shipped'),
    (3, '2024-01-22', 89.99, 'processing'),
    (4, '2024-01-25', 199.99, 'completed');

INSERT INTO sales.order_items (order_id, product_name, quantity, unit_price, subtotal) VALUES
    (1, 'Laptop Stand', 2, 49.99, 99.98),
    (1, 'Wireless Mouse', 1, 29.99, 29.99),
    (1, 'USB-C Cable', 3, 15.00, 45.00),
    (2, 'Keyboard', 1, 149.50, 149.50),
    (3, 'Monitor', 1, 450.00, 450.00),
    (4, 'Webcam', 1, 89.99, 89.99),
    (5, 'Headphones', 1, 199.99, 199.99);

INSERT INTO inventory.products (product_name, category, price, stock_quantity, supplier) VALUES
    ('Laptop Stand', 'Accessories', 49.99, 150, 'Tech Supplies Inc'),
    ('Wireless Mouse', 'Peripherals', 29.99, 300, 'Mouse World'),
    ('USB-C Cable', 'Cables', 15.00, 500, 'Cable Co'),
    ('Keyboard', 'Peripherals', 149.50, 100, 'Keyboard Masters'),
    ('Monitor', 'Displays', 450.00, 50, 'Screen Solutions'),
    ('Webcam', 'Video', 89.99, 75, 'Cam Tech'),
    ('Headphones', 'Audio', 199.99, 120, 'Sound Systems');

INSERT INTO inventory.warehouses (name, location, capacity, manager_name) VALUES
    ('Main Warehouse', 'New York, NY', 10000, 'Michael Scott'),
    ('West Coast Hub', 'Los Angeles, CA', 8000, 'Dwight Schrute'),
    ('Central Distribution', 'Chicago, IL', 12000, 'Jim Halpert');
