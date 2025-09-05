const express = require('express');
const mysql = require('mysql2'); // Utilisation de mysql2
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const bodyParser = require('body-parser');

const app = express();
// const port = 3007;

// Configuration de la connexion à la base de données
const db = mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT
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

// Middleware pour servir les fichiers statiques et parser les données
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

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
    const logo = req.files.logo ? req.files.logo[0] : null;
    const qr = req.files.qr ? req.files.qr[0] : null;
    const contactValue = req.body.contact_value;
    const contactType = req.body.contact_type;

    if (!logo || !qr || !contactValue) {
        return res.status(400).json({ success: false, message: 'Données manquantes. Veuillez remplir tous les champs.' });
    }

    const logoPath = logo.filename;
    const qrPath = qr.filename;

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
                <img src="/images/LogFinal.png.PNG" alt="Logo de l'entreprise" class="main-logo">
                <h1>Merci pour votre commande !</h1>
                <p>Votre commande a bien été prise en charge. Nous vous contacterons pour gérer les détails.</p>
                <a href="/" class="view-link">Retour à l'accueil</a>
            </div>
        </body>
        </html>
    `);
});

// Route pour la page d'accueil
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Nouvelle route pour la page de connexion
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/login.html'));
});

// Middleware de vérification d'authentification
const checkAuth = (req, res, next) => {
    // Si l'URL contient le paramètre auth=true, on autorise l'accès
    if (req.query.auth === 'true') {
        next();
    } else {
        // Sinon, on redirige vers la page de connexion
        res.redirect('/login');
    }
};

// Route pour le traitement de la connexion
app.post('/login', (req, res) => {
    const ADMIN_USERNAME = 'TTC';
    const ADMIN_PASSWORD = 'sticks';
    
    const { username, password } = req.body;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // Redirection vers la page d'admin avec un paramètre d'authentification
        res.redirect('/admin?auth=true');
    } else {
        res.status(401).send('Identifiant ou mot de passe incorrect.');
    }
});

// Route sécurisée pour la page d'administration
app.get('/admin', (req, res) => {
    // On vérifie le paramètre d'authentification
    if (req.query.auth !== 'true') {
        return res.redirect('/login');
    }

    // Le reste du code de la route admin
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
                    <img src="/images/LogFinal.png.PNG" alt="Logo de l'entreprise" class="main-logo">
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

/* // Route pour le traitement de la connexion
app.post('/login', (req, res) => {
    const ADMIN_USERNAME = 'TTC';
    const ADMIN_PASSWORD = 'sticks';
    
    const { username, password } = req.body;
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    // Redirection avec un paramètre pour l'authentification
    res.redirect('/admin?auth=true');
    } else {
    res.status(401).send('Identifiant ou mot de passe incorrect.');
    }
    });

// Route sécurisée pour la page d'administration
app.get('/admin', checkAuth, (req, res) => {
    // Si la requête arrive ici, elle a passé le middleware d'authentification
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
                    <img src="/images/LogFinal.png.PNG" alt="Logo de l'entreprise" class="main-logo">
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
}); */

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
                    <div class="profile-actions">
                        <a href="/download/${profil.id}" class="download-btn">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
                              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a.5.5 0 0 0 .5.5h12a.5.5 0 0 0 .5-.5v-2.5a.5.5 0 0 1 1 0v2.5a1.5 1.5 0 0 1-1.5 1.5h-12A1.5 1.5 0 0 1 0 12.9v-2.5a.5.5 0 0 1 .5-.5z"/>
                              <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                            </svg>
                            Télécharger
                        </a>
                        <a href="/admin" class="profile-back-link">Retour à l'administration</a>
                    </div>
                </div>
            </body>
            </html>
        `);
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

// Nouvelle route pour télécharger un profil en tant qu'archive ZIP
app.get('/download/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'SELECT * FROM profils WHERE id = ?';

    db.query(sql, [id], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).send('Profil non trouvé.');
        }

        const profil = results[0];
        const logoPath = path.join(__dirname, 'uploads', profil.logo_path);
        const qrPath = path.join(__dirname, 'uploads', profil.qr_path);

        // Vérifier si les fichiers existent
        if (!fs.existsSync(logoPath) || !fs.existsSync(qrPath)) {
            return res.status(404).send('Les fichiers ne sont pas trouvés sur le serveur.');
        }

        const archive = archiver('zip', {
            zlib: { level: 9 } // Compression maximale
        });

        res.attachment(`profil-${id}.zip`);
        archive.pipe(res);

        archive.file(logoPath, { name: profil.logo_path });
        archive.file(qrPath, { name: profil.qr_path });

        archive.finalize();
    });
});

app.listen(port, () => {
    console.log(`Serveur démarré sur http://localhost:${port}`);
});