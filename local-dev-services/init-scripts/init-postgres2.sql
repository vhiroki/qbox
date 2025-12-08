-- QBox Test PostgreSQL Database 2
-- Sample data for testing multi-connection queries

-- Create schemas
CREATE SCHEMA IF NOT EXISTS hr;
CREATE SCHEMA IF NOT EXISTS analytics;

-- HR schema tables
CREATE TABLE hr.employees (
    employee_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    department VARCHAR(100),
    job_title VARCHAR(100),
    salary DECIMAL(10, 2),
    hire_date DATE NOT NULL,
    manager_id INTEGER REFERENCES hr.employees(employee_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE hr.departments (
    department_id SERIAL PRIMARY KEY,
    department_name VARCHAR(100) UNIQUE NOT NULL,
    location VARCHAR(255),
    budget DECIMAL(12, 2),
    head_employee_id INTEGER
);

CREATE TABLE hr.attendance (
    attendance_id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES hr.employees(employee_id),
    check_in TIMESTAMP NOT NULL,
    check_out TIMESTAMP,
    hours_worked DECIMAL(5, 2),
    attendance_date DATE NOT NULL
);

-- Analytics schema tables
CREATE TABLE analytics.sales_metrics (
    metric_id SERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    region VARCHAR(100),
    total_revenue DECIMAL(12, 2),
    total_orders INTEGER,
    average_order_value DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE analytics.customer_segments (
    segment_id SERIAL PRIMARY KEY,
    segment_name VARCHAR(100) NOT NULL,
    min_lifetime_value DECIMAL(10, 2),
    max_lifetime_value DECIMAL(10, 2),
    customer_count INTEGER,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO hr.employees (first_name, last_name, email, department, job_title, salary, hire_date, manager_id) VALUES
    ('Sarah', 'Connor', 'sarah.connor@company.com', 'Engineering', 'VP of Engineering', 180000, '2020-01-15', NULL),
    ('Kyle', 'Reese', 'kyle.reese@company.com', 'Engineering', 'Senior Engineer', 140000, '2021-03-20', 1),
    ('Ellen', 'Ripley', 'ellen.ripley@company.com', 'Engineering', 'Staff Engineer', 160000, '2020-06-10', 1),
    ('Rick', 'Deckard', 'rick.deckard@company.com', 'Sales', 'Sales Director', 150000, '2019-09-01', NULL),
    ('Rachel', 'Tyrell', 'rachel.tyrell@company.com', 'Sales', 'Account Executive', 120000, '2021-01-15', 4),
    ('Neo', 'Anderson', 'neo.anderson@company.com', 'IT', 'IT Manager', 130000, '2020-11-01', NULL),
    ('Trinity', 'Matrix', 'trinity.matrix@company.com', 'IT', 'Systems Administrator', 110000, '2021-05-20', 6);

INSERT INTO hr.departments (department_name, location, budget, head_employee_id) VALUES
    ('Engineering', 'San Francisco, CA', 5000000, 1),
    ('Sales', 'New York, NY', 3000000, 4),
    ('IT', 'Austin, TX', 2000000, 6),
    ('Marketing', 'Los Angeles, CA', 2500000, NULL),
    ('Operations', 'Chicago, IL', 1800000, NULL);

INSERT INTO hr.attendance (employee_id, check_in, check_out, hours_worked, attendance_date) VALUES
    (1, '2024-01-15 09:00:00', '2024-01-15 17:30:00', 8.5, '2024-01-15'),
    (2, '2024-01-15 08:45:00', '2024-01-15 17:15:00', 8.5, '2024-01-15'),
    (3, '2024-01-15 09:15:00', '2024-01-15 18:00:00', 8.75, '2024-01-15'),
    (4, '2024-01-15 08:30:00', '2024-01-15 17:00:00', 8.5, '2024-01-15'),
    (5, '2024-01-15 09:00:00', '2024-01-15 17:30:00', 8.5, '2024-01-15'),
    (6, '2024-01-15 08:00:00', '2024-01-15 16:30:00', 8.5, '2024-01-15'),
    (7, '2024-01-15 09:00:00', '2024-01-15 17:00:00', 8.0, '2024-01-15');

INSERT INTO analytics.sales_metrics (metric_date, region, total_revenue, total_orders, average_order_value) VALUES
    ('2024-01-01', 'North America', 125000.00, 450, 277.78),
    ('2024-01-01', 'Europe', 98000.00, 320, 306.25),
    ('2024-01-01', 'Asia Pacific', 156000.00, 580, 268.97),
    ('2024-01-02', 'North America', 142000.00, 510, 278.43),
    ('2024-01-02', 'Europe', 103000.00, 340, 302.94),
    ('2024-01-02', 'Asia Pacific', 168000.00, 620, 270.97);

INSERT INTO analytics.customer_segments (segment_name, min_lifetime_value, max_lifetime_value, customer_count) VALUES
    ('Bronze', 0, 500, 1200),
    ('Silver', 500, 2000, 850),
    ('Gold', 2000, 5000, 320),
    ('Platinum', 5000, NULL, 95);
