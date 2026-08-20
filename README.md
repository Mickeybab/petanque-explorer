# Tournoi de pétanque — Labruyère-Dorsa

Petite application web pour tenir le tournoi adulte en doublettes : on inscrit
les équipes, l'application compose les oppositions au fil de l'eau, on saisit un
score par partie et le classement se calcule tout seul. Elle remplace le
classeur Excel des années précédentes.

Chaque équipe joue quatre parties. Dès qu'une partie se termine, les deux
équipes repartent contre des adversaires de leur niveau, sans attendre que les
autres terrains se libèrent.

Tout tourne dans le navigateur : pas de serveur, pas de compte, pas de réseau
nécessaire sur le terrain.

## Utilisation

```bash
npm install
npm run dev      # http://localhost:5173
```

Pour l'emporter le jour du tournoi :

```bash
npm run build    # produit dist/, à ouvrir ou à déposer sur un hébergement statique
```

### Le jour J

1. **Équipes** — saisir les doublettes, une par ligne (Entrée pour enchaîner).
   Les inscriptions se ferment au lancement ; les noms restent corrigeables.
2. **Parties** — lancer le tournoi, puis saisir les deux scores d'une partie
   terminée et **valider** (bouton, ou touche Entrée ; Échap annule). Rien n'est
   enregistré avant la validation : on peut taper un 13 sans que la carte bouge.
   Les équipes libérées repartent alors immédiatement contre une équipe au même
   bilan. Celles qui patientent, et la raison de leur attente, sont listées sous
   « Au repos ». Un score déjà saisi reste corrigeable de la même façon.
3. **Classement** — mis à jour en continu, imprimable tel quel (Ctrl/Cmd + P).

Le tournoi est enregistré dans le navigateur à chaque modification. Le bouton
**Exporter** produit un fichier JSON de secours, que **Importer** relit.

## Règles appliquées

- **Format** : doublettes, quatre parties par équipe.
- **Appariement** : la première partie est tirée au sort. Ensuite, deux équipes
  ne s'affrontent que si elles ont **exactement le même bilan** — mêmes
  victoires, mêmes défaites — et ne se sont **jamais rencontrées**. C'est le
  système suisse, appliqué au fil de l'eau plutôt que tour par tour.
- **Sans attendre les autres** : une équipe qui termine repart dès qu'une autre
  équipe de son bilan se libère. Elle ne peut toutefois pas prendre plus d'une
  partie d'avance sur la plus lente, faute de quoi quelques équipes rapides
  joueraient le tournoi entre elles.
- **Flotteur** : quand un groupe de bilan est impair — trois gagnants, par
  exemple — une équipe descend d'un cran et affronte le groupe voisin. Ces
  matchs portent le badge « Flotteur ». L'application ne descend jamais de plus
  d'un cran tant qu'attendre reste possible.
- **Effectif impair** : l'équipe qui reste sans adversaire possible est exempte
  et marque 13-7. Le choix se fait une fois le tour joué, et jamais deux fois la
  même équipe tant que d'autres n'y sont pas passées.
- **Revanche** : dernier recours, quand plus aucun adversaire inédit n'existe.
  Elle est alors signalée par un badge. Sur 400 tournois simulés de 6 à
  40 équipes, cela n'est survenu qu'à 6 équipes — un effectif où chacune doit
  affronter 4 des 5 autres.
- **Classement** : parties gagnées, puis goal-average (Total + − Total −), puis
  points marqués. Les équipes strictement à égalité partagent le même rang.
- **Scores** : entiers positifs libres — rien n'oblige le gagnant à 13, ce qui
  permet les parties arrêtées au temps. L'égalité est admise et ne donne de
  victoire à personne.

## Organisation du code

La logique du tournoi est isolée dans `src/domain/`, sans aucune dépendance à
React ni au navigateur : c'est elle qui porte les tests.

| Fichier | Rôle |
| --- | --- |
| `src/domain/types.ts` | modèle de données |
| `src/domain/progress.ts` | avancement de chaque équipe : bilan, partie en cours, exemptions |
| `src/domain/standings.ts` | calcul du classement |
| `src/domain/pairing.ts` | tirage au sort, appariement suisse au fil de l'eau, flotteurs, équipe exempte |
| `src/domain/tournament.ts` | transitions d'état (reducer) et relance automatique de l'appariement |
| `src/domain/rng.ts` | aléatoire à graine, pour un tirage reproductible |
| `src/storage/persistence.ts` | sauvegarde navigateur, validation des imports |
| `src/components/` | interface React |

```bash
npm test         # suite Vitest du domaine
npm run typecheck
npm run build
```

## Déploiement

Chaque `push` sur `main` déclenche `.github/workflows/deploy.yml` : tests, build,
puis publication du dossier `dist/` sur GitHub Pages. Le site est servi depuis
`https://mickeybab.github.io/petanque-explorer/`.

La configuration Vite utilise `base: './'`, donc les chemins restent relatifs :
l'app fonctionne aussi bien dans ce sous-dossier qu'ouverte depuis le disque.
