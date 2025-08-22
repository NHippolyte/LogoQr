-- Fichier : db.sql

CREATE TABLE profils (
    id INT AUTO_INCREMENT PRIMARY KEY,
    logo_path VARCHAR(255) NOT NULL,
    qr_path VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);