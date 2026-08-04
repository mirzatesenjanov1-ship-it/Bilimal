-- Bilimal Attendance Management Engine Schema
-- Database: PostgreSQL / MySQL Compatible

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'CURATOR', 'TEACHER', 'STUDENT')),
    assigned_class VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(36) PRIMARY KEY,
    student_id_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    student_class VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    parent_email VARCHAR(255) NOT NULL,
    qr_token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    check_in_start TIME NOT NULL DEFAULT '07:30:00',
    check_in_on_time TIME NOT NULL DEFAULT '08:15:00',
    check_in_late TIME NOT NULL DEFAULT '09:00:00',
    check_out_min TIME NOT NULL DEFAULT '13:00:00',
    check_out_regular TIME NOT NULL DEFAULT '14:00:00'
);

CREATE TABLE IF NOT EXISTS attendance_logs (
    id VARCHAR(36) PRIMARY KEY,
    student_id VARCHAR(36) NOT NULL,
    student_class VARCHAR(50) NOT NULL,
    log_date DATE NOT NULL,
    check_in_time TIME DEFAULT NULL,
    check_out_time TIME DEFAULT NULL,
    status VARCHAR(30) NOT NULL CHECK (status IN ('PRESENT', 'LATE', 'EARLY_LEAVE', 'INCOMPLETE', 'ABSENT')),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(student_id, log_date)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR MAXIMUM QUERY SPEED & RBAC LOOKUPS
CREATE INDEX idx_students_class ON students(student_class);
CREATE INDEX idx_attendance_date_class ON attendance_logs(log_date, student_class);
CREATE INDEX idx_attendance_student_date ON attendance_logs(student_id, log_date);
