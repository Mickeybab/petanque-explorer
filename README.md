# Tournoi de pétanque — Labruyère-Dorsa

Petite application web pour tenir le tournoi adulte en doublettes : on inscrit
les équipes, l'application tire les quatre tours, on saisit un score par match
et le classement se calcule tout seul. Elle remplace le classeur Excel des
années précédentes.

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
   Les inscriptions se ferment au tirage du tour 1 ; les noms restent
   corrigeables ensuite.
2. **Tours** — lancer le tirage, puis saisir les scores au fur et à mesure. Le
   tour suivant ne se tire qu'une fois tous les scores du tour en cours entrés.
   Un score déjà saisi reste corrigeable à tout moment.
3. **Classement** — mis à jour en continu, imprimable tel quel (Ctrl/Cmd + P).

Le tournoi est enregistré dans le navigateur à chaque modification. Le bouton
**Exporter** produit un fichier JSON de secours, que **Importer** relit.

## Règles appliquées

- **Format** : doublettes, 4 tours, un match par équipe et par tour.
- **Appariement** : tour 1 tiré au sort ; tours 2 à 4 en système suisse — les
  équipes de niveau proche se rencontrent, sans jamais rejouer un adversaire
  déjà affronté. Si aucune combinaison sans revanche n'existe, l'application
  en compose une et signale les matchs concernés.
- **Effectif impair** : une équipe est exempte à chaque tour et marque 13-7.
  L'application ne réexempte une équipe que si toutes y sont déjà passées.
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
| `src/domain/standings.ts` | calcul du classement |
| `src/domain/pairing.ts` | tirage au sort, appariement suisse, équipe exempte |
| `src/domain/tournament.ts` | transitions d'état (reducer) et règles d'enchaînement |
| `src/domain/rng.ts` | aléatoire à graine, pour un tirage reproductible |
| `src/storage/persistence.ts` | sauvegarde navigateur, validation des imports |
| `src/components/` | interface React |

```bash
npm test         # suite Vitest du domaine
npm run typecheck
npm run build
```
