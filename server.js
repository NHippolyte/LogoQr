// Fichier : server.js

const express = require('express');
const mysql = require('mysql');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3007;

// Configuration de la connexion à la base de données
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'Logo_Qr',
    port: 3307 // Assurez-vous que ce port est correct pour votre installation MariaDB
});

db.connect(err => {
    if (err) {
        console.error('Erreur de connexion à la base de données:', err);
        return;
    }
    console.log('Connecté à la base de données MySQL.');
});

// Assure que les dossiers d'upload existent
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Middleware pour servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuration de Multer pour l'upload de fichiers
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Type de fichier non supporté. Seules les images sont autorisées.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 5 }, // 5 Mo
    fileFilter: fileFilter
});

// Route pour l'upload du formulaire
app.post('/upload', (req, res, next) => {
    upload.fields([{ name: 'logo' }, { name: 'qr' }])(req, res, (err) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
}, (req, res) => {
    if (!req.files || !req.files.logo || !req.files.qr) {
        return res.status(400).json({ success: false, message: 'Veuillez téléverser un logo et un code QR.' });
    }

    const logoPath = req.files.logo[0].filename;
    const qrPath = req.files.qr[0].filename;
    const contactType = req.body.contact_type || null;
    const contactValue = req.body.contact_value || null;

    const sql = 'INSERT INTO profils (logo_path, qr_path, contact_type, contact_value) VALUES (?, ?, ?, ?)';
    db.query(sql, [logoPath, qrPath, contactType, contactValue], (err, result) => {
        if (err) {
            console.error('Erreur lors de l\'insertion:', err);
            return res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'enregistrement.' });
        }
        res.status(200).json({ success: true, redirectUrl: '/confirmation' });
    });
});

// Nouvelle route pour la page de confirmation de commande
app.get('/confirmation', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirmation de commande</title>
            <link rel="stylesheet" href="/style.css">
        </head>
        <body>
            <div class="container">
                <img src="./images/LogFinal.png.PNG" alt="Logo de l'entreprise" class="main-logo">
                <h1>Merci pour votre commande !</h1>
                <p>Votre commande a bien été prise en charge. Nous vous reviendrons vers vous via l'adresse communiqué.</p>
                <a href="/" class="view-link">Retour à l'accueil</a>
            </div>
        </body>
        </html>
    `);
});

// Route pour afficher la page de profil individuelle
app.get('/profil/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM profils WHERE id = ?';
    db.query(sql, [id], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).send('Profil non trouvé.');
        }

        const profil = results[0];
        let contactHtml = '';
        if (profil.contact_type && profil.contact_value) {
            const prefix = {
                instagram: `https://instagram.com/`,
                snapchat: `https://www.snapchat.com/add/`,
                phone: `tel:`,
                email: `mailto:`,
                link: profil.contact_value.startsWith('http') ? '' : 'https://'
            }[profil.contact_type] || '';
            
            contactHtml = `
                <div class="contact-info">
                    <p><strong>Contact via ${profil.contact_type}:</strong> ${profil.contact_value}</p>
                    <a href="${prefix}${profil.contact_value}" class="contact-link" target="_blank">Contacter</a>
                </div>
            `;
        }

        res.send(`
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Profil de l'utilisateur</title>
                <link rel="stylesheet" href="/style.css">
            </head>
            <body>
                <div class="container">
                    <img src="/uploads/${profil.logo_path}" alt="Logo" class="profile-logo">
                    <img src="/uploads/${profil.qr_path}" alt="Code QR" class="profile-qr">
                    ${contactHtml}
                </div>
            </body>
            </html>
        `);
    });
});

// Route pour la page administrateur (récupérer toutes les commandes)
app.get('/admin', (req, res) => {
    const sql = 'SELECT * FROM profils ORDER BY created_at DESC';
    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).send('Erreur serveur.');
        }

        let htmlContent = `
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Interface Administrateur</title>
                <link rel="stylesheet" href="/style.css">
            </head>
            <body>
                <div class="container">
                    <h1>Commandes en attente</h1>
                    <ul class="admin-list">
        `;

        results.forEach(profil => {
            htmlContent += `
                <li id="profil-${profil.id}">
                    <p>ID: ${profil.id} (Créé le: ${profil.created_at})</p>
                    <div class="admin-thumbnail-container">
                        <img src="/uploads/${profil.logo_path}" alt="Logo" class="admin-thumbnail">
                        <img src="/uploads/${profil.qr_path}" alt="QR Code" class="admin-thumbnail">
                    </div>
                    <div class="admin-info">
                        <p><strong>Contact :</strong> ${profil.contact_type || 'Non spécifié'}</p>
                        <p><strong>Valeur :</strong> ${profil.contact_value || 'Non spécifié'}</p>
                    </div>
                    <a href="/profil/${profil.id}" target="_blank" class="view-link">Voir la page</a>
                    <button class="delete-btn" data-id="${profil.id}">Supprimer</button>
                </li>
            `;
        });

        htmlContent += `
                    </ul>
                </div>
            </body>
            <script src="/admin.js"></script>
            </html>
        `;

        res.send(htmlContent);
    });
});

// Route pour supprimer une commande
app.delete('/profils/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM profils WHERE id = ?';

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Erreur lors de la suppression :', err);
            return res.status(500).json({ success: false, message: 'Erreur serveur lors de la suppression.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Profil non trouvé.' });
        }
        res.status(200).json({ success: true, message: 'Profil supprimé avec succès.' });
    });
});

app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});