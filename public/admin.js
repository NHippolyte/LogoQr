// Fichier : public/admin.js

document.addEventListener('DOMContentLoaded', () => {
    const deleteButtons = document.querySelectorAll('.delete-btn');

    deleteButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const profilId = e.target.dataset.id;
            const confirmed = confirm('Êtes-vous sûr de vouloir supprimer cette commande ?');

            if (confirmed) {
                try {
                    const response = await fetch(`/profils/${profilId}`, {
                        method: 'DELETE'
                    });

                    const result = await response.json();

                    if (result.success) {
                        // Supprime l'élément du DOM (sans recharger la page)
                        const listItem = document.getElementById(`profil-${profilId}`);
                        if (listItem) {
                            listItem.remove();
                        }
                        alert(result.message);
                    } else {
                        alert('Erreur lors de la suppression : ' + result.message);
                    }
                } catch (error) {
                    alert('Une erreur inattendue est survenue.');
                }
            }
        });
    });
});