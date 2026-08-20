import { computeStandings } from '../domain/standings'
import { isTournamentFinished } from '../domain/tournament'
import type { Standing, Tournament } from '../domain/types'

/**
 * Le goal-average tracé comme une mesure : un ruban gradué, un trait au zéro,
 * et le point jaune du cochonnet posé à la distance atteinte. C'est le geste
 * même de la pétanque — mesurer un écart de part et d'autre du but.
 */
function Mesure({ diff, etendue }: { diff: number; etendue: number }) {
  const proportion = etendue === 0 ? 0 : (Math.abs(diff) / etendue) * 50
  const positif = diff >= 0

  return (
    <div className="mesure" aria-hidden="true">
      <div className="mesure__ruban" />
      <div className="mesure__zero" />
      {diff !== 0 && (
        <div
          className={`mesure__trait${positif ? '' : ' mesure__trait--negatif'}`}
          style={{
            left: positif ? '50%' : `${50 - proportion}%`,
            width: `${proportion}%`,
          }}
        />
      )}
      <div
        className="mesure__point"
        style={{ left: `${positif ? 50 + proportion : 50 - proportion}%` }}
      />
    </div>
  )
}

const signe = (valeur: number): string => (valeur > 0 ? `+${valeur}` : String(valeur))

function Ligne({ ligne, etendue, podium }: { ligne: Standing; etendue: number; podium: boolean }) {
  return (
    <li className={`rang-ligne${podium ? ' rang-ligne--podium' : ''}`}>
      <span className="rang-ligne__rang">{ligne.rank}</span>
      <span className="rang-ligne__nom">{ligne.name}</span>

      <div className="rang-ligne__mesure">
        <Mesure diff={ligne.diff} etendue={etendue} />
      </div>

      <div className="rang-ligne__stats">
        <span className="rang-ligne__stat rang-ligne__stat--j">
          <b>{ligne.played}</b>
          <span className="rang-ligne__stat-libelle"> jouées</span>
        </span>
        <span className="rang-ligne__stat rang-ligne__stat--v">
          <b>{ligne.won}</b>
          <span className="rang-ligne__stat-libelle"> gagnées</span>
        </span>
        <span className="rang-ligne__stat rang-ligne__stat--moins">
          {ligne.pointsAgainst}
          <span className="rang-ligne__stat-libelle"> encaissés</span>
        </span>
        <span className="rang-ligne__stat rang-ligne__stat--plus">
          {ligne.pointsFor}
          <span className="rang-ligne__stat-libelle"> marqués</span>
        </span>
      </div>

      <span className="rang-ligne__diff">{signe(ligne.diff)}</span>
    </li>
  )
}

function Podium({ trois }: { trois: Standing[] }) {
  return (
    <section className="podium">
      <h3 className="podium__titre">Tournoi terminé</h3>
      <ol className="podium__liste">
        {trois.map((ligne) => (
          <li className="podium__place" key={ligne.teamId}>
            <span className="podium__rang">{ligne.rank}</span>
            <span className="podium__nom">{ligne.name}</span>
            <span className="podium__bilan">
              {ligne.won} V · {signe(ligne.diff)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function StandingsTable({ tournament }: { tournament: Tournament }) {
  const classement = computeStandings(tournament)
  const etendue = Math.max(1, ...classement.map((l) => Math.abs(l.diff)))
  const termine = isTournamentFinished(tournament)

  if (classement.length === 0) {
    return (
      <section className="section">
        <h2 className="section__titre">Classement</h2>
        <p className="vide">Le classement apparaîtra dès la première équipe inscrite.</p>
      </section>
    )
  }

  return (
    <section className="section">
      <h2 className="section__titre">Classement</h2>
      <p className="section__note">
        Départage : parties gagnées, puis goal-average, puis points marqués.
      </p>

      {termine && <Podium trois={classement.slice(0, 3)} />}

      <ol className="classement">
        <li className="rang-ligne rang-ligne--entete" aria-hidden="true">
          <span className="rang-ligne__rang">Rang</span>
          <span className="rang-ligne__nom">Équipe</span>
          <span className="rang-ligne__mesure">Écart</span>
          <span className="rang-ligne__stat--j">J</span>
          <span className="rang-ligne__stat--v">V</span>
          <span className="rang-ligne__stat--moins">Total −</span>
          <span className="rang-ligne__stat--plus">Total +</span>
          <span className="rang-ligne__diff">Total</span>
        </li>
        {classement.map((ligne) => (
          <Ligne
            key={ligne.teamId}
            ligne={ligne}
            etendue={etendue}
            podium={termine && ligne.rank <= 3}
          />
        ))}
      </ol>
    </section>
  )
}
