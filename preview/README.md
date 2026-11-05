# Preview du header v2

Prévisualisation locale, dans le navigateur, du header de `portal-v2.html`.
Pas de backend ni d'Angular : le SCSS du thème est compilé et le HTML du header
est injecté dans une page statique.

## Lancer

```sh
cd preview
npm install          # une seule fois
node dev.mjs         # thème "na" par défaut
```

Ouvrir <http://localhost:8080> (l'URL exacte est affichée dans le terminal).

## Tester un autre thème

Le paramètre est le nom d'un dossier de `../overrides/` :

```sh
node dev.mjs cg77
node dev.mjs default
```

Le script reproduit `build.sh` : `scss/` est copié, puis
`overrides/<thème>/css/*` est copié par-dessus avant la compilation. Les images
(logo) et les traductions viennent aussi de `overrides/<thème>/`, avec repli sur
`assets/`.

## Lancer plusieurs thèmes à la fois

Un terminal par thème. Le port est choisi automatiquement : 8080 s'il est
libre, sinon le suivant (8081, 8082…). Chaque instance affiche son URL :

```sh
node dev.mjs na       # → http://localhost:8080
node dev.mjs cg77     # → http://localhost:8081
```

Pour imposer un port : `node dev.mjs cg77 9000` ou `PORT=9000 node dev.mjs cg77`
(erreur si le port est occupé). Chaque thème compile dans son propre dossier
`build/<thème>`, les instances ne se gênent pas.

## Choisir portal-v2 ou portal

La page affiche par défaut `portal-v2.html`. Pour voir `portal.html` (header
v1), utiliser le sélecteur sous le header ou l'URL :

- <http://localhost:8080/?portal=portal-v2>
- <http://localhost:8080/?portal=portal>

Les directives Angular sont retirées : les parties dépendantes de
l'utilisateur de `portal.html` (messagerie injectée par `ng-include`, apps
favorites, recherche) s'affichent sans données ou sont absentes.

## Rechargement automatique

La page se recharge toute seule quand l'un de ces éléments change :

- `scss/`
- `overrides/<thème>/css/`
- `skins/`
- `portal-v2.html` et `portal.html`

Une erreur Sass s'affiche dans le terminal (`sass error`) ; la page garde la
dernière compilation valide. Pour changer de thème, il faut relancer la commande.

## Limites

- Données factices : badges à 3, avatar gris.
- Seul le clic sur la cloche (popover de notifications) est reproduit.
- Seul le header est affiché, pas le reste de la page.
- Les polices Google sont chargées depuis internet.
- `entcore-css-lib` vient du tag npm `develop` (voir `package.json`). Si la
  version utilisée en recette diffère, le rendu peut légèrement varier.
- Si `portal-v2.html` change de structure (nouveaux `ng-*`, nouvelles
  variables `[[...]]`), adapter les remplacements de la fonction `page()` dans
  `dev.mjs`.

## Git

À commiter : `README.md`, `dev.mjs`, `package.json`. Le `.gitignore` racine
ignore déjà `node_modules/`, `build/` et `package-lock.json` (et contient
`!preview/package.json`, car `package.json` est ignoré à la racine).
