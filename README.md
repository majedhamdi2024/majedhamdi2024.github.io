# SUP'BASKET

Site officiel du club de basketball **SUP'BASKET** (SUP'COM).

## Démarrage

```bash
cd Desktop/supbasket
npm install
npm start
```

- Site public : http://localhost:3000  
- Admin : http://localhost:3000/admin  
- Mot de passe initial : `supbasket2026` (défini dans `.env`)

Changer le mot de passe :

```bash
npm run set-admin-password -- "nouveauMotDePasse"
```

## Fonctionnalités

- Site public : hero logo, club, effectif, matchs, galerie, contact
- Admin : messages, effectif, matchs, photos, paramètres
