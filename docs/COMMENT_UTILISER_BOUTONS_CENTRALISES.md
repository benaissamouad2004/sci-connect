# Comment utiliser les boutons centralises

J'ai ajoute deux fichiers :

- `frontend/js/boutons-plateforme.js`
- `frontend/css/boutons-plateforme.css`

Le premier fichier contient les boutons.
Le deuxieme fichier contient leurs couleurs et leurs styles.

---

## 1. Ajouter les imports dans une page

Dans une page HTML, ajoute ces lignes :

```html
<link rel="stylesheet" href="css/boutons-plateforme.css">
<script src="js/boutons-plateforme.js" defer></script>
```

Le CSS va dans le `<head>`.
Le JS va vers la fin ou avec `defer`.

---

## 2. Ajouter une zone de boutons

Dans la page HTML, mets une zone comme ceci :

```html
<div data-button-zone="dashboard.topbar"></div>
```

Cette zone veut dire :

```text
Va chercher les boutons dans :
BOUTONS_PLATEFORME.dashboard.topbar
```

---

## 3. Modifier un bouton existant

Ouvre :

```text
frontend/js/boutons-plateforme.js
```

Exemple :

```javascript
{
  id: 'stats-export-main-btn',
  label: 'Telecharger Excel',
  variant: 'primary',
  action: 'exportExcel',
  title: 'Exporter les statistiques'
}
```

Tu peux modifier :

- `label` pour changer le texte ;
- `variant` pour changer la couleur ;
- `action` pour changer ce que fait le bouton ;
- `title` pour changer le petit texte au survol.

---

## 4. Changer la couleur d'un bouton

Dans `boutons-plateforme.js`, change :

```javascript
variant: 'primary'
```

Par exemple :

```javascript
variant: 'accent'
```

Variantes disponibles :

| Variant | Couleur |
|---|---|
| `primary` | vert principal |
| `secondary` | blanc / secondaire |
| `accent` | dore |
| `danger` | rouge |
| `tab` | onglet normal |
| `tabActive` | onglet actif |
| `icon` | bouton icone |
| `iconPrimary` | bouton icone principal |
| `chip` | petit bouton choix |
| `chipActive` | petit bouton choix actif |

---

## 5. Ajouter un nouveau bouton

Exemple :
Tu veux ajouter un bouton dans la topbar du dashboard.

Dans `boutons-plateforme.js`, cherche :

```javascript
dashboard: {
  topbar: [
```

Puis ajoute :

```javascript
{
  id: 'dash-help-btn',
  label: 'Aide',
  variant: 'secondary',
  action: 'goHelp',
  title: 'Ouvrir la page aide'
}
```

Ensuite ajoute l'action dans `ACTIONS_BOUTONS` :

```javascript
goHelp() {
  window.location.href = 'aide.html';
}
```

---

## 6. Ajouter une nouvelle position

Exemple :
Tu veux une zone dans le dashboard appelee `footer`.

Dans le HTML :

```html
<div data-button-zone="dashboard.footer"></div>
```

Dans `boutons-plateforme.js` :

```javascript
dashboard: {
  footer: [
    {
      id: 'dash-footer-btn',
      label: 'Bouton footer',
      variant: 'primary',
      action: 'goDashboard',
      title: 'Exemple'
    }
  ]
}
```

---

## 7. Resume simple

Pour ajouter ou modifier un bouton :

```text
1. HTML : ajouter data-button-zone a l'endroit voulu
2. JS : ajouter le bouton dans boutons-plateforme.js
3. CSS : changer la couleur dans boutons-plateforme.css si besoin
```

Phrase a retenir :

`data-button-zone` indique l'endroit.
`boutons-plateforme.js` indique les boutons.
`boutons-plateforme.css` indique les couleurs.
